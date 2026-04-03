/**
 * Hook for fetching agent question notifications.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAgentNotifications, type AgentNotification } from '@/services/notifications';

export const useAgentNotifications = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-notifications'],
    queryFn: fetchAgentNotifications,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['agent-notifications'] });
  };

  return {
    notifications: data?.notifications ?? [],
    isLoading,
    error,
    refresh,
  };
};

export type { AgentNotification };
