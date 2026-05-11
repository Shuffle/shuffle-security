import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Loader2, Play, RefreshCw, Search, ShieldX, Terminal, X } from 'lucide-react';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { DEFAULT_AGENT_PERMISSIONS } from '@/hooks/useAgentPermissions';
import { usePageMeta } from '@/hooks/usePageMeta';
import { fetchHostSupplements } from '@/lib/mergeMonitorHosts';
import { HostActionChips, getActiveUser, inferAgentPrivilege, type AgentPrivilege } from '@/components/monitors/hostActionDefinitions';
import { ActionOutputView } from '@/components/monitors/ActionOutputView';
import { terminalStorageKey, readStoredSession, registerHostIdentity } from '@/utils/terminalStorageKey';
import { hostUrlSegment, parseHostUrlSegment } from '@/utils/hostUrlSegment';

interface HostOption {
  uuid: string;
  hostname: string;
  groupName: string;
  mode: string;
  os: string;
  arch?: string;
  checkin?: number;
}

let entryIdCounter = 0;

type ActionDebugEntry = {
  entryId: number;
  hostUuid: string;
  actionName: string;
  /** Exact command string sent to backend — used for ArrowUp re-run */
  commandText?: string;
  hostname: string;
  status: 'sending' | 'polling' | 'success' | 'error';
  requestBody: object;
  responseStatus?: number;
  responseBody?: string;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  executionId?: string;
  authorization?: string;
  actionOutput?: string;
  actionSuccess?: boolean;
};

type StoredEntry = {
  entryId?: string;
  actionName: string;
  commandText?: string;
  status: 'success' | 'error';
  startedAt: number;
  finishedAt?: number;
  executionId?: string;
  authorization?: string;
  actionOutput?: string;
  error?: string;
};

const HISTORY_KEY = (hostUuid: string) => terminalStorageKey(hostUuid);
const MAX_STORED = 50;
const MAX_OUTPUT_CHARS = 20000;

const IMAGE_PREFIXES = ['iVBORw0KGgo', '/9j/', 'R0lGOD', 'UklGR'];
const looksLikeBase64Image = (s: string | undefined): boolean => {
  if (!s) return false;
  const trimmed = s.trim();
  const head = trimmed.slice(0, 16);
  if (IMAGE_PREFIXES.some(p => head.startsWith(p))) return true;
  // JSON-wrapped image payloads (e.g. screenshot action returns
  // `[{"image":"iVBORw0KGgo...", "cursor":...}]`). Truncating these
  // mid-base64 would destroy the screenshot, so treat them as images.
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && /"(?:image|image_base64|imageBase64|screenshot|screenshot_base64|png|jpeg|jpg|b64|base64|data)"\s*:\s*"(?:data:image\/[a-z+.-]+;base64,)?(?:iVBORw0KGgo|\/9j\/|R0lGOD|UklGR)/i.test(trimmed)) {
    return true;
  }
  return false;
};

const TRUNCATION_MARKER = '…[truncated ';
const isOutputTruncated = (s: string | undefined): boolean => {
  if (!s) return false;
  return s.includes(TRUNCATION_MARKER);
};

const truncate = (s: string | undefined, n: number): string | undefined => {
  if (!s) return s;
  // Never truncate base64 image payloads — half a PNG cannot be decoded.
  if (looksLikeBase64Image(s)) return s;
  return s.length > n ? s.slice(0, n) + `\n…[truncated ${s.length - n} chars]` : s;
};

const getStoredSession = (hostUuid: string): StoredEntry[] => {
  // Read merged from canonical (hostname+arch) key + legacy uuid key so the
  // mini-popover and full terminal page share the same history.
  return readStoredSession(hostUuid) as StoredEntry[];
};

