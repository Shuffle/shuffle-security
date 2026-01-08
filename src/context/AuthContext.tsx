import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl, API_ENDPOINTS } from '@/config/api';

interface AuthContextType {
  isAuthenticated: boolean;
  sessionToken: string | null;
  login: (token: string) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    setSessionToken(token);
    setIsLoading(false);
  }, []);

  const login = (token: string) => {
    localStorage.setItem('session_token', token);
    setSessionToken(token);
  };

  const logout = useCallback(async () => {
    // Clear local state FIRST to prevent race conditions
    localStorage.removeItem('session_token');
    setSessionToken(null);
    
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
        isAuthenticated: !!sessionToken,
        sessionToken,
        login,
        logout,
        isLoading,
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
