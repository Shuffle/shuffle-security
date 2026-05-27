/**
 * Agent Run Service
 * Shared logic for calling the /api/v1/agent JSON-RPC endpoint
 * and parsing the response into a usable format.
 */

import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

// ── Request types ──────────────────────────────────────────────────────────────

/**
 * MCP-spec image content block.
 * @see https://modelcontextprotocol.io specification — Image Content
 */
export interface AgentImageInput {
  /** Raw base64 (no data URL prefix) */
  data: string;
  /** e.g. "image/png", "image/jpeg" */
  mimeType: string;
  /** Optional original filename — for UI/debugging only */
  name?: string;
}

export interface AgentRunRequest {
  /** The user's prompt / instruction */
  input: string;
  /** Optional: target a single app */
  toolName?: string;
  toolId?: string;
  /** Optional: target multiple apps */
  toolNames?: string[];
  toolIds?: string[];
  /**
   * Optional: one or more attached images. Sent under
   * `params.input.images` as an array of `{ url, detail }` objects,
   * where `url` is a `data:<mime>;base64,<data>` URL.
   */
  images?: AgentImageInput[];
  /** @deprecated Use `images`. Single base64 data URL kept for back-compat. */
  image?: string;
  /**
   * If true, return the initial response immediately without polling for the
   * final execution result. The caller is then responsible for polling
   * `/api/v1/streams/results` itself (e.g. AgentUI's live timeline).
   */
  skipPolling?: boolean;
  /**
   * Optional per-call overrides so callers (e.g. embedded `AgentUI`) can
   * point at a different Shuffle backend without mutating the global
   * `API_CONFIG`. When omitted, falls back to `getApiUrl` / `getAuthHeader`.
   */
  apiKey?: string;
  apiBaseUrl?: string;
  orgId?: string;
  /** Optional AbortSignal so callers can cancel the in-flight request. */
  signal?: AbortSignal;
}

/** Build URL + headers honouring optional per-call overrides. */
const resolveTarget = (
  path: string,
  opts: { apiKey?: string; apiBaseUrl?: string; orgId?: string } = {},
): { url: string; headers: Record<string, string> } => {
  const url = opts.apiBaseUrl
    ? `${opts.apiBaseUrl.replace(/\/+$/, '')}${path}`
    : getApiUrl(path);
  const headers: Record<string, string> = opts.apiKey
    ? { Authorization: `Bearer ${opts.apiKey}` }
    : { ...getAuthHeader() };
  if (opts.orgId) headers['Org-Id'] = opts.orgId;
  return { url, headers };
};

/** Split a `data:<mime>;base64,<data>` URL into its mime + base64 parts. */
const parseDataUrl = (dataUrl: string): AgentImageInput | null => {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
};

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

// ── Execution poller ───────────────────────────────────────────────────────────

/**
 * Poll /api/v1/streams/results for the real execution result.
 * Retries up to `maxAttempts` with `intervalMs` between each.
 */
const pollExecutionResult = async (
  executionId: string,
  {
    maxAttempts = 15,
    intervalMs = 2000,
    apiKey,
    apiBaseUrl,
    orgId,
  }: { maxAttempts?: number; intervalMs?: number; apiKey?: string; apiBaseUrl?: string; orgId?: string } = {}
): Promise<AgentRunResponse> => {
  const { url, headers } = resolveTarget('/api/v1/streams/results', { apiKey, apiBaseUrl, orgId });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          execution_id: executionId,
          authorization: executionId,
        }),
      });

      if (!resp.ok) {
        // Non-retryable server error
        if (resp.status >= 400 && resp.status < 500) {
          return {
            success: false,
            content: '',
            error: `Error ${resp.status}: Could not fetch execution result.`,
            status: resp.status,
          };
        }
        // Server error — keep polling
        await delay(intervalMs);
        continue;
      }

      const rawText = await resp.text();
      if (!rawText || rawText === '{}' || rawText === 'null') {
        // Not ready yet
        await delay(intervalMs);
        continue;
      }

      const contentType = resp.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return { success: true, content: rawText, status: resp.status };
      }

      const data = JSON.parse(rawText);

      // Check if execution is still running (no real result yet)
      if (data?.status === 'EXECUTING' || data?.status === 'WAITING') {
        await delay(intervalMs);
        continue;
      }

      const content = parseAgentResponse(data);
      return {
        success: true,
        content,
        rawData: data,
        status: resp.status,
      };
    } catch {
      await delay(intervalMs);
    }
  }

  return {
    success: false,
    content: '',
    error: `Timed out waiting for execution ${executionId} to complete.`,
    status: 0,
  };
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Check if the initial response is an execution stub
 * (contains execution_id but no real result content).
 */
