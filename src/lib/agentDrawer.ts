/**
 * Global Agent Drawer event bus.
 *
 * The Agent (Run / Permissions / Local LLM) drawer is mounted globally in
 * DashboardLayout so it can be opened from anywhere — incident pages,
 * workflow pages, dashboards, etc. Anything that wants to open it just
 * fires `openAgentDrawer(tab)` instead of navigating to /agent.
 */

export type AgentDrawerTab = 'run' | 'permissions' | 'localLLM';

export const AGENT_DRAWER_OPEN_EVENT = 'agent-drawer-open';

export interface AgentDrawerOpenDetail {
  tab?: AgentDrawerTab;
}

export const openAgentDrawer = (tab: AgentDrawerTab = 'run') => {
  window.dispatchEvent(
    new CustomEvent<AgentDrawerOpenDetail>(AGENT_DRAWER_OPEN_EVENT, { detail: { tab } }),
  );
};
