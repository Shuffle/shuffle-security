import { useQueries, useQuery } from '@tanstack/react-query';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  is_valid: boolean;
  actions?: any[];
  triggers?: any[];
  tags?: string[];
  background_processing?: boolean;
  [key: string]: any;
}

const fetchWorkflows = async (orgId?: string): Promise<WorkflowSummary[]> => {
  const headers: Record<string, string> = { ...getAuthHeader() };
  if (orgId) headers['Org-Id'] = orgId;
  const res = await fetch(getApiUrl('/api/v1/workflows'), {
    credentials: 'include',
    headers,
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.workflows || []);
  return list;
};

export const useWorkflows = (orgId?: string) => {
  return useQuery<WorkflowSummary[]>({
    queryKey: ['workflows', orgId || 'active'],
    queryFn: () => fetchWorkflows(orgId),
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch workflows for multiple orgs in parallel. Returns a map of orgId ->
 * workflows list. Used by multi-tenant automation validation on incidents
 * that live in more than one tenant.
 */
export const useWorkflowsMulti = (orgIds: string[]) => {
  const queries = useQueries({
    queries: orgIds.map((oid) => ({
      queryKey: ['workflows', oid],
      queryFn: () => fetchWorkflows(oid),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });
  const isLoading = queries.some((q) => q.isLoading);
  const byOrg: Record<string, WorkflowSummary[]> = {};
  orgIds.forEach((oid, idx) => {
    byOrg[oid] = queries[idx]?.data || [];
  });
  const refetchAll = async () => {
    await Promise.allSettled(queries.map((q) => q.refetch()));
  };
  return { byOrg, isLoading, refetchAll };
};
