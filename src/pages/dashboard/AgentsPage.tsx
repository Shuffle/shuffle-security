/**
 * AgentsPage — standalone full-view of the Shuffle-MCPs AgentUI component.
 *
 * Mirrors the legacy /agents page from Shuffle Core: a single, full-width
 * surface for starting and debugging agent runs, with a list of past
 * executions below. Resumes from `?execution_id=...&authorization=...` URL
 * params.
 */

import { useCallback, useState } from 'react';
import { Box, Stack } from '@mui/material';
import { AgentUI, AgentActivityList, AgentExecutionDrawer } from '@/Shuffle-MCPs';
import type { AgentRun } from '@/Shuffle-MCPs';
import { toast } from '@/Shuffle-MCPs/toast';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';

const AgentsPage = () => {
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [agentView, setAgentView] = useState<'start' | 'simple' | 'detailed'>('start');
  const scheduleAgentRun = useScheduleAgentRun();

  const handleSchedule = useCallback(
    async ({ cron, input }: { cron: string; input: string }) => {
      const { name } = await scheduleAgentRun({ cron, input });
      toast({
        title: 'Schedule started',
        description: `"${name}" will run on \`${cron}\``,
      });
    },
    [scheduleAgentRun],
  );

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', px: { xs: 2, md: 4 }, pt: '5vh', pb: 6 }}>
      <Stack spacing={6} sx={{ maxWidth: 820, mx: 'auto' }}>
        <AgentUI maxWidth={820} onViewChange={setAgentView} onSchedule={handleSchedule} />
        {agentView === 'start' && (
          <Box sx={{ pt: '12vh' }}>
            <AgentActivityList onRunClick={setSelectedRun} />
          </Box>
        )}
      </Stack>

      <AgentExecutionDrawer
        open={selectedRun !== null}
        onClose={() => setSelectedRun(null)}
        run={selectedRun}
      />
    </Box>
  );
};

export default AgentsPage;
