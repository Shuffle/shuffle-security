/**
 * Cross-reference incident merging.
 *
 * Instead of destructively folding a source incident into a target (the
 * legacy `smartMerge` approach), we store a symmetric pointer array on
 * each side and cross-load the linked payloads at render time.
 *
 *   related_incidents: [
 *     { id, relation, primary, linked_at, linked_by, previous_status? }
 *   ]
 *
 * Non-primary incidents are flipped to `status_id: 6` ("Merged"). Their
 * detail page shows a "jump to primary" CTA. The primary's detail page
 * unions email threads / observables / activity from linked incidents.
 *
 * All writes stay on the frontend via `setDatastoreItem` — no backend
 * follow-pointer is required. New replies to either thread keep flowing
 * into their own incident (provider still overwrites by thread-id) and
 * simply appear in the union view.
 */

import {
  getDatastoreItem,
  setDatastoreItem,
  DATASTORE_CATEGORIES,
} from '@/Shuffle-MCPs/datastore';
import { statusConfig } from '@/config/incidentConfig';
import { deepMergeIncidents } from '@/lib/utils';

/**
 * Identity / user-editable fields that MUST stay owned by the primary
 * during a fold. These are things an analyst may have deliberately set
 * on the primary (title, severity, priority, assignee, description...)
 * — a later source folding in must NEVER overwrite them, even if the
 * source is more recent. Data fields (observables, correlations,
 * activity, tasks, iocs, stakeholders, email_thread, ...) are still
 * unioned by the deep merge and are intentionally NOT listed here.
 */
const PRIMARY_IDENTITY_KEYS = [
  // identity
  'id', 'finding_uid', 'uid',
  // headline / classification (all potentially user-edited)
  'title', 'message', 'description', 'summary',
  'status', 'status_id', 'status_detail',
  'severity', 'severity_id',
  'priority', 'priority_id',
  'confidence', 'confidence_id', 'confidence_score',
  'impact', 'impact_id', 'impact_score',
  'risk_level', 'risk_level_id', 'risk_score',
  // taxonomy
  'activity_name', 'activity_id',
  'category_name', 'category_uid',
  'class_name', 'class_uid',
  'type_name', 'type_uid',
  // times owned by the primary row
  'created_time', 'created_time_dt',
  'event_time', 'time', 'time_dt',
  // nested finding_info carries title/severity/etc.
  'finding_info', 'finding_info_list',
  // ownership / routing
  'assignee', 'assignee_id', 'owner', 'product',
  // merge bookkeeping
  'related_incidents', 'merged_into', 'merged_at',
];

const extractIncidentTs = (raw: any): number => {
  if (!raw || typeof raw !== 'object') return 0;
  const candidates: unknown[] = [
    raw.modified_time_dt, raw.updated_time_dt, raw.updated_at, raw.modified_at,
    raw.time_dt, raw.time, raw.event_time,
    raw.created_time_dt, raw.created_time, raw.created_at,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
      return c < 1e12 ? c * 1000 : c;
    }
    if (typeof c === 'string' && c) {
      const parsed = Date.parse(c);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 0;
};

/**
 * Non-destructively fold the source's *data* fields (observables,
 * correlations, activity, tasks, email_thread, iocs, stakeholders,
 * labels, references, custom_attributes, ...) INTO the primary while
 * preserving the primary's identity. This is what keeps timelines,
 * observables and correlations intact after an auto-merge: the primary
 * row becomes the union of every merged sibling.
 */
const foldSourceIntoPrimary = (primaryRaw: any, sourceRaw: any): any => {
  const pTs = extractIncidentTs(primaryRaw);
  const sTs = extractIncidentTs(sourceRaw);
  const folded: any = deepMergeIncidents(
    primaryRaw || {},
    sourceRaw || {},
    pTs,
    sTs,
  );
  for (const key of PRIMARY_IDENTITY_KEYS) {
    if (primaryRaw && Object.prototype.hasOwnProperty.call(primaryRaw, key)) {
      folded[key] = primaryRaw[key];
    } else {
      delete folded[key];
    }
  }
  return folded;
};


export type IncidentRelation = 'merged' | 'duplicate' | 'related';

export interface RelatedIncidentPointer {
  id: string;
  relation: IncidentRelation;
  /**
   * True when the *pointed-at* incident is the primary of the pair (i.e.
   * "this pointer takes you to the primary"). Exactly one side of a
   * merge pair carries `primary: true`.
   */
  primary: boolean;
  linked_at: number;
  linked_by?: string;
  /** Stashed on the non-primary side so unmerge can restore prior status. */
  previous_status?: string;
  previous_status_id?: number;
}

const MERGED_STATUS_ID = statusConfig.merged?.id ?? 6;
const MERGED_STATUS_LABEL = statusConfig.merged?.label ?? 'Merged';

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export const getRelatedIncidents = (raw: any): RelatedIncidentPointer[] => {
  if (!raw || typeof raw !== 'object') return [];
  const arr = raw.related_incidents;
  if (!Array.isArray(arr)) return [];
  return arr.filter((p): p is RelatedIncidentPointer =>
    p && typeof p.id === 'string' && typeof p.relation === 'string');
};

/** True when this incident is the non-primary side of a merge pair. */
export const isMergedIncident = (raw: any): boolean => {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.status_id === MERGED_STATUS_ID) return true;
  // Legacy tombstones from the old destructive smartMerge writer.
  if (raw.status_id === 99) return true;
  if (raw.merged_into) return true;
  return getRelatedIncidents(raw).some(p => p.relation === 'merged' && p.primary);
};

