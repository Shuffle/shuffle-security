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
 * Approvals have an action field or no questions array.
 * Questions have a questions array with items.
 */
export const isApprovalNotification = (n: AgentNotification): boolean => {
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
 * Approve an agent action (mark notification as read / acknowledge)
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
