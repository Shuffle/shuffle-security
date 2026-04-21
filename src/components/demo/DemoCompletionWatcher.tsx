/**
 * Watches platform state (workflows, agent notifications, etc.) and keeps the
 * current required tour step's completion in sync with the live state — both
 * directions. If the user reverts the action (e.g. re-stops the webhook after
 * starting it), the step flips back to "Required to continue".
 *
 * Mounted once near the DemoProvider so it's always running while the demo
 * tour is open.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDemo } from '@/context/DemoContext';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAgentNotifications } from '@/hooks/useNotifications';
import { isWorkflowScheduleStopped } from '@/lib/ingestionDetection';

export const DemoCompletionWatcher = () => {
  const { drawerOpen, setStepCompleted, markStepCompleted } = useDemo();
  const { data: workflows } = useWorkflows();
  const { notifications } = useAgentNotifications();
  const queryClient = useQueryClient();

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
