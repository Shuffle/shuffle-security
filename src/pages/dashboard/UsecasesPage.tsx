/**
 * UsecasesPage — host wrapper around the standalone Shuffle-Core
 * implementation. Injects host-owned slots (currently: the same Webhook
 * ingestion button used on /incidents) into the usecase detail view so
 * /usecases/siem_alerts and /usecases/edr_alerts expose the exact same
 * enable/disable control next to "Source".
 */
import { Usecases, API_CONFIG } from '@/Shuffle-Core';
import { WebhookIngestionButton, type WebhookIngestionInfo } from '@/components/incidents/WebhookIngestionButton';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { useWorkflows } from '@/hooks/useWorkflows';
import { IncidentRoutingEditor } from '@/components/settings/IncidentRoutingEditor';
import MonitorsView from '@/Shuffle-Core/views/monitors/MonitorsView';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const WEBHOOK_FLOW_IDS = new Set(['siem_case_management_1', 'edr_case_management_1']);

interface UsecasesPageProps {
  isLoaded?: boolean;
  isLoggedIn?: boolean;
  userdata?: any;
  globalUrl?: string;
}

const UsecasesPage = (props: UsecasesPageProps = {}) => {
  const webhook = useWebhookStatus();
  const { refetch } = useWorkflows();
  const { resolvedTheme } = useTheme();
  const { userInfo } = useAuth();

  const info: WebhookIngestionInfo = {
    url: webhook.url,
    exists: webhook.exists,
    enabled: webhook.enabled,
    workflowId: null,
  };

  return (
    <Usecases
      globalUrl={API_CONFIG.baseUrl}
      theme={resolvedTheme}
      userdata={userInfo as any}
      isLoaded={true}
      isLoggedIn={!!userInfo}
      {...props}
      renderEndpointSlot={({ flowId, side }) => {
        if (side !== 'source') return null;
        if (!WEBHOOK_FLOW_IDS.has(flowId)) return null;
        return {
          node: <WebhookIngestionButton webhook={info} onToggled={() => refetch()} />,
          enabled: !!webhook.enabled,
        } as any;
      }}
      renderUsecaseDetailSlot={({ flowId }) => {
        if (flowId !== 'case_management_incident_routing_1') return null;
        // Same component used on /preferences — single source of truth so
        // changes apply in both places.
        return <IncidentRoutingEditor forceShow />;
      }}
    />
  );
};

export default UsecasesPage;
