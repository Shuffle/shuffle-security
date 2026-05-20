/**
 * API Configuration
 * 
 * Configure the base URL based on your deployment:
 * - Shuffle Cloud (EU): https://shuffler.io
 * - Shuffle Cloud (US): https://us.shuffler.io  
 * - Self-hosted: Your own backend URL (e.g., https://shuffle.yourdomain.com)
 *
 * The region URL is dynamically resolved from /api/v1/getinfo's `region_url` field.
 * If the user switches orgs, it resets to the default until getinfo is called again.
 */

import { installFetchBreaker, registerProtectedOrigin } from './fetchBreaker';

// Install the global fetch breaker as soon as api.ts is imported. Idempotent —
// safe to call multiple times.
installFetchBreaker();

const DEV_BACKEND = 'https://tunnel.schemaless.org';
const PROD_BACKEND = 'https://shuffler.io';

// Base URL for Shuffle Automation dashboard (used in tool switcher)
export const SHUFFLE_AUTOMATION_URL = 'https://shuffler.io/new-dashboard';

// Known cloud domains that should always use shuffler.io as the default backend
const CLOUD_DOMAINS = ['security.shuffler.io', 'shutdown.no'];

// Safely read Vite-style env vars without depending on `vite/client` types
// (the published library should not require Vite to be installed).
const getEnvVar = (key: string): string | undefined => {
  // Indirect access via `new Function` keeps `import.meta` out of the emitted
  // CJS bundle. tsup otherwise inlines it verbatim into `dist/index.js`, which
  // breaks consumers whose webpack rolls the CJS build into a non-ESM bundle
  // ("Cannot use 'import.meta' outside a module").
  try {
    const meta = (new Function('try { return import.meta } catch { return undefined }')()) as
      | { env?: Record<string, string | undefined> }
      | undefined;
    return meta?.env?.[key];
  } catch {
    return undefined;
  }
};

// Determine if we're in Lovable preview (dev) or published (prod)
export const isDevEnvironment = (): boolean => {
  if (getEnvVar('VITE_SHUFFLE_API_URL')) return false;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return hostname.includes('lovableproject.com') || hostname.includes('id-preview--');
};

/** Check if running on a known Shuffle Cloud domain */
export const isCloudDomain = (): boolean => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return CLOUD_DOMAINS.includes(hostname);
};

/**
 * True when running on Shuffle Cloud (a known *.shuffler.io / shutdown.no domain).
 * Use this to gate cloud-only features like Google Analytics (ReactGA).
 *
 * isCloud()  → cloud deployment, GA allowed, telemetry OK
 * !isCloud() → either Lovable preview (dev) OR self-hosted onprem; do NOT call GA
 */
export const isCloud = (): boolean => isCloudDomain();

/**
 * True when running self-hosted (onprem) — i.e. NOT in Lovable preview AND NOT on a known cloud domain.
 */
export const isOnprem = (): boolean => !isDevEnvironment() && !isCloudDomain();

const getDefaultBaseUrl = (): string => {
  const envUrl = getEnvVar('VITE_SHUFFLE_API_URL');
  if (envUrl) {
    return envUrl;
  }
  if (isDevEnvironment()) return DEV_BACKEND;
  // Cloud domains always default to shuffler.io; region_url from getinfo may override later
  if (isCloudDomain()) return PROD_BACKEND;
  // Self-hosted / on-prem: use current domain (nginx proxies /api/* to backend)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return PROD_BACKEND;
};

// Dynamic region URL state (only applies in production, not dev)
let _regionUrl: string | null = null;
let _trackedOrgId: string | null = null;
// Host-injected base URL (set via setHostBaseUrl from a host that passes
// `globalUrl` through ShuffleHostProps). Highest priority — overrides region
// URL and the auto-detected default. Use this for self-hosted backends.
let _hostBaseUrl: string | null = null;

/** Check if a URL is a valid shuffler.io subdomain */
const isShufflerSubdomain = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.shuffler.io') || parsed.hostname === 'shuffler.io';
  } catch {
    return false;
  }
};

/**
 * Set the dynamic region URL from getinfo response.
 * Only applies if the URL is a shuffler.io subdomain and different from default.
 */
export const setRegionUrl = (regionUrl: string | undefined | null, orgId: string | undefined | null) => {
  // In dev environments, don't override — always use dev backend
  if (isDevEnvironment()) {
    _trackedOrgId = orgId || null;
    return;
  }

  _trackedOrgId = orgId || null;

  if (regionUrl && isShufflerSubdomain(regionUrl)) {
    // Normalize: strip trailing slash
    const normalized = regionUrl.replace(/\/+$/, '');
    if (normalized !== PROD_BACKEND) {
      _regionUrl = normalized;
      console.log(`[API] Region URL set to: ${_regionUrl}`);
      return;
    }
  }

  // No valid region override — use default
  _regionUrl = null;
};

