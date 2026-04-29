/**
 * Hook for fetching and managing agent activity data
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { searchAgentActivity, AgentRun, AgentActivityParams } from '@/services/agentActivity';
import { runMatchesSearch } from '@/components/agent/AgentRunResultViewer';
import { getAgentSkipInfo } from '@/lib/agentParsers';

export interface AgentActivityStats {
  totalRuns: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  successRate: number;
  avgDuration: number;
}

export const useAgentActivity = (autoFetch = true) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search query (350ms delay)
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchActivity = useCallback(async (params: AgentActivityParams = {}, append = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await searchAgentActivity({
        limit: 50,
        status: statusFilter,
        ...params,
      });
      if (result.success) {
        setRuns(prev => append ? [...prev, ...result.runs] : result.runs);
        setCursor(result.cursor);
        setHasMore(!!result.cursor && result.runs.length > 0);
      } else {
        setError('Failed to fetch agent activity');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent activity');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const loadMore = useCallback(() => {
    if (cursor && !isLoading) {
      fetchActivity({ cursor }, true);
    }
  }, [cursor, isLoading, fetchActivity]);

  const refresh = useCallback(() => {
    fetchActivity({ cursor: '' });
  }, [fetchActivity]);

  // Compute stats
  const stats: AgentActivityStats = {
    totalRuns: runs.length,
    successCount: runs.filter(r => r.status === 'FINISHED' || r.status === 'SUCCESS').length,
    failedCount: runs.filter(r => r.status === 'FAILED' || r.status === 'ABORTED').length,
    runningCount: runs.filter(r => r.status === 'EXECUTING' || r.status === 'RUNNING').length,
    successRate: runs.length > 0
      ? (runs.filter(r => r.status === 'FINISHED' || r.status === 'SUCCESS').length / runs.length) * 100
      : 0,
    avgDuration: runs.length > 0
      ? runs.reduce((sum, r) => {
          if (r.started_at && r.completed_at) {
            const startSec = Number(r.started_at);
            const endSec = Number(r.completed_at);
            if (!isNaN(startSec) && !isNaN(endSec)) {
              return sum + (endSec - startSec);
            }
          }
          return sum + (r.duration || 0);
        }, 0) / runs.length
      : 0,
  };

  // Filter runs by debounced search query (searches through results too)
  const filteredRuns = useMemo(() => {
    if (!debouncedQuery) return runs;
    return runs.filter(r => runMatchesSearch(r, debouncedQuery));
  }, [runs, debouncedQuery]);

  useEffect(() => {
    if (autoFetch) {
      fetchActivity();
    }
  }, [autoFetch, fetchActivity]);

  return {
    runs: filteredRuns,
    allRuns: runs,
    isLoading,
    error,
    hasMore,
    stats,
    statusFilter,
    searchQuery,
    setStatusFilter,
    setSearchQuery: updateSearchQuery,
    loadMore,
    refresh,
    fetchActivity,
  };
};
