/**
 * Hook to fetch and cache agent activity for the incidents context.
 *
 * - When called WITHOUT an incident key (e.g. list views), uses a 60s staleTime
 *   so it fires at most once per minute.
 * - When called WITH an incident key (detail page), polls every 15s and treats
 *   data as immediately stale so in-flight runs become visible quickly.
 */

import { useQuery } from '@tanstack/react-query';
import { searchAgentActivity, AgentRun } from '@/services/agentActivity';
import { getAgentRunsForIncident } from '@/lib/agentParsers';

const AGENT_RUNS_QUERY_KEY = ['agent-activity-incidents'];

export const useIncidentAgentRuns = (incidentKey?: string) => {
  const isDetailContext = !!incidentKey;

  const { data: allRuns = [], isLoading, error, refetch } = useQuery<AgentRun[]>({
    queryKey: AGENT_RUNS_QUERY_KEY,
    queryFn: async () => {
      // Bump the limit on detail pages so we don't miss a fresh in-flight run
      // when there are many recent executions.
      const result = await searchAgentActivity({ limit: isDetailContext ? 100 : 50 });
      return result.success ? result.runs : [];
    },
    // On the incident detail page, refresh aggressively so newly-started runs
    // show up quickly. Poll faster while ANY run is currently in-flight so
    // status flips (Running -> Completed) appear in near real-time.
    staleTime: isDetailContext ? 0 : 60_000,
    refetchInterval: isDetailContext
      ? (query) => {
          const runs = (query.state.data as AgentRun[] | undefined) || [];
          const hasInFlight = runs.some((r) => {
            const s = (r.status || '').toUpperCase();
            return s === 'EXECUTING' || s === 'WAITING' || s === 'RUNNING';
          });
          return hasInFlight ? 4_000 : 15_000;
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