const saveSession = (hostUuid: string, entries: ActionDebugEntry[]) => {
  const toStore: StoredEntry[] = entries.map(e => ({
    entryId: String(e.entryId),
    actionName: e.actionName,
    commandText: e.commandText,
    status: (e.status === 'success' || e.status === 'error') ? e.status : undefined,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt,
    executionId: e.executionId,
    authorization: e.authorization,
    actionOutput: truncate(e.actionOutput, MAX_OUTPUT_CHARS),
    error: truncate(e.error, 2000),
  }));
  // Merge with existing — update in place if entryId matches, append if new
  const existing = getStoredSession(hostUuid);
  const existingMap = new Map(existing.map(e => [e.entryId || `${e.startedAt}`, e]));
  for (const entry of toStore) {
    existingMap.set(entry.entryId!, { ...existingMap.get(entry.entryId!) , ...entry });
  }
  let merged = Array.from(existingMap.values()).slice(-MAX_STORED);
  try {
    localStorage.setItem(HISTORY_KEY(hostUuid), JSON.stringify(merged));
  } catch (err) {
    // Quota exceeded — progressively shrink and retry
    for (const limit of [25, 10, 5, 1]) {
      try {
        merged = merged.slice(-limit).map(e => ({
          ...e,
          actionOutput: truncate(e.actionOutput, 2000),
          error: truncate(e.error, 500),
        }));
        localStorage.setItem(HISTORY_KEY(hostUuid), JSON.stringify(merged));
        return;
      } catch { /* keep shrinking */ }
    }
    try { localStorage.removeItem(HISTORY_KEY(hostUuid)); } catch { /* ignore */ }
  }
};

