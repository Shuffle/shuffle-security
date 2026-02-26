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
 * Pass enabledToolIds (keyed by app ID) to mark which are actually enabled for ingestion.
 * Also pass the raw auth response to resolve ID-to-name mapping for enabled lookups.
 */
export function extractValidatedIngestionApps(
  authApiResponse: any[],
  enabledToolIds?: Record<string, boolean>,
): ValidatedIngestionApp[] {
  const dedupedApps = deduplicateAuthApps(
    authApiResponse.filter(auth => auth.active || auth.validation?.valid)
  );

  // Build a reverse map: app ID -> normalized name from ALL auth entries
  // so we can match enabledToolIds (which use per-entry IDs) to deduplicated apps
  const idToNormalizedName = new Map<string, string>();
  authApiResponse.forEach(auth => {
    if (auth.app?.id && auth.app?.name) {
      const normalized = auth.app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
      idToNormalizedName.set(auth.app.id, normalized);
    }
  });

  // Build a set of normalized names that are enabled
  const enabledNames = new Set<string>();
  if (enabledToolIds) {
    for (const [id, value] of Object.entries(enabledToolIds)) {
      if (value === true) {
        const name = idToNormalizedName.get(id);
        if (name) enabledNames.add(name);
      }
    }
  }

  const apps: ValidatedIngestionApp[] = [];

  for (const { app, bestImage, hasValidAuth } of dedupedApps) {
    if (!hasValidAuth) continue;
    const category = getIngestionCategory(app.name, app.categories) || 'other';
    const normalizedName = app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_');

    // Enabled only if this normalized name is in the enabled set
    const enabled = enabledToolIds
      ? enabledNames.has(normalizedName)
      : false;

    apps.push({
      id: app.id,
      name: app.name,
      image: bestImage || app.large_image,
      validated: true,
      enabled,
      category,
    });
  }

  // Sort: enabled first, then alphabetically
  apps.sort((a, b) => {
    if (a.enabled && !b.enabled) return -1;
    if (!a.enabled && b.enabled) return 1;
    return a.name.localeCompare(b.name);
  });

  return apps;
}
