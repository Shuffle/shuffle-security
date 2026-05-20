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
import React from 'react';
import { ShuffleMcpThemeProvider, type ShuffleMcpColorMode } from './ShuffleMcpThemeProvider';

type WithColorMode<P> = P & { colorMode?: ShuffleMcpColorMode };

const withMcpTheme = <P extends object>(Inner: React.ComponentType<P>, displayName: string) => {
  const Wrapped: React.FC<WithColorMode<P>> = ({ colorMode, ...rest }) =>
    React.createElement(
      ShuffleMcpThemeProvider,
      { mode: colorMode },
      React.createElement(Inner as React.ComponentType<any>, { ...(rest as P) }),
    );
  Wrapped.displayName = `ShuffleMCPs(${displayName})`;
  return Wrapped as React.ComponentType<WithColorMode<P>>;
};

const withMcpThemeRef = <P extends object, R>(Inner: React.ForwardRefExoticComponent<P & React.RefAttributes<R>>, displayName: string) => {
  const Wrapped = React.forwardRef<R, WithColorMode<P>>(({ colorMode, ...rest }, ref) =>
    React.createElement(
      ShuffleMcpThemeProvider,
      { mode: colorMode },
      React.createElement(Inner as React.ComponentType<any>, { ...(rest as P), ref }),
    ),
  );
  Wrapped.displayName = `ShuffleMCPs(${displayName})`;
  return Wrapped as React.ForwardRefExoticComponent<WithColorMode<P> & React.RefAttributes<R>>;
};

import { ShuffleMCP as ShuffleMCPRaw } from './ShuffleMCP';
import AppDetailDrawerRaw from './AppDetailDrawer';
import AppSearchDrawerRaw from './AppSearchDrawer';
import AiAgentPromptsEditorRaw from './AiAgentPromptsEditor';
import ShufflePipelinesBannerRaw from './ShufflePipelinesBanner';
import AppTitleHeaderRaw from './AppTitleHeader';
import AppAuthSectionRaw from './AppAuthSection';
import TryMcpSectionRaw from './TryMcpSection';
import SingulActionsPreviewRaw from './SingulActionsPreview';
import AgentUIRaw from './AgentUI';
import AgentRunDrawerRaw from './AgentRunDrawer';
import AgentActivityListRaw from './AgentActivityList';
import AgentExecutionDrawerRaw from './AgentExecutionDrawer';
import AgentsViewRaw from './AgentsView';
import AgentRunDiagnosisBannerRaw from './AgentRunDiagnosisBanner';

export { ShuffleMcpThemeProvider } from './ShuffleMcpThemeProvider';
export type { ShuffleMcpColorMode, ShuffleMcpThemeProviderProps } from './ShuffleMcpThemeProvider';

export type { ShuffleHostProps } from './host-props';

