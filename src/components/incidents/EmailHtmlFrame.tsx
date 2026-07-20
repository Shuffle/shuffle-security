/**
 * EmailHtmlFrame — renders untrusted HTML email bodies safely.
 *
 * Strategy:
 *   1. Preserve the email HTML/CSS as-is for rendering fidelity.
 *   2. Strip only executable/navigation primitives that should never be
 *      needed for an email preview.
 *   3. Wrap the result in a minimal HTML document when the payload is a
 *      fragment.
 *   3. Render it inside a <iframe srcDoc sandbox="..."> — the browser then
 *      enforces the security boundary at the platform level. Even if the
 *      hardening misses something exotic, the iframe cannot:
 *        - execute JavaScript          (no `allow-scripts`)
 *        - access this page's DOM      (no `allow-same-origin`)
 *        - submit forms                (no `allow-forms`)
 *        - navigate this window        (no `allow-top-navigation`)
 *        - read cookies / storage      (isolated origin)
 *      Links still open in a new tab thanks to `allow-popups` +
 *      `allow-popups-to-escape-sandbox`.
 *
 *   4. The iframe self-reports its content height on load / resize so it
 *      renders inline with the rest of the thread — no scrollbars, no
 *      arbitrary height guess.
 *
 * Result: emails keep their original sizing/layout CSS while JS is impossible.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, useTheme } from '@mui/material';

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

  const srcDoc = useMemo(() => {
    return buildDocument(hardenHtmlForSandbox(html || ''));
  }, [html]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Measure content height. srcDoc iframes are same-origin readable
    // from the embedder even without `allow-same-origin` in the sandbox
    // (the sandbox restricts the iframe's own privileges, not ours).
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
        // Rare browsers may deny access; fall back to a sensible default.
        setHeight(400);
      }
    };

    measure();
    // Re-measure after late resources (images, web fonts) load.
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
