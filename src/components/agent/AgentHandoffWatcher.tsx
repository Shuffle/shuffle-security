/**
 * AgentHandoffWatcher — global, app-wide watcher for stuck AI Agent runs that
 * need a human to step in (approval requests + open questions).
 *
 * Mounted once inside DashboardLayout so polling happens for the whole session
 * regardless of which page the user is on. Uses the shared
 * `useAgentNotifications` query so we never double-poll — both this watcher
 * and the dashboard's stat cards subscribe to the same react-query key.
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
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAgentNotifications } from '@/hooks/useNotifications';
import { isApprovalNotification } from '@/services/notifications';
import { useEntityPreference } from '@/hooks/useEntityLabel';
import { useAuth } from '@/context/AuthContext';

const AgentHandoffWatcher = () => {
  const { isAuthenticated } = useAuth();
  // Subscribes to the same shared query as the dashboard. The hook is a no-op
  // network-wise when other consumers are already polling.
  const { notifications } = useAgentNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const { basePath: entityBasePath } = useEntityPreference();

  // IDs we have already toasted this session. Survives route changes but
  // resets on full page reload — which is the right behaviour: if the user
  // refreshes, they probably want a fresh reminder of any open handoffs.
  const toastedIds = useRef<Set<string>>(new Set());
  // First load should NOT toast — otherwise the user gets bombarded with
  // every existing open handoff the moment they sign in. Treat the first
  // batch as the baseline and only toast genuinely new arrivals.
  const seededRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
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
      const headline = isApproval
        ? 'AI Agent needs approval'
        : 'AI Agent has a question';
      const body = n.title || n.description || 'An agent run is paused waiting on you.';

      // Where to send the user: the linked incident if we have one, otherwise
      // the global Agent activity page where they can resolve the handoff.
      const target = n.incident_id
        ? `${entityBasePath}/${n.incident_id}`
        : '/agent';

      toast(headline, {
        id: `agent-handoff-${n.id}`,
        description: body,
        duration: Infinity,
        action: {
          label: 'Open',
          onClick: () => navigate(target),
        },
        cancel: {
          label: 'Dismiss',
          onClick: () => { /* sonner closes the toast on cancel click */ },
        },
      });
    });
  }, [notifications, isAuthenticated, location.pathname, entityBasePath, navigate]);

  return null;
};

export default AgentHandoffWatcher;
