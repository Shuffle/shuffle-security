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
  findIngestTicketsWorkflow,
  extractWorkflowAppNames,
  type ValidatedIngestionApp,
} from '@/lib/ingestionDetection';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import { getDatastoreByCategory, setDatastoreItems, DATASTORE_CATEGORIES } from '@/services/datastore';
import { DEFAULT_THREAT_FEEDS } from '@/hooks/useThreatFeeds';
import { DEFAULT_IOC_TYPES, DEFAULT_ENABLED_IOCS } from '@/hooks/useIOCTypes';

/**
 * localStorage key holding the JSON-encoded list of app names that were on
 * the user's "Ingest Tickets" workflow before demo mode took it over. On
 * cleanup we use this to restore the original sources.
 */
export const DEMO_INGEST_APPS_BACKUP_KEY = 'shuffle_demo_ingest_apps_backup';

/** The label "Ingest Tickets" comes from the usecase registry — keep in sync. */
const INGEST_TICKETS_LABEL = 'Ingest Tickets';

/**
 * POST to /api/v2/workflows/generate.
 *
 * If `enabledAppNames` is empty:
 *   - by default we skip the call (matches the original onboarding semantics);
 *   - when `allowEmpty` is true, we still POST without an `app_name` so the
 *     workflow gets generated with no apps wired up. Used in demo mode for
 *     "Ingest Tickets" so we never touch the user's real integrations.
 */
const generateWorkflow = async (
  label: string,
  enabledAppNames: string[],
  category: string = 'cases',
  options: { allowEmpty?: boolean } = {},
): Promise<void> => {
  if (enabledAppNames.length === 0 && !options.allowEmpty) return;
  try {
    const body: Record<string, string> = { label, category };
    if (enabledAppNames.length > 0) {
      body.app_name = enabledAppNames.join(',');
    }
    await fetch(getApiUrl('/api/v2/workflows/generate'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

/** Fetch all workflows. */
const fetchWorkflows = async (): Promise<any[]> => {
  try {
    const res = await fetch(getApiUrl('/api/v1/workflows'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.workflows || []);
  } catch {
    return [];
  }
};

/**
 * Snapshot the apps currently wired into the user's "Ingest Tickets"
 * workflow (if any) so we can restore them when the demo ends. We only
 * write the backup the first time — subsequent demo runs must not
 * overwrite the real snapshot with an already-cleared workflow.
 */
const backupExistingIngestTicketsApps = async (): Promise<void> => {
  if (localStorage.getItem(DEMO_INGEST_APPS_BACKUP_KEY) !== null) return;
  const workflows = await fetchWorkflows();
  const ingest = findIngestTicketsWorkflow(workflows);
  const names = ingest ? Array.from(extractWorkflowAppNames(ingest)) : [];
  localStorage.setItem(DEMO_INGEST_APPS_BACKUP_KEY, JSON.stringify(names));
};

/**
 * Generate the onboarding workflows (Ingest + Threat Intel).
 *
 * Demo-mode behavior for "Ingest Tickets": we explicitly DO NOT pass any of
 * the user's real apps. We snapshot whatever apps were on the existing
 * workflow first (so cleanup can restore them), then generate the workflow
 * empty so the demo runs in isolation. Threat Intel and the webhook variant
 * keep the original behavior.
 */
const generateOnboardingWorkflows = async (): Promise<void> => {
  const authedApps = await fetchAuthenticatedApps();
  const valid = authedApps.filter(a => a.active || a.validation?.valid);

  // Threat-intel apps still get wired up — only Ingest Tickets is sandboxed.
  const dedupAll = deduplicateAuthApps(valid).map(d => d.app.name);
  const threatIntelAppNames = Array.from(new Set(dedupAll));

  // Snapshot the user's real Ingest Tickets apps before we overwrite them.
  await backupExistingIngestTicketsApps();

  const ingestLabels = getAutomationLabels('automatic_ingestion');
  const threatLabels = getAutomationLabels('threat_intel');

  // Fire all generations in parallel — each is independent.
  const tasks: Promise<void>[] = [];
  for (const label of ingestLabels) {
    if (label === INGEST_TICKETS_LABEL) {
      // Demo: generate with NO apps so we never touch the user's integrations.
      tasks.push(generateWorkflow(label, [], 'cases', { allowEmpty: true }));
    } else {
      // Webhook variant + anything else keeps original behavior.
      tasks.push(generateWorkflow(label, [], 'cases', { allowEmpty: true }));
    }
  }
  for (const label of threatLabels) {
    tasks.push(generateWorkflow(label, threatIntelAppNames, 'cases'));
  }
  await Promise.allSettled(tasks);
};

/**
 * Restore the user's original "Ingest Tickets" apps from the backup
 * snapshot. Called from cleanupDemoData. If the backup recorded zero apps
 * (the workflow was empty or absent before the demo), we explicitly clear
 * the workflow so the demo state isn't left behind.
 */
export const restoreOriginalIngestTicketsApps = async (): Promise<void> => {
  const raw = localStorage.getItem(DEMO_INGEST_APPS_BACKUP_KEY);
  if (raw === null) return; // nothing to restore
  let names: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) names = parsed.filter(n => typeof n === 'string');
  } catch { /* ignore corrupt backup */ }

  try {
    if (names.length > 0) {
      // Re-generate with the original apps.
      await fetch(getApiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: INGEST_TICKETS_LABEL,
          category: 'cases',
          app_name: names.join(','),
        }),
      });
    } else {
      // Original workflow had no apps — explicitly remove the demo placeholder.
      await fetch(getApiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: INGEST_TICKETS_LABEL,
          category: 'cases',
          action_name: 'remove',
        }),
      });
    }
  } catch (err) {
    console.warn('[demo] restore ingest tickets apps failed', err);
  } finally {
    localStorage.removeItem(DEMO_INGEST_APPS_BACKUP_KEY);
  }
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

