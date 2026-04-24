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

import { setDatastoreItems, setDatastoreItem, getDatastoreItem, deleteDatastoreItem, DATASTORE_CATEGORIES, getDatastoreByCategory } from '@/services/datastore';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { restoreOriginalIngestTicketsApps } from '@/services/demoLiveEnvironment';
import { DEFAULT_THREAT_FEEDS, type ThreatFeed } from '@/hooks/useThreatFeeds';
import {
  buildDemoFocusIncident,
  buildDemoWazuhImplantIncident,
  buildDemoAssets,
  buildDemoUsers,
  buildDemoVulnerabilities,
  DEMO_FLAG_KEY,
  DEMO_ACTIVE_KEY,
  DEMO_SEEDED_STEPS_KEY,
  type DemoIocOverrides,
  type PendingObservable,
} from '@/lib/demoSeedData';

const VULNS_CATEGORY = 'shuffle-security_vulnerabilities';
const SENSORS_CATEGORY = 'shuffle-security_sensors';
const AGENTS_CATEGORY = 'shuffle-security_agents';
// Real-IOC categories populated by the backend's threat-feed parser. Keys
// are raw IPs / domains; values are STIX 2.1 indicators.
const IOC_IP_CATEGORY = 'ioc_ip';
const IOC_DOMAIN_CATEGORY = 'ioc_domain';
// Stash the IOC overrides chosen at step 1 so the Wazuh follow-up reuses
// the exact same IP + domain (correlations rely on byte-identical values).
const DEMO_IOC_OVERRIDES_KEY = 'shuffle_demo_ioc_overrides';


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
  // Sensor-datastore hosts surface on /monitors and read as assets to the
  // user, so include them in the asset count even before the dedicated
  // "assets" tour step seeds the OCSF asset records.
  const assetCount = (idx[DATASTORE_CATEGORIES.ASSETS]?.length || 0)
    + (idx[SENSORS_CATEGORY]?.length || 0);
  return {
    incidents: idx[DATASTORE_CATEGORIES.INCIDENTS]?.length || 0,
    assets: assetCount,
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
  // De-duplicate so callers (e.g. live-env init) can call this on every
  // demo start without inflating counts on repeat runs.
  const existing = new Set(idx[category] || []);
  for (const k of keys) existing.add(k);
  idx[category] = Array.from(existing);
  writeIndex(idx);
  localStorage.setItem(DEMO_ACTIVE_KEY, 'true');
};

/** Public wrapper so demoLiveEnvironment can register pre-tour seeds (e.g.
 * the sensor host injected at demo start) into the same cleanup index. */
export const recordDemoSeed = (category: string, keys: string[]) => recordSeed(category, keys);

/**
 * Server-side dedup: remove any existing demo incidents whose key matches
 * the given suffix predicate, OR whose payload looks like a demo item with
 * the matching marker. Local index is also pruned so cleanup stays accurate.
 *
 * This guards against duplicates when the local seed index has been wiped
 * (different browser, cleared storage, partial failure) — without this the
 * focus phishing or Wazuh implant incidents can accumulate every time the
 * user re-enters the tour or hits "Force generate".
 */
const wipeExistingDemoIncidents = async (
  matcher: (key: string, value: unknown) => boolean,
): Promise<void> => {
  // 1. Local index — quick path
  try {
    const idx = readIndex();
    const existing = idx[DATASTORE_CATEGORIES.INCIDENTS] || [];
    const localMatches = existing.filter(k => matcher(k, null));
    if (localMatches.length > 0) {
      await Promise.allSettled(localMatches.map(k => deleteDatastoreItem(k, DATASTORE_CATEGORIES.INCIDENTS)));
      idx[DATASTORE_CATEGORIES.INCIDENTS] = existing.filter(k => !localMatches.includes(k));
      writeIndex(idx);
    }
  } catch { /* best-effort */ }

  // 2. Server scan — catches keys the local index never saw (e.g. different
  // browser / cleared storage / pipeline-assigned keys).
  try {
    const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.INCIDENTS);
    if (res.success && res.data) {
      const orphans = res.data.filter(item => {
        const key = typeof item.key === 'string' ? item.key : '';
        return matcher(key, item.value);
      });
      if (orphans.length > 0) {
        await Promise.allSettled(
          orphans.map(o => deleteDatastoreItem(o.key, DATASTORE_CATEGORIES.INCIDENTS)),
        );
      }
    }
  } catch { /* best-effort */ }
};

