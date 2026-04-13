import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Laptop, HardDrive, Lock, Package, Zap, Plus, Copy, Check, Activity, ChevronRight, Radar, FolderOpen, Loader2, CheckCircle2, Send, RefreshCw } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader } from '@/config/api';

const HOST_CHECK_OPTIONS = [
  { id: 'hd_encrypted' as const, label: 'HD Encrypted', description: 'Check if disk encryption is enabled (FileVault, BitLocker, LUKS)', icon: <HardDrive size={16} />, disabled: false },
  { id: 'screenlock' as const, label: 'Screenlock Enabled', description: 'Verify automatic screen lock is configured', icon: <Lock size={16} />, disabled: false },
  { id: 'installed_software' as const, label: 'Installed Software', description: 'Inventory of installed applications and versions', icon: <Package size={16} />, disabled: false },
  { id: 'response_actions' as const, label: 'Response Actions', description: 'Enable automated response actions on this host', icon: <Zap size={16} />, disabled: true },
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
    response_actions: false,
    log_forwarding: false,
  });
  const [logForwardingEndpoint, setLogForwardingEndpoint] = useState('');
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
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // Aggregate all hosts across all sensor groups
  const allHosts = groups.flatMap(g => g.hosts.map(h => ({ ...h, groupName: g.name, groupId: g.id })));

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
    if (selectedGroup) {
      flags.push(`--queue=${selectedGroup.queue}`);
      if (selectedGroup.auth) flags.push(`--auth=${selectedGroup.auth}`);
      
      if (selectedGroup.org_id) flags.push(`--org_id=${selectedGroup.org_id}`);
    }
    if (hostChecks.installed_software) flags.push('--software_list_enabled=true');
    if (hostChecks.hd_encrypted) flags.push('--hd_encrypted_check=true');
    if (hostChecks.screenlock) flags.push('--screenlock_check=true');
    if (hostChecks.response_actions) flags.push('--response_actions_enabled=true');
    if (hostChecks.log_forwarding && logForwardingEndpoint.trim()) flags.push(`--log_forwarding=${logForwardingEndpoint.trim()}`);
    return `go run orborus.go ${flags.join(' ')}`;
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(getDeployCommand());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Poll for sensor checkin when on deploy step
  const startSensorPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setSensorDetected(false);
    setSensorPolling(true);
    const checkSensor = async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!res.ok) return;
        const envs: OrbEnvironment[] = await res.json();
        const env = envs.find(e => (e.id === selectedGroupId || e.Name === selectedGroup?.name) && e.sensor_group === true);
        if (env && env.checkin) {
          const now = Math.floor(Date.now() / 1000);
          const checkin = typeof env.checkin === 'number' ? env.checkin : 0;
          if (checkin > 0 && (now - checkin) < 300) {
            setSensorDetected(true);
            setSensorPolling(false);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        }
      } catch { /* continue polling */ }
    };
    checkSensor();
    pollRef.current = setInterval(checkSensor, 5000);
  }, [selectedGroupId, selectedGroup?.name]);

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

        {/* Monitoring Group Validator Dropdown */}
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
          const statusLabel = status === 'healthy'
            ? 'Syncing'
            : status === 'stale'
              ? 'Stale'
              : status === 'offline'
                ? 'Offline'
                : 'No hosts';
          const timeAgo = latestCheckin
            ? checkinAge < 60
              ? `${Math.round(checkinAge)}s ago`
              : checkinAge < 3600
                ? `${Math.round(checkinAge / 60)}m ago`
                : `${Math.round(checkinAge / 3600)}h ago`
            : '';

          return (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Group Sync</span>
              <Select value={syncGroupId} onValueChange={setSyncGroupId}>
                <SelectTrigger className="w-auto min-w-[180px] h-9 gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-xs font-medium truncate max-w-[100px]">{syncGroup.name}</span>
                    <span className="text-[0.6rem] text-muted-foreground">
                      {statusLabel}{timeAgo ? ` · ${timeAgo}` : ''}
                    </span>
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
                    const gLabel = gStatus === 'healthy' ? 'Syncing' : gStatus === 'stale' ? 'Stale' : gStatus === 'offline' ? 'Offline' : 'No hosts';
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
            </div>
          );
        })()}
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
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => loadGroups()}>
              <RefreshCw size={14} />
              Refresh
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpenAddHost}>
              <Plus size={14} />
              Add Host
            </Button>
          </div>
        </div>

        {/* Checks overview */}
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
            <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.6fr_0.8fr_1fr] gap-2 px-5 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground">Hostname</span>
              <span className="text-xs font-semibold text-muted-foreground">OS</span>
              <span className="text-xs font-semibold text-muted-foreground">Arch</span>
              <span className="text-xs font-semibold text-muted-foreground">Screenlock</span>
              <span className="text-xs font-semibold text-muted-foreground">Group</span>
              <span className="text-xs font-semibold text-muted-foreground">Last Check-in</span>
            </div>
            {/* Host rows */}
            {allHosts.map(host => {
              const checkinDate = host.checkin ? new Date(host.checkin * 1000) : null;
              const isRecent = checkinDate ? (Date.now() - checkinDate.getTime()) < 5 * 60 * 1000 : false;
              return (
                <div
                  key={host.uuid}
                  className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.6fr_0.8fr_1fr] gap-2 px-5 py-3 border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors items-center"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Laptop size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{host.hostname}</span>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{host.os || '—'}</span>
                  <span className="text-xs text-muted-foreground">{host.arch || '—'}</span>
                  <span className={`text-xs font-medium ${host.automatic_screen_lock_enabled ? 'text-green-500' : 'text-orange-500'}`}>
                    {host.automatic_screen_lock_enabled ? 'On' : 'Off'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{host.groupName}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRecent ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                    <span className="text-xs text-muted-foreground">
                      {checkinDate ? checkinDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
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