// ─── Fake Host Monitor injection ────────────────────────────────────────────
// The demo narrative pivots on Sarah Chen's compromised laptop FIN-LAPTOP-04.
// To let the AI agent propose "Isolate host" and the user approve it, the
// host must show up on /monitors. We do this in two parts:
//   1. Seed `shuffle-security_sensors` with the rich host record so the
//      Monitors UI renders software, code-scanner, response-actions, etc.
//   2. PUT /api/v1/setenvironments to inject a stub host into a sensor_group
//      environment (creating "shuffle_sensors" if none exists yet).
// Both records are tagged demo:true so cleanup can find them later.

export const DEMO_HOST_HOSTNAME = 'FIN-LAPTOP-04';
export const DEMO_HOST_UUID = 'demo-host-fin-laptop-04';
export const DEMO_HOST_GROUP = 'shuffle_sensors';
const SENSORS_CATEGORY = 'shuffle-security_sensors';

const buildDemoSensorHost = () => {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    uuid: DEMO_HOST_UUID,
    hostname: DEMO_HOST_HOSTNAME,
    os: 'windows',
    arch: 'amd64',
    serial: 'FIN-LAPTOP-04-SN-9821',
    checkin: nowSec,
    last_checkin: nowSec,
    hd_encrypted: true,
    automatic_screen_lock_enabled: true,
    elevated_access: true,
    sensor_mode: true,
    response_actions: 'full',
    log_forwarding: '',
    installed_software: [
      { name: 'Google Chrome', version: '124.0.6367.91', vendor: 'Google LLC' },
      { name: 'Microsoft Edge', version: '125.0.2535.51', vendor: 'Microsoft' },
      { name: 'Slack', version: '4.38.121', vendor: 'Slack Technologies' },
      { name: 'Zoom', version: '5.17.11', vendor: 'Zoom Video Communications' },
      { name: '1Password', version: '8.10.30', vendor: 'AgileBits' },
      { name: 'Microsoft 365 Apps', version: '16.0.17328.20184', vendor: 'Microsoft' },
    ],
    code_scanner: [],
    metadata: {
      uid: DEMO_HOST_UUID,
      extensions: { custom_attributes: { demo: true } },
    },
  };
};

/** Seed the rich sensor record into the datastore. Idempotent on key. */
const initDemoSensorRecord = async (): Promise<void> => {
  try {
    await setDatastoreItems(
      [{ key: DEMO_HOST_HOSTNAME.toLowerCase(), value: buildDemoSensorHost() }],
      SENSORS_CATEGORY,
    );
  } catch (err) {
    console.warn('[demo] sensor record init failed', err);
  }
};

