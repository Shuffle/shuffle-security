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
import AgentRunDiagnosisBanner from '@/components/agent/AgentRunDiagnosisBanner';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { askAI } from '@/services/ai';
import { toast } from '@/Shuffle-MCPs/toast';

const uuid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const AgentsPage = () => {
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [agentView, setAgentView] = useState<'start' | 'simple' | 'detailed'>('start');

  const handleSchedule = useCallback(async ({ cron, input }: { cron: string; input: string }) => {
    // 1. Generate a SHORT name + description with the same internal LLM caller
    //    we use on the Pipelines page.
    let name = 'Scheduled Agent Run';
    let description = input.slice(0, 140);
    try {
      const { success, result } = await askAI({
        query: `Generate a SHORT workflow name and a one-sentence description for the following scheduled AI Agent prompt. Respond ONLY as JSON in this exact shape, no markdown: {"name":"<max 6 words>","description":"<max 20 words>"}.\n\nPrompt:\n${input}`,
        outputFormat: 'json',
      });
      if (success && result) {
        const cleaned = result.replace(/^```[^\n]*\n?/i, '').replace(/\n?```$/i, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed?.name) name = String(parsed.name).slice(0, 80);
          if (parsed?.description) description = String(parsed.description).slice(0, 240);
        } catch {
          /* fall through to defaults */
        }
      }
    } catch (e) {
      console.warn('[schedule] AI name generation failed, using fallback', e);
    }

    // 2. Create the workflow.
    const createRes = await fetch(getApiUrl('/api/v1/workflows'), {
      method: 'POST',
      credentials: 'include',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!createRes.ok) throw new Error(`Create workflow failed (${createRes.status})`);
    const created = await createRes.json();
    const workflowId: string = created.id || created._id || created.workflow_id;
    if (!workflowId) throw new Error('Workflow created but no id returned');

    // 3. Build trigger + action + branch and PUT the full workflow.
    const triggerId = uuid();
    const actionId = uuid();
    const branchId = uuid();

    const trigger = {
      app_name: 'Schedule',
      app_version: '1.0.0',
      environment: 'cloud',
      id_: triggerId,
      _id_: triggerId,
      id: triggerId,
      finished: true,
      label: name,
      type: 'TRIGGER',
      is_valid: true,
      trigger_type: 'SCHEDULE',
      status: 'running',
      name: 'Schedule',
      parameters: [
        { name: 'cron', example: '', value: cron },
        { name: 'execution_argument', example: '', value: '' },
      ],
      position: { x: 254, y: 617 },
      flowOrientation: 'horizontal',
    };

    const action = {
      name: 'Run LLM',
      label: 'AI_Agent_1',
      app_name: 'AI Agent',
      app_version: '1.0.0',
      app_id: 'shuffle_agent',
      description: 'Run an LLM query against any tool you want',
      environment: 'Cloud',
      errors: [],
      id_: actionId,
      _id_: actionId,
      id: actionId,
      is_valid: true,
      type: 'ACTION',
      parameters: [
        {
          name: 'app_name',
          value: 'Shuffle AI',
          required: true,
          description: 'The name of the app to run the LLM query against',
        },
        {
          name: 'input',
          value: `${input}\n\nReturn ONLY the final result requested above as raw plain text. Do not include explanations, reasoning steps, preamble, markdown formatting, code fences, or JSON wrapping unless the user explicitly asked for that exact format. If the request implies a list, return one item per line.\n\n$exec`,
          required: true,
          multiline: true,
          description: 'The input data for the LLM query',
        },
        {
          name: 'output_format',
          value: 'raw',
          required: false,
          description: 'Return raw text output instead of JSON',
        },
      ],
      isStartNode: true,
      run_magic_output: false,
      authentication: [],
      example: '',
      category: '',
      authentication_id: '',
      template: false,
      finished: true,
      flowOrientation: 'horizontal',
      position: { x: 517, y: 370 },
      selectedAuthentication: {},
      circleId: uuid(),
      execution_delay: 0,
    };

    const branch = { source_id: triggerId, destination_id: actionId, id: branchId };

    const updated = {
      ...created,
      id: workflowId,
      name,
      description,
      start: actionId,
      workflow_type: 'AGENT_SCHEDULE',
      actions: [action],
      triggers: [trigger],
      branches: [branch],
    };

    const putRes = await fetch(getApiUrl(`/api/v1/workflows/${workflowId}`), {
      method: 'PUT',
      credentials: 'include',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!putRes.ok) throw new Error(`Update workflow failed (${putRes.status})`);

    // 4. Start the schedule. If this fails, roll back by deleting the workflow.
    let schedRes: Response;
    try {
      schedRes = await fetch(getApiUrl(`/api/v1/workflows/${workflowId}/schedule`), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Schedule',
          frequency: 'cron',
          cron,
          execution_argument: '',
          environment: 'cloud',
          id: triggerId,
          start: actionId,
          parameters: [
            { name: 'cron', value: cron },
            { name: 'execution_argument', value: '' },
          ],
        }),
      });
    } catch (err) {
      await fetch(getApiUrl(`/api/v1/workflows/${workflowId}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { ...getAuthHeader() },
      }).catch(() => {});
      throw new Error(
        `Could not reach the scheduler — workflow rolled back. ${err instanceof Error ? err.message : ''}`.trim(),
      );
    }

    if (!schedRes.ok) {
      const errText = await schedRes.text().catch(() => '');
      await fetch(getApiUrl(`/api/v1/workflows/${workflowId}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { ...getAuthHeader() },
      }).catch(() => {});

      let detail = errText;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed?.reason || parsed?.error || parsed?.message || errText;
      } catch {
        /* keep raw text */
      }
      throw new Error(
        `Scheduler rejected the cron \`${cron}\` (HTTP ${schedRes.status})${detail ? `: ${detail}` : ''}. The workflow has been deleted — please adjust the schedule and try again.`,
      );
    }

    toast({
      title: 'Schedule started',
      description: `"${name}" will run on \`${cron}\``,
    });
  }, []);

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
