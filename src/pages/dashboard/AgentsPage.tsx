/**
 * AgentsPage — thin host wrapper around the reusable `AgentsView` from
 * Shuffle-MCPs. The only host-specific concern left here is wiring
 * scheduling to Shuffle Security's `useScheduleAgentRun` hook. Theme
 * resolution and chip-row persistence now live inside AgentsView itself.
 */

import { useCallback } from 'react';
import { AgentsView, API_CONFIG } from '@/Shuffle-MCPs';
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

  return <AgentsView onSchedule={handleSchedule} globalUrl={API_CONFIG.baseUrl} />;
};

export default AgentsPage;