/**
 * Identify ANY demo phishing incident — focus key, batch1 numbered key, or
 * a payload tagged demo with a "Phishing email reported by …" title.
 *
 * We deliberately match the broader `demo-inc-phish-` prefix (not just
 * `-focus`) so re-seeding cleans up stragglers from earlier seeders /
 * sessions / browsers (e.g. `demo-inc-phish-<ts>-1` from buildDemoIncidentsBatch1).
 * Without this, repeat tour runs accumulate duplicate phishing incidents
 * in the datastore even though the focus dedup "succeeds".
 */
const isDemoFocusIncident = (key: string, value: unknown): boolean => {
  if (key.startsWith('demo-inc-phish-')) return true;
  if (!value || typeof value !== 'object') return false;
  const v = value as { metadata?: { extensions?: { custom_attributes?: { demo?: boolean } } }; finding_info?: { title?: string } };
  const isDemo = v?.metadata?.extensions?.custom_attributes?.demo === true;
  const title = v?.finding_info?.title || '';
  return isDemo && /Phishing email reported by/i.test(title);
};

/** Identify the demo Wazuh / Sliver implant follow-up incident. */
const isDemoWazuhIncident = (key: string, value: unknown): boolean => {
  // Cover both `-wazuh` (focus follow-up) and `demo-inc-malware-` keys
  // (buildDemoIncidentsBatch1) so old Sliver C2 incidents get cleaned up
  // before the new one lands.
  if (key.includes('-wazuh')) return true;
  if (key.startsWith('demo-inc-malware-')) return true;
  if (!value || typeof value !== 'object') return false;
  const v = value as { metadata?: { extensions?: { custom_attributes?: { demo?: boolean } } }; finding_info?: { title?: string } };
  const isDemo = v?.metadata?.extensions?.custom_attributes?.demo === true;
  const title = v?.finding_info?.title || '';
  return isDemo && /Sliver C2|implant beaconing/i.test(title);
};

// ─── IOC helpers ─────────────────────────────────────────────────────────────
// We want demo incidents to feature *real* IOCs from the user's threat feeds
// instead of made-up "example" values, so the IOC parser will (a) recognise
// them as known-bad and (b) link the incident to the actual STIX indicator.
//
// 1. `forceEnableDefaultThreatFeeds` writes the curated DEFAULT_THREAT_FEEDS
//    list into the threat-feeds datastore (no-op if already populated). This
//    causes the backend parser to start ingesting the feeds in the background.
// 2. `pickRandomIocs` reads `ioc_ip` / `ioc_domain` and picks one of each at
//    random. If the categories are empty (parser hasn't caught up yet) we
//    return undefined so the caller can fall back to static defaults.
// 3. The chosen pair is cached in localStorage so the Wazuh follow-up
//    incident reuses the exact same IP + domain → correlations match.

const readIocOverrides = (): DemoIocOverrides | null => {
  try {
    const raw = localStorage.getItem(DEMO_IOC_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) as DemoIocOverrides : null;
  } catch { return null; }
};
const writeIocOverrides = (overrides: DemoIocOverrides) => {
  try { localStorage.setItem(DEMO_IOC_OVERRIDES_KEY, JSON.stringify(overrides)); } catch { /* ignore */ }
};
const clearIocOverrides = () => {
  try { localStorage.removeItem(DEMO_IOC_OVERRIDES_KEY); } catch { /* ignore */ }
};

/** Label of the workflow that ingests the configured threat feeds. */
const THREAT_FEEDS_WORKFLOW_LABEL = 'Enable Threat feeds';
/** Session guard so we only kick the workflow once per demo run. */
const DEMO_THREAT_FEEDS_RAN_KEY = 'shuffle_demo_threat_feeds_workflow_ran';

/**
 * Look up "Enable Threat feeds" in the user's workflow list and POST
 * /execute. Fire-and-forget — used to populate the IOC datastores with
 * fresh entries shortly after we enable the feeds in the demo.
 */
