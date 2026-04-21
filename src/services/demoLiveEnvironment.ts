/**
 * Demo Mode — "make the environment live" bootstrap.
 *
 * Runs the same enablement steps an operator would normally do on
 * /onboarding/automate, so the demo tour starts in a working state:
 *   1. Generate the four ingest + threat-intel workflows (matching the
 *      `automatic_ingestion` and `threat_intel` automation areas, plus the
 *      `_webhook` variants), using the apps the user already has authed.
 *   2. Initialize Threat Feeds defaults (no-op if already populated).
 *   3. Initialize IOC Types defaults (no-op if already populated).
 *
 * Best-effort: all failures are swallowed and logged; the tour continues
 * regardless so a flaky API does not block the user.
 */

import { getApiUrl, getAuthHeader } from '@/config/api';
import { getAutomationLabels } from '@/config/usecases';
import {
  extractValidatedIngestionApps,
  type ValidatedApp,
} from '@/lib/ingestionDetection';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import { getDatastoreByCategory, setDatastoreItems, DATASTORE_CATEGORIES } from '@/services/datastore';
import { DEFAULT_THREAT_FEEDS } from '@/hooks/useThreatFeeds';
import { DEFAULT_IOC_TYPES, DEFAULT_ENABLED_IOCS } from '@/hooks/useIOCTypes';

/** Same shape as AutomationConfig.generateWorkflow — POSTs to v2 generate. */
const generateWorkflow = async (
  label: string,
  enabledAppNames: string[],
  category: string = 'cases',
): Promise<void> => {
  if (enabledAppNames.length === 0) return;
  try {
    await fetch(getApiUrl('/api/v2/workflows/generate'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label,
        app_name: enabledAppNames.join(','),
        category,
      }),
    });
  } catch (err) {
    console.warn(`[demo] workflow generate failed for ${label}`, err);
  }
};

/** Fetch the current authenticated apps. */
const fetchAuthenticatedApps = async (): Promise<AuthAppEntry[]> => {
  try {
    const res = await fetch(getApiUrl('/api/v1/apps/authentication'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.data || []);
    return list as AuthAppEntry[];
  } catch {
    return [];
  }
};

/**
 * Generate the four onboarding workflows (Ingest + Threat Intel) using the
 * user's currently-authenticated apps. Mirrors AutomationConfig's logic:
 * each automation area yields multiple labels (including `_webhook` variants
 * for ingestion), and each label is sent to `/api/v2/workflows/generate`.
 */
const generateOnboardingWorkflows = async (): Promise<void> => {
  const authedApps = await fetchAuthenticatedApps();
  const valid = authedApps.filter(a => a.active || a.validation?.valid);

  // Pull the deduplicated app names — mirrors what AutomationConfig sends.
  const ingestionApps: ValidatedApp[] = extractValidatedIngestionApps(valid, undefined);
  const ingestionAppNames = Array.from(new Set(ingestionApps.map(a => a.name)));

  const dedupAll = deduplicateAuthApps(valid).map(d => d.app.name);
  const threatIntelAppNames = Array.from(new Set(dedupAll));

  const ingestLabels = getAutomationLabels('automatic_ingestion');
  const threatLabels = getAutomationLabels('threat_intel');

  // Fire all generations in parallel — each is independent.
  const tasks: Promise<void>[] = [];
  for (const label of ingestLabels) {
    tasks.push(generateWorkflow(label, ingestionAppNames, 'cases'));
  }
  for (const label of threatLabels) {
    tasks.push(generateWorkflow(label, threatIntelAppNames, 'cases'));
  }
  await Promise.allSettled(tasks);
};

/** Initialize Threat Feeds defaults if the category is empty. */
const initThreatFeedsDefaults = async (): Promise<void> => {
  try {
    const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.THREAT_FEEDS);
    if (res.success && res.data && res.data.length > 0) return;
    const items = DEFAULT_THREAT_FEEDS.map(feed => ({ key: feed.id, value: feed }));
    await setDatastoreItems(items, DATASTORE_CATEGORIES.THREAT_FEEDS);
  } catch (err) {
    console.warn('[demo] threat feeds init failed', err);
  }
};

/** Initialize IOC Types defaults if the category is empty. */
const initIOCTypesDefaults = async (): Promise<void> => {
  try {
    const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.IOCS);
    if (res.success && res.data && res.data.length > 0) return;
    const items = DEFAULT_IOC_TYPES.map(ioc => ({
      key: ioc.name,
      value: { ...ioc, enabled: ioc.enabled ?? DEFAULT_ENABLED_IOCS.has(ioc.name) },
    }));
    await setDatastoreItems(items, DATASTORE_CATEGORIES.IOCS);
  } catch (err) {
    console.warn('[demo] IOC types init failed', err);
  }
};

/**
 * Run the full live-environment bootstrap. Safe to call multiple times —
 * all sub-steps are idempotent. Resolves once everything has settled.
 */
export const enableLiveDemoEnvironment = async (): Promise<void> => {
  await Promise.allSettled([
    generateOnboardingWorkflows(),
    initThreatFeedsDefaults(),
    initIOCTypesDefaults(),
  ]);
};
