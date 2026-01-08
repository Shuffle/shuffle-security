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
  
  // API key for local development (optional - uses session token if not set)
  apiKey: import.meta.env.VITE_SHUFFLE_API_KEY || null,
  
  // API version
  version: 'v1',
};

// Computed API endpoint
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseUrl}/api/${API_CONFIG.version}${endpoint}`;
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
