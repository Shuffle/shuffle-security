/**
 * useUsecases — React Query hook that fetches usecases from the API,
 * merges with local defaults, and exposes the unified list + helpers.
 */

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

interface ApiUsecaseResponse {
  success?: boolean;
  usecases?: any[];
  [key: string]: any;
}

async function fetchUsecases(): Promise<Usecase[]> {
  try {
    const res = await shuffleFetch(getApiUrl('/api/v1/workflows/usecases'));
    if (!res.ok) {
      console.warn(`[useUsecases] API returned ${res.status}, using defaults`);
      return DEFAULT_USECASES;
    }

    const data: ApiUsecaseResponse = await res.json();
    console.log('[useUsecases] API response shape:', Object.keys(data));

    // The API shape is unknown — try common patterns
    const apiList: any[] = Array.isArray(data) ? data : data.usecases ?? data.data ?? [];

    if (!apiList.length) {
      console.log('[useUsecases] No usecases in API response, using defaults');
      return DEFAULT_USECASES;
    }

    // Merge: API is source of truth, local defaults fill gaps
    const merged = new Map<string, Usecase>();

    // Seed with defaults
    for (const uc of DEFAULT_USECASES) {
      merged.set(uc.id, { ...uc });
    }

    // Overlay API data
    for (const apiUc of apiList) {
      const id = apiUc.id || apiUc.name;
      if (!id) continue;

      const existing = merged.get(id);
      if (existing) {
        // API overrides select fields
        merged.set(id, {
          ...existing,
          status: apiUc.status ?? apiUc.is_valid === false ? 'misconfigured' : apiUc.status ?? existing.status,
          label: apiUc.label ?? existing.label,
          description: apiUc.description ?? existing.description,
        });
      } else {
        // New usecase from API not in defaults — add it if it has required fields
        if (apiUc.source && apiUc.target) {
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
    }

    return Array.from(merged.values());
  } catch (err) {
    console.warn('[useUsecases] Fetch failed, using defaults:', err);
    return DEFAULT_USECASES;
  }
}

export function useUsecases() {
  const query = useQuery({
    queryKey: ['usecases'],
    queryFn: fetchUsecases,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const usecases = query.data ?? DEFAULT_USECASES;

  return {
    ...query,
    usecases,
    getById: (id: string) => usecases.find(uc => uc.id === id),
    getByPhase: (phase: FlowPhase) => getUsecasesByPhase(phase, usecases),
    getByArea: (area: string) => getUsecasesByArea(area, usecases),
    getAutomationLabels: (area: string) => getAutomationLabels(area, usecases),
    getBySourceOrTarget: (categoryId: string) =>
      usecases.filter(uc => uc.source === categoryId || uc.target === categoryId),
  };
}
