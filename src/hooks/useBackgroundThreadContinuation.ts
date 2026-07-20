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

// How long we skip re-checking a given (thread, primary) after processing
// it. Short enough that newly-arrived siblings on later list refreshes get
// picked up; long enough that we don't spam /correlations on every
// re-render or poll.
const CHECK_COOLDOWN_MS = 20_000;

interface CheckRecord {
  at: number;
  /**
   * Number of already-linked pointers we saw last time. If the primary
   * grows new links (someone opened a sibling and merged), we invalidate
   * the cooldown so background continuation picks up the rest.
   */
  linked: number;
}

export const useBackgroundThreadContinuation = (
  incidents: IncidentListItem[],
  onDidMerge?: () => void,
): { busy: boolean } => {
  const enabled = useAutoMergeThread();
  const lastCheckRef = useRef<Map<string, CheckRecord>>(new Map());
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (busyRef.current) return;
    if (!incidents || incidents.length === 0) return;

    // Collect every thread-primary in the current list view that is
    // (a) not itself a merged side, (b) already anchors ≥1 merge, and
    // (c) carries a thread_id. Skip anything checked within the cooldown
    // window unless its linked-pointer count grew since last check.
    const now = Date.now();
    const candidates = incidents.filter((inc) => {
      const raw = inc.rawOCSF;
      if (!raw) return false;
      if (isMergedIncident(raw)) return false;
      if (getPrimaryPointer(raw)) return false;
      const linked = getLinkedPointers(raw).length;
      if (linked === 0) return false;
      const tid = extractThreadId(raw);
      if (!tid) return false;
      const key = `${tid}:${inc.id}`;
      const prev = lastCheckRef.current.get(key);
      if (prev && now - prev.at < CHECK_COOLDOWN_MS && prev.linked >= linked) {
        return false;
      }
      return true;
    });
    if (candidates.length === 0) return;

    busyRef.current = true;
    setBusy(true);

    (async () => {
      let totalMerged = 0;
      try {
        for (const candidate of candidates) {
          const raw = candidate.rawOCSF;
          const threadId = extractThreadId(raw)!;
          const key = `${threadId}:${candidate.id}`;
          const alreadyLinked = new Set<string>(
            getLinkedPointers(raw).map((p) => p.id.toLowerCase()),
          );
          alreadyLinked.add(candidate.id.toLowerCase());
          lastCheckRef.current.set(key, { at: Date.now(), linked: alreadyLinked.size - 1 });

          let corrData: any[] = [];
          try {
            const resp = await fetch(getApiUrl('/api/v2/correlations'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
              body: JSON.stringify({ type: 'value', key: String(threadId).toLowerCase() }),
            });
            if (!resp.ok) continue;
            const data = await resp.json();
            corrData = Array.isArray(data) ? data : (data.correlations || data.data || []);
          } catch { continue; }

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
          if (siblingIds.size === 0) continue;

          // Cross-load each sibling; skip already-merged sides.
          const siblingLoads = await Promise.all(
            Array.from(siblingIds).map(async (sid) => {
              try {
                const res = await getDatastoreItem(sid, DATASTORE_CATEGORIES.INCIDENTS);
                if (!res.success || !res.item) return null;
                const sRaw = JSON.parse(res.item.value);
                if (isMergedIncident(sRaw)) return null;
                const title =
                  sRaw.title
                  || sRaw.finding_info_list?.[0]?.title
                  || sRaw.finding_info?.title
                  || sid;
                return { id: sid, raw: sRaw, title };
              } catch { return null; }
            }),
          );
          const siblings = siblingLoads.filter((s): s is { id: string; raw: any; title: string } => !!s);
          if (siblings.length === 0) continue;

          // Retain the primary that already anchors the thread. Chain
          // the folded raw through each iteration so successive sources
          // fold on top of the enriched primary (identical to detail-page
          // handleAutoMergeThread behavior).
          let currentPrimaryRaw = raw;
          const primaryTitle = raw?.title || raw?.finding_info_list?.[0]?.title || candidate.id;
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
              totalMerged += 1;
              if (res.foldedPrimary) currentPrimaryRaw = res.foldedPrimary;
            }
          }
          // Update cooldown record with the new linked count so a later
          // pass only reprocesses if MORE siblings arrive.
          lastCheckRef.current.set(key, {
            at: Date.now(),
            linked: (alreadyLinked.size - 1) + siblings.length,
          });
        }
      } catch { /* silent */ } finally {
        busyRef.current = false;
        setBusy(false);
        if (totalMerged > 0) onDidMerge?.();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, incidents]);

  return { busy };
};
