import { useCallback, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkflows, useWorkflowsMulti, WorkflowSummary } from './useWorkflows';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { getAutomationLabels } from '@/config/usecases';
import { CategoryConfig, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';

export interface AssignEscalateStatus {
  /** Workflow exists AND background_processing=true AND wired into a
   *  category automation that is itself enabled (across every scoped tenant) */
  active: boolean;
  /** Whether workflows are still loading */
  isLoading: boolean;
  /** Enable the Assign & Escalate workflow (across every inactive tenant) */
  enable: () => Promise<void>;
  /** Whether an enable action is in progress */
  isEnabling: boolean;
  /** Disable the Assign & Escalate workflow (across every scoped tenant) */
  disable: () => Promise<void>;
  /** Whether a disable action is in progress */
  isDisabling: boolean;
  /** Tenants currently missing the workflow (multi-org mode only) */
  inactiveOrgIds: string[];
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

const fetchIncidentsCategoryConfig = async (orgIdArg?: string): Promise<FetchedCategoryConfig> => {
  const orgId = orgIdArg || getOrgId();
  if (!orgId) return null;
  const url = getApiUrl(
    `/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(
      DATASTORE_CATEGORIES.INCIDENTS,
    )}&top=1`,
  );
  const headers: Record<string, string> = { ...getAuthHeader() };
  if (orgIdArg) headers['Org-Id'] = orgIdArg;
  const res = await fetch(url, {
    credentials: 'include',
    headers,
  });
  if (!res.ok) throw new Error(`list_cache responded with ${res.status}`);
  const data = await res.json();
  const cfg = (data?.category_config as CategoryConfig | undefined) || null;
  return cfg ?? CATEGORY_CONFIG_MISSING;
};

const isOrgActive = (
  workflows: WorkflowSummary[] | undefined,
  cfg: FetchedCategoryConfig | undefined,
  labels: string[],
): boolean => {
  if (!workflows || labels.length === 0) return false;
  const matchingWorkflow = workflows.find(
    (w) => labels.includes(w.name) && w.background_processing === true,
  );
  if (!matchingWorkflow) return false;
  if (cfg === CATEGORY_CONFIG_MISSING) return true;
  const categoryConfig = (cfg as CategoryConfig | null | undefined) ?? null;
  const wfAutomation = categoryConfig?.automations?.find((a) => a.name === 'Run workflow');
  if (!wfAutomation || !wfAutomation.enabled) return false;
  const wfOption = wfAutomation.options?.find((o) => o.key === 'workflow_id');
  if (!wfOption?.value) return false;
  const ids = wfOption.value.split(',').map((s) => s.trim()).filter(Boolean);
  return ids.includes(matchingWorkflow.id);
};

const runGenerate = async (labels: string[], orgId?: string, actionName?: string) => {
  const headers: Record<string, string> = { ...getAuthHeader(), 'Content-Type': 'application/json' };
  if (orgId) headers['Org-Id'] = orgId;
  await Promise.allSettled(
    labels.map((label) =>
      fetch(getApiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          label,
          category: 'cases',
          ...(actionName ? { action_name: actionName } : {}),
        }),
      }),
    ),
  );
};

/**
 * The AI Agent's "ai_handled" automation requires the "Assign & Escalate"
 * background workflow to be running AND that workflow to be wired into an
 * enabled "Run workflow" automation on the incidents category. If the whole
 * "Run workflow" automation is disabled, the workflow never fires — so we
 * must report Assign & Escalate as inactive in that case.
 *
 * @param options.orgIds - When provided, validate across every listed tenant.
 *   Status is Active only when every tenant is Active.
 */
