/**
 * useUsecases — React Query hook that fetches usecases from the API,
 * merges with local defaults, and exposes the unified list + helpers.
 * Includes drift detection to flag usecases that diverge between API and defaults.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getApiUrl, shuffleFetch } from '@/config/api';
import {
  DEFAULT_USECASES,
  type Usecase,
  type FlowPhase,
  type ApiUsecaseCategory,
  type ApiUsecase,
  getUsecasesByArea,
  getUsecasesByPhase,
  getAutomationLabels,
  apiCategoryToPhase,
  normalizeCategory,
} from '@/config/usecases';

// ── Drift detection ────────────────────────────────────────────────────────────

export type DriftType =
  | 'api_only'       // Usecase exists in API but has no matching data flow
  | 'local_only'     // Data flow exists locally but has no matching API usecase
  | 'phase_mismatch' // Matched, but API category implies a different phase
  | 'description_added'; // API provides a description our default doesn't have

export interface UsecaseDrift {
  usecaseId: string;
  drifts: DriftType[];
  /** The API usecase that matched (or didn't) */
  apiUsecase?: ApiUsecase;
  /** The API category name */
  apiCategory?: string;
  /** The local usecase if it exists */
  localValue?: Usecase;
}

// ── Matching logic ─────────────────────────────────────────────────────────────

interface MatchedPair {
  local: Usecase;
  api: ApiUsecase;
  apiCategoryName: string;
}

/**
 * Match API usecases to local data flows based on source (type) → target (last).
 * Returns matched pairs, unmatched API usecases, and unmatched local flows.
 */
function matchUsecases(apiCategories: ApiUsecaseCategory[]): {
  matched: MatchedPair[];
  apiOnly: { uc: ApiUsecase; categoryName: string }[];
  localOnly: Usecase[];
} {
  // Build a lookup: "source→target" → local usecase(s)
  const localByRoute = new Map<string, Usecase[]>();
  for (const uc of DEFAULT_USECASES) {
    const key = `${uc.source}→${uc.target}`;
    const arr = localByRoute.get(key) || [];
    arr.push(uc);
    localByRoute.set(key, arr);
  }

  // Route aliases: API may use a different source category than the local flow.
  // e.g. API "communication→case_management" should match local "email→case_management"
  const routeAliases: Record<string, string[]> = {
    communication: ['email'],   // API uses "communication" for email-related flows
    email: ['communication'],
  };

  const findLocals = (key: string, source: string): Usecase[] | undefined => {
    const direct = localByRoute.get(key);
    if (direct && direct.length > 0) return direct;
    // Try aliases for the source category
    const aliases = routeAliases[source];
    if (aliases) {
      const target = key.split('→')[1];
      for (const alias of aliases) {
        const altKey = `${alias}→${target}`;
        const altLocals = localByRoute.get(altKey);
        if (altLocals && altLocals.length > 0) return altLocals;
      }
    }
    return undefined;
  };

  const matched: MatchedPair[] = [];
  const apiOnly: { uc: ApiUsecase; categoryName: string }[] = [];
  const matchedLocalIds = new Set<string>();

  for (const cat of apiCategories) {
    for (const apiUc of cat.list) {
      if (!apiUc.type || !apiUc.last) continue; // Skip entries without both type and last
      const source = normalizeCategory(apiUc.type);
      const target = normalizeCategory(apiUc.last);
      const key = `${source}→${target}`;

      const locals = findLocals(key, source);
      if (locals && locals.length > 0) {
        const unmatched = locals.find(l => !matchedLocalIds.has(l.id));
        if (unmatched) {
          matched.push({ local: unmatched, api: apiUc, apiCategoryName: cat.name });
          matchedLocalIds.add(unmatched.id);
        } else {
          apiOnly.push({ uc: apiUc, categoryName: cat.name });
        }
      } else {
        apiOnly.push({ uc: apiUc, categoryName: cat.name });
      }
    }
  }

  const localOnly = DEFAULT_USECASES.filter(uc => !matchedLocalIds.has(uc.id));

  return { matched, apiOnly, localOnly };
}

// ── Drift computation ──────────────────────────────────────────────────────────

