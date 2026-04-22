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
import { useEntityPreference } from '@/hooks/useEntityLabel';

/** How long the user must dwell on the incident-detail step before the
 *  Wazuh / Sliver follow-up incident is auto-seeded ("arrives" mid-investigation). */
const WAZUH_FOLLOWUP_DELAY_MS = 8000;

export const DemoCompletionWatcher = () => {
  const { drawerOpen, step, setStepCompleted, markStepCompleted } = useDemo();
  const { data: workflows } = useWorkflows();
  const { notifications } = useAgentNotifications();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { basePath: entityBasePath } = useEntityPreference();
  const wazuhSeededRef = useRef(false);

  // ─── welcome: bidirectional sync — the user must navigate to the Incidents
  // page from the sidebar themselves. Completes the moment the route matches
  // the configured incidents base path (or any sub-route under it). Reverts
  // to incomplete if they leave again, so the gate stays honest.
  useEffect(() => {
    if (!drawerOpen) return;
    const onIncidents =
      location.pathname === entityBasePath ||
      location.pathname.startsWith(entityBasePath + '/');
    setStepCompleted('welcome', onIncidents);
  }, [drawerOpen, location.pathname, entityBasePath, setStepCompleted]);

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

  // Note: the `incidents-list:open` sub-goal is no longer set here. It is
  // computed live from the current route in DemoContext (`isOnIncidentDetail`)
  // so leaving the detail page reverts the gate immediately.

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
          toast.warning('New critical incident: Sliver C2 implant detected.', {
            duration: 4500,
          });
        }
      } catch {
        // best-effort; don't block the tour
      }
    }, WAZUH_FOLLOWUP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [drawerOpen, step]);

  // ─── incident-detail — auto-complete once the Activity feed is visible ────
  // The step has a `requirement.targetSelector` so the spotlight points at
  // the Activity feed, but we don't want to *block* Next on it. Mark complete
  // as soon as the feed exists in the DOM (i.e. user is on the detail page).
  useEffect(() => {
    if (!drawerOpen) return;
    const stepId = TOUR_STEPS[step]?.id;
    if (stepId !== 'incident-detail') return;
    const id = window.setInterval(() => {
      const el = document.querySelector('[data-tour="incident-activity-feed"]');
      if (el) {
        markStepCompleted('incident-detail');
        window.clearInterval(id);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [drawerOpen, step, markStepCompleted]);

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
