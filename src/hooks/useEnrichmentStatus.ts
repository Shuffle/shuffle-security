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

  const { data: fetchedConfig, isLoading: cfgLoading } = useQuery<CategoryConfig | null>({
    queryKey: ['enrichment-category-config'],
    queryFn: fetchIncidentsCategoryConfig,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: categoryConfigOverride === undefined, // skip if override provided
  });

  const categoryConfig = categoryConfigOverride !== undefined ? categoryConfigOverride : fetchedConfig;
  const isLoading = wfLoading || (categoryConfigOverride === undefined && cfgLoading);

  const enable = useCallback(async () => {
    setIsEnabling(true);
    try {
      // Fire both generate requests in parallel
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
      // Wait 3 seconds for backend to propagate changes, then re-validate
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await Promise.allSettled([
        refetchWorkflows(),
        queryClient.invalidateQueries({ queryKey: ['enrichment-category-config'] }),
      ]);
    } finally {
      setIsEnabling(false);
    }
  }, [refetchWorkflows, queryClient]);

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

    return {
      active: hasThreatFeeds && hasIOCExtraction && hasEnrichEnabled,
      checks,
      isLoading,
    };
  }, [workflows, categoryConfig, isLoading]);

  return { ...result, enable, isEnabling };
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
