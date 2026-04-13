/**
 * Agent Run Service
 * Shared logic for calling the /api/v1/agent JSON-RPC endpoint
 * and parsing the response into a usable format.
 */

import { getApiUrl, getAuthHeader } from '@/config/api';

// ── Request types ──────────────────────────────────────────────────────────────

export interface AgentRunRequest {
  /** The user's prompt / instruction */
  input: string;
  /** Optional: target a single app */
  toolName?: string;
  toolId?: string;
  /** Optional: target multiple apps */
  toolNames?: string[];
  toolIds?: string[];
}

// ── Response types ─────────────────────────────────────────────────────────────

export interface AgentRunResponse {
  success: boolean;
  /** Parsed, human-readable output content */
  content: string;
  /** The raw parsed JSON (if response was JSON), for further inspection */
  rawData?: unknown;
  /** Error message if success is false */
  error?: string;
  /** HTTP status code of the response */
  status: number;
}

// ── Response parser ────────────────────────────────────────────────────────────

/**
 * Parse a JSON-RPC agent response into human-readable content.
 * Extracts the most useful information from the nested response structure.
 */
export const parseAgentResponse = (data: unknown): string => {
  if (typeof data === 'string') return data;
  if (data == null) return 'No output returned.';

  const obj = data as Record<string, unknown>;

  // JSON-RPC result field
  if (obj.result !== undefined) {
    const result = obj.result;

    if (typeof result === 'string') return result || 'No output returned.';

    if (typeof result === 'object' && result !== null) {
      const r = result as Record<string, unknown>;
      const parts: string[] = [];

      // Extract message first (most useful field)
      if (r.message && typeof r.message === 'string') {
        parts.push(r.message);
      }

      // Append any remaining fields as structured JSON
      const rest = { ...r };
      delete rest.message;
      if (Object.keys(rest).length > 0) {
        parts.push(JSON.stringify(rest, null, 2));
      }

      return parts.join('\n\n') || 'No output returned.';
    }

    return String(result);
  }

  // Fallback: top-level message
  if (obj.message && typeof obj.message === 'string') return obj.message;

  // Fallback: dump entire response
  return JSON.stringify(data, null, 2);
};

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Run the agent with the given input and optional tool targets.
 * Handles the full lifecycle: build payload → fetch → parse response.
 */
export const runAgent = async (request: AgentRunRequest): Promise<AgentRunResponse> => {
  const params: Record<string, unknown> = {
    input: { text: request.input },
  };

  // Single tool target
  if (request.toolName) {
    params.tool_name = request.toolName;
  }
  if (request.toolId) {
    params.tool_id = request.toolId;
  }

  // Multiple tool targets
  if (request.toolNames && request.toolNames.length > 0) {
    params.tool_names = request.toolNames;
  }
  if (request.toolIds && request.toolIds.length > 0) {
    params.tool_ids = request.toolIds;
  }

  const payload = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params,
  };

  try {
    const response = await fetch(getApiUrl('/api/v1/agent'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    const contentType = response.headers.get('content-type');

    // Non-OK status
    if (!response.ok) {
      return {
        success: false,
        content: '',
        error: `Error ${response.status}: ${rawText || response.statusText}`,
        status: response.status,
      };
    }

    // Non-JSON response (HTML redirect, plain text, etc.)
    if (!contentType?.includes('application/json')) {
      if (rawText.trim().startsWith('<!') || rawText.includes('<html')) {
        return {
          success: false,
          content: '',
          error: 'Received an unexpected HTML response. This may indicate an auth redirect or server issue.',
          status: response.status,
        };
      }
      // Plain text is still valid output
      return {
        success: true,
        content: rawText,
        status: response.status,
      };
    }

    // JSON response — parse and extract content
    const data = JSON.parse(rawText);
    const content = parseAgentResponse(data);

    return {
      success: true,
      content,
      rawData: data,
      status: response.status,
    };
  } catch (err) {
    return {
      success: false,
      content: '',
      error: `Network error — could not reach the agent. ${err instanceof Error ? err.message : ''}`,
      status: 0,
    };
  }
};
