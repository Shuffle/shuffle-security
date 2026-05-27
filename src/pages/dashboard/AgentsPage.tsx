/**
 * AgentsPage — thin host wrapper around the reusable `AgentsView` from
 * Shuffle-MCPs. Provides Shuffle Security's scheduler implementation and
 * persists the user's last "Select Apps" chip set in localStorage (24h TTL)
 * so revisits to /agents restore the prior tool selection.
 */

import { useCallback, useMemo } from 'react';
import { AgentsView, API_CONFIG } from '@/Shuffle-MCPs';
import type { AgentsViewProps } from '@/Shuffle-MCPs';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';
import { useTheme } from '@/context/ThemeContext';

const STORAGE_KEY = 'shuffle-agents-selected-apps';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

type StoredApp = { name: string; id?: string; icon?: string };

const readPersistedApps = (): StoredApp[] | undefined => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { savedAt?: number; apps?: StoredApp[] };
    if (!parsed?.savedAt || !Array.isArray(parsed.apps) || parsed.apps.length === 0) return undefined;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return parsed.apps.filter((a) => a && typeof a.name === 'string');
  } catch {
    return undefined;
  }
};

const AgentsPage = () => {
  const scheduleAgentRun = useScheduleAgentRun();
  // Pass the already-resolved theme ('light' | 'dark') rather than 'system'.
  // The MCP library's 'auto' mode re-detects via DOM ancestors and can pick
  // up an unrelated Shuffle scope, which made /agents look randomly light.
  const { resolvedTheme } = useTheme();

  const handleSchedule = useCallback<AgentsViewProps['onSchedule']>(
    async (info) => {
      await scheduleAgentRun(info);
    },
    [scheduleAgentRun],
  );

  // Read once on mount so the chip row hydrates with the prior selection.
  const initialApps = useMemo(() => readPersistedApps(), []);

  const handleAppsChange = useCallback((apps: StoredApp[]) => {
    try {
      // Only persist when there is something meaningful to restore. An empty
      // chip row means "use the built-in defaults next visit", so clear the
      // entry instead of overwriting it with [].
      if (!apps || apps.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const slim: StoredApp[] = apps
        .filter((a) => a && typeof a.name === 'string')
        .map((a) => ({ name: a.name, id: a.id, icon: a.icon }));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), apps: slim }),
      );
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, []);

  return (
    <AgentsView
      onSchedule={handleSchedule}
      globalUrl={API_CONFIG.baseUrl}
      theme={theme}
      initialApps={initialApps}
      onAppsChange={handleAppsChange}
    />
  );
};

export default AgentsPage;
