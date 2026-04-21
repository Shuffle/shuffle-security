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
import {
  buildDemoIncidentsBatch1,
  buildDemoIncidentsBatch2,
  buildDemoAssets,
  buildDemoUsers,
  buildDemoVulnerabilities,
  DEMO_FLAG_KEY,
  DEMO_ACTIVE_KEY,
  DEMO_SEEDED_STEPS_KEY,
} from '@/lib/demoSeedData';

const VULNS_CATEGORY = 'shuffle-security_vulnerabilities';

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
      if (res.success) {
        recordSeed(DATASTORE_CATEGORIES.INCIDENTS, batch.map(b => b.key));
        broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);
        total += batch.length;
      }
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
    if (!res.success) return 0;
    recordSeed(DATASTORE_CATEGORIES.ASSETS, items.map(i => i.key));
    broadcastRefresh(DATASTORE_CATEGORIES.ASSETS);
    return items.length;
  },

  // Step 4: vulnerabilities — nothing yet (page is preview-only today)
  vulnerabilities: async () => 0,

  // Step 5: agent — seed users (used as stakeholders the agent acts on behalf of)
  agent: async () => {
    const items = buildDemoUsers();
    const res = await setDatastoreItems(items, DATASTORE_CATEGORIES.USERS);
    if (!res.success) return 0;
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
  if (seeded.includes(stepId)) return 0;

  const seeder = STEP_SEEDERS[stepId];
  if (!seeder) return 0;

  // Mark as seeded BEFORE running so concurrent calls don't double-seed.
  writeSeededSteps([...seeded, stepId]);
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

  const safetyCategories = [DATASTORE_CATEGORIES.INCIDENTS, DATASTORE_CATEGORIES.ASSETS, DATASTORE_CATEGORIES.USERS];
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

  localStorage.removeItem(DEMO_FLAG_KEY);
  localStorage.removeItem(DEMO_ACTIVE_KEY);
  localStorage.removeItem(DEMO_SEEDED_STEPS_KEY);

  return { success: failed === 0, deleted, failed };
};
