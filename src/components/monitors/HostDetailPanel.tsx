import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  HardDrive, Lock, Package, Zap, ChevronRight, ChevronDown,
  Hash, Cpu, Send, ShieldCheck, ShieldX, FileCode, ScanLine, AlertTriangle,
} from 'lucide-react';
import type { Vulnerability, VulnSeverity } from '@/hooks/useVulnerabilities';

/**
 * Click handler that mimics <a> behavior:
 *  - plain click → in-app SPA navigation
 *  - ctrl/cmd/middle-click → new tab (let the browser handle it)
 */
const handleEntityClick = (
  e: React.MouseEvent,
  url: string,
  navigate: ReturnType<typeof useNavigate>,
) => {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // browser opens new tab
  // Don't navigate if the user is selecting text
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (sel && sel.toString().length > 0) return;
  e.preventDefault();
  navigate(url);
};


/**
 * Shared "host detail" panel rendered on BOTH the /monitors expanded list row
 * and the standalone /monitors/:id page. Both pages must look identical —
 * do not fork this. Use the `variant` prop to tune density:
 *
 *  - 'inline' → compact, sits inside an expanded list row (default)
 *  - 'page'   → softer borders/padding for use as a standalone page section
 */

interface CodeScannerProject {
  path: string;
  type: string;
  packages: { name: string; version: string }[];
}

interface HostLike {
  arch: string;
  automatic_screen_lock_enabled: boolean | string;
  elevated_access: boolean;
  hd_encrypted: boolean | string;
  installed_software: { name: string; [key: string]: unknown }[];
  code_scanner?: CodeScannerProject[];
  log_forwarding: string;
  os: string;
  serial: string;
  response_actions?: string;
  [key: string]: unknown;
}

interface HostDetailPanelProps {
  host: HostLike;
  variant?: 'inline' | 'page';
  /** When true, software + code scanner sections start collapsed (used on the standalone page) */
  collapsibleSections?: boolean;
  /** Optional terminal context — enables the per-project "CBOM Scan" button when provided */
  hostUuid?: string;
  hostname?: string;
  groupName?: string;
  mode?: string;
  /** Open vulnerabilities scoped to this host. When provided, badges render at host, software, and package levels. */
  vulnerabilities?: Vulnerability[];
}

const SEV_ORDER: VulnSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const SEV_CLASSES: Record<VulnSeverity, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  info: 'bg-muted text-muted-foreground border-border',
};

const normalize = (s: string) => s.toLowerCase().trim();
const stripVersion = (s: string) => s.toLowerCase().trim().replace(/[@:]\d.*$/, '');

const stateOf = (v: boolean | string | undefined): 'on' | 'off' => {
  if (v === true || v === 'true') return 'on';
  // Anything else (false, "false", undefined, null, empty string, missing field) → off
  return 'off';
};

/** Format a raw API value for display in tooltips. Missing fields show "(field not set)". */
const fmtRaw = (v: unknown): string => {
  if (v === undefined) return '(field not set)';
  if (v === null) return 'null';
  if (v === '') return '"" (empty string)';
  return String(v);
};

