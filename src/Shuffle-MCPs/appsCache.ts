/**
 * Shared, request-coalescing fetcher for `/api/v1/apps`.
 *
 * The demo page (and the real app) renders many components that each need
 * the user's apps list — `ShuffleMCP`, `AgentUI`, `AppDetailDrawer`,
 * `useAppLookup`, `IntegrationStatus`. Without coordination they fire 5+
 * identical `/api/v1/apps` requests on mount.
 *
 * This module mirrors `authenticatedApps.ts`:
 *   1. Coalesces concurrent in-flight calls into a single Promise.
 *   2. Caches the resolved JSON for a short TTL.
 *   3. Exposes `invalidateAppsCache()` for callers that mutate apps.
 *
 * The cache key includes baseUrl + path + apiKey + orgId so multi-tenant /
 * multi-region setups stay isolated.
 */

import { API_CONFIG, getAuthHeader } from './api';

export interface FetchAppsOptions {
  baseUrl: string;
  path?: string;
  apiKey?: string | null;
  orgId?: string | null;
}

interface CacheEntry {
  promise?: Promise<any[]>;
  data?: any[];
  fetchedAt?: number;
}

const TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

const cacheKey = (o: FetchAppsOptions): string =>
  `${o.baseUrl}|${o.path || '/api/v1/apps'}|${o.apiKey || ''}|${o.orgId || ''}`;

const doFetch = async (o: FetchAppsOptions): Promise<any[]> => {
  const headers: Record<string, string> = {};
  if (o.apiKey) headers['Authorization'] = `Bearer ${o.apiKey}`;
  if (o.orgId) headers['Org-Id'] = o.orgId;

  const response = await fetch(`${o.baseUrl}${o.path || '/api/v1/apps'}`, {
    credentials: 'include',
    headers,
  });
  if (!response.ok) return [];
  const data = await response.json();
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.data) ? data.data : [];
};

/**
 * Get the apps list. Returns the cached value if it is still within the
 * TTL; otherwise fires (or joins) a single network request.
 */
export const fetchApps = (opts: FetchAppsOptions): Promise<any[]> => {
  const key = cacheKey(opts);
  const entry = cache.get(key) || {};

  if (entry.data && entry.fetchedAt && Date.now() - entry.fetchedAt < TTL_MS) {
    return Promise.resolve(entry.data);
  }
  if (entry.promise) return entry.promise;

  const promise = doFetch(opts)
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, { ...entry, promise });
  return promise;
};

/** Invalidate the cached entry for one (or all) keys. */
export const invalidateAppsCache = (opts?: FetchAppsOptions) => {
  if (!opts) {
    cache.clear();
    return;
  }
  cache.delete(cacheKey(opts));
};

/**
 * Convenience wrapper for callers that already use API_CONFIG / getAuthHeader.
 * Coalesces against the same cache as `fetchApps`.
 */

export const fetchAppsViaApiConfig = (): Promise<any[]> => {
  const headers = getAuthHeader();
  const orgId = headers['Org-Id'] || null;
  return fetchApps({
    baseUrl: API_CONFIG.baseUrl,
    apiKey: API_CONFIG.apiKey,
    orgId,
  });
};
