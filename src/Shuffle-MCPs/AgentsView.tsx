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

import { useCallback, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import AgentUI from './AgentUI';
import AgentActivityList from './AgentActivityList';
import AgentExecutionDrawer from './AgentExecutionDrawer';
import AgentRunDrawer, { type AgentRunDrawerTab } from './AgentRunDrawer';
import type { AgentRun } from './agentActivity';
import type { AgentUIApp, AgentUIProps } from './AgentUI';
import { updateAgentScheduleConfig } from './agentActivity';
import { toast } from './toast';
import type { ShuffleHostProps } from './host-props';
import { useSyncHostBaseUrl } from './useSyncHostBaseUrl';

export interface AgentsViewProps extends ShuffleHostProps {
  /**
   * Required scheduler implementation. Receives the cron + prompt + apps
   * from AgentUI and is responsible for creating the underlying scheduled
   * workflow on the host backend.
   */
  onSchedule: NonNullable<AgentUIProps['onSchedule']>;
  /** Override max content width of the inner stack. Defaults to 820. */
  maxWidth?: number;
  /**
   * Optional handler for the "Choose LLM" chip. Forwarded to the embedded
   * AgentUI. When omitted, AgentsView mounts its own internal
   * `AgentRunDrawer` and opens it on the Local LLM tab — so the chip
   * always does *something*, even on hosts that haven't wired a picker.
   * Pass this prop to override with your own LLM picker, or set
   * `hideChooseLLM` to remove the chip entirely.
   */
  onChooseLLM?: () => void;
  /** Hide the "Choose LLM" chip in the embedded AgentUI. */
  hideChooseLLM?: boolean;
  /**
   * Content rendered inside the built-in AgentRunDrawer's Local LLM tab
   * when no `onChooseLLM` is provided. Use to plug in your own local LLM
   * config form. When omitted, a minimal built-in placeholder is shown.
   */
  localLLMSlot?: React.ReactNode;
  /** Content for the built-in AgentRunDrawer's Permissions tab. Optional. */
  permissionsSlot?: React.ReactNode;
}

const AgentsView = ({
  onSchedule,
  maxWidth = 820,
  onChooseLLM,
  hideChooseLLM,
  localLLMSlot,
  permissionsSlot,
  globalUrl,
  isLoaded,
  isLoggedIn,
  userdata,
  serverside,
}: AgentsViewProps) => {
  useSyncHostBaseUrl(globalUrl);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [agentView, setAgentView] = useState<'start' | 'simple' | 'detailed'>('start');
  const [prefill, setPrefill] = useState<{ input: string; apps: AgentUIApp[]; key: number }>({
    input: '',
    apps: [],
    key: 0,
  });
  const [editing, setEditing] = useState<{ workflowId: string; name: string } | null>(null);

  // Built-in fallback drawer for "Choose LLM" / Permissions when the host
  // didn't wire its own handler. Ensures the chip is never a dead click.
  const [builtInDrawer, setBuiltInDrawer] = useState<{ open: boolean; tab: AgentRunDrawerTab }>({
    open: false,
    tab: 'localLLM',
  });

  const effectiveLocalLLMSlot = useMemo(
    () =>
      localLLMSlot ?? (
        <Box sx={{ p: 3, color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))', mb: 1 }}>
            Local LLM not configured
          </Typography>
          This host hasn't wired a Local LLM picker yet. Pass an{' '}
          <code style={{ fontFamily: 'monospace' }}>onChooseLLM</code> handler or a{' '}
          <code style={{ fontFamily: 'monospace' }}>localLLMSlot</code> to{' '}
          <code style={{ fontFamily: 'monospace' }}>&lt;AgentsView /&gt;</code> to render your own configuration UI here.
        </Box>
      ),
    [localLLMSlot],
  );

  const handleChooseLLM = useCallback(() => {
    if (onChooseLLM) {
      onChooseLLM();
      return;
    }
    setBuiltInDrawer({ open: true, tab: 'localLLM' });
  }, [onChooseLLM]);

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
    <Box sx={{ minHeight: '100%', width: '100%', px: { xs: 2, md: 4 }, pt: { xs: 3, md: '5vh' }, pb: 6, boxSizing: 'border-box' }}>
      <Stack spacing={6} sx={{ maxWidth, mx: 'auto', width: '100%' }}>
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
          onChooseLLM={handleChooseLLM}
          hideChooseLLM={hideChooseLLM}
          defaultInput={prefill.input}
          defaultApps={prefill.apps.length > 0 ? prefill.apps : undefined}
          submitOverride={editing ? handleSaveEdit : undefined}
          submitLabel={editing ? 'Save' : undefined}
          submitTooltip={editing ? '⌘+Enter to save' : undefined}
          disableSchedule={Boolean(editing)}
          disableScheduleTooltip={editing ? 'Scheduling is disabled while editing an existing schedule' : undefined}
        />
        {agentView === 'start' && (
          <Box sx={{ pt: { xs: 4, md: '8vh' } }}>
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
        apiBaseUrl={globalUrl}
        onSchedule={onSchedule}
      />

      <AgentRunDrawer
        open={builtInDrawer.open}
        onClose={() => setBuiltInDrawer((s) => ({ ...s, open: false }))}
        initialTab={builtInDrawer.tab}
        globalUrl={globalUrl}
        localLLMSlot={effectiveLocalLLMSlot}
        permissionsSlot={permissionsSlot}
        agentUIProps={{ onSchedule, apiBaseUrl: globalUrl }}
      />
    </Box>
  );
};

export default AgentsView;
