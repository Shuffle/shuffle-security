import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  brandColor: string | null;
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

const hexToHSL = (hex: string): string => {
  try {
    hex = hex.replace(/^#/, '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch {
    return '24 100% 50%';
  }
};

const updateCSSVariables = (brandColor: string | null) => {
  const color = brandColor || '#FF6600';
  const hsl = hexToHSL(color);
  
  document.documentElement.style.setProperty('--primary', hsl);
  document.documentElement.style.setProperty('--ring', hsl);
  document.documentElement.style.setProperty('--accent', hsl);
  document.documentElement.style.setProperty('--sidebar-primary', hsl);
  document.documentElement.style.setProperty('--sidebar-ring', hsl);
  document.documentElement.style.setProperty('--status-open', hsl);
  
  const [h, s, l] = hsl.split(/\s+/);
  const lightness = parseInt(l);
  const glowLightness = Math.min(lightness + 10, 100);
  document.documentElement.style.setProperty('--primary-glow', `${h} ${s} ${glowLightness}%`);
  
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [apiChecked, setApiChecked] = useState(false);

  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    updateCSSVariables(brandColor);
  }, [brandColor]);
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

  // Theme preference is sourced from the same `/api/v1/getinfo` request that
  // AuthContext already fires on mount. Listening for the broadcast event it
  // dispatches avoids a second duplicate request to the same endpoint.
  useEffect(() => {
    if (apiChecked) return;
    const onGetInfo = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data && data.success) {
        const orgBrandColor = data.active_org?.branding?.brand_color;
        if (orgBrandColor) {
          setBrandColor(orgBrandColor);
        } else {
          setBrandColor(null);
        }
        
        const brandingTheme = data.active_org?.branding?.theme;
        let themeToSet: ThemeMode | null = null;
        
        if (brandingTheme && (brandingTheme === 'light' || brandingTheme === 'dark')) {
          themeToSet = brandingTheme !== 'dark' ? brandingTheme : 'dark';
        } else if (data.theme === 'dark' || data.theme === 'light') {
          themeToSet = data.theme;
        } else {
          themeToSet = 'dark';
        }
        
        if (themeToSet) {
          setThemeState(themeToSet);
          localStorage.setItem(THEME_STORAGE_KEY, themeToSet);
        }
      }
      setApiChecked(true);
    };
    window.addEventListener('shuffle:getinfo', onGetInfo as EventListener);
    return () => window.removeEventListener('shuffle:getinfo', onGetInfo as EventListener);
  }, [apiChecked]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, brandColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
