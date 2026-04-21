/**
 * Demo Mode service.
 *
 * Seeds sample data into the real Shuffle datastore as the user advances
 * through the tour — NOT all upfront. Each step has its own seed action,
 * tracked in localStorage so it only runs once per step.
 *
 * Cleanup is driven by a localStorage index of every key we wrote, plus a
 * safety-net scan for items tagged `metadata.extensions.custom_attributes.demo`.
 */

import { setDatastoreItems, deleteDatastoreItem, DATASTORE_CATEGORIES, getDatastoreByCategory } from '@/services/datastore';
import { getApiUrl, getAuthHeader } from '@/config/api';
import {
  buildDemoIncidentsBatch1,
  buildDemoIncidentsBatch2,
  buildDemoFocusIncident,
  buildDemoAssets,
  buildDemoUsers,
  buildDemoVulnerabilities,
  DEMO_FLAG_KEY,
  DEMO_ACTIVE_KEY,
  DEMO_SEEDED_STEPS_KEY,
} from '@/lib/demoSeedData';

const VULNS_CATEGORY = 'shuffle-security_vulnerabilities';
const SENSORS_CATEGORY = 'shuffle-security_sensors';
const AGENTS_CATEGORY = 'shuffle-security_agents';


/**
 * Strip the demo-injected sensor host stub(s) from /api/v1/getenvironments.
 * Looks for hosts tagged demo:true (via metadata.extensions.custom_attributes.demo)
 * or matching the well-known demo uuid/hostname, and PUTs the cleaned set.
 */
const removeDemoMonitorHostFromEnvs = async (): Promise<void> => {
  try {
    const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return;
    const envs = await res.json();
    if (!Array.isArray(envs)) return;

    let mutated = false;
    const cleaned = envs.map((env: Record<string, unknown>) => {
      const hosts = Array.isArray(env.sensor_hosts) ? env.sensor_hosts as Array<Record<string, unknown>> : null;
      if (!hosts) return env;
      const next = hosts.filter(h => {
        const isDemo = (h?.metadata as { extensions?: { custom_attributes?: { demo?: boolean } } } | undefined)
          ?.extensions?.custom_attributes?.demo === true;
        const matchesDemoUuid = String(h?.uuid || '') === 'demo-host-fin-laptop-04';
        const matchesDemoHost = String(h?.hostname || '').toLowerCase() === 'fin-laptop-04';
        return !isDemo && !matchesDemoUuid && !matchesDemoHost;
      });
      if (next.length !== hosts.length) {
        mutated = true;
        return { ...env, sensor_hosts: next };
      }
      return env;
    });

    if (!mutated) return;
    await fetch(getApiUrl('/api/v1/setenvironments'), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(cleaned),
    });
  } catch { /* best-effort */ }
};

interface SeededIndex {
  [category: string]: string[]; // category -> list of keys we wrote
}

const readIndex = (): SeededIndex => {
  try { return JSON.parse(localStorage.getItem(DEMO_FLAG_KEY) || '{}'); } catch { return {}; }
};
const writeIndex = (idx: SeededIndex) => localStorage.setItem(DEMO_FLAG_KEY, JSON.stringify(idx));

const readSeededSteps = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DEMO_SEEDED_STEPS_KEY) || '[]'); } catch { return []; }
};
const writeSeededSteps = (steps: string[]) => localStorage.setItem(DEMO_SEEDED_STEPS_KEY, JSON.stringify(steps));

export const isDemoActive = (): boolean => localStorage.getItem(DEMO_ACTIVE_KEY) === 'true';

export const getDemoStats = () => {
  const idx = readIndex();
  return {
    incidents: idx[DATASTORE_CATEGORIES.INCIDENTS]?.length || 0,
    assets: idx[DATASTORE_CATEGORIES.ASSETS]?.length || 0,
    users: idx[DATASTORE_CATEGORIES.USERS]?.length || 0,
  };
};

/**
 * Notify any open page that uses useDatastore for `category` to refetch.
 * Pages listen via `window.addEventListener('demo:refresh', ...)`.
 */
const broadcastRefresh = (category: string) => {
  try {
    window.dispatchEvent(new CustomEvent('demo:refresh', { detail: { category } }));
  } catch { /* SSR / older browsers */ }
};

const recordSeed = (category: string, keys: string[]) => {
  const idx = readIndex();
  idx[category] = [...(idx[category] || []), ...keys];
  writeIndex(idx);
  localStorage.setItem(DEMO_ACTIVE_KEY, 'true');
};

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Per-step seeders ────────────────────────────────────────────────────────
// Each returns the number of items written (or 0 if already seeded).