/** Returns the pointer that leads to the primary, or null if this is the primary. */
export const getPrimaryPointer = (raw: any): RelatedIncidentPointer | null => {
  const pointers = getRelatedIncidents(raw);
  return pointers.find(p => p.relation === 'merged' && p.primary) || null;
};

/** Returns pointers to the non-primary linked incidents (this incident is primary). */
export const getLinkedPointers = (raw: any): RelatedIncidentPointer[] => {
  return getRelatedIncidents(raw).filter(p => p.relation === 'merged' && !p.primary);
};

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

const upsertPointer = (
  raw: any,
  pointer: RelatedIncidentPointer,
): any => {
  const next = { ...(raw || {}) };
  const existing = getRelatedIncidents(next);
  const filtered = existing.filter(p => p.id !== pointer.id);
  next.related_incidents = [...filtered, pointer];
  return next;
};

const removePointer = (raw: any, targetId: string): any => {
  const next = { ...(raw || {}) };
  const existing = getRelatedIncidents(next);
  next.related_incidents = existing.filter(p => p.id !== targetId);
  return next;
};

interface LinkArgs {
  /** The incident chosen as the merge target (becomes primary). */
  primaryId: string;
  primaryRaw: any;
  primaryTitle?: string;
  /** The incident being merged (becomes non-primary, flipped to Merged). */
  sourceId: string;
  sourceRaw: any;
  sourceTitle?: string;
  linkedBy?: string;
}

/**
 * Link two incidents as a merge pair. Writes two datastore rows:
 *   primary  <- adds { id: source,  primary: false }
 *   source   <- adds { id: primary, primary: true } + status_id = merged
 *
 * Returns { success, error } — on partial failure the UI should surface a
 * repair action.
 */
