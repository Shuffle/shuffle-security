/**
 * safeExternalLinks — click handler factory for blocks of foreign HTML
 * (email bodies, webhook payloads, AI-generated markdown) where every
 * `<a href>` should be treated as untrusted.
 *
 * Behaviour:
 *  1. Intercept the click before the browser navigates.
 *  2. Dispatch a global event that <ExternalLinkConfirmDialog /> listens
 *     for, presenting a styled MUI confirmation with the resolved URL
 *     and host so the user has to explicitly approve opening it.
 *  3. Open in a new tab/window with `noopener,noreferrer` so the target
 *     page can never reach back into our app via window.opener.
 */
import type { MouseEvent } from 'react';

const EVENT_NAME = 'shuffle:external-link-confirm';

export interface ExternalLinkConfirmDetail {
  url: string;
  host: string;
}

/** Resolve a possibly-relative href against the current document so we can
 *  show a meaningful URL in the confirm dialog. */
const resolveHref = (raw: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (/^(mailto|tel|sms):/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, window.location.href).toString();
  } catch {
    return trimmed;
  }
};

const hostFor = (url: string): string => {
  try {
    const u = new URL(url);
    if (u.protocol === 'mailto:') return url.replace(/^mailto:/i, '');
    if (u.protocol === 'tel:' || u.protocol === 'sms:') return url;
    return u.host || url;
  } catch {
    return url;
  }
};

export const requestExternalLinkConfirm = (url: string) => {
  window.dispatchEvent(
    new CustomEvent<ExternalLinkConfirmDetail>(EVENT_NAME, {
      detail: { url, host: hostFor(url) },
    }),
  );
};

export const onExternalLinkConfirmRequest = (
  handler: (detail: ExternalLinkConfirmDetail) => void,
) => {
  const listener = (e: Event) => handler((e as CustomEvent<ExternalLinkConfirmDetail>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
};

export const openExternalLink = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const confirmExternalLinkClick = (e: MouseEvent<HTMLElement>) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const anchor = target.closest('a') as HTMLAnchorElement | null;
  if (!anchor) return;

  e.preventDefault();
  e.stopPropagation();

  const href = resolveHref(anchor.getAttribute('href'));
  if (!href) return;

  requestExternalLinkConfirm(href);
};
