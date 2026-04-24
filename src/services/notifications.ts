/**
 * Notifications Service
 * Fetches and manages notifications from the Shuffle API.
 */

import { getApiUrl, shuffleFetch } from '@/config/api';

export interface AgentNotification {
  id: string;
  title: string;
  description: string;
  reference_url?: string;
  org_id?: string;
  user_id?: string;
  image?: string;
  created_at: number;
  updated_at: number;
  tags?: string[] | null;
  amount?: number;
  org_notification_id?: string;
  dismissable?: boolean;
  personal?: boolean;
  read?: boolean;

  // Agent-specific fields
  action?: string;
  questions?: string[];
  execution_id?: string;
  workflow_id?: string;
  severity?: string;
  category?: string;
  incident_id?: string;
}

export interface NotificationsResponse {
  success: boolean;
  notifications: AgentNotification[];
}

/**
 * Determine if a notification is an approval request vs a question.
 *
 * Both flows arrive via `?type=agent_question`, so we disambiguate using the
 * signals the backend sets:
 *  - Approvals → severity "medium" and/or wording "approval required"
 *  - Questions → severity "low"  and/or wording "input required"
 *
 * Fall back to the legacy heuristic (presence of a `questions[]` array means
 * it is a question) so older notifications still render correctly.
 */
export const isApprovalNotification = (n: AgentNotification): boolean => {
  const sev = (n.severity || '').toLowerCase().trim();
  if (sev === 'medium') return true;
  if (sev === 'low') return false;

  const haystack = `${n.title || ''} ${n.description || ''}`.toLowerCase();
  if (haystack.includes('approval required')) return true;
  if (haystack.includes('input required')) return false;

  // Legacy fallback: questions[] populated → it's a question.
  return !n.questions || n.questions.length === 0;
};

/**
 * Fetch agent question notifications
 */
export const fetchAgentNotifications = async (): Promise<NotificationsResponse> => {
  const res = await shuffleFetch(
    getApiUrl('/api/v1/notifications?type=agent_question&status=open'),
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch notifications: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    success: data.success ?? false,
    notifications: data.notifications || [],
  };
};

/**
 * Approve an agent action (mark notification as read / acknowledge).
 * Note: this only dismisses the notification locally — to actually let the
 * agent continue, callers should pair this with continueAgentExecution().
 */
export const approveAgentAction = async (notificationId: string): Promise<boolean> => {
  const res = await shuffleFetch(
    getApiUrl(`/api/v1/notifications/${notificationId}/markasread`),
  );
  const data = await res.json();
  return data.success === true;
};

/**
 * Dismiss / clear a notification
 */
export const dismissNotification = async (notificationId: string): Promise<boolean> => {
  const res = await shuffleFetch(
    getApiUrl(`/api/v1/notifications/${notificationId}/markasread`),
  );
  const data = await res.json();
  return data.success === true;
};

/**
 * Parse the agent-approval params out of a notification's reference_url.
 * The Shuffle Core agent emits `/forms/{id}?execution_id=…&authorization=…&decision_id=…`.
 * Returns null if the URL does not look like an agent-approval form.
 */
export const parseAgentApprovalParams = (refUrl: string | undefined | null): {
  executionId: string;
  authorization: string;
  decisionId: string;
} | null => {
  if (!refUrl) return null;
  try {
    // Build a URL — works for both absolute and root-relative paths.
    const u = /^https?:\/\//i.test(refUrl)
      ? new URL(refUrl)
      : new URL(refUrl, 'https://placeholder.local');
    const executionId = u.searchParams.get('execution_id') || '';
    const authorization = u.searchParams.get('authorization') || '';
    const decisionId = u.searchParams.get('decision_id') || '';
    if (!executionId || !authorization) return null;
    return { executionId, authorization, decisionId };
  } catch {
    return null;
  }
};

/**
 * Continue (or reject) an agent execution that is currently waiting on a
 * user decision. Mirrors the Shuffle Core agent approval flow:
 *
 *   GET /api/v1/workflows/{execution_id}/run
 *     ?reference_execution={execution_id}
 *     &authorization={authorization}
 *     &answer={true|false}
 *     &note={"question_0":"…"}
 *     &agentic=true
 *     &decision_id={decision_id}
 *
 * Approve / Deny share the same endpoint — only `answer` and `note` differ.
 */
export const continueAgentExecution = async (params: {
  notification: AgentNotification;
  approve: boolean;
  /** Free-form note (e.g. modified-action text or a "question_N" map). */
  note?: string | Record<string, string>;
}): Promise<boolean> => {
  const { notification, approve, note } = params;

  // Prefer the params on the notification body, then fall back to the
  // ones embedded in the approval form URL (legacy / Shuffle Core path).
  const fromUrl = parseAgentApprovalParams(notification.reference_url);
  const executionId = notification.execution_id || fromUrl?.executionId || '';
  const authorization = fromUrl?.authorization || '';
  const decisionId = fromUrl?.decisionId || '';

  if (!executionId || !authorization) {
    throw new Error(
      'Missing execution_id / authorization for agent continuation. ' +
      'The notification did not include the data needed to resume the run.',
    );
  }

  // Encode `note` consistently. If the caller passed an object (e.g. for
  // question answers) we serialize it as JSON exactly like the original
  // form does: note={"question_0":"..."}.
  let noteParam: string | null = null;
  if (note !== undefined && note !== null) {
    if (typeof note === 'string') {
      if (note.trim()) noteParam = note;
    } else if (typeof note === 'object') {
      noteParam = JSON.stringify(note);
    }
  }

  const qs = new URLSearchParams({
    reference_execution: executionId,
    authorization,
    answer: approve ? 'true' : 'false',
    agentic: 'true',
  });
  if (decisionId) qs.set('decision_id', decisionId);
  if (noteParam) qs.set('note', noteParam);

  const res = await shuffleFetch(
    getApiUrl(`/api/v1/workflows/${executionId}/run?${qs.toString()}`),
  );

  if (!res.ok) {
    throw new Error(`Agent continue failed (${res.status})`);
  }
  // The endpoint returns 200 with an execution body on success — we don't
  // need the body, just the status.
  return true;
};