export const linkMergePair = async ({
  primaryId,
  primaryRaw,
  primaryTitle,
  sourceId,
  sourceRaw,
  sourceTitle,
  linkedBy,
}: LinkArgs): Promise<{ success: boolean; error?: string; foldedPrimary?: any }> => {
  const now = Date.now();

  // Snapshot the source's current status so unmerge can restore it.
  const prevStatus: string | undefined =
    typeof sourceRaw?.status === 'string' ? sourceRaw.status : undefined;
  const prevStatusId: number | undefined =
    typeof sourceRaw?.status_id === 'number' && sourceRaw.status_id !== MERGED_STATUS_ID
      ? sourceRaw.status_id
      : undefined;

  // Primary side — points at source, not primary itself.
  const primaryPointer: RelatedIncidentPointer = {
    id: sourceId,
    relation: 'merged',
    primary: false,
    linked_at: now,
    linked_by: linkedBy,
  };
  // Source side — points at primary, IS primary.
  const sourcePointer: RelatedIncidentPointer = {
    id: primaryId,
    relation: 'merged',
    primary: true,
    linked_at: now,
    linked_by: linkedBy,
    previous_status: prevStatus,
    previous_status_id: prevStatusId,
  };

  // If the source was itself the primary of a prior merge, it already
  // owns a set of transitively-linked children. Re-parent them to the
  // NEW primary so the chain flattens instead of forming A -> B -> C.
  const transitiveChildPointers = getRelatedIncidents(sourceRaw)
    .filter(p => p.relation === 'merged' && !p.primary && p.id !== primaryId);
  const childRaws: Array<{ id: string; raw: any; pointer: RelatedIncidentPointer }> = [];
  for (const cp of transitiveChildPointers) {
    try {
      const r = await getDatastoreItem(cp.id, DATASTORE_CATEGORIES.INCIDENTS);
      if (r.success && r.item) {
        childRaws.push({ id: cp.id, raw: JSON.parse(r.item.value), pointer: cp });
      }
    } catch { /* non-fatal — child stays parented to source, repairable */ }
  }

  // Fold the source's data (observables, correlations, activity, tasks,
  // email_thread, iocs, stakeholders, ...) into the primary BEFORE
  // writing. Identity fields on the primary are preserved. This is the
  // core of the merge overhaul: the primary keeps everything the source
  // (and its transitive children) contributed.
  let foldedPrimaryData: any = foldSourceIntoPrimary(primaryRaw, sourceRaw);
  for (const c of childRaws) {
    foldedPrimaryData = foldSourceIntoPrimary(foldedPrimaryData, c.raw);
  }

  let nextPrimary: any = upsertPointer(foldedPrimaryData, primaryPointer);
  // Also add direct pointers to every re-parented grandchild so the
  // primary lists them alongside the source in the Correlations tab.
  for (const c of childRaws) {
    nextPrimary = upsertPointer(nextPrimary, {
      id: c.id,
      relation: 'merged',
      primary: false,
      linked_at: now,
      linked_by: linkedBy || 'chain-reparent',
    });
  }
  // Track which sources have been folded, for debugging / repair tooling.
  const foldedFrom = Array.isArray(nextPrimary._merged_data_from) ? nextPrimary._merged_data_from : [];
  const foldedSet = new Set<string>(foldedFrom);
  foldedSet.add(sourceId);
  childRaws.forEach(c => foldedSet.add(c.id));
  nextPrimary._merged_data_from = Array.from(foldedSet);

  // Attach a single audit entry summarising the fold.
  const primaryActivity = Array.isArray(nextPrimary.activity) ? nextPrimary.activity : [];
  const foldedLabel = childRaws.length > 0
    ? `Merged data from "${sourceTitle || sourceId}" (+${childRaws.length} chained)`
    : `Merged data from "${sourceTitle || sourceId}"`;
  nextPrimary.activity = [
    ...primaryActivity,
    {
      id: `merge-in-${sourceId}-${now}`,
      type: 'system',
      user: linkedBy || 'System',
      timestamp: now,
      content: foldedLabel,
    },
  ];

  // The source now points at the new primary and drops its own children
  // pointers (they belong to the new primary now).
  let nextSource: any = upsertPointer(sourceRaw, sourcePointer);
  for (const c of childRaws) {
    nextSource = removePointer(nextSource, c.id);
  }
  nextSource = {
    ...nextSource,
    status_id: MERGED_STATUS_ID,
    status: MERGED_STATUS_LABEL,
    merged_into: primaryId,           // legacy field for backwards compat
    merged_at: now,
  };

  // Attach a marker activity entry to the source for audit trail.
  const sourceActivity = Array.isArray(nextSource.activity) ? nextSource.activity : [];
  nextSource.activity = [
    ...sourceActivity,
    {
      id: `merge-${now}`,
      type: 'system',
      user: linkedBy || 'System',
      timestamp: now,
      content: `Merged into "${primaryTitle || primaryId}"`,
    },
  ];

  // Write primary + source first. Grandchild re-parenting is best-effort:
  // if it fails, the child stays pointing at the old source, which itself
  // now points at the new primary — the "Open primary" CTA still resolves
  // correctly, just via one extra hop until a repair pass runs.
  const r1 = await setDatastoreItem(
    primaryId,
    JSON.stringify(nextPrimary),
    DATASTORE_CATEGORIES.INCIDENTS,
  );
  if (!r1.success) return { success: false, error: r1.error || 'Failed to update primary' };

  const r2 = await setDatastoreItem(
    sourceId,
    JSON.stringify(nextSource),
    DATASTORE_CATEGORIES.INCIDENTS,
  );
  if (!r2.success) return { success: false, error: r2.error || 'Failed to update source' };

  // Re-parent each grandchild: drop pointer to source, add pointer to
  // new primary. Errors are non-fatal.
  for (const c of childRaws) {
    try {
      let rehomed: any = removePointer(c.raw, sourceId);
      rehomed = upsertPointer(rehomed, {
        id: primaryId,
        relation: 'merged',
        primary: true,
        linked_at: now,
        linked_by: linkedBy || 'chain-reparent',
        previous_status: c.pointer.previous_status,
        previous_status_id: c.pointer.previous_status_id,
      });
      rehomed.merged_into = primaryId;
      rehomed.merged_at = now;
      rehomed.status_id = MERGED_STATUS_ID;
      rehomed.status = MERGED_STATUS_LABEL;
      await setDatastoreItem(
        c.id,
        JSON.stringify(rehomed),
        DATASTORE_CATEGORIES.INCIDENTS,
      );
    } catch { /* leave the old pointer; the primary chain still resolves */ }
  }

  return { success: true, foldedPrimary: nextPrimary };
};



