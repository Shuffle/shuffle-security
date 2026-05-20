/**
 * Global fetch circuit breaker.
 *
 * Installs a one-time wrapper around `window.fetch` that protects the Shuffle
 * backend from infinite-loop spam. If the same endpoint (method + URL pathname,
 * scoped to a Shuffle backend origin) fails repeatedly inside a short window,
 * subsequent calls fail-fast with a synthetic 503 for a cooldown period.
 *
 * This is a safety net — components and hooks should still throttle / cache
 * their own requests. The breaker only kicks in when something has gone wrong
 * (a useEffect missing deps, a render loop, an unreachable backend).
 *
 * Both Shuffle-Core and Shuffle-MCPs install this — it is idempotent so the
 * first call wins and the second is a no-op.
 */

const FAIL_THRESHOLD = 12;     // failures inside the rolling window
const ROLLING_WINDOW_MS = 5_000;
const COOLDOWN_MS = 30_000;
const HARD_BURST_THRESHOLD = 30; // any 30 calls (success or fail) in 1s ⇒ trip
const HARD_BURST_WINDOW_MS = 1_000;

interface EndpointState {
  failures: number[];      // recent failure timestamps
  attempts: number[];      // recent attempt timestamps (for burst detection)
  blockedUntil: number;    // 0 when not blocked
  warned: boolean;
}

const state = new Map<string, EndpointState>();
let installed = false;
let allowedOrigins: Set<string> = new Set();

const getEntry = (key: string): EndpointState => {
  let entry = state.get(key);
  if (!entry) {
    entry = { failures: [], attempts: [], blockedUntil: 0, warned: false };
    state.set(key, entry);
  }
  return entry;
};

const prune = (arr: number[], now: number, windowMs: number) => {
  const cutoff = now - windowMs;
  while (arr.length && arr[0] < cutoff) arr.shift();
};

const keyFor = (input: RequestInfo | URL, init?: RequestInit): string | null => {
  let urlStr: string;
  let method = (init?.method || (typeof input !== 'string' && 'method' in (input as any) ? (input as Request).method : 'GET') || 'GET').toUpperCase();
  if (typeof input === 'string') urlStr = input;
  else if (input instanceof URL) urlStr = input.toString();
  else if (input && typeof (input as any).url === 'string') urlStr = (input as any).url;
  else return null;

  try {
    const u = new URL(urlStr, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    if (allowedOrigins.size && !allowedOrigins.has(u.origin)) return null;
    // Only guard /api/* requests — never throttle static assets.
    if (!u.pathname.startsWith('/api/')) return null;
    return `${method} ${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
};

const synthetic503 = (key: string, retryInMs: number): Response =>
  new Response(
    JSON.stringify({
      error: 'circuit_breaker_open',
      message: `Too many failures for ${key}. Cooling down for ${Math.ceil(retryInMs / 1000)}s.`,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable (circuit breaker)',
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(retryInMs / 1000)) },
    },
  );

/** Register a backend origin as one we should guard. Idempotent. */
export const registerProtectedOrigin = (url: string | undefined | null) => {
  if (!url) return;
  try {
    const origin = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost').origin;
    allowedOrigins.add(origin);
  } catch { /* ignore */ }
};

/** Manually force the breaker open for a key — used by negative-cached helpers. */
export const tripBreaker = (urlOrKey: string, cooldownMs = COOLDOWN_MS) => {
  const entry = getEntry(urlOrKey);
  entry.blockedUntil = Date.now() + cooldownMs;
};

export const installFetchBreaker = () => {
  if (installed) return;
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const key = keyFor(input, init);
    if (!key) return original(input, init);

    const entry = getEntry(key);
    const now = Date.now();

    if (entry.blockedUntil > now) {
      return synthetic503(key, entry.blockedUntil - now);
    }

    // Burst detection — protects against pure render-loop spam regardless of
    // success/failure.
    entry.attempts.push(now);
    prune(entry.attempts, now, HARD_BURST_WINDOW_MS);
    if (entry.attempts.length > HARD_BURST_THRESHOLD) {
      entry.blockedUntil = now + COOLDOWN_MS;
      if (!entry.warned) {
        entry.warned = true;
        // eslint-disable-next-line no-console
        console.error(
          `[fetchBreaker] Burst detected on ${key} (${entry.attempts.length} calls / ${HARD_BURST_WINDOW_MS}ms). ` +
            `Blocking for ${COOLDOWN_MS / 1000}s. Fix the caller — this is almost always a missing useEffect dep or a render loop.`,
        );
      }
      return synthetic503(key, COOLDOWN_MS);
    }

    let response: Response;
    try {
      response = await original(input, init);
    } catch (err) {
      const ts = Date.now();
      entry.failures.push(ts);
      prune(entry.failures, ts, ROLLING_WINDOW_MS);
      if (entry.failures.length >= FAIL_THRESHOLD) {
        entry.blockedUntil = ts + COOLDOWN_MS;
        if (!entry.warned) {
          entry.warned = true;
          // eslint-disable-next-line no-console
          console.error(
            `[fetchBreaker] ${entry.failures.length} network errors on ${key} in ${ROLLING_WINDOW_MS / 1000}s. ` +
              `Blocking for ${COOLDOWN_MS / 1000}s.`,
          );
        }
      }
      throw err;
    }

    if (response.status >= 500 || response.status === 0) {
      const ts = Date.now();
      entry.failures.push(ts);
      prune(entry.failures, ts, ROLLING_WINDOW_MS);
      if (entry.failures.length >= FAIL_THRESHOLD) {
        entry.blockedUntil = ts + COOLDOWN_MS;
        if (!entry.warned) {
          entry.warned = true;
          // eslint-disable-next-line no-console
          console.error(
            `[fetchBreaker] ${entry.failures.length} ${response.status}s on ${key} in ${ROLLING_WINDOW_MS / 1000}s. ` +
              `Blocking for ${COOLDOWN_MS / 1000}s.`,
          );
        }
      }
    } else if (response.status < 400) {
      // success ⇒ reset failure window for this endpoint
      entry.failures.length = 0;
      entry.warned = false;
    }
    return response;
  }) as typeof window.fetch;
};

/** Test-only / advanced: clear all breaker state. */
export const _resetFetchBreakerForTests = () => {
  state.clear();
  installed = false;
  allowedOrigins = new Set();
};
