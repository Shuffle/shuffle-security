/**
 * useIgnoredObservables — per-org list of observables the user has marked as
 * "uninteresting" so they are hidden from the default observables view.
 *
 * Storage: Shuffle datastore, category `ignored-observables`.
 * Key:     `${type.toLowerCase()}::${value.toLowerCase()}` — same canonical
 *          form used everywhere else for observable identity.
 * Value:   { type, value, reason?, ignored_at } — JSON, so we can show
 *          context later (who/why/when) without another API.
 *
 * Behaviour:
 * - Fetch the full list ONCE on mount.
 * - From then on, keep a local copy in this hook. ignore/unignore mutate the
 *   local set immediately (optimistic) and fire the API call in the background.
 * - We never re-list the category; the local copy is the source of truth for
 *   the rest of the session. This avoids the "item disappears, then comes
 *   back" flicker caused by the datastore hook re-fetching after every write.
 *
 * The datastore itself is org-scoped (the API derives the active org from the
 * session), so this list is automatically per-org without any extra wiring.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDatastoreByCategory,
  setDatastoreItem,
  deleteDatastoreItem,
} from '@/services/datastore';

export const IGNORED_OBSERVABLES_CATEGORY = 'ignored-observables';

export interface IgnoredObservableEntry {
  type: string;
  value: string;
  reason?: string;
  ignored_at: number;
}

/** Canonical key for an observable — keep in lockstep with the rest of the app. */
export const ignoredObservableKey = (type: string, value: string): string =>
  `${(type || '').toLowerCase()}::${(value || '').toLowerCase()}`;

interface LocalEntry {
  key: string;
  entry: IgnoredObservableEntry;
}

const decodeValue = (key: string, raw: unknown): IgnoredObservableEntry => {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as IgnoredObservableEntry; } catch {
      const [type, ...rest] = (key || '').split('::');
      return { type, value: rest.join('::'), ignored_at: 0 };
    }
  }
  return (raw as IgnoredObservableEntry) || { type: '', value: '', ignored_at: 0 };
};

export const useIgnoredObservables = () => {
  const [local, setLocal] = useState<Map<string, LocalEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // One-shot fetch on mount. We deliberately do NOT re-list after writes.
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        let cursor: string | undefined;
        const next = new Map<string, LocalEntry>();
        const MAX_PAGES = 10;
        for (let page = 0; page < MAX_PAGES; page++) {
          const response = await getDatastoreByCategory(IGNORED_OBSERVABLES_CATEGORY, cursor);
          if (!response.success) {
            if (!cancelled) setError(response.error || 'Failed to load ignored observables');
            break;
          }
          for (const item of response.data || []) {
            if (!item?.key) continue;
            const k = item.key.toLowerCase();
            next.set(k, { key: k, entry: decodeValue(item.key, item.value) });
          }
          cursor = response.cursor || undefined;
          if (!cursor) break;
        }
        if (!cancelled) setLocal(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setHasFetched(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ignoredKeys = useMemo(() => new Set(local.keys()), [local]);
  const entries = useMemo(() => Array.from(local.values()).map(v => v.entry), [local]);

  const isIgnored = useCallback(
    (type: string, value: string) => local.has(ignoredObservableKey(type, value)),
    [local],
  );

  const ignore = useCallback(
    async (type: string, value: string, reason?: string) => {
      const key = ignoredObservableKey(type, value);
      const payload: IgnoredObservableEntry = {
        type,
        value,
        reason,
        ignored_at: Date.now(),
      };
      // Optimistic — update the local map immediately.
      let prev: Map<string, LocalEntry> | null = null;
      setLocal(curr => {
        prev = curr;
        const next = new Map(curr);
        next.set(key, { key, entry: payload });
        return next;
      });
      try {
        const response = await setDatastoreItem(key, payload, IGNORED_OBSERVABLES_CATEGORY);
        if (!response.success) {
          if (prev) setLocal(prev);
          setError(response.error || 'Failed to ignore observable');
          return false;
        }
        return true;
      } catch (err) {
        if (prev) setLocal(prev);
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    [],
  );

  const unignore = useCallback(
    async (type: string, value: string) => {
      const key = ignoredObservableKey(type, value);
      let prev: Map<string, LocalEntry> | null = null;
      setLocal(curr => {
        prev = curr;
        if (!curr.has(key)) return curr;
        const next = new Map(curr);
        next.delete(key);
        return next;
      });
      try {
        const response = await deleteDatastoreItem(key, IGNORED_OBSERVABLES_CATEGORY);
        if (!response.success) {
          if (prev) setLocal(prev);
          setError(response.error || 'Failed to unignore observable');
          return false;
        }
        return true;
      } catch (err) {
        if (prev) setLocal(prev);
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    [],
  );

  const refetch = useCallback(async () => {
    // Manual escape hatch — rarely needed. Resets the one-shot guard.
    fetchedRef.current = false;
    setHasFetched(false);
  }, []);

  return {
    isLoading,
    hasFetched,
    error,
    ignoredKeys,
    entries,
    isIgnored,
    ignore,
    unignore,
    refetch,
  };
};
