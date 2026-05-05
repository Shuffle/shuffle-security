/**
 * Agent Activity Service
 * Fetches workflow execution data for the AI agent from the Shuffle API.
 */

import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

export interface AgentRunResult {
  action?: {
    app_name?: string;
    label?: string;
    id?: string;
  };
  result?: string; // JSON string containing the action result
  status?: string;
}

export interface AgentDecision {
  title?: string;
  description?: string;
  status?: string;
  timestamp?: string | number;
  duration?: number; // seconds
  action?: string;
  result?: string;
  tool?: string;
  /** Free-form rationale from the agent — often contains the *why* (e.g. failure reason). */
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
  workflow?: {
    name?: string;
    description?: string;
    actions?: Array<{
      app_name?: string;
      label?: string;
    }>;
  };
  // Duration in seconds
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
}

/**
 * Search agent workflow executions
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
  } = params;

  const payload = {
    workflow_id: 'AGENT',
    cursor,
    limit,
    status,
    start_time: startTime,
    end_time: endTime,
    suborg_runs: suborgRuns,
  };

  const response = await fetch(getApiUrl('/api/v1/workflows/search'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
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
