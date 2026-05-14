/**
 * AgentsPage — standalone full-view of the Shuffle-MCPs AgentUI component.
 *
 * Mirrors the legacy /agents page from Shuffle Core: a single, full-width
 * surface for starting and debugging agent runs, with a list of past
 * executions below. Resumes from `?execution_id=...&authorization=...` URL
 * params.
 */

import { useCallback, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { AgentUI, AgentActivityList, AgentExecutionDrawer } from '@/Shuffle-MCPs';
import type { AgentRun, AgentUIApp, AgentUIProps } from '@/Shuffle-MCPs';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';
import { updateAgentScheduleConfig } from '@/Shuffle-MCPs/agentActivity';
import { toast } from '@/Shuffle-MCPs/toast';

const AgentsPage = () => {
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [agentView, setAgentView] = useState<'start' | 'simple' | 'detailed'>('start');
  const [prefill, setPrefill] = useState<{ input: string; apps: AgentUIApp[]; key: number }>({
    input: '',
    apps: [],
    key: 0,
  });
  const [editing, setEditing] = useState<{ workflowId: string; name: string } | null>(null);
  const scheduleAgentRun = useScheduleAgentRun();

  const handleSchedule = useCallback<NonNullable<AgentUIProps['onSchedule']>>(
    async (info) => {
      await scheduleAgentRun(info);
    },
    [scheduleAgentRun],
  );


  const handleEditWorkflow = useCallback(({ workflowId, name, prompt, apps }: { workflowId: string; name: string; prompt: string; apps: Array<{ name: string; id?: string }> }) => {
    setEditing({ workflowId, name });
    setPrefill((prev) => ({
      input: prompt,
      apps: apps.map((a) => ({ name: a.name, id: a.id })),
      key: prev.key + 1,
    }));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSaveEdit = useCallback<NonNullable<AgentUIProps['submitOverride']>>(
    async ({ input, apps }) => {
      if (!editing) return;
      try {
        await updateAgentScheduleConfig(
          editing.workflowId,
          { prompt: input, apps: apps.map((a) => ({ name: a.name, id: a.id })) },
        );
        toast({ title: 'Schedule updated', description: `Saved changes to "${editing.name}".` });
        setEditing(null);
      } catch (e) {
        toast({
          title: 'Failed to save changes',
          description: e instanceof Error ? e.message : String(e),
          variant: 'destructive',
        });
      }
    },
    [editing],
  );

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', px: { xs: 2, md: 4 }, pt: '5vh', pb: 6 }}>
      <Stack spacing={6} sx={{ maxWidth: 820, mx: 'auto' }}>
        {editing && (
          <Box
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
              p: 1.5, borderRadius: 2,
              border: '1px solid hsl(var(--primary) / 0.4)',
              bgcolor: 'hsl(var(--primary) / 0.08)',
            }}
          >
            <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
              Editing schedule: <strong>{editing.name}</strong>
            </Typography>
            <Typography
              component="button"
              onClick={() => { setEditing(null); setPrefill((p) => ({ input: '', apps: [], key: p.key + 1 })); }}
              sx={{
                all: 'unset', cursor: 'pointer', fontSize: '0.8rem',
                color: 'hsl(var(--muted-foreground))',
                '&:hover': { color: 'hsl(var(--foreground))' },
              }}
            >
              Cancel
            </Typography>
          </Box>
        )}
        <AgentUI
          key={prefill.key}
          maxWidth={820}
          onViewChange={setAgentView}
          onSchedule={handleSchedule}
          defaultInput={prefill.input}
          defaultApps={prefill.apps.length > 0 ? prefill.apps : undefined}
          submitOverride={editing ? handleSaveEdit : undefined}
          submitLabel={editing ? 'Save' : undefined}
          submitTooltip={editing ? '⌘+Enter to save' : undefined}
          disableSchedule={Boolean(editing)}
          disableScheduleTooltip={editing ? 'Scheduling is disabled while editing an existing schedule' : undefined}
        />
        {agentView === 'start' && (
          <Box sx={{ pt: '12vh' }}>
            <AgentActivityList
              onRunClick={setSelectedRun}
              onEditWorkflow={handleEditWorkflow}
            />
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
