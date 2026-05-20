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

import UsecasesRaw from './views/Usecases';
import UsecaseAlluvialDiagramRaw from './views/UsecaseAlluvialDiagram';
import FormInputRaw from './views/FormInput';
import EditWorkflowRaw from './components/EditWorkflow';
import RecentWorkflowRaw from './components/RecentWorkflow';
import AutomationDashboardRaw from './components/dashboard/AutomationDashboard';
import DashboardOverviewRaw from './components/dashboard/DashboardOverview';

/**
 * Wrap a Shuffle-Core surface in the theme provider and forward an optional
 * `mode` prop ('light' | 'dark' | 'auto'). When `mode` is omitted the surface
 * inherits the host page's `.dark` class on `<html>` (auto).
 */
type WithMode<P> = P & { mode?: ShuffleColorMode };
const withTheme = <P extends object>(Inner: React.ComponentType<P>, displayName: string) => {
  const Wrapped: React.FC<WithMode<P>> = ({ mode, ...rest }) => (
    <ShuffleCoreThemeProvider mode={mode}>
      <Inner {...(rest as P)} />
    </ShuffleCoreThemeProvider>
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
export { usePageMeta } from './usePageMeta';
export { toast, setToastImpl } from './toast';
export { API_CONFIG, getApiUrl, getAuthHeader, shuffleFetch, setRegionUrl, resetRegionUrl } from './api';

// Onboarding flow — shared between Shuffle Core and Shuffle Security.
export { OnboardingFlow, ProductChoiceStep } from './onboarding';
export type { OnboardingFlowProps, OnboardingProduct } from './onboarding';
