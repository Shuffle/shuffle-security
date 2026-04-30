import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl, API_CONFIG, getAuthHeader, setRegionUrl, resetRegionUrl, getTrackedOrgId } from '@/config/api';

interface Organization {
  name: string;
  id: string;
  image?: string;
  region_url?: string;
  creator_org?: string;
  /** Role of the current user within this org (e.g. "admin", "user"). From /api/v1/getinfo => active_org.role */
  role?: string;
}

interface UserInfo {
  username?: string;
  id?: string;
  active_org?: Organization;
  orgs?: Organization[];
  support?: boolean;
  app_execution_limit?: number;
  app_execution_usage?: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  sessionToken: string | null;
  userInfo: UserInfo | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  refreshUserInfo: () => Promise<void>;
  setActiveOrg: (orgId: string) => Promise<void>;
  orgMismatchWarning: boolean;
  dismissOrgMismatch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orgMismatchWarning, setOrgMismatchWarning] = useState(false);

  const dismissOrgMismatch = useCallback(() => {
    setOrgMismatchWarning(false);
  }, []);

  const fetchUserInfo = useCallback(async (token?: string | null) => {
    try {
      const response = await fetch(getApiUrl('/api/v1/getinfo'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('getinfo response:', response.status, data);

      if (response.ok && data.success === true) {
        // Update region URL based on getinfo response
        const newOrgId = data.active_org?.id || null;
        const previousOrgId = getTrackedOrgId();

        // If org changed, reset region URL first so subsequent calls use default
        if (previousOrgId && newOrgId && previousOrgId !== newOrgId) {
          resetRegionUrl();
        }

        // Set region URL from response (will validate it's a shuffler.io subdomain)
        setRegionUrl(data.region_url, newOrgId);

        const info = {
          username: data.username,
          id: data.id,
          active_org: data.active_org,
          orgs: data.orgs || [],
          support: data.support === true,
          app_execution_limit: data.app_execution_limit,
          app_execution_usage: data.app_execution_usage,
        };
        setUserInfo(info);
        // Store in localStorage so datastore service can access org ID
        localStorage.setItem('shuffle_user_info', JSON.stringify(info));
        // Broadcast the raw getinfo payload so other contexts (e.g. ThemeContext)
        // can read fields like `theme` without firing their own duplicate request.
        try {
          window.dispatchEvent(new CustomEvent('shuffle:getinfo', { detail: data }));
        } catch { /* ignore */ }
        return true;
      } else {
        console.warn('getinfo failed:', data.reason || 'Unknown error');
        return false;
      }
    } catch (err) {
      console.error('Failed to fetch user info:', err);
      return false;
    }
  }, []);

  // Verify authentication on mount (runs once when app loads)
  // Always calls getinfo — cookies (credentials: 'include') may authenticate
  // even without a localStorage session token.
  useEffect(() => {
    const verifyAuth = async () => {
      console.log('AuthContext: verifyAuth running on mount');
      const token = localStorage.getItem('session_token');
      setSessionToken(token);

      // Always attempt getinfo — works with API key, session token, OR cookie
      const success = await fetchUserInfo(token);
      if (success) {
        setIsAuthenticated(true);
      } else {
        // Clear stale token if present
        if (token) {
          localStorage.removeItem('session_token');
          setSessionToken(null);
        }
        setIsAuthenticated(false);
        setUserInfo(null);
      }
      setIsLoading(false);
    };

    verifyAuth();
  }, [fetchUserInfo]);

  // Re-check org on tab focus to detect out-of-band org switches
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch(getApiUrl('/api/v1/getinfo'), {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok && data.success === true) {
          const remoteOrgId = data.active_org?.id;
          const localOrgId = userInfo?.active_org?.id;
          if (remoteOrgId && localOrgId && remoteOrgId !== localOrgId) {
            console.warn(`[Auth] Org mismatch detected: local=${localOrgId}, remote=${remoteOrgId}`);
            setOrgMismatchWarning(true);
          }
        }
      } catch (err) {
        console.error('[Auth] Visibility getinfo check failed:', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, userInfo?.active_org?.id]);

  const login = useCallback(async (token: string) => {
    // Clear any existing API key — session login and API key auth are mutually exclusive
    API_CONFIG.setApiKey(null);
    localStorage.setItem('session_token', token);
    setSessionToken(token);
    setIsAuthenticated(true);
    await fetchUserInfo(token);
  }, [fetchUserInfo]);

  const refreshUserInfo = useCallback(async () => {
    const token = localStorage.getItem('session_token');
    await fetchUserInfo(token);
  }, [fetchUserInfo]);

  const setActiveOrg = useCallback(async (orgId: string) => {
    try {
      // Reset region URL and theme immediately — the new org may have different settings
      resetRegionUrl();
      localStorage.removeItem('shuffle-theme');

      const response = await fetch(getApiUrl('/api/v1/orgs/' + orgId + '/change'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ org_id: orgId }),
      });

      if (!response.ok) {
        console.warn('Org change API returned non-OK:', response.status);
      }

      // Always call getinfo after org change to resolve the new region_url
      // and update userInfo before reloading
      await fetchUserInfo();

      // Reload so all components refetch for the new org
      window.location.reload();
    } catch (err) {
      console.error('Failed to change org:', err);
      // Still reload on error to ensure a clean state
      window.location.reload();
    }
  }, [fetchUserInfo]);

  const logout = useCallback(async () => {
    // Clear local state FIRST to prevent race conditions
    const currentToken = sessionToken;
    localStorage.removeItem('session_token');
    localStorage.removeItem('shuffle_user_info');
    API_CONFIG.setApiKey(null);
    resetRegionUrl();
    setSessionToken(null);
    setIsAuthenticated(false);
    setUserInfo(null);
    
    // Then call the Shuffle logout API
    try {
      await fetch(getApiUrl('/api/v1/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.error('Logout API call failed:', err);
    }
  }, [sessionToken]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        sessionToken,
        userInfo,
        login,
        logout,
        isLoading,
        refreshUserInfo,
        setActiveOrg,
        orgMismatchWarning,
        dismissOrgMismatch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
