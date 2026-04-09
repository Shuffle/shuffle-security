/**
 * Hook for fetching and managing vulnerability data from the Shuffle datastore.
 * Category: shuffle-vulnerabilities
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDatastore } from './useDatastore';

export type VulnSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type VulnCategory = 'software_cve' | 'user_identity' | 'cloud_misconfig' | 'code_dependency';
export type VulnStatus = 'open' | 'in_progress' | 'resolved' | 'accepted';
export type VulnAssetType = 'asset' | 'user';

export interface Vulnerability {
  id: string;
  title: string;
  description?: string;
  severity: VulnSeverity;
  category: VulnCategory;
  status: VulnStatus;
  source?: string;
  asset_type: VulnAssetType;
  asset_id?: string;
  asset_name?: string;
  cve_id?: string;
  remediation?: string;
  first_seen?: string;
  last_seen?: string;
  resolved_at?: string;
}

const DATASTORE_CATEGORY = 'shuffle-vulnerabilities';

function parseVulnerability(raw: any): Vulnerability | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || !data.id || !data.title) return null;
    return {
      id: data.id,
      title: data.title,
      description: data.description || '',
      severity: (['critical', 'high', 'medium', 'low', 'info'].includes(data.severity) ? data.severity : 'medium') as VulnSeverity,
      category: (['software_cve', 'user_identity', 'cloud_misconfig', 'code_dependency'].includes(data.category) ? data.category : 'software_cve') as VulnCategory,
      status: (['open', 'in_progress', 'resolved', 'accepted'].includes(data.status) ? data.status : 'open') as VulnStatus,
      source: data.source || '',
      asset_type: data.asset_type === 'user' ? 'user' : 'asset',
      asset_id: data.asset_id || '',
      asset_name: data.asset_name || '',
      cve_id: data.cve_id || '',
      remediation: data.remediation || '',
      first_seen: data.first_seen || '',
      last_seen: data.last_seen || '',
      resolved_at: data.resolved_at || '',
    };
  } catch {
    return null;
  }
}

interface UseVulnerabilitiesOptions {
  tab?: 'assets' | 'users';
}

export const useVulnerabilities = ({ tab = 'assets' }: UseVulnerabilitiesOptions = {}) => {
  const { items, isLoading, isRefreshing, hasFetched, error, fetchItems } = useDatastore({ category: DATASTORE_CATEGORY });
  const [hasInitialFetch, setHasInitialFetch] = useState(false);

  useEffect(() => {
    if (!hasInitialFetch) {
      fetchItems();
      setHasInitialFetch(true);
    }
  }, [hasInitialFetch, fetchItems]);

  const allVulnerabilities = useMemo(() => {
    return items.map(item => {
      try {
        const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
        return parseVulnerability(parsed);
      } catch {
        return null;
      }
    }).filter(Boolean) as Vulnerability[];
  }, [items]);

  const filteredVulnerabilities = useMemo(() => {
    const assetType: VulnAssetType = tab === 'users' ? 'user' : 'asset';
    return allVulnerabilities.filter(v => v.asset_type === assetType);
  }, [allVulnerabilities, tab]);

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const v of allVulnerabilities) {
      if (v.severity in counts) counts[v.severity]++;
    }
    return counts;
  }, [allVulnerabilities]);

  return {
    vulnerabilities: filteredVulnerabilities,
    allVulnerabilities,
    severityCounts,
    isLoading,
    isRefreshing,
    hasFetched,
    error,
    refresh: fetchItems,
  };
};