interface OrbEnv {
  Name: string;
  Type?: string;
  id?: string;
  sensor_group?: boolean;
  sensor_hosts?: Array<Record<string, unknown>>;
  archived?: boolean;
  [key: string]: unknown;
}

/** Inject a fake sensor host into a sensor_group environment. */
const injectDemoMonitorHost = async (): Promise<void> => {
  try {
    // 1. Pull current environments
    const getRes = await fetch(getApiUrl('/api/v1/getenvironments'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!getRes.ok) {
      console.warn('[demo] getenvironments failed', getRes.status);
      return;
    }
    const envs: OrbEnv[] = await getRes.json();
    const live = Array.isArray(envs) ? envs.filter(e => !e.archived) : [];

    // 2. Find an existing sensor_group, or queue creation of "shuffle_sensors"
    let targetIdx = live.findIndex(e => e.sensor_group === true);
    if (targetIdx === -1) {
      live.push({ Name: DEMO_HOST_GROUP, Type: 'onprem', sensor_group: true, sensor_hosts: [] });
      targetIdx = live.length - 1;
    }
    const target = live[targetIdx];
    const existing = Array.isArray(target.sensor_hosts) ? target.sensor_hosts : [];

    // 3. Skip if our demo host is already present
    const already = existing.some(h => {
      const hn = String((h as { hostname?: string }).hostname || '').toLowerCase();
      const uid = String((h as { uuid?: string }).uuid || '');
      return hn === DEMO_HOST_HOSTNAME.toLowerCase() || uid === DEMO_HOST_UUID;
    });
    if (already) return;

    // 4. Append the stub (env API merges runtime data; sensors datastore has the rest)
    target.sensor_hosts = [...existing, buildDemoSensorHost()];

    // 5. Persist via setenvironments — full-state PUT
    const putRes = await fetch(getApiUrl('/api/v1/setenvironments'), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(live),
    });
    if (!putRes.ok) {
      console.warn('[demo] setenvironments failed', putRes.status);
    }
  } catch (err) {
    console.warn('[demo] inject monitor host failed', err);
  }
};

/** Seed sensor record + inject into environments in parallel. */
const initDemoMonitorHost = async (): Promise<void> => {
  await Promise.allSettled([initDemoSensorRecord(), injectDemoMonitorHost()]);
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

/** Seed a "Security Analyst" agent persona into the agents datastore. */
export const DEMO_AGENTS_CATEGORY = 'shuffle-security_agents';
export const DEMO_SECURITY_ANALYST_KEY = 'demo-agent-security-analyst';

const buildDemoSecurityAnalystAgent = () => ({
  id: DEMO_SECURITY_ANALYST_KEY,
  name: 'Security Analyst',
  role: 'security_analyst',
  description:
    'A focused AI analyst that supports you on incident triage, evidence gathering, and recommended response actions. Acts as your second pair of eyes — never takes high-risk actions without approval.',
  goals: [
    'Triage new incidents and surface the ones that need a human first',
    'Pull together host, user, and threat-intel context for each incident',
    'Recommend a clear next action and ask for approval on anything risky',
  ],
  capabilities: [
    'Read incidents, assets, users, and host monitors',
    'Enrich observables against threat feeds',
    'Propose response actions (e.g. isolate host) for human approval',
  ],
  status: 'active',
  created_at: new Date().toISOString(),
  metadata: {
    uid: DEMO_SECURITY_ANALYST_KEY,
    extensions: { custom_attributes: { demo: true } },
  },
});

const initDemoAgents = async (): Promise<void> => {
  try {
    const res = await getDatastoreByCategory(DEMO_AGENTS_CATEGORY);
    if (res.success && res.data) {
      const exists = res.data.some(item => item.key === DEMO_SECURITY_ANALYST_KEY);
      if (exists) return;
    }
    await setDatastoreItems(
      [{ key: DEMO_SECURITY_ANALYST_KEY, value: buildDemoSecurityAnalystAgent() }],
      DEMO_AGENTS_CATEGORY,
    );
  } catch (err) {
    console.warn('[demo] agents init failed', err);
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
    initDemoMonitorHost(),
    initDemoAgents(),
  ]);
};
