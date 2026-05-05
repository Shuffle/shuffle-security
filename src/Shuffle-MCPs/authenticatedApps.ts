/**
 * Shared, request-coalescing fetcher for `/api/v1/apps/authentication`.
 *
 * Multiple components on a single page (sidebar `IntegrationStatus`, the
 * incident header source-app logo, the Forward dialog, the Automations
 * dialog, etc.) all need the authenticated-apps list. Without coordination
 * they each fired their own HTTP request on mount, producing 3+ identical
 * requests on every incident detail load.
 *
 * This helper:
 *   1. Coalesces concurrent in-flight calls into a single Promise so
 *      simultaneous mounts only trigger one network round-trip.
 *   2. Caches the resolved JSON for a short TTL so a follow-up mount within
 *      that window can read the result synchronously instead of refetching.
 *   3. Exposes an `invalidateAuthenticatedAppsCache()` so code paths that
 *      mutate authentications (delete, reauth, etc.) can force a refresh.
 *
 * The cache key includes the optional `Org-Id` header value so cross-org
 * lookups stay isolated from the active org's data.
 */

import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

export interface AuthenticatedAppRaw {
  id?: string;
  active?: boolean;
  label?: string;
  app?: {
    name?: string;
    id?: string;
    large_image?: string;
    small_image?: string;
    categories?: string[];
    [key: string]: unknown;
  };
  validation?: { valid?: boolean; [key: string]: unknown };
  fields?: Array<{ key: string; value: string }>;
  [key: string]: unknown;
}

interface CacheEntry {
  promise?: Promise<AuthenticatedAppRaw[]>;
  data?: AuthenticatedAppRaw[];
  fetchedAt?: number;
}

const TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

const cacheKey = (crossOrgId?: string | null): string => crossOrgId || '';

const doFetch = async (crossOrgId?: string | null): Promise<AuthenticatedAppRaw[]> => {
  // getAuthHeader() now scopes to the active org by default; pass crossOrgId
  // explicitly to override when reading from a different tenant.
  const headers: Record<string, string> = {
    ...getAuthHeader(crossOrgId ?? undefined),
  };
  const response = await fetch(getApiUrl('/api/v1/apps/authentication'), {
    credentials: 'include',
    headers,
  });
  if (!response.ok) return [];
  const result = await response.json();
  const data = result?.data || result;
  return Array.isArray(data) ? data : [];
};

/**
 * Get the raw authenticated-apps list. Returns the cached value if it is
 * still within the TTL; otherwise fires (or joins) a single network request.
 */
export const fetchAuthenticatedApps = (crossOrgId?: string | null): Promise<AuthenticatedAppRaw[]> => {
  const key = cacheKey(crossOrgId);
  const entry = cache.get(key) || {};

  // Fresh cache hit — return it without touching the network.
  if (entry.data && entry.fetchedAt && Date.now() - entry.fetchedAt < TTL_MS) {
    return Promise.resolve(entry.data);
  }
  // In-flight request — join it instead of firing a duplicate.
  if (entry.promise) return entry.promise;

  const promise = doFetch(crossOrgId)
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .catch((err) => {
      // On failure, drop the in-flight promise so the next caller can retry.
      cache.delete(key);
      throw err;
    });

  cache.set(key, { ...entry, promise });
  return promise;
};

/**
 * Invalidate the cached entry for one (or all) cross-org keys. Call after
 * mutating authentications (delete, create, reauth) so the next read fires
 * a fresh request.
 */
export const invalidateAuthenticatedAppsCache = (crossOrgId?: string | null) => {
  if (crossOrgId === undefined) {
    cache.clear();
    return;
  }
  cache.delete(cacheKey(crossOrgId));
};
