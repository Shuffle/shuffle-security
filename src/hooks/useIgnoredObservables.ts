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
 * The datastore itself is org-scoped (the API derives the active org from the
 * session), so this list is automatically per-org without any extra wiring.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useDatastore } from './useDatastore';

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

export const useIgnoredObservables = () => {
  const ds = useDatastore({ category: IGNORED_OBSERVABLES_CATEGORY });

  // Auto-fetch once on mount so consumers don't each have to remember.
  useEffect(() => {
    if (!ds.hasFetched && !ds.isLoading) {
      ds.fetchItems().catch(() => { /* surfaced via ds.error */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fast O(1) lookup set of canonical keys. */
  const ignoredKeys = useMemo(() => {
    const set = new Set<string>();
    for (const item of ds.items) {
      if (item?.key) set.add(item.key.toLowerCase());
    }
    return set;
  }, [ds.items]);

  /** Decoded entries (best-effort JSON parse). */
  const entries = useMemo<IgnoredObservableEntry[]>(() => {
    return ds.items.map(item => {
      const raw = item.value;
      if (typeof raw === 'string') {
        try { return JSON.parse(raw) as IgnoredObservableEntry; } catch {
          // Legacy/string payloads — synthesize from the key.
          const [type, ...rest] = (item.key || '').split('::');
          return { type, value: rest.join('::'), ignored_at: 0 };
        }
      }
      return raw as unknown as IgnoredObservableEntry;
    });
  }, [ds.items]);

  const isIgnored = useCallback(
    (type: string, value: string) => ignoredKeys.has(ignoredObservableKey(type, value)),
    [ignoredKeys],
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
      // skipRefresh=false so the local items list updates immediately and
      // the row disappears from the observables view on the same click.
      const ok = await ds.addItem(key, payload, false);
      return ok;
    },
    [ds],
  );

  const unignore = useCallback(
    async (type: string, value: string) => {
      const ok = await ds.removeItem(ignoredObservableKey(type, value));
      return ok;
    },
    [ds],
  );

  return {
    isLoading: ds.isLoading,
    hasFetched: ds.hasFetched,
    error: ds.error,
    ignoredKeys,
    entries,
    isIgnored,
    ignore,
    unignore,
    refetch: ds.fetchItems,
  };
};
