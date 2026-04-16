import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Laptop, HardDrive, Lock, Package, Zap, ChevronRight, ChevronDown,
  Hash, Cpu, Send, ShieldCheck, ShieldX, FileCode, ArrowLeft, RefreshCw,
  Play, Terminal, Square, Maximize2, Clock, Loader2,
} from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { getApiUrl, getAuthHeader } from '@/config/api';

// ── OS icon (duplicated from VulnAssetsPage for isolation) ───────────────────
const OsIcon = ({ os, size = 14, className = '' }: { os: string; size?: number; className?: string }) => {
  const lower = (os || '').toLowerCase();
  if (lower.includes('windows') || lower.includes('win'))
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M0 3.5l9.9-1.4v9.6H0zm11.1-1.5L24 0v11.7H11.1zM0 12.6h9.9v9.6L0 20.7zm11.1-.3H24V24l-12.9-1.8z"/></svg>;
  if (lower.includes('mac') || lower.includes('darwin'))
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M18.7 19.4c-.7 1-1.4 2-2.6 2s-1.7-.7-3.2-.7-2 .7-3.2.7-1.7-.9-2.5-1.9C5.5 17.2 4 13.6 5.7 11.3c.8-1.1 2.2-1.8 3.7-1.9 1.2 0 2.3.8 3 .8s2.1-.9 3.5-.8c.6 0 2.3.2 3.4 1.8-3 1.8-2.5 5.5.4 7.2zM15.3 2c-2.2.1-4 2.4-3.7 4.3 2 .2 4-2 3.7-4.3z"/></svg>;
  return <Laptop size={size} className={className} />;
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
}

const MonitorDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [host, setHost] = useState<SensorHost | null>(null);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [softwareFilter, setSoftwareFilter] = useState('');
  const [codeScanFilter, setCodeScanFilter] = useState('');
  const [expandedCodePaths, setExpandedCodePaths] = useState<Set<string>>(new Set());
  const [softwareOpen, setSoftwareOpen] = useState(false);
  const [codeScanOpen, setCodeScanOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [customAction, setCustomAction] = useState('');
  const [actionHistoryMap, setActionHistoryMap] = useState<Map<string, { actionName: string; startedAt: number; finishedAt?: number; actionOutput?: string; error?: string; success?: boolean }[]>>(new Map());
  const [actionDebugMap, setActionDebugMap] = useState<Map<string, { actionName: string; status: string }>>(new Map());
  const [runningHosts, setRunningHosts] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  usePageMeta({ title: host ? `${host.hostname} — Monitor` : 'Monitor Detail', description: 'Host monitor detail view' });

  const fetchHost = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) { setError(`Failed to load (HTTP ${res.status})`); setLoading(false); return; }
      const data = await res.json();
      const envs = Array.isArray(data) ? data.filter((e: any) => !e.archived && e.sensor_group === true) : [];
      for (const env of envs) {
        const hosts: SensorHost[] = Array.isArray(env.sensor_hosts) ? env.sensor_hosts : [];
        const found = hosts.find((h: SensorHost) => h.uuid === id);
        if (found) {
          setHost(found);
          setGroupName(env.Name || '');
          setLoading(false);
          return;
        }
      }
      setError('Host not found');
    } catch {
      setError('Failed to reach the API');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchHost(); }, [fetchHost]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !host) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate('/monitors')} className="mb-4 gap-1.5">
          <ArrowLeft size={14} /> Back to Monitors
        </Button>
        <div className="text-center py-16">
          <p className="text-muted-foreground">{error || 'Host not found'}</p>
        </div>
      </div>
    );
  }

  const checkinDate = host.checkin ? new Date(host.checkin * 1000) : null;
  const isRecent = checkinDate ? (Date.now() - checkinDate.getTime()) < 5 * 60 * 1000 : false;
  const hdState: 'on' | 'off' | 'empty' = (host.hd_encrypted === true || host.hd_encrypted === 'true') ? 'on' : (host.hd_encrypted === false || host.hd_encrypted === 'false' || host.hd_encrypted === 'FALSE') ? 'off' : 'empty';
  const screenlockState: 'on' | 'off' | 'empty' = (host.automatic_screen_lock_enabled === true || host.automatic_screen_lock_enabled === 'true') ? 'on' : (host.automatic_screen_lock_enabled === false || host.automatic_screen_lock_enabled === 'false' || host.automatic_screen_lock_enabled === 'FALSE') ? 'off' : 'empty';
  const softwareCount = Array.isArray(host.installed_software) ? host.installed_software.length : 0;
  const codeScanCount = Array.isArray(host.code_scanner) ? host.code_scanner.length : 0;
  const responseActionsRaw = (host as any).response_actions as string | undefined;
  const responseActionsOn = !!responseActionsRaw;
  const logForwardingOn = !!host.log_forwarding;
  const isRunning = runningHosts.has(host.uuid);
  const actionDebug = actionDebugMap.get(host.uuid);
  const hostHistory = actionHistoryMap.get(host.uuid) || [];

  const relativeTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const executeHostAction = async (actionName: string) => {
    setRunningHosts(prev => new Set(prev).add(host.uuid));
    setActionDebugMap(prev => new Map(prev).set(host.uuid, { actionName, status: 'sending' }));
    const entry = { actionName, startedAt: Date.now(), actionOutput: undefined as string | undefined, error: undefined as string | undefined, success: undefined as boolean | undefined, finishedAt: undefined as number | undefined };
    try {
      const res = await fetch(getApiUrl('/api/v1/executeaction'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName, hostname: host.hostname, group: groupName, sensor_id: host.uuid }),
      });
      const data = await res.json();
      entry.success = res.ok;
      entry.actionOutput = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    } catch (err: any) {
      entry.success = false;
      entry.error = err?.message || 'Unknown error';
    }
    entry.finishedAt = Date.now();
    setActionHistoryMap(prev => {
      const next = new Map(prev);
      next.set(host.uuid, [...(next.get(host.uuid) || []), entry]);
      return next;
    });
    setRunningHosts(prev => { const n = new Set(prev); n.delete(host.uuid); return n; });
    setActionDebugMap(prev => { const n = new Map(prev); n.delete(host.uuid); return n; });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/monitors')} className="gap-1.5 shrink-0">
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <OsIcon os={host.os} size={20} className="text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{host.hostname}</h1>
            <p className="text-xs text-muted-foreground">
              Group: {groupName}
              {checkinDate && (
                <> · Last check-in: <span className={isRecent ? 'text-green-500' : ''}>{relativeTime(checkinDate)}</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {responseActionsOn && (
            <Popover open={terminalOpen} onOpenChange={setTerminalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <Terminal size={13} /> Run Action
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-[420px] p-0 border-border bg-card">
                <div className="flex flex-col max-h-[350px]">
                  {/* History */}
                  <div className="flex-1 overflow-y-auto min-h-[60px]">
                    {hostHistory.length === 0 && !isRunning && (
                      <div className="px-3 py-6 text-center text-xs text-muted-foreground">No actions run yet</div>
                    )}
                    {hostHistory.map((entry, i) => (
                      <div key={i} className="border-b border-border/50">
                        <div className="px-3 py-1.5 flex items-center gap-2 bg-muted/20">
                          <span className="text-[0.6rem] font-mono text-primary">$</span>
                          <span className="text-[0.65rem] font-mono font-medium text-foreground flex-1 truncate">{entry.actionName}</span>
                          {entry.success ? <ShieldCheck size={10} className="text-green-500 shrink-0" /> : <ShieldX size={10} className="text-destructive shrink-0" />}
                          <span className="text-[0.55rem] text-muted-foreground font-mono shrink-0">
                            {entry.finishedAt ? `${Math.round((entry.finishedAt - entry.startedAt) / 1000)}s` : ''}
                          </span>
                        </div>
                        {(entry.actionOutput || entry.error) && (
                          <div className="px-3 py-1.5">
                            {entry.actionOutput && <pre className="text-[0.6rem] font-mono text-foreground/80 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">{entry.actionOutput}</pre>}
                            {entry.error && <pre className="text-[0.6rem] font-mono text-destructive whitespace-pre-wrap break-words">{entry.error}</pre>}
                          </div>
                        )}
                      </div>
                    ))}
                    {isRunning && actionDebug && (
                      <div className="border-b border-border/50">
                        <div className="px-3 py-1.5 flex items-center gap-2 bg-muted/20">
                          <span className="text-[0.6rem] font-mono text-primary">$</span>
                          <span className="text-[0.65rem] font-mono font-medium text-foreground flex-1 truncate">{actionDebug.actionName}</span>
                          <Loader2 size={10} className="animate-spin text-primary shrink-0" />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Command input */}
                  <div className="px-3 py-2 border-t border-border shrink-0">
                    <div className="flex gap-1.5 items-center">
                      <span className="text-[0.65rem] font-mono text-primary shrink-0">$</span>
                      <Input
                        placeholder="Type command…"
                        value={customAction}
                        onChange={e => setCustomAction(e.target.value)}
                        className="h-7 text-xs flex-1 font-mono"
                        ref={el => { if (el && terminalOpen) requestAnimationFrame(() => el.focus()); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customAction.trim()) {
                            executeHostAction(customAction.trim());
                            setCustomAction('');
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        disabled={!customAction.trim() || isRunning}
                        onClick={() => {
                          if (customAction.trim()) {
                            executeHostAction(customAction.trim());
                            setCustomAction('');
                          }
                        }}
                      >
                        <Play size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="sm" onClick={fetchHost} className="gap-1.5 h-8 shrink-0">
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* Detail panel — same as expanded view in VulnAssetsPage */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        {/* Info grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <Send size={12} />
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Log Forwarding</span>
            </div>
            {host.log_forwarding ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-foreground cursor-help truncate">Enabled</p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-sm">
                    <pre className="text-[0.65rem] font-mono whitespace-pre-wrap">{host.log_forwarding}</pre>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : <p className="text-xs text-muted-foreground">Not enabled</p>}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap size={12} />
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Response Actions</span>
            </div>
            <p className={`text-xs ${responseActionsOn ? 'text-foreground' : 'text-muted-foreground'}`}>
              {responseActionsOn ? `Enabled (${responseActionsRaw})` : 'Not enabled'}
            </p>
          </div>
        </div>

        {/* Compliance summary */}
        <div className="flex flex-wrap gap-3">
          <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${hdState === 'on' ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400' : hdState === 'off' ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400' : 'border-border bg-muted/30 text-muted-foreground'}`}>
            {hdState === 'on' ? <ShieldCheck size={13} /> : <ShieldX size={13} />}
            Disk Encryption: {hdState === 'on' ? 'Enabled' : hdState === 'off' ? 'Disabled' : 'Not checked'}
          </div>
          <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${screenlockState === 'on' ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400' : screenlockState === 'off' ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400' : 'border-border bg-muted/30 text-muted-foreground'}`}>
            <Lock size={13} />
            Screen Lock: {screenlockState === 'on' ? 'Enabled' : screenlockState === 'off' ? 'Disabled' : 'Not checked'}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Zap size={13} />
            Elevated Access: {host.elevated_access ? 'Yes' : 'No'}
          </div>
          {logForwardingOn && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              <Send size={13} />
              Active Monitoring: {host.log_forwarding}
            </div>
          )}
        </div>

        {/* Installed Software — collapsed by default */}
        <div className="space-y-2">
          <button onClick={() => setSoftwareOpen(!softwareOpen)} className="flex items-center gap-2 w-full text-left hover:bg-muted/20 rounded px-1 py-0.5 -mx-1 transition-colors">
            {softwareOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            <Package size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Installed Software</span>
            {softwareCount > 0 && (
              <span className="text-[0.65rem] text-muted-foreground">({softwareCount} packages)</span>
            )}
          </button>
          {softwareOpen && (
            softwareCount === 0 ? (
              <p className="text-xs text-muted-foreground italic pl-7">No software inventory collected for this host.</p>
            ) : (
              <>
                <Input
                  placeholder="Filter software..."
                  value={softwareFilter}
                  onChange={(e) => setSoftwareFilter(e.target.value)}
                  className="h-7 text-xs mb-1"
                />
                {(() => {
                  const filtered = host.installed_software
                    .filter((sw) => !sw.version || String(sw.version).length <= 100)
                    .filter((sw) => {
                      if (!softwareFilter) return true;
                      const q = softwareFilter.toLowerCase();
                      return (sw.name || '').toLowerCase().includes(q) || String(sw.version || '').toLowerCase().includes(q) || String(sw.source || '').toLowerCase().includes(q);
                    });
                  return (
                    <div className="rounded-md border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Name</th>
                            <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Version</th>
                            <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filtered.length === 0 ? (
                            <tr><td colSpan={3} className="px-3 py-3 text-center text-muted-foreground italic">No matches</td></tr>
                          ) : filtered.map((sw, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="px-3 py-1.5 font-medium text-foreground">{sw.name || '—'}</td>
                              <td className="px-3 py-1.5 font-mono text-muted-foreground">{(sw.version as string) || '—'}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{(sw.source as string) || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </>
            )
          )}
        </div>

        {/* Code Package Scanner — collapsed by default */}
        <div className="space-y-2">
          <button onClick={() => setCodeScanOpen(!codeScanOpen)} className="flex items-center gap-2 w-full text-left hover:bg-muted/20 rounded px-1 py-0.5 -mx-1 transition-colors">
            {codeScanOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            <FileCode size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Code Package Scanner</span>
            {codeScanCount > 0 && (
              <span className="text-[0.65rem] text-muted-foreground">({codeScanCount} projects)</span>
            )}
          </button>
          {codeScanOpen && (
            codeScanCount === 0 ? (
              <p className="text-xs text-muted-foreground italic pl-7">No code package scanning data collected for this host.</p>
            ) : (
              <>
                <Input
                  placeholder="Filter by path, type, or package name..."
                  value={codeScanFilter}
                  onChange={(e) => setCodeScanFilter(e.target.value)}
                  className="h-7 text-xs mb-1"
                />
                {(() => {
                  const q = codeScanFilter.toLowerCase();
                  const filtered = host.code_scanner!.filter((proj) => {
                    if (!q) return true;
                    if (proj.path.toLowerCase().includes(q)) return true;
                    if (proj.type.toLowerCase().includes(q)) return true;
                    return proj.packages?.some(p => p.name.toLowerCase().includes(q) || p.version.toLowerCase().includes(q));
                  });
                  return (
                    <div className="rounded-md border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                      {filtered.length === 0 ? (
                        <p className="px-3 py-3 text-center text-xs text-muted-foreground italic">No matches</p>
                      ) : filtered.map((proj, pi) => {
                        const isExpanded = expandedCodePaths.has(proj.path);
                        const pkgCount = proj.packages?.length || 0;
                        return (
                          <div key={pi} className="border-b border-border last:border-b-0">
                            <button
                              onClick={() => setExpandedCodePaths(prev => {
                                const next = new Set(prev);
                                if (next.has(proj.path)) next.delete(proj.path); else next.add(proj.path);
                                return next;
                              })}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
                            >
                              {isExpanded ? <ChevronDown size={12} className="text-muted-foreground shrink-0" /> : <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
                              <span className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                                proj.type === 'python' ? 'bg-blue-500/15 text-blue-500' :
                                proj.type === 'java' ? 'bg-red-500/15 text-red-500' :
                                proj.type === 'javascript' || proj.type === 'node' ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' :
                                proj.type === 'go' ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' :
                                proj.type === 'rust' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' :
                                proj.type === 'ruby' ? 'bg-red-400/15 text-red-400' :
                                proj.type === 'php' ? 'bg-indigo-500/15 text-indigo-500' :
                                proj.type === 'dotnet' || proj.type === 'csharp' ? 'bg-purple-500/15 text-purple-500' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                <FileCode size={10} />
                                {proj.type}
                              </span>
                              <span className="text-xs font-mono font-medium text-foreground truncate flex-1">{proj.path}</span>
                              <span className="text-[0.65rem] text-muted-foreground shrink-0">{pkgCount} pkg{pkgCount !== 1 ? 's' : ''}</span>
                            </button>
                            {isExpanded && pkgCount > 0 && (
                              <div className="bg-muted/10">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/40 sticky top-0">
                                    <tr>
                                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Name</th>
                                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Version</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {proj.packages.map((pkg, ki) => (
                                      <tr key={ki} className="hover:bg-muted/20">
                                        <td className="px-3 py-1.5 font-medium text-foreground">{pkg.name || '—'}</td>
                                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{pkg.version || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitorDetailPage;