export const useAssignEscalateStatus = (options?: { orgIds?: string[] }): AssignEscalateStatus => {
  const orgIds = useMemo(
    () => Array.from(new Set((options?.orgIds || []).filter(Boolean))),
    [options?.orgIds],
  );
  const multi = orgIds.length > 0;

  const { data: singleWorkflows, isLoading: singleWfLoading, refetch: refetchSingle } = useWorkflows();
  const queryClient = useQueryClient();
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const labels = useMemo(() => getAutomationLabels('assign_escalate'), []);

  const { data: singleCfg, isLoading: singleCfgLoading } = useQuery<FetchedCategoryConfig>({
    queryKey: ['assign-escalate-category-config'],
    queryFn: () => fetchIncidentsCategoryConfig(),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    enabled: !multi,
  });

  const { byOrg: multiWorkflows, isLoading: multiWfLoading, refetchAll: refetchMultiWfs } = useWorkflowsMulti(multi ? orgIds : []);
  const multiCfgQueries = useQueries({
    queries: (multi ? orgIds : []).map((oid) => ({
      queryKey: ['assign-escalate-category-config', oid],
      queryFn: () => fetchIncidentsCategoryConfig(oid),
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    })),
  });
  const multiCfgByOrg = useMemo(() => {
    const map: Record<string, FetchedCategoryConfig | undefined> = {};
    (multi ? orgIds : []).forEach((oid, idx) => {
      map[oid] = multiCfgQueries[idx]?.data as FetchedCategoryConfig | undefined;
    });
    return map;
  }, [multi, orgIds, multiCfgQueries]);
  const multiCfgLoading = multi && multiCfgQueries.some((q) => q.isLoading);

  const refetchAll = useCallback(async () => {
    if (multi) {
      await Promise.allSettled([
        refetchMultiWfs(),
        ...orgIds.map((oid) =>
          queryClient.invalidateQueries({ queryKey: ['assign-escalate-category-config', oid] }),
        ),
      ]);
    } else {
      await Promise.allSettled([
        refetchSingle(),
        queryClient.invalidateQueries({ queryKey: ['assign-escalate-category-config'] }),
      ]);
    }
  }, [multi, orgIds, refetchMultiWfs, refetchSingle, queryClient]);

  const inactiveOrgIds = useMemo(() => {
    if (!multi) return [];
    return orgIds.filter((oid) => !isOrgActive(multiWorkflows[oid], multiCfgByOrg[oid], labels));
  }, [multi, orgIds, multiWorkflows, multiCfgByOrg, labels]);

  const enable = useCallback(async () => {
    setOptimistic(true);
    setIsEnabling(true);
    try {
      if (multi) {
        const targets = inactiveOrgIds.length > 0 ? inactiveOrgIds : orgIds;
        await Promise.all(targets.map((oid) => runGenerate(labels, oid)));
      } else {
        await runGenerate(labels);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await refetchAll();
    } finally {
      setIsEnabling(false);
      setOptimistic(null);
    }
  }, [multi, inactiveOrgIds, orgIds, labels, refetchAll]);

  const disable = useCallback(async () => {
    setOptimistic(false);
    setIsDisabling(true);
    try {
      if (multi) {
        await Promise.all(orgIds.map((oid) => runGenerate(labels, oid, 'remove')));
      } else {
        await runGenerate(labels, undefined, 'remove');
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await refetchAll();
    } finally {
      setIsDisabling(false);
      setOptimistic(null);
    }
  }, [multi, orgIds, labels, refetchAll]);

  const active = useMemo(() => {
    if (optimistic !== null) return optimistic;
    if (multi) {
      if (orgIds.length === 0) return false;
      return orgIds.every((oid) => isOrgActive(multiWorkflows[oid], multiCfgByOrg[oid], labels));
    }
    return isOrgActive(singleWorkflows, singleCfg, labels);
  }, [optimistic, multi, orgIds, multiWorkflows, multiCfgByOrg, singleWorkflows, singleCfg, labels]);

  return {
    active,
    isLoading: multi ? (multiWfLoading || multiCfgLoading) : (singleWfLoading || singleCfgLoading),
    enable,
    isEnabling,
    disable,
    isDisabling,
    inactiveOrgIds,
  };
};