export const HostDetailPanel = ({ host, variant = 'inline', collapsibleSections = false, hostUuid, hostname, groupName, mode, vulnerabilities }: HostDetailPanelProps) => {
  const navigate = useNavigate();
  const resolvedUuid = hostUuid || (host.uuid as string | undefined);
  const resolvedHostname = hostname || (host.hostname as string | undefined);
  const canRunCbom = !!resolvedUuid && !!resolvedHostname;
  const runCbomScan = (path: string) => {
    if (!resolvedUuid) return;
    navigate(`/monitors/${resolvedUuid}/terminal`, {
      state: {
        hostname: resolvedHostname,
        groupName: groupName || (host.groupName as string | undefined) || '',
        mode: mode || 'controlled',
        autoRunAction: `script:cbom ${path}`,
      },
    });
  };
  const [softwareFilter, setSoftwareFilter] = useState('');
  const [codeScanFilter, setCodeScanFilter] = useState('');
  const [expandedCodePaths, setExpandedCodePaths] = useState<Set<string>>(new Set());
  const [softwareOpen, setSoftwareOpen] = useState(!collapsibleSections);
  const [codeScanOpen, setCodeScanOpen] = useState(!collapsibleSections);

  const hdState = stateOf(host.hd_encrypted);
  const screenlockState = stateOf(host.automatic_screen_lock_enabled);
  const softwareCount = Array.isArray(host.installed_software) ? host.installed_software.length : 0;
  const codeScanCount = Array.isArray(host.code_scanner) ? host.code_scanner.length : 0;
  const codeScanPackageCount = Array.isArray(host.code_scanner)
    ? host.code_scanner.reduce((sum, proj) => sum + (proj.packages?.length || 0), 0)
    : 0;
  const responseActionsRaw = host.response_actions;
  const raLower = String(responseActionsRaw ?? '').toLowerCase().trim();
  const responseActionsOn = !!responseActionsRaw && raLower !== 'false' && raLower !== '0' && raLower !== 'no' && raLower !== 'off';
  const logForwardingOn = !!host.log_forwarding;

  // ── Vulnerability matching ──────────────────────────────────────────────
  // `vulnerabilities` is already pre-filtered to this host by the caller.
  // We further classify each vuln so we can render badges next to the matching
  // installed-software / code-scanner row.
  const openVulns = (vulnerabilities || []).filter(v => v.status === 'open' || v.status === 'in_progress');
  const sevCounts: Record<VulnSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const v of openVulns) sevCounts[v.severity] = (sevCounts[v.severity] || 0) + 1;
  const totalOpenVulns = openVulns.length;

  const vulnsBySoftwareName = new Map<string, Vulnerability[]>();
  const vulnsByCodePath = new Map<string, Vulnerability[]>();
  const vulnsByCodePackage = new Map<string, Vulnerability[]>();
  for (const v of openVulns) {
    const pname = v.package_name ? normalize(v.package_name) : '';
    if (pname) {
      const list = vulnsBySoftwareName.get(pname) || [];
      list.push(v);
      vulnsBySoftwareName.set(pname, list);
      const plist = vulnsByCodePackage.get(pname) || [];
      plist.push(v);
      vulnsByCodePackage.set(pname, plist);
    }
    for (const p of v.paths || []) {
      if (!p.path) continue;
      const key = normalize(p.path);
      const list = vulnsByCodePath.get(key) || [];
      list.push(v);
      vulnsByCodePath.set(key, list);
    }
  }

  const SeverityBadgeRow = ({ counts, size = 'sm' }: { counts: Record<VulnSeverity, number>; size?: 'sm' | 'xs' }) => {
    const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[0.6rem]' : 'px-2 py-0.5 text-[0.65rem]';
    return (
      <div className="inline-flex items-center gap-1">
        {SEV_ORDER.filter(s => counts[s] > 0).map(s => (
          <span key={s} className={`inline-flex items-center gap-0.5 rounded border font-medium ${pad} ${SEV_CLASSES[s]}`}>
            {counts[s]} {s.charAt(0).toUpperCase()}
          </span>
        ))}
      </div>
    );
  };

  const RowVulnBadge = ({ vulns }: { vulns: Vulnerability[] }) => {
    if (!vulns || vulns.length === 0) return null;
    const counts: Record<VulnSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const v of vulns) counts[v.severity] = (counts[v.severity] || 0) + 1;
    const top = SEV_ORDER.find(s => counts[s] > 0) || 'info';
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.6rem] font-medium cursor-help ${SEV_CLASSES[top]}`}>
              <AlertTriangle size={9} />
              {vulns.length} vuln{vulns.length !== 1 ? 's' : ''}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="z-[9999] max-w-xs">
            <div className="space-y-1">
              <p className="text-[0.65rem] font-semibold">Open vulnerabilities</p>
              <div className="space-y-0.5">
                {vulns.slice(0, 6).map(v => (
                  <p key={v.id} className="text-[0.6rem] font-mono">
                    <span className={`uppercase mr-1 ${SEV_CLASSES[v.severity].split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{v.severity}</span>
                    {v.cve_id || v.record_id || v.id.split('::')[0]}
                  </p>
                ))}
                {vulns.length > 6 && <p className="text-[0.6rem] text-muted-foreground italic">+ {vulns.length - 6} more</p>}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const wrapperClass = variant === 'page'
    ? 'rounded-lg border border-border bg-card p-5 space-y-5'
    : 'border-b border-border bg-muted/10 px-5 py-4 space-y-4';

  return (
    <div className={wrapperClass}>
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
                  <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
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
                <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
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
          {responseActionsOn ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className={`text-xs cursor-help ${raLower.includes('full') ? 'text-red-600 dark:text-red-400 font-medium' : 'text-foreground'}`}>
                    {raLower.includes('full') ? 'Full control (RCE)' : 'Controlled'}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
                  <p className="text-[0.65rem] font-mono">response_actions = {fmtRaw(responseActionsRaw)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground cursor-help">Not enabled</p>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
                  <p className="text-[0.65rem] font-mono">response_actions = {fmtRaw(responseActionsRaw)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Compliance summary */}
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium cursor-help ${hdState === 'on' ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                {hdState === 'on' ? <ShieldCheck size={13} /> : <ShieldX size={13} />}
                Disk Encryption: {hdState === 'on' ? 'Enabled' : 'Disabled'}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
              <p className="text-[0.65rem] font-mono">hd_encrypted = {fmtRaw(host.hd_encrypted)}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium cursor-help ${screenlockState === 'on' ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                <Lock size={13} />
                Screen Lock: {screenlockState === 'on' ? 'Enabled' : 'Disabled'}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
              <p className="text-[0.65rem] font-mono">automatic_screen_lock_enabled = {fmtRaw(host.automatic_screen_lock_enabled)}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-muted-foreground cursor-help">
                <Zap size={13} />
                Elevated Access: {host.elevated_access ? 'Yes' : 'No'}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
              <p className="text-[0.65rem] font-mono">elevated_access = {fmtRaw(host.elevated_access)}</p>
            </TooltipContent>
          </Tooltip>
          {logForwardingOn && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-muted-foreground cursor-help">
                  <Send size={13} />
                  Active Monitoring: Enabled
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
                <p className="text-[0.65rem] font-mono whitespace-pre-wrap">log_forwarding = {fmtRaw(host.log_forwarding)}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>

      {/* Host-level vulnerability summary */}
      {vulnerabilities !== undefined && (
        <div className={`rounded-md border p-3 ${totalOpenVulns > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted/20'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className={totalOpenVulns > 0 ? 'text-red-500' : 'text-muted-foreground'} />
              <span className="text-xs font-semibold text-foreground">
                {totalOpenVulns > 0
                  ? `${totalOpenVulns} open vulnerabilit${totalOpenVulns === 1 ? 'y' : 'ies'} on this host`
                  : 'No open vulnerabilities on this host'}
              </span>
            </div>
            {totalOpenVulns > 0 && <SeverityBadgeRow counts={sevCounts} />}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {collapsibleSections ? (
          <button onClick={() => setSoftwareOpen(!softwareOpen)} className="flex items-center gap-2 w-full text-left hover:bg-muted/20 rounded px-1 py-0.5 -mx-1 transition-colors">
            {softwareOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            <Package size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Installed Software</span>
            {softwareCount > 0 && (
              <span className="text-[0.65rem] text-muted-foreground">({softwareCount} packages)</span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Package size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Installed Software</span>
            {softwareCount > 0 && (
              <span className="text-[0.65rem] text-muted-foreground">({softwareCount} packages)</span>
            )}
          </div>
        )}
        {softwareOpen && (
          softwareCount === 0 ? (
            <p className={`text-xs text-muted-foreground italic mb-3 ${collapsibleSections ? 'pl-7' : ''}`}>No software inventory collected for this host.</p>
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
                    return (sw.name || '').toLowerCase().includes(q)
                      || String(sw.version || '').toLowerCase().includes(q)
                      || String(sw.source || '').toLowerCase().includes(q);
                  });
                return (
                  <div className={`rounded-md border border-border overflow-hidden ${variant === 'page' ? 'max-h-[400px]' : 'max-h-[240px]'} overflow-y-auto`}>
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
                        ) : filtered.map((sw, idx) => {
                          const swVulns = sw.name ? vulnsBySoftwareName.get(normalize(String(sw.name))) || [] : [];
                          return (
                            <tr
                              key={idx}
                              className="hover:bg-muted/20 cursor-pointer"
                              onClick={(e) => sw.name && handleEntityClick(e, `/software/${encodeURIComponent(sw.name)}`, navigate)}
                              onAuxClick={(e) => sw.name && e.button === 1 && window.open(`/software/${encodeURIComponent(sw.name)}`, '_blank')}
                            >
                              <td className="px-3 py-1.5 font-medium text-foreground">
                                <span className="inline-flex items-center gap-2">
                                  {sw.name || '—'}
                                  <RowVulnBadge vulns={swVulns} />
                                </span>
                              </td>
                              <td className="px-3 py-1.5 font-mono text-muted-foreground">{(sw.version as string) || '—'}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{(sw.source as string) || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          )
        )}
      </div>

      {/* Code Package Scanner */}
      <div className="space-y-2">
        {collapsibleSections ? (
          <button onClick={() => setCodeScanOpen(!codeScanOpen)} className="flex items-center gap-2 w-full text-left hover:bg-muted/20 rounded px-1 py-0.5 -mx-1 transition-colors">
            {codeScanOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            <FileCode size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Code Package Scanner</span>
            {codeScanCount > 0 && (
              <span className="text-[0.65rem] text-muted-foreground">({codeScanCount} projects, {codeScanPackageCount} packages)</span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <FileCode size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Code Package Scanner</span>
            {codeScanCount > 0 && (
              <span className="text-[0.65rem] text-muted-foreground">({codeScanCount} projects, {codeScanPackageCount} packages)</span>
            )}
          </div>
        )}
        {codeScanOpen && (
          codeScanCount === 0 ? (
            <p className={`text-xs text-muted-foreground italic ${collapsibleSections ? 'pl-7' : ''}`}>No code package scanning data collected for this host.</p>
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
                  if ((proj.path || '').toLowerCase().includes(q)) return true;
                  if ((proj.type || '').toLowerCase().includes(q)) return true;
                  return proj.packages?.some(p => (p.name || '').toLowerCase().includes(q) || (p.version || '').toLowerCase().includes(q));
                });
                return (
                  <div className={`rounded-md border border-border overflow-hidden ${variant === 'page' ? 'max-h-[400px]' : 'max-h-[340px]'} overflow-y-auto`}>
                    {filtered.length === 0 ? (
                      <p className="px-3 py-3 text-center text-xs text-muted-foreground italic">No matches</p>
                    ) : filtered.map((proj, pi) => {
                      const isExpanded = expandedCodePaths.has(proj.path);
                      const pkgCount = proj.packages?.length || 0;
                      // Aggregate vulns at the project level: any package matching by name OR a path matching this project root.
                      const projVulnSet = new Map<string, Vulnerability>();
                      const projPathKey = normalize(proj.path || '');
                      for (const v of openVulns) {
                        if (v.package_name && (proj.packages || []).some(p => normalize(p.name || '') === normalize(v.package_name!))) {
                          projVulnSet.set(v.id, v);
                        }
                        for (const pp of v.paths || []) {
                          if (pp.path && normalize(pp.path).startsWith(projPathKey) && projPathKey) {
                            projVulnSet.set(v.id, v);
                          }
                        }
                      }
                      const projVulns = Array.from(projVulnSet.values());
                      return (
                        <div key={pi} className="border-b border-border last:border-b-0">
                          <div className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors">
                            <button
                              type="button"
                              onClick={() => setExpandedCodePaths(prev => {
                                const next = new Set(prev);
                                if (next.has(proj.path)) next.delete(proj.path); else next.add(proj.path);
                                return next;
                              })}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            >
                              {isExpanded ? <ChevronDown size={12} className="text-muted-foreground shrink-0" /> : <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
                              <span className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold px-1.5 py-0.5 rounded shrink-0 w-[72px] justify-center ${
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
                              <RowVulnBadge vulns={projVulns} />
                            </button>
                            {canRunCbom && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span tabIndex={0} className="shrink-0">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled
                                        className="h-6 px-2 gap-1 text-[0.65rem] shrink-0 pointer-events-none"
                                      >
                                        <ScanLine size={11} />
                                        BOM Scan
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <p className="text-[0.65rem]">Generates a CycloneDX Bill of Materials (BOM) for this project — a standardized inventory of all packages, versions, and dependencies used to track supply-chain risk. Coming soon.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
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
                                  {proj.packages.map((pkg, ki) => {
                                    const pkgVulns = pkg.name ? vulnsByCodePackage.get(normalize(pkg.name)) || [] : [];
                                    return (
                                      <tr
                                        key={ki}
                                        className="hover:bg-muted/20 cursor-pointer"
                                        onClick={(e) => pkg.name && handleEntityClick(e, `/packages/${encodeURIComponent(pkg.name)}`, navigate)}
                                        onAuxClick={(e) => pkg.name && e.button === 1 && window.open(`/packages/${encodeURIComponent(pkg.name)}`, '_blank')}
                                      >
                                        <td className="px-3 py-1.5 font-medium text-foreground">
                                          <span className="inline-flex items-center gap-2">
                                            {pkg.name || '—'}
                                            <RowVulnBadge vulns={pkgVulns} />
                                          </span>
                                        </td>
                                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{pkg.version || '—'}</td>
                                      </tr>
                                    );
                                  })}
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
  );
};

export default HostDetailPanel;
