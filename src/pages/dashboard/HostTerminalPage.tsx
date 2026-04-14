import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, CheckCircle2, Loader2, Play, ShieldX, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { DEFAULT_AGENT_PERMISSIONS } from '@/hooks/useAgentPermissions';
import { usePageMeta } from '@/hooks/usePageMeta';

type ActionDebugEntry = {
  hostUuid: string;
  actionName: string;
  hostname: string;
  status: 'sending' | 'polling' | 'success' | 'error';
  requestBody: object;
  responseStatus?: number;
  responseBody?: string;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  executionId?: string;
  actionOutput?: string;
  actionSuccess?: boolean;
};

const getCommandHistory = (hostUuid: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(`cmd_history_${hostUuid}`) || '[]');
  } catch { return []; }
};
const pushCommandHistory = (hostUuid: string, cmd: string) => {
  const prev = getCommandHistory(hostUuid);
  const next = [cmd, ...prev.filter(c => c !== cmd)].slice(0, 100);
  localStorage.setItem(`cmd_history_${hostUuid}`, JSON.stringify(next));
};

const parseActionResult = (data: unknown): { success: boolean; output: string | null; error: string | null } => {
  try {
    if (!data || typeof data !== 'object') return { success: true, output: null, error: null };
    const obj = data as Record<string, unknown>;
    const results = obj.results as Array<{ result?: string }> | undefined;
    const firstResult = results?.[0]?.result;
    if (!firstResult || typeof firstResult !== 'string') return { success: true, output: null, error: null };
    const parsed = JSON.parse(firstResult);
    return {
      success: parsed.success !== false,
      output: typeof parsed.output === 'string' ? parsed.output : null,
      error: typeof parsed.error === 'string' ? parsed.error : null,
    };
  } catch {
    return { success: true, output: null, error: null };
  }
};

