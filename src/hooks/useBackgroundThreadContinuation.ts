/**
 * useBackgroundThreadContinuation — silently keeps existing merge threads
 * on the /incidents list up to date.
 *
 * Rule of engagement:
 *   1. Only act on incidents that ALREADY have merges under them
 *      (i.e. `getLinkedPointers(raw).length > 0`). We never initiate a
 *      brand-new thread here — that is still the detail page's job. This
 *      keeps the list-page work bounded even in noisy tenants.
 *   2. For each such "thread primary" that carries a `thread_id`, ask
 *      /api/v2/correlations for every incident referencing that value,
 *      subtract the ones already merged/linked, and fold the remainder
 *      into the primary via linkMergePair. This is exactly what the
 *      detail page does — reused so the UX stays consistent.
 *   3. Runs behind the org's "Auto Merge Thread" preference. Rate-limits
 *      to one primary per tick, remembers processed threads per session
 *      to avoid re-hitting the correlation endpoint in a loop.
 */

import { useEffect, useRef, useState } from 'react';
import { linkMergePair, getLinkedPointers, isMergedIncident, getPrimaryPointer } from '@/lib/incidentRelations';
import { useAutoMergeThread } from '@/hooks/useEntityLabel';
import { extractThreadId } from '@/hooks/useThreadCorrelatedIncidents';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { getDatastoreItem, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';

interface IncidentListItem {
  id: string;
  rawOCSF?: any;
  createdTs?: number;
  title?: string;
}

const refToIncidentId = (ref: string): string => {
  if (!ref) return '';
  if (ref.includes('|')) return ref.split('|').pop() || '';
  if (ref.includes('/')) return ref.split('/').pop() || '';
  return ref;
};

const readTs = (raw: any): number => {
  if (!raw) return 0;
  const cs = [raw.time, raw.event_time, raw.created_time_dt, raw.created_time, raw.created_at];
  for (const c of cs) {
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) return c < 1e12 ? c * 1000 : c;
    if (typeof c === 'string' && c) {
      const p = Date.parse(c);
      if (Number.isFinite(p) && p > 0) return p;
    }
  }
  return 0;
};

export const useBackgroundThreadContinuation = (
  incidents: IncidentListItem[],
  onDidMerge?: () => void,
): { busy: boolean } => {
  const enabled = useAutoMergeThread();
  const processedRef = useRef<Set<string>>(new Set());
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (busyRef.current) return;
    if (!incidents || incidents.length === 0) return;

    // Find the next thread primary that (a) has an existing thread of
    // merges and (b) carries a thread_id and (c) hasn't been checked yet.
    const candidate = incidents.find((inc) => {
      const raw = inc.rawOCSF;
      if (!raw) return false;
      if (isMergedIncident(raw)) return false;         // it's a non-primary side
      if (getPrimaryPointer(raw)) return false;         // ditto
      if (getLinkedPointers(raw).length === 0) return false; // not a thread primary yet
      const tid = extractThreadId(raw);
      if (!tid) return false;
      const key = `${tid}:${inc.id}`;
      if (processedRef.current.has(key)) return false;
      return true;
    });
    if (!candidate) return;

    const raw = candidate.rawOCSF;
    const threadId = extractThreadId(raw)!;
    const key = `${threadId}:${candidate.id}`;
    processedRef.current.add(key);
    busyRef.current = true;
    setBusy(true);



    (async () => {
      try {
        const resp = await fetch(getApiUrl('/api/v2/correlations'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ type: 'value', key: String(threadId).toLowerCase() }),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const corrData = Array.isArray(data) ? data : (data.correlations || data.data || []);

        // Collect sibling ids from correlation refs, minus incidents
        // already merged under this primary and minus the primary itself.
        const alreadyLinked = new Set<string>(
          getLinkedPointers(raw).map((p) => p.id.toLowerCase()),
        );
        alreadyLinked.add(candidate.id.toLowerCase());
        const siblingIds = new Set<string>();
        for (const c of corrData) {
          const refs = Array.isArray(c?.ref) ? c.ref : [];
          for (const r of refs) {
            const rid = refToIncidentId(String(r));
            if (!rid) continue;
            if (alreadyLinked.has(rid.toLowerCase())) continue;
            siblingIds.add(rid);
          }
        }
        if (siblingIds.size === 0) return;

        // Cross-load each sibling and skip any already in a merged state.
        const siblings: Array<{ id: string; raw: any; title: string }> = [];
        for (const sid of siblingIds) {
          try {
            const res = await getDatastoreItem(sid, DATASTORE_CATEGORIES.INCIDENTS);
            if (!res.success || !res.item) continue;
            const sRaw = JSON.parse(res.item.value);
            if (isMergedIncident(sRaw)) continue;
            const title =
              sRaw.title
              || sRaw.finding_info_list?.[0]?.title
              || sRaw.finding_info?.title
              || sid;
            siblings.push({ id: sid, raw: sRaw, title });
          } catch { /* skip */ }
        }
        if (siblings.length === 0) return;

        // Retain the primary that already anchors the thread — do not
        // reshuffle timestamps here. Fold each sibling into it.
        let currentPrimaryRaw = raw;
        const primaryTitle = raw?.title || raw?.finding_info_list?.[0]?.title || candidate.id;
        let merged = 0;
        for (const src of siblings) {
          const res = await linkMergePair({
            primaryId: candidate.id,
            primaryRaw: currentPrimaryRaw,
            primaryTitle,
            sourceId: src.id,
            sourceRaw: src.raw,
            sourceTitle: src.title,
            linkedBy: 'thread-auto-merge-list',
          });
          if (res.success) {
            merged += 1;
            if (res.foldedPrimary) currentPrimaryRaw = res.foldedPrimary;
          }
        }
        if (merged > 0) onDidMerge?.();
      } catch { /* silent */ } finally {
        busyRef.current = false;
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, incidents]);

  return { busy };
};
