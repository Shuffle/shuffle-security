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

const DEV_BACKEND = 'https://sociology-lending-divisions-eating.trycloudflare.com';
const PROD_BACKEND = 'https://sociology-lending-divisions-eating.trycloudflare.com';

// Determine if we're in Lovable preview (dev) or published (prod)
export const isDevEnvironment = (): boolean => {
  if (import.meta.env.VITE_SHUFFLE_API_URL) return false;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return hostname.includes('lovableproject.com') || hostname.includes('id-preview--');
};

const getDefaultBaseUrl = (): string => {
  if (import.meta.env.VITE_SHUFFLE_API_URL) {
    return import.meta.env.VITE_SHUFFLE_API_URL;
  }
  return isDevEnvironment() ? DEV_BACKEND : PROD_BACKEND;
};

// Dynamic region URL state (only applies in production, not dev)
let _regionUrl: string | null = null;
let _trackedOrgId: string | null = null;

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

// Get authorization header - uses API key if available, otherwise session token
export const getAuthHeader = (sessionToken?: string | null): Record<string, string> => {
  const token = API_CONFIG.apiKey || sessionToken;
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
};
