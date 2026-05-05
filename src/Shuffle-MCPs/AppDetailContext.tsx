import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AppDetailContextType {
  openApp: (appName: string) => void;
  closeApp: () => void;
  currentAppName: string | null;
  isOpen: boolean;
}

const AppDetailContext = createContext<AppDetailContextType | undefined>(undefined);

export const AppDetailProvider = ({ children }: { children: ReactNode }) => {
  const [currentAppName, setCurrentAppName] = useState<string | null>(null);

  const openApp = useCallback((appName: string) => {
    setCurrentAppName(appName);
  }, []);

  const closeApp = useCallback(() => {
    setCurrentAppName(null);
  }, []);

  return (
    <AppDetailContext.Provider value={{ openApp, closeApp, currentAppName, isOpen: currentAppName !== null }}>
      {children}
    </AppDetailContext.Provider>
  );
};

export const useAppDetail = () => {
  const context = useContext(AppDetailContext);
  if (!context) {
    throw new Error('useAppDetail must be used within an AppDetailProvider');
  }
  return context;
};

/** Safe variant: returns null if no provider is mounted. Useful for components used both inside and outside the dashboard. */
export const useAppDetailOptional = () => {
  return useContext(AppDetailContext) ?? null;
};
