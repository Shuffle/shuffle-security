import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Laptop, HardDrive, Lock, Package, Zap, Plus, Copy, Check, Activity, ChevronRight, Shield, FolderOpen, Loader2 } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader } from '@/config/api';

const HOST_CHECK_OPTIONS = [
  { id: 'hd_encrypted' as const, label: 'HD Encrypted', description: 'Check if disk encryption is enabled (FileVault, BitLocker, LUKS)', icon: <HardDrive size={16} /> },
  { id: 'screenlock' as const, label: 'Screenlock Enabled', description: 'Verify automatic screen lock is configured', icon: <Lock size={16} /> },
  { id: 'installed_software' as const, label: 'Installed Software', description: 'Inventory of installed applications and versions', icon: <Package size={16} /> },
  { id: 'response_actions' as const, label: 'Response Actions', description: 'Enable automated response actions on this host', icon: <Zap size={16} /> },
];

interface OrbEnvironment {
  Name: string;
  Type: string;
  id: string;
  sensor_group?: boolean;
  [key: string]: unknown;
}

interface MonitoringGroup {
  id: string;
  name: string;
  queue: string;
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
      .map(e => ({ id: e.id || e.Name, name: e.Name, queue: e.Name }));
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
        return { id: created.id || name, name: created.Name, queue: created.Name };
      }
    }
    return { id: name, name, queue: name };
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
  });
  const [copied, setCopied] = useState(false);

  // Monitoring groups (from API)
  const [groups, setGroups] = useState<MonitoringGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroupLoading, setCreatingGroupLoading] = useState(false);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    const fetched = await fetchSensorGroups();
    setGroups(fetched);
    // Auto-select first if nothing selected
    if (fetched.length > 0) {
      setSelectedGroupId(prev => {
        if (prev && fetched.some(g => g.id === prev)) return prev;
        return fetched[0].id;
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
    if (selectedGroup) flags.push(`--queue=${selectedGroup.queue}`);
    if (hostChecks.installed_software) flags.push('--software_list_enabled=true');
    if (hostChecks.hd_encrypted) flags.push('--hd_encrypted_check=true');
    if (hostChecks.screenlock) flags.push('--screenlock_check=true');
    if (hostChecks.response_actions) flags.push('--response_actions_enabled=true');
    return `go run orborus.go ${flags.join(' ')}`;
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(getDeployCommand());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenAddHost = () => {
    setAddHostStep('checks');
    setHostPlatform('linux');
    setHostChecks({ hd_encrypted: true, screenlock: true, installed_software: true, response_actions: false });
    setCopied(false);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setAddHostOpen(true);
    // Refresh groups when opening
    loadGroups();
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroupLoading(true);
    const created = await createSensorGroupEnv(newGroupName.trim());
    if (created) {
      setGroups(prev => [...prev, created]);
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
          <Shield size={28} className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Assets</h1>
            <p className="text-sm text-muted-foreground">Monitor host compliance and security posture across your endpoints</p>
          </div>
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
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpenAddHost}>
            <Plus size={14} />
            Add Host
          </Button>
        </div>

        {/* Checks overview */}
        <div className="grid grid-cols-4 gap-0 divide-x divide-border">
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

        {/* Empty host list */}
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
                <p className="text-xs text-muted-foreground">Each group uses a dedicated Orborus queue for host communication.</p>
                {!isCreatingGroup ? (
                  <div className="flex gap-2">
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={groupsLoading}>
                      <SelectTrigger className="flex-1">
                        {groupsLoading ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 size={13} className="animate-spin" />
                            <span className="text-sm">Loading…</span>
                          </div>
                        ) : groups.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No groups — create one</span>
                        ) : (
                          <SelectValue placeholder="Select a group" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
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
                      <p className="text-[0.65rem] text-muted-foreground">This will create an Orborus environment with the same name as the queue.</p>
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
                    <label
                      key={check.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={hostChecks[check.id]}
                        onCheckedChange={(v) => setHostChecks(prev => ({ ...prev, [check.id]: !!v }))}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-muted-foreground shrink-0">{check.icon}</span>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground block">{check.label}</span>
                          <span className="text-xs text-muted-foreground">{check.description}</span>
                        </div>
                      </div>
                    </label>
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
                <Button size="sm" onClick={() => { setAddHostOpen(false); toast.success('Host monitor configured', { description: `Group "${selectedGroup?.name}" — deploy the command on your target host.` }); }}>
                  Done
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VulnAssetsPage;
