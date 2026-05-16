import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkflows } from './useWorkflows';
import { CategoryAutomation, CategoryConfig, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

export interface EnrichmentStatusCheck {
  label: string;
  active: boolean;
  /** Technical detail explaining exactly what was checked and the observed
   *  result. Surfaced to support users in tooltips. */
  detail: string;
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

const CATEGORY_CONFIG_CACHE_KEY = 'shuffle-enrichment-category-config';

const readCachedCategoryConfig = (orgId: string | null): CategoryConfig | null => {
  if (!orgId) return null;
  try {
    const raw = localStorage.getItem(`${CATEGORY_CONFIG_CACHE_KEY}::${orgId}`);
    return raw ? (JSON.parse(raw) as CategoryConfig) : null;
  } catch {
    return null;
  }
};

const writeCachedCategoryConfig = (orgId: string | null, cfg: CategoryConfig | null) => {
  if (!orgId || !cfg) return;
  try {
    localStorage.setItem(`${CATEGORY_CONFIG_CACHE_KEY}::${orgId}`, JSON.stringify(cfg));
  } catch {
    /* ignore quota */
  }
};

const getActiveOrgId = (): string | null => {
  try {
    const info = localStorage.getItem('shuffle_user_info');
    return info ? JSON.parse(info)?.active_org?.id ?? null : null;
  } catch { return null; }
};

/**
 * Fetch the category config for shuffle-security_incidents.
 * Throws on transport / non-OK responses so react-query can retry.
 * Falls back to the last cached config when the request can't be made
 * (e.g. no org id available).
 */
const fetchIncidentsCategoryConfig = async (): Promise<CategoryConfig | null> => {
  const orgId = getActiveOrgId();
  if (!orgId) return readCachedCategoryConfig(orgId);

  const url = getApiUrl(
    `/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(DATASTORE_CATEGORIES.INCIDENTS)}&top=1`,
  );
  const res = await fetch(url, {
    credentials: 'include',
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    throw new Error(`list_cache responded with ${res.status}`);
  }
  const data = await res.json();
  const cfg = (data?.category_config as CategoryConfig | undefined) || null;
  if (cfg) writeCachedCategoryConfig(orgId, cfg);
  return cfg;
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

  const { data: fetchedConfig, isLoading: cfgLoading, isError: cfgError } = useQuery<CategoryConfig | null>({
    queryKey: ['enrichment-category-config'],
    queryFn: fetchIncidentsCategoryConfig,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: categoryConfigOverride === undefined,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // Fall back to last cached config when the live request fails so a
  // transient /list_cache hiccup doesn't flip Enrich automation to Inactive.
  const resolvedFetched = useMemo<CategoryConfig | null>(() => {
    if (fetchedConfig) return fetchedConfig;
    if (cfgError) return readCachedCategoryConfig(getActiveOrgId());
    return fetchedConfig ?? null;
  }, [fetchedConfig, cfgError]);

  const categoryConfig = categoryConfigOverride !== undefined ? categoryConfigOverride : resolvedFetched;
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

  const serverDetails = useMemo(() => {
    const tfMatch = workflows?.find((w) => w.name === THREAT_FEEDS_WORKFLOW);
    const iocMatch = workflows?.find((w) => w.name === IOC_EXTRACTION_WORKFLOW);
    const automations: CategoryAutomation[] = categoryConfig?.automations || [];
    const enrichAutomation = automations.find(
      (a) => a.type === 'enrich' || a.name === 'Enrich',
    );

    const wfId = (w: { id?: string } | undefined) => (w?.id ? ` (id: ${w.id})` : '');
    const tfDetail = !tfMatch
      ? `No workflow named "${THREAT_FEEDS_WORKFLOW}" found in /api/v1/workflows for this org.`
      : tfMatch.background_processing === true
        ? `Workflow "${THREAT_FEEDS_WORKFLOW}" found with background_processing=true${wfId(tfMatch as { id?: string })}.`
        : `Workflow "${THREAT_FEEDS_WORKFLOW}" found but background_processing=${String((tfMatch as { background_processing?: boolean }).background_processing)}${wfId(tfMatch as { id?: string })}. Re-generate via /api/v2/workflows/generate to flip it on.`;

    const iocDetail = !iocMatch
      ? `No workflow named "${IOC_EXTRACTION_WORKFLOW}" found in /api/v1/workflows for this org.`
      : iocMatch.background_processing === true
        ? `Workflow "${IOC_EXTRACTION_WORKFLOW}" found with background_processing=true${wfId(iocMatch as { id?: string })}.`
        : `Workflow "${IOC_EXTRACTION_WORKFLOW}" found but background_processing=${String((iocMatch as { background_processing?: boolean }).background_processing)}${wfId(iocMatch as { id?: string })}. Re-generate via /api/v2/workflows/generate to flip it on.`;

    const enrichDetail = !categoryConfig
      ? `category_config not returned by /list_cache?category=${DATASTORE_CATEGORIES.INCIDENTS} (org may not have any incidents yet, or the request failed).`
      : !enrichAutomation
        ? `category_config.automations on "${DATASTORE_CATEGORIES.INCIDENTS}" has no entry with type="enrich" or name="Enrich".`
        : enrichAutomation.enabled
          ? `Automation "${enrichAutomation.name || enrichAutomation.type}" on "${DATASTORE_CATEGORIES.INCIDENTS}" has enabled=true.`
          : `Automation "${enrichAutomation.name || enrichAutomation.type}" on "${DATASTORE_CATEGORIES.INCIDENTS}" exists but enabled=false.`;

    return {
      hasThreatFeeds: !!tfMatch && tfMatch.background_processing === true,
      hasIOCExtraction: !!iocMatch && iocMatch.background_processing === true,
      hasEnrichEnabled: !!enrichAutomation?.enabled,
      tfDetail,
      iocDetail,
      enrichDetail,
    };
  }, [workflows, categoryConfig]);

  const serverActive = serverDetails;

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
      { label: 'Threat feeds', active: serverActive.hasThreatFeeds, detail: serverDetails.tfDetail },
      { label: 'IOC extraction', active: serverActive.hasIOCExtraction, detail: serverDetails.iocDetail },
      { label: 'Enrich automation', active: serverActive.hasEnrichEnabled, detail: serverDetails.enrichDetail },
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
  }, [serverActive, serverDetails, isLoading, optimistic]);

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
    { label: 'Threat feeds', active: hasThreatFeeds, detail: hasThreatFeeds ? `Workflow "${THREAT_FEEDS_WORKFLOW}" found with background_processing=true.` : `Workflow "${THREAT_FEEDS_WORKFLOW}" missing or background_processing!=true.` },
    { label: 'IOC extraction', active: hasIOCExtraction, detail: hasIOCExtraction ? `Workflow "${IOC_EXTRACTION_WORKFLOW}" found with background_processing=true.` : `Workflow "${IOC_EXTRACTION_WORKFLOW}" missing or background_processing!=true.` },
    { label: 'Enrich automation', active: hasEnrichEnabled, detail: hasEnrichEnabled ? `Enrich automation enabled on "${DATASTORE_CATEGORIES.INCIDENTS}".` : `Enrich automation missing or disabled on "${DATASTORE_CATEGORIES.INCIDENTS}".` },
  ];

  return {
    active: hasThreatFeeds && hasIOCExtraction && hasEnrichEnabled,
    checks,
  };
};
