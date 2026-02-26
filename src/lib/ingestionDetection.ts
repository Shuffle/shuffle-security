/**
 * Shared app category detection utilities.
 * Used by onboarding (EnrichmentConfig) and incident automations (CategoryAutomationsDialog).
 */

import { AuthAppEntry, deduplicateAuthApps } from '@/lib/utils';

// ============================================================================
// Category patterns
// ============================================================================
export const EMAIL_APP_PATTERNS = ['gmail', 'outlook', 'email', 'microsoft_graph', 'office365', 'exchange', 'imap', 'smtp'];
export const CASES_PATTERNS = ['jira', 'servicenow', 'zendesk', 'freshdesk', 'pagerduty', 'opsgenie', 'ticket', 'itsm', 'salesforce', 'thehive', 'cortex'];
export const EDR_PATTERNS = ['crowdstrike', 'sentinelone', 'carbon black', 'defender', 'cylance', 'sophos', 'trellix', 'vmware', 'tanium', 'falcon', 'edr'];
export const SIEM_PATTERNS = ['splunk', 'elastic', 'qradar', 'sentinel', 'chronicle', 'logrhythm', 'sumo logic', 'graylog', 'wazuh', 'siem', 'arcsight'];
export const THREAT_INTEL_PATTERNS = ['virustotal', 'shodan', 'alienvault', 'otx', 'threatcrowd', 'urlscan', 'hybrid-analysis', 'abuseipdb', 'greynoise', 'urlhaus', 'malwarebazaar', 'threatfox', 'misp', 'opencti', 'recorded future', 'mandiant', 'crowdstrike intel', 'intel471', 'flashpoint', 'domaintools'];
export const COMMUNICATION_PATTERNS_NAMES = ['slack', 'teams', 'discord', 'mattermost', 'telegram', 'webhook'];

// ============================================================================
// Detection helpers
// ============================================================================
export const isEmailApp = (appName: string): boolean =>
  EMAIL_APP_PATTERNS.some(pattern => appName.toLowerCase().includes(pattern));

export const isThreatIntelApp = (appName: string): boolean =>
  THREAT_INTEL_PATTERNS.some(pattern => appName.toLowerCase().includes(pattern));

export const isIngestionApp = (appName: string): boolean => {
  const name = appName.toLowerCase();
  return isEmailApp(appName) ||
    CASES_PATTERNS.some(p => name.includes(p)) ||
    EDR_PATTERNS.some(p => name.includes(p)) ||
    SIEM_PATTERNS.some(p => name.includes(p));
};

export type IngestionCategory = 'email' | 'cases' | 'edr' | 'siem' | 'other';

export const getIngestionCategory = (appName: string, appCategories?: string[]): IngestionCategory | null => {
  const name = appName.toLowerCase();
  const categories = (appCategories || []).map(c => c.toLowerCase());
  
  if (isEmailApp(name)) return 'email';
  if (CASES_PATTERNS.some(p => name.includes(p)) || categories.includes('cases') || categories.includes('itsm')) return 'cases';
  if (EDR_PATTERNS.some(p => name.includes(p)) || categories.includes('edr') || categories.includes('endpoint')) return 'edr';
  if (SIEM_PATTERNS.some(p => name.includes(p)) || categories.includes('siem')) return 'siem';
  
  return null;
};

// ============================================================================
// Validated ingestion app extraction from raw API data
// ============================================================================
export interface ValidatedIngestionApp {
  id: string;
  name: string;
  image?: string;
  validated: boolean;
  enabled: boolean;
  category: IngestionCategory;
}

/**
 * Extract validated apps from the raw /api/v1/apps/authentication response.
 * Returns deduplicated apps that have valid authentication.
 * Pass enabledToolIds to mark which are actually enabled for ingestion (from automation config).
 * If enabledToolIds is not provided, all validated apps are marked as enabled.
 */
export function extractValidatedIngestionApps(
  authApiResponse: any[],
  enabledToolIds?: Record<string, boolean>,
): ValidatedIngestionApp[] {
  const dedupedApps = deduplicateAuthApps(
    authApiResponse.filter(auth => auth.active || auth.validation?.valid)
  );

  const apps: ValidatedIngestionApp[] = [];

  for (const { app, bestImage, hasValidAuth } of dedupedApps) {
    if (!hasValidAuth) continue;
    const category = getIngestionCategory(app.name, app.categories) || 'other';

    // Determine enabled: if enabledToolIds provided, check it; otherwise default to true
    const enabled = enabledToolIds
      ? enabledToolIds[app.id] !== false
      : true;

    apps.push({
      id: app.id,
      name: app.name,
      image: bestImage || app.large_image,
      validated: true,
      enabled,
      category,
    });
  }

  return apps;
}
