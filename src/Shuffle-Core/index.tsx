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
import { ShuffleCoreThemeProvider } from './components/ShuffleCoreThemeProvider';

import UsecasesRaw from './views/Usecases';
import UsecaseAlluvialDiagramRaw from './views/UsecaseAlluvialDiagram';
import FormInputRaw from './views/FormInput';
import EditWorkflowRaw from './components/EditWorkflow';
import RecentWorkflowRaw from './components/RecentWorkflow';

const withTheme = <P extends object>(Inner: React.ComponentType<P>, displayName: string) => {
  const Wrapped: React.FC<P> = (props) => (
    <ShuffleCoreThemeProvider>
      <Inner {...props} />
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

export default Usecases;

export { ShuffleCoreThemeProvider };
export { usePageMeta } from './usePageMeta';
export { toast, setToastImpl } from './toast';
export { API_CONFIG, getApiUrl, getAuthHeader, shuffleFetch, setRegionUrl, resetRegionUrl } from './api';

// Onboarding flow — shared between Shuffle Core and Shuffle Security.
export { OnboardingFlow, ProductChoiceStep } from './onboarding';
export type { OnboardingFlowProps, OnboardingProduct } from './onboarding';