const runEnableThreatFeedsWorkflow = async (): Promise<void> => {
  try {
    if (sessionStorage.getItem(DEMO_THREAT_FEEDS_RAN_KEY) === '1') return;
    const res = await fetch(getApiUrl('/api/v1/workflows'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return;
    const data = await res.json();
    const workflows = Array.isArray(data) ? data : (data?.workflows || []);
    const wf = workflows.find(
      (w: { name?: string }) => typeof w?.name === 'string' && w.name === THREAT_FEEDS_WORKFLOW_LABEL,
    );
    const wfId = (wf as { id?: string } | undefined)?.id;
    if (!wfId) return;
    await fetch(getApiUrl(`/api/v1/workflows/${wfId}/execute`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ execution_source: 'demo', start: '' }),
    });
    sessionStorage.setItem(DEMO_THREAT_FEEDS_RAN_KEY, '1');
  } catch (err) {
    console.warn('[demo] enable threat feeds workflow execute failed', err);
  }
};

/**
 * Ensure the user's threat feed list is populated with the curated defaults
 * AND that the "Enable Threat feeds" workflow has been kicked off so the
 * IOC datastores get freshly populated. Both steps are idempotent and
 * best-effort — failures are logged but never thrown.
 */
export const forceEnableDefaultThreatFeeds = async (): Promise<void> => {
  try {
    const existing = await getDatastoreByCategory(DATASTORE_CATEGORIES.THREAT_FEEDS);
    const alreadySeeded = existing.success && (existing.data?.length || 0) > 0;
    if (!alreadySeeded) {
      const items = DEFAULT_THREAT_FEEDS.map((feed: ThreatFeed) => ({
        key: feed.id,
        value: { ...feed, enabled: true },
      }));
      const res = await setDatastoreItems(items, DATASTORE_CATEGORIES.THREAT_FEEDS);
      if (!res.success) {
        console.warn('[demo] failed to seed default threat feeds', res.error);
      } else {
        broadcastRefresh(DATASTORE_CATEGORIES.THREAT_FEEDS);
      }
    }
    // Always (best-effort) run the workflow once per session so the IOC
    // categories get populated with fresh entries — even when the feed
    // list was already seeded by a previous session.
    void runEnableThreatFeedsWorkflow();
  } catch (err) {
    console.warn('[demo] forceEnableDefaultThreatFeeds error', err);
  }
};

