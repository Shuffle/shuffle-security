/**
 * useScheduleAgentRun — shared handler that turns an AgentUI prompt + cron
 * expression into a real Shuffle SCHEDULE workflow. Used by both the
 * /agents page and the global agent drawer so scheduling works anywhere
 * the user can start or debug an agent.
 *
 * Behavior:
 *  1. Generate a short name + description from the prompt via the internal
 *     LLM gateway (falls back gracefully on failure).
 *  2. POST /api/v1/workflows to create the wrapper workflow.
 *  3. PUT /api/v1/workflows/:id with a Schedule trigger + AI Agent action +
 *     branch.
 *  4. POST /api/v1/workflows/:id/schedule with the cron in `frequency`.
 *  5. If step 4 fails (network or HTTP), DELETE the workflow and surface a
 *     clear error message including the cron + server reason.
 */

import { useCallback } from 'react';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { askAI } from '@/services/ai';

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

export type ScheduleStepId = 'name' | 'workflow' | 'schedule';
export type ScheduleStepState = 'active' | 'done' | 'error';
export interface ScheduleStepEvent {
  id: ScheduleStepId;
  state: ScheduleStepState;
  detail?: string;
}

export interface ScheduleAgentRunArgs {
  cron: string;
  input: string;
  onStep?: (event: ScheduleStepEvent) => void;
}

export const useScheduleAgentRun = () => {
  return useCallback(async ({ cron, input, onStep }: ScheduleAgentRunArgs) => {
    const step = (id: ScheduleStepId, state: ScheduleStepState, detail?: string) => {
      try { onStep?.({ id, state, detail }); } catch { /* ignore */ }
    };

    // 1. Short name + description (raw text response, parsed locally).
    step('name', 'active');
    let name = 'Scheduled Agent Run';
    let description = (input || '').slice(0, 140);
    try {
      const { success, result } = await askAI({
        query: `Generate a SHORT workflow name (max 6 words) and a one-sentence description (max 20 words) for the following scheduled AI Agent prompt.\n\nReturn ONLY two lines of raw plain text in this EXACT format, with no markdown, no code fences, no JSON, no extra commentary:\nName: <the name>\nDescription: <the description>\n\nPrompt:\n${input}`,
        outputFormat: 'raw',
      });
      if (success && result) {
        const nameMatch = result.match(/^\s*Name\s*:\s*(.+?)\s*$/im);
        const descMatch = result.match(/^\s*Description\s*:\s*(.+?)\s*$/im);
        if (nameMatch?.[1]) name = nameMatch[1].replace(/^["']|["']$/g, '').slice(0, 80);
        if (descMatch?.[1]) description = descMatch[1].replace(/^["']|["']$/g, '').slice(0, 240);
      }
    } catch (e) {
      console.warn('[schedule] AI name generation failed, using fallback', e);
    }
    step('name', 'done', name);

    // 2. Create the workflow.
    step('workflow', 'active');
    const createRes = await fetch(getApiUrl('/api/v1/workflows'), {
      method: 'POST',
      credentials: 'include',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!createRes.ok) {
      step('workflow', 'error', `HTTP ${createRes.status}`);
      throw new Error(`Create workflow failed (${createRes.status})`);
    }
    const created = await createRes.json();
    const workflowId: string = created.id || created._id || created.workflow_id;
    if (!workflowId) {
      step('workflow', 'error', 'no id returned');
      throw new Error('Workflow created but no id returned');
    }

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
    if (!putRes.ok) {
      step('workflow', 'error', `HTTP ${putRes.status}`);
      throw new Error(`Update workflow failed (${putRes.status})`);
    }
    step('workflow', 'done', name);

    // 4. Start the schedule. If this fails, roll back by deleting the workflow.
    step('schedule', 'active');
    let schedRes: Response;
    try {
      schedRes = await fetch(getApiUrl(`/api/v1/workflows/${workflowId}/schedule`), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Schedule',
          frequency: cron,
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

    return { workflowId, name, cron };
  }, []);
};