const getCommandHistory = (hostUuid: string): string[] => {
  const stored = getStoredSession(hostUuid);
  // Fall back to old cmd_history_ key if new one is empty
  if (stored.length === 0) {
    try {
      const old = JSON.parse(localStorage.getItem(`cmd_history_${hostUuid}`) || '[]');
      if (Array.isArray(old) && old.length > 0) return old;
    } catch { /* ignore */ }
  }
  const cmds: string[] = [];
  for (let i = stored.length - 1; i >= 0; i--) {
    const cmd = stored[i]?.commandText || stored[i]?.actionName;
    if (cmd) cmds.push(cmd);
  }
  return cmds;
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
  const hostState = location.state as { hostname?: string; groupName?: string; mode?: string; autoRunAction?: string } | null;

  // Host switcher state
  const [allHosts, setAllHosts] = useState<HostOption[]>([]);
  const [hostsLoaded, setHostsLoaded] = useState(false);
  const [hostSearchQuery, setHostSearchQuery] = useState('');
  const [hostSwitcherOpen, setHostSwitcherOpen] = useState(false);
  const [singleEnvFallback, setSingleEnvFallback] = useState<string>('');
  const [datastoreLookupDone, setDatastoreLookupDone] = useState(false);
  // Hostname resolved from sensors/assets datastores when the URL :hostUuid
  // doesn't match any env-stub host (covers cases where the env API and the
  // datastores use different UUIDs for the same machine).
  const [datastoreResolvedHostname, setDatastoreResolvedHostname] = useState<string>('');
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [agentPrivilege, setAgentPrivilege] = useState<AgentPrivilege>('unknown');

  // Resolve host info from location.state first, then fall back to allHosts lookup.
  // Match by UUID first, then by hostname (with tolerant domain-suffix stripping)
  // so deep links like /monitors/FRIKKYS-MACBOOK-PRO/terminal still resolve.
  const stripDomain = (h: string) => h.toLowerCase().trim().replace(/\.(local|lan|home|internal|corp)$/i, '');
  // URL segment is canonically `${hostname}:${arch}` (see hostUrlSegment).
  // We parse it once and resolve by hostname (with arch as tiebreaker), but
  // also keep the raw value working as a uuid for backwards compat.
  const parsedSegment = parseHostUrlSegment(hostUuid);
  const idLower = parsedSegment.hostname.toLowerCase().trim();
  const idStripped = stripDomain(parsedSegment.hostname);
  const archHint = parsedSegment.arch;
  const matchHost = (h: HostOption) => {
    const hn = (h.hostname || '').toLowerCase().trim();
    return hn === idLower || stripDomain(h.hostname || '') === idStripped;
  };
  const resolvedHost =
    // Backwards compat: raw uuid in the URL (rare — agent uuid changes on reinstall)
    allHosts.find(h => h.uuid === parsedSegment.raw) ||
    // Hostname match with arch tiebreaker when supplied
    (archHint
      ? allHosts.find(h => matchHost(h) && String(h.arch || '').toLowerCase() === archHint)
      : undefined) ||
    allHosts.find(matchHost);
  const hostname =
    hostState?.hostname ||
    resolvedHost?.hostname ||
    datastoreResolvedHostname ||
    (hostsLoaded ? (parsedSegment.hostname || 'Unknown Host') : '');
  const groupName = hostState?.groupName || resolvedHost?.groupName || singleEnvFallback || '';
  const mode = hostState?.mode || resolvedHost?.mode || 'full';
  const isFull = mode === 'full';
  const needsLoading = !hostState?.hostname && !hostsLoaded;
  // A hostname counts as resolved when we matched a real host record OR when
  // the URL segment itself is a hostname (the new canonical URL form). The
  // only "unresolved" case is when allHosts loaded with no match AND the
  // segment looks like a raw uuid we couldn't map.
  const hasResolvedHostname = Boolean(
    hostname &&
    hostname !== 'Unknown Host' &&
    (Boolean(resolvedHost) || Boolean(datastoreResolvedHostname) || Boolean(hostState?.hostname) || hostname === parsedSegment.hostname)
  );
  const hostLookupFailed = hostsLoaded && datastoreLookupDone && !hasResolvedHostname;
  const missingSensorGroup = hostsLoaded && datastoreLookupDone && hasResolvedHostname && !groupName;
  const canRunActions = hasResolvedHostname && Boolean(groupName) && !hostLookupFailed && !missingSensorGroup;
  const resolutionErrorMessage = hostLookupFailed
    ? `This terminal URL did not resolve to a monitor. We finished loading /getenvironments and the monitor datastores, but could not map ID ${parsedSegment.raw} to a hostname.`
    : missingSensorGroup
      ? `This monitor resolved as ${hostname}, but its environment Name was empty so no sensor_group could be sent.`
      : '';
  const displayHostname = hasResolvedHostname ? hostname : 'Unresolved monitor';

  // Map this URL alias (hostname[:arch] OR raw uuid) to the canonical
  // hostname+arch storage key so reads/writes match the mini-popover
  // regardless of how the host was addressed in the route.
  useEffect(() => {
    if (parsedSegment.raw && hostname && hostname !== 'Unknown Host') {
      registerHostIdentity(parsedSegment.raw, { hostname, arch: resolvedHost?.arch || archHint });
    }
  }, [parsedSegment.raw, hostname, resolvedHost?.arch, archHint]);

  // Demo terminal: when the URL points at a `demo-…` host (e.g.
  // /monitors/demo-host-fin-laptop-04/terminal) we lock the free-form
  // command input so the demo cannot be derailed by typing real shell
  // commands, but we still let the user click the "Isolate Host" predefined
  // chip so the agent's headline action remains demonstrable. We also
  // broadcast `demo-object-context` so the floating "Re-open demo tour"
  // pill stays visible while the terminal is open.
  const isDemoHost = /^demo-/i.test(hostUuid || '');
  useEffect(() => {
    if (!isDemoHost) return;
    window.dispatchEvent(
      new CustomEvent('demo-object-context', { detail: { active: true } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('demo-object-context', { detail: { active: false } }),
      );
    };
  }, [isDemoHost]);

  usePageMeta({ title: `Terminal · ${displayHostname}`, description: `Terminal session for ${displayHostname}` });

  const [customAction, setCustomAction] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [actionHistory, setActionHistory] = useState<ActionDebugEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [loadingEntries, setLoadingEntries] = useState<Set<number>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pollingActiveRef = useRef<Map<string, boolean>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingDisableRce, setPendingDisableRce] = useState<null | { actionId: string; actionName: string; isPredefined: boolean }>(null);


  const hostActionablePerms = DEFAULT_AGENT_PERMISSIONS
    .flatMap(c => c.permissions)
    .filter(p => p.hostActionable && !p.disabled);

  // Fetch all hosts for the switcher
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!res.ok) { setHostsLoaded(true); return; }
        const data = await res.json();
        const envs = Array.isArray(data) ? data.filter((e: any) => !e.archived && e.sensor_group === true) : [];
        const hosts: HostOption[] = envs.flatMap((env: any) => {
          const groupHosts = Array.isArray(env.sensor_hosts) ? env.sensor_hosts : [];
          const checks = Array.isArray(env.sensor_checks) ? env.sensor_checks : [];
          const hasResponseActions = checks.some((c: any) => c === 'response_actions');
          const modeStr = hasResponseActions ? 'full' : 'controlled';
          // Validate group name — env.Name is the authoritative sensor_group identifier
          const groupName = typeof env.Name === 'string' && env.Name.trim() ? env.Name.trim() : '';
          if (!groupName) {
            console.warn('[HostTerminal] Environment missing Name field, skipping:', env);
          }
          return groupHosts.map((h: any) => ({
            uuid: h.uuid,
            hostname: h.hostname,
            groupName,
            mode: modeStr,
            os: h.os || '',
            arch: h.arch || '',
            checkin: h.checkin,
          }));
        });
        // Register hostname+arch identity for each host so the storage key is
        // stable across uuid-vs-hostname URLs and matches the mini popover.
        for (const h of hosts) {
          registerHostIdentity(h.uuid, { hostname: h.hostname, arch: h.arch });
        }
        setAllHosts(hosts);
        // Fallback: if there's exactly one sensor group, use its Name when no
        // host match is found (mirrors MonitorDetailPage behavior).
        if (envs.length === 1 && typeof envs[0].Name === 'string' && envs[0].Name.trim()) {
          setSingleEnvFallback(envs[0].Name.trim());
        }
      } catch { /* ignore */ } finally {
        setHostsLoaded(true);
      }
    })();
  }, []);

  // After env hosts load, if the URL :hostUuid still didn't resolve to a hostname,
  // try matching against shuffle-security_sensors / shuffle-security_assets by
  // their `uuid` field. Avoids showing the raw UUID in the header.
  useEffect(() => {
    if (!hostsLoaded || !hostUuid) return;
    // Always fetch supplements: even when env stubs already resolve the hostname
    // we still need them to compute the active user (for the Screenshot chip).
    let cancelled = false;
    (async () => {
      try {
        const supplements = await fetchHostSupplements();
        const search = (map: Map<string, Record<string, unknown>>) => {
          // Direct hostname key match (supplements are keyed by hostname).
          const directHostname = (resolvedHost?.hostname || hostState?.hostname || '').toLowerCase().trim();
          if (directHostname && map.has(directHostname)) return map.get(directHostname) || null;
          for (const [, val] of map.entries()) {
            const recUuid = String((val as any).uuid || '').trim();
            const recHost = String((val as any).hostname || '').toLowerCase().trim();
            if ((recUuid && recUuid === hostUuid) || (recHost && recHost === idLower) || (recHost && stripDomain(recHost) === idStripped)) {
              return val;
            }
          }
          return null;
        };
        const foundRecord = search(supplements.sensorsByHost) || search(supplements.assetsByHost);
        if (!cancelled && foundRecord) {
          const hn = String((foundRecord as any).hostname || '').trim();
          if (hn) setDatastoreResolvedHostname(hn);
          const au = getActiveUser(foundRecord);
          if (au) setActiveUser(au);
          setAgentPrivilege(inferAgentPrivilege(foundRecord));
        }
      } catch { /* ignore */ }
      finally {
        if (!cancelled) setDatastoreLookupDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [hostsLoaded, hostUuid, hostState?.hostname, resolvedHost, datastoreResolvedHostname]);


  // Load stored session on mount / host change. We re-run when the resolved
  // hostname becomes known because the canonical storage key only resolves
  // *after* registerHostIdentity() has been called for this alias — the
  // mini-popover writes under `terminal_session_h:<hostname>|<arch>` and
  // without re-reading we'd be stuck on the empty `terminal_session_<urlSeg>`.
  useEffect(() => {
    if (!hostUuid) return;
    const stored = getStoredSession(hostUuid);
    if (stored.length === 0) return;
    setActionHistory(prev => {
      // Don't clobber in-flight entries the user just kicked off.
      if (prev.some(e => e.status === 'sending' || e.status === 'polling')) return prev;
      return stored.map((e) => ({
        entryId: ++entryIdCounter,
        hostUuid,
        actionName: e.actionName,
        commandText: e.commandText,
        hostname,
        status: (e.status === 'success' || e.status === 'error') ? e.status : 'error',
        requestBody: {},
        startedAt: e.startedAt,
        finishedAt: e.finishedAt,
        executionId: e.executionId,
        authorization: e.authorization,
        actionOutput: e.actionOutput,
        error: e.error,
      }));
    });
  }, [hostUuid, hostname, resolvedHost?.uuid, hostsLoaded]);

  // Save to localStorage when entries finish
  useEffect(() => {
    if (!hostUuid) return;
    const hasFinished = actionHistory.some(e => e.status === 'success' || e.status === 'error');
    if (hasFinished) saveSession(hostUuid, actionHistory);
  }, [actionHistory, hostUuid]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [actionHistory]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const removeHistoryEntry = useCallback((entryId: number) => {
    setActionHistory(prev => {
      const updated = prev.filter(e => e.entryId !== entryId);
      if (hostUuid) saveSession(hostUuid, updated);
      return updated;
    });
    setExpandedEntries(prev => { const next = new Set(prev); next.delete(entryId); return next; });
  }, [hostUuid]);

  const executeHostAction = useCallback(async (actionId: string, actionName: string, isPredefined = false, skipConfirm = false) => {
    if (!hostUuid) return;
    // Hard guard: backend rejects empty sensor_group / hosts with a confusing
    // "'sensor_group' can't be empty" error. Surface a clear message instead.
    if (!groupName || !hostname || hostname === 'Unknown Host') {
      return;
    }
    // Confirm gate for the irreversible disable_rce script
    const normalized = (isPredefined ? `script:${actionId}` : actionId).trim().toLowerCase();
    if (!skipConfirm && normalized === 'script:disable_rce') {
      setPendingDisableRce({ actionId, actionName, isPredefined });
      return;
    }
    const myId = ++entryIdCounter;
    const controller = new AbortController();
    const abortKey = `entry_${myId}`;
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
      entryId: myId,
      hostUuid,
      actionName,
      commandText: isPredefined ? `script:${actionId}` : actionId,
      hostname,
      status: 'sending',
      requestBody,
      startedAt: Date.now(),
    };

    setActionHistory(prev => [...prev, newEntry]);

    const updateMyEntry = (update: Partial<ActionDebugEntry>) => {
      setActionHistory(prev => {
        const idx = prev.findIndex(e => e.entryId === myId);
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
        updateMyEntry({ status: 'polling', responseStatus: resp.status, responseBody: text, executionId: execId, authorization: ((parsed as any).authorization as string) || execId });

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
            // Auto-expand when result arrives
            if (result.output || result.error) {
              setExpandedEntries(prev => new Set(prev).add(myId));
            }
            return;
          } catch {
            if (!pollingActiveRef.current.get(abortKey)) return;
            continue;
          }
        }
        if (pollingActiveRef.current.get(abortKey)) {
          updateMyEntry({ status: 'error', finishedAt: Date.now(), error: 'Timed out waiting for execution result (30 min).' });
          
        }
      } else {
        updateMyEntry({ status: 'success', responseStatus: resp.status, responseBody: text, finishedAt: Date.now() });
      }
    } catch (err) {
      if (!pollingActiveRef.current.get(abortKey)) return;
      const msg = err instanceof Error ? err.message : 'Request error';
      updateMyEntry({ status: 'error', finishedAt: Date.now(), error: msg });
      
    } finally {
      pollingActiveRef.current.delete(abortKey);
      abortControllersRef.current.delete(abortKey);
    }
  }, [groupName, hostLookupFailed, hostUuid, hostname]);

  // Auto-run an action passed via navigation state (e.g. "CBOM Scan" from /monitors/:id).
  // Fires once per navigation entry, after hostname + groupName have resolved.
  const autoRunFiredRef = useRef(false);
  useEffect(() => {
    if (autoRunFiredRef.current) return;
    const action = hostState?.autoRunAction;
    if (!action || !hostUuid) return;
    if (!hostname || hostname === 'Unknown Host') return;
    if (!groupName) return;
    autoRunFiredRef.current = true;
    executeHostAction(action, action, false);
    // Clear the state so a refresh doesn't re-trigger
    navigate(location.pathname, { replace: true, state: { hostname, groupName, mode: hostState?.mode } });
  }, [hostState, hostUuid, hostname, groupName, executeHostAction, navigate, location.pathname]);

  const abortAll = () => {
    pollingActiveRef.current.forEach((_, key) => {
      pollingActiveRef.current.set(key, false);
    });
    abortControllersRef.current.forEach(c => c.abort());
    abortControllersRef.current.clear();
  };

  const toggleExpanded = (entryId: number) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId); else next.add(entryId);
      return next;
    });
  };

  const fetchEntryResult = useCallback(async (entry: ActionDebugEntry) => {
    if (!entry.executionId || !entry.authorization) {
      
      return;
    }
    setLoadingEntries(prev => new Set(prev).add(entry.entryId));
    try {
      const resp = await fetch(getApiUrl('/api/v1/streams/results'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ execution_id: entry.executionId, authorization: entry.authorization }),
      });
      if (!resp.ok) {
        
        return;
      }
      const text = await resp.text();
      if (!text || text === '{}' || text === 'null') {
        
        return;
      }
      let pollData: unknown = null;
      try { pollData = JSON.parse(text); } catch { /* not JSON */ }
      const result = parseActionResult(pollData);
      setActionHistory(prev => prev.map(e =>
        e.entryId === entry.entryId
          ? { ...e, actionOutput: result.output || undefined, error: result.error || undefined, actionSuccess: result.success }
          : e
      ));
      setExpandedEntries(prev => new Set(prev).add(entry.entryId));
    } catch (err) {
      
    } finally {
      setLoadingEntries(prev => { const next = new Set(prev); next.delete(entry.entryId); return next; });
    }
  }, []);

  const finishedHistory = actionHistory.filter(e => e.status === 'success' || e.status === 'error');
  const runningEntries = actionHistory.filter(e => e.status === 'sending' || e.status === 'polling');

  const filteredHosts = allHosts
    .filter(h =>
      h.uuid !== hostUuid && (
        h.hostname.toLowerCase().includes(hostSearchQuery.toLowerCase()) ||
        h.groupName.toLowerCase().includes(hostSearchQuery.toLowerCase())
      )
    )
    .sort((a, b) => (b.checkin || 0) - (a.checkin || 0));

  // No host in URL: auto-redirect to most recently checked-in monitor, or
  // show an empty state pointing to /monitors when none exist.
  const noHostInUrl = !hostUuid;
  useEffect(() => {
    if (!noHostInUrl || !hostsLoaded || allHosts.length === 0) return;
    const sorted = [...allHosts].sort((a, b) => (b.checkin || 0) - (a.checkin || 0));
    const target = sorted[0];
    const seg = hostUrlSegment({ hostname: target.hostname, arch: target.arch, uuid: target.uuid });
    if (seg) navigate(`/monitors/${encodeURIComponent(seg)}/terminal`, { replace: true });
  }, [noHostInUrl, hostsLoaded, allHosts, navigate]);

  if (noHostInUrl && hostsLoaded && allHosts.length === 0) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center gap-4 text-muted-foreground px-6 text-center">
        <Terminal size={32} className="text-muted-foreground/60" />
        <div>
          <p className="text-base font-medium text-foreground">No sensors found</p>
          <p className="text-sm mt-1">Install a host monitor to start using Remote Control.</p>
        </div>
        <Button onClick={() => navigate('/monitors')} className="gap-1.5">
          Add Host monitors <ArrowRight size={14} />
        </Button>
      </div>
    );
  }

  if (needsLoading || (noHostInUrl && allHosts.length > 0)) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={24} className="animate-spin" />
        <span className="text-sm">Loading host info…</span>
      </div>
    );
  }

  // Note: even if the host UUID/hostname doesn't resolve, we still render the
  // full terminal UI so the user can pivot to another host via the switcher in
  // the header. Commands sent to an unknown host will simply fail.

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0 bg-background">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(hostUuid ? `/monitors/${encodeURIComponent(hostUuid)}` : '/monitors')}>
          <ArrowLeft size={16} />
        </Button>
        <Terminal size={18} className="text-primary" />
        {(() => {
          const currentHost = resolvedHost;
          const checkinDate = currentHost?.checkin ? new Date(currentHost.checkin * 1000) : null;
          const isRecent = checkinDate ? (Date.now() - checkinDate.getTime()) < 5 * 60 * 1000 : false;
          return (
        <Popover open={hostSwitcherOpen} onOpenChange={setHostSwitcherOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 min-w-0 text-left hover:bg-muted/50 rounded-md px-2 py-1 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold text-foreground truncate">{hostname}</h1>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isRecent ? 'bg-[hsl(var(--severity-low))]' : 'bg-muted-foreground/40'}`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFull ? 'Full control (RCE)' : 'Controlled'} · {groupName}
                  {checkinDate && <> · Last seen {checkinDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
                </p>
              </div>
              <ChevronDown size={14} className="text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search monitors…"
                  value={hostSearchQuery}
                  onChange={e => setHostSearchQuery(e.target.value)}
                  className="h-8 text-sm pl-8"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredHosts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No other monitors found</p>
              ) : (
                filteredHosts.map(h => {
                  const checkinDate = h.checkin ? new Date(h.checkin * 1000) : null;
                  const isRecent = checkinDate ? (Date.now() - checkinDate.getTime()) < 5 * 60 * 1000 : false;
                  return (
                  <button
                    key={h.uuid}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setHostSwitcherOpen(false);
                      setHostSearchQuery('');
                      setActionHistory([]);
                      setCustomAction('');
                      setHistoryIndex(-1);
                      navigate(`/monitors/${encodeURIComponent(hostUrlSegment(h))}/terminal`, {
                        state: { hostname: h.hostname, groupName: h.groupName, mode: h.mode },
                        replace: true,
                      });
                    }}
                  >
                    <div className="relative shrink-0">
                      <Terminal size={12} className="text-muted-foreground" />
                      <div className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isRecent ? 'bg-[hsl(var(--severity-low))]' : 'bg-muted-foreground/40'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{h.hostname}</p>
                      <p className="text-[0.65rem] text-muted-foreground truncate">
                        {h.groupName} · {h.os}
                        {checkinDate && <> · {checkinDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
                      </p>
                    </div>
                  </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
          );
        })()}
        <div className="flex-1" />
        {runningEntries.length > 0 && (
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">{runningEntries.length} running</span>
          </div>
        )}
      </div>

      {/* Scrollable session log */}
      <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
        {resolutionErrorMessage && (
          <div className="mx-6 mt-6 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive">
              {hostLookupFailed ? 'Monitor resolution failed' : 'Sensor group missing'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{resolutionErrorMessage}</p>
          </div>
        )}

        {actionHistory.length === 0 && !resolutionErrorMessage && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Terminal size={40} className="opacity-30" />
            <p className="text-sm">No commands run yet. Type a command or use the predefined actions below.</p>
          </div>
        )}

        {actionHistory.map((entry, i) => {
          const isLatest = entry.status !== 'sending' && entry.status !== 'polling' && i === actionHistory.map((e, idx) => e.status === 'success' || e.status === 'error' ? idx : -1).filter(x => x >= 0).pop();
          const isRunning = entry.status === 'sending' || entry.status === 'polling';
          const hasOutput = !!(entry.actionOutput || entry.error);
          const isExpanded = expandedEntries.has(entry.entryId);
          const isLoading = loadingEntries.has(entry.entryId);
          const canReload = !isRunning && !!entry.executionId && !!entry.authorization;
          // historyIndex 0 = most recent (last entry), 1 = second-to-last, etc.
          const isHistorySelected = historyIndex >= 0 && i === (actionHistory.length - 1 - historyIndex);

          return (
            <div key={entry.entryId} className={`border-b border-border/50 last:border-b-0 ${isLatest ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''} ${isHistorySelected ? 'ring-1 ring-inset ring-primary/40' : ''}`}>
              <button
                type="button"
                className={`w-full text-left px-6 py-2.5 flex items-center gap-3 transition-colors hover:bg-muted/30 ${isHistorySelected ? 'bg-primary/15' : isLatest ? 'bg-primary/10' : isRunning ? 'bg-muted/30' : 'bg-muted/10'}`}
                onClick={() => {
                  if (isRunning) return;
                  if (hasOutput) {
                    toggleExpanded(entry.entryId);
                  } else if (canReload) {
                    fetchEntryResult(entry);
                  }
                }}
              >
                {isHistorySelected && (
                  <ArrowRight size={12} className="text-primary shrink-0 -ml-3" />
                )}
                {!isRunning && (hasOutput || canReload) && (
                  <span className="shrink-0 text-muted-foreground">
                    {isExpanded && hasOutput ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                )}
                <span className="text-sm font-mono text-primary">$</span>
                <span className="text-sm font-mono font-medium text-foreground flex-1 truncate">{entry.actionName}</span>
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin text-primary shrink-0" />
                ) : isRunning ? (
                  <Loader2 size={14} className="animate-spin text-primary shrink-0" />
                ) : entry.status === 'success' ? (
                  <CheckCircle2 size={14} className="text-[hsl(var(--severity-low))] shrink-0" />
                ) : (
                  <ShieldX size={14} className="text-destructive shrink-0" />
                )}
                {!hasOutput && canReload && !isLoading && (
                  <RefreshCw size={12} className="text-muted-foreground shrink-0" />
                )}
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {new Date(entry.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {entry.finishedAt && (
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {Math.round((entry.finishedAt - entry.startedAt) / 1000)}s
                  </span>
                )}
                {isRunning ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      const abortKey = `entry_${entry.entryId}`;
                      const ctrl = abortControllersRef.current.get(abortKey);
                      if (ctrl) {
                        pollingActiveRef.current.set(abortKey, false);
                        ctrl.abort();
                      }
                      setActionHistory(prev => prev.map(e =>
                        e.entryId === entry.entryId
                          ? { ...e, status: 'error' as const, finishedAt: Date.now(), error: 'Aborted by user' }
                          : e
                      ));
                    }}
                  >
                    Stop
                  </Button>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors p-0.5"
                    onClick={(e) => { e.stopPropagation(); removeHistoryEntry(entry.entryId); }}
                    title="Remove from history"
                  >
                    <X size={12} />
                  </button>
                )}
              </button>
              {isRunning && (
                <div className="px-6 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    {entry.status === 'sending' ? 'Sending…' : 'Waiting for result…'}
                  </span>
                </div>
              )}
              {isExpanded && hasOutput && (
                <div className="px-6 py-2.5">
                  {entry.actionOutput && (
                    <ActionOutputView
                      output={entry.actionOutput}
                      className="text-sm font-mono text-foreground/80 whitespace-pre-wrap break-words"
                    />
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

      {/* Predefined action chips (shared definition — must match the popover on /monitors) */}
      <div className="px-6 py-3 border-t border-border/50 shrink-0">
        <HostActionChips
          activeUser={activeUser}
          agentPrivilege={agentPrivilege}
          arch={`${resolvedHost?.os || ''} ${resolvedHost?.arch || ''} ${hostname || ''}`}
          size="comfortable"
          allDisabled={!canRunActions}
          allDisabledReason="Monitor resolution required before running predefined actions"
          customHandler={(id) => {
            // Demo terminal: intercept "Isolate Host" so we can fake a successful
            // result against FIN-LAPTOP-04 without hitting the real backend.
            if (isDemoHost && id === 'isolate_host') {
              const startedAt = Date.now();
              const entryId = ++entryIdCounter;
              const sendingEntry: ActionDebugEntry = {
                entryId,
                hostUuid: hostUuid || '',
                actionName: 'Isolate Host',
                hostname,
                status: 'sending',
                requestBody: { demo: true, action: id, host: hostname },
                startedAt,
              };
              setActionHistory(prev => [...prev, sendingEntry]);
              setTimeout(() => {
                setActionHistory(prev => prev.map(e => e.entryId === entryId ? {
                  ...e,
                  status: 'success',
                  finishedAt: Date.now(),
                  actionOutput: `Network isolation policy applied to ${hostname}.\nAll outbound connections blocked except to the security platform.\nUser session preserved. Awaiting analyst review.`,
                  actionSuccess: true,
                } : e));
                
              }, 1200);
              return true;
            }
            // In demo mode, every other predefined action is a no-op.
            if (isDemoHost) return true;
            return false;
          }}
          onRun={({ actionId, displayName }) => executeHostAction(actionId, displayName, true)}
        />
      </div>

      {/* Command input */}
      <div className="px-6 py-3 border-t border-border shrink-0 bg-background">
        <div className="flex gap-2 items-center max-w-4xl">
          <span className="text-sm font-mono text-primary shrink-0">$</span>
          <Input
            placeholder={
              isDemoHost
                ? 'Custom commands are disabled in the demo — use "Isolate Host"'
                : canRunActions
                  ? (isFull ? 'Type command…' : 'Custom action…')
                  : 'Monitor resolution required before running commands'
            }
            value={customAction}
            onChange={e => setCustomAction(e.target.value)}
            className="h-9 text-sm flex-1 font-mono"
            ref={inputRef}
            disabled={!canRunActions || isDemoHost}
            onKeyDown={e => {
              // Full ordered history, every entry (no dedup), most recent first
              const history = [...actionHistory].reverse().map(e => e.commandText || e.actionName).filter(Boolean);
              if (e.key === 'Enter' && customAction.trim()) {
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
            disabled={!canRunActions || isDemoHost || !customAction.trim()}
            onClick={() => {
              if (customAction.trim()) {
                executeHostAction(customAction.trim(), customAction.trim());
                setCustomAction('');
              }
            }}
          >
            <Play size={14} />
          </Button>
        </div>
        <p className="text-[0.65rem] text-muted-foreground/60 mt-2.5 pl-5 max-w-4xl">
          {isDemoHost
            ? 'Demo terminal — only the "Isolate Host" predefined action is enabled.'
            : 'No session is created — each command is standalone. Full history is saved as Workflow Executions, with sessions stored locally in your browser.'}
        </p>
      </div>

      <AlertDialog open={!!pendingDisableRce} onOpenChange={(o) => { if (!o) setPendingDisableRce(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Remote Code Execution?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you 100% sure? This will disable RCE on <span className="font-mono text-foreground">{hostname}</span>.
              You will <strong>not</strong> be able to turn it back on without restarting the agent on the host.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const p = pendingDisableRce;
                setPendingDisableRce(null);
                if (p) executeHostAction(p.actionId, p.actionName, p.isPredefined, true);
              }}
            >
              Yes, disable RCE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HostTerminalPage;
