import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getApiUrl, getAuthHeader } from '@/config/api';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'shuffle-theme';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') return getSystemTheme();
  return mode;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });
  const [apiChecked, setApiChecked] = useState(false);

  const resolvedTheme = resolveTheme(theme);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(getSystemTheme());
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Check /api/v1/getinfo for theme preference (only once)
  useEffect(() => {
    if (apiChecked) return;
    const checkApiTheme = async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/getinfo'), {
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.success && (data.theme === 'dark' || data.theme === 'light')) {
          // Only apply API theme if user hasn't manually set one
          const saved = localStorage.getItem(THEME_STORAGE_KEY);
          if (!saved) {
            setThemeState(data.theme);
            localStorage.setItem(THEME_STORAGE_KEY, data.theme);
          }
        }
      } catch {
        // Silently fail — use default
      }
      setApiChecked(true);
    };
    checkApiTheme();
  }, [apiChecked]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
