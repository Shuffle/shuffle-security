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
 * Identity fields that MUST stay owned by the primary during a fold.
 * Without this list the source could overwrite the primary's title /
 * status / severity whenever it happens to carry a newer timestamp.
 */
const PRIMARY_IDENTITY_KEYS = [
  'id', 'finding_uid', 'uid',
  'title', 'message',
  'status', 'status_id',
  'severity', 'severity_id',
  'created_time', 'created_time_dt',
  'event_time', 'time', 'time_dt',
  'finding_info', 'finding_info_list',
  'assignee', 'product',
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

  // Fold the source's data (observables, correlations, activity, tasks,
  // email_thread, iocs, stakeholders, ...) into the primary BEFORE
  // writing. Identity fields on the primary are preserved. This is the
  // core of the merge overhaul: the primary keeps everything the source
  // contributed, so no data is lost when the analyst lands on it.
  const foldedPrimaryData = foldSourceIntoPrimary(primaryRaw, sourceRaw);
  const nextPrimary: any = upsertPointer(foldedPrimaryData, primaryPointer);
  // Track which sources have been folded, for debugging / repair tooling.
  const foldedFrom = Array.isArray(nextPrimary._merged_data_from) ? nextPrimary._merged_data_from : [];
  if (!foldedFrom.includes(sourceId)) {
    nextPrimary._merged_data_from = [...foldedFrom, sourceId];
  }
  // Attach an audit entry to the primary's activity so the timeline
  // shows the fold happened.
  const primaryActivity = Array.isArray(nextPrimary.activity) ? nextPrimary.activity : [];
  nextPrimary.activity = [
    ...primaryActivity,
    {
      id: `merge-in-${sourceId}-${now}`,
      type: 'system',
      user: linkedBy || 'System',
      timestamp: now,
      content: `Merged data from "${sourceTitle || sourceId}"`,
    },
  ];

  const nextSource: any = {
    ...upsertPointer(sourceRaw, sourcePointer),
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

  // Write both rows. If the second fails we leave the first in place —
  // the UI can detect a one-sided pointer and offer a repair button.
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