const pickRandom = <T,>(arr: T[]): T | undefined => {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Static fallback pools used when the live `ioc_ip` / `ioc_domain` datastore
 * categories have not been populated yet (the threat-feed parser may take a
 * moment to catch up after we enable feeds at demo start). We still pick at
 * random so the demo gets some variety run-over-run.
 *
 * IPs are drawn from well-known abuse / TOR-exit ranges; domains follow
 * common phishing-lure naming patterns. Neither list is meant to be
 * authoritative — they exist purely so the demo never falls back to the
 * same static value twice in a row.
 */
const FALLBACK_IOC_IPS = [
  '185.220.101.47',
  '194.165.16.78',
  '45.137.21.134',
  '91.219.236.222',
  '103.232.86.14',
  '198.98.51.189',
  '141.98.10.63',
  '23.129.64.213',
];

const FALLBACK_IOC_DOMAINS = [
  'it-support-portal.live',
  'secure-login-helpdesk.com',
  'office365-verify.app',
  'onedrive-shared-doc.net',
  'mfa-reset-portal.cc',
  'corp-vpn-update.co',
  'docusign-review.click',
  'sharepoint-secure.cloud',
];

/**
 * Pick a random IP from `ioc_ip` and a random domain from `ioc_domain`.
 * If a category is empty (parser hasn't caught up yet), fall back to the
 * static pools above so the demo always gets some IOC variety.
 */
export const pickRandomIocs = async (): Promise<DemoIocOverrides> => {
  const out: DemoIocOverrides = {};
  try {
    const ipRes = await getDatastoreByCategory(IOC_IP_CATEGORY);
    const liveKeys = ipRes.success && ipRes.data
      ? ipRes.data.map(i => i.key).filter(Boolean)
      : [];
    const ipKey = pickRandom(liveKeys.length > 0 ? liveKeys : FALLBACK_IOC_IPS);
    if (ipKey) out.attackerIp = ipKey;
  } catch (err) {
    console.warn('[demo] pick ioc_ip failed', err);
    const ipKey = pickRandom(FALLBACK_IOC_IPS);
    if (ipKey) out.attackerIp = ipKey;
  }
  try {
    const domRes = await getDatastoreByCategory(IOC_DOMAIN_CATEGORY);
    const liveKeys = domRes.success && domRes.data
      ? domRes.data.map(i => i.key).filter(Boolean)
      : [];
    const domKey = pickRandom(liveKeys.length > 0 ? liveKeys : FALLBACK_IOC_DOMAINS);
    if (domKey) out.lureDomain = domKey;
  } catch (err) {
    console.warn('[demo] pick ioc_domain failed', err);
    const domKey = pickRandom(FALLBACK_IOC_DOMAINS);
    if (domKey) out.lureDomain = domKey;
  }
  return out;
};

/**
 * Resolve IOC overrides for the demo, preferring values cached at step 1 so
 * the focus + Wazuh incidents share the exact same IP/domain. Falls back to
 * a fresh pick if nothing is cached.
 */
const resolveIocOverrides = async (): Promise<DemoIocOverrides> => {
  const cached = readIocOverrides();
  if (cached?.attackerIp && cached?.lureDomain) return cached;
  const fresh = await pickRandomIocs();
  // Merge with whatever was cached (in case only one half resolved earlier).
  const merged: DemoIocOverrides = { ...cached, ...fresh };
  if (merged.attackerIp || merged.lureDomain) writeIocOverrides(merged);
  return merged;
};


/**
 * Demo enrichment scheduler.
 *
 * After a demo incident lands in the datastore, schedule the observables to
 * be added one-by-one in the background — exactly the way real Shuffle
 * enrichment runs after an incident is ingested. The first observable
 * shows up after a short delay, with each subsequent one a few seconds
 * later, so the user sees enrichments stream in on the timeline rather
 * than appearing pre-baked.
 *
 * Best-effort: any failure (incident not yet materialized via the webhook
 * pipeline, network blip, etc.) is logged and skipped — we never throw out
 * of a background timer.
 */
const FIRST_ENRICHMENT_DELAY_MS = 4000;
const ENRICHMENT_INTERVAL_MS = 3500;

// Kept for future use — no demo incident currently pre-bakes enrichments,
// but the helper stays available for any seeder that needs to drip observables
// onto a freshly-written incident over time.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const scheduleDemoObservableEnrichment = (
  key: string,
  observables: PendingObservable[],
): void => {
  if (!observables || observables.length === 0) return;

  observables.forEach((obs, idx) => {
    const delay = FIRST_ENRICHMENT_DELAY_MS + idx * ENRICHMENT_INTERVAL_MS;
    window.setTimeout(async () => {
      try {
        // Pull the latest incident state so we don't clobber edits the user
        // (or other background processes) made in the meantime.
        const fetched = await getDatastoreItem(key, DATASTORE_CATEGORIES.INCIDENTS);
        if (!fetched.success || !fetched.item) return;
        const raw = fetched.item.value;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') return;

        const seenAt = new Date().toISOString();
        const existingEnrichments = Array.isArray(parsed.enrichments) ? parsed.enrichments : [];
        // De-dupe on (type+value) so re-runs don't pile duplicates on.
        const alreadyPresent = existingEnrichments.some((e: { type?: string; value?: string }) =>
          e?.type === obs.type && e?.value === obs.value,
        );
        if (alreadyPresent) return;

        const updated = {
          ...parsed,
          last_seen_time: seenAt,
          enrichments: [
            ...existingEnrichments,
            { type: obs.type, value: obs.value, first_seen: seenAt, last_seen: seenAt },
          ],
        };

        const res = await setDatastoreItem(key, updated, DATASTORE_CATEGORIES.INCIDENTS);
        if (res.success) {
          broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);
        }
      } catch (err) {
        console.warn('[demo] background enrichment failed', { key, obs, err });
      }
    }, delay);
  });
};



// ─── Per-step seeders ────────────────────────────────────────────────────────
// Each returns the number of items written (or 0 if already seeded).

