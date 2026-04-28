import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkflows } from './useWorkflows';
import { CategoryAutomation, CategoryConfig, DATASTORE_CATEGORIES } from '@/services/datastore';
import { getApiUrl, getAuthHeader } from '@/config/api';

export interface EnrichmentStatusCheck {
  label: string;
  active: boolean;
}

export interface EnrichmentStatus {
  /** Overall: all three conditions are met (includes optimistic override) */
  active: boolean;
  /** Individual check results */
  checks: EnrichmentStatusCheck[];
  /** Whether data is still loading */
  isLoading: boolean;
  /** Enable all enrichment components */
  enable: () => Promise<void>;
  /** Disable enrichment */
  disable: () => Promise<void>;
  /** Whether an enable/disable action is in progress */
  isEnabling: boolean;
  /** The current enable/disable action, used for accurate loading copy */
  action: 'enable' | 'disable' | null;
  /** Whether a disable action is in progress */
  isDisabling: boolean;
}

const THREAT_FEEDS_WORKFLOW = 'Enable Threat feeds';
const IOC_EXTRACTION_WORKFLOW = 'Realtime IOC extraction';

/**
 * Fetch the category config for shuffle-security_incidents.
 * We do a minimal datastore list (limit=1) just to get category_config.
 */
const fetchIncidentsCategoryConfig = async (): Promise<CategoryConfig | null> => {
  try {
    const orgId = (() => {
      try {
        const info = localStorage.getItem('shuffle_user_info');
        return info ? JSON.parse(info)?.active_org?.id : null;
      } catch { return null; }
    })();
    if (!orgId) return null;

    // Use the same list_cache endpoint as useDatastore, limit=1 to just get category_config
    const url = getApiUrl(
      `/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(DATASTORE_CATEGORIES.INCIDENTS)}&top=1`,
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

/**
 * Check if automatic enrichment is fully active.
 *
 * Three conditions must ALL be true:
 * 1. A background_processing workflow named "Enable Threat feeds" exists
 * 2. A background_processing workflow named "Realtime IOC extraction" exists
 * 3. The "shuffle-security_incidents" category has the "Enrich" automation enabled
 *
 * @param categoryConfigOverride - Optionally pass an already-loaded CategoryConfig
 *   to avoid a redundant fetch.
 */
export const useEnrichmentStatus = (
  categoryConfigOverride?: CategoryConfig | null,
): EnrichmentStatus => {
  const { data: workflows, isLoading: wfLoading, refetch: refetchWorkflows } = useWorkflows();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | null>(null);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const { data: fetchedConfig, isLoading: cfgLoading } = useQuery<CategoryConfig | null>({
    queryKey: ['enrichment-category-config'],
    queryFn: fetchIncidentsCategoryConfig,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: categoryConfigOverride === undefined,
  });

  const categoryConfig = categoryConfigOverride !== undefined ? categoryConfigOverride : fetchedConfig;
  const isLoading = wfLoading || (categoryConfigOverride === undefined && cfgLoading);

  const refetchAll = useCallback(async () => {
    await Promise.allSettled([
      refetchWorkflows(),
      queryClient.invalidateQueries({ queryKey: ['enrichment-category-config'] }),
    ]);
  }, [refetchWorkflows, queryClient]);

  /**
   * Validate by fetching each generated workflow directly by ID.
   * Polls /api/v1/workflows/{id} until background_processing is true (enable)
   * or false/missing (disable), with a short timeout cap.
   */
  const validateWorkflowIds = useCallback(
    async (ids: string[], expect: 'enabled' | 'disabled') => {
      const ATTEMPTS = 6;
      const DELAY_MS = 800;
      const checkOne = async (id: string): Promise<boolean> => {
        try {
          const res = await fetch(getApiUrl(`/api/v1/workflows/${id}`), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          });
          if (!res.ok) return expect === 'disabled';
          const wf = await res.json();
          const bg = !!wf?.background_processing;
          return expect === 'enabled' ? bg : !bg;
        } catch {
          return false;
        }
      };
      for (let i = 0; i < ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
        const results = await Promise.all(ids.map(checkOne));
        if (results.every(Boolean)) break;
      }
      await refetchAll();
    },
    [refetchAll],
  );

  const parseGenerateId = async (res: Response): Promise<string | null> => {
    try {
      if (!res.ok) return null;
      const data = await res.json();
      return data?.id || data?.workflow_id || null;
    } catch {
      return null;
    }
  };

  const enable = useCallback(async () => {
    setOptimistic(true);
    setPendingAction('enable');
    try {
      const [r1, r2] = await Promise.all([
        fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Enable Threat feeds' }),
        }),
        fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Enable Threat feeds_webhook' }),
        }),
      ]);
      const threatFeedsId = await parseGenerateId(r1);
      const webhookId = await parseGenerateId(r2);
      const ids = [threatFeedsId, webhookId].filter((x): x is string => !!x);
      if (ids.length > 0) {
        await validateWorkflowIds(ids, 'enabled');
      } else {
        await refetchAll();
      }
      // NOTE: do NOT clear optimistic in finally — clearing it before the
      // workflow list / category config caches catch up causes a quick
      // Active → Inactive → Active flicker. The reconciliation effect
      // below clears it once serverActive matches.

      // Force-run "Enable Threat feeds" so ingestion starts immediately
      // instead of waiting for the next scheduled tick. The first generate
      // call returns the workflow id directly — no need to re-list every
      // workflow in the org just to find it again.
      if (threatFeedsId) {
        try {
          await fetch(getApiUrl(`/api/v1/workflows/${threatFeedsId}/execute`), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ execution_source: 'enrichment-enable', start: '' }),
          });
        } catch (err) {
          console.warn('[enrichment] force-run Enable Threat feeds failed', err);
        }
      }
    } finally {
      setPendingAction(null);
    }
  }, [validateWorkflowIds, refetchAll]);

  const disable = useCallback(async () => {
    setOptimistic(false);
    setPendingAction('disable');
    try {
      const [r1, r2] = await Promise.all([
        fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Enable Threat feeds', action_name: 'disable' }),
        }),
        fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Enable Threat feeds_webhook', action_name: 'disable' }),
        }),
      ]);
      const ids = (await Promise.all([parseGenerateId(r1), parseGenerateId(r2)])).filter(
        (x): x is string => !!x,
      );
      if (ids.length > 0) {
        await validateWorkflowIds(ids, 'disabled');
      } else {
        await refetchAll();
      }
    } finally {
      setPendingAction(null);
    }
  }, [validateWorkflowIds, refetchAll]);

  const serverActive = useMemo(() => {
    const hasThreatFeeds = !!workflows?.some(
      (w) => w.name === THREAT_FEEDS_WORKFLOW && w.background_processing === true,
    );
    const hasIOCExtraction = !!workflows?.some(
      (w) => w.name === IOC_EXTRACTION_WORKFLOW && w.background_processing === true,
    );
    const automations: CategoryAutomation[] = categoryConfig?.automations || [];
    const enrichAutomation = automations.find(
      (a) => a.type === 'enrich' || a.name === 'Enrich',
    );
    const hasEnrichEnabled = !!enrichAutomation?.enabled;
    return { hasThreatFeeds, hasIOCExtraction, hasEnrichEnabled };
  }, [workflows, categoryConfig]);

  // Clear optimistic override once the server-side state catches up to
  // what we expect, OR after a 15s safety timeout — whichever comes first.
  // This is what kills the Active → Inactive → Active flicker on disable:
  // we keep the optimistic value sticky until the workflows list reflects
  // the deletion, instead of clearing it the moment the request resolves.
  useEffect(() => {
    if (optimistic === null) return;
    const computedActive =
      serverActive.hasThreatFeeds &&
      serverActive.hasIOCExtraction &&
      serverActive.hasEnrichEnabled;
    if (computedActive === optimistic) {
      setOptimistic(null);
      return;
    }
    if (pendingAction !== null) return;
    const t = setTimeout(() => setOptimistic(null), 15000);
    return () => clearTimeout(t);
  }, [optimistic, serverActive, pendingAction]);

  const result = useMemo(() => {
    const checks: EnrichmentStatusCheck[] = [
      { label: 'Threat feeds', active: serverActive.hasThreatFeeds },
      { label: 'IOC extraction', active: serverActive.hasIOCExtraction },
      { label: 'Enrich automation', active: serverActive.hasEnrichEnabled },
    ];
    const computedActive =
      serverActive.hasThreatFeeds &&
      serverActive.hasIOCExtraction &&
      serverActive.hasEnrichEnabled;
    return {
      active: optimistic !== null ? optimistic : computedActive,
      checks,
      isLoading,
    };
  }, [serverActive, isLoading, optimistic]);

  return {
    ...result,
    enable,
    disable,
    isEnabling: pendingAction !== null,
    action: pendingAction,
    isDisabling: pendingAction === 'disable',
  };
};

