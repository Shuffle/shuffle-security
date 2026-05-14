/**
 * GlobalAgentDrawer — single instance of the Agent drawer mounted in the
 * dashboard layout so any page can open it via `openAgentDrawer(tab)`.
 *
 * Also handles the legacy `?openPermissions=1` query param for backwards
 * compatibility with existing deep links.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AgentRunDrawer, type AgentRunDrawerTab } from '@/Shuffle-MCPs';
import { toast } from '@/Shuffle-MCPs/toast';
import PermissionsPanel from '@/components/agent/PermissionsPanel';
import LocalLLMConfig from '@/components/agent/LocalLLMConfig';
import {
  AGENT_DRAWER_OPEN_EVENT,
  type AgentDrawerOpenDetail,
} from '@/lib/agentDrawer';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';

const GlobalAgentDrawer = () => {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<AgentRunDrawerTab>('run');
  const location = useLocation();
  const navigate = useNavigate();
  const scheduleAgentRun = useScheduleAgentRun();

  const handleSchedule = useCallback(
    async ({ cron, input }: { cron: string; input: string }) => {
      const { name } = await scheduleAgentRun({ cron, input });
      toast({
        title: 'Schedule started',
        description: `"${name}" will run on \`${cron}\``,
      });
    },
    [scheduleAgentRun],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AgentDrawerOpenDetail>).detail;
      setInitialTab((detail?.tab ?? 'run') as AgentRunDrawerTab);
      setOpen(true);
    };
    window.addEventListener(AGENT_DRAWER_OPEN_EVENT, handler);
    return () => window.removeEventListener(AGENT_DRAWER_OPEN_EVENT, handler);
  }, []);

  // Legacy: ?openPermissions=1 still works from any page.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openPermissions') === '1') {
      setInitialTab('permissions');
      setOpen(true);
      params.delete('openPermissions');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params}` : '' },
        { replace: true },
      );
    }
  }, [location.search, location.pathname, navigate]);

  return (
    <AgentRunDrawer
      open={open}
      onClose={() => setOpen(false)}
      initialTab={initialTab}
      permissionsSlot={<PermissionsPanel compact />}
      localLLMSlot={<LocalLLMConfig />}
      agentUIProps={{ onSchedule: handleSchedule }}
    />
  );
};

export default GlobalAgentDrawer;
