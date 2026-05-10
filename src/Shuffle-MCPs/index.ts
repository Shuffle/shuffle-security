/**
 * Local Singul Library — fully self-contained.
 * No host-app `@/` imports remain inside this folder (assets aside).
 */

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