const HostTerminalPage = () => {
  const { hostUuid } = useParams<{ hostUuid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const hostState = location.state as { hostname?: string; groupName?: string; mode?: string } | null;

  const hostname = hostState?.hostname || 'Unknown Host';
  const groupName = hostState?.groupName || '';
  const mode = hostState?.mode || 'full';
  const isFull = mode === 'full';

  usePageMeta({ title: `Terminal · ${hostname}`, description: `Terminal session for ${hostname}` });

  const [customAction, setCustomAction] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [actionHistory, setActionHistory] = useState<ActionDebugEntry[]>([]);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pollingActiveRef = useRef<Map<string, boolean>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hostActionablePerms = DEFAULT_AGENT_PERMISSIONS
    .flatMap(c => c.permissions)
    .filter(p => p.hostActionable && !p.disabled);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [actionHistory]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pushDebug = (entry: ActionDebugEntry) => {
    setActionHistory(prev => [...prev, entry]);
  };

  const updateLatestDebug = (update: Partial<ActionDebugEntry>) => {
    setActionHistory(prev => {
      if (prev.length === 0) return prev;
      const last = { ...prev[prev.length - 1], ...update };
      return [...prev.slice(0, -1), last];
    });
  };

  // We need a stable way to update a specific entry (not just latest) for concurrent commands
  const updateDebugByIndex = (index: number, update: Partial<ActionDebugEntry>) => {
    setActionHistory(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const updated = { ...prev[index], ...update };
      return [...prev.slice(0, index), updated, ...prev.slice(index + 1)];
    });
  };

  const executeHostAction = useCallback(async (actionId: string, actionName: string, isPredefined = false) => {
    if (!hostUuid) return;
    const entryIndex = actionHistory.length; // will be the index of the new entry
    const controller = new AbortController();
    const abortKey = `${hostUuid}_${Date.now()}`;
    abortControllersRef.current.set(abortKey, controller);
    pollingActiveRef.current.set(abortKey, true);

    const requestBody = {
      app_id: 'sensors',
      app_name: 'sensors',
      name: 'run_action',
      parameters: [
        { name: 'action', value: isPredefined ? `script:${actionId}` : actionId },
        { name: 'hosts', value: hostname },
        { name: 'sensor_group', value: groupName },
      ],
    };

    const newEntry: ActionDebugEntry = {
      hostUuid,
      actionName,
      hostname,
      status: 'sending',
      requestBody,
      startedAt: Date.now(),
    };

    // We need to use functional setState to get the correct index
    let myIndex = -1;
    setActionHistory(prev => {
      myIndex = prev.length;
      return [...prev, newEntry];
    });

    // Small delay to let state settle
    await new Promise(r => setTimeout(r, 50));

    const updateMyEntry = (update: Partial<ActionDebugEntry>) => {
      setActionHistory(prev => {
        // Find the entry by startedAt + actionName to handle concurrent commands
        const idx = prev.findIndex(e => e.startedAt === newEntry.startedAt && e.actionName === newEntry.actionName);
        if (idx < 0) return prev;
        return [...prev.slice(0, idx), { ...prev[idx], ...update }, ...prev.slice(idx + 1)];
      });
    };

    try {
      const resp = await fetch(getApiUrl('/api/v1/apps/sensors/run'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      const text = await resp.text().catch(() => '');
      if (!resp.ok) {
        updateMyEntry({ status: 'error', responseStatus: resp.status, responseBody: text, finishedAt: Date.now(), error: text || `HTTP ${resp.status}` });
        toast.error('Action failed', { description: text || `HTTP ${resp.status}` });
        return;
      }

      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* not JSON */ }

      if (
        parsed && typeof parsed === 'object' && parsed !== null &&
        typeof (parsed as Record<string, unknown>).execution_id === 'string' &&
        (parsed as Record<string, unknown>).execution_id
      ) {
        const execId = (parsed as Record<string, unknown>).execution_id as string;
        updateMyEntry({ status: 'polling', responseStatus: resp.status, responseBody: text, executionId: execId });

        const maxAttempts = 900;
        const intervalMs = 2000;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (!pollingActiveRef.current.get(abortKey)) return;
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, intervalMs);
            controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
          });
          if (!pollingActiveRef.current.get(abortKey)) return;
          try {
            const pollResp = await fetch(getApiUrl('/api/v1/streams/results'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
              body: JSON.stringify({ execution_id: execId, authorization: execId }),
              signal: controller.signal,
            });
            if (!pollResp.ok) {
              if (pollResp.status >= 400 && pollResp.status < 500) {
                updateMyEntry({ status: 'error', responseBody: `Poll error ${pollResp.status}`, finishedAt: Date.now(), error: `HTTP ${pollResp.status}` });
                toast.error('Action failed', { description: `Poll error ${pollResp.status}` });
                return;
              }
              continue;
            }
            const pollText = await pollResp.text();
            if (!pollText || pollText === '{}' || pollText === 'null') continue;

            let pollData: unknown = null;
            try { pollData = JSON.parse(pollText); } catch { /* not JSON */ }

            if (pollData && typeof pollData === 'object') {
              const st = (pollData as Record<string, unknown>).status;
              if (st === 'EXECUTING' || st === 'WAITING') continue;
            }

            const result = parseActionResult(pollData);
            updateMyEntry({
              status: result.success ? 'success' : 'error',
              responseBody: pollText,
              finishedAt: Date.now(),
              actionOutput: result.output || undefined,
              actionSuccess: result.success,
              error: result.success ? undefined : (result.error || result.output || 'Action reported failure'),
            });
            if (!result.success) {
              toast.error('Action failed', { description: result.error || result.output || `"${actionName}" → ${hostname}` });
            }
            return;
          } catch {
            if (!pollingActiveRef.current.get(abortKey)) return;
            continue;
          }
        }
        if (pollingActiveRef.current.get(abortKey)) {
          updateMyEntry({ status: 'error', finishedAt: Date.now(), error: 'Timed out waiting for execution result (30 min).' });
          toast.error('Action timed out', { description: 'No result after 30 minutes.' });
        }
      } else {
        updateMyEntry({ status: 'success', responseStatus: resp.status, responseBody: text, finishedAt: Date.now() });
      }
    } catch (err) {
      if (!pollingActiveRef.current.get(abortKey)) return;
      const msg = err instanceof Error ? err.message : 'Request error';
      updateMyEntry({ status: 'error', finishedAt: Date.now(), error: msg });
      toast.error('Action failed', { description: msg });
    } finally {
      pollingActiveRef.current.delete(abortKey);
      abortControllersRef.current.delete(abortKey);
    }
  }, [hostUuid, hostname, groupName]);

  const abortAll = () => {
    pollingActiveRef.current.forEach((_, key) => {
      pollingActiveRef.current.set(key, false);
    });
    abortControllersRef.current.forEach(c => c.abort());
    abortControllersRef.current.clear();
  };

  const finishedHistory = actionHistory.filter(e => e.status === 'success' || e.status === 'error');
  const runningEntries = actionHistory.filter(e => e.status === 'sending' || e.status === 'polling');

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0 bg-background">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/monitors')}>
          <ArrowLeft size={16} />
        </Button>
        <Terminal size={18} className="text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">{hostname}</h1>
          <p className="text-xs text-muted-foreground">{isFull ? 'Full control (RCE)' : 'Controlled'} · {groupName}</p>
        </div>
        {runningEntries.length > 0 && (
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">{runningEntries.length} running</span>
          </div>
        )}
      </div>

      {/* Scrollable session log */}
      <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
        {actionHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Terminal size={40} className="opacity-30" />
            <p className="text-sm">No commands run yet. Type a command or use the predefined actions below.</p>
          </div>
        )}

        {actionHistory.map((entry, i) => {
          const isLatest = entry.status !== 'sending' && entry.status !== 'polling' && i === actionHistory.map((e, idx) => e.status === 'success' || e.status === 'error' ? idx : -1).filter(x => x >= 0).pop();
          const isRunning = entry.status === 'sending' || entry.status === 'polling';

          return (
            <div key={`${entry.startedAt}-${entry.actionName}`} className={`border-b border-border/50 last:border-b-0 ${isLatest ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}>
              <div className={`px-6 py-2.5 flex items-center gap-3 ${isLatest ? 'bg-primary/10' : isRunning ? 'bg-muted/30' : 'bg-muted/10'}`}>
                <span className="text-sm font-mono text-primary">$</span>
                <span className="text-sm font-mono font-medium text-foreground flex-1 truncate">{entry.actionName}</span>
                {isRunning ? (
                  <Loader2 size={14} className="animate-spin text-primary shrink-0" />
                ) : entry.status === 'success' ? (
                  <CheckCircle2 size={14} className="text-[hsl(var(--severity-low))] shrink-0" />
                ) : (
                  <ShieldX size={14} className="text-destructive shrink-0" />
                )}
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {new Date(entry.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {entry.finishedAt && (
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {Math.round((entry.finishedAt - entry.startedAt) / 1000)}s
                  </span>
                )}
                {isRunning && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      // Find and abort this specific entry's controller
                      abortControllersRef.current.forEach((ctrl, key) => {
                        if (key.startsWith(`${hostUuid}_`)) {
                          pollingActiveRef.current.set(key, false);
                          ctrl.abort();
                        }
                      });
                      setActionHistory(prev => prev.map(e =>
                        e.startedAt === entry.startedAt && e.actionName === entry.actionName
                          ? { ...e, status: 'error' as const, finishedAt: Date.now(), error: 'Aborted by user' }
                          : e
                      ));
                    }}
                  >
                    Stop
                  </Button>
                )}
              </div>
              {isRunning && (
                <div className="px-6 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    {entry.status === 'sending' ? 'Sending…' : 'Waiting for result…'}
                  </span>
                </div>
              )}
              {(entry.actionOutput || entry.error) && (
                <div className="px-6 py-2.5">
                  {entry.actionOutput && (
                    <pre className="text-sm font-mono text-foreground/80 whitespace-pre-wrap break-words">{entry.actionOutput}</pre>
                  )}
                  {entry.error && (
                    <pre className="text-sm font-mono text-destructive whitespace-pre-wrap break-words">{entry.error}</pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Predefined action chips */}
      <div className="px-6 py-3 flex flex-wrap gap-1.5 border-t border-border/50 shrink-0">
        {hostActionablePerms.map(perm => (
          <button
            key={perm.id}
            className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted/50 transition-colors text-foreground"
            onClick={() => executeHostAction(perm.id, perm.name, true)}
          >
            {perm.name}
          </button>
        ))}
      </div>

      {/* Command input */}
      <div className="px-6 py-3 border-t border-border shrink-0 bg-background">
        <div className="flex gap-2 items-center max-w-4xl">
          <span className="text-sm font-mono text-primary shrink-0">$</span>
          <Input
            placeholder={isFull ? 'Type command…' : 'Custom action…'}
            value={customAction}
            onChange={e => setCustomAction(e.target.value)}
            className="h-9 text-sm flex-1 font-mono"
            ref={inputRef}
            onKeyDown={e => {
              const history = getCommandHistory(hostUuid || '');
              if (e.key === 'Enter' && customAction.trim()) {
                pushCommandHistory(hostUuid || '', customAction.trim());
                setHistoryIndex(-1);
                executeHostAction(customAction.trim(), customAction.trim());
                setCustomAction('');
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHistoryIndex(prev => {
                  const next = Math.min(prev + 1, history.length - 1);
                  if (next >= 0) setCustomAction(history[next]);
                  return next;
                });
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHistoryIndex(prev => {
                  const next = prev - 1;
                  if (next < 0) { setCustomAction(''); return -1; }
                  setCustomAction(history[next]);
                  return next;
                });
              }
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            disabled={!customAction.trim()}
            onClick={() => {
              if (customAction.trim()) {
                pushCommandHistory(hostUuid || '', customAction.trim());
                executeHostAction(customAction.trim(), customAction.trim());
                setCustomAction('');
              }
            }}
          >
            <Play size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HostTerminalPage;