interface UnlinkArgs {
  primaryId: string;
  sourceId: string;
  unlinkedBy?: string;
}

/**
 * Remove the merge link between two incidents. Symmetric — clears the
 * pointer on both sides and restores the non-primary's prior status.
 */
export const unlinkMergePair = async ({
  primaryId,
  sourceId,
  unlinkedBy,
}: UnlinkArgs): Promise<{ success: boolean; error?: string }> => {
  const [primaryRes, sourceRes] = await Promise.all([
    getDatastoreItem(primaryId, DATASTORE_CATEGORIES.INCIDENTS),
    getDatastoreItem(sourceId, DATASTORE_CATEGORIES.INCIDENTS),
  ]);
  if (!primaryRes.success || !primaryRes.item) {
    return { success: false, error: 'Primary incident not found' };
  }
  if (!sourceRes.success || !sourceRes.item) {
    return { success: false, error: 'Merged incident not found' };
  }

  let primaryRaw: any;
  let sourceRaw: any;
  try {
    primaryRaw = JSON.parse(primaryRes.item.value);
    sourceRaw = JSON.parse(sourceRes.item.value);
  } catch (e) {
    return { success: false, error: 'Failed to parse incident payloads' };
  }

  const sourcePointer = getPrimaryPointer(sourceRaw);
  const prevStatusId = sourcePointer?.previous_status_id;
  const prevStatus = sourcePointer?.previous_status;

  const nextPrimary = removePointer(primaryRaw, sourceId);
  const nextSource: any = removePointer(sourceRaw, primaryId);
  // Restore the source's previous status. If none was recorded, fall back
  // to "new" — never leave an incident stuck in Merged after unlink.
  nextSource.status_id = typeof prevStatusId === 'number' ? prevStatusId : 1;
  nextSource.status = prevStatus || 'New';
  delete nextSource.merged_into;
  delete nextSource.merged_at;

  const now = Date.now();
  const activity = Array.isArray(nextSource.activity) ? nextSource.activity : [];
  nextSource.activity = [
    ...activity,
    {
      id: `unmerge-${now}`,
      type: 'system',
      user: unlinkedBy || 'System',
      timestamp: now,
      content: `Unmerged from "${primaryId}"`,
    },
  ];

  const r1 = await setDatastoreItem(
    primaryId,
    JSON.stringify(nextPrimary),
    DATASTORE_CATEGORIES.INCIDENTS,
  );
  if (!r1.success) return { success: false, error: r1.error || 'Failed to update primary' };
  const r2 = await setDatastoreItem(
    sourceId,
    JSON.stringify(nextSource),
    DATASTORE_CATEGORIES.INCIDENTS,
  );
  if (!r2.success) return { success: false, error: r2.error || 'Failed to update merged incident' };
  return { success: true };
};

// ---------------------------------------------------------------------------
// Lazy migration for legacy tombstones (smartMerge era)
// ---------------------------------------------------------------------------

