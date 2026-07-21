/**
 * EmailHtmlFrame — renders untrusted HTML email bodies safely.
 *
 * Strategy:
 *   1. Preserve the email HTML/CSS as-is for rendering fidelity.
 *   2. Strip only executable/navigation primitives that should never be
 *      needed for an email preview.
 *   3. Block remote images by default — loading them leaks a read receipt to
 *      the sender (tracking pixels). Inline (`data:` / `cid:`) images are
 *      always allowed. A toolbar lets the user opt in per-message.
 *   4. Wrap the result in a minimal HTML document when the payload is a
 *      fragment.
 *   5. Render it inside a <iframe srcDoc sandbox="..."> — the browser then
 *      enforces the security boundary at the platform level.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, useTheme } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';

interface EmailHtmlFrameProps {
  html: string;
  /** Cap the auto-grown height so a runaway email cannot push the page absurdly tall. */
  maxHeight?: number;
}

// No sanitizer allowlist and no base styles are applied here. Allowlist-based
// sanitizers drop email-specific tags/attributes/classes that templates use
// for image dimensions and responsive sizing. The sandbox is the primary
// security boundary; this helper only removes active content before srcDoc.
const hardenHtmlForSandbox = (dirty: string): string => {
  let safe = dirty || '';

  safe = safe
    .replace(/<\s*(script|object|embed|iframe|template|portal)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|object|embed|iframe|template|portal)\b[^>]*\/?>/gi, '')
    .replace(/<\s*meta\b(?=[^>]*http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh))[^>]*>/gi, '');

  safe = safe
    .replace(/\s+on[a-z0-9_:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src|xlink:href|formaction|action)\s*=\s*"[\t\n\r ]*(?:javascript|vbscript):[^"]*"/gi, '')
    .replace(/\s+(href|src|xlink:href|formaction|action)\s*=\s*'[\t\n\r ]*(?:javascript|vbscript):[^']*'/gi, '')
    .replace(/\s+(href|src|xlink:href|formaction|action)\s*=\s*[\t\n\r ]*(?:javascript|vbscript):[^\s>]*/gi, '');

  return safe;
};

// A URL counts as "remote" (i.e. leaks a request to a third party) unless it
// is an inline data URI, an attached cid: reference, or an about: blank.
const isRemoteUrl = (raw: string): boolean => {
  const v = (raw || '').trim();
  if (!v) return false;
  if (/^(data:|cid:|about:)/i.test(v)) return false;
  // http, https, protocol-relative //, and everything else that would trigger
  // a network fetch (ftp:, custom schemes) is treated as remote.
  return true;
};

/**
 * Block network-loading image references so opening the email cannot silently
 * confirm receipt to the sender. Preserves the original URL in a data-* attr
 * so we can restore it when the user opts in.
 */
