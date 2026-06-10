import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkflows } from './useWorkflows';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { getAutomationLabels } from '@/config/usecases';
import { CategoryConfig, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';

export interface AssignEscalateStatus {
  /** Workflow exists AND background_processing=true AND wired into a
   *  category automation that is itself enabled */
  active: boolean;
  /** Whether workflows are still loading */
  isLoading: boolean;
  /** Enable the Assign & Escalate workflow */
  enable: () => Promise<void>;
  /** Whether an enable action is in progress */
  isEnabling: boolean;
  /** Disable the Assign & Escalate workflow */
  disable: () => Promise<void>;
  /** Whether a disable action is in progress */
  isDisabling: boolean;
}

const getOrgId = (): string | null => {
  try {
    const info = localStorage.getItem('shuffle_user_info');
    return info ? JSON.parse(info)?.active_org?.id || null : null;
  } catch {
    return null;
  }
};

const CATEGORY_CONFIG_MISSING = Symbol('category_config_missing');
type FetchedCategoryConfig = CategoryConfig | typeof CATEGORY_CONFIG_MISSING | null;

const fetchIncidentsCategoryConfig = async (): Promise<FetchedCategoryConfig> => {
  const orgId = getOrgId();
  if (!orgId) return null;
  const url = getApiUrl(
    `/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(
      DATASTORE_CATEGORIES.INCIDENTS,
    )}&top=1`,
  );
  const res = await fetch(url, {
    credentials: 'include',
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error(`list_cache responded with ${res.status}`);
  const data = await res.json();
  const cfg = (data?.category_config as CategoryConfig | undefined) || null;
  return cfg ?? CATEGORY_CONFIG_MISSING;
};

/**
 * The AI Agent's "ai_handled" automation requires the "Assign & Escalate"
 * background workflow to be running AND that workflow to be wired into an
 * enabled "Run workflow" automation on the incidents category. If the whole
 * "Run workflow" automation is disabled, the workflow never fires — so we
 * must report Assign & Escalate as inactive in that case.
 */
export const useAssignEscalateStatus = (): AssignEscalateStatus => {
  const { data: workflows, isLoading: wfLoading, refetch } = useWorkflows();
  const queryClient = useQueryClient();
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const labels = useMemo(() => getAutomationLabels('assign_escalate'), []);

  const { data: fetched, isLoading: cfgLoading } = useQuery<FetchedCategoryConfig>({
    queryKey: ['assign-escalate-category-config'],
    queryFn: fetchIncidentsCategoryConfig,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const refetchAll = useCallback(async () => {
    await Promise.allSettled([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['assign-escalate-category-config'] }),
    ]);
  }, [refetch, queryClient]);

  const enable = useCallback(async () => {
    setOptimistic(true);
    setIsEnabling(true);
    try {
      await Promise.allSettled(
        labels.map((label) =>
          fetch(getApiUrl('/api/v2/workflows/generate'), {
            method: 'POST',
            credentials: 'include',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            // assign_escalate is schedule-based — no app dependencies required.
            body: JSON.stringify({ label, category: 'cases' }),
          }),
        ),
      );
      // Give the backend a moment to register the new workflow before refetching.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await refetchAll();
    } finally {
      setIsEnabling(false);
      setOptimistic(null);
    }
  }, [labels, refetchAll]);

  const disable = useCallback(async () => {
    setOptimistic(false);
    setIsDisabling(true);
    try {
      await Promise.allSettled(
        labels.map((label) =>
          fetch(getApiUrl('/api/v2/workflows/generate'), {
            method: 'POST',
            credentials: 'include',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, category: 'cases', action_name: 'remove' }),
          }),
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await refetchAll();
    } finally {
      setIsDisabling(false);
      setOptimistic(null);
    }
  }, [labels, refetchAll]);

  const active = useMemo(() => {
    if (optimistic !== null) return optimistic;
    if (!workflows || labels.length === 0) return false;

    const matchingWorkflow = workflows.find(
      (w) => labels.includes(w.name) && w.background_processing === true,
    );
    if (!matchingWorkflow) return false;

    const categoryConfigMissing = fetched === CATEGORY_CONFIG_MISSING;
    // No incidents yet => category_config absent. Trust workflow existence.
    if (categoryConfigMissing) return true;

    const categoryConfig: CategoryConfig | null =
      (fetched as CategoryConfig | null | undefined) ?? null;
    const wfAutomation = categoryConfig?.automations?.find(
      (a) => a.name === 'Run workflow',
    );
    if (!wfAutomation || !wfAutomation.enabled) return false;

    const wfOption = wfAutomation.options?.find((o) => o.key === 'workflow_id');
    if (!wfOption?.value) return false;
    const ids = wfOption.value.split(',').map((s) => s.trim()).filter(Boolean);
    return ids.includes(matchingWorkflow.id);
  }, [workflows, labels, optimistic, fetched]);

  return {
    active,
    isLoading: wfLoading || cfgLoading,
    enable,
    isEnabling,
    disable,
    isDisabling,
  };
};
