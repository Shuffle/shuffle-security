/**
 * Hook to fetch and cache agent activity for the incidents context.
 *
 * Polling strategy (detail context only):
 *   - Active @AIAgent mention awaiting a reply  → every 5s
 *   - A run is currently in-flight              → every 5s
 *   - Otherwise                                  → every 60s
 * List/non-detail callers do not poll; they rely on a 60s staleTime.
 */

import { useQuery } from '@tanstack/react-query';
import { searchAgentActivity, AgentRun } from '@/services/agentActivity';
import { getAgentRunsForIncident } from '@/lib/agentParsers';

const AGENT_RUNS_QUERY_KEY = ['agent-activity-incidents'];

export const useIncidentAgentRuns = (
  incidentKey?: string,
  hasPendingAgentMention = false,
) => {
  const isDetailContext = !!incidentKey;

  const { data: allRuns = [], isLoading, error, refetch } = useQuery<AgentRun[]>({
    queryKey: AGENT_RUNS_QUERY_KEY,
    queryFn: async () => {
      const result = await searchAgentActivity({ limit: isDetailContext ? 100 : 50 });
      return result.success ? result.runs : [];
    },
    staleTime: isDetailContext ? 0 : 60_000,
    refetchInterval: isDetailContext
      ? (query) => {
          if (hasPendingAgentMention) return 5_000;
          const runs = (query.state.data as AgentRun[] | undefined) || [];
          const hasInFlight = runs.some((r) => {
            const s = (r.status || '').toUpperCase();
            return s === 'EXECUTING' || s === 'WAITING' || s === 'RUNNING';
          });
          return hasInFlight ? 5_000 : 60_000;
        }
      : false,
    refetchOnWindowFocus: isDetailContext,
    gcTime: 5 * 60_000,
  });

  const runsForIncident = incidentKey
    ? getAgentRunsForIncident(allRuns, incidentKey)
    : [];

  return {
    allRuns,
    runsForIncident,
    isLoading,
    error,
    refetch,
  };
};