const isExecutionStub = (data: unknown): data is { execution_id: string } => {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.execution_id === 'string' &&
    obj.execution_id.length > 0 &&
    // It's a stub if there's no result/message — just metadata
    obj.result === undefined &&
    obj.message === undefined
  );
};

/**
 * Run the agent with the given input and optional tool targets.
 * Handles the full lifecycle: build payload → fetch → parse response.
 * If the response is an execution stub, polls for the real result.
 */
export const runAgent = async (request: AgentRunRequest): Promise<AgentRunResponse> => {
  const input: Record<string, unknown> = { text: request.input };

  // Collect images: prefer explicit `images` array, fall back to legacy `image` data URL.
  const images: AgentImageInput[] = [];
  if (request.images && request.images.length > 0) {
    images.push(...request.images);
  } else if (request.image && request.image.length > 0) {
    const parsed = parseDataUrl(request.image);
    if (parsed) images.push(parsed);
  }

  // Sent under `params.input.images` as an array of `{ url, detail }` objects
  // so the agent can accept multiple images. `url` is a data URL.
  if (images.length > 0) {
    input.images = images.map((img) => ({
      url: `data:${img.mimeType};base64,${img.data}`,
      detail: 'auto',
    }));
  }

  const params: Record<string, unknown> = { input };

  // Single tool target
  if (request.toolName) params.tool_name = request.toolName;
  if (request.toolId) params.tool_id = request.toolId;

  // Multiple tool targets
  if (request.toolNames && request.toolNames.length > 0) {
    params.tool_names = request.toolNames;
  }
  if (request.toolIds && request.toolIds.length > 0) {
    params.tool_ids = request.toolIds;
  }

  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params,
  };

  const { url: agentUrl, headers: agentHeaders } = resolveTarget('/api/v1/agent', {
    apiKey: request.apiKey,
    apiBaseUrl: request.apiBaseUrl,
    orgId: request.orgId,
  });

  try {
    const response = await fetch(agentUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...agentHeaders,
      },
      body: JSON.stringify(payload),
      signal: request.signal,
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

    // JSON response — parse and check for execution stub
    const data = JSON.parse(rawText);

    if (isExecutionStub(data)) {
      if (request.skipPolling) {
        // Hand control back to the caller (it will poll itself).
        return {
          success: true,
          content: '',
          rawData: data,
          status: response.status,
        };
      }
      console.log(`[AgentRun] Got execution stub, polling for result: ${data.execution_id}`);
      return pollExecutionResult(data.execution_id, {
        apiKey: request.apiKey,
        apiBaseUrl: request.apiBaseUrl,
        orgId: request.orgId,
      });
    }

    const content = parseAgentResponse(data);

    return {
      success: true,
      content,
      rawData: data,
      status: response.status,
    };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return {
      success: false,
      content: '',
      error: aborted
        ? 'Request aborted by user.'
        : `Network error — could not reach the agent. ${err instanceof Error ? err.message : ''}`,
      status: 0,
      ...(aborted ? { aborted: true } as any : {}),
    };
  }
};
