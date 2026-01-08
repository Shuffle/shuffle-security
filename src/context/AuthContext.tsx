import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl, API_ENDPOINTS } from '@/config/api';

interface UserInfo {
  username?: string;
  id?: string;
  active_org?: {
    name: string;
    id: string;
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  sessionToken: string | null;
  userInfo: UserInfo | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  refreshUserInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verify authentication on mount and when token changes
  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('session_token');
      setSessionToken(token);
      
      if (!token) {
        setIsAuthenticated(false);
        setUserInfo(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(getApiUrl('/getinfo'), {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok && data.success === true) {
          setIsAuthenticated(true);
          setUserInfo({
            username: data.username,
            id: data.id,
            active_org: data.active_org,
          });
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('session_token');
          setSessionToken(null);
          setIsAuthenticated(false);
          setUserInfo(null);
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
        setIsAuthenticated(false);
        setUserInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const fetchUserInfo = useCallback(async (token: string) => {
    try {
      // Try with Authorization header first, then fall back to cookie-only
      const response = await fetch(getApiUrl('/getinfo'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
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
        });
      } else {
        console.warn('getinfo failed:', data.reason || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to fetch user info:', err);
    }
  }, []);

  const login = useCallback(async (token: string) => {
    localStorage.setItem('session_token', token);
    setSessionToken(token);
    setIsAuthenticated(true);
    await fetchUserInfo(token);
  }, [fetchUserInfo]);

  const refreshUserInfo = useCallback(async () => {
    const token = localStorage.getItem('session_token');
    if (token) {
      await fetchUserInfo(token);
    }
  }, [fetchUserInfo]);

  const logout = useCallback(async () => {
    // Clear local state FIRST to prevent race conditions
    localStorage.removeItem('session_token');
    setSessionToken(null);
    setIsAuthenticated(false);
    setUserInfo(null);
    
    // Then call the Shuffle logout API
    try {
      await fetch(getApiUrl(API_ENDPOINTS.logout), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
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