export const STEP_SEEDERS: Record<string, () => Promise<number>> = {
  // welcome — nothing
  welcome: async () => 0,

  // apps — no datastore writes; the user is just learning where to connect
  // tools. Real auth setup is intentionally not faked so cleanup stays simple.
  apps: async () => 0,

  // incidents list — seed ONLY the single "Phishing email reported by Diego
  // Ruiz" focus incident. The Wazuh / Sliver C2 follow-up arrives later once
  // the user is on the incident-detail step (see DemoCompletionWatcher), and
  // any other supporting incidents are seeded later still. We intentionally
  // do not drop the full batch here so the user is not overwhelmed on
  // arrival to /incidents.
  //
  // BACKGROUND: Force-enable the curated default threat feeds (no-op when
  // already populated) so the IOC parser starts ingesting real indicators
  // *before* the incident lands. We then try to pick a real IP + domain
  // from `ioc_ip` / `ioc_domain` so the incident's observables match known
  // IOCs out of the box — much more realistic than fake "example" values.
  'incidents-list': async () => {
    // Fire-and-forget: we don't want to block the UI on a feed write.
    void forceEnableDefaultThreatFeeds();
    // Dedup guard: the focus key embeds `now()` so a stale "already seeded"
    // marker (or a partially-failed previous run) would otherwise produce a
    // second "Phishing email reported by Diego Ruiz" with a different key.
    // The shared helper wipes both indexed keys AND any demo-tagged
    // incident on the server whose title matches — covering different
    // browsers / cleared storage / pipeline-renamed keys.
    await wipeExistingDemoIncidents(isDemoFocusIncident);

    // Try to pick real IOCs. If categories are empty (parser hasn't caught
    // up yet) the builder falls back to its static defaults.
    const overrides = await resolveIocOverrides();
    const item = buildDemoFocusIncident(overrides);
    const res = await setDatastoreItems([item], DATASTORE_CATEGORIES.INCIDENTS);
    if (!res.success) throw new Error(res.error || 'Failed to seed demo focus incident');
    recordSeed(DATASTORE_CATEGORIES.INCIDENTS, [item.key]);
    broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);
    // NOTE: The focus phishing incident intentionally lands WITHOUT any
    // background-trickled enrichments. Real Shuffle will surface observables
    // dynamically once it analyses the incident, and we want that flow to
    // feel organic instead of pre-baked by the demo.
    return 1;
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
      if (typeof item.key === 'string' && item.key.startsWith('demo-')) return true;
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
        if (typeof item.key === 'string' && item.key.startsWith('demo-')) return true;
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
  const key = await forceCreateSingleDemoIncidentReturningKey();
  return key ? 1 : 0;
};

/**
 * Same as `forceCreateSingleDemoIncident` but returns the freshly-written
 * datastore key so callers can navigate straight to it (used by
 * IncidentDetailPage's demo-aware "not found" recovery).
 */
export const forceCreateSingleDemoIncidentReturningKey = async (): Promise<string | null> => {
  // Wipe any prior focus incident so this stays a single, fresh item.
  // Uses the shared helper so duplicates can't slip in via a different
  // browser / cleared storage / pipeline-renamed key.
  await wipeExistingDemoIncidents(isDemoFocusIncident);

  // Same as the step seeder: ensure feeds are enabled and reuse / pick real IOCs.
  void forceEnableDefaultThreatFeeds();
  const overrides = await resolveIocOverrides();
  const item = buildDemoFocusIncident(overrides);
  const res = await setDatastoreItems([item], DATASTORE_CATEGORIES.INCIDENTS);
  if (!res.success) throw new Error(res.error || 'Failed to create demo focus incident');
  recordSeed(DATASTORE_CATEGORIES.INCIDENTS, [item.key]);
  broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);
  // The focus phishing incident lands "raw" — Shuffle will dynamically add
  // observables in the background once it analyses the incident.
  return item.key;
};

/**
 * Seed the follow-up Sliver C2 implant detection. Instead of writing the
 * incident directly to the datastore, this POSTs the OCSF payload to the
 * user's enabled "Ingestion Webhook" (set up in step #2 of the tour) — so
 * the incident actually flows through the real ingest pipeline they just
 * configured. Falls back to a direct datastore write if the webhook is not
 * available (e.g. the user disabled it).
 *
 * Idempotent on the wazuh key suffix — already-seeded calls are a no-op.
 * Returns the number of incidents written (0 or 1).
 */
