/**
 * Watches platform state (workflows, agent notifications, route changes,
 * etc.) and keeps the current required tour step's completion in sync with
 * the live state — both directions. If the user reverts the action (e.g.
 * re-stops the webhook after starting it), the step flips back to
 * "Required to continue".
 *
 * Mounted once near the DemoProvider so it's always running while the demo
 * tour is open.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDemo, TOUR_STEPS } from '@/context/DemoContext';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAgentNotifications } from '@/hooks/useNotifications';
import { isWorkflowScheduleStopped } from '@/lib/ingestionDetection';
import { seedDemoWazuhImplantIncident } from '@/services/demoMode';

/** How long the user must dwell on the incident-detail step before the
 *  Wazuh / Sliver follow-up incident is auto-seeded ("arrives" mid-investigation). */
const WAZUH_FOLLOWUP_DELAY_MS = 8000;

export const DemoCompletionWatcher = () => {
  const { drawerOpen, step, setStepCompleted, markStepCompleted } = useDemo();
  const { data: workflows } = useWorkflows();
  const { notifications } = useAgentNotifications();
  const queryClient = useQueryClient();
  const location = useLocation();
  const wazuhSeededRef = useRef(false);

  // ─── ingest-webhook: bidirectional sync with the live workflow state ──────
  // Mark complete when the Ingestion Webhook workflow exists AND its trigger
  // is started. Mark incomplete when it's missing or stopped again.
  useEffect(() => {
    if (!drawerOpen || !workflows) return;
    const webhookWf = workflows.find(w => w.name === 'Ingestion Webhook');
    const done = !!webhookWf && !isWorkflowScheduleStopped(webhookWf);
    setStepCompleted('ingest-webhook', done);
  }, [drawerOpen, workflows, setStepCompleted]);

  // Poll workflows so a revert (stopping the webhook again) is picked up
  // quickly without requiring a tab refocus. Only runs while the tour is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    }, 4000);
    return () => clearInterval(id);
  }, [drawerOpen, queryClient]);

  // Note: the `add-outlook` step is marked complete directly from the
  // IncidentsPage AppSearchDrawer override when the user picks Outlook
  // Office365 from the popup (pretend-authenticated for the demo).

  // ─── incidents-list:open — user clicked into an incident detail page ──────
  // The detail page lives at /incidents/:id (and aliases /alerts|tickets|jobs/:id).
  // Detect the route match and flip the sub-goal complete.
  useEffect(() => {
    if (!drawerOpen) return;
    const match = /^\/(?:incidents|alerts|tickets|jobs)\/[^/]+/.test(location.pathname);
    if (match) markStepCompleted('incidents-list:open');
  }, [drawerOpen, location.pathname, markStepCompleted]);

  // ─── Auto-seed the Wazuh / Sliver follow-up incident ──────────────────────
  // Once the user lands on the incident-detail step (i.e. they have opened
  // the phishing focus incident), wait a short beat so they can read it,
  // then drop the critical Wazuh detection into the datastore. This makes
  // the malware finding visibly "arrive" mid-investigation.
  useEffect(() => {
    if (!drawerOpen) return;
    if (wazuhSeededRef.current) return;
    const stepId = TOUR_STEPS[step]?.id;
    if (stepId !== 'incident-detail') return;

    const timer = window.setTimeout(async () => {
      if (wazuhSeededRef.current) return;
      try {
        const added = await seedDemoWazuhImplantIncident();
        wazuhSeededRef.current = true;
        if (added > 0) {
          toast.warning('New critical incident: Wazuh detected a Sliver C2 implant.', {
            duration: 4500,
          });
        }
      } catch {
        // best-effort; don't block the tour
      }
    }, WAZUH_FOLLOWUP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [drawerOpen, step]);

  // ─── agent: at least one approval notification has been cleared ───────────
  // Snapshot the open approvals when the user lands on the step, then mark
  // complete the moment the count drops.
  useEffect(() => {
    if (!drawerOpen) return;
    const initial = notifications.filter(n => !n.questions || n.questions.length === 0).length;
    let last = initial;
    const id = setInterval(() => {
      const cur = notifications.filter(n => !n.questions || n.questions.length === 0).length;
      if (cur < last) {
        markStepCompleted('agent');
      }
      last = cur;
    }, 1500);
    return () => clearInterval(id);
  }, [drawerOpen, notifications, markStepCompleted]);

  return null;
};

export default DemoCompletionWatcher;
