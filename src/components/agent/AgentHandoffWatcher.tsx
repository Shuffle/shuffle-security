/**
 * AgentHandoffWatcher — global, app-wide watcher for stuck AI Agent runs that
 * need a human to step in (approval requests + open questions).
 *
 * Mounted once inside DashboardLayout so polling happens for the whole session
 * regardless of which page the user is on. Uses the shared
 * `useAgentNotifications` query so we never double-poll — both this watcher
 * and the dashboard's stat cards subscribe to the same react-query key.
 *
 * Two flows, kept deliberately separate:
 *  1. Approvals — agent wants to perform an action. Toast exposes inline
 *     Approve / Deny so the user can resolve in one click.
 *  2. Questions — agent needs typed answers (note={"question_0":"…"}). We open
 *     the standard `AgentQuestionDialog` directly from the toast so the user
 *     can answer without leaving their current page.
 *
 * UX rules:
 *  - Only toast NEW notifications (tracked per-session in a Set so navigating
 *    back to a page does not re-toast the same handoff).
 *  - Skip toasting on `/dashboard` — the dashboard already surfaces these
 *    prominently, a duplicate toast would be noise.
 *  - Stuck-agent handoffs are intentionally rare, so the toast is sticky
 *    (no auto-dismiss) until the user acts or dismisses it.
 *  - Single component, single source of truth — do not duplicate this logic
 *    elsewhere in the app.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAgentNotifications } from '@/hooks/useNotifications';
import {
  isApprovalNotification,
  approveAgentAction,
  continueAgentExecution,
  type AgentNotification,
} from '@/services/notifications';
import { useAuth } from '@/context/AuthContext';
import AgentQuestionDialog from './AgentQuestionDialog';

const AgentHandoffWatcher = () => {
  const { isAuthenticated, userInfo } = useAuth();
  // GATING: while this flow is still being validated, only surface the
  // sticky toasts to support users. Everyone else gets the inline dashboard
  // experience only. The "(beta — support only)" label in the toast makes
  // this restriction obvious to internal testers.
  const isSupport = userInfo?.support === true;
  // Subscribes to the same shared query as the dashboard. The hook is a no-op
  // network-wise when other consumers are already polling.
  const { notifications, refresh } = useAgentNotifications();
  const location = useLocation();

  // Question that is currently open in the answer dialog (if any).
  const [questionNotification, setQuestionNotification] = useState<AgentNotification | null>(null);

  // IDs we have already toasted this session. Survives route changes but
  // resets on full page reload — which is the right behaviour: if the user
  // refreshes, they probably want a fresh reminder of any open handoffs.
  const toastedIds = useRef<Set<string>>(new Set());
  // First load should NOT toast — otherwise the user gets bombarded with
  // every existing open handoff the moment they sign in. Treat the first
  // batch as the baseline and only toast genuinely new arrivals.
  const seededRef = useRef(false);

  // Submit handler for the question dialog. Mirrors DashboardPage.handleSubmitAnswers
  // exactly so the two entry points stay in lockstep.
  const handleSubmitAnswers = async (notificationId: string, answers: Record<number, string>) => {
    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification) {
      toast.error('Notification no longer available.');
      return;
    }
    try {
      const noteMap: Record<string, string> = {};
      Object.entries(answers).forEach(([idx, value]) => {
        noteMap[`question_${idx}`] = value;
      });
      await continueAgentExecution({
        notification,
        approve: true,
        note: noteMap,
      });
      await approveAgentAction(notificationId).catch(() => { /* non-fatal */ });
      toast.success('Answers submitted — the agent will continue.');
      refresh();
    } catch (err) {
      console.error('[AgentHandoffWatcher] submit answers failed:', err);
      toast.error('Failed to submit answers.');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    // Beta gate — only support users see the global handoff toasts for now.
    if (!isSupport) return;
    if (!notifications || notifications.length === 0) {
      // Mark as seeded even on empty so subsequent arrivals do toast.
      seededRef.current = true;
      return;
    }

    if (!seededRef.current) {
      notifications.forEach((n) => toastedIds.current.add(n.id));
      seededRef.current = true;
      return;
    }

    // Avoid double-toasting on the dashboard — it already shows these inline.
    const onDashboard = location.pathname === '/dashboard' || location.pathname === '/';

    notifications.forEach((n) => {
      if (toastedIds.current.has(n.id)) return;
      toastedIds.current.add(n.id);
      if (onDashboard) return;

      const isApproval = isApprovalNotification(n);
      const toastId = `agent-handoff-${n.id}`;

      if (isApproval) {
        // System #1 — agent wants to perform an action and needs go/no-go.
        // Inline Approve + Deny so the user does not have to context-switch
        // for a single binary decision.
        toast('AI Agent needs approval (beta — support only)', {
          id: toastId,
          description: n.title || n.description || 'An agent action is paused waiting on you.',
          duration: Infinity,
          action: {
            label: 'Approve',
            onClick: async () => {
              try {
                await continueAgentExecution({ notification: n, approve: true });
                await approveAgentAction(n.id).catch(() => { /* non-fatal */ });
                toast.success('Action approved — the agent will continue.');
                refresh();
              } catch (err) {
                console.error('[AgentHandoffWatcher] approve failed:', err);
                toast.error('Failed to approve action.');
              }
            },
          },
          cancel: {
            label: 'Deny',
            onClick: async () => {
              try {
                await continueAgentExecution({ notification: n, approve: false });
                await approveAgentAction(n.id).catch(() => { /* non-fatal */ });
                toast.success('Action denied — the agent will continue accordingly.');
                refresh();
              } catch (err) {
                console.error('[AgentHandoffWatcher] deny failed:', err);
                toast.error('Failed to deny action.');
              }
            },
          },
        });
      } else {
        // System #2 — agent has open questions that require typed answers.
        // Open the standard AgentQuestionDialog right here so the user can
        // answer without losing their current page context.
        toast('AI Agent has a question (beta — support only)', {
          id: toastId,
          description: n.title || n.description || 'An agent run is paused waiting on your input.',
          duration: Infinity,
          action: {
            label: 'Answer',
            onClick: () => setQuestionNotification(n),
          },
          cancel: {
            label: 'Dismiss',
            onClick: () => { /* sonner closes the toast on cancel click */ },
          },
        });
      }
    });
  }, [notifications, isAuthenticated, isSupport, location.pathname, refresh]);

  return (
    <AgentQuestionDialog
      open={!!questionNotification}
      onClose={() => setQuestionNotification(null)}
      notification={questionNotification}
      onSubmit={handleSubmitAnswers}
    />
  );
};

export default AgentHandoffWatcher;
