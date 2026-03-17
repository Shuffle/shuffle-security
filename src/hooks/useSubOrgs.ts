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
  region_url?: string;
  isParent?: boolean;
}

interface UseSubOrgsReturn {
  subOrgs: SubOrg[];
  parentOrg: SubOrg | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isParentOrg: boolean;
}

export const useSubOrgs = (currentOrgId: string | undefined): UseSubOrgsReturn => {
  const [subOrgs, setSubOrgs] = useState<SubOrg[]>([]);
  const [parentOrg, setParentOrg] = useState<SubOrg | null>(null);
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
          region_url: org.region_url || undefined,
        })));

        // Extract parent org if available
        const parent = data.parentOrg || data.parent_org;
        if (parent && parent.id) {
          setParentOrg({
            id: parent.id,
            name: parent.name || parent.id,
            image: parent.image,
            creator_org: parent.creator_org,
            region_url: parent.region_url || undefined,
            isParent: true,
          });
        } else {
          setParentOrg(null);
        }
      } else {
        setSubOrgs([]);
        setParentOrg(null);
      }
    } catch (err) {
      setSubOrgs([]);
      setParentOrg(null);
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
