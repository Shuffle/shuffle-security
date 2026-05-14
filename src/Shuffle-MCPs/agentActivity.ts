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

// Re-export so consumers can read base config if needed.
export { API_CONFIG };
