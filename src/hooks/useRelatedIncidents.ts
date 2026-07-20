/**
 * useRelatedIncidents — cross-loads incidents pointed to by
 * `related_incidents` on the current incident's raw payload.
 *
 * Returns:
 *   - `primary`: the primary side of a merge pair (when this incident is
 *     non-primary), or null.
 *   - `linked`:  incidents that point back to this incident as their
 *     primary (i.e. the ones merged INTO this one).
 *   - `invisibleCount`: number of pointers we could not resolve (deleted,
 *     multi-tenant permission mismatch, etc.).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getDatastoreItem,
  DATASTORE_CATEGORIES,
} from '@/Shuffle-MCPs/datastore';
import {
  getPrimaryPointer,
  getLinkedPointers,
  RelatedIncidentPointer,
} from '@/lib/incidentRelations';

export interface LinkedIncidentSummary {
  id: string;
  title: string;
  status?: string;
  status_id?: number;
  severity?: string;
  severity_id?: number;
  raw: any;
}

export interface UseRelatedIncidentsResult {
  primary: LinkedIncidentSummary | null;
  linked: LinkedIncidentSummary[];
  invisibleCount: number;
  loading: boolean;
  refresh: () => void;
}

const parseSummary = (id: string, value: string): LinkedIncidentSummary | null => {
  try {
    const raw = JSON.parse(value);
    const title =
      raw.title
      || raw.finding_info_list?.[0]?.title
      || raw.finding_info?.title
      || raw.message
      || id;
    return {
      id,
      title,
      status: raw.status,
      status_id: raw.status_id,
      severity: raw.severity,
      severity_id: raw.severity_id,
      raw,
    };
  } catch {
    return null;
  }
};

export const useRelatedIncidents = (
  incidentId: string | undefined,
  raw: any,
): UseRelatedIncidentsResult => {
  const [primary, setPrimary] = useState<LinkedIncidentSummary | null>(null);
  const [linked, setLinked] = useState<LinkedIncidentSummary[]>([]);
  const [invisibleCount, setInvisibleCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const cancelled = useRef(false);

  const primaryPtr = useMemo(() => getPrimaryPointer(raw), [raw]);
  const linkedPtrs = useMemo(() => getLinkedPointers(raw), [raw]);
  const pointerKey = useMemo(
    () => [primaryPtr?.id, ...linkedPtrs.map(p => p.id)].filter(Boolean).join('|'),
    [primaryPtr, linkedPtrs],
  );

  useEffect(() => {
    if (!incidentId) return;
    if (!primaryPtr && linkedPtrs.length === 0) {
      setPrimary(null);
      setLinked([]);
      setInvisibleCount(0);
      return;
    }
    cancelled.current = false;
    setLoading(true);
    let missed = 0;

    const load = async (ptr: RelatedIncidentPointer): Promise<LinkedIncidentSummary | null> => {
      try {
        const res = await getDatastoreItem(ptr.id, DATASTORE_CATEGORIES.INCIDENTS);
        if (!res.success || !res.item) {
          missed++;
          return null;
        }
        const s = parseSummary(ptr.id, res.item.value);
        if (!s) missed++;
        return s;
      } catch {
        missed++;
        return null;
      }
    };

    (async () => {
      const [primaryResult, linkedResults] = await Promise.all([
        primaryPtr ? load(primaryPtr) : Promise.resolve(null),
        Promise.all(linkedPtrs.map(load)),
      ]);
      if (cancelled.current) return;
      setPrimary(primaryResult);
      setLinked(linkedResults.filter((x): x is LinkedIncidentSummary => x !== null));
      setInvisibleCount(missed);
      setLoading(false);
    })();

    return () => {
      cancelled.current = true;
    };
  }, [incidentId, pointerKey, tick, primaryPtr, linkedPtrs]);

  return {
    primary,
    linked,
    invisibleCount,
    loading,
    refresh: () => setTick(t => t + 1),
  };
};
