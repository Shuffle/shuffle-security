import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Laptop, HardDrive, Lock, Package, Zap, Plus, Copy, Check, Activity, ChevronRight, ChevronDown, Radar, FolderOpen, Loader2, CheckCircle2, Send, RefreshCw, ShieldCheck, ShieldX, Cpu, Hash, Clock, Globe, Play, Terminal, Square, Maximize2, AlertTriangle, FileCode } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader, API_CONFIG } from '@/config/api';
import { DEFAULT_AGENT_PERMISSIONS } from '@/hooks/useAgentPermissions';
import { fetchHostSupplements, mergeHosts } from '@/lib/mergeMonitorHosts';
import { HostDetailPanel } from '@/components/monitors/HostDetailPanel';
import { MonitorHostTable } from '@/components/monitors/MonitorHostTable';
import { trackPredefinedEvent, GA_EVENTS } from '@/lib/analytics';

const OsIcon = ({ os, size = 14, className = '' }: { os: string; size?: number; className?: string }) => {
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

const HOST_CHECK_OPTIONS = [
  { id: 'hd_encrypted' as const, label: 'HD Encrypted', description: 'Check if disk encryption is enabled (FileVault, BitLocker, LUKS)', icon: <HardDrive size={16} />, disabled: false },
  { id: 'screenlock' as const, label: 'Screenlock Enabled', description: 'Verify automatic screen lock is configured with max 15 min idle time', icon: <Lock size={16} />, disabled: false },
  { id: 'installed_software' as const, label: 'Installed Software', description: 'Inventory of installed applications and versions', icon: <Package size={16} />, disabled: false },
  { id: 'code_scanner_enabled' as const, label: 'Code Package Scanner', description: 'Scan project directories for language packages and dependencies', icon: <FileCode size={16} />, disabled: false },
  { id: 'response_actions' as const, label: 'Response Actions', description: 'Enable automated response actions on this host', icon: <Zap size={16} />, disabled: false },
  { id: 'log_forwarding' as const, label: 'Active Monitoring', description: 'Active monitoring of host activity (not generally available yet)', icon: <Send size={16} />, disabled: true },
];

// Tiles shown on the default (no hosts yet) overview. HD Encrypted + Screenlock are
// collapsed into a single generic "Compliance Checks" tile so the UI stays extendible
// as more posture checks are added.
const HOST_OVERVIEW_TILES = [
  { id: 'compliance_checks', label: 'Compliance Checks', description: 'Verify disk encryption, screen lock policies, and other posture controls', icon: <ShieldCheck size={16} /> },
  { id: 'installed_software', label: 'Installed Software', description: 'Inventory of installed applications and versions', icon: <Package size={16} /> },
  { id: 'code_scanner_enabled', label: 'Code Package Scanner', description: 'Scan project directories for language packages and dependencies', icon: <FileCode size={16} /> },
  { id: 'response_actions', label: 'Response Actions', description: 'Enable automated response actions on this host', icon: <Zap size={16} /> },
  { id: 'log_forwarding', label: 'Active Monitoring', description: 'Active monitoring of host activity (not generally available yet)', icon: <Send size={16} /> },
];

/** Single source of truth for active monitoring (formerly log forwarding) status */
const isActiveMonitoringEnabled = (host: { log_forwarding?: string }): boolean => !!host.log_forwarding;

const fmtRaw = (value: unknown): string => {
  if (value === undefined) return '(field not set)';
  if (value === null) return 'null';
  if (value === '') return '"" (empty string)';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseResponseActionsState = (value: unknown): { enabled: boolean; mode: 'full' | 'controlled' | null } => {
  const raw = String(value ?? '').toLowerCase().trim();
  const enabled = value !== undefined && value !== null && raw !== '' && raw !== 'false' && raw !== '0' && raw !== 'no' && raw !== 'off';
  return {
    enabled,
    mode: enabled ? (raw.includes('full') ? 'full' : 'controlled') : null,
  };
};

interface CodeScannerProject {
  path: string;
  type: string;
  packages: { name: string; version: string }[];
}

interface SensorHost {
  arch: string;
  automatic_screen_lock_enabled: boolean | string;
  checkin: number;
  elevated_access: boolean;
  hd_encrypted: boolean | string;
  hostname: string;
  installed_software: { name: string; [key: string]: unknown }[];
  code_scanner?: CodeScannerProject[];
  log_forwarding: string;
  os: string;
  sensor_mode: boolean;
  serial: string;
  uuid: string;
  [key: string]: unknown;
}

interface OrbEnvironment {
  Name: string;
  Type: string;
  id: string;
  sensor_group?: boolean;
  sensor_hosts?: SensorHost[];
  archived?: boolean;
  [key: string]: unknown;
}

interface MonitoringGroup {
  id: string;
  name: string;
  queue: string;
  auth: string;
  org_id: string;
  hosts: SensorHost[];
}

/** Fetch environments from the API and supplement hosts from datastore (sensors > assets > env). */
const fetchSensorGroups = async (): Promise<{ groups: MonitoringGroup[]; allEnvs: OrbEnvironment[]; error?: string }> => {
  try {
    const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return { groups: [], allEnvs: [], error: `Failed to load monitors (HTTP ${res.status})` };
    const data = await res.json();
    const envs: OrbEnvironment[] = Array.isArray(data) ? data.filter((e: OrbEnvironment) => !e.archived) : [];

    // Cross-load sensor + asset datastores once for the whole set of groups.
    const supplements = await fetchHostSupplements();
    if (supplements.errors.length) {
      console.warn('[VulnAssets] Host supplement load issues:', supplements.errors);
    }

    const groups = envs
      .filter(e => e.sensor_group === true)
      .map(e => ({
        id: e.id || e.Name,
        name: e.Name,
        queue: e.Name.replace(/ +/g, '-'),
        auth: String(e.auth || ''),
        org_id: String(e.org_id || ''),
        hosts: mergeHosts<SensorHost>(Array.isArray(e.sensor_hosts) ? e.sensor_hosts : [], supplements),
      }));
    return { groups, allEnvs: envs };
  } catch (err) {
    return { groups: [], allEnvs: [], error: `Failed to load monitors — could not reach the API` };
  }
};

/** Create a new sensor group environment by sending ALL environments + the new one */
const createSensorGroupEnv = async (name: string, allEnvs: OrbEnvironment[]): Promise<MonitoringGroup | null> => {
  try {
    const updatedEnvs = [
      ...allEnvs,
      { Name: name, Type: 'onprem', sensor_group: true },
    ];
    const res = await fetch(getApiUrl('/api/v1/setenvironments'), {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(updatedEnvs),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(errText || `HTTP ${res.status}`);
    }
    // Re-fetch to get the created env with its server-assigned id
    const envRes = await fetch(getApiUrl('/api/v1/getenvironments'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (envRes.ok) {
      const freshEnvs: OrbEnvironment[] = await envRes.json();
      const created = freshEnvs.find(e => e.Name === name && e.sensor_group === true);
      if (created) {
        return { id: created.id || name, name: created.Name, queue: created.Name.replace(/ +/g, '-'), auth: String(created.auth || ''), org_id: String(created.org_id || ''), hosts: Array.isArray(created.sensor_hosts) ? created.sensor_hosts : [] };
      }
    }
    return { id: name, name, queue: name.replace(/ +/g, '-'), auth: '', org_id: '', hosts: [] };
  } catch (err) {
    console.error('[VulnAssets] Failed to create sensor group env:', err);
    return null;
  }
};

const VulnAssetsPage = () => {
  usePageMeta({ title: 'Assets — Vulnerabilities', description: 'Monitor host compliance and security posture' });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [addHostOpen, setAddHostOpen] = useState(false);
  const [addHostStep, setAddHostStep] = useState<'checks' | 'deploy'>('checks');
  const [hostPlatform, setHostPlatform] = useState<'linux' | 'macos' | 'windows'>('linux');
  const [winRunAsAdmin, setWinRunAsAdmin] = useState(true);
  const [installMode, setInstallMode] = useState<'easy' | 'custom'>('easy');
  const [hostChecks, setHostChecks] = useState({
    hd_encrypted: true,
    screenlock: true,
    installed_software: true,
    code_scanner_enabled: true,
    response_actions: true,
    log_forwarding: false,
  });
  const [logForwardingEndpoint, setLogForwardingEndpoint] = useState('');
  const [responseActionMode, setResponseActionMode] = useState<'controlled' | 'full'>('full');
  const [copied, setCopied] = useState(false);
  const [sensorDetected, setSensorDetected] = useState(false);
  const [sensorPolling, setSensorPolling] = useState(false);
  const [pollingActivated, setPollingActivated] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // GA funnel guards: ensure DETECTED fires once per dialog session, and that
  // DISMISS only fires when the user closed the dialog without success.
  const detectedFiredRef = useRef(false);
  const dialogOpenRef = useRef(false);

  // Monitoring groups (from API)
  const [groups, setGroups] = useState<MonitoringGroup[]>([]);
  const [allEnvs, setAllEnvs] = useState<OrbEnvironment[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroupLoading, setCreatingGroupLoading] = useState(false);
  const [syncGroupId, setSyncGroupId] = useState<string>('');
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortAsc) setSortAsc(false);
      else { setSortCol(null); setSortAsc(true); }
    } else { setSortCol(col); setSortAsc(true); }
  };
  const sortArrow = (col: string) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : '';
  const [actionExecuting, setActionExecuting] = useState<Set<string>>(new Set()); // host uuids being acted on
  const [pendingDisableRce, setPendingDisableRce] = useState<null | { actionId: string; actionName: string; hostname: string; groupName: string; hostUuid: string; isPredefined: boolean }>(null);
  const [customAction, setCustomAction] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Hydrate actionHistoryMap from localStorage for a single host (called lazily on popover open)
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

  const getCommandHistory = (hostUuid: string): string[] => {
    try {
      const stored = JSON.parse(localStorage.getItem(`terminal_session_${hostUuid}`) || '[]');
      // Fall back to old cmd_history_ key
      if (!Array.isArray(stored) || stored.length === 0) {
        const old = JSON.parse(localStorage.getItem(`cmd_history_${hostUuid}`) || '[]');
        if (Array.isArray(old) && old.length > 0) return old;
        return [];
      }
      const cmds: string[] = [];
      for (let i = stored.length - 1; i >= 0; i--) {
        if (stored[i]?.actionName) cmds.push(stored[i].actionName);
      }
      return cmds;
    } catch { return []; }
  };
  const pushCommandHistory = (_hostUuid: string, _cmd: string) => {
    // No-op: terminal_session_ is saved by HostTerminalPage and VulnAssetsPage action history
  };

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
    /** Parsed output from results[0].result.output */
    actionOutput?: string;
    /** Whether the action result reported success */
    actionSuccess?: boolean;
  };
  const [actionHistoryMap, setActionHistoryMap] = useState<Map<string, ActionDebugEntry[]>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pollingActiveRef = useRef<Map<string, boolean>>(new Map());

  /** Get the latest (current) debug entry for a host */
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
    // Persist immediately so running commands survive refresh
    try {
      const key = `terminal_session_${hostUuid}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const persistEntry = {
        entryId: entry.entryId,
        actionName: entry.actionName,
        status: entry.status,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
        executionId: entry.executionId,
        authorization: entry.authorization,
      };
      stored.push(persistEntry);
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

      // Update the persisted entry in localStorage (was already added on push)
      if (latest.status === 'success' || latest.status === 'error') {
        try {
          const key = `terminal_session_${hostUuid}`;
          const stored = JSON.parse(localStorage.getItem(key) || '[]');
          const idx = stored.findIndex((e: any) => e.entryId === latest.entryId);
          if (idx >= 0) {
            stored[idx] = { ...stored[idx], status: latest.status, finishedAt: latest.finishedAt, executionId: latest.executionId, authorization: latest.authorization };
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

  /** Parse action result from poll data: results[0].result → JSON → output/success/error */
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

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // Get host-actionable permissions from defaults
  const hostActionablePerms = DEFAULT_AGENT_PERMISSIONS
    .flatMap(c => c.permissions)
    .filter(p => p.hostActionable && !p.disabled);

  const executeHostAction = async (actionId: string, actionName: string, hostname: string, groupName: string, hostUuid: string, isPredefined = false, skipConfirm = false) => {
    // Confirm gate for the irreversible disable_rce script
    const normalized = (isPredefined ? `script:${actionId}` : actionId).trim().toLowerCase();
    if (!skipConfirm && normalized === 'script:disable_rce') {
      setPendingDisableRce({ actionId, actionName, hostname, groupName, hostUuid, isPredefined });
      return;
    }
    // Set up abort controller
    const controller = new AbortController();
    abortControllersRef.current.set(hostUuid, controller);
    pollingActiveRef.current.set(hostUuid, true);

    setActionExecuting(prev => new Set(prev).add(hostUuid));
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
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pushHostDebug(hostUuid, {
      entryId,
      hostUuid,
      actionName,
      hostname,
      status: 'sending',
      requestBody,
      startedAt: Date.now(),
    });
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
        updateHostDebug(hostUuid, entryId, { status: 'error', responseStatus: resp.status, responseBody: text, finishedAt: Date.now(), error: text || `HTTP ${resp.status}` });
        toast.error('Action failed', { description: text || `HTTP ${resp.status}` });
        return;
      }

      // Check if response is an execution stub that needs polling
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* not JSON */ }

      if (
        parsed && typeof parsed === 'object' && parsed !== null &&
        typeof (parsed as Record<string, unknown>).execution_id === 'string' &&
        (parsed as Record<string, unknown>).execution_id
      ) {
        const execId = (parsed as Record<string, unknown>).execution_id as string;
        updateHostDebug(hostUuid, entryId, { status: 'polling', responseStatus: resp.status, responseBody: text, executionId: execId, authorization: ((parsed as any).authorization as string) || execId });

        // Poll streams/results for the real output (30 min timeout)
        const maxAttempts = 900; // 900 * 2s = 30 minutes
        const intervalMs = 2000;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (!pollingActiveRef.current.get(hostUuid)) return;
          // Abortable sleep: resolve early if polling is stopped
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, intervalMs);
            controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
          });
          if (!pollingActiveRef.current.get(hostUuid)) return;
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

            // Got a real result — parse results[0].result for output/success/error
            const parsed = parseActionResult(pollData);
            updateHostDebug(hostUuid, entryId, {
              status: parsed.success ? 'success' : 'error',
              responseBody: pollText,
              finishedAt: Date.now(),
              actionOutput: parsed.output || undefined,
              actionSuccess: parsed.success,
              error: parsed.success ? undefined : (parsed.error || parsed.output || 'Action reported failure'),
            });
            if (!parsed.success) {
              toast.error('Action failed', { description: parsed.error || parsed.output || `"${actionName}" → ${hostname}` });
            }
            return;
          } catch {
            if (!pollingActiveRef.current.get(hostUuid)) return;
            continue;
          }
        }
        // Timed out
        if (pollingActiveRef.current.get(hostUuid)) {
          updateHostDebug(hostUuid, entryId, { status: 'error', finishedAt: Date.now(), error: 'Timed out waiting for execution result (30 min).' });
          toast.error('Action timed out', { description: 'No result after 30 minutes.' });
        }
      } else {
        // Immediate result (no execution_id)
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
      loadGroups();
    }
  };

  const abortHostAction = (hostUuid: string) => {
    // Immediately stop polling
    pollingActiveRef.current.set(hostUuid, false);
    // Abort any in-flight fetch
    const controller = abortControllersRef.current.get(hostUuid);
    if (controller) controller.abort();
    abortControllersRef.current.delete(hostUuid);

    // Send server-side abort if we have an execution_id
    const debugEntry = getLatestDebug(hostUuid);
    if (debugEntry?.executionId) {
      fetch(getApiUrl(`/api/v1/workflows/${debugEntry.executionId}/executions/${debugEntry.executionId}/abort`), {
        method: 'GET',
        credentials: 'include',
        headers: { ...getAuthHeader() },
      }).catch(() => { /* best effort */ });
    }

    // Immediately update UI
    if (debugEntry?.entryId) {
      updateHostDebug(hostUuid, debugEntry.entryId, { status: 'error', finishedAt: Date.now(), error: 'Aborted by user' });
    }
    // Don't remove from actionExecuting immediately — keep popover open to show debug info.
  };

  // Aggregate all hosts across all sensor groups. Dedup by composite key:
  // hostname + arch + sensor group. UUID alone is unreliable since the same
  // physical host can appear with different uuids across env/sensor records.
  const allHostsRaw = Array.from(
    groups.flatMap(g => g.hosts.map(h => ({ ...h, groupName: g.name, groupId: g.id })))
      .reduce((map, h) => {
        const hostname = (h.hostname || '').toLowerCase().trim();
        const arch = String((h as any).arch || '').toLowerCase().trim();
        const group = String(h.groupId || '').toLowerCase().trim();
        const key = `${hostname}::${arch}::${group}`;
        if (!map.has(key)) map.set(key, h);
        return map;
      }, new Map<string, any>())
      .values()
  );
  const defaultSort = (a: any, b: any) => {
    // Most recent check-in first, then alphabetical hostname
    const ca = a.checkin || 0, cb = b.checkin || 0;
    if (cb !== ca) return cb - ca;
    return (a.hostname || '').localeCompare(b.hostname || '');
  };
  const allHosts = !sortCol ? [...allHostsRaw].sort(defaultSort) : [...allHostsRaw].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case 'os': cmp = (a.os || '').localeCompare(b.os || ''); break;
      case 'hostname': cmp = (a.hostname || '').localeCompare(b.hostname || ''); break;
      case 'hd': cmp = Number(a.hd_encrypted === true || a.hd_encrypted === 'true') - Number(b.hd_encrypted === true || b.hd_encrypted === 'true'); break;
      case 'screenlock': cmp = Number(a.automatic_screen_lock_enabled === true || a.automatic_screen_lock_enabled === 'true') - Number(b.automatic_screen_lock_enabled === true || b.automatic_screen_lock_enabled === 'true'); break;
      case 'software': cmp = (Array.isArray(a.installed_software) ? a.installed_software.length : 0) - (Array.isArray(b.installed_software) ? b.installed_software.length : 0); break;
      case 'codescan': cmp = (Array.isArray(a.code_scanner) ? a.code_scanner.length : 0) - (Array.isArray(b.code_scanner) ? b.code_scanner.length : 0); break;
      case 'response': cmp = Number(parseResponseActionsState((a as any).response_actions).enabled) - Number(parseResponseActionsState((b as any).response_actions).enabled); break;
      case 'logfwd': cmp = Number(!!a.log_forwarding) - Number(!!b.log_forwarding); break;
      case 'group': cmp = ((a as any).groupName || '').localeCompare((b as any).groupName || ''); break;
      case 'checkin': cmp = (a.checkin || 0) - (b.checkin || 0); break;
    }
    return sortAsc ? cmp : -cmp;
  });


  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    setLoadError(null);
    const { groups: fetched, allEnvs: envs, error } = await fetchSensorGroups();
    if (error) {
      setLoadError(error);
    }
    setGroups(fetched);
    setAllEnvs(envs);
    if (fetched.length > 0) {
      setSelectedGroupId(prev => {
        if (prev && fetched.some(g => g.id === prev)) return prev;
        return fetched[0].id;
      });
      // Auto-select sync group: prefer one with a check-in < 10min
      setSyncGroupId(prev => {
        if (prev && fetched.some(g => g.id === prev)) return prev;
        const now = Date.now() / 1000;
        const recent = fetched.find(g => {
          if (g.hosts.length === 0) return false;
          const latest = Math.max(...g.hosts.map(h => h.checkin || 0));
          return (now - latest) < 600;
        });
        return recent ? recent.id : fetched[0].id;
      });
    }
    setGroupsLoading(false);
  }, []);

  // Load groups on mount
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const getDeployCommand = () => {
    const baseUrl = API_CONFIG.baseUrl;
    const parts: string[] = [];
    parts.push(`base_url=${baseUrl}`);
    parts.push('sensor_mode=true');
    if (selectedGroup) {
      parts.push(`queue=${selectedGroup.queue}`);
      if (selectedGroup.org_id) parts.push(`org_id=${selectedGroup.org_id}`);
    }
    parts.push(`software_list_enabled=${hostChecks.installed_software}`);
    parts.push(`hd_encrypted_check=${hostChecks.hd_encrypted}`);
    parts.push(`screenlock_check=${hostChecks.screenlock}`);
    parts.push(`code_scanner_enabled=${hostChecks.code_scanner_enabled}`);
    parts.push(`response_actions=${hostChecks.response_actions ? responseActionMode : 'false'}`);
    parts.push(`log_forwarding=${hostChecks.log_forwarding && logForwardingEndpoint.trim() ? logForwardingEndpoint.trim() : 'false'}`);

    const authHeader = selectedGroup?.auth ? `-H 'Auth: ${selectedGroup.auth}'` : '';
    const downloadUrl = 'https://shuffler.io/api/v1/orborus';

    if (hostPlatform === 'windows') {
      parts.push('os=windows');
      if (!winRunAsAdmin) parts.push('admin=false');
      const headers = selectedGroup?.auth ? `-H "Auth: ${selectedGroup.auth}"` : '';
      const authHeader = selectedGroup?.auth ? ` -Headers @{'Auth'='${selectedGroup.auth}'}` : '';
      return `powershell -ExecutionPolicy Bypass -Command "& {iex (irm '${downloadUrl}?${parts.join('&')}'${authHeader ? ` -Headers @{'Auth'='${selectedGroup.auth}'}` : ''})}"`.replace(/  +/g, ' ');
    }

    return `curl '${downloadUrl}?${parts.join('&')}' ${authHeader} | sh`.replace(/  +/g, ' ');
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(getDeployCommand());
    setCopied(true);
    activatePolling();
    setTimeout(() => setCopied(false), 2000);
  };

  // Poll for NEW sensor hosts when on deploy step
  const baselineHostCountRef = useRef<number | null>(null);

  const startSensorPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setSensorDetected(false);
    setSensorPolling(true);

    // Capture baseline host count for the selected group at poll start
    const currentGroup = groups.find(g => g.id === selectedGroupId);
    baselineHostCountRef.current = currentGroup ? currentGroup.hosts.length : 0;

    const checkSensor = async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!res.ok) return;
        const envs: OrbEnvironment[] = await res.json();
        const env = envs.find(e => (e.id === selectedGroupId || e.Name === selectedGroup?.name) && e.sensor_group === true);
        if (env) {
          const hosts = Array.isArray(env.sensor_hosts) ? env.sensor_hosts : [];
          const currentHostCount = hosts.length;
          const baseline = baselineHostCountRef.current ?? 0;
          const thirtyMinAgo = Date.now() / 1000 - 30 * 60;

          // Detect new host OR existing host that recently checked in (within 30 min)
          const hasNewHost = currentHostCount > baseline;
          const hasRecentCheckin = hosts.some((h: any) => {
            const lastCheckin = h.last_checkin || h.updated || 0;
            return lastCheckin > thirtyMinAgo;
          });

          if (hasNewHost || hasRecentCheckin) {
            setSensorDetected(true);
            setSensorPolling(false);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            // GA: success — fire DETECTED exactly once per dialog session.
            if (!detectedFiredRef.current) {
              detectedFiredRef.current = true;
              trackPredefinedEvent(
                GA_EVENTS.MONITOR_ADD_HOST_DETECTED,
                selectedGroup?.name,
                hasNewHost ? currentHostCount - baseline : 0,
              );
            }
          }
        }
      } catch { /* continue polling */ }
    };
    // Don't check immediately — wait one interval so the baseline is stable
    pollRef.current = setInterval(checkSensor, 5000);
  }, [selectedGroupId, selectedGroup?.name, groups]);

  const stopSensorPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setSensorPolling(false);
  }, []);

  // Activate polling after user interaction or 30s timeout
  const activatePolling = useCallback(() => {
    if (!pollingActivated) setPollingActivated(true);
  }, [pollingActivated]);

  // Start 30s auto-activation timer when deploy step opens
  useEffect(() => {
    if (addHostStep === 'deploy' && addHostOpen) {
      activationTimerRef.current = setTimeout(() => {
        setPollingActivated(true);
      }, 30000);
    } else {
      if (activationTimerRef.current) { clearTimeout(activationTimerRef.current); activationTimerRef.current = null; }
      setPollingActivated(false);
    }
    return () => {
      if (activationTimerRef.current) { clearTimeout(activationTimerRef.current); activationTimerRef.current = null; }
    };
  }, [addHostStep, addHostOpen]);

  // Start/stop polling based on activation
  useEffect(() => {
    if (pollingActivated && addHostStep === 'deploy' && addHostOpen) {
      startSensorPolling();
    } else if (!pollingActivated) {
      stopSensorPolling();
    }
    return () => stopSensorPolling();
  }, [pollingActivated, addHostStep, addHostOpen, startSensorPolling, stopSensorPolling]);

  const detectPlatform = (): 'linux' | 'macos' | 'windows' => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    return 'linux';
  };

  const handleOpenAddHost = () => {
    setAddHostStep('checks');
    setHostPlatform(detectPlatform());
    setHostChecks({ hd_encrypted: true, screenlock: true, installed_software: true, code_scanner_enabled: true, response_actions: false, log_forwarding: false });
    setLogForwardingEndpoint('');
    setCopied(false);
    setSensorDetected(false);
    setPollingActivated(false);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setAddHostOpen(true);
    // Reset GA funnel guards for a fresh Add-Host session
    detectedFiredRef.current = false;
    dialogOpenRef.current = true;
    trackPredefinedEvent(GA_EVENTS.MONITOR_ADD_HOST_OPEN);
    loadGroups();
  };

  // GA: when the Add Host dialog closes (manually, ESC, click-outside, or page
  // navigation that unmounts this component), fire DISMISS unless the user
  // actually got a sensor detection. Covers both "closed dialog" and
  // "left page before sensor connected" failure paths.
  useEffect(() => {
    if (addHostOpen) {
      dialogOpenRef.current = true;
      return;
    }
    if (dialogOpenRef.current) {
      dialogOpenRef.current = false;
      if (!detectedFiredRef.current) {
        trackPredefinedEvent(
          GA_EVENTS.MONITOR_ADD_HOST_DISMISS,
          addHostStep, // 'checks' | 'deploy' — tells you how far they got
        );
      }
    }
  }, [addHostOpen, addHostStep]);

  // Unmount-time safety net: if the user navigates away with the dialog still
  // open and no detection, count it as a dismissal.
  useEffect(() => {
    return () => {
      if (dialogOpenRef.current && !detectedFiredRef.current) {
        trackPredefinedEvent(GA_EVENTS.MONITOR_ADD_HOST_DISMISS, 'unmount');
      }
    };
  }, []);

  // Auto-open Add Host dialog when ?add_host=true is present in the URL
  useEffect(() => {
    if (searchParams.get('add_host') === 'true' && !addHostOpen) {
      handleOpenAddHost();
      const next = new URLSearchParams(searchParams);
      next.delete('add_host');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroupLoading(true);
    const created = await createSensorGroupEnv(newGroupName.trim(), allEnvs);
    if (created) {
      await loadGroups(); // Re-fetch all to stay in sync
      setSelectedGroupId(created.id);
      setIsCreatingGroup(false);
      setNewGroupName('');
      toast.success('Monitoring group created', { description: `Queue "${created.queue}" is ready.` });
    } else {
      toast.error('Failed to create monitoring group');
    }
    setCreatingGroupLoading(false);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar size={28} className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Monitors</h1>
            <p className="text-sm text-muted-foreground">Monitor host compliance and security posture across your endpoints</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => loadGroups()} disabled={groupsLoading}>
            <RefreshCw size={14} className={groupsLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>

          {/* Monitoring Group Validator Dropdown — only when groups exist */}
          {groups.length > 0 && (() => {
            const syncGroup = groups.find(g => g.id === syncGroupId) || groups[0];
            const latestCheckin = syncGroup.hosts.length > 0
              ? Math.max(...syncGroup.hosts.map(h => h.checkin || 0))
              : 0;
            const checkinAge = latestCheckin ? (Date.now() / 1000) - latestCheckin : Infinity;
            const status = syncGroup.hosts.length === 0
              ? 'none'
              : checkinAge < 300
                ? 'healthy'
                : checkinAge < 1800
                  ? 'stale'
                  : 'offline';
            const dotColor = status === 'healthy'
              ? 'bg-green-500'
              : status === 'stale'
                ? 'bg-yellow-500'
                : status === 'offline'
                  ? 'bg-destructive'
                  : 'bg-muted-foreground/40';
            const timeAgo = latestCheckin
              ? checkinAge < 60
                ? `${Math.round(checkinAge)}s ago`
                : checkinAge < 3600
                  ? `${Math.round(checkinAge / 60)}m ago`
                  : `${Math.round(checkinAge / 3600)}h ago`
              : '';

            return (
              <Select value={syncGroupId} onValueChange={setSyncGroupId}>
                <SelectTrigger className="w-auto min-w-[180px] h-9 gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-xs font-medium truncate max-w-[100px]">{syncGroup.name}</span>
                    {timeAgo && (
                      <span className="text-[0.6rem] text-muted-foreground">{timeAgo}</span>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent align="end">
                  {groups.map(g => {
                    const gLatest = g.hosts.length > 0
                      ? Math.max(...g.hosts.map(h => h.checkin || 0))
                      : 0;
                    const gAge = gLatest ? (Date.now() / 1000) - gLatest : Infinity;
                    const gStatus = g.hosts.length === 0
                      ? 'none'
                      : gAge < 300 ? 'healthy' : gAge < 1800 ? 'stale' : 'offline';
                    const gDot = gStatus === 'healthy'
                      ? 'bg-green-500'
                      : gStatus === 'stale'
                        ? 'bg-yellow-500'
                        : gStatus === 'offline'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground/40';
                    const gLabel = gStatus === 'stale' ? 'Stale' : gStatus === 'offline' ? 'Offline' : gStatus === 'none' ? 'No hosts' : '';
                    const gTime = gLatest
                      ? gAge < 60 ? `${Math.round(gAge)}s` : gAge < 3600 ? `${Math.round(gAge / 60)}m` : `${Math.round(gAge / 3600)}h`
                      : '';
                    return (
                      <SelectItem key={g.id} value={g.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${gDot}`} />
                          <span className="text-sm">{g.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {gLabel}{gTime ? ` · ${gTime}` : ''} · {g.hosts.length} host{g.hosts.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            );
          })()}
        </div>
      </div>

      {/* Host Monitors section */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Laptop size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Host Monitors</h3>
              <p className="text-xs text-muted-foreground">Deploy lightweight monitors on endpoints to check compliance & posture</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpenAddHost}>
              <Plus size={14} />
              Add Host
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {loadError && !groupsLoading && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="text-sm flex-1">{loadError}</span>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => loadGroups()}>
              <RefreshCw size={13} />
              Retry
            </Button>
          </div>
        )}

        {groupsLoading && allHosts.length === 0 && (
          <div className="border-t border-border px-5 py-16 flex flex-col items-center text-center gap-3">
            <Loader2 size={28} className="text-muted-foreground animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Loading monitors…</p>
              <p className="text-xs text-muted-foreground">Fetching monitoring groups, hosts, and supplements.</p>
            </div>
          </div>
        )}

        {!groupsLoading && allHosts.length === 0 && (
          <div className="grid grid-cols-5 gap-0 divide-x divide-border">
            {HOST_OVERVIEW_TILES.map(check => (
              <div key={check.id} className="px-4 py-4 flex flex-col items-center text-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  {check.icon}
                </div>
                <span className="text-xs font-medium text-foreground">{check.label}</span>
                <span className="text-[0.65rem] text-muted-foreground leading-tight">{check.description}</span>
              </div>
            ))}
          </div>
        )}

        {allHosts.length === 0 && !groupsLoading ? (
          <div className="border-t border-border px-5 py-16 flex flex-col items-center text-center gap-4">
            <Activity size={36} className="text-muted-foreground/25" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No hosts monitored yet</p>
              <p className="text-xs text-muted-foreground">Deploy a lightweight monitor on an endpoint to start checking compliance and posture.</p>
            </div>
            <Button size="lg" className="gap-2 mt-2" onClick={handleOpenAddHost}>
              <Plus size={16} />
              Add Host
            </Button>
          </div>
        ) : allHosts.length > 0 ? (
          <MonitorHostTable hosts={allHosts as any} onRefresh={loadGroups} />
        ) : null}
      </div>

      {/* Add Host Monitor Dialog */}
      <Dialog open={addHostOpen} onOpenChange={setAddHostOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Laptop size={18} className="text-primary" />
              Add Host Monitor
            </DialogTitle>
            <DialogDescription>
              Deploy a lightweight monitor on a host to continuously check its security posture.
            </DialogDescription>
          </DialogHeader>

          {addHostStep === 'checks' ? (
            <div className="space-y-5 mt-2">
              {/* Monitoring Group */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <FolderOpen size={13} className="text-muted-foreground" />
                  Monitoring Group
                </Label>
                <p className="text-xs text-muted-foreground">Each monitoring group uses a Runtime Location as the sensor group.</p>
                {!isCreatingGroup ? (
                  <div className="flex gap-2">
                    {groupsLoading ? (
                      <div className="flex-1 flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-muted-foreground">
                        <Loader2 size={13} className="animate-spin" />
                        <span className="text-sm">Loading…</span>
                      </div>
                    ) : groups.length === 0 ? (
                      <div className="flex-1 flex items-center h-9 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground">
                        No groups — create one →
                      </div>
                    ) : (
                      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select a group" />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          {groups.map(g => (
                            <SelectItem key={g.id} value={g.id}>
                              <div className="flex items-center gap-2">
                                <span>{g.name}</span>
                                <span className="text-muted-foreground text-xs">({g.queue})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setIsCreatingGroup(true)} className="shrink-0 gap-1.5">
                      <Plus size={13} />
                      New
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                    <div className="space-y-1">
                      <Label className="text-xs">Group Name</Label>
                      <Input
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        placeholder="e.g. Engineering"
                        className="h-8 text-sm"
                      />
                      <p className="text-[0.65rem] text-muted-foreground">This will create a new Monitoring group with the same name as the queue.</p>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button variant="ghost" size="sm" onClick={() => { setIsCreatingGroup(false); setNewGroupName(''); }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleCreateGroup} disabled={!newGroupName.trim() || creatingGroupLoading}>
                        {creatingGroupLoading && <Loader2 size={13} className="animate-spin mr-1.5" />}
                        Create Group
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Checks */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Checks to Enable</Label>
                <div className="grid grid-cols-2 gap-2">
                  {HOST_CHECK_OPTIONS.map(check => (
                    <div key={check.id}>
                      <label
                        className={`flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors ${check.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}`}
                      >
                        <Checkbox
                          checked={hostChecks[check.id]}
                          disabled={check.disabled}
                          onCheckedChange={(v) => setHostChecks(prev => ({ ...prev, [check.id]: !!v }))}
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-muted-foreground shrink-0">{check.icon}</span>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-foreground block">{check.label}{check.disabled ? ' (Coming soon)' : ''}</span>
                            <span className="text-xs text-muted-foreground">{check.description}</span>
                          </div>
                        </div>
                      </label>
                      {check.id === 'response_actions' && hostChecks.response_actions && (
                        <div className="mt-1.5 mb-1 ml-9 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Control level:</span>
                          <div className="flex gap-1.5">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled
                                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground opacity-40 cursor-not-allowed"
                                  >
                                    Controlled
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom"><p className="text-xs">Coming soon — Predefined files are downloaded and executed</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${responseActionMode === 'full' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                                    onClick={() => setResponseActionMode('full')}
                                  >
                                    Full Control
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom"><p className="text-xs">Full remote command execution (RCE)</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      )}
                      {check.id === 'log_forwarding' && hostChecks.log_forwarding && (
                        <div className="ml-9 mt-1.5 mb-1">
                          <Input
                            value={logForwardingEndpoint}
                            onChange={e => setLogForwardingEndpoint(e.target.value)}
                            placeholder="e.g. https://siem.example.com:514"
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 mt-2">
              {/* Group summary */}
              {selectedGroup && (
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-muted/30">
                  <FolderOpen size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground font-medium">{selectedGroup.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">queue: {selectedGroup.queue}</span>
                </div>
              )}

              {/* Install mode toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Install Method</Label>
                <div className="flex gap-2">
                  {([
                    { value: 'easy' as const, label: 'Easy Install' },
                    { value: 'custom' as const, label: 'Custom Install' },
                  ]).map(m => (
                    <Button
                      key={m.value}
                      variant="outline"
                      size="sm"
                      className={`flex-1 ${installMode === m.value ? 'border-primary text-primary' : ''}`}
                      onClick={() => setInstallMode(m.value)}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Platform */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Platform</Label>
                <div className="flex gap-2">
                  {([
                    { value: 'linux' as const, label: 'Linux' },
                    { value: 'macos' as const, label: 'macOS' },
                    { value: 'windows' as const, label: 'Windows' },
                  ]).map(p => (
                    <Button
                      key={p.value}
                      variant="outline"
                      size="sm"
                      className={`flex-1 ${hostPlatform === p.value ? 'border-primary text-primary' : ''}`}
                      onClick={() => setHostPlatform(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
              </div>

              {/* Run as Admin toggle – Windows only */}
              {hostPlatform === 'windows' && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Run as Administrator</Label>
                  <Switch checked={winRunAsAdmin} onCheckedChange={setWinRunAsAdmin} />
                </div>
              )}
              </div>

              {installMode === 'easy' ? (
                <>
                  {/* Easy: one-liner */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Run this on the monitoring targets{hostPlatform === 'windows' ? ' (cmd/powershell)' : ''}</Label>
                    <div className="relative">
                      <pre className="text-xs bg-muted rounded-lg p-4 pr-12 border border-border overflow-x-auto font-mono text-foreground whitespace-pre-wrap break-all leading-relaxed max-h-40">
                        {getDeployCommand()}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={handleCopyCommand}
                      >
                        {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Downloads, configures, and starts the monitor automatically.</p>
                  </div>
                </>
              ) : (
                <>
                  {/* Custom: binary download + env command */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">1. Download the binary</Label>
                    <p className="text-xs text-muted-foreground">
                      Get the latest release from{' '}
                      <a href="https://github.com/Shuffle/orborus/releases" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        github.com/Shuffle/orborus/releases
                      </a>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">2. Run the monitor</Label>
                    <div className="relative">
                      <pre className="text-xs bg-muted rounded-lg p-4 pr-12 border border-border font-mono text-foreground whitespace-pre-wrap break-all leading-relaxed">
{(() => {
  const flags: string[] = [];
  flags.push(`--base_url=${API_CONFIG.baseUrl}`);
  flags.push('--sensor_mode=true');
  if (selectedGroup) {
    flags.push(`--queue=${selectedGroup.queue}`);
    if (selectedGroup.org_id) flags.push(`--org_id=${selectedGroup.org_id}`);
    if (selectedGroup.auth) flags.push(`--auth=${selectedGroup.auth}`);
  }
  flags.push(`--software_list_enabled=${hostChecks.installed_software}`);
  flags.push(`--hd_encrypted_check=${hostChecks.hd_encrypted}`);
  flags.push(`--screenlock_check=${hostChecks.screenlock}`);
  flags.push(`--code_scanner_enabled=${hostChecks.code_scanner_enabled}`);
  if (hostChecks.response_actions) flags.push(`--response_actions=${responseActionMode}`);
  if (hostChecks.log_forwarding && logForwardingEndpoint.trim()) flags.push(`--log_forwarding=${logForwardingEndpoint.trim()}`);
  const bin = hostPlatform === 'windows' ? '.\\orborus.exe' : './orborus';
  return `${bin} ${flags.join(' ')}`;
})()}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={() => {
                          const flags: string[] = [];
                          flags.push(`--base_url=${API_CONFIG.baseUrl}`);
                          flags.push('--sensor_mode=true');
                          if (selectedGroup) {
                            flags.push(`--queue=${selectedGroup.queue}`);
                            if (selectedGroup.org_id) flags.push(`--org_id=${selectedGroup.org_id}`);
                            if (selectedGroup.auth) flags.push(`--auth=${selectedGroup.auth}`);
                          }
                          flags.push(`--software_list_enabled=${hostChecks.installed_software}`);
                          flags.push(`--hd_encrypted_check=${hostChecks.hd_encrypted}`);
                          flags.push(`--screenlock_check=${hostChecks.screenlock}`);
                          flags.push(`--code_scanner_enabled=${hostChecks.code_scanner_enabled}`);
                          if (hostChecks.response_actions) flags.push(`--response_actions=${responseActionMode}`);
                          if (hostChecks.log_forwarding && logForwardingEndpoint.trim()) flags.push(`--log_forwarding=${logForwardingEndpoint.trim()}`);
                          const bin = hostPlatform === 'windows' ? '.\\orborus.exe' : './orborus';
                          navigator.clipboard.writeText(`${bin} ${flags.join(' ')}`);
                          setCopied(true);
                          activatePolling();
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">3. Run as a background service</Label>
                    <p className="text-xs text-muted-foreground">
                      To keep the monitor running persistently, set up the command above as a service.{' '}
                      {hostPlatform === 'linux' ? (
                        <a href="https://www.freedesktop.org/software/systemd/man/systemd.service.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          systemd docs →
                        </a>
                      ) : hostPlatform === 'macos' ? (
                        <a href="https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          launchd docs →
                        </a>
                      ) : (
                        <a href="https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Task Scheduler docs →
                        </a>
                      )}
                    </p>
                  </div>
                </>
              )}

              {/* Sensor detection status */}
              {(pollingActivated || sensorDetected) && (
                <div className={`rounded-lg border px-3 py-3 flex items-center gap-3 ${sensorDetected ? 'border-[hsl(var(--severity-low))]/30 bg-[hsl(var(--severity-low))]/[0.06]' : 'border-border bg-muted/30'}`}>
                  {sensorDetected ? (
                    <>
                      <CheckCircle2 size={18} className="text-[hsl(var(--severity-low))] shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Sensor detected!</p>
                        <p className="text-xs text-muted-foreground">A host has checked in and is reporting results to this monitoring group.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Loader2 size={18} className="animate-spin text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Waiting for sensor…</p>
                        <p className="text-xs text-muted-foreground">Run the command on your target host. Once connected, it will run the selected checks and report results back automatically.</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-2">
            {addHostStep === 'checks' ? (
              <Button
                size="sm"
                onClick={() => {
                  trackPredefinedEvent(GA_EVENTS.MONITOR_ADD_HOST_DEPLOY, hostPlatform);
                  setAddHostStep('deploy');
                }}
                disabled={Object.values(hostChecks).every(v => !v) || !selectedGroupId}
              >
                Next: Deploy
                <ChevronRight size={14} className="ml-1" />
              </Button>
            ) : (
              <div className="flex gap-2 w-full justify-between">
                <Button variant="outline" size="sm" onClick={() => setAddHostStep('checks')}>
                  Back
                </Button>
                {sensorDetected && (
                  <Button size="sm" onClick={() => { setAddHostOpen(false); toast.success('Host monitor connected', { description: `Sensor active in group "${selectedGroup?.name}".` }); }}>
                    Done
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
    </div>
  );
};

export default VulnAssetsPage;
