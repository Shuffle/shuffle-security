import { useCallback, useMemo, useState } from 'react';
import { useWorkflows } from './useWorkflows';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { getAutomationLabels } from '@/config/usecases';

export interface AssignEscalateStatus {
  /** Workflow exists AND background_processing=true */
  active: boolean;
  /** Whether workflows are still loading */
  isLoading: boolean;
  /** Enable the Assign & Escalate workflow */
  enable: () => Promise<void>;
  /** Whether an enable action is in progress */
  isEnabling: boolean;
}

/**
 * The AI Agent's "ai_handled" automation requires the "Assign & Escalate"
 * background workflow to be running. This hook detects whether that workflow
 * exists and is active, and exposes an `enable()` helper that mirrors what the
 * /onboarding/automate page does for that automation.
 */
export const useAssignEscalateStatus = (): AssignEscalateStatus => {
  const { data: workflows, isLoading, refetch } = useWorkflows();
  const [isEnabling, setIsEnabling] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const labels = useMemo(() => getAutomationLabels('assign_escalate'), []);

  const enable = useCallback(async () => {
    setOptimistic(true);
    setIsEnabling(true);
    try {
      await Promise.allSettled(
        labels.map((label) =>
          fetch(getApiUrl('/api/v2/workflows/generate'), {
            method: 'POST',
            credentials: 'include',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            // assign_escalate is schedule-based — no app dependencies required.
            body: JSON.stringify({ label, category: 'cases' }),
          }),
        ),
      );
      // Give the backend a moment to register the new workflow before refetching.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await refetch();
    } finally {
      setIsEnabling(false);
      setOptimistic(null);
    }
  }, [labels, refetch]);

  const active = useMemo(() => {
    if (optimistic !== null) return optimistic;
    if (!workflows || labels.length === 0) return false;
    // Match if ANY of the assign_escalate labels is present and backgrounded.
    return labels.some((label) =>
      workflows.some(
        (w) => w.name === label && w.background_processing === true,
      ),
    );
  }, [workflows, labels, optimistic]);

  return { active, isLoading, enable, isEnabling };
};
