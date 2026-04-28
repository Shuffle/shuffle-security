import { useMemo, useState, useCallback } from 'react';
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
  const [isEnabling, setIsEnabling] = useState(false);
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
   * Poll workflows + category config until the server-side state matches
   * the desired value, or we run out of attempts. This is necessary because
   * `/api/v2/workflows/generate` returns success the moment the request is
   * accepted, but it can take a few seconds for the workflow list /
   * background_processing flag to actually reflect the change.
   */
  const waitForServerState = useCallback(async (desired: boolean) => {
    const MAX_ATTEMPTS = 8;
    const DELAY_MS = 1500;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      await refetchAll();
      const wfs = queryClient.getQueryData<Array<{ name: string; background_processing?: boolean }>>(['workflows']) || [];
      const cfg = queryClient.getQueryData<CategoryConfig | null>(['enrichment-category-config']);
      const status = checkEnrichmentStatus(wfs, cfg);
      if (status.active === desired) return;
    }
  }, [refetchAll, queryClient]);

  const enable = useCallback(async () => {
    setOptimistic(true);
    setIsEnabling(true);
    try {
      await Promise.allSettled([
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
      await waitForServerState(true);

      // Force-run "Enable Threat feeds" so ingestion starts immediately
      // instead of waiting for the next scheduled tick.
      try {
        const wfRes = await fetch(getApiUrl('/api/v1/workflows'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (wfRes.ok) {
          const data = await wfRes.json();
          const workflows = Array.isArray(data) ? data : (data?.workflows || []);
          const wf = workflows.find(
            (w: { name?: string }) => w?.name === THREAT_FEEDS_WORKFLOW,
          );
          const wfId = (wf as { id?: string } | undefined)?.id;
          if (wfId) {
            await fetch(getApiUrl(`/api/v1/workflows/${wfId}/execute`), {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
              body: JSON.stringify({ execution_source: 'enrichment-enable', start: '' }),
            });
          }
        }
      } catch (err) {
        console.warn('[enrichment] force-run Enable Threat feeds failed', err);
      }
    } finally {
      setIsEnabling(false);
      setOptimistic(null);
    }
  }, [waitForServerState]);

  const disable = useCallback(async () => {
    setOptimistic(false);
    setIsEnabling(true);
    try {
      await Promise.allSettled([
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
      await waitForServerState(false);
    } finally {
      setIsEnabling(false);
      setOptimistic(null);
    }
  }, [waitForServerState]);

  const result = useMemo(() => {
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

    const checks: EnrichmentStatusCheck[] = [
      { label: 'Threat feeds', active: hasThreatFeeds },
      { label: 'IOC extraction', active: hasIOCExtraction },
      { label: 'Enrich automation', active: hasEnrichEnabled },
    ];

    const serverActive = hasThreatFeeds && hasIOCExtraction && hasEnrichEnabled;
    return {
      active: optimistic !== null ? optimistic : serverActive,
      checks,
      isLoading,
    };
  }, [workflows, categoryConfig, isLoading, optimistic]);

  return { ...result, enable, disable, isEnabling };
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
