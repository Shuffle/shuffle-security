/**
 * Demo Mode — "make the environment live" bootstrap.
 *
 * Runs the same enablement steps an operator would normally do on
 * /onboarding/automate, so the demo tour starts in a working state.
 *
 * The indicator-pipeline portion runs in a strict sequence so step 4 can
 * actually pick a real IOC instead of falling back to a static pool:
 *
 *   Stage A (parallel):
 *     1. Initialize IOC Types defaults     (no-op if already populated)
 *     2. Initialize Threat Feeds defaults  (no-op if already populated)
 *
 *   Stage B (after A):
 *     3. Run the "Enable Threat feeds" workflow so feeds get parsed into
 *        the `ioc_domain` / `ioc_ip` datastore categories.
 *
 *   Stage C (after B):
 *     4. Poll `ioc_domain` until at least one indicator is present (or we
 *        give up after a short budget). The indicator-availability promise
 *        is exposed as `indicatorReady` so the incidents-list seeder can
 *        await it before picking real IOCs.
 *
 * Independent steps (workflow generation, monitor host, agents, agent
 * permissions) fire in parallel alongside Stage A — they do not gate the
 * indicator pipeline.
 *
 * Best-effort: all failures are swallowed and logged; the tour continues
 * regardless so a flaky API does not block the user.
 */

import { getApiUrl, getAuthHeader } from '@/config/api';
import { getAutomationLabels } from '@/config/usecases';
import {
  findIngestTicketsWorkflow,
  extractWorkflowAppNames,
} from '@/lib/ingestionDetection';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import { getDatastoreByCategory, setDatastoreItems, DATASTORE_CATEGORIES } from '@/services/datastore';
import { DEFAULT_THREAT_FEEDS } from '@/hooks/useThreatFeeds';
import { DEFAULT_IOC_TYPES, DEFAULT_ENABLED_IOCS } from '@/hooks/useIOCTypes';
import { DEFAULT_AGENT_PERMISSIONS } from '@/hooks/useAgentPermissions';
import { DEMO_FLAG_KEY, DEMO_ACTIVE_KEY } from '@/lib/demoSeedData';

/**
 * Local de-duped writer into the demo cleanup index. Mirrors `recordSeed`
 * in services/demoMode.ts (importing it here would create a cycle, since
 * demoMode already imports from this file). Keeps the SENSORS_CATEGORY key
 * tracked so getDemoStats counts the host as an asset and cleanup removes
 * it on tear-down.
 */
const recordSeedLocal = (category: string, keys: string[]) => {
  try {
    const raw = localStorage.getItem(DEMO_FLAG_KEY) || '{}';
    const idx = JSON.parse(raw) as Record<string, string[]>;
    const existing = new Set(idx[category] || []);
    for (const k of keys) existing.add(k);
    idx[category] = Array.from(existing);
    localStorage.setItem(DEMO_FLAG_KEY, JSON.stringify(idx));
    localStorage.setItem(DEMO_ACTIVE_KEY, 'true');
  } catch (err) {
    console.warn('[demo] recordSeedLocal failed', err);
  }
};

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
 * Shuffle's own internal tool apps that should never be passed as
 * `app_name` to /api/v2/workflows/generate — they are platform primitives,
 * not integrations the user wired up. Mirrors the filter used by the
 * usecase diagram (UsecaseAlluvialDiagram.tsx).
 */
const SHUFFLE_INTERNAL_PATTERNS = ['shuffle tools', 'shuffle_tools', 'shuffle datastore', 'shuffle workflow'];
const isShuffleInternalApp = (name: string): boolean => {
  const lower = name.toLowerCase().replace(/_/g, ' ');
  return SHUFFLE_INTERNAL_PATTERNS.some(p => lower.includes(p.replace(/_/g, ' ')));
};

/**
 * Snapshot the apps currently wired into the user's "Ingest Tickets"
 * workflow (if any) so we can restore them when the demo ends. We only
 * write the backup the first time — subsequent demo runs must not
 * overwrite the real snapshot with an already-cleared workflow.
 *
 * Shuffle's own internal tools (Shuffle Tools, Datastore, etc.) are
 * filtered out so we never POST `app_name: "shuffle_tools"` back to the
 * generate endpoint, which would be meaningless.
 */
