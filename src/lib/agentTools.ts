/**
 * Agent tools assignment.
 *
 * Stores which tool/app names are assigned to which agent + action type.
 * Multiple agents can exist (default name "default"), each with multiple
 * action types (e.g. "timeline_reply", "task_reply"). The shape is a flat
 * array so it serializes cleanly to localStorage and is easy to extend.
 *
 *   [
 *     { agent: 'default', actionType: 'timeline_reply', tools: ['Wazuh', ...] },
 *     ...
 *   ]
 *
 * Components subscribe to in-process changes via the `agent-tools-changed`
 * window event so the UI updates without a reload.
 */

const STORAGE_KEY = 'agent_tools_config';
export const AGENT_TOOLS_CHANGED_EVENT = 'agent-tools-changed';

export const DEFAULT_AGENT = 'default';
export const DEFAULT_ACTION_TYPE = 'timeline_reply';

export interface AgentToolsEntry {
  agent: string;
  actionType: string;
  tools: string[];
}

const readAll = (): AgentToolsEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.agent === 'string' && typeof e.actionType === 'string' && Array.isArray(e.tools))
      .map((e) => ({
        agent: e.agent,
        actionType: e.actionType,
        tools: e.tools.filter((t: unknown) => typeof t === 'string'),
      }));
  } catch {
    return [];
  }
};

const writeAll = (entries: AgentToolsEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent(AGENT_TOOLS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
};

export const getAgentTools = (
  agent: string = DEFAULT_AGENT,
  actionType: string = DEFAULT_ACTION_TYPE,
): string[] => {
  const all = readAll();
  return all.find((e) => e.agent === agent && e.actionType === actionType)?.tools ?? [];
};

export const setAgentTools = (
  tools: string[],
  agent: string = DEFAULT_AGENT,
  actionType: string = DEFAULT_ACTION_TYPE,
) => {
  const all = readAll();
  const idx = all.findIndex((e) => e.agent === agent && e.actionType === actionType);
  const dedup = Array.from(new Set(tools.filter((t) => typeof t === 'string' && t.trim().length > 0)));
  if (idx >= 0) all[idx] = { agent, actionType, tools: dedup };
  else all.push({ agent, actionType, tools: dedup });
  writeAll(all);
};

export const addAgentTool = (
  tool: string,
  agent: string = DEFAULT_AGENT,
  actionType: string = DEFAULT_ACTION_TYPE,
) => {
  const current = getAgentTools(agent, actionType);
  if (current.includes(tool)) return;
  setAgentTools([...current, tool], agent, actionType);
};

export const removeAgentTool = (
  tool: string,
  agent: string = DEFAULT_AGENT,
  actionType: string = DEFAULT_ACTION_TYPE,
) => {
  const current = getAgentTools(agent, actionType);
  setAgentTools(current.filter((t) => t !== tool), agent, actionType);
};

export const formatToolName = (name: string): string =>
  name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
