import { useState } from 'react';
import { useWorkflows } from './useWorkflows';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

export interface WebhookStatus {
  /** Whether the webhook workflow exists */
  exists: boolean;
  /** Whether the webhook trigger is active (not stopped) */
  enabled: boolean;
  /** The webhook URL (null if not found) */
  url: string | null;
  /** Whether the workflows query is still loading */
  isLoading: boolean;
  /** Enable the webhook (creates/starts it) */
  enable: () => Promise<void>;
  /** Whether the enable action is in progress */
  isEnabling: boolean;
}

export const useWebhookStatus = (): WebhookStatus => {
  const { data: workflows, isLoading, refetch } = useWorkflows();
  const [isEnabling, setIsEnabling] = useState(false);

  const webhookWorkflow = workflows?.find((w) => w.name === 'Ingestion Webhook');

  let url: string | null = null;
  let enabled = false;

  if (webhookWorkflow) {
    const trigger = (webhookWorkflow.triggers || []).find(
      (t: any) => t.trigger_type === 'WEBHOOK' || t.app_name === 'Webhook'
    );
    if (trigger) {
      const webhookId = trigger.id || trigger.trigger_id;
      if (webhookId) {
        url = getApiUrl(`/api/v1/hooks/webhook_${webhookId}`);
      }
      enabled = (trigger.status || '').toLowerCase() !== 'stopped';
    }
  }

  const enable = async () => {
    setIsEnabling(true);
    try {
      const res = await fetch(getApiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Ingest Tickets_webhook' }),
      });
      if (!res.ok) throw new Error('Failed to enable webhook');
      // Refetch workflows to pick up new state
      await refetch();
    } finally {
      setIsEnabling(false);
    }
  };

  return {
    exists: !!webhookWorkflow,
    enabled,
    url,
    isLoading,
    enable,
    isEnabling,
  };
};
