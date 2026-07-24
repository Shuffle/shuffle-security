/**
 * Shuffle-Core API helpers — STANDALONE copy.
 *
 * ⚠️ KEEP IN SYNC with `src/Shuffle-MCPs/api.ts`.
 *
 * Shuffle-Core ships as `@shuffleio/shuffle-core` and cannot depend on
 * `@shuffleio/shuffle-mcps`. The two libraries intentionally duplicate this
 * file so each one can be consumed in isolation. When you change one, mirror
 * the change in the other. A future refactor may extract a shared
 * `@shuffleio/shuffle-api` package — until then, this duplication is the
 * source of truth for "Shuffle Core does not depend on Shuffle-MCPs".
 */

import { installFetchBreaker, registerProtectedOrigin } from './fetchBreaker';

// Install the global fetch breaker as soon as api.ts is imported. Idempotent.
installFetchBreaker();

const DEV_BACKEND = 'https://tunnel.schemaless.org';
const PROD_BACKEND = 'https://shuffler.io';

const CLOUD_DOMAINS = ['security.shuffler.io', 'shutdown.no'];

const getEnvVar = (key: string): string | undefined => {
  // Dynamic property access avoids tsup's static inlining of import.meta.env.*
  // while still working in Vite's dev server and build output.
  try {
    return (import.meta as any).env?.[key];
  } catch {
    return undefined;
  }
};

export const isDevEnvironment = (): boolean => {
  if (getEnvVar('VITE_SHUFFLE_API_URL')) return false;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return hostname.includes('lovableproject.com') || hostname.includes('id-preview--');
};

export const isCloudDomain = (): boolean => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return CLOUD_DOMAINS.includes(hostname);
};

const getDefaultBaseUrl = (): string => {
  const envUrl = getEnvVar('VITE_SHUFFLE_API_URL');
  if (envUrl) return envUrl;
  if (isDevEnvironment()) return DEV_BACKEND;
  if (isCloudDomain()) return PROD_BACKEND;
  if (typeof window !== 'undefined') return window.location.origin;
  return PROD_BACKEND;
};

let _regionUrl: string | null = null;
let _trackedOrgId: string | null = null;
// Host-injected base URL (highest priority — set via setHostBaseUrl).
let _hostBaseUrl: string | null = null;

const isShufflerSubdomain = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.shuffler.io') || parsed.hostname === 'shuffler.io';
  } catch {
    return false;
  }
};

export const setRegionUrl = (regionUrl: string | undefined | null, orgId: string | undefined | null) => {
  if (isDevEnvironment()) { _trackedOrgId = orgId || null; return; }
  _trackedOrgId = orgId || null;
  if (regionUrl && isShufflerSubdomain(regionUrl)) {
    const normalized = regionUrl.replace(/\/+$/, '');
    if (normalized !== PROD_BACKEND) { _regionUrl = normalized; return; }
  }
  _regionUrl = null;
};

export const resetRegionUrl = () => { _regionUrl = null; };
export const getTrackedOrgId = (): string | null => _trackedOrgId;

/**
 * Host override — call from a top-level Shuffle-Core component (or via
 * `useSyncHostBaseUrl`) with `globalUrl` from `ShuffleHostProps`. Beats region
 * URL and default for ALL fetches that go through `getApiUrl()`.
 */
const SHUFFLE_HOST_BASE_URL_EVENT = 'shuffle:set-host-base-url';

export const setHostBaseUrl = (url: string | undefined | null) => {
  const next = url ? url.replace(/\/+$/, '') : null;
  if (next === _hostBaseUrl) return;
  _hostBaseUrl = next;
  if (next) {
    try { registerProtectedOrigin(next); } catch { /* noop */ }
  }
  // Cross-broadcast so sibling Shuffle packages (e.g. Shuffle-MCPs) that hold
  // their own copy of api.ts pick up the same host override. Guarded by the
  // `next === _hostBaseUrl` early-return above so the loop terminates.
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(SHUFFLE_HOST_BASE_URL_EVENT, { detail: next }));
    } catch { /* noop */ }
  }
};

if (typeof window !== 'undefined') {
  try {
    window.addEventListener(SHUFFLE_HOST_BASE_URL_EVENT, (e: Event) => {
      const detail = (e as CustomEvent).detail as string | null | undefined;
      setHostBaseUrl(detail ?? null);
    });
  } catch { /* noop */ }
}

export const getHostBaseUrl = (): string | null => _hostBaseUrl;


export const API_CONFIG = {
  get baseUrl(): string {
    const url = _hostBaseUrl || _regionUrl || getDefaultBaseUrl();
    try { registerProtectedOrigin(url); } catch { /* noop */ }
    return url;
  },
  version: 'v1',
  get apiKey(): string | null {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem('shuffle_api_key') : null; } catch { return null; }
  },
  setApiKey(key: string | null) {
    try {
      if (key) localStorage.setItem('shuffle_api_key', key);
      else localStorage.removeItem('shuffle_api_key');
    } catch { /* ignore */ }
  },
};

export const getApiUrl = (endpoint: string): string => `${API_CONFIG.baseUrl}${endpoint}`;

export const getAuthHeader = (overrideOrgId?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {};
  const apiKey = API_CONFIG.apiKey;
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const orgId = overrideOrgId ?? _trackedOrgId;
  if (orgId) headers['Org-Id'] = orgId;
  return headers;
};

/**
 * Central fetch wrapper that ALWAYS includes credentials + auth headers.
 * Use this instead of raw fetch() for all Shuffle API calls.
 */
export const shuffleFetch = (url: string, init?: RequestInit): Promise<Response> => {
  const { headers: extraHeaders, ...rest } = init || {};
  return fetch(url, {
    credentials: 'include',
    ...rest,
    headers: {
      ...getAuthHeader(),
      ...extraHeaders,
    },
  });
};
