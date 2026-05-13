/**
 * Local Singul Library — fully self-contained.
 * No host-app `@/` imports remain inside this folder (assets aside).
 */

// Side-effect import: ensures shadcn-style token fallbacks (--card, --background,
// --border, --foreground, --muted, --primary, etc.) are always defined when any
// lib component is used standalone in a host app that does NOT define those
// CSS custom properties. Host overrides still win (defaults use :where(:root),
// specificity 0).
import './shuffle-mcp.css';

export { ShuffleMCP, default } from './ShuffleMCP';
export type { ShuffleMCPHandle } from './ShuffleMCP';
export { default as AppDetailDrawer } from './AppDetailDrawer';
export { default as AppSearchDrawer } from './AppSearchDrawer';
export { default as ShufflePipelinesBanner } from './ShufflePipelinesBanner';
export { default as AppTitleHeader } from './AppTitleHeader';
export type { AppTitleHeaderProps } from './AppTitleHeader';
export { default as AppAuthSection } from './AppAuthSection';
export type { AppAuthSectionProps } from './AppAuthSection';
export { default as TryMcpSection } from './TryMcpSection';
export type { TryMcpSectionProps } from './TryMcpSection';
export { default as SingulActionsPreview } from './SingulActionsPreview';
export { default as AgentUI } from './AgentUI';
export type { AgentUIProps, AgentUIApp } from './AgentUI';
export { default as AgentRunDrawer } from './AgentRunDrawer';
export type { AgentRunDrawerProps, AgentRunDrawerTab } from './AgentRunDrawer';
export { default as AgentActivityList } from './AgentActivityList';
export type { AgentActivityListProps } from './AgentActivityList';
export { default as AgentExecutionDrawer } from './AgentExecutionDrawer';
export type { AgentExecutionDrawerProps } from './AgentExecutionDrawer';
export { default as AgentRunDiagnosisBanner } from './AgentRunDiagnosisBanner';
export {
  parseRunResult,
  getFailureInfo,
  hasOutputWarning,
  diagnoseOutputWarning,
} from './agentDiagnosis';
export type {
  DiagnosableRun,
  DiagnosisEvidence,
  OutputDiagnosis,
} from './agentDiagnosis';
export { searchAgentActivity } from './agentActivity';
export type {
  AgentRun,
  AgentRunResult,
  AgentDecision,
  AgentActivityResponse,
  AgentActivityParams,
} from './agentActivity';
export { useAppLookup } from './useAppLookup';
export type { AppLookupResult } from './useAppLookup';
export { IntegrationStatus, refreshAllIntegrationStatus } from './IntegrationStatus';
export { useAppAuth } from './useAppAuth';
export { AppDetailProvider, useAppDetail } from './AppDetailContext';
export { API_CONFIG, getApiUrl, getAuthHeader } from './api';
export { setToastImpl, toast } from './toast';
export type {
  AlgoliaSearchApp,
  AppSelectedEvent,
  AppAuthentication,
  CustomStyles,
  ShuffleMCPProps,
} from './shuffle-mcp.helpers';
