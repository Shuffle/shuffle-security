/**
 * API Configuration
 * 
 * Configure the base URL based on your deployment:
 * - Shuffle Cloud (EU): https://shuffler.io
 * - Shuffle Cloud (US): https://us.shuffler.io  
 * - Self-hosted: Your own backend URL (e.g., https://shuffle.yourdomain.com)
 */

const DEV_BACKEND = 'https://fish-patent-porcelain-leaving.trycloudflare.com';
const PROD_BACKEND = 'https://shuffler.io';

// Determine if we're in Lovable preview (dev) or published (prod)
const getBaseUrl = (): string => {
  if (import.meta.env.VITE_SHUFFLE_API_URL) {
    return import.meta.env.VITE_SHUFFLE_API_URL;
  }
  // lovableproject.com = editor preview, id-preview--*.lovable.app = standalone preview
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLovableDev = hostname.includes('lovableproject.com') || hostname.includes('id-preview--');
  return isLovableDev ? DEV_BACKEND : PROD_BACKEND;
};

export const API_CONFIG = {
  // Shuffle backend URL - uses dev backend in Lovable preview, prod otherwise
  get baseUrl(): string {
    return getBaseUrl();
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
