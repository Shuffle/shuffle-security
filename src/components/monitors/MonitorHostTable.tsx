/**
 * Shared host monitor table — the EXACT row UI used on /monitors and /assets.
 * Owns all internal state (sorting, expansion, action execution, history,
 * terminal popover, custom action input) so callers just pass `hosts` and
 * an optional `onRefresh` callback.
 *
 * Both /monitors (VulnAssetsPage) and /assets (AssetsPage) render this so
 * any future column / dot / action work happens in one place.
 */
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, HardDrive, Lock, Package, FileCode, Zap, Send, Laptop,
  Play, Loader2, Maximize2, Terminal, CheckCircle2, ShieldX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { HostDetailPanel } from './HostDetailPanel';

// ── Helpers (identical to the originals on VulnAssetsPage) ─────────────────
const OsIcon = ({ os, size = 14, className = '' }: { os?: string; size?: number; className?: string }) => {
  const lower = (os || '').toLowerCase();
  if (lower.includes('darwin') || lower.includes('mac') || lower.includes('ios')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    );
  }
  if (lower.includes('windows') || lower.includes('win')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
        <path d="M3 12V6.5l8-1.1V12H3zm10 0V5.2l8-1.2V12h-8zM3 13h8v6.7l-8-1.1V13zm10 0h8v6.9l-8 1.2V13z"/>
      </svg>
    );
  }
  if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') || lower.includes('centos') || lower.includes('redhat') || lower.includes('fedora')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
        <path d="M12.5 2c-1.63 0-2.94 1.85-2.94 4.13 0 .74.12 1.43.32 2.05C7.47 9.01 5.5 10.64 5.5 12.5c0 1.39.86 2.62 2.18 3.44-.13.46-.2.95-.2 1.46 0 2.76 1.79 5 4 5s4-2.24 4-5c0-.51-.07-1-.2-1.46 1.32-.82 2.18-2.05 2.18-3.44 0-1.86-1.97-3.49-4.38-4.32.2-.62.32-1.31.32-2.05C13.4 3.85 12.09 2 12.5 2zm-1.5 5c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm3 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-1.5 3c1.1 0 2 .67 2 1.5s-.9 1.5-2 1.5-2-.67-2-1.5.9-1.5 2-1.5z"/>
      </svg>
    );
  }
  return <Laptop size={size} className={className} />;
};

const fmtRaw = (value: unknown): string => {
  if (value === undefined) return '(field not set)';
  if (value === null) return 'null';
  if (value === '') return '"" (empty string)';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
};

const parseResponseActionsState = (value: unknown): { enabled: boolean; mode: 'full' | 'controlled' | null } => {
  const raw = String(value ?? '').toLowerCase().trim();
  const enabled = value !== undefined && value !== null && raw !== '' && raw !== 'false' && raw !== '0' && raw !== 'no' && raw !== 'off';
  return { enabled, mode: enabled ? (raw.includes('full') ? 'full' : 'controlled') : null };
};

const isActiveMonitoringEnabled = (host: { log_forwarding?: unknown }): boolean => {
  const v = host.log_forwarding;
  if (v === undefined || v === null) return false;
  const raw = String(v).toLowerCase().trim();
  if (!raw) return false;
  // Explicit off / unconfigured states
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
  if (raw.includes('not implemented') || raw.includes('not configured') || raw.includes('disabled')) return false;
  // String like "not implemented: false" or "...: false" → treat as off
  if (/[:=]\s*false\s*$/.test(raw)) return false;
  return true;
};

const triState = (v: unknown): 'on' | 'off' | 'empty' => {
  if (v === true || v === 'true' || v === 'TRUE') return 'on';
  if (v === false || v === 'false' || v === 'FALSE' || v === '0' || v === 0 || v === 'no' || v === 'off') return 'off';
  return 'empty';
};

// ── Types ───────────────────────────────────────────────────────────────────
export interface MonitorHost {
  uuid: string;
  hostname: string;
  os?: string;
  arch?: string;
  serial?: string;
  checkin?: number;
  hd_encrypted?: boolean | string;
  automatic_screen_lock_enabled?: boolean | string;
  installed_software?: unknown[];
  code_scanner?: unknown[];
  response_actions?: boolean | string;
  log_forwarding?: string;
  groupName?: string;
  [key: string]: unknown;
}

