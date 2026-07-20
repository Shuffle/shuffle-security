/**
 * useThreadCorrelatedIncidents — when the current incident carries a
 * `thread_id` value, we assume every other incident sharing that value is
 * part of the same conversation and should be pulled in.
 *
 * Resolution:
 *   1. Extract thread_id from the raw OCSF payload (top-level or nested
 *      email metadata locations).
 *   2. Ask /api/v2/correlations with `{ type: 'value', key: thread_id }`
 *      to find every datastore ref that mentions that value.
 *   3. Extract incident IDs from the returned refs, drop the current one,
 *      and cross-load each via the incidents datastore.
 *
 * Read-only — no writes to either side. Renders alongside the manual
 * merge-pointer banner so analysts can see automatic thread grouping
 * without collapsing the records.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getDatastoreItem,
  DATASTORE_CATEGORIES,
} from '@/Shuffle-MCPs/datastore';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

import type { LinkedIncidentSummary } from '@/hooks/useRelatedIncidents';

export interface UseThreadCorrelatedIncidentsResult {
  threadId: string | null;
  incidents: LinkedIncidentSummary[];
  invisibleCount: number;
  loading: boolean;
  refresh: () => void;
}

/**
 * Pull a thread_id out of a raw OCSF payload. Providers put it in a few
 * different places; check the common ones and normalise to a string.
 */
export const extractThreadId = (raw: any): string | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidates: unknown[] = [
    raw.thread_id,
    raw.threadId,
    raw.email?.thread_id,
    raw.email?.threadId,
    raw.unmapped?.thread_id,
    raw.unmapped_original?.thread_id,
    raw.metadata?.thread_id,
    raw.metadata?.extensions?.custom_attributes?.thread_id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number') return String(c);
  }
  return null;
};

/** Refs come back as "prefix|id" or "path/id". Grab the trailing id. */
const refToIncidentId = (ref: string): string => {
  if (!ref) return '';
  if (ref.includes('|')) return ref.split('|').pop() || '';
  if (ref.includes('/')) return ref.split('/').pop() || '';
  return ref;
};

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

export const useThreadCorrelatedIncidents = (
  incidentId: string | undefined,
  raw: any,
  crossOrgHeaders: Record<string, string> = {},
): UseThreadCorrelatedIncidentsResult => {
  const threadId = useMemo(() => extractThreadId(raw), [raw]);


  const [incidents, setIncidents] = useState<LinkedIncidentSummary[]>([]);
  const [invisibleCount, setInvisibleCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!incidentId || !threadId) {
      setIncidents([]);
      setInvisibleCount(0);
      return;
    }
    cancelled.current = false;
    setLoading(true);

    (async () => {
      let missed = 0;
      const foundIds = new Set<string>();
      try {
        const resp = await fetch(getApiUrl('/api/v2/correlations'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
            ...crossOrgHeaders,
          },
          body: JSON.stringify({ type: 'value', key: String(threadId).toLowerCase() }),
        });
        if (!resp.ok) {
          if (!cancelled.current) {
            setIncidents([]);
            setInvisibleCount(0);
            setLoading(false);
          }
          return;
        }
        const data = await resp.json();
        const corrData = Array.isArray(data) ? data : (data.correlations || data.data || []);
        const currentLower = incidentId.toLowerCase();
        for (const c of corrData) {
          const refs = Array.isArray(c?.ref) ? c.ref : [];
          for (const r of refs) {
            const rid = refToIncidentId(String(r));
            if (!rid) continue;
            if (rid.toLowerCase() === currentLower) continue;
            foundIds.add(rid);
          }
        }
      } catch (err) {
        if (!cancelled.current) {
          setIncidents([]);
          setInvisibleCount(0);
          setLoading(false);
        }
        return;
      }

      const results = await Promise.all(
        Array.from(foundIds).map(async (rid) => {
          try {
            const res = await getDatastoreItem(rid, DATASTORE_CATEGORIES.INCIDENTS);
            if (!res.success || !res.item) {
              missed++;
              return null;
            }
            const s = parseSummary(rid, res.item.value);
            if (!s) missed++;
            return s;
          } catch {
            missed++;
            return null;
          }
        }),
      );

      if (cancelled.current) return;
      setIncidents(results.filter((x): x is LinkedIncidentSummary => x !== null));
      setInvisibleCount(missed);
      setLoading(false);
    })();

    return () => {
      cancelled.current = true;
    };
    // crossOrgHeaders is stable enough per-render; re-run only on identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, threadId, tick]);

  return {
    threadId,
    incidents,
    invisibleCount,
    loading,
    refresh: () => setTick(t => t + 1),
  };
};