const blockRemoteImages = (input: string): { html: string; blocked: number } => {
  let blocked = 0;

  // <img src="..."> — remove src, keep original in data-blocked-src.
  let out = input.replace(
    /<img\b([^>]*?)\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>/gi,
    (_m, pre: string, dq: string, sq: string, uq: string, post: string) => {
      const url = dq ?? sq ?? uq ?? '';
      if (!isRemoteUrl(url)) {
        return `<img${pre} src="${url}"${post}>`;
      }
      blocked += 1;
      const safeUrl = url.replace(/"/g, '&quot;');
      return `<img${pre} data-blocked-src="${safeUrl}"${post}>`;
    },
  );

  // srcset — same treatment.
  out = out.replace(
    /<img\b([^>]*?)\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)')([^>]*)>/gi,
    (_m, pre: string, dq: string, sq: string, post: string) => {
      const val = dq ?? sq ?? '';
      const anyRemote = val.split(',').some((part) => {
        const url = part.trim().split(/\s+/)[0] || '';
        return isRemoteUrl(url);
      });
      if (!anyRemote) return `<img${pre} srcset="${val}"${post}>`;
      blocked += 1;
      const safeVal = val.replace(/"/g, '&quot;');
      return `<img${pre} data-blocked-srcset="${safeVal}"${post}>`;
    },
  );

  // background="..." attribute on td/table etc.
  out = out.replace(
    /(<[a-z][^>]*?)\sbackground\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*>)/gi,
    (_m, pre: string, dq: string, sq: string, uq: string, post: string) => {
      const url = dq ?? sq ?? uq ?? '';
      if (!isRemoteUrl(url)) return `${pre} background="${url}"${post}`;
      blocked += 1;
      const safeUrl = url.replace(/"/g, '&quot;');
      return `${pre} data-blocked-background="${safeUrl}"${post}`;
    },
  );

  // Inline style="... url(...) ..." — neutralize remote url() calls.
  out = out.replace(
    /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (match, dq: string, sq: string) => {
      const style = dq ?? sq ?? '';
      if (!/url\s*\(/i.test(style)) return match;
      let touched = false;
      const rewritten = style.replace(
        /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
        (full, quote: string, url: string) => {
          if (!isRemoteUrl(url)) return full;
          touched = true;
          return `url(${quote}about:blank${quote})`;
        },
      );
      if (touched) blocked += 1;
      const useDouble = dq !== undefined;
      const safe = useDouble ? rewritten.replace(/"/g, '&quot;') : rewritten.replace(/'/g, '&#39;');
      return useDouble ? ` style="${safe}"` : ` style='${safe}'`;
    },
  );

  return { html: out, blocked };
};

// Only a <meta name="referrer"> is injected — no styles. Real mail clients
// render the email's own HTML/CSS untouched inside their viewport; adding
// our own base styles fights the template and distorts sizing/layout.
const HEAD_INJECT = `<meta name="referrer" content="no-referrer">`;

const buildDocument = (sanitized: string): string => {
  const trimmed = (sanitized || '').trim();
  if (/^<!doctype|^<html[\s>]/i.test(trimmed)) {
    if (/<head[\s>]/i.test(trimmed)) {
      return trimmed.replace(/<head([^>]*)>/i, `<head$1>${HEAD_INJECT}`);
    }
    return trimmed.replace(/<html([^>]*)>/i, `<html$1><head>${HEAD_INJECT}</head>`);
  }
  // Fragment — wrap it with an empty head so referrer policy still applies.
  return `<!doctype html><html><head>${HEAD_INJECT}</head><body>${trimmed}</body></html>`;
};

const EmailHtmlFrame = ({ html, maxHeight = 4000 }: EmailHtmlFrameProps) => {
  const theme = useTheme();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(80);
  const [imagesAllowed, setImagesAllowed] = useState(false);

  // Reset the opt-in whenever the underlying message changes so we don't
  // silently keep loading remote images for a different email.
  useEffect(() => {
    setImagesAllowed(false);
  }, [html]);

  const { srcDoc, blockedCount } = useMemo(() => {
    const hardened = hardenHtmlForSandbox(html || '');
    if (imagesAllowed) {
      return { srcDoc: buildDocument(hardened), blockedCount: 0 };
    }
    const { html: blocked, blocked: count } = blockRemoteImages(hardened);
    return { srcDoc: buildDocument(blocked), blockedCount: count };
  }, [html, imagesAllowed]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc || !doc.body) return;
        const h = Math.min(
          Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight),
          maxHeight,
        );
        setHeight(h + 4);
      } catch {
        setHeight(400);
      }
    };

    measure();
    const onLoad = () => {
      measure();
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.querySelectorAll('img').forEach((img) => {
          if (!(img as HTMLImageElement).complete) {
            img.addEventListener('load', measure, { once: true });
            img.addEventListener('error', measure, { once: true });
          }
        });

        // Bridge text selections inside the email iframe up to the parent so
        // the "Create automation rule" chip can appear for email body text.
        const forwardSelection = () => {
          try {
            const sel = doc.getSelection?.();
            if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
            const text = sel.toString().trim();
            if (text.length < 3) return;
            const range = sel.getRangeAt(0);
            const rectInFrame = range.getBoundingClientRect();
            const iframeRect = iframe.getBoundingClientRect();
            const x = iframeRect.left + rectInFrame.left + rectInFrame.width / 2;
            const y = iframeRect.top + rectInFrame.bottom + 8;
            window.dispatchEvent(
              new CustomEvent('selection-rule:external', {
                detail: { x, y, text, field: 'rawOCSF.unmapped_original.body' },
              }),
            );
          } catch {
            /* ignore cross-origin */
          }
        };
        doc.addEventListener('mouseup', forwardSelection);
        doc.addEventListener('touchend', forwardSelection);
      } catch {
        /* ignore */
      }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [srcDoc, maxHeight]);

  return (
    <Box
      sx={{
        border: '1px solid #d0d7de',
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 1px 2px rgba(0,0,0,0.4)'
            : '0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      {!imagesAllowed && blockedCount > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: 1.5,
            py: 0.75,
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#fff8e1',
            color: '#5b4a15',
            fontSize: 12.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageOutlinedIcon sx={{ fontSize: 16 }} />
            <span>
              Remote images blocked to prevent read tracking
              {blockedCount > 1 ? ` (${blockedCount} references)` : ''}.
            </span>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setImagesAllowed(true)}
            sx={{
              height: 26,
              minHeight: 26,
              textTransform: 'none',
              fontSize: 12,
              borderColor: '#c9a227',
              color: '#5b4a15',
              '&:hover': { borderColor: '#a07d10', backgroundColor: 'rgba(201,162,39,0.08)' },
            }}
          >
            Load images
          </Button>
        </Box>
      )}
      <iframe
        ref={iframeRef}
        title="Email body"
        srcDoc={srcDoc}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        referrerPolicy="no-referrer"
        style={{
          width: '100%',
          height: `${height}px`,
          border: 'none',
          display: 'block',
          backgroundColor: '#ffffff',
        }}
      />
    </Box>
  );
};

export default EmailHtmlFrame;
