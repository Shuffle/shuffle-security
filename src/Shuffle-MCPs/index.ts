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

export { ShuffleMcpThemeProvider } from './ShuffleMcpThemeProvider';
export type { ShuffleMcpColorMode, ShuffleMcpThemeProviderProps } from './ShuffleMcpThemeProvider';

export type { ShuffleHostProps } from './host-props';

export { ShuffleMCP, default } from './ShuffleMCP';
export type { ShuffleMCPHandle } from './ShuffleMCP';
export { default as AppDetailDrawer } from './AppDetailDrawer';
export { default as AppSearchDrawer } from './AppSearchDrawer';
export { default as AiAgentPromptsEditor } from './AiAgentPromptsEditor';
export type { AiAgentPromptsEditorProps } from './AiAgentPromptsEditor';
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
export { default as AgentsView } from './AgentsView';
export type { AgentsViewProps } from './AgentsView';
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
export { API_CONFIG, getApiUrl, getAuthHeader, isCloud, isOnprem, isCloudDomain, shuffleFetch } from './api';
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