type ActionDebugEntry = {
  entryId: string;
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
  authorization?: string;
  actionOutput?: string;
  actionSuccess?: boolean;
};

interface MonitorHostTableProps {
  hosts: MonitorHost[];
  /** Called after a successful action to let the parent reload data. */
  onRefresh?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export const MonitorHostTable = ({ hosts, onRefresh }: MonitorHostTableProps) => {
  const navigate = useNavigate();
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [actionExecuting, setActionExecuting] = useState<Set<string>>(new Set());
  const [actionHistoryMap, setActionHistoryMap] = useState<Map<string, ActionDebugEntry[]>>(new Map());
  const [pendingDisableRce, setPendingDisableRce] = useState<null | { actionId: string; actionName: string; hostname: string; groupName: string; hostUuid: string; isPredefined: boolean }>(null);
  const [customAction, setCustomAction] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pollingActiveRef = useRef<Map<string, boolean>>(new Map());

  // Broadcast a "demo object in view" signal whenever a demo-seeded host row
  // is currently expanded. The DemoTourDrawer listens to this and surfaces
  // the glowing "Re-open demo tour" pill so the user is not left wondering
  // whether the FIN-LAPTOP-04 row is real data.
  useEffect(() => {
    const expandedDemo = Array.from(expandedHosts).some(rowKey => {
      const uuid = rowKey.startsWith('uuid:') ? rowKey.slice(5) : '';
      if (uuid && /^demo-/i.test(uuid)) return true;
      const matched = hosts.find(h => `uuid:${h.uuid}` === rowKey || rowKey.includes(`::${(h.hostname || '').toLowerCase()}::`));
      return !!matched && /^demo-/i.test(String(matched.uuid || ''));
    });
    window.dispatchEvent(
      new CustomEvent('demo-object-context', { detail: { active: expandedDemo } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('demo-object-context', { detail: { active: false } }),
      );
    };
  }, [expandedHosts, hosts]);


  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortAsc) setSortAsc(false);
      else { setSortCol(null); setSortAsc(true); }
    } else { setSortCol(col); setSortAsc(true); }
  };
  const sortArrow = (col: string) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : '';

  const defaultSort = (a: MonitorHost, b: MonitorHost) => {
    const ca = a.checkin || 0, cb = b.checkin || 0;
    if (cb !== ca) return cb - ca;
    return (a.hostname || '').localeCompare(b.hostname || '');
  };
  const allHosts = !sortCol ? [...hosts].sort(defaultSort) : [...hosts].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case 'os': cmp = (a.os || '').localeCompare(b.os || ''); break;
      case 'hostname': cmp = (a.hostname || '').localeCompare(b.hostname || ''); break;
      case 'hd': cmp = Number(a.hd_encrypted === true || a.hd_encrypted === 'true') - Number(b.hd_encrypted === true || b.hd_encrypted === 'true'); break;
      case 'screenlock': cmp = Number(a.automatic_screen_lock_enabled === true || a.automatic_screen_lock_enabled === 'true') - Number(b.automatic_screen_lock_enabled === true || b.automatic_screen_lock_enabled === 'true'); break;
      case 'software': cmp = (Array.isArray(a.installed_software) ? a.installed_software.length : 0) - (Array.isArray(b.installed_software) ? b.installed_software.length : 0); break;
      case 'codescan': cmp = (Array.isArray(a.code_scanner) ? a.code_scanner.length : 0) - (Array.isArray(b.code_scanner) ? b.code_scanner.length : 0); break;
      case 'response': cmp = Number(parseResponseActionsState(a.response_actions).enabled) - Number(parseResponseActionsState(b.response_actions).enabled); break;
      case 'logfwd': cmp = Number(!!a.log_forwarding) - Number(!!b.log_forwarding); break;
      case 'group': cmp = (a.groupName || '').localeCompare(b.groupName || ''); break;
      case 'checkin': cmp = (a.checkin || 0) - (b.checkin || 0); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  // ── Action history (localStorage-backed) ──────────────────────────────────
  const hydrateHost = useCallback((hostUuid: string) => {
    setActionHistoryMap(prev => {
      if ((prev.get(hostUuid) || []).length > 0) return prev;
      try {
        const stored = JSON.parse(localStorage.getItem(`terminal_session_${hostUuid}`) || '[]');
        if (Array.isArray(stored) && stored.length > 0) {
          const next = new Map(prev);
          next.set(hostUuid, stored.map((e: any, i: number) => ({
            entryId: e.entryId || `${e.startedAt || i}-${Math.random().toString(36).slice(2, 8)}`,
            actionName: e.actionName || '',
            status: e.status || 'error',
            startedAt: e.startedAt || 0,
            finishedAt: e.finishedAt,
            executionId: e.executionId,
            authorization: e.authorization,
            actionOutput: e.actionOutput,
            error: e.error,
            hostUuid,
            hostname: '',
            requestBody: {},
          } as ActionDebugEntry)));
          return next;
        }
      } catch { /* ignore */ }
      return prev;
    });
  }, []);

  const getLatestDebug = (hostUuid: string): ActionDebugEntry | undefined => {
    const history = actionHistoryMap.get(hostUuid);
    return history?.[history.length - 1];
  };

  const pushHostDebug = (hostUuid: string, entry: ActionDebugEntry) => {
    setActionHistoryMap(prev => {
      const next = new Map(prev);
      const existing = next.get(hostUuid) || [];
      next.set(hostUuid, [...existing, entry]);
      return next;
    });
    try {
      const key = `terminal_session_${hostUuid}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      stored.push({
        entryId: entry.entryId, actionName: entry.actionName, status: entry.status,
        startedAt: entry.startedAt, finishedAt: entry.finishedAt,
        executionId: entry.executionId, authorization: entry.authorization,
      });
      if (stored.length > 200) stored.splice(0, stored.length - 200);
      localStorage.setItem(key, JSON.stringify(stored));
    } catch { /* ignore */ }
  };

  const updateHostDebug = (hostUuid: string, targetEntryId: string, update: Partial<ActionDebugEntry>) => {
    setActionHistoryMap(prev => {
      const history = prev.get(hostUuid);
      if (!history || history.length === 0) return prev;
      const idx = history.findIndex(e => e.entryId === targetEntryId);
      if (idx < 0) return prev;
      const next = new Map(prev);
      const latest = { ...history[idx], ...update };
      const updated = [...history];
      updated[idx] = latest;
      next.set(hostUuid, updated);
      if (latest.status === 'success' || latest.status === 'error') {
        try {
          const key = `terminal_session_${hostUuid}`;
          const stored = JSON.parse(localStorage.getItem(key) || '[]');
          const sIdx = stored.findIndex((e: any) => e.entryId === latest.entryId);
          if (sIdx >= 0) {
            stored[sIdx] = { ...stored[sIdx], status: latest.status, finishedAt: latest.finishedAt, executionId: latest.executionId, authorization: latest.authorization };
          } else {
            stored.push({ entryId: latest.entryId, actionName: latest.actionName, status: latest.status, startedAt: latest.startedAt, finishedAt: latest.finishedAt, executionId: latest.executionId, authorization: latest.authorization });
            if (stored.length > 200) stored.splice(0, stored.length - 200);
          }
          localStorage.setItem(key, JSON.stringify(stored));
        } catch { /* ignore */ }
      }
      return next;
    });
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
    } catch { return { success: true, output: null, error: null }; }
  };

  const executeHostAction = async (actionId: string, actionName: string, hostname: string, groupName: string, hostUuid: string, isPredefined = false, skipConfirm = false) => {
    const normalized = (isPredefined ? `script:${actionId}` : actionId).trim().toLowerCase();
    if (!skipConfirm && normalized === 'script:disable_rce') {
      setPendingDisableRce({ actionId, actionName, hostname, groupName, hostUuid, isPredefined });
      return;
    }
    const controller = new AbortController();
    abortControllersRef.current.set(hostUuid, controller);
    pollingActiveRef.current.set(hostUuid, true);
    setActionExecuting(prev => new Set(prev).add(hostUuid));
    const requestBody = {
      app_id: 'sensors', app_name: 'sensors', name: 'run_action',
      parameters: [
        { name: 'action', value: isPredefined ? `script:${actionId}` : actionId },
        { name: 'hosts', value: hostname },
        { name: 'sensor_group', value: groupName },
      ],
    };
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pushHostDebug(hostUuid, { entryId, hostUuid, actionName, hostname, status: 'sending', requestBody, startedAt: Date.now() });
    try {
      const resp = await fetch(getApiUrl('/api/v1/apps/sensors/run'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(requestBody), signal: controller.signal,
      });
      const text = await resp.text().catch(() => '');
      if (!resp.ok) {
        updateHostDebug(hostUuid, entryId, { status: 'error', responseStatus: resp.status, responseBody: text, finishedAt: Date.now(), error: text || `HTTP ${resp.status}` });
        toast.error('Action failed', { description: text || `HTTP ${resp.status}` });
        return;
      }
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* not JSON */ }
      if (parsed && typeof parsed === 'object' && parsed !== null && typeof (parsed as Record<string, unknown>).execution_id === 'string' && (parsed as Record<string, unknown>).execution_id) {
        const execId = (parsed as Record<string, unknown>).execution_id as string;
        updateHostDebug(hostUuid, entryId, { status: 'polling', responseStatus: resp.status, responseBody: text, executionId: execId, authorization: ((parsed as any).authorization as string) || execId });
        const maxAttempts = 900;
        const intervalMs = 2000;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (!pollingActiveRef.current.get(hostUuid)) return;
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, intervalMs);
            controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
          });
          if (!pollingActiveRef.current.get(hostUuid)) return;
          try {
            const pollResp = await fetch(getApiUrl('/api/v1/streams/results'), {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
              body: JSON.stringify({ execution_id: execId, authorization: execId }),
              signal: controller.signal,
            });
            if (!pollResp.ok) {
              if (pollResp.status >= 400 && pollResp.status < 500) {
                updateHostDebug(hostUuid, entryId, { status: 'error', responseBody: `Poll error ${pollResp.status}`, finishedAt: Date.now(), error: `HTTP ${pollResp.status}` });
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
            const parsedRes = parseActionResult(pollData);
            updateHostDebug(hostUuid, entryId, {
              status: parsedRes.success ? 'success' : 'error',
              responseBody: pollText, finishedAt: Date.now(),
              actionOutput: parsedRes.output || undefined,
              actionSuccess: parsedRes.success,
              error: parsedRes.success ? undefined : (parsedRes.error || parsedRes.output || 'Action reported failure'),
            });
            if (!parsedRes.success) {
              toast.error('Action failed', { description: parsedRes.error || parsedRes.output || `"${actionName}" → ${hostname}` });
            }
            return;
          } catch {
            if (!pollingActiveRef.current.get(hostUuid)) return;
            continue;
          }
        }
        if (pollingActiveRef.current.get(hostUuid)) {
          updateHostDebug(hostUuid, entryId, { status: 'error', finishedAt: Date.now(), error: 'Timed out waiting for execution result (30 min).' });
          toast.error('Action timed out', { description: 'No result after 30 minutes.' });
        }
      } else {
        updateHostDebug(hostUuid, entryId, { status: 'success', responseStatus: resp.status, responseBody: text, finishedAt: Date.now() });
      }
    } catch (err) {
      if (!pollingActiveRef.current.get(hostUuid)) return;
      const msg = err instanceof Error ? err.message : 'Request error';
      updateHostDebug(hostUuid, entryId, { status: 'error', finishedAt: Date.now(), error: msg });
      toast.error('Action failed', { description: msg });
    } finally {
      pollingActiveRef.current.delete(hostUuid);
      abortControllersRef.current.delete(hostUuid);
      setActionExecuting(prev => { const next = new Set(prev); next.delete(hostUuid); return next; });
      onRefresh?.();
    }
  };

  const abortHostAction = (hostUuid: string) => {
    pollingActiveRef.current.set(hostUuid, false);
    const controller = abortControllersRef.current.get(hostUuid);
    if (controller) controller.abort();
    abortControllersRef.current.delete(hostUuid);
    const debugEntry = getLatestDebug(hostUuid);
    if (debugEntry?.executionId) {
      fetch(getApiUrl(`/api/v1/workflows/${debugEntry.executionId}/executions/${debugEntry.executionId}/abort`), {
        method: 'GET', credentials: 'include', headers: { ...getAuthHeader() },
      }).catch(() => { /* best effort */ });
    }
    if (debugEntry?.entryId) {
      updateHostDebug(hostUuid, debugEntry.entryId, { status: 'error', finishedAt: Date.now(), error: 'Aborted by user' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="border-t border-border">
        {/* Table header */}
        <div className="grid grid-cols-[2rem_1.5fr_2rem_2rem_2rem_2rem_2rem_2rem_0.7fr_0.8fr_2.5rem] gap-2 px-5 py-2 border-b border-border bg-muted/30 items-center">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild>
              <span className="text-xs font-semibold text-muted-foreground cursor-pointer select-none flex items-center gap-1" onClick={() => toggleSort('os')}>
                OS{sortArrow('os')}
              </span>
            </TooltipTrigger><TooltipContent>Sort by Operating System</TooltipContent></Tooltip>
          </TooltipProvider>
          <span className="text-xs font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('hostname')}>Hostname{sortArrow('hostname')}</span>
          <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center cursor-pointer" onClick={() => toggleSort('hd')}><HardDrive size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">HD Encrypted{sortArrow('hd')}</p><p className="text-[0.65rem] text-muted-foreground">Click to sort</p></TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center cursor-pointer" onClick={() => toggleSort('screenlock')}><Lock size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Screenlock{sortArrow('screenlock')}</p><p className="text-[0.65rem] text-muted-foreground">Click to sort</p></TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center cursor-pointer" onClick={() => toggleSort('software')}><Package size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Installed Software{sortArrow('software')}</p><p className="text-[0.65rem] text-muted-foreground">Click to sort by count</p></TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center cursor-pointer" onClick={() => toggleSort('codescan')}><FileCode size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Code Package Scanner{sortArrow('codescan')}</p><p className="text-[0.65rem] text-muted-foreground">Click to sort by count</p></TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center cursor-pointer" onClick={() => toggleSort('response')}><Zap size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Response Actions{sortArrow('response')}</p><p className="text-[0.65rem] text-muted-foreground">Click to sort</p></TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center cursor-pointer" onClick={() => toggleSort('logfwd')}><Send size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Active Monitoring{sortArrow('logfwd')}</p><p className="text-[0.65rem] text-muted-foreground">Not generally available yet</p></TooltipContent></Tooltip></TooltipProvider>
          <span className="text-xs font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('group')}>Group{sortArrow('group')}</span>
          <span className="text-xs font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('checkin')}>Last Check-in{sortArrow('checkin')}</span>
          <span className="text-xs font-semibold text-muted-foreground">Actions</span>
        </div>
        {/* Host rows */}
        {allHosts.map((host, idx) => {
          const checkinDate = host.checkin ? new Date(host.checkin * 1000) : null;
          const isRecent = checkinDate ? (Date.now() - checkinDate.getTime()) < 5 * 60 * 1000 : false;
          const hdState = triState(host.hd_encrypted);
          const hdEncrypted = hdState === 'on';
          const screenlockState = triState(host.automatic_screen_lock_enabled);
          const screenlockOn = screenlockState === 'on';
          const softwareCount = Array.isArray(host.installed_software) ? host.installed_software.length : 0;
          const codeScanCount = Array.isArray(host.code_scanner) ? host.code_scanner.length : 0;
          const responseActionsRaw = host.response_actions;
          const responseActionsState = parseResponseActionsState(responseActionsRaw);
          const responseActionsOn = responseActionsState.enabled;
          const responseActionsMode = responseActionsState.mode;
          const logForwardingOn = isActiveMonitoringEnabled(host);
          // Stable per-row key: uuid when present, otherwise groupId+hostname+idx.
          // Avoids collapsing all uuid-less rows into a single expansion entry.
          const rowKey = (host.uuid && String(host.uuid).trim())
            ? `uuid:${host.uuid}`
            : `gh:${(host as any).groupId || ''}::${(host.hostname || '').toLowerCase()}::${idx}`;
          const isExpanded = expandedHosts.has(rowKey);
          const toggleExpanded = () => {
            setExpandedHosts(prev => {
              const next = new Set(prev);
              if (next.has(rowKey)) next.delete(rowKey);
              else next.add(rowKey);
              return next;
            });
          };
          const CheckDot = ({ on, tip, color, state }: { on: boolean; tip: string; color?: string; state?: 'on' | 'off' | 'empty' }) => {
            const dotColor = state === 'off'
              ? 'bg-[hsl(var(--severity-critical))]'
              : on
                ? (color || 'bg-[hsl(var(--severity-low))]')
                : 'bg-muted-foreground/30';
            return (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex justify-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{tip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          };
          return (
            <div key={host.uuid}>
              <div
                className="grid grid-cols-[2rem_1.5fr_2rem_2rem_2rem_2rem_2rem_2rem_0.7fr_0.8fr_2.5rem] gap-2 px-5 py-3 border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors items-center cursor-pointer"
                onClick={toggleExpanded}
              >
                <div className="flex items-center justify-center">
                  <OsIcon os={host.os} size={14} className="text-muted-foreground" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight size={14} className={`text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span className="text-sm font-medium text-foreground truncate">{host.hostname}</span>
                  </div>
                </div>
                <CheckDot on={hdEncrypted} state={hdState} tip={`hd_encrypted = ${fmtRaw(host.hd_encrypted)}`} />
                <CheckDot on={screenlockOn} state={screenlockState} tip={`automatic_screen_lock_enabled = ${fmtRaw(host.automatic_screen_lock_enabled)}`} />
                <CheckDot
                  on={softwareCount > 0}
                  tip={Array.isArray(host.installed_software)
                    ? `installed_software: ${softwareCount} ${softwareCount === 1 ? 'item' : 'items'}`
                    : `installed_software = ${fmtRaw(host.installed_software)}`}
                />
                <CheckDot
                  on={codeScanCount > 0}
                  tip={Array.isArray(host.code_scanner)
                    ? `code_scanner: ${codeScanCount} ${codeScanCount === 1 ? 'project' : 'projects'}`
                    : `code_scanner = ${fmtRaw(host.code_scanner)}`}
                />
                <CheckDot
                  on={responseActionsOn}
                  tip={`response_actions = ${fmtRaw(responseActionsRaw)}`}
                  color={responseActionsMode === 'full' ? 'bg-[hsl(var(--severity-high))]' : 'bg-[hsl(var(--severity-low))]'}
                />
                <CheckDot on={logForwardingOn} tip={`log_forwarding = ${fmtRaw(host.log_forwarding)}`} />
                <span className="text-xs text-muted-foreground truncate">{host.groupName}</span>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 cursor-help">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRecent ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                        <span className="text-xs text-muted-foreground">
                          {checkinDate ? checkinDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {checkinDate ? (() => {
                        const now = Date.now();
                        const diff = now - checkinDate.getTime();
                        const seconds = Math.floor(diff / 1000);
                        const mins = Math.floor(diff / 60000);
                        const hrs = Math.floor(mins / 60);
                        const days = Math.floor(hrs / 24);
                        let relativeTime = '';
                        if (seconds < 60) relativeTime = `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
                        else if (mins < 60) relativeTime = `${mins} minute${mins !== 1 ? 's' : ''} ago`;
                        else if (hrs < 24) relativeTime = `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
                        else relativeTime = `${days} day${days !== 1 ? 's' : ''} ago`;
                        const exactTime = checkinDate.toLocaleString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                        });
                        return (
                          <div className="text-xs">
                            <div className="font-semibold">{exactTime}</div>
                            <div className="text-muted-foreground">({relativeTime})</div>
                          </div>
                        );
                      })() : '—'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Actions popover */}
                <div className="flex items-center justify-end gap-2.5" onClick={e => e.stopPropagation()}>
                  {responseActionsOn ? (
                    <Popover onOpenChange={(open) => { if (open) hydrateHost(host.uuid); }}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                          {actionExecuting.has(host.uuid) ? (
                            <Loader2 size={14} className="animate-spin text-primary" />
                          ) : (
                            <Play size={14} />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" side="left" collisionPadding={16} className="w-[34rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto p-0" onClick={e => e.stopPropagation()}>
                        {(() => {
                          const hostHistory = actionHistoryMap.get(host.uuid) || [];
                          const actionDebug = hostHistory[hostHistory.length - 1];
                          const isRunning = actionDebug && (actionDebug.status === 'sending' || actionDebug.status === 'polling');
                          const finishedHistory = hostHistory.filter(e => e.status === 'success' || e.status === 'error');
                          const isFull = responseActionsMode === 'full';
                          return (
                            <div className="flex flex-col" style={{ maxHeight: 'min(70vh, 32rem)' }}>
                              {/* Header */}
                              <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
                                <Terminal size={12} className="text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate">{host.hostname}</p>
                                  <p className="text-[0.6rem] text-muted-foreground">{responseActionsMode === 'full' ? 'Full control (RCE)' : 'Controlled'}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => navigate(`/monitors/${host.uuid}/terminal`, { state: { hostname: host.hostname, groupName: host.groupName, mode: responseActionsMode || 'controlled' } })}>
                                  <Maximize2 size={10} />
                                </Button>
                                {isRunning && <Loader2 size={12} className="animate-spin text-primary shrink-0" />}
                              </div>
                              {/* Scrollable session log */}
                              <div className="flex-1 overflow-y-auto min-h-0" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
                                {finishedHistory.map((entry, i) => {
                                  const isLatest = i === finishedHistory.length - 1;
                                  return (
                                    <div key={entry.entryId || i} className={`border-b border-border/50 last:border-b-0 ${isLatest ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}>
                                      <div className={`px-3 py-1.5 flex items-center gap-2 ${isLatest ? 'bg-primary/10' : 'bg-muted/20'}`}>
                                        <span className="text-[0.6rem] font-mono text-primary">$</span>
                                        <span className="text-[0.65rem] font-mono font-medium text-foreground flex-1 truncate">{entry.actionName}</span>
                                        {entry.status === 'success' ? (
                                          <CheckCircle2 size={10} className="text-[hsl(var(--severity-low))] shrink-0" />
                                        ) : (
                                          <ShieldX size={10} className="text-destructive shrink-0" />
                                        )}
                                        <span className="text-[0.55rem] text-muted-foreground font-mono shrink-0">
                                          {new Date(entry.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        <span className="text-[0.55rem] text-muted-foreground font-mono shrink-0">
                                          {entry.finishedAt ? `${Math.round((entry.finishedAt - entry.startedAt) / 1000)}s` : ''}
                                        </span>
                                      </div>
                                      {(entry.actionOutput || entry.error) && (
                                        <div className="px-3 py-1.5">
                                          {entry.actionOutput && (
                                            <pre className="text-[0.6rem] font-mono text-foreground/80 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">{entry.actionOutput}</pre>
                                          )}
                                          {entry.error && (
                                            <pre className="text-[0.6rem] font-mono text-destructive whitespace-pre-wrap break-words">{entry.error}</pre>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {isRunning && actionDebug && (
                                  <div className="border-b border-border/50">
                                    <div className="px-3 py-1.5 flex items-center gap-2 bg-muted/20">
                                      <span className="text-[0.6rem] font-mono text-primary">$</span>
                                      <span className="text-[0.65rem] font-mono font-medium text-foreground flex-1 truncate">{actionDebug.actionName}</span>
                                      <Loader2 size={10} className="animate-spin text-primary shrink-0" />
                                    </div>
                                    <div className="px-3 py-1.5 flex items-center justify-between">
                                      <span className="text-[0.6rem] text-muted-foreground">
                                        {actionDebug.status === 'sending' ? 'Sending…' : 'Waiting for result…'}
                                      </span>
                                      <Button variant="ghost" size="sm" className="h-5 px-2 text-[0.6rem] text-destructive hover:text-destructive" onClick={() => abortHostAction(host.uuid)}>
                                        Stop
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* Predefined action chips */}
                              <div className="px-3 py-2 flex flex-wrap gap-1 border-t border-border/50 shrink-0">
                                <button
                                  key="disable_rce"
                                  className="px-2 py-1 text-[0.65rem] rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                                  onClick={() => executeHostAction('disable_rce', 'Disable RCE', host.hostname, host.groupName || '', host.uuid, true)}
                                >
                                  Disable RCE
                                </button>
                                {[
                                  { id: 'isolate_host', name: 'Isolate Host' },
                                  { id: 'disable_user', name: 'Disable User Accounts' },
                                  { id: 'restart_now', name: 'Restart Endpoint' },
                                ].map(s => (
                                  <button key={s.id} disabled title="Not yet available on the endpoint" className="px-2 py-1 text-[0.65rem] rounded-md border border-border text-muted-foreground opacity-50 cursor-not-allowed">
                                    {s.name}
                                  </button>
                                ))}
                              </div>
                              {/* Command input */}
                              <div className="px-3 py-2 border-t border-border shrink-0">
                                <div className="flex gap-1.5 items-center">
                                  <span className="text-[0.65rem] font-mono text-primary shrink-0">$</span>
                                  <Input
                                    placeholder={isFull ? 'Type command…' : 'Custom action…'}
                                    value={customAction}
                                    onChange={e => setCustomAction(e.target.value)}
                                    className="h-7 text-xs flex-1 font-mono"
                                    ref={el => { if (el) requestAnimationFrame(() => el.focus()); }}
                                    onKeyDown={e => {
                                      const hostEntries = actionHistoryMap.get(host.uuid) || [];
                                      const history = [...hostEntries].reverse().map(e => e.actionName).filter(Boolean);
                                      if (e.key === 'Enter' && customAction.trim()) {
                                        setHistoryIndex(-1);
                                        executeHostAction(customAction.trim(), customAction.trim(), host.hostname, host.groupName || '', host.uuid);
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
                                    size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                                    disabled={!customAction.trim()}
                                    onClick={() => {
                                      if (customAction.trim()) {
                                        executeHostAction(customAction.trim(), customAction.trim(), host.hostname, host.groupName || '', host.uuid);
                                        setCustomAction('');
                                      }
                                    }}
                                  >
                                    <Play size={12} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground opacity-40 cursor-not-allowed" disabled>
                            <Play size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p className="text-xs">Response Actions not enabled on this host</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            const hostId = host.uuid || host.hostname;
                            if (!hostId) return;
                            const path = `/monitors/${encodeURIComponent(hostId)}`;
                            if (e.ctrlKey || e.metaKey) window.open(path, '_blank');
                            else navigate(path);
                          }}
                        >
                          <Maximize2 size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-xs">Explore monitor</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              {/* Expanded detail panel — shared with /monitors/:id via HostDetailPanel */}
              {isExpanded && (
                <HostDetailPanel
                  host={host as any}
                  variant="inline"
                  hostUuid={host.uuid}
                  hostname={host.hostname}
                  groupName={host.groupName}
                  mode={responseActionsMode || 'controlled'}
                />
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!pendingDisableRce} onOpenChange={(o) => { if (!o) setPendingDisableRce(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Remote Code Execution?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you 100% sure? This will disable RCE on <span className="font-mono text-foreground">{pendingDisableRce?.hostname}</span>.
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
                if (p) executeHostAction(p.actionId, p.actionName, p.hostname, p.groupName, p.hostUuid, p.isPredefined, true);
              }}
            >
              Yes, disable RCE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MonitorHostTable;
