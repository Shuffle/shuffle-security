/**
 * Watches platform state (workflows, agent notifications, etc.) and marks the
 * current required tour step as completed when its real action has happened.
 *
 * Mounted once near the DemoProvider so it's always running while the demo
 * tour is open. Uses existing react-query data so it stays cheap.
 */

import { useEffect } from 'react';
import { useDemo } from '@/context/DemoContext';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAgentNotifications } from '@/hooks/useNotifications';
import {
  findIngestTicketsWorkflow,
  isWorkflowScheduleStopped,
  extractWorkflowAppNames,
  normalizeAppName,
} from '@/lib/ingestionDetection';

export const DemoCompletionWatcher = () => {
  const { drawerOpen, markStepCompleted } = useDemo();
  const { data: workflows } = useWorkflows();
  const { notifications } = useAgentNotifications();

  // ─── ingest-webhook: Ingestion Webhook workflow exists and is started ──────
  useEffect(() => {
    if (!drawerOpen || !workflows) return;
    const webhookWf = workflows.find(w => w.name === 'Ingestion Webhook');
    if (!webhookWf) return;
    const stopped = isWorkflowScheduleStopped(webhookWf);
    if (!stopped) markStepCompleted('ingest-webhook');
  }, [drawerOpen, workflows, markStepCompleted]);

  // Note: the `add-outlook` step is marked complete directly from the
  // IncidentsPage AppSearchDrawer override when the user picks Outlook
  // Office365 from the popup (pretend-authenticated for the demo).


  // ─── agent: at least one approval notification has been cleared ───────────
  // We snapshot the open approvals when the user lands on the step, then mark
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