/**
 * Called when org changes. Resets region URL to default until next getinfo.
 */
export const resetRegionUrl = () => {
  if (_regionUrl) {
    console.log(`[API] Region URL reset to default (org changed)`);
  }
  _regionUrl = null;
};

/**
 * Host override — call from a top-level component (or `useSyncHostBaseUrl`)
 * with the `globalUrl` injected via `ShuffleHostProps`. When set, this beats
 * region URL and the env-based default for ALL fetches that go through
 * `getApiUrl()` / `API_CONFIG.baseUrl` / `shuffleFetch`.
 *
 * Pass `null` / `undefined` / empty string to clear the override.
 */
export const setHostBaseUrl = (url: string | undefined | null) => {
  const next = url ? url.replace(/\/+$/, '') : null;
  if (next === _hostBaseUrl) return;
  _hostBaseUrl = next;
  if (next) {
    try { registerProtectedOrigin(next); } catch { /* noop */ }
  }
};

/** Get the currently active host override, if any. */
export const getHostBaseUrl = (): string | null => _hostBaseUrl;

/** Get the currently tracked org ID */
export const getTrackedOrgId = (): string | null => _trackedOrgId;

export const API_CONFIG = {
  // Shuffle backend URL - uses region URL if set, otherwise default
  get baseUrl(): string {
    return _regionUrl || getDefaultBaseUrl();
  },
  
  // API version
  version: 'v1',
  
  // Get API key from localStorage (for local development)
  get apiKey(): string | null {
    return localStorage.getItem('shuffle_api_key');
  },
  
  // Set API key in localStorage
  setApiKey(key: string | null) {
    if (key) {
      localStorage.setItem('shuffle_api_key', key);
    } else {
      localStorage.removeItem('shuffle_api_key');
    }
  },
};

// Computed API endpoint - pass full path including /api/v1 or /api/v2
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseUrl}${endpoint}`;
};

/**
 * Resolve an agent approval / form URL (typically `/forms/{id}`) to the
 * original Shuffle Core where the form actually lives. On Cloud this is
 * always https://shuffler.io (regardless of the active region URL — forms
 * are served from core), and onprem / dev fall back to the configured
 * backend baseUrl. Absolute URLs are returned unchanged.
 */
export const getShuffleCoreFormUrl = (refUrl: string): string => {
  if (!refUrl) return refUrl;
  // Already absolute — trust it.
  if (/^https?:\/\//i.test(refUrl)) return refUrl;
  const path = refUrl.startsWith('/') ? refUrl : `/${refUrl}`;
  // Cloud always points at shuffler.io for forms.
  if (isCloud()) return `https://shuffler.io${path}`;
  // Self-hosted / dev — use the active backend.
  return `${API_CONFIG.baseUrl}${path}`;
};

/** True when a notification.reference_url points at an agent approval form. */
export const isAgentApprovalFormUrl = (refUrl: string | undefined | null): boolean => {
  if (!refUrl) return false;
  try {
    // Strip an optional origin so we can match the path consistently.
    const path = /^https?:\/\//i.test(refUrl) ? new URL(refUrl).pathname : refUrl;
    return /^\/forms\/[^/?#]+/.test(path);
  } catch {
    return false;
  }
};

/**
 * Central fetch wrapper that ALWAYS includes credentials and auth headers.
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

// Common endpoints
export const API_ENDPOINTS = {
  login: '/login',
  logout: '/logout',
  me: '/me',
  getinfo: '/getinfo',
  alerts: '/alerts',
  cases: '/cases',
  workflows: '/workflows',
  apps: '/apps',
};

// Get authorization header - uses API key if available, otherwise session token.
// Always scopes the request to the currently-active org via Org-Id when known,
// so a user in a sub-org reads/writes against that sub-org rather than their
// default home org. Pass `overrideOrgId` to force a different org (e.g. when
// reading data from another tenant in a multi-tenant view).
export const getAuthHeader = (overrideOrgId?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {};

  // Only send Authorization header for API key auth.
  // Session-based (cookie) auth is handled by credentials: 'include' — never both.
  const apiKey = API_CONFIG.apiKey;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Scope to the active org. Explicit override beats the tracked org.
  const orgId = overrideOrgId ?? _trackedOrgId;
  if (orgId) {
    headers['Org-Id'] = orgId;
  }

  return headers;
};

