/**
 * AgentsView — full-page "/agents" experience as a reusable Shuffle-MCPs view.
 *
 * Self-contained equivalent of the legacy AgentsPage in Shuffle Security:
 * an AgentUI on top, list of past agent runs below, plus the execution
 * drawer and an "editing schedule" banner.
 *
 * Scheduling, activity list, execution drawer, schedule edit save, and Local
 * LLM configuration are handled internally. Hosts can still override slots and
 * handlers when they need custom behavior.
 */

import { useCallback, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import AgentUI from '@/Shuffle-MCPs/components/AgentUI';
import AgentActivityList from '@/Shuffle-MCPs/components/AgentActivityList';
import AgentExecutionDrawer from '@/Shuffle-MCPs/components/AgentExecutionDrawer';
import AgentRunDrawer, { type AgentRunDrawerTab } from '@/Shuffle-MCPs/components/AgentRunDrawer';
import LocalLLMConfig from '@/Shuffle-MCPs/components/LocalLLMConfig';
import type { AgentRun } from '@/Shuffle-MCPs/agentActivity';
import type { AgentUIApp, AgentUIProps } from '@/Shuffle-MCPs/components/AgentUI';
import { scheduleAgentRun, updateAgentScheduleConfig } from '@/Shuffle-MCPs/agentActivity';
import { toast } from '@/Shuffle-MCPs/toast';
import type { ShuffleHostProps } from '@/Shuffle-MCPs/host-props';
import { useSyncHostBaseUrl } from '@/Shuffle-MCPs/useSyncHostBaseUrl';

export interface AgentsViewProps extends ShuffleHostProps {
  /**
   * Optional scheduler override. When omitted, AgentsView creates the scheduled
   * AI Agent workflow directly through the Shuffle API.
   */
  onSchedule?: NonNullable<AgentUIProps['onSchedule']>;
  /** Optional Shuffle API key. Falls back to the shared API config/session. */
  apiKey?: string;
  /** Optional Shuffle Org ID — sent as the `Org-Id` header on library fetches. */
  orgId?: string;
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
   * config form. When omitted, the built-in Local LLM configuration UI is shown.
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
  theme,
  colorMode,
  apiKey,
  orgId,
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

  const effectiveSchedule = useCallback<NonNullable<AgentUIProps['onSchedule']>>(
    async (info) => {
      if (onSchedule) return onSchedule(info);
      await scheduleAgentRun({ ...info, apiKey, apiBaseUrl: globalUrl, orgId });
    },
    [onSchedule, apiKey, globalUrl, orgId],
  );

  const effectiveLocalLLMSlot = useMemo(
    () => localLLMSlot ?? (
      <LocalLLMConfig
        compact
        globalUrl={globalUrl}
        userdata={userdata}
        isLoaded={isLoaded}
        isLoggedIn={isLoggedIn}
        serverside={serverside}
        theme={theme}
        colorMode={colorMode}
      />
    ),
    [localLLMSlot, globalUrl, userdata, isLoaded, isLoggedIn, serverside, theme, colorMode],
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
          onSchedule={effectiveSchedule}
          apiKey={apiKey}
          orgId={orgId}
          onChooseLLM={handleChooseLLM}
          hideChooseLLM={hideChooseLLM}
          defaultInput={prefill.input}
          defaultApps={prefill.apps.length > 0 ? prefill.apps : undefined}
          submitOverride={editing ? handleSaveEdit : undefined}
          submitLabel={editing ? 'Save' : undefined}
          submitTooltip={editing ? '⌘+Enter to save' : undefined}
          disableSchedule={Boolean(editing)}
          disableScheduleTooltip={editing ? 'Scheduling is disabled while editing an existing schedule' : undefined}
          theme={theme}
          colorMode={colorMode}
        />
        {agentView === 'start' && (
          <Box sx={{ pt: { xs: 4, md: '8vh' } }}>
            <AgentActivityList
              apiBaseUrl={globalUrl}
              apiKey={apiKey}
              orgId={orgId}
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
        onSchedule={effectiveSchedule}
        apiKey={apiKey}
        orgId={orgId}
        theme={theme}
        colorMode={colorMode}
      />

      <AgentRunDrawer
        open={builtInDrawer.open}
        onClose={() => setBuiltInDrawer((s) => ({ ...s, open: false }))}
        initialTab={builtInDrawer.tab}
        globalUrl={globalUrl}
        localLLMSlot={effectiveLocalLLMSlot}
        permissionsSlot={permissionsSlot}
        theme={theme}
        colorMode={colorMode}
        agentUIProps={{ onSchedule: effectiveSchedule, apiBaseUrl: globalUrl, apiKey, orgId, theme, colorMode }}
      />
    </Box>
  );
};

export default AgentsView;