export const STEP_SEEDERS: Record<string, () => Promise<number>> = {
  // welcome — nothing
  welcome: async () => 0,

  // apps — no datastore writes; the user is just learning where to connect
  // tools. Real auth setup is intentionally not faked so cleanup stays simple.
  apps: async () => 0,

  // incidents list — 2 incidents from the apps the user just "connected",
  // followed by 1 more after a short delay so the list visibly populates.
  'incidents-list': async () => {
    let total = 0;
    const batches = [buildDemoIncidentsBatch1(), buildDemoIncidentsBatch2()];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const res = await setDatastoreItems(batch, DATASTORE_CATEGORIES.INCIDENTS);
      if (!res.success) throw new Error(res.error || 'Failed to seed demo incidents');
      recordSeed(DATASTORE_CATEGORIES.INCIDENTS, batch.map(b => b.key));
      broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);
      total += batch.length;
      if (i < batches.length - 1) await sleep(1400);
    }
    return total;
  },

  // incident-detail — no new data, user is exploring an existing one
  'incident-detail': async () => 0,

  // Step 3: assets
  assets: async () => {
    const items = buildDemoAssets();
    const res = await setDatastoreItems(items, DATASTORE_CATEGORIES.ASSETS);
    if (!res.success) throw new Error(res.error || 'Failed to seed demo assets');
    recordSeed(DATASTORE_CATEGORIES.ASSETS, items.map(i => i.key));
    broadcastRefresh(DATASTORE_CATEGORIES.ASSETS);
    return items.length;
  },

  // Step 4: vulnerabilities — seed CVE-2024-5274 (the Chrome RCE the
  // phishing link in the demo "exploits" against FIN-LAPTOP-04).
  vulnerabilities: async () => {
    const items = buildDemoVulnerabilities();
    const res = await setDatastoreItems(items, VULNS_CATEGORY);
    if (!res.success) throw new Error(res.error || 'Failed to seed demo vulnerabilities');
    recordSeed(VULNS_CATEGORY, items.map(i => i.key));
    broadcastRefresh(VULNS_CATEGORY);
    return items.length;
  },

  // Step 5: agent — seed users (used as stakeholders the agent acts on behalf of)
  agent: async () => {
    const items = buildDemoUsers();
    const res = await setDatastoreItems(items, DATASTORE_CATEGORIES.USERS);
    if (!res.success) throw new Error(res.error || 'Failed to seed demo users');
    recordSeed(DATASTORE_CATEGORIES.USERS, items.map(i => i.key));
    broadcastRefresh(DATASTORE_CATEGORIES.USERS);
    return items.length;
  },

  // Step 6: wrap
  wrap: async () => 0,
};

/**
 * Seed the data for a given tour step, if not already done.
 * Returns the number of items added (0 if step has no data or was already seeded).
 */
export const seedForStep = async (stepId: string): Promise<number> => {
  const seeded = readSeededSteps();
  // For data-bearing steps, treat the "already seeded" marker as stale if the
  // index has no record of any keys for the relevant category. This recovers
  // gracefully when demo data was wiped (manually, via cleanup, or a partial
  // failure) but the step marker is still present.
  const idx = readIndex();
  const looksEmpty = (() => {
    switch (stepId) {
      case 'incidents-list':
        return (idx[DATASTORE_CATEGORIES.INCIDENTS]?.length || 0) === 0;
      case 'assets':
        return (idx[DATASTORE_CATEGORIES.ASSETS]?.length || 0) === 0;
      case 'vulnerabilities':
        return (idx[VULNS_CATEGORY]?.length || 0) === 0;
      case 'agent':
        return (idx[DATASTORE_CATEGORIES.USERS]?.length || 0) === 0;
      default:
        return false;
    }
  })();
  if (seeded.includes(stepId) && !looksEmpty) return 0;

  const seeder = STEP_SEEDERS[stepId];
  if (!seeder) return 0;

  // Mark as seeded BEFORE running so concurrent calls don't double-seed.
  if (!seeded.includes(stepId)) writeSeededSteps([...seeded, stepId]);
  // Always set active so cleanup CTA appears even before any data lands
  localStorage.setItem(DEMO_ACTIVE_KEY, 'true');

  try {
    return await seeder();
  } catch (err) {
    // Roll back the marker so the step can be retried
    writeSeededSteps(readSeededSteps().filter(s => s !== stepId));
    throw err;
  }
};

export interface CleanupResult {
  success: boolean;
  deleted: number;
  failed: number;
}

/**
 * Count demo incidents currently present in the datastore.
 * Looks at items tagged with `metadata.extensions.custom_attributes.demo === true`
 * so this works even if the local seed index was wiped.
 */
export const countDemoIncidents = async (): Promise<number> => {
  try {
    const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.INCIDENTS);
    if (!res.success || !res.data) return 0;
    return res.data.filter(item => {
      try {
        const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
        return parsed?.metadata?.extensions?.custom_attributes?.demo === true;
      } catch { return false; }
    }).length;
  } catch { return 0; }
};

