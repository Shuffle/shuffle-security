import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Laptop, HardDrive, Lock, Package, Zap, Plus, Copy, Check, Activity, ChevronRight, ChevronDown, Radar, FolderOpen, Loader2, CheckCircle2, Send, RefreshCw, ShieldCheck, ShieldX, Cpu, Hash, Clock, Globe, Play, Terminal, Square } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader, API_CONFIG } from '@/config/api';
import { DEFAULT_AGENT_PERMISSIONS } from '@/hooks/useAgentPermissions';

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
  { id: 'response_actions' as const, label: 'Response Actions', description: 'Enable automated response actions on this host', icon: <Zap size={16} />, disabled: false },
  { id: 'log_forwarding' as const, label: 'Log Forwarding', description: 'Forward host logs to a remote endpoint for centralized collection', icon: <Send size={16} />, disabled: true },
];

interface SensorHost {
  arch: string;
  automatic_screen_lock_enabled: boolean | string;
  checkin: number;
  elevated_access: boolean;
  hd_encrypted: boolean | string;
  hostname: string;
  installed_software: { name: string; [key: string]: unknown }[];
  log_forwarding: string;
  os: string;
  sensor_mode: boolean;
  serial: string;
  uuid: string;
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

/** Fetch environments from the API and filter for sensor_group: true */
const fetchSensorGroups = async (): Promise<{ groups: MonitoringGroup[]; allEnvs: OrbEnvironment[] }> => {
  try {
    const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return { groups: [], allEnvs: [] };
    const data = await res.json();
    const envs: OrbEnvironment[] = Array.isArray(data) ? data.filter((e: OrbEnvironment) => !e.archived) : [];
    const groups = envs
      .filter(e => e.sensor_group === true)
      .map(e => ({ id: e.id || e.Name, name: e.Name, queue: e.Name, auth: String(e.auth || ''), org_id: String(e.org_id || ''), hosts: Array.isArray(e.sensor_hosts) ? e.sensor_hosts : [] }));
    return { groups, allEnvs: envs };
  } catch {
    return { groups: [], allEnvs: [] };
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
        return { id: created.id || name, name: created.Name, queue: created.Name, auth: String(created.auth || ''), org_id: String(created.org_id || ''), hosts: Array.isArray(created.sensor_hosts) ? created.sensor_hosts : [] };
      }
    }
    return { id: name, name, queue: name, auth: '', org_id: '', hosts: [] };
  } catch (err) {
    console.error('[VulnAssets] Failed to create sensor group env:', err);
    return null;
  }
};