export const seedDemoWazuhImplantIncident = async (): Promise<number> => {
  // Server-side dedup: skip seeding if a demo Wazuh / Sliver implant
  // incident already exists anywhere (local index OR backend), and wipe any
  // duplicates that crept in across sessions.
  try {
    const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.INCIDENTS);
    if (res.success && res.data) {
      const matches = res.data.filter(item =>
        isDemoWazuhIncident(typeof item.key === 'string' ? item.key : '', item.value),
      );
      if (matches.length > 0) {
        // Keep the first one, delete any extras to converge to a single copy.
        const extras = matches.slice(1);
        if (extras.length > 0) {
          await Promise.allSettled(
            extras.map(o => deleteDatastoreItem(o.key, DATASTORE_CATEGORIES.INCIDENTS)),
          );
        }
        return 0;
      }
    }
  } catch { /* best-effort — fall through to seed */ }

  // Reuse the same IOC overrides chosen at step 1 so the IP + domain on the
  // Wazuh follow-up are byte-identical to the focus incident — required for
  // the correlation engine to link them.
  const overrides = await resolveIocOverrides();
  const item = buildDemoWazuhImplantIncident(overrides);

  // Try to resolve the Ingestion Webhook URL from the user's workflows.
  let webhookUrl: string | null = null;
  try {
    const wfRes = await fetch(getApiUrl('/api/v1/workflows'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (wfRes.ok) {
      const workflows = await wfRes.json();
      if (Array.isArray(workflows)) {
        const webhookWorkflow = workflows.find((w: { name?: string }) => w?.name === 'Ingestion Webhook');
        const triggers = (webhookWorkflow?.triggers || []) as Array<{
          id?: string;
          trigger_id?: string;
          trigger_type?: string;
          app_name?: string;
          status?: string;
        }>;
        const webhookTrigger = triggers.find(t => t.trigger_type === 'WEBHOOK' || t.app_name === 'Webhook');
        const triggerStopped = !webhookTrigger || (webhookTrigger.status || '').toLowerCase() === 'stopped';
        const hookId = webhookTrigger?.id || webhookTrigger?.trigger_id;
        if (hookId && !triggerStopped) {
          webhookUrl = getApiUrl(`/api/v1/hooks/webhook_${hookId}`);
        }
      }
    }
  } catch { /* best-effort — fall through to datastore write */ }

  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.value),
      });
      if (res.ok) {
        // Record the key so cleanup still removes it once the pipeline
        // materializes it into the datastore.
        recordSeed(DATASTORE_CATEGORIES.INCIDENTS, [item.key]);
        broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);
        // Like the focus phishing incident, the Wazuh / Sliver follow-up
        // lands "raw" — Shuffle is what actually surfaces observables in
        // the background, so the demo no longer pre-bakes them.
        return 1;
      }
    } catch { /* fall through to datastore write */ }
  }

  // Fallback: webhook unavailable — write directly to the datastore.
  const res = await setDatastoreItems([item], DATASTORE_CATEGORIES.INCIDENTS);
  if (!res.success) throw new Error(res.error || 'Failed to seed Sliver implant incident');
  recordSeed(DATASTORE_CATEGORIES.INCIDENTS, [item.key]);
  broadcastRefresh(DATASTORE_CATEGORIES.INCIDENTS);
  // No pre-baked enrichments — Shuffle is responsible for surfacing
  // observables on the Wazuh / Sliver follow-up incident.
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
          // Primary signal: every demo key we write is prefixed with `demo-`
          // (e.g. demo-inc-login-…, demo-asset-…, demo-user-…). This is
          // reliable even when list_cache returns items without their full
          // value payload, where the metadata-tag check below silently misses.
          if (typeof item.key === 'string' && item.key.startsWith('demo-')) return true;
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

  // Restore the user's original "Ingest Tickets" apps (snapshotted at demo
  // start). Best-effort — never block cleanup on this.
  try {
    await restoreOriginalIngestTicketsApps();
  } catch (err) {
    console.warn('[demo] restore ingest tickets failed', err);
  }

  localStorage.removeItem(DEMO_FLAG_KEY);
  localStorage.removeItem(DEMO_ACTIVE_KEY);
  localStorage.removeItem(DEMO_SEEDED_STEPS_KEY);
  localStorage.removeItem('shuffle_demo_injected_apps');
  clearIocOverrides();
  try { sessionStorage.removeItem(DEMO_THREAT_FEEDS_RAN_KEY); } catch { /* ignore */ }

  return { success: failed === 0, deleted, failed };
};
