/**
 * Bare React context object for Demo Mode.
 *
 * Lives in its own module (no React components, no JSX) so Vite's Fast
 * Refresh treats it as a stable import. This avoids an intermittent
 * "useDemo must be used within DemoProvider" crash that happened during
 * navigation in dev: when DemoContext.tsx was hot-reloaded, the context
 * object identity could desync between the still-mounted Provider and the
 * freshly-evaluated consumer modules. Keeping the createContext() call
 * in this tiny module means HMR almost never re-runs it.
 */
import { createContext, useContext } from 'react';
import type { DemoContextValue } from './demoContextTypes';

export const DemoContext = createContext<DemoContextValue | null>(null);

export const useDemo = (): DemoContextValue => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
};
