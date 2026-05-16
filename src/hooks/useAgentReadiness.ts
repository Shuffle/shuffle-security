import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkflows } from './useWorkflows';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { getAutomationLabels } from '@/config/usecases';
import { CategoryAutomation, CategoryConfig, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';

/**
 * "Ask agent" / @AIAgent handling is satisfied by EITHER of these paths on
 * the `shuffle-security_incidents` category:
 *
 *   A. The new built-in "Run AI Agent" automation (type=ai_agent) is enabled.
 *      No workflow plumbing is needed — Shuffle runs the agent directly.
 *
 *   B. The legacy path: the "Assign & Escalate" background workflow exists
 *      (background_processing=true) AND a "Run workflow" automation is
 *      enabled and points at that workflow's id.
 *
 * If neither is in place the @AIAgent comment never triggers anything.
 * This hook is the single source of truth and exposes `enable()` which
 * fixes the legacy path (mirroring /onboarding/automate).
 */

export interface AgentReadinessStatus {
  /** Either path A or path B is satisfied */
  active: boolean;
  /** Path A: "Run AI Agent" automation is enabled */
  hasAiAgentAutomation: boolean;
  /** Path B part 1: workflow exists with background_processing=true */
  hasWorkflow: boolean;
  /** Path B part 2: "Run workflow" enabled with this workflow id */
  hasCategoryAutomation: boolean;
  /** Still loading server state */
  isLoading: boolean;
  /** Force-enable the legacy path: generates workflow + wires up category automation */
  enable: () => Promise<void>;
  /** Enable in-flight */
  isEnabling: boolean;
}

const getOrgId = (): string | null => {
  try {
    const info = localStorage.getItem('shuffle_user_info');
    return info ? JSON.parse(info)?.active_org?.id || null : null;
  } catch {
    return null;
  }
};

const fetchIncidentsCategoryConfig = async (): Promise<CategoryConfig | null> => {
  const orgId = getOrgId();
  if (!orgId) return null;
  try {
    const url = getApiUrl(
      `/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(
        DATASTORE_CATEGORIES.INCIDENTS,
      )}&top=1`,
    );
    const res = await fetch(url, {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.category_config || null;
  } catch {
    return null;
  }
};

export const useAgentReadiness = (): AgentReadinessStatus => {
  const { data: workflows, isLoading: wfLoading, refetch: refetchWorkflows } = useWorkflows();
  const queryClient = useQueryClient();
  const [isEnabling, setIsEnabling] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const labels = useMemo(() => getAutomationLabels('assign_escalate'), []);

  const { data: categoryConfig, isLoading: cfgLoading } = useQuery<CategoryConfig | null>({
    queryKey: ['agent-readiness-category-config'],
    queryFn: fetchIncidentsCategoryConfig,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const matchingWorkflow = useMemo(() => {
    if (!workflows || labels.length === 0) return null;
    return (
      workflows.find(
        (w) => labels.includes(w.name) && w.background_processing === true,
      ) || null
    );
  }, [workflows, labels]);

  const hasWorkflow = !!matchingWorkflow;

  const hasAiAgentAutomation = useMemo(() => {
    if (!categoryConfig?.automations) return false;
    return categoryConfig.automations.some(
      (a) => a.enabled && ((a as any).type === 'ai_agent' || a.name === 'Run AI Agent'),
    );
  }, [categoryConfig]);

  const hasCategoryAutomation = useMemo(() => {
    if (!hasWorkflow || !categoryConfig?.automations) return false;
    const wfAutomation = categoryConfig.automations.find(
      (a) => a.name === 'Run workflow' && a.enabled,
    );
    if (!wfAutomation) return false;
    const wfOption = wfAutomation.options?.find((o) => o.key === 'workflow_id');
    if (!wfOption?.value) return false;
    const ids = wfOption.value.split(',').map((s) => s.trim()).filter(Boolean);
    return matchingWorkflow ? ids.includes(matchingWorkflow.id) : false;
  }, [categoryConfig, hasWorkflow, matchingWorkflow]);

  // Either path satisfies "agent is wired up".
  const serverActive = hasAiAgentAutomation || (hasWorkflow && hasCategoryAutomation);
  const active = optimistic !== null ? optimistic : serverActive;

  const refetchAll = useCallback(async () => {
    await Promise.allSettled([
      refetchWorkflows(),
      queryClient.invalidateQueries({ queryKey: ['agent-readiness-category-config'] }),
    ]);
  }, [refetchWorkflows, queryClient]);

  const enable = useCallback(async () => {
    setOptimistic(true);
    setIsEnabling(true);
    try {
      // Step 1: ensure the Assign & Escalate workflow exists.
      let workflowId = matchingWorkflow?.id || null;
      if (!workflowId) {
        // Trust the generate API: success: true + an id means it's enabled.
        const results = await Promise.allSettled(
          labels.map((label) =>
            fetch(getApiUrl('/api/v2/workflows/generate'), {
              method: 'POST',
              credentials: 'include',
              headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
              // schedule-based — no apps required
              body: JSON.stringify({ label, category: 'cases' }),
            }).then(async (r) => {
              try { return await r.json(); } catch { return null; }
            }),
          ),
        );
        for (const r of results) {
          if (r.status !== 'fulfilled' || !r.value) continue;
          const body: any = r.value;
          const id = body?.id || body?.workflow_id || body?.workflow?.id;
          if (body?.success === true && id) {
            workflowId = id;
            break;
          }
          if (id && !workflowId) workflowId = id;
        }
        // Best-effort background refresh so cached lists catch up.
        refetchWorkflows();
      }

      if (!workflowId) {
        throw new Error('Assign & Escalate workflow could not be created');
      }

      // Step 2: wire up the "Run workflow" automation on the incidents category.
      // Re-fetch latest config so we don't clobber other automations.
      const latestConfig = await fetchIncidentsCategoryConfig();
      const existing = latestConfig?.automations || [];
      const existingByName = new Map(existing.map((a) => [a.name, a]));

      const wfAutomation = existingByName.get('Run workflow');
      const currentIds = (
        wfAutomation?.options?.find((o) => o.key === 'workflow_id')?.value || ''
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!currentIds.includes(workflowId)) currentIds.push(workflowId);

      const updatedRunWorkflow = {
        name: 'Run workflow',
        description:
          wfAutomation?.description ||
          'Runs one or more workflows with the updated value as runtime argument',
        type: undefined as string | undefined,
        options: [{ key: 'workflow_id', value: currentIds.join(',') }],
        icon: '',
        enabled: true,
      };

      // Preserve every other automation as-is, only replace "Run workflow".
      const merged: any[] = existing
        .filter((a) => a.name !== 'Run workflow')
        .map((a) => ({
          name: a.name,
          description: a.description || '',
          type: (a as any).type,
          options: a.options || [],
          icon: (a as any).icon || '',
          enabled: a.enabled,
          ...((a as any).disabled ? { disabled: true } : {}),
        }));
      merged.push(updatedRunWorkflow);

      const payload: any = {
        category: DATASTORE_CATEGORIES.INCIDENTS,
        automations: merged,
        settings: { timeout: latestConfig?.settings?.timeout || 0 },
      };

      await fetch(getApiUrl('/api/v2/datastore/automate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      await refetchAll();
    } finally {
      setIsEnabling(false);
      // Keep optimistic=true sticky. The workflow list cache can lag well
      // past any timeout, and the generate API already confirmed success.
      // Only clear once the server-side state catches up (handled below).
    }
  }, [labels, matchingWorkflow, refetchWorkflows, refetchAll]);

  // Clear optimistic flag once the server agrees we're active, so we never
  // flicker back to "not enabled" after a successful enable().
  useEffect(() => {
    if (optimistic === true && serverActive) setOptimistic(null);
  }, [optimistic, serverActive]);

  return {
    active,
    hasWorkflow,
    hasCategoryAutomation,
    isLoading: wfLoading || cfgLoading,
    enable,
    isEnabling,
  };
};
