import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl, API_CONFIG, getAuthHeader } from '@/config/api';

interface Organization {
  name: string;
  id: string;
  image?: string;
}

interface UserInfo {
  username?: string;
  id?: string;
  active_org?: Organization;
  orgs?: Organization[];
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserInfo = useCallback(async (token?: string | null) => {
    try {
      const response = await fetch(getApiUrl('/getinfo'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...getAuthHeader(token),
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('getinfo response:', response.status, data);

      if (response.ok && data.success === true) {
        setUserInfo({
          username: data.username,
          id: data.id,
          active_org: data.active_org,
          orgs: data.orgs || [],
        });
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
  useEffect(() => {
    const verifyAuth = async () => {
      console.log('AuthContext: verifyAuth running on mount');
      const token = localStorage.getItem('session_token');
      setSessionToken(token);
      
      // If we have an API key, use that for auth verification
      if (API_CONFIG.apiKey) {
        console.log('AuthContext: Using API key for authentication');
        const success = await fetchUserInfo(token);
        if (success) {
          setIsAuthenticated(true);
        }
        setIsLoading(false);
        return;
      }
      
      // Otherwise, require a session token
      if (!token) {
        console.log('AuthContext: No token found, not authenticated');
        setIsAuthenticated(false);
        setUserInfo(null);
        setIsLoading(false);
        return;
      }

      console.log('AuthContext: Verifying session token');
      const success = await fetchUserInfo(token);
      if (success) {
        setIsAuthenticated(true);
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('session_token');
        setSessionToken(null);
        setIsAuthenticated(false);
        setUserInfo(null);
      }
      setIsLoading(false);
    };

    verifyAuth();
  }, [fetchUserInfo]);

  const login = useCallback(async (token: string) => {
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
      const token = localStorage.getItem('session_token');
      const response = await fetch(getApiUrl('/orgs/' + orgId + '/change'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(token),
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Refresh user info to get updated active_org
        await fetchUserInfo(token);
      }
    } catch (err) {
      console.error('Failed to change org:', err);
    }
  }, [fetchUserInfo]);

  const logout = useCallback(async () => {
    // Clear local state FIRST to prevent race conditions
    const currentToken = sessionToken;
    localStorage.removeItem('session_token');
    API_CONFIG.setApiKey(null);
    setSessionToken(null);
    setIsAuthenticated(false);
    setUserInfo(null);
    
    // Then call the Shuffle logout API
    try {
      await fetch(getApiUrl('/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(currentToken),
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