/**
 * Force-recreate the demo incidents:
 *  1. Delete any existing demo incidents (indexed + safety scan).
 *  2. Clear the seeded marker for the incidents-list step.
 *  3. Re-run the incidents-list seeder.
 * Returns the number of incidents written.
 */
export const forceRecreateDemoIncidents = async (): Promise<number> => {
  // 1. Delete indexed demo incident keys
  const idx = readIndex();
  const indexedKeys = idx[DATASTORE_CATEGORIES.INCIDENTS] || [];
  if (indexedKeys.length > 0) {
    await Promise.allSettled(indexedKeys.map(k => deleteDatastoreItem(k, DATASTORE_CATEGORIES.INCIDENTS)));
  }

  // 2. Safety scan: also delete any orphan demo-tagged incidents
  try {
    const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.INCIDENTS);
    if (res.success && res.data) {
      const orphans = res.data.filter(item => {
        try {
          const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          return parsed?.metadata?.extensions?.custom_attributes?.demo === true;
        } catch { return false; }
      });
      if (orphans.length > 0) {
        await Promise.allSettled(orphans.map(o => deleteDatastoreItem(o.key, DATASTORE_CATEGORIES.INCIDENTS)));
      }
    }
  } catch { /* best-effort */ }

  // 3. Clear the index entry + step marker so the seeder runs fresh
  const newIdx = readIndex();
  delete newIdx[DATASTORE_CATEGORIES.INCIDENTS];
  writeIndex(newIdx);
  writeSeededSteps(readSeededSteps().filter(s => s !== 'incidents-list'));
  broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);

  // 4. Re-seed
  return await seedForStep('incidents-list');
};

/**
 * Force-create the single "focus" demo incident (Wazuh / Sliver C2 on
 * FIN-LAPTOP-04). Intended for the tour's "Force generate" button so the
 * user can focus on one incident first; the rest of the batch arrives later
 * for cross-correlation. Idempotent on the focus key suffix — wipes any
 * existing focus incident before writing the new one.
 *
 * Returns the number of incidents written (0 or 1).
 */
export const forceCreateSingleDemoIncident = async (): Promise<number> => {
  // Wipe any prior focus incident so this stays a single, fresh item.
  try {
    const idx = readIndex();
    const existing = idx[DATASTORE_CATEGORIES.INCIDENTS] || [];
    const focusKeys = existing.filter(k => k.includes('-focus'));
    if (focusKeys.length > 0) {
      await Promise.allSettled(focusKeys.map(k => deleteDatastoreItem(k, DATASTORE_CATEGORIES.INCIDENTS)));
      idx[DATASTORE_CATEGORIES.INCIDENTS] = existing.filter(k => !k.includes('-focus'));
      writeIndex(idx);
    }
  } catch { /* best-effort */ }

  const item = buildDemoFocusIncident();
  const res = await setDatastoreItems([item], DATASTORE_CATEGORIES.INCIDENTS);
  if (!res.success) throw new Error(res.error || 'Failed to create demo focus incident');
  recordSeed(DATASTORE_CATEGORIES.INCIDENTS, [item.key]);
  broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);
  return 1;
};

/**
 * Delete every seeded item.
 *  1. Indexed deletions (keys we wrote, per category).
 *  2. Safety net: scan each category for items with demo: true and remove orphans.
 */
export const cleanupDemoData = async (): Promise<CleanupResult> => {
  const idx = readIndex();
  let deleted = 0;
  let failed = 0;

  for (const category of Object.keys(idx)) {
    const keys = idx[category] || [];
    const results = await Promise.allSettled(keys.map(k => deleteDatastoreItem(k, category)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.success) deleted++;
      else failed++;
    }
  }

  const safetyCategories = [DATASTORE_CATEGORIES.INCIDENTS, DATASTORE_CATEGORIES.ASSETS, DATASTORE_CATEGORIES.USERS, VULNS_CATEGORY, SENSORS_CATEGORY, AGENTS_CATEGORY];
  for (const category of safetyCategories) {
    try {
      const res = await getDatastoreByCategory(category);
      if (res.success && res.data) {
        const orphans = res.data.filter(item => {
          try {
            const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            return parsed?.metadata?.extensions?.custom_attributes?.demo === true;
          } catch { return false; }
        });
        const orphanResults = await Promise.allSettled(
          orphans.map(o => deleteDatastoreItem(o.key, category))
        );
        for (const r of orphanResults) {
          if (r.status === 'fulfilled' && r.value.success) deleted++;
          else failed++;
        }
      }
    } catch { /* best-effort */ }
  }

  // Strip the injected sensor host stub from the environments API.
  await removeDemoMonitorHostFromEnvs();

  localStorage.removeItem(DEMO_FLAG_KEY);
  localStorage.removeItem(DEMO_ACTIVE_KEY);
  localStorage.removeItem(DEMO_SEEDED_STEPS_KEY);
  localStorage.removeItem('shuffle_demo_injected_apps');

  return { success: failed === 0, deleted, failed };
};
