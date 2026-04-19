/**
 * Fetch multiple datastore categories in parallel, isolating failures so one
 * slow/broken source never blocks the rest. Used by the unified Assets page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDatastoreByCategory, DatastoreItem } from '@/services/datastore';

export interface CategoryLoadState {
  key: string;
  items: DatastoreItem[];
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
}

interface UseMultiDatastoreReturn {
  states: Record<string, CategoryLoadState>;
  isAnyLoading: boolean;
  refetch: (key?: string) => Promise<void>;
}

export const useMultiDatastore = (categoryKeys: string[]): UseMultiDatastoreReturn => {
  const initial = useRef<Record<string, CategoryLoadState>>(
    Object.fromEntries(categoryKeys.map(k => [k, { key: k, items: [], isLoading: false, error: null, hasFetched: false }])),
  );
  const [states, setStates] = useState<Record<string, CategoryLoadState>>(initial.current);

  const fetchOne = useCallback(async (key: string) => {
    setStates(prev => ({ ...prev, [key]: { ...prev[key], isLoading: true, error: null } }));
    try {
      // Walk all pages but cap at 5 to keep things snappy across many categories
      let cursor: string | undefined;
      let all: DatastoreItem[] = [];
      const MAX = 5;
      let page = 0;
      do {
        page++;
        const res = await getDatastoreByCategory(key, cursor);
        if (!res.success) {
          setStates(prev => ({
            ...prev,
            [key]: { ...prev[key], isLoading: false, hasFetched: true, error: res.error || 'Failed to fetch' },
          }));
          return;
        }
        if (res.data) all = [...all, ...res.data];
        cursor = res.cursor || undefined;
      } while (cursor && page < MAX);

      setStates(prev => ({
        ...prev,
        [key]: { key, items: all, isLoading: false, hasFetched: true, error: null },
      }));
    } catch (err) {
      setStates(prev => ({
        ...prev,
        [key]: { ...prev[key], isLoading: false, hasFetched: true, error: err instanceof Error ? err.message : 'Unknown error' },
      }));
    }
  }, []);

  const refetch = useCallback(async (key?: string) => {
    if (key) {
      await fetchOne(key);
    } else {
      await Promise.all(categoryKeys.map(fetchOne));
    }
  }, [categoryKeys, fetchOne]);

  // Initial parallel fetch
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    Promise.all(categoryKeys.map(fetchOne));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAnyLoading = Object.values(states).some(s => s.isLoading);
  return { states, isAnyLoading, refetch };
};