function computeDrifts(apiCategories: ApiUsecaseCategory[]): UsecaseDrift[] {
  if (apiCategories.length === 0) return [];

  const { matched, apiOnly, localOnly } = matchUsecases(apiCategories);
  const drifts: UsecaseDrift[] = [];

  // Matched pairs: always emit an entry (clean or with drifts)
  for (const { local, api, apiCategoryName } of matched) {
    const d: DriftType[] = [];
    const apiPhase = apiCategoryToPhase(apiCategoryName);
    if (apiPhase !== local.phase) d.push('phase_mismatch');
    if (api.description && !local.description) d.push('description_added');
    drifts.push({
      usecaseId: local.id,
      drifts: d,
      apiUsecase: api,
      apiCategory: apiCategoryName,
      localValue: local,
    });
  }

  // API-only usecases (no matching data flow)
  for (const { uc, categoryName } of apiOnly) {
    const source = normalizeCategory(uc.type);
    const target = normalizeCategory(uc.last);
    drifts.push({
      usecaseId: `api_${source}_${target}_${uc.name.toLowerCase().replace(/\s+/g, '_')}`,
      drifts: ['api_only'],
      apiUsecase: uc,
      apiCategory: categoryName,
    });
  }

  // Local-only data flows (no matching API usecase)
  for (const local of localOnly) {
    drifts.push({
      usecaseId: local.id,
      drifts: ['local_only'],
      localValue: local,
    });
  }

  return drifts;
}

// ── Fetcher ────────────────────────────────────────────────────────────────────

interface FetchResult {
  usecases: Usecase[];
  apiCategories: ApiUsecaseCategory[];
}

async function fetchUsecases(): Promise<FetchResult> {
  try {
    const res = await shuffleFetch(getApiUrl('/api/v1/workflows/usecases'));
    if (!res.ok) {
      console.warn(`[useUsecases] API returned ${res.status}, using defaults`);
      return { usecases: DEFAULT_USECASES, apiCategories: [] };
    }

    const data = await res.json();

    // The API returns an array of category objects
    const apiCategories: ApiUsecaseCategory[] = Array.isArray(data) ? data : [];

    if (apiCategories.length === 0) {
      console.log('[useUsecases] No categories in API response, using defaults');
      return { usecases: DEFAULT_USECASES, apiCategories: [] };
    }

    console.log(
      `[useUsecases] API returned ${apiCategories.length} categories with ${apiCategories.reduce((n, c) => n + c.list.length, 0)} usecases`
    );

    // Merge: enrich local defaults with API data where matched
    const { matched } = matchUsecases(apiCategories);
    const enriched = new Map<string, Usecase>();
    for (const uc of DEFAULT_USECASES) {
      enriched.set(uc.id, { ...uc });
    }

    for (const { local, api, apiCategoryName } of matched) {
      const existing = enriched.get(local.id)!;
      enriched.set(local.id, {
        ...existing,
        // Enrich with API data where available
        description: api.description || existing.description,
        priority: typeof api.priority === 'number' ? api.priority : existing.priority,
        video: api.video || existing.video,
        blogpost: api.blogpost || existing.blogpost,
        referenceImage: api.reference_image || existing.referenceImage,
      });
    }

    return { usecases: Array.from(enriched.values()), apiCategories };
  } catch (err) {
    console.warn('[useUsecases] Fetch failed, using defaults:', err);
    return { usecases: DEFAULT_USECASES, apiCategories: [] };
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useUsecases() {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: ['usecases', isAuthenticated],
    queryFn: fetchUsecases,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const usecases = query.data?.usecases ?? DEFAULT_USECASES;
  const apiCategories = query.data?.apiCategories ?? [];

  const drifts = useMemo(() => computeDrifts(apiCategories), [apiCategories]);
  const driftMap = useMemo(() => {
    const map = new Map<string, UsecaseDrift>();
    for (const d of drifts) map.set(d.usecaseId, d);
    return map;
  }, [drifts]);

  return {
    ...query,
    usecases,
    apiCategories,
    apiLoaded: apiCategories.length > 0,
    drifts,
    driftMap,
    hasDrift: drifts.some(d => d.drifts.length > 0),
    getDrift: (id: string) => driftMap.get(id),
    getById: (id: string) => usecases.find(uc => uc.id === id),
    getByPhase: (phase: FlowPhase) => getUsecasesByPhase(phase, usecases),
    getByArea: (area: string) => getUsecasesByArea(area, usecases),
    getAutomationLabels: (area: string) => getAutomationLabels(area, usecases),
    getBySourceOrTarget: (categoryId: string) =>
      usecases.filter(uc => uc.source === categoryId || uc.target === categoryId),
  };
}
