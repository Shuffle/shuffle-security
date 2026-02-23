/**
 * useUsecases — React Query hook that fetches usecases from the API,
 * merges with local defaults, and exposes the unified list + helpers.
 * Includes drift detection to flag usecases that diverge between API and defaults.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiUrl, shuffleFetch } from '@/config/api';
import {
  DEFAULT_USECASES,
  type Usecase,
  type FlowPhase,
  getUsecasesByArea,
  getUsecasesByPhase,
  getAutomationLabels,
} from '@/config/usecases';

// ── Drift detection ────────────────────────────────────────────────────────────

export type DriftType = 'label_changed' | 'description_changed' | 'phase_changed' | 'status_changed' | 'api_only' | 'local_only';

export interface UsecaseDrift {
  usecaseId: string;
  drifts: DriftType[];
  apiValue?: Partial<Usecase>;
  localValue?: Partial<Usecase>;
}

function detectDrift(merged: Usecase[], apiList: any[]): UsecaseDrift[] {
  const drifts: UsecaseDrift[] = [];
  const apiMap = new Map<string, any>();

  for (const apiUc of apiList) {
    const id = apiUc.id || apiUc.name;
    if (id) apiMap.set(id, apiUc);
  }

  const defaultMap = new Map<string, Usecase>();
  for (const uc of DEFAULT_USECASES) {
    defaultMap.set(uc.id, uc);
  }

  // Check each API usecase against defaults
  for (const [id, apiUc] of apiMap) {
    const local = defaultMap.get(id);
    if (!local) {
      drifts.push({ usecaseId: id, drifts: ['api_only'], apiValue: apiUc });
      continue;
    }

    const d: DriftType[] = [];
    if (apiUc.label && apiUc.label !== local.label) d.push('label_changed');
    if (apiUc.description && apiUc.description !== local.description) d.push('description_changed');
    if (apiUc.phase && apiUc.phase !== local.phase) d.push('phase_changed');
    if (apiUc.status && apiUc.status !== (local.status || undefined)) d.push('status_changed');

    if (d.length > 0) {
      drifts.push({ usecaseId: id, drifts: d, apiValue: apiUc, localValue: local });
    }
  }

  // Check for local-only usecases (in defaults but not in API)
  if (apiList.length > 0) {
    for (const local of DEFAULT_USECASES) {
      if (!apiMap.has(local.id)) {
        drifts.push({ usecaseId: local.id, drifts: ['local_only'], localValue: local });
      }
    }
  }

  return drifts;
}

// ── Fetcher ────────────────────────────────────────────────────────────────────

interface FetchResult {
  usecases: Usecase[];
  rawApiList: any[];
}

async function fetchUsecases(): Promise<FetchResult> {
  try {
    const res = await shuffleFetch(getApiUrl('/api/v1/workflows/usecases'));
    if (!res.ok) {
      console.warn(`[useUsecases] API returned ${res.status}, using defaults`);
      return { usecases: DEFAULT_USECASES, rawApiList: [] };
    }

    const data = await res.json();
    console.log('[useUsecases] API response shape:', Object.keys(data));

    const apiList: any[] = Array.isArray(data) ? data : data.usecases ?? data.data ?? [];

    if (!apiList.length) {
      console.log('[useUsecases] No usecases in API response, using defaults');
      return { usecases: DEFAULT_USECASES, rawApiList: [] };
    }

    // Merge: API is source of truth, local defaults fill gaps
    const merged = new Map<string, Usecase>();

    for (const uc of DEFAULT_USECASES) {
      merged.set(uc.id, { ...uc });
    }

    for (const apiUc of apiList) {
      const id = apiUc.id || apiUc.name;
      if (!id) continue;

      const existing = merged.get(id);
      if (existing) {
        merged.set(id, {
          ...existing,
          status: apiUc.status ?? (apiUc.is_valid === false ? 'misconfigured' : existing.status),
          label: apiUc.label ?? existing.label,
          description: apiUc.description ?? existing.description,
        });
      } else if (apiUc.source && apiUc.target) {
        merged.set(id, {
          id,
          source: apiUc.source,
          target: apiUc.target,
          label: apiUc.label || id,
          description: apiUc.description || '',
          agenticDescription: apiUc.agentic_description || apiUc.agenticDescription || '',
          phase: apiUc.phase || 'correlation',
          tags: apiUc.tags || [],
          animated: apiUc.animated,
          automationLabel: apiUc.automation_label || apiUc.automationLabel,
          automationCategory: apiUc.automation_category || apiUc.automationCategory,
          automationArea: apiUc.automation_area || apiUc.automationArea,
          status: apiUc.status,
        });
      }
    }

    return { usecases: Array.from(merged.values()), rawApiList: apiList };
  } catch (err) {
    console.warn('[useUsecases] Fetch failed, using defaults:', err);
    return { usecases: DEFAULT_USECASES, rawApiList: [] };
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useUsecases() {
  const query = useQuery({
    queryKey: ['usecases'],
    queryFn: fetchUsecases,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const usecases = query.data?.usecases ?? DEFAULT_USECASES;
  const rawApiList = query.data?.rawApiList ?? [];

  const drifts = useMemo(() => detectDrift(usecases, rawApiList), [usecases, rawApiList]);
  const driftMap = useMemo(() => {
    const map = new Map<string, UsecaseDrift>();
    for (const d of drifts) map.set(d.usecaseId, d);
    return map;
  }, [drifts]);

  return {
    ...query,
    usecases,
    drifts,
    driftMap,
    hasDrift: drifts.length > 0,
    getDrift: (id: string) => driftMap.get(id),
    getById: (id: string) => usecases.find(uc => uc.id === id),
    getByPhase: (phase: FlowPhase) => getUsecasesByPhase(phase, usecases),
    getByArea: (area: string) => getUsecasesByArea(area, usecases),
    getAutomationLabels: (area: string) => getAutomationLabels(area, usecases),
    getBySourceOrTarget: (categoryId: string) =>
      usecases.filter(uc => uc.source === categoryId || uc.target === categoryId),
  };
}
