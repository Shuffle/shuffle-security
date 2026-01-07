import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  sessionToken: string | null;
  login: (token: string) => void;
  logout: () => void;
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

  const logout = () => {
    localStorage.removeItem('session_token');
    setSessionToken(null);
  };

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
