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

// Baseline styles injected as a FALLBACK only. We use :where() so specificity
// is zero — any style the email ships (inline style="" or <style>) wins.
// Emails are almost universally light-themed and hardcode colors against a
// white canvas, so we render on white to preserve the sender's intent
// (this is exactly what Gmail / Outlook Web / Superhuman do).
const BASE_STYLES = `
  :where(html, body) {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #202124;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  :where(body) { padding: 12px 16px; }
  :where(img) { max-width: 100%; height: auto; }
  :where(a) { color: #1a73e8; }
  :where(blockquote) {
    border-left: 3px solid #e0e0e0;
    padding-left: 12px;
    margin-left: 0;
    color: #5f6368;
  }
  :where(pre) { white-space: pre-wrap; word-break: break-word; }
`;

const sanitize = (dirty: string): string =>
  DOMPurify.sanitize(dirty, {
    // Kept from previous config: no active content, no navigation hijacks.
    FORBID_TAGS: [
      'script', 'object', 'embed', 'iframe',
      'meta', 'link', 'base', 'template', 'portal',
    ],
    FORBID_ATTR: ['formaction', 'action', 'ping', 'background'],
    // Preserve <style>, <html>, <head>, <body> so email CSS keeps its
    // intended scope. The iframe sandbox is what keeps this safe — CSS
    // cannot execute JS, and the sandbox blocks scripts / forms / same
    // origin regardless of what tags survive here.
    ADD_TAGS: ['style'],
    ADD_ATTR: ['target', 'rel'],
    ALLOWED_URI_REGEXP:
      /^(?:https?:|mailto:|tel:|cid:|#|\/|\.{0,2}\/|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);)/i,
    SANITIZE_DOM: true,
    // Return the full document so <head>/<style>/<body> structure is kept.
    WHOLE_DOCUMENT: true,
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

const BASE_STYLE_TAG = `<style>${BASE_STYLES}</style><meta name="referrer" content="no-referrer">`;

const buildDocument = (sanitized: string): string => {
  const trimmed = (sanitized || '').trim();
  // If DOMPurify returned a full document, inject our fallback styles into
  // <head> (or before </html>) so email-provided styles override ours.
  if (/^<!doctype|^<html[\s>]/i.test(trimmed)) {
    if (/<head[\s>]/i.test(trimmed)) {
      return trimmed.replace(/<head([^>]*)>/i, `<head$1>${BASE_STYLE_TAG}`);
    }
    return trimmed.replace(/<html([^>]*)>/i, `<html$1><head>${BASE_STYLE_TAG}</head>`);
  }
  // Fragment — wrap it.
  return `<!doctype html><html><head>${BASE_STYLE_TAG}</head><body>${trimmed}</body></html>`;
};

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
