/**
 * Shuffle-Core — standalone React surfaces extracted from the Shuffle
 * Security host app.
 *
 * Layout:
 *   views/        Page-level surfaces (FormInput, Usecases, UsecaseAlluvialDiagram)
 *   components/   Reusable building blocks (EditWorkflow, RecentWorkflow, stubs)
 *   api.ts        Standalone API helpers — KEEP IN SYNC with src/Shuffle-MCPs/api.ts
 *
 * Every exported view/component is wrapped in `ShuffleCoreThemeProvider` so MUI
 * `<TextField>` / `<Button>` / `<Select>` etc. default to `size="small"` —
 * matching the rest of Shuffle Security (36px buttons, ~38px text fields).
 * This is the single source of truth for sizing; do NOT thread `size="small"`
 * through individual call sites.
 */

import './shuffle-core.css';
import React from 'react';
import { ShuffleCoreThemeProvider, type ShuffleColorMode } from './components/ShuffleCoreThemeProvider';
import { QueryClient, QueryClientProvider, QueryClientContext } from '@tanstack/react-query';

import UsecasesRaw from './views/Usecases';
import UsecaseAlluvialDiagramRaw from './views/UsecaseAlluvialDiagram';
import FormInputRaw from './views/FormInput';
import EditWorkflowRaw from './components/EditWorkflow';
import RecentWorkflowRaw from './components/RecentWorkflow';
import AutomationDashboardRaw from './components/dashboard/AutomationDashboard';
import DashboardOverviewRaw from './components/dashboard/DashboardOverview';

/**
 * Wrap a Shuffle-Core surface in the theme provider. Every exported
 * component accepts an optional `theme` prop:
 *   - `"light"` / `"dark"` — pin the subtree to that scheme
 *   - `"system"` (default) — follow the host page's `.dark` class on `<html>`
 *
 * `colorMode` is kept as a legacy alias (`"auto"` == `"system"`). We avoid
 * the name `mode` so we don't collide with component-specific props
 * (e.g. AutomationDashboard's `mode: 'apps' | 'workflows'`).
 */
export type ShuffleTheme = 'light' | 'dark' | 'system';
type WithTheme<P> = P & { theme?: ShuffleTheme; colorMode?: ShuffleColorMode };

const resolveMode = (theme?: ShuffleTheme, colorMode?: ShuffleColorMode): ShuffleColorMode => {
  if (theme === 'light' || theme === 'dark') return theme;
  if (theme === 'system') return 'auto';
  return colorMode ?? 'auto';
};

/**
 * Lazily-created fallback QueryClient. Shuffle-Core hooks use
 * @tanstack/react-query, so standalone consumers (host apps that don't ship
 * their own QueryClientProvider) need one provided by the library itself.
 * We create exactly one and reuse it across all wrapped surfaces.
 */
let fallbackQueryClient: QueryClient | null = null;
const getFallbackQueryClient = (): QueryClient => {
  if (!fallbackQueryClient) {
    fallbackQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
    });
  }
  return fallbackQueryClient;
};

const EnsureQueryClient: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // If a host QueryClientProvider already exists, reuse it; otherwise install
  // our own fallback so hooks like useQuery don't blow up.
  const hostClient = React.useContext(QueryClientContext);
  if (hostClient) return <>{children}</>;
  return <QueryClientProvider client={getFallbackQueryClient()}>{children}</QueryClientProvider>;
};

const withTheme = <P extends object>(Inner: React.ComponentType<P>, displayName: string) => {
  const Wrapped: React.FC<WithTheme<P>> = ({ theme, colorMode, ...rest }) => (
    <EnsureQueryClient>
      <ShuffleCoreThemeProvider mode={resolveMode(theme, colorMode)}>
        <Inner {...(rest as P)} />
      </ShuffleCoreThemeProvider>
    </EnsureQueryClient>
  );
  Wrapped.displayName = `ShuffleCore(${displayName})`;
  return Wrapped;
};

export const Usecases = withTheme(UsecasesRaw, 'Usecases');
export const UsecaseAlluvialDiagram = withTheme(UsecaseAlluvialDiagramRaw, 'UsecaseAlluvialDiagram');
export const FormInput = withTheme(FormInputRaw, 'FormInput');
export const EditWorkflow = withTheme(EditWorkflowRaw, 'EditWorkflow');
export const RecentWorkflow = withTheme(RecentWorkflowRaw, 'RecentWorkflow');
export const AutomationDashboard = withTheme(AutomationDashboardRaw, 'AutomationDashboard');
export const DashboardOverview = withTheme(DashboardOverviewRaw, 'DashboardOverview');
export type { AutomationDashboardProps } from './components/dashboard/AutomationDashboard';
export { AUTOMATION_RANGE_OPTIONS } from './components/dashboard/AutomationDashboard';
export type { ShuffleCoreHostProps } from './types/host-props';

export default Usecases;

export { ShuffleCoreThemeProvider };
export type { ShuffleColorMode };
export { usePageMeta } from './usePageMeta';
export { toast, setToastImpl } from './toast';
export { API_CONFIG, getApiUrl, getAuthHeader, shuffleFetch, setRegionUrl, resetRegionUrl, setHostBaseUrl, getHostBaseUrl } from './api';
export { useSyncHostBaseUrl } from './useSyncHostBaseUrl';
export { installFetchBreaker, registerProtectedOrigin } from './fetchBreaker';

// Onboarding flow — shared between Shuffle Core and Shuffle Security.
import { OnboardingFlow as OnboardingFlowRaw, ProductChoiceStep as ProductChoiceStepRaw } from './onboarding';
export const OnboardingFlow = withTheme(OnboardingFlowRaw, 'OnboardingFlow');
export const ProductChoiceStep = withTheme(ProductChoiceStepRaw, 'ProductChoiceStep');
export type { OnboardingFlowProps, OnboardingProduct } from './onboarding';
