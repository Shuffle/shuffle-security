/**
 * AgentsView — full-page "/agents" experience as a reusable Shuffle-MCPs view.
 *
 * Self-contained equivalent of the legacy AgentsPage in Shuffle Security:
 * an AgentUI on top, list of past agent runs below, plus the execution
 * drawer and an "editing schedule" banner.
 *
 * The host wires in a scheduler via `onSchedule` (typically
 * useScheduleAgentRun in Shuffle Security). Everything else — activity
 * list, execution drawer, schedule edit save — is handled internally.
 */

import { useCallback, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import AgentUI from './AgentUI';
import AgentActivityList from './AgentActivityList';
import AgentExecutionDrawer from './AgentExecutionDrawer';
import type { AgentRun } from './agentActivity';
import type { AgentUIApp, AgentUIProps } from './AgentUI';
import { updateAgentScheduleConfig } from './agentActivity';
import { toast } from './toast';
import type { ShuffleHostProps } from './host-props';

export interface AgentsViewProps extends ShuffleHostProps {
  /**
   * Required scheduler implementation. Receives the cron + prompt + apps
   * from AgentUI and is responsible for creating the underlying scheduled
   * workflow on the host backend.
   */
  onSchedule: NonNullable<AgentUIProps['onSchedule']>;
  /** Override max content width of the inner stack. Defaults to 820. */
  maxWidth?: number;
}

const AgentsView = ({ onSchedule, maxWidth = 820, globalUrl, isLoaded, isLoggedIn, userdata, serverside }: AgentsViewProps) => {
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [agentView, setAgentView] = useState<'start' | 'simple' | 'detailed'>('start');
  const [prefill, setPrefill] = useState<{ input: string; apps: AgentUIApp[]; key: number }>({
    input: '',
    apps: [],
    key: 0,
  });
  const [editing, setEditing] = useState<{ workflowId: string; name: string } | null>(null);

  const handleEditWorkflow = useCallback(
    ({ workflowId, name, prompt, apps }: { workflowId: string; name: string; prompt: string; apps: Array<{ name: string; id?: string }> }) => {
      setEditing({ workflowId, name });
      setPrefill((prev) => ({
        input: prompt,
        apps: apps.map((a) => ({ name: a.name, id: a.id })),
        key: prev.key + 1,
      }));
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

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
      <Stack spacing={6} sx={{ maxWidth, mx: 'auto' }}>
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
          maxWidth={maxWidth}
          apiBaseUrl={globalUrl}
          onViewChange={setAgentView}
          onSchedule={onSchedule}
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
              apiBaseUrl={globalUrl}
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
        onSchedule={onSchedule}
      />
    </Box>
  );
};

export default AgentsView;
