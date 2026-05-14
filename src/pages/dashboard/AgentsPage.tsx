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
import type { AgentRun, AgentUIApp, AgentUIProps } from '@/Shuffle-MCPs';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';

const AgentsPage = () => {
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [agentView, setAgentView] = useState<'start' | 'simple' | 'detailed'>('start');
  const [prefill, setPrefill] = useState<{ input: string; apps: AgentUIApp[]; key: number }>({
    input: '',
    apps: [],
    key: 0,
  });
  const scheduleAgentRun = useScheduleAgentRun();

  const handleSchedule = useCallback<NonNullable<AgentUIProps['onSchedule']>>(
    async (info) => {
      await scheduleAgentRun(info);
    },
    [scheduleAgentRun],
  );

  const handleTryWorkflow = useCallback(({ prompt, apps }: { prompt: string; apps: string[] }) => {
    setPrefill((prev) => ({
      input: prompt,
      apps: apps.map((name) => ({ name })),
      key: prev.key + 1,
    }));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', px: { xs: 2, md: 4 }, pt: '5vh', pb: 6 }}>
      <Stack spacing={6} sx={{ maxWidth: 820, mx: 'auto' }}>
        <AgentUI
          key={prefill.key}
          maxWidth={820}
          onViewChange={setAgentView}
          onSchedule={handleSchedule}
          defaultInput={prefill.input}
          defaultApps={prefill.apps.length > 0 ? prefill.apps : undefined}
        />
        {agentView === 'start' && (
          <Box sx={{ pt: '12vh' }}>
            <AgentActivityList onRunClick={setSelectedRun} onTryWorkflow={handleTryWorkflow} />
          </Box>
        )}
      </Stack>

      <AgentExecutionDrawer
        open={selectedRun !== null}
        onClose={() => setSelectedRun(null)}
        run={selectedRun}
        onSchedule={handleSchedule}
      />
    </Box>
  );
};

export default AgentsPage;