const backupExistingIngestTicketsApps = async (): Promise<void> => {
  if (localStorage.getItem(DEMO_INGEST_APPS_BACKUP_KEY) !== null) return;
  const workflows = await fetchWorkflows();
  const ingest = findIngestTicketsWorkflow(workflows);
  const names = ingest
    ? Array.from(extractWorkflowAppNames(ingest)).filter(n => !isShuffleInternalApp(n))
    : [];
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
    if (Array.isArray(parsed)) {
      names = parsed
        .filter(n => typeof n === 'string')
        // Strip Shuffle's internal apps from older backups so cleanup never
        // POSTs `app_name: "shuffle_tools"` to /workflows/generate.
        .filter(n => !isShuffleInternalApp(n));
    }
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

/** Label of the workflow generated by the Threat Feeds enablement. */
const THREAT_FEEDS_WORKFLOW_LABEL = 'Enable Threat feeds';

/**
 * Fire-and-forget execution of the "Enable Threat feeds" workflow so the
 * demo environment actually has some threat intel ingested. We wait ~1s
 * after seeding defaults so the workflow generation has time to settle,
 * then look it up by name and POST /execute.
 */
const runThreatFeedsWorkflowInBackground = (): void => {
  setTimeout(async () => {
    try {
      const workflows = await fetchWorkflows();
      const wf = workflows.find(
        (w: any) => typeof w?.name === 'string' && w.name === THREAT_FEEDS_WORKFLOW_LABEL,
      );
      const wfId = wf?.id;
      if (!wfId) return;
      await fetch(getApiUrl(`/api/v1/workflows/${wfId}/execute`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ execution_source: 'demo', start: '' }),
      });
    } catch (err) {
      console.warn('[demo] threat feeds workflow execute failed', err);
    }
  }, 1000);
};

/** Initialize Threat Feeds defaults if the category is empty. */
const initThreatFeedsDefaults = async (): Promise<void> => {
  try {
    const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.THREAT_FEEDS);
    const alreadySeeded = res.success && res.data && res.data.length > 0;
    if (!alreadySeeded) {
      const items = DEFAULT_THREAT_FEEDS.map(feed => ({ key: feed.id, value: feed }));
      await setDatastoreItems(items, DATASTORE_CATEGORIES.THREAT_FEEDS);
    }
    // Either way (fresh seed or already populated), kick the workflow in the
    // background ~1s later so the demo always has fresh threat intel.
    runThreatFeedsWorkflowInBackground();
  } catch (err) {
    console.warn('[demo] threat feeds init failed', err);
  }
};

// ─── Fake Host Monitor injection ────────────────────────────────────────────
// The demo narrative pivots on Sarah Chen's compromised laptop FIN-LAPTOP-04.
// To let the AI agent propose "Isolate host" and the user approve it, the
// host must show up on /monitors. We do this purely on the frontend by
// seeding `shuffle-security_sensors` with the rich host record (recent
// checkin included). The Monitors list page surfaces sensor-datastore
// records that aren't backed by a real environment host, so no
// /api/v1/setenvironments mutation is required. The record is tagged
// demo:true so cleanup can find it later.

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
    // Owner identity — drives automatic cross-correlation with the
    // phishing/Sliver incidents (which share sarah.chen@example.com) and the
    // stakeholder registry seeded later in the tour.
    owner: { name: 'Sarah Chen', email: 'sarah.chen@example.com' },
    user: 'sarah.chen@example.com',
    username: 'sarah.chen',
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
    const key = DEMO_HOST_HOSTNAME.toLowerCase();
    await setDatastoreItems(
      [{ key, value: buildDemoSensorHost() }],
      SENSORS_CATEGORY,
    );
    // Track in the demo cleanup index so the asset stat reflects the host
    // and cleanup removes it on tear-down. recordSeedLocal de-duplicates.
    recordSeedLocal(SENSORS_CATEGORY, [key]);
  } catch (err) {
    console.warn('[demo] sensor record init failed', err);
  }
};

/** Seed the demo sensor record into the sensors datastore. */
const initDemoMonitorHost = async (): Promise<void> => {
  await initDemoSensorRecord();
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
 * Seed the AI Agent's default Response Action permissions into the
 * `shuffle-security_configuration` datastore under the `agent_permissions`
 * key (same shape the Response Actions page reads/writes via
 * useAgentPermissions). For the demo we want at least one high-impact
 * action — "Isolate Systems" — enabled out of the box so the agent has
 * something meaningful to act on. We never overwrite an existing config so
 * users that already configured permissions keep their choices.
 */
const AGENT_PERMISSIONS_KEY = 'agent_permissions';

const buildDemoAgentPermissions = () =>
  DEFAULT_AGENT_PERMISSIONS.map(cat => ({
    ...cat,
    permissions: cat.permissions.map(p =>
      // Enable "Isolate Systems" by default for the demo so the agent has
      // a high-impact host action available without extra setup.
      p.id === 'isolate_systems' ? { ...p, enabled: true } : p,
    ),
  }));

const initAgentPermissionsDefaults = async (): Promise<void> => {
  try {
    const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.CONFIGURATION);
    if (res.success && res.data) {
      const exists = res.data.some(item => item.key === AGENT_PERMISSIONS_KEY);
      if (exists) return;
    }
    await setDatastoreItems(
      [{ key: AGENT_PERMISSIONS_KEY, value: buildDemoAgentPermissions() }],
      DATASTORE_CATEGORIES.CONFIGURATION,
    );
  } catch (err) {
    console.warn('[demo] agent permissions init failed', err);
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
    initAgentPermissionsDefaults(),
  ]);
};
