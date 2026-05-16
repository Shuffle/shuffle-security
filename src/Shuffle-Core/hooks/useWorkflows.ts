import { useQuery } from '@tanstack/react-query';
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

const fetchWorkflows = async (): Promise<WorkflowSummary[]> => {
  const res = await fetch(getApiUrl('/api/v1/workflows'), {
    credentials: 'include',
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.workflows || []);
  return list;
};

export const useWorkflows = () => {
  return useQuery<WorkflowSummary[]>({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
  });
};
