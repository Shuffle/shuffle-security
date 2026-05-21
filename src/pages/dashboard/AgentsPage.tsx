/**
 * AgentsPage — thin host wrapper around the reusable `AgentsView` from
 * Shuffle-MCPs. Provides Shuffle Security's scheduler implementation.
 */

import { useCallback } from 'react';
import { AgentsView, API_CONFIG } from '@/Shuffle-MCPs';
import type { AgentsViewProps } from '@/Shuffle-MCPs';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';
import { useTheme } from '@/context/ThemeContext';

const AgentsPage = () => {
  const scheduleAgentRun = useScheduleAgentRun();
  const { theme } = useTheme();

  const handleSchedule = useCallback<AgentsViewProps['onSchedule']>(
    async (info) => {
      await scheduleAgentRun(info);
    },
    [scheduleAgentRun],
  );

  return <AgentsView onSchedule={handleSchedule} globalUrl={API_CONFIG.baseUrl} theme={theme} />;
};

export default AgentsPage;