/**
 * When a raw payload has the legacy `merged_into` field but no
 * `related_incidents` pointer, synthesize the pointer pair and flip the
 * legacy status_id 99 to the new merged id. Runs once on incident load;
 * writes only when a change is actually needed.
 */
export const maybeMigrateLegacyMerge = async (
  incidentId: string,
  raw: any,
): Promise<boolean> => {
  if (!raw || typeof raw !== 'object') return false;
  const legacyPrimary: string | undefined = raw.merged_into;
  if (!legacyPrimary) return false;
  const alreadyMigrated = getPrimaryPointer(raw);
  if (alreadyMigrated && raw.status_id === MERGED_STATUS_ID) return false;

  const pointer: RelatedIncidentPointer = {
    id: legacyPrimary,
    relation: 'merged',
    primary: true,
    linked_at: raw.merged_at || Date.now(),
    linked_by: 'legacy-migration',
  };
  const nextSource = {
    ...upsertPointer(raw, pointer),
    status_id: MERGED_STATUS_ID,
    status: MERGED_STATUS_LABEL,
  };
  await setDatastoreItem(
    incidentId,
    JSON.stringify(nextSource),
    DATASTORE_CATEGORIES.INCIDENTS,
  );

  // Best-effort back-fill on the primary side too. Non-fatal if it fails
  // (e.g. permissions in multi-tenant), the incident detail still works.
  try {
    const primaryRes = await getDatastoreItem(
      legacyPrimary,
      DATASTORE_CATEGORIES.INCIDENTS,
    );
    if (primaryRes.success && primaryRes.item) {
      const primaryRaw = JSON.parse(primaryRes.item.value);
      const already = getRelatedIncidents(primaryRaw).some(p => p.id === incidentId);
      if (!already) {
        const nextPrimary = upsertPointer(primaryRaw, {
          id: incidentId,
          relation: 'merged',
          primary: false,
          linked_at: raw.merged_at || Date.now(),
          linked_by: 'legacy-migration',
        });
        await setDatastoreItem(
          legacyPrimary,
          JSON.stringify(nextPrimary),
          DATASTORE_CATEGORIES.INCIDENTS,
        );
      }
    }
  } catch {
    /* ignore */
  }
  return true;
};

export { MERGED_STATUS_ID, MERGED_STATUS_LABEL };

// ---------------------------------------------------------------------------
// Relation-safe writes + revision-based reconciliation
// ---------------------------------------------------------------------------

/**
 * Fields that describe the merge relationship. They MUST survive any write
 * to an incident row, because they are what wires primary <-> child. If a
 * caller overwrites the row with a stale copy that doesn't carry these,
 * the union is silently lost (parent forgets its children).
 */
const RELATION_FIELDS = [
  'related_incidents',
  '_merged_data_from',
  'merged_into',
  'merged_at',
] as const;

/**
 * Union two related_incidents arrays by pointer id. Later linked_at wins
 * on duplicates, and a `primary: true` entry always beats a false one for
 * the same id (child->primary direction must stick).
 */
const unionPointers = (
  a: RelatedIncidentPointer[] = [],
  b: RelatedIncidentPointer[] = [],
): RelatedIncidentPointer[] => {
  const byId = new Map<string, RelatedIncidentPointer>();
  for (const p of [...a, ...b]) {
    if (!p || typeof p.id !== 'string') continue;
    const prev = byId.get(p.id);
    if (!prev) { byId.set(p.id, p); continue; }
    const preferPrimary = p.primary && !prev.primary ? p
      : (!p.primary && prev.primary ? prev : null);
    if (preferPrimary) { byId.set(p.id, preferPrimary); continue; }
    byId.set(p.id, (p.linked_at || 0) >= (prev.linked_at || 0) ? p : prev);
  }
  return Array.from(byId.values());
};

/**
 * Merge the relation fields from `existing` into `next` so a caller who
 * built `next` from a stale snapshot can't drop pointers. Returns the
 * hardened payload — never mutates inputs.
 */
