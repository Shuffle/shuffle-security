/**
 * safeExternalLinks — click handler factory for blocks of foreign HTML
 * (email bodies, webhook payloads, AI-generated markdown) where every
 * `<a href>` should be treated as untrusted.
 *
 * Behaviour:
 *  1. Intercept the click before the browser navigates.
 *  2. Show a confirm() dialog with the resolved URL so the user has to
 *     explicitly approve opening it.
 *  3. Open in a new tab/window with `noopener,noreferrer` so the target
 *     page can never reach back into our app via window.opener.
 *
 * Usage:
 *   <Box onClick={confirmExternalLinkClick} dangerouslySetInnerHTML={...} />
 *
 * If a link target needs different behaviour (e.g. internal anchors) the
 * caller can wrap it before/after.
 */
import type { MouseEvent } from 'react';

const CONFIRM_PREFIX = 'This link is from an untrusted source.\n\nOpen in a new tab?\n\n';

/** Resolve a possibly-relative href against the current document so we can
 *  show a meaningful URL in the confirm dialog. */
const resolveHref = (raw: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  // Allow mailto: / tel: through but still confirm.
  if (/^(mailto|tel|sms):/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, window.location.href).toString();
  } catch {
    return trimmed;
  }
};

export const confirmExternalLinkClick = (e: MouseEvent<HTMLElement>) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const anchor = target.closest('a') as HTMLAnchorElement | null;
  if (!anchor) return;

  // We always handle the click ourselves — never let the inline href
  // navigate the current tab (could be a phishing URL).
  e.preventDefault();
  e.stopPropagation();

  const href = resolveHref(anchor.getAttribute('href'));
  if (!href) return;

  // eslint-disable-next-line no-alert
  const ok = window.confirm(`${CONFIRM_PREFIX}${href}`);
  if (!ok) return;

  // Open in a new window with safe rel — noopener prevents window.opener
  // back-channel, noreferrer prevents Referer leakage.
  window.open(href, '_blank', 'noopener,noreferrer');
};
