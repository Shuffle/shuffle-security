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

/** How long after the user asks the agent a question before the Wazuh /
 *  Sliver follow-up incident "arrives" — long enough to feel earned, short
 *  enough that the user does not lose context. */
const WAZUH_FOLLOWUP_DELAY_MS = 6000;

export const DemoCompletionWatcher = () => {
  const { drawerOpen, step, setStepCompleted, markStepCompleted, goToStep, setDock, dock, hoveredGoalSelector } = useDemo();
  const { data: workflows } = useWorkflows();
  const { notifications } = useAgentNotifications();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { basePath: entityBasePath } = useEntityPreference();
  const wazuhSeededRef = useRef(false);
  const autoAdvancedRef = useRef(false);

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

  // ─── auto-advance: when the user opens an incident detail page from any
  // earlier step, jump straight to step 5 (incident-detail) and dock the
  // drawer to the right rail — the timeline is the focus now and the bottom
  // dock would cover it. Re-arms whenever the user leaves the detail page,
  // so coming back jumps them again. We only auto-advance forward, never
  // backward — if they're already past step 5 we leave them alone.
  useEffect(() => {
    if (!drawerOpen) return;
    const onDetail = /^\/(?:incidents|cases|alerts|tickets|jobs)\/[^/]+/.test(location.pathname);
    if (!onDetail) {
      autoAdvancedRef.current = false;
      return;
    }
    if (autoAdvancedRef.current) return;
    const targetIdx = TOUR_STEPS.findIndex(s => s.id === 'incident-detail');
    if (targetIdx < 0) return;
    if (step >= targetIdx) return;
    autoAdvancedRef.current = true;
    if (dock !== 'right') setDock('right');
    // Force-mark the gating sub-goals on the previous step so the forward
    // jump is allowed even if the user hasn't ticked everything off (e.g.
    // they navigated directly into a deep link).
    setStepCompleted('incidents-list:present', true);
    setStepCompleted('incidents-list:open', true);
    // Defer so the unlock state propagates before goToStep evaluates it.
    window.setTimeout(() => goToStep(targetIdx), 0);
  }, [drawerOpen, step, location.pathname, dock, setDock, goToStep, setStepCompleted]);

  // Note: the `add-outlook` step is marked complete directly from the
  // IncidentsPage AppSearchDrawer override when the user picks Outlook
  // Office365 from the popup (pretend-authenticated for the demo).

  // Note: the `incidents-list:open` sub-goal is no longer set here. It is
  // computed live from the current route in DemoContext (`isOnIncidentDetail`)
  // so leaving the detail page reverts the gate immediately.

  // ─── incident-detail sub-goals ─────────────────────────────────────────────
  // Step #5 is a guided observation: read the timeline (find the attacker
  // IP), ask the agent a question, then watch the Wazuh / Sliver C2 follow-up
  // arrive. Each sub-goal flips on as evidence appears.

  // Timeline-IP — listens for a custom event dispatched when the user clicks
  // any IP observable pill on the timeline. Fired from the timeline pill
  // click handler in IncidentDetailPage.
  useEffect(() => {
    if (!drawerOpen) return;
    const onIp = () => {
      const stepId = TOUR_STEPS[step]?.id;
      if (stepId !== 'incident-detail') return;
      markStepCompleted('incident-detail:timeline-ip');
    };
    window.addEventListener('demo:timeline-ip-clicked', onIp);
    return () => window.removeEventListener('demo:timeline-ip-clicked', onIp);
  }, [drawerOpen, step, markStepCompleted]);

  // ─── orientation sub-goals: complete on hover ──────────────────────────────
  // Step #5 starts with two "notice this" goals (Title, Description/Email).
  // They flip complete the moment the user hovers the actual element on the
  // page OR the matching row in the drawer (which already drives a spotlight
  // preview via `hoveredGoalSelector`). Either path counts as "noticed".
  useEffect(() => {
    if (!drawerOpen) return;
    const stepId = TOUR_STEPS[step]?.id;
    if (stepId !== 'incident-detail') return;

    const targets: Array<{ goalId: string; selector: string }> = [
      { goalId: 'incident-detail:hover-title', selector: '[data-tour="incident-title"]' },
      { goalId: 'incident-detail:hover-description', selector: '[data-tour="incident-description"]' },
    ];

    // 1) Drawer-row hover already updates `hoveredGoalSelector` — mark the
    //    matching goal complete immediately when its selector is previewed.
    const previewed = targets.find(t => t.selector === hoveredGoalSelector);
    if (previewed) markStepCompleted(previewed.goalId);

    // 2) Direct hover on the page element. We attach listeners to whatever
    //    matches at this moment and re-bind via a small interval so newly
    //    rendered targets (description loads async) get covered.
    const cleanups: Array<() => void> = [];
    const bind = () => {
      targets.forEach(t => {
        const el = document.querySelector(t.selector) as HTMLElement | null;
        if (!el || (el as any).__demoHoverBound) return;
        const handler = () => markStepCompleted(t.goalId);
        el.addEventListener('mouseenter', handler, { once: true });
        (el as any).__demoHoverBound = true;
        cleanups.push(() => {
          el.removeEventListener('mouseenter', handler);
          delete (el as any).__demoHoverBound;
        });
      });
    };
    bind();
    const id = window.setInterval(bind, 1500);
    return () => {
      window.clearInterval(id);
      cleanups.forEach(fn => fn());
    };
  }, [drawerOpen, step, hoveredGoalSelector, markStepCompleted]);

  // Comment-sent — listens for the custom event dispatched by the incident
  // detail page when the user adds a comment. Doubles as "ask the agent".
  useEffect(() => {
    if (!drawerOpen) return;
    const onSent = () => {
      const stepId = TOUR_STEPS[step]?.id;
      if (stepId !== 'incident-detail') return;
      markStepCompleted('incident-detail:ask-agent');
      // Once the user asks the agent something, schedule the Wazuh / Sliver C2
      // follow-up to arrive shortly after — as if the agent dug deeper and
      // found the related implant. We do not seed instantly so it reads as a
      // genuine "new correlation found" moment a few seconds later.
      if (wazuhSeededRef.current) return;
      window.setTimeout(async () => {
        if (wazuhSeededRef.current) return;
        try {
          const added = await seedDemoWazuhImplantIncident();
          wazuhSeededRef.current = true;
          if (added > 0) {
            toast.warning('New correlation found: Sliver C2 implant detected on the same host.', {
              duration: 5000,
            });
            markStepCompleted('incident-detail:wazuh');
          }
        } catch {
          // best-effort; user can still force-generate from the drawer
        }
      }, WAZUH_FOLLOWUP_DELAY_MS);
    };
    window.addEventListener('demo:incident-comment-sent', onSent);
    return () => window.removeEventListener('demo:incident-comment-sent', onSent);
  }, [drawerOpen, step, markStepCompleted]);

  // Wazuh sub-goal — also flips on if the incident is already seeded (e.g.
  // user force-generated it from the tour drawer, or it landed on a previous
  // run). We read the seeded-keys index from localStorage instead of poking
  // the datastore directly so this stays cheap.
  useEffect(() => {
    if (!drawerOpen) return;
    const stepId = TOUR_STEPS[step]?.id;
    if (stepId !== 'incident-detail') return;
    const check = () => {
      try {
        const idx = JSON.parse(localStorage.getItem('shuffle_demo_seeded_keys') || '{}');
        const incidents = idx['shuffle-security_incidents'];
        if (Array.isArray(incidents) && incidents.some((k: string) => typeof k === 'string' && k.includes('-wazuh'))) {
          wazuhSeededRef.current = true;
          markStepCompleted('incident-detail:wazuh');
          return true;
        }
      } catch { /* ignore */ }
      return false;
    };
    if (check()) return;
    const id = window.setInterval(() => {
      if (check()) window.clearInterval(id);
    }, 2000);
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
