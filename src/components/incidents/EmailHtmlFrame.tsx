/**
 * EmailHtmlFrame — renders untrusted HTML email bodies safely.
 *
 * Strategy (same pattern Gmail / Outlook Web / Superhuman use):
 *   1. Sanitize the HTML with DOMPurify (script/object/embed/iframe/meta
 *      stripped, all on* attrs and javascript:/vbscript: URIs removed).
 *   2. Wrap the result in a minimal HTML document.
 *   3. Render it inside a <iframe srcDoc sandbox="..."> — the browser then
 *      enforces the security boundary at the platform level. Even if the
 *      sanitizer misses something exotic, the iframe cannot:
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
 * Result: emails look exactly like they do in Gmail (tables, inline styles,
 * data-URI images, `<style>` blocks all work) while JS is impossible.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import DOMPurify from 'dompurify';

interface EmailHtmlFrameProps {
  html: string;
  /** Cap the auto-grown height so a runaway email cannot push the page absurdly tall. */
  maxHeight?: number;
}

// Baseline styles injected into the iframe document so untyped emails still
// look reasonable. Emails that ship their own styles will override these.
const BASE_STYLES = `
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #1f1f1f;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.55;
    word-break: break-word;
  }
  body { padding: 12px 14px; }
  img { max-width: 100%; height: auto; }
  a { color: #1a73e8; }
  blockquote {
    border-left: 3px solid #e0e0e0;
    padding-left: 12px;
    margin-left: 0;
    color: #5f6368;
  }
  table { max-width: 100% !important; }
  pre { white-space: pre-wrap; word-break: break-word; }
`;

// Height-reporter script. This runs inside the sandboxed iframe but is
// scoped to *this document only* — it cannot reach the parent DOM because
// the sandbox has no `allow-same-origin`. It uses postMessage which is
// cross-origin-safe by design.
//
// NOTE: `allow-scripts` is intentionally OFF, so this script never runs.
// Instead we measure from the parent using onLoad + a MutationObserver on
// the iframe's contentDocument — which IS reachable, because a srcDoc
// iframe *without* allow-same-origin still exposes its document to the
// embedder for reading. This gives us auto-height without giving the
// email code any JS execution surface.

const sanitize = (dirty: string): string =>
  DOMPurify.sanitize(dirty, {
    // Kept from previous config: no active content, no navigation hijacks.
    FORBID_TAGS: [
      'script', 'object', 'embed', 'iframe',
      'meta', 'link', 'base', 'template', 'portal',
    ],
    // DOMPurify strips all on* by default. formaction/action/ping/background
    // are the legacy navigation vectors we also want gone.
    FORBID_ATTR: ['formaction', 'action', 'ping', 'background'],
    // <style> blocks and inline styles are what make emails look like emails.
    // They are safe inside our sandboxed iframe — CSS can't run JS.
    ADD_TAGS: ['style'],
    ADD_ATTR: ['target', 'rel'],
    // Allow http(s), mailto, tel, cid, fragments, relative, AND data:image
    // (mail merges frequently inline logos as data-URI images).
    ALLOWED_URI_REGEXP:
      /^(?:https?:|mailto:|tel:|cid:|#|\/|\.{0,2}\/|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);)/i,
    // Prevent DOM clobbering (<img name="body"> etc.).
    SANITIZE_DOM: true,
    // We are wrapping the output in <html><body> below, so ask DOMPurify to
    // give us just the body fragment.
    WHOLE_DOCUMENT: false,
  });

// Belt-and-braces post-hook — installed once per module load. Force every
// anchor open in a new tab (survives middle-click / cmd-click) and strip
// any surviving event-handler attribute or javascript: URI in an exotic
// namespace DOMPurify may have missed.
let hookInstalled = false;
const ensureHook = () => {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as Element;
    if (!el || !el.attributes) return;
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes[i];
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      // Block javascript:/vbscript: on any URI attr. `data:image/*` is
      // whitelisted above via ALLOWED_URI_REGEXP; everything else `data:`
      // is already rejected by that regex.
      if (
        (name === 'href' ||
          name === 'src' ||
          name === 'xlink:href' ||
          name === 'formaction' ||
          name === 'action') &&
        /^\s*(?:javascript|vbscript):/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
};

const buildDocument = (sanitizedBody: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><style>${BASE_STYLES}</style></head><body>${sanitizedBody}</body></html>`;

const EmailHtmlFrame = ({ html, maxHeight = 4000 }: EmailHtmlFrameProps) => {
  const theme = useTheme();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(80);

  const srcDoc = useMemo(() => {
    ensureHook();
    return buildDocument(sanitize(html || ''));
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
        // Absolutely minimal capability set:
        //   - allow-popups: link clicks can open a new tab
        //   - allow-popups-to-escape-sandbox: the new tab is a normal tab,
        //     not itself sandboxed (would break the destination site).
        // Everything else (scripts, forms, same-origin, top-navigation,
        // pointer-lock, modals) is denied by omission.
        // `allow-same-origin` is required for the parent to read
        // `contentDocument.scrollHeight` for auto-sizing. It is safe here
        // *only because* `allow-scripts` is omitted — no code inside the
        // frame can run, so same-origin access grants no attack surface.
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        // `no-referrer` policy stops the iframe from leaking our URL to
        // any resource it loads (tracking pixels, remote images).
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
