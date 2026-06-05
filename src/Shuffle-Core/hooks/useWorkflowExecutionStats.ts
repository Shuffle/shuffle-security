/**
 * useWorkflowExecutionStats — generic hook that fetches execution stats
 * for a single workflow via GET /api/v2/workflows/{id}/executions.
 *
 * The endpoint returns a `timeline` array (one bucket per day, last 30 days)
 * which can be graphed AND summed into a single "executions in the last
 * N days" number. This hook exposes both shapes so callers can either
 * render the graph (Assign & Escalate outcome block) or just the total
 * (SIEM/EDR Ingestion Webhook outcome chip).
 */

import { useQuery } from '@tanstack/react-query';
import { getApiUrl, getAuthHeader } from '../api';

export interface WorkflowExecutionTimelinePoint {
  /** Day label, as returned by the API (e.g. "2026-06-04"). */
  key: string;
  /** Number of executions on that day. */
  data: number;
}

export interface WorkflowExecutionStats {
  timeline: WorkflowExecutionTimelinePoint[];
  /** Sum of `timeline[*].data` — total executions in the timeline window. */
  total: number;
  /** Number of days the timeline covers. */
  windowDays: number;
}

const EMPTY: WorkflowExecutionStats = { timeline: [], total: 0, windowDays: 0 };

async function fetchWorkflowExecutionStats(workflowId: string): Promise<WorkflowExecutionStats> {
  try {
    const res = await fetch(
      getApiUrl(`/api/v2/workflows/${workflowId}/executions`),
      { credentials: 'include', headers: { ...getAuthHeader() } },
    );
    if (!res.ok) return EMPTY;
    const data = await res.json();
    const raw: any[] = Array.isArray(data?.timeline) ? data.timeline : [];
    const timeline: WorkflowExecutionTimelinePoint[] = raw.map((p) => ({
      key: String(p?.key ?? ''),
      data: typeof p?.data === 'number' ? p.data : 0,
    }));
    const total = timeline.reduce((sum, p) => sum + p.data, 0);
    return { timeline, total, windowDays: timeline.length };
  } catch {
    return EMPTY;
  }
}

export function useWorkflowExecutionStats(workflowId: string | null | undefined) {
  const query = useQuery<WorkflowExecutionStats>({
    queryKey: ['workflow-execution-stats', workflowId],
    queryFn: () => fetchWorkflowExecutionStats(workflowId as string),
    enabled: !!workflowId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    stats: query.data ?? EMPTY,
    isLoading: !!workflowId && query.isLoading,
    refetch: query.refetch,
  };
}
