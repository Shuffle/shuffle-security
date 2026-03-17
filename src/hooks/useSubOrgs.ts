/**
 * Hook to fetch sub-organizations for the current org.
 * Used for multi-tenant views where parent orgs can see child org data.
 */
import { useState, useEffect, useCallback } from 'react';
import { getApiUrl, getAuthHeader } from '@/config/api';

export interface SubOrg {
  id: string;
  name: string;
  image?: string;
  creator_org?: string;
}

interface UseSubOrgsReturn {
  subOrgs: SubOrg[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isParentOrg: boolean;
}

export const useSubOrgs = (currentOrgId: string | undefined): UseSubOrgsReturn => {
  const [subOrgs, setSubOrgs] = useState<SubOrg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubOrgs = useCallback(async () => {
    if (!currentOrgId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl(`/api/v1/orgs/${currentOrgId}/suborgs`), {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Not a parent org or API not available — not an error, just no sub-orgs
        setSubOrgs([]);
        return;
      }

      const data = await response.json();
      
      if (data.success !== false) {
        // Handle both { subOrgs: [...] } and direct array formats
        const orgs = Array.isArray(data) ? data : (data.child_orgs || data.orgs || data.subOrgs || []);
        setSubOrgs(orgs.map((org: any) => ({
          id: org.id,
          name: org.name || org.id,
          image: org.image,
          creator_org: org.creator_org,
        })));
      } else {
        setSubOrgs([]);
      }
    } catch (err) {
      console.warn('[SubOrgs] Failed to fetch sub-orgs:', err);
      setSubOrgs([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    fetchSubOrgs();
  }, [fetchSubOrgs]);

  return {
    subOrgs,
    isLoading,
    error,
    refetch: fetchSubOrgs,
    isParentOrg: subOrgs.length > 0,
  };
};