export const preserveRelationFields = (existing: any, next: any): any => {
  const out: any = { ...(next || {}) };
  if (!existing || typeof existing !== 'object') return out;

  const merged = unionPointers(
    getRelatedIncidents(existing),
    getRelatedIncidents(out),
  );
  if (merged.length > 0) out.related_incidents = merged;

  const existingFolded = Array.isArray(existing._merged_data_from) ? existing._merged_data_from : [];
  const nextFolded = Array.isArray(out._merged_data_from) ? out._merged_data_from : [];
  if (existingFolded.length || nextFolded.length) {
    out._merged_data_from = Array.from(new Set<string>([...existingFolded, ...nextFolded]));
  }

  // Preserve tombstone fields if the row was a non-primary side. Never
  // resurrect them if the caller explicitly cleared them (unmerge path
  // sets status back and deletes merged_into) — detect that by checking
  // whether the caller kept status_id === MERGED_STATUS_ID.
  if (out.status_id === MERGED_STATUS_ID || existing.status_id === MERGED_STATUS_ID) {
    if (!out.merged_into && existing.merged_into) out.merged_into = existing.merged_into;
    if (!out.merged_at && existing.merged_at) out.merged_at = existing.merged_at;
  }
  return out;
};

/**
 * Safe writer for incident rows. Re-fetches the current stored payload,
 * unions the merge-relation fields onto the caller's `nextRaw`, then
 * writes. Every code path that persists an incident SHOULD go through
 * this — bare `setDatastoreItem(..., INCIDENTS, ...)` is a footgun.
 *
 * Accepts either an object or a JSON string (mirrors setDatastoreItem).
 * Returns the same shape as setDatastoreItem.
 */
export const writeIncidentSafe = async (
  id: string,
  nextRaw: any,
  orgId?: string,
): Promise<{ success: boolean; error?: string }> => {
  let nextObj: any = nextRaw;
  if (typeof nextRaw === 'string') {
    try { nextObj = JSON.parse(nextRaw); } catch { nextObj = {}; }
  }
  let existing: any = null;
  try {
    const res = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS, orgId);
    if (res.success && res.item?.value) {
      existing = JSON.parse(res.item.value);
    }
  } catch { /* first write, nothing to preserve */ }

  const hardened = preserveRelationFields(existing, nextObj);
  return setDatastoreItem(
    id,
    JSON.stringify(hardened),
    DATASTORE_CATEGORIES.INCIDENTS,
    orgId,
  );
};

/**
 * Reconcile `related_incidents` from a list of prior revisions. If a
 * previous revision recorded a pointer that is missing from `currentRaw`,
 * bring it back. Also unions `_merged_data_from`. Returns the reconciled
 * payload and whether anything actually changed.
 */
export const reconcileRelatedFromRevisions = (
  currentRaw: any,
  revisions: any[],
): { raw: any; changed: boolean } => {
  if (!currentRaw || typeof currentRaw !== 'object' || !Array.isArray(revisions) || revisions.length === 0) {
    return { raw: currentRaw, changed: false };
  }
  const currentPointers = getRelatedIncidents(currentRaw);
  const currentFolded = new Set<string>(
    Array.isArray(currentRaw._merged_data_from) ? currentRaw._merged_data_from : [],
  );

  const revPointers: RelatedIncidentPointer[] = [];
  const revFolded = new Set<string>();
  for (const rev of revisions) {
    // Revisions may nest the payload under .value / .data / .body — try
    // each shape leniently.
    const candidates = [rev?.value, rev?.data, rev?.body, rev];
    for (const c of candidates) {
      let obj: any = c;
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch { continue; }
      }
      if (!obj || typeof obj !== 'object') continue;
      const ptrs = getRelatedIncidents(obj);
      for (const p of ptrs) revPointers.push(p);
      if (Array.isArray(obj._merged_data_from)) {
        for (const x of obj._merged_data_from) revFolded.add(x);
      }
      break;
    }
  }

  const merged = unionPointers(currentPointers, revPointers);
  const foldedUnion = new Set<string>([...currentFolded, ...revFolded]);

  const pointersChanged =
    merged.length !== currentPointers.length ||
    merged.some(p => !currentPointers.find(cp => cp.id === p.id && cp.primary === p.primary));
  const foldedChanged = foldedUnion.size !== currentFolded.size;

  if (!pointersChanged && !foldedChanged) return { raw: currentRaw, changed: false };

  const next: any = { ...currentRaw };
  if (merged.length > 0) next.related_incidents = merged;
  if (foldedUnion.size > 0) next._merged_data_from = Array.from(foldedUnion);
  return { raw: next, changed: true };
};
