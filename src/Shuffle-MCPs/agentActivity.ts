/**
 * Agent Activity service — standalone fetcher for agent workflow executions.
 *
 * Self-contained: uses only the lib's API_CONFIG / getApiUrl / getAuthHeader
 * so it works in npm consumers without any project-side hooks or contexts.
 */

import { API_CONFIG, getApiUrl, getAuthHeader } from './api';

export interface AgentRunResult {
  action?: {
    app_name?: string;
    label?: string;
    id?: string;
  };
  result?: string;
  status?: string;
}

export interface AgentDecision {
  title?: string;
  description?: string;
  status?: string;
  timestamp?: string | number;
  duration?: number;
  action?: string;
  result?: string;
  tool?: string;
  reason?: string;
  category?: string;
  confidence?: number;
  runs?: string | number;
  fields?: unknown;
  approval_required?: boolean;
  run_details?: unknown;
  [key: string]: unknown;
}

export interface AgentRun {
  execution_id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  result?: string;
  results?: AgentRunResult[];
  decisions?: AgentDecision[];
  execution_argument?: string;
  execution_source?: string;
  authorization?: string;
  workflow?: {
    name?: string;
    description?: string;
    actions?: Array<{
      app_name?: string;
      label?: string;
    }>;
  };
  duration?: number;
}

export interface AgentActivityResponse {
  success: boolean;
  runs: AgentRun[];
  cursor: string;
}

export interface AgentActivityParams {
  cursor?: string;
  limit?: number;
  status?: string;
  startTime?: string;
  endTime?: string;
  suborgRuns?: boolean;
  /** Override the lib's shared apiKey for this call. */
  apiKey?: string;
  /** Override the lib's shared baseUrl for this call. */
  apiBaseUrl?: string;
  /** Optional Shuffle Org ID — sent as the `Org-Id` header. */
  orgId?: string;
  /** Workflow ID to search. Defaults to the synthetic 'AGENT' grouping. */
  workflowId?: string;
}

const resolveUrl = (path: string, baseUrl?: string): string =>
  baseUrl ? `${baseUrl.replace(/\/+$/, '')}${path}` : getApiUrl(path);

const resolveHeaders = (apiKey?: string, orgId?: string): Record<string, string> => {
  const h: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : { ...getAuthHeader() };
  if (orgId) h['Org-Id'] = orgId;
  return h;
};

/**
 * Search agent workflow executions (workflow_id = "AGENT" by default).
 */
export const searchAgentActivity = async (
  params: AgentActivityParams = {}
): Promise<AgentActivityResponse> => {
  const {
    cursor = '',
    limit = 50,
    status = '',
    startTime = '',
    endTime = '',
    suborgRuns = false,
    apiKey,
    apiBaseUrl,
    orgId,
    workflowId = 'AGENT',
  } = params;

  const payload = {
    workflow_id: workflowId,
    cursor,
    limit,
    status,
    start_time: startTime,
    end_time: endTime,
    suborg_runs: suborgRuns,
  };

  const response = await fetch(resolveUrl('/api/v1/workflows/search', apiBaseUrl), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...resolveHeaders(apiKey, orgId),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch agent activity: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    success: data.success ?? false,
    runs: data.runs || [],
    cursor: data.cursor || '',
  };
};

export interface AgentScheduleWorkflow {
  id: string;
  name: string;
  description?: string;
}

/**
 * List workflows of type AGENT_SCHEDULE — used to populate the agentic
 * workflow dropdown in the activity list.
 */
export const listAgentScheduleWorkflows = async (
  params: { apiKey?: string; apiBaseUrl?: string; orgId?: string } = {},
): Promise<AgentScheduleWorkflow[]> => {
  const { apiKey, apiBaseUrl, orgId } = params;
  const response = await fetch(resolveUrl('/api/v1/workflows', apiBaseUrl), {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...resolveHeaders(apiKey, orgId) },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch workflows: ${response.statusText}`);
  }
  const data = await response.json();
  const list: any[] = Array.isArray(data) ? data : (data?.workflows || []);
  return list
    .filter((w) => w && w.workflow_type === 'AGENT_SCHEDULE')
    .map((w) => ({ id: w.id || w._id, name: w.name || 'Untitled', description: w.description }));
};

/** Find the AI Agent action's `input` parameter inside a workflow. */
const findAgentInputParam = (workflow: any): { action: any; param: any } | null => {
  const actions: any[] = workflow?.actions || [];
  for (const a of actions) {
    if ((a?.app_name || '').toLowerCase().includes('ai agent') || a?.app_id === 'shuffle_agent') {
      const params: any[] = a?.parameters || [];
      const p = params.find((x) => x?.name === 'input');
      if (p) return { action: a, param: p };
    }
  }
  return null;
};

/** Fetch a single workflow by ID. */
export const getWorkflow = async (
  workflowId: string,
  params: { apiKey?: string; apiBaseUrl?: string; orgId?: string } = {},
): Promise<any> => {
  const { apiKey, apiBaseUrl, orgId } = params;
  const res = await fetch(resolveUrl(`/api/v1/workflows/${workflowId}`, apiBaseUrl), {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...resolveHeaders(apiKey, orgId) },
  });
  if (!res.ok) throw new Error(`Failed to fetch workflow: ${res.statusText}`);
  return res.json();
};

/** Read the AI Agent prompt from a scheduled agent workflow. */
export const getAgentSchedulePrompt = async (
  workflowId: string,
  params: { apiKey?: string; apiBaseUrl?: string; orgId?: string } = {},
): Promise<{ workflow: any; prompt: string }> => {
  const workflow = await getWorkflow(workflowId, params);
  const found = findAgentInputParam(workflow);
  return { workflow, prompt: String(found?.param?.value || '') };
};

/** Update the AI Agent prompt on a scheduled agent workflow. */
export const updateAgentSchedulePrompt = async (
  workflowId: string,
  newPrompt: string,
  params: { apiKey?: string; apiBaseUrl?: string; orgId?: string } = {},
): Promise<void> => {
  const { apiKey, apiBaseUrl, orgId } = params;
  const workflow = await getWorkflow(workflowId, params);
  const found = findAgentInputParam(workflow);
  if (!found) throw new Error('No AI Agent action found on this workflow');
  // Preserve the trailing instructions appended at schedule time, if present.
  const oldVal = String(found.param.value || '');
  const tailMarker = '\n\nReturn ONLY the final result requested above';
  const tailIdx = oldVal.indexOf(tailMarker);
  const tail = tailIdx >= 0 ? oldVal.slice(tailIdx) : '';
  found.param.value = `${newPrompt}${tail}`;
  const res = await fetch(resolveUrl(`/api/v1/workflows/${workflowId}`, apiBaseUrl), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...resolveHeaders(apiKey, orgId) },
    body: JSON.stringify(workflow),
  });
  if (!res.ok) throw new Error(`Failed to update workflow: ${res.statusText}`);
};

/** Stop the schedule entirely by deleting the wrapper workflow. */
export const stopAgentSchedule = async (
  workflowId: string,
  params: { apiKey?: string; apiBaseUrl?: string; orgId?: string } = {},
): Promise<void> => {
  const { apiKey, apiBaseUrl, orgId } = params;
  const res = await fetch(resolveUrl(`/api/v1/workflows/${workflowId}`, apiBaseUrl), {
    method: 'DELETE',
    credentials: 'include',
    headers: { ...resolveHeaders(apiKey, orgId) },
  });
  if (!res.ok) throw new Error(`Failed to stop schedule: ${res.statusText}`);
};

// Re-export so consumers can read base config if needed.
export { API_CONFIG };

