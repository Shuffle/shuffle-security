/**
 * Build/parse the URL segment used to identify a host monitor in routes like
 *   /monitors/:id
 *   /monitors/:hostUuid/terminal
 *
 * We intentionally avoid using the host's `uuid` in URLs because the agent's
 * uuid changes whenever the user re-installs / restarts the host monitor.
 * Instead we encode the host as `${hostname}:${arch}` (e.g. `DAVID:windows`).
 *
 * Resolvers should match the parsed `hostname` against the host list. The
 * `arch` is only a hint to disambiguate when two hosts share a hostname.
 *
 * Backwards-compat: a raw uuid still works as the URL segment — resolvers
 * fall back to uuid matching when the segment doesn't look like a hostname
 * we recognise.
 */

export const hostUrlSegment = (host: { hostname?: unknown; arch?: unknown; uuid?: unknown } | null | undefined): string => {
  const hostname = String((host as { hostname?: unknown })?.hostname || '').trim();
  if (!hostname) {
    // Last-resort fallback: still better than a broken link.
    return String((host as { uuid?: unknown })?.uuid || '').trim();
  }
  const arch = String((host as { arch?: unknown })?.arch || '').trim();
  return arch ? `${hostname}:${arch}` : hostname;
};

export interface ParsedHostSegment {
  /** The original (decoded) segment as supplied. */
  raw: string;
  /** Hostname portion (everything before the LAST `:`), trimmed. */
  hostname: string;
  /** Arch portion (everything after the LAST `:`), trimmed lower-case. May be ''. */
  arch: string;
}

export const parseHostUrlSegment = (segment: string | null | undefined): ParsedHostSegment => {
  const raw = (() => {
    try { return decodeURIComponent(segment || ''); } catch { return String(segment || ''); }
  })().trim();
  const idx = raw.lastIndexOf(':');
  if (idx < 0) return { raw, hostname: raw, arch: '' };
  return {
    raw,
    hostname: raw.slice(0, idx).trim(),
    arch: raw.slice(idx + 1).trim().toLowerCase(),
  };
};