export const ShuffleMCP = withMcpThemeRef(ShuffleMCPRaw as React.ForwardRefExoticComponent<any>, 'ShuffleMCP');
export default ShuffleMCP;
export type { ShuffleMCPHandle } from './ShuffleMCP';
export const AppDetailDrawer = withMcpTheme(AppDetailDrawerRaw as React.ComponentType<any>, 'AppDetailDrawer');
export const AppSearchDrawer = withMcpTheme(AppSearchDrawerRaw as React.ComponentType<any>, 'AppSearchDrawer');
export const AiAgentPromptsEditor = withMcpTheme(AiAgentPromptsEditorRaw as React.ComponentType<any>, 'AiAgentPromptsEditor');
export type { AiAgentPromptsEditorProps } from './AiAgentPromptsEditor';
export const ShufflePipelinesBanner = withMcpTheme(ShufflePipelinesBannerRaw as React.ComponentType<any>, 'ShufflePipelinesBanner');
export const AppTitleHeader = withMcpTheme(AppTitleHeaderRaw as React.ComponentType<any>, 'AppTitleHeader');
export type { AppTitleHeaderProps } from './AppTitleHeader';
export const AppAuthSection = withMcpTheme(AppAuthSectionRaw as React.ComponentType<any>, 'AppAuthSection');
export type { AppAuthSectionProps } from './AppAuthSection';
export const TryMcpSection = withMcpTheme(TryMcpSectionRaw as React.ComponentType<any>, 'TryMcpSection');
export type { TryMcpSectionProps } from './TryMcpSection';
export const SingulActionsPreview = withMcpTheme(SingulActionsPreviewRaw as React.ComponentType<any>, 'SingulActionsPreview');
export const AgentUI = withMcpTheme(AgentUIRaw as React.ComponentType<any>, 'AgentUI');
export type { AgentUIProps, AgentUIApp } from './AgentUI';
export const AgentRunDrawer = withMcpTheme(AgentRunDrawerRaw as React.ComponentType<any>, 'AgentRunDrawer');
export type { AgentRunDrawerProps, AgentRunDrawerTab } from './AgentRunDrawer';
export const AgentActivityList = withMcpTheme(AgentActivityListRaw as React.ComponentType<any>, 'AgentActivityList');
export type { AgentActivityListProps } from './AgentActivityList';
export const AgentExecutionDrawer = withMcpTheme(AgentExecutionDrawerRaw as React.ComponentType<any>, 'AgentExecutionDrawer');
export type { AgentExecutionDrawerProps } from './AgentExecutionDrawer';
export const AgentsView = withMcpTheme(AgentsViewRaw as React.ComponentType<any>, 'AgentsView');
export type { AgentsViewProps } from './AgentsView';
export const AgentRunDiagnosisBanner = withMcpTheme(AgentRunDiagnosisBannerRaw as React.ComponentType<any>, 'AgentRunDiagnosisBanner');
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
export {
  resolveApp,
  resolveApps,
  seedResolvedApp,
  invalidateResolvedApps,
} from './resolveApp';
export type { ResolvedApp } from './resolveApp';
export { IntegrationStatus, refreshAllIntegrationStatus } from './IntegrationStatus';
export { useAppAuth } from './useAppAuth';
export { AppDetailProvider, useAppDetail, useAppDetailOptional } from './AppDetailContext';
export { API_CONFIG, getApiUrl, getAuthHeader, isCloud, isOnprem, isCloudDomain, shuffleFetch, setHostBaseUrl, getHostBaseUrl, setRegionUrl, resetRegionUrl } from './api';
export { useSyncHostBaseUrl } from './useSyncHostBaseUrl';
export { installFetchBreaker, registerProtectedOrigin } from './fetchBreaker';
export { setToastImpl, toast } from './toast';
export type {
  AlgoliaSearchApp,
  AppSelectedEvent,
  AppAuthentication,
  CustomStyles,
  ShuffleMCPProps,
} from './shuffle-mcp.helpers';

// ---------------------------------------------------------------------------
// Re-exports consumed by @shuffleio/shuffle-core (and other downstream apps).
// Keep this block in sync when Shuffle-Core starts importing new symbols.
// ---------------------------------------------------------------------------

// AgentIcon
export { default as AgentIcon } from './AgentIcon';

// Auth configuration UI + types
export { AppAuthConfig, AppAuthCard } from './AppAuthConfig';
export type {
  AuthStatus,
  AppAuthState,
  ApiAuthEntry,
  AppAuthCardProps,
} from './AppAuthConfig';

// Datastore helpers
export {
  setRuntimeOrgId,
  setDatastoreItem,
  setDatastoreItems,
  getDatastoreItem,
  getDatastoreItemPublic,
  getDatastoreByCategory,
  deleteDatastoreItem,
  deleteDatastoreItems,
  DATASTORE_CATEGORIES,
} from './datastore';
export type {
  DatastoreItem,
  CategoryAutomation,
  CategoryConfig,
  DatastoreResponse,
  DatastoreDiagnostics,
} from './datastore';

// Ingestion detection
export {
  EMAIL_APP_PATTERNS,
  CASES_PATTERNS,
  EDR_PATTERNS,
  SIEM_PATTERNS,
  THREAT_INTEL_PATTERNS,
  COMMUNICATION_PATTERNS_NAMES,
  VULN_SCANNER_PATTERNS,
  INGEST_TICKETS_WORKFLOW_NAME,
  FORWARD_TICKETS_WORKFLOW_NAME,
  isEmailApp,
  isThreatIntelApp,
  isVulnScannerApp,
  isIngestionApp,
  normalizeAppName,
  getIngestionCategory,
  extractWorkflowAppNames,
  extractValidatedIngestionApps,
  findIngestTicketsWorkflow,
  findForwardTicketsWorkflow,
  isWorkflowScheduleStopped,
} from './ingestionDetection';
export type {
  IngestionCategory,
  ValidatedIngestionApp,
} from './ingestionDetection';

// Apps cache
export {
  fetchApps,
  fetchAppsViaApiConfig,
  invalidateAppsCache,
} from './appsCache';
export type { FetchAppsOptions } from './appsCache';

// Usage bar — reusable quota indicator for app runs, agent tokens, etc.
export { UsageBar } from './UsageBar';
export type { UsageBarProps } from './UsageBar';
