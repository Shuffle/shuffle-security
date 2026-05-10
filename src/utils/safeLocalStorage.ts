/**
 * Global localStorage quota guard.
 *
 * Patches localStorage.setItem so any QuotaExceededError is handled
 * automatically by evicting the largest non-essential keys and retrying,
 * instead of bubbling up as an unhandled runtime error.
 *
 * Install once at app startup (see main.tsx).
 */

const PROTECTED_KEY_PATTERNS: RegExp[] = [
  /^shuffle-/i,         // shuffle-theme, shuffle-org, shuffle-session etc.
  /^supabase\./i,       // supabase auth tokens
  /^sb-/i,              // supabase client storage
  /token/i,
  /auth/i,
  /session-id/i,
  /^user(Info|_)/i,
];

const isQuotaError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number };
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    e.code === 1014
  );
};

const isProtected = (key: string): boolean =>
  PROTECTED_KEY_PATTERNS.some((rx) => rx.test(key));

type SizedKey = { key: string; size: number };

const listKeysBySize = (skipKey: string): SizedKey[] => {
  const out: SizedKey[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || k === skipKey) continue;
    const v = localStorage.getItem(k) ?? "";
    out.push({ key: k, size: k.length + v.length });
  }
  // Largest first; protected keys sorted last so they are evicted only if needed.
  out.sort((a, b) => {
    const ap = isProtected(a.key) ? 1 : 0;
    const bp = isProtected(b.key) ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return b.size - a.size;
  });
  return out;
};

export const installLocalStorageQuotaGuard = (): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  const proto = Object.getPrototypeOf(window.localStorage) as Storage;
  const flag = window as unknown as { __lsQuotaGuardInstalled?: boolean };
  if (flag.__lsQuotaGuardInstalled) return;
  flag.__lsQuotaGuardInstalled = true;

  const originalSetItem = proto.setItem.bind(window.localStorage);

  proto.setItem = function patchedSetItem(key: string, value: string): void {
    try {
      originalSetItem(key, value);
      return;
    } catch (err) {
      if (!isQuotaError(err)) throw err;

      // Evict largest other keys one at a time and retry.
      const candidates = listKeysBySize(key);
      for (const { key: victim } of candidates) {
        try {
          window.localStorage.removeItem(victim);
        } catch {
          /* ignore */
        }
        try {
          originalSetItem(key, value);
          // eslint-disable-next-line no-console
          console.warn(
            `[safeLocalStorage] quota hit while writing "${key}"; evicted "${victim}" to make room.`
          );
          return;
        } catch (retryErr) {
          if (!isQuotaError(retryErr)) throw retryErr;
        }
      }

      // Last resort — silently drop the write rather than crash the app.
      // eslint-disable-next-line no-console
      console.warn(
        `[safeLocalStorage] dropping write to "${key}" (${value.length} chars) — storage full and no evictable keys remain.`
      );
    }
  };
};
