/**
 * API Configuration
 * 
 * Configure the base URL based on your deployment:
 * - Shuffle Cloud (EU): https://shuffler.io
 * - Shuffle Cloud (US): https://us.shuffler.io  
 * - Self-hosted: Your own backend URL (e.g., https://shuffle.yourdomain.com)
 */

export const API_CONFIG = {
  // Shuffle backend URL - can be overridden via environment variable
  baseUrl: import.meta.env.VITE_SHUFFLE_API_URL || 'https://shuffler.io',
  
  // Singul backend URL - can be overridden via environment variable
  singulBaseUrl: import.meta.env.VITE_SINGUL_API_URL || 'https://e12e28fa94e6.ngrok-free.app',
  
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
