/**
 * AgentsPage — thin host wrapper around the reusable `AgentsView` from
 * Shuffle-MCPs. Provides Shuffle Security's scheduler implementation.
 */

import { useCallback } from 'react';
import { AgentsView } from '@/Shuffle-MCPs';
import type { AgentsViewProps } from '@/Shuffle-MCPs';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';

const AgentsPage = () => {
  const scheduleAgentRun = useScheduleAgentRun();

  const handleSchedule = useCallback<AgentsViewProps['onSchedule']>(
    async (info) => {
      await scheduleAgentRun(info);
    },
    [scheduleAgentRun],
  );

  return <AgentsView onSchedule={handleSchedule} />;
};

export default AgentsPage;
