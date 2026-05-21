/**
 * GlobalAgentDrawer — single instance of the Agent drawer mounted in the
 * dashboard layout so any page can open it via `openAgentDrawer(tab)`.
 *
 * Also handles the legacy `?openPermissions=1` query param for backwards
 * compatibility with existing deep links.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AgentRunDrawer, API_CONFIG, type AgentRunDrawerTab, type AgentUIProps } from '@/Shuffle-MCPs';
import PermissionsPanel from '@/components/agent/PermissionsPanel';
import LocalLLMConfig from '@/components/agent/LocalLLMConfig';
import { useTheme } from '@/context/ThemeContext';
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
  const { theme } = useTheme();

  const handleSchedule = useCallback<NonNullable<AgentUIProps['onSchedule']>>(
    async (info) => {
      await scheduleAgentRun(info);
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

  // /agents?permissions=true — auto-open the Local LLM sidebar on /agents.
  useEffect(() => {
    if (location.pathname !== '/agents') return;
    const params = new URLSearchParams(location.search);
    if (params.get('permissions') === 'true') {
      setInitialTab('localLLM');
      setOpen(true);
    }
  }, [location.pathname, location.search]);

  // When the drawer is open on /agents, mirror it as ?permissions=true.
  // When it closes on /agents, strip the param.
  useEffect(() => {
    if (location.pathname !== '/agents') return;
    const params = new URLSearchParams(location.search);
    const has = params.get('permissions') === 'true';
    if (open && !has) {
      params.set('permissions', 'true');
      navigate(
        { pathname: location.pathname, search: `?${params}` },
        { replace: true },
      );
    } else if (!open && has) {
      params.delete('permissions');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params}` : '' },
        { replace: true },
      );
    }
  }, [open, location.pathname, location.search, navigate]);

  return (
    <AgentRunDrawer
      open={open}
      onClose={() => setOpen(false)}
      initialTab={initialTab}
      globalUrl={API_CONFIG.baseUrl}
      theme={theme}
      permissionsSlot={<PermissionsPanel compact />}
      localLLMSlot={<LocalLLMConfig />}
      agentUIProps={{ onSchedule: handleSchedule, apiBaseUrl: API_CONFIG.baseUrl, theme }}
    />
  );
};

export default GlobalAgentDrawer;