const VulnAssetsPage = () => {
  usePageMeta({ title: 'Assets — Vulnerabilities', description: 'Monitor host compliance and security posture' });

  const [addHostOpen, setAddHostOpen] = useState(false);
  const [addHostStep, setAddHostStep] = useState<'checks' | 'deploy'>('checks');
  const [hostPlatform, setHostPlatform] = useState<'linux' | 'macos' | 'windows'>('linux');
  const [hostChecks, setHostChecks] = useState({
    hd_encrypted: true,
    screenlock: true,
    installed_software: true,
    response_actions: true,
    log_forwarding: false,
  });
  const [logForwardingEndpoint, setLogForwardingEndpoint] = useState('');
  const [responseActionMode, setResponseActionMode] = useState<'controlled' | 'full'>('full');
  const [copied, setCopied] = useState(false);
  const [sensorDetected, setSensorDetected] = useState(false);
  const [sensorPolling, setSensorPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monitoring groups (from API)
  const [groups, setGroups] = useState<MonitoringGroup[]>([]);
  const [allEnvs, setAllEnvs] = useState<OrbEnvironment[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroupLoading, setCreatingGroupLoading] = useState(false);
  const [syncGroupId, setSyncGroupId] = useState<string>('');
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [osSortAsc, setOsSortAsc] = useState<boolean | null>(null);
  const [actionExecuting, setActionExecuting] = useState<Set<string>>(new Set()); // host uuids being acted on
  const [customAction, setCustomAction] = useState('');

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
    /** Parsed output from results[0].result.output */
    actionOutput?: string;
    /** Whether the action result reported success */
    actionSuccess?: boolean;
  };
  const [actionDebugMap, setActionDebugMap] = useState<Map<string, ActionDebugEntry>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pollingActiveRef = useRef<Map<string, boolean>>(new Map());

  const setHostDebug = (hostUuid: string, entry: ActionDebugEntry | null) => {
    setActionDebugMap(prev => {
      const next = new Map(prev);
      if (entry) next.set(hostUuid, entry);
      else next.delete(hostUuid);
      return next;
    });
  };
  const updateHostDebug = (hostUuid: string, update: Partial<ActionDebugEntry>) => {
    setActionDebugMap(prev => {
      const existing = prev.get(hostUuid);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(hostUuid, { ...existing, ...update });
      return next;
    });
  };
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // Get host-actionable permissions from defaults
  const hostActionablePerms = DEFAULT_AGENT_PERMISSIONS
    .flatMap(c => c.permissions)
    .filter(p => p.hostActionable && !p.disabled);

  const executeHostAction = async (actionId: string, actionName: string, hostname: string, groupName: string, hostUuid: string, isPredefined = false) => {
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
    setHostDebug(hostUuid, {
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
        updateHostDebug(hostUuid, { status: 'error', responseStatus: resp.status, responseBody: text, finishedAt: Date.now(), error: text || `HTTP ${resp.status}` });
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
        updateHostDebug(hostUuid, { status: 'polling', responseStatus: resp.status, responseBody: text, executionId: execId });

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
                updateHostDebug(hostUuid, { status: 'error', responseBody: `Poll error ${pollResp.status}`, finishedAt: Date.now(), error: `HTTP ${pollResp.status}` });
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
            updateHostDebug(hostUuid, {
              status: parsed.success ? 'success' : 'error',
              responseBody: pollText,
              finishedAt: Date.now(),
              actionOutput: parsed.output || undefined,
              actionSuccess: parsed.success,
              error: parsed.success ? undefined : (parsed.error || parsed.output || 'Action reported failure'),
            });
            if (parsed.success) {
              toast.success('Action completed', { description: parsed.output || `"${actionName}" → ${hostname}` });
            } else {
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
          updateHostDebug(hostUuid, { status: 'error', finishedAt: Date.now(), error: 'Timed out waiting for execution result (30 min).' });
          toast.error('Action timed out', { description: 'No result after 30 minutes.' });
        }
      } else {
        // Immediate result (no execution_id)
        updateHostDebug(hostUuid, { status: 'success', responseStatus: resp.status, responseBody: text, finishedAt: Date.now() });
        toast.success('Action sent', { description: `"${actionName}" → ${hostname}` });
      }
    } catch (err) {
      if (!pollingActiveRef.current.get(hostUuid)) return;
      const msg = err instanceof Error ? err.message : 'Request error';
      updateHostDebug(hostUuid, { status: 'error', finishedAt: Date.now(), error: msg });
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
    const debugEntry = actionDebugMap.get(hostUuid);
    if (debugEntry?.executionId) {
      fetch(getApiUrl(`/api/v1/workflows/${debugEntry.executionId}/executions/${debugEntry.executionId}/abort`), {
        method: 'GET',
        credentials: 'include',
        headers: { ...getAuthHeader() },
      }).catch(() => { /* best effort */ });
    }

    // Immediately update UI
    updateHostDebug(hostUuid, { status: 'error', finishedAt: Date.now(), error: 'Aborted by user' });
    // Don't remove from actionExecuting immediately — keep popover open to show debug info.
  };

  // Aggregate all hosts across all sensor groups
  const allHostsRaw = groups.flatMap(g => g.hosts.map(h => ({ ...h, groupName: g.name, groupId: g.id })));
  const allHosts = osSortAsc === null ? allHostsRaw : [...allHostsRaw].sort((a, b) => {
    const cmp = (a.os || '').localeCompare(b.os || '');
    return osSortAsc ? cmp : -cmp;
  });

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    const { groups: fetched, allEnvs: envs } = await fetchSensorGroups();
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
    const flags = ['--sensor_mode=true'];
    flags.push(`--base_url=${API_CONFIG.baseUrl}`);
    if (selectedGroup) {
      flags.push(`--queue=${selectedGroup.queue}`);
      if (selectedGroup.auth) flags.push(`--auth=${selectedGroup.auth}`);
      
      if (selectedGroup.org_id) flags.push(`--org_id=${selectedGroup.org_id}`);
    }
    if (hostChecks.installed_software) flags.push('--software_list_enabled=true');
    if (hostChecks.hd_encrypted) flags.push('--hd_encrypted_check=true');
    if (hostChecks.screenlock) flags.push('--screenlock_check=true');
    if (hostChecks.response_actions) flags.push(`--response_actions=${responseActionMode}`);
    if (hostChecks.log_forwarding && logForwardingEndpoint.trim()) flags.push(`--log_forwarding=${logForwardingEndpoint.trim()}`);
    return `go run orborus.go ${flags.join(' ')}`;
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(getDeployCommand());
    setCopied(true);
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
          const currentHostCount = Array.isArray(env.sensor_hosts) ? env.sensor_hosts.length : 0;
          const baseline = baselineHostCountRef.current ?? 0;
          if (currentHostCount > baseline) {
            setSensorDetected(true);
            setSensorPolling(false);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
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

  // Start/stop polling based on step
  useEffect(() => {
    if (addHostStep === 'deploy' && addHostOpen) {
      startSensorPolling();
    } else {
      stopSensorPolling();
    }
    return () => stopSensorPolling();
  }, [addHostStep, addHostOpen, startSensorPolling, stopSensorPolling]);

  const handleOpenAddHost = () => {
    setAddHostStep('checks');
    setHostPlatform('linux');
    setHostChecks({ hd_encrypted: true, screenlock: true, installed_software: true, response_actions: false, log_forwarding: false });
    setLogForwardingEndpoint('');
    setCopied(false);
    setSensorDetected(false);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setAddHostOpen(true);
    loadGroups();
  };

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

        {/* Checks overview - only show when no hosts monitored */}
        {allHosts.length === 0 && (
          <div className="grid grid-cols-5 gap-0 divide-x divide-border">
            {HOST_CHECK_OPTIONS.map(check => (
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

        {allHosts.length === 0 ? (
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
        ) : (
          <div className="border-t border-border">
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1.5fr_2rem_2rem_2rem_2rem_2rem_0.7fr_0.8fr_auto] gap-2 px-5 py-2 border-b border-border bg-muted/30 items-center">
              <TooltipProvider delayDuration={200}>
                <Tooltip><TooltipTrigger asChild>
                  <span className="text-xs font-semibold text-muted-foreground cursor-pointer select-none flex items-center gap-1" onClick={() => setOsSortAsc(prev => prev === null ? true : prev ? false : null)} title="Sort by OS">
                    OS {osSortAsc === true ? '↑' : osSortAsc === false ? '↓' : ''}
                  </span>
                </TooltipTrigger><TooltipContent>Operating System</TooltipContent></Tooltip>
              </TooltipProvider>
              <span className="text-xs font-semibold text-muted-foreground">Hostname</span>
              <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><HardDrive size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">HD Encrypted</p><p className="text-[0.65rem] text-muted-foreground">Check if disk encryption is enabled (FileVault, BitLocker, LUKS)</p></TooltipContent></Tooltip></TooltipProvider>
              <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><Lock size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Screenlock Enabled</p><p className="text-[0.65rem] text-muted-foreground">Verify automatic screen lock is configured with max 15 min idle time</p></TooltipContent></Tooltip></TooltipProvider>
              <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><Package size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Installed Software</p><p className="text-[0.65rem] text-muted-foreground">Inventory of installed applications and versions</p></TooltipContent></Tooltip></TooltipProvider>
              <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><Zap size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Response Actions</p><p className="text-[0.65rem] text-muted-foreground">Enable automated response actions on this host</p></TooltipContent></Tooltip></TooltipProvider>
              <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><Send size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[200px]"><p className="font-semibold text-xs">Log Forwarding</p><p className="text-[0.65rem] text-muted-foreground">Forward host logs to a remote endpoint for centralized collection</p></TooltipContent></Tooltip></TooltipProvider>
              <span className="text-xs font-semibold text-muted-foreground">Group</span>
              <span className="text-xs font-semibold text-muted-foreground">Last Check-in</span>
              <span className="text-xs font-semibold text-muted-foreground">Actions</span>
            </div>
            {/* Host rows */}
            {allHosts.map(host => {
              const checkinDate = host.checkin ? new Date(host.checkin * 1000) : null;
              const isRecent = checkinDate ? (Date.now() - checkinDate.getTime()) < 5 * 60 * 1000 : false;
              const hdEncrypted = host.hd_encrypted === true || host.hd_encrypted === 'true';
              const screenlockOn = host.automatic_screen_lock_enabled === true || host.automatic_screen_lock_enabled === 'true';
              const softwareCount = Array.isArray(host.installed_software) ? host.installed_software.length : 0;
              const responseActionsOn = !!(host as any).response_actions;
              const logForwardingOn = !!host.log_forwarding;
              const isExpanded = expandedHosts.has(host.uuid);
              const toggleExpanded = () => {
                setExpandedHosts(prev => {
                  const next = new Set(prev);
                  if (next.has(host.uuid)) next.delete(host.uuid);
                  else next.add(host.uuid);
                  return next;
                });
              };
              const CheckDot = ({ on, tip }: { on: boolean; tip: string }) => (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex justify-center">
                        <div className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{tip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
              return (
                <div key={host.uuid}>
                  <div
                    className="grid grid-cols-[2rem_1.5fr_2rem_2rem_2rem_2rem_2rem_0.7fr_0.8fr_auto] gap-2 px-5 py-3 border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors items-center cursor-pointer"
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
                      {host.serial && (() => {
                        const raw = host.serial.trim();
                        const snMatch = raw.match(/Serial\s*Number\s*\(?\w*\)?\s*:\s*(\S+)/i);
                        const display = snMatch ? snMatch[1] : raw.split('\n')[0].trim().substring(0, 24);
                        return (
                          <span
                            className="text-[0.65rem] text-muted-foreground/70 font-mono truncate ml-[30px] cursor-help"
                            title={raw}
                          >
                            SN: {display}
                          </span>
                        );
                      })()}
                    </div>
                    <CheckDot on={hdEncrypted} tip={hdEncrypted ? 'Disk encryption enabled' : 'Disk encryption not enabled'} />
                    <CheckDot on={screenlockOn} tip={screenlockOn ? 'Screenlock enabled' : 'Screenlock not enabled'} />
                    <CheckDot on={softwareCount > 0} tip={softwareCount > 0 ? `${softwareCount} packages installed` : 'Software not collected'} />
                    <CheckDot on={responseActionsOn} tip={responseActionsOn ? 'Response actions enabled' : 'Response actions not enabled'} />
                    <CheckDot on={logForwardingOn} tip={logForwardingOn ? `Log forwarding: ${host.log_forwarding}` : 'Log forwarding not enabled'} />
                    <span className="text-xs text-muted-foreground truncate">{host.groupName}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRecent ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                      <span className="text-xs text-muted-foreground">
                        {checkinDate ? checkinDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                    {/* Actions popover */}
                    <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
                      {responseActionsOn ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                            {actionExecuting.has(host.uuid) ? (
                              <Loader2 size={14} className="animate-spin text-primary" />
                            ) : (
                              <Play size={14} />
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 p-0" onClick={e => e.stopPropagation()}>
                          {/* Debug info if action running/completed for this host */}
                          {(() => { const actionDebug = actionDebugMap.get(host.uuid); return actionDebug ? (
                            <div>
                              <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                                {(actionDebug.status === 'sending' || actionDebug.status === 'polling') && <Loader2 size={12} className="animate-spin text-primary" />}
                                {actionDebug.status === 'success' && <CheckCircle2 size={12} className="text-[hsl(var(--severity-low))]" />}
                                {actionDebug.status === 'error' && <ShieldX size={12} className="text-destructive" />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate">{actionDebug.actionName}</p>
                                  <p className="text-[0.6rem] text-muted-foreground truncate">{actionDebug.hostname}</p>
                                </div>
                                {actionDebug.finishedAt && (
                                  <span className="text-[0.6rem] text-muted-foreground font-mono shrink-0">
                                    {Math.round((actionDebug.finishedAt - actionDebug.startedAt) / 1000)}s
                                  </span>
                                )}
                              </div>
                              <div className="px-3 py-2 space-y-2">
                                <p className={`text-xs font-medium ${
                                  (actionDebug.status === 'sending' || actionDebug.status === 'polling') ? 'text-primary' :
                                  actionDebug.status === 'success' ? 'text-[hsl(var(--severity-low))]' : 'text-destructive'
                                }`}>
                                  {actionDebug.status === 'sending' ? 'Sending request…' :
                                   actionDebug.status === 'polling' ? 'Polling for result…' :
                                   actionDebug.status === 'success' ? 'Completed successfully' :
                                   'Failed'}
                                </p>
                                {/* Show parsed action output on success */}
                                {actionDebug.status === 'success' && actionDebug.actionOutput && (
                                  <div className="rounded border border-border bg-muted/40 px-2 py-1.5">
                                    <pre className="text-[0.65rem] font-mono text-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{actionDebug.actionOutput}</pre>
                                  </div>
                                )}
                                {/* Stop button while in progress */}
                                {(actionDebug.status === 'sending' || actionDebug.status === 'polling') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
                                    onClick={() => abortHostAction(host.uuid)}
                                  >
                                    <Square size={10} className="fill-current" />
                                    Stop
                                  </Button>
                                )}
                                {/* Show debug details only on error */}
                                {actionDebug.status === 'error' && (
                                  <>
                                    {actionDebug.error && (
                                      <div className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5">
                                        <span className="text-[0.65rem] text-destructive font-medium">{actionDebug.error}</span>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wide">Request</span>
                                      <pre className="text-[0.6rem] font-mono text-foreground bg-muted/40 rounded p-1.5 mt-0.5 overflow-x-auto max-h-24 whitespace-pre-wrap">
                                        {JSON.stringify(actionDebug.requestBody, null, 2)}
                                      </pre>
                                    </div>
                                    {actionDebug.responseBody !== undefined && (
                                      <div>
                                        <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wide">Response</span>
                                        <pre className="text-[0.6rem] font-mono text-foreground bg-muted/40 rounded p-1.5 mt-0.5 overflow-x-auto max-h-24 whitespace-pre-wrap">
                                          {actionDebug.responseBody || '(empty)'}
                                        </pre>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              {(actionDebug.status === 'success' || actionDebug.status === 'error') && (
                                <div className="px-3 py-2 border-t border-border">
                                  <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setHostDebug(host.uuid, null); setActionExecuting(prev => { const next = new Set(prev); next.delete(host.uuid); return next; }); }}>
                                    Run another action
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="px-3 py-2 border-b border-border">
                                <p className="text-xs font-semibold text-foreground">Run Action</p>
                                <p className="text-[0.65rem] text-muted-foreground truncate">{host.hostname}</p>
                              </div>
                              <div className="py-1">
                                {hostActionablePerms.map(perm => (
                                  <button
                                    key={perm.id}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    disabled={actionExecuting.has(host.uuid)}
                                    onClick={() => executeHostAction(perm.id, perm.name, host.hostname, host.groupName, host.uuid, true)}
                                  >
                                    <Zap size={12} className="text-muted-foreground shrink-0" />
                                    <span className="text-foreground font-medium">{perm.name}</span>
                                  </button>
                                ))}
                              </div>
                              <div className="px-3 py-2 border-t border-border">
                                <div className="flex gap-1.5">
                                  <Input
                                    placeholder="Custom action…"
                                    value={customAction}
                                    onChange={e => setCustomAction(e.target.value)}
                                    className="h-7 text-xs flex-1"
                                    disabled={actionExecuting.has(host.uuid)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && customAction.trim()) {
                                        executeHostAction(customAction.trim(), customAction.trim(), host.hostname, host.groupName, host.uuid);
                                        setCustomAction('');
                                      }
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    disabled={!customAction.trim() || actionExecuting.has(host.uuid)}
                                    onClick={() => {
                                      if (customAction.trim()) {
                                        executeHostAction(customAction.trim(), customAction.trim(), host.hostname, host.groupName, host.uuid);
                                        setCustomAction('');
                                      }
                                    }}
                                  >
                                    <Terminal size={12} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ); })()}
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
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="border-b border-border bg-muted/10 px-5 py-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Hash size={12} />
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Serial Number</span>
                          </div>
                          {host.serial ? (() => {
                            const raw = host.serial.trim();
                            const snMatch = raw.match(/Serial\s*Number\s*\(?\w*\)?\s*:\s*(\S+)/i);
                            const display = snMatch ? snMatch[1] : raw.split('\n')[0].trim().substring(0, 24);
                            return (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="text-xs font-mono text-foreground cursor-help">{display}</p>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" align="start" className="max-w-sm">
                                    <pre className="text-[0.65rem] font-mono whitespace-pre-wrap">{raw}</pre>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })() : <p className="text-xs font-mono text-foreground">—</p>}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Cpu size={12} />
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Architecture</span>
                          </div>
                          <p className="text-xs text-foreground">{host.os || '—'} / {host.arch || '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock size={12} />
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Last Check-in</span>
                          </div>
                          <p className="text-xs text-foreground">
                            {checkinDate ? checkinDate.toLocaleString() : '—'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Send size={12} />
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Log Forwarding</span>
                          </div>
                          {(() => {
                            const lf = host.log_forwarding || '';
                            if (!lf) return <p className="text-xs text-muted-foreground">Not enabled</p>;
                            return (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="text-xs text-foreground cursor-help truncate">Enabled</p>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" align="start" className="max-w-sm">
                                    <pre className="text-[0.65rem] font-mono whitespace-pre-wrap">{lf}</pre>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Zap size={12} />
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Response Actions</span>
                          </div>
                          <p className={`text-xs ${(host as any).response_actions ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {(host as any).response_actions ? `Enabled (${(host as any).response_actions})` : 'Not enabled'}
                          </p>
                        </div>
                      </div>

                      {/* Compliance summary */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${hdEncrypted ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400' : 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400'}`}>
                          {hdEncrypted ? <ShieldCheck size={13} /> : <ShieldX size={13} />}
                          Disk Encryption: {hdEncrypted ? 'Enabled' : 'Disabled'}
                        </div>
                        <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${screenlockOn ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400' : 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400'}`}>
                          <Lock size={13} />
                          Screen Lock: {screenlockOn ? 'Enabled' : 'Disabled'}
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                          <Zap size={13} />
                          Elevated Access: {host.elevated_access ? 'Yes' : 'No'}
                        </div>
                        {host.log_forwarding && (
                          <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                            <Send size={13} />
                            Log Forwarding: {host.log_forwarding}
                          </div>
                        )}
                      </div>

                      {/* Installed Software */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-muted-foreground" />
                          <span className="text-xs font-semibold text-foreground">Installed Software</span>
                          {softwareCount > 0 && (
                            <span className="text-[0.65rem] text-muted-foreground">({softwareCount} packages)</span>
                          )}
                        </div>
                        {softwareCount === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No software inventory collected for this host.</p>
                        ) : (
                          <div className="rounded-md border border-border overflow-hidden max-h-[240px] overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/40 sticky top-0">
                                <tr>
                                  <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Name</th>
                                  <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Version</th>
                                  <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Source</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {host.installed_software.filter((sw) => !sw.version || String(sw.version).length <= 100).map((sw, idx) => (
                                  <tr key={idx} className="hover:bg-muted/20">
                                    <td className="px-3 py-1.5 font-medium text-foreground">{sw.name || '—'}</td>
                                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{(sw.version as string) || '—'}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{(sw.source as string) || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Host Monitor Dialog */}
      <Dialog open={addHostOpen} onOpenChange={setAddHostOpen}>
        <DialogContent className="max-w-lg">
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
                <div className="space-y-2">
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
                        <div className="ml-9 mt-1.5 mb-1 space-y-1.5">
                          <span className="text-xs text-muted-foreground">Control level</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled
                              className="flex-1 rounded-md border border-border px-3 py-2 text-left opacity-50 cursor-not-allowed"
                            >
                              <span className="text-sm font-medium text-foreground block">Controlled <span className="text-[0.6rem] text-muted-foreground font-normal">(Coming soon)</span></span>
                              <span className="text-[0.65rem] text-muted-foreground">Predefined files are downloaded and executed</span>
                            </button>
                            <button
                              type="button"
                              className={`flex-1 rounded-md border px-3 py-2 text-left transition-colors ${responseActionMode === 'full' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                              onClick={() => setResponseActionMode('full')}
                            >
                              <span className="text-sm font-medium text-foreground block">Full Control</span>
                              <span className="text-[0.65rem] text-muted-foreground">Full remote command execution (RCE)</span>
                            </button>
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
                      variant={hostPlatform === p.value ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setHostPlatform(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Deploy command */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Run this on the target host</Label>
                <div className="relative">
                  <pre className="text-xs bg-muted rounded-lg p-4 pr-12 border border-border overflow-x-auto font-mono text-foreground whitespace-pre-wrap leading-relaxed">
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
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">What happens next:</span> The monitor runs the selected checks and reports results back to Shuffle. Host metadata is collected automatically.
                </p>
              </div>

              {/* Sensor detection status */}
              <div className={`rounded-lg border px-3 py-3 flex items-center gap-3 ${sensorDetected ? 'border-[hsl(var(--severity-low))]/30 bg-[hsl(var(--severity-low))]/[0.06]' : 'border-border bg-muted/30'}`}>
                {sensorDetected ? (
                  <>
                    <CheckCircle2 size={18} className="text-[hsl(var(--severity-low))] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Sensor detected!</p>
                      <p className="text-xs text-muted-foreground">A host has checked in to this monitoring group.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 size={18} className="animate-spin text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Waiting for sensor…</p>
                      <p className="text-xs text-muted-foreground">Run the command above on your target host. This will update automatically when a connection is detected.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            {addHostStep === 'checks' ? (
              <Button
                size="sm"
                onClick={() => setAddHostStep('deploy')}
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
    </div>
  );
};

export default VulnAssetsPage;