/**
 * Standalone (non-hook) helper to check enrichment status from raw data.
 * Useful in contexts where hooks can't be called.
 */
export const checkEnrichmentStatus = (
  workflows: Array<{ name: string; background_processing?: boolean }>,
  categoryConfig: CategoryConfig | null | undefined,
): { active: boolean; checks: EnrichmentStatusCheck[] } => {
  const hasThreatFeeds = workflows.some(
    (w) => w.name === THREAT_FEEDS_WORKFLOW && w.background_processing === true,
  );
  const hasIOCExtraction = workflows.some(
    (w) => w.name === IOC_EXTRACTION_WORKFLOW && w.background_processing === true,
  );
  const automations: CategoryAutomation[] = categoryConfig?.automations || [];
  const enrichAutomation = automations.find(
    (a) => a.type === 'enrich' || a.name === 'Enrich',
  );
  const hasEnrichEnabled = !!enrichAutomation?.enabled;

  const checks: EnrichmentStatusCheck[] = [
    { label: 'Threat feeds', active: hasThreatFeeds },
    { label: 'IOC extraction', active: hasIOCExtraction },
    { label: 'Enrich automation', active: hasEnrichEnabled },
  ];

  return {
    active: hasThreatFeeds && hasIOCExtraction && hasEnrichEnabled,
    checks,
  };
};
