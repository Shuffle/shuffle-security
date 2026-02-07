/**
 * Hook to fetch and cache agent activity for the incidents context.
 * Uses React Query with a 60-second staleTime so it fires at most once per minute.
 */

import { useQuery } from '@tanstack/react-query';
import { searchAgentActivity, AgentRun } from '@/services/agentActivity';
import { getAgentRunsForIncident } from '@/lib/agentParsers';

const AGENT_RUNS_QUERY_KEY = ['agent-activity-incidents'];

/**
 * Fetch all recent agent runs (cached globally, max once per 60 s).
 * Call this from any component that needs agent run data for incidents.
 */
export const useIncidentAgentRuns = (incidentKey?: string) => {
  const { data: allRuns = [], isLoading, error } = useQuery<AgentRun[]>({
    queryKey: AGENT_RUNS_QUERY_KEY,
    queryFn: async () => {
      const result = await searchAgentActivity({ limit: 50 });
      return result.success ? result.runs : [];
    },
    staleTime: 60_000, // 60 seconds — won't refetch more than once per minute
    gcTime: 5 * 60_000, // keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // If an incident key is provided, filter to runs that reference it
  const runsForIncident = incidentKey
    ? getAgentRunsForIncident(allRuns, incidentKey)
    : [];

  return {
    allRuns,
    runsForIncident,
    isLoading,
    error,
  };
};
