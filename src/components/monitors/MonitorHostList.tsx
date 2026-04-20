/**
 * Shared "Host Monitors" list — same row UI used on /monitors. Each row shows
 * the OS icon, hostname, posture indicator dots, group, and last check-in.
 * Clicking a row expands the shared HostDetailPanel inline.
 *
 * This is the lightweight, read-only flavour (no terminal/popover/actions yet).
 * /monitors uses its own richer list with action buttons; this component is
 * for surfaces that just want to render the same look (e.g. /assets).
 */
import { useState } from 'react';
import { ChevronRight, HardDrive, Lock, Package, FileCode, Zap, Send, Laptop } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HostDetailPanel } from './HostDetailPanel';

interface MonitorHost {
  uuid?: string;
  hostname?: string;
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

interface MonitorHostListProps {
  hosts: MonitorHost[];
}

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

const triState = (v: unknown): 'on' | 'off' | 'empty' => {
  if (v === true || v === 'true' || v === 'TRUE') return 'on';
  if (v === false || v === 'false' || v === 'FALSE' || v === '0' || v === 0 || v === 'no' || v === 'off') return 'off';
  return 'empty';
};

const parseResponseActionsState = (value: unknown): { enabled: boolean; mode: 'full' | 'controlled' | null } => {
  const raw = String(value ?? '').toLowerCase().trim();
  const enabled = value !== undefined && value !== null && raw !== '' && raw !== 'false' && raw !== '0' && raw !== 'no' && raw !== 'off';
  return { enabled, mode: enabled ? (raw.includes('full') ? 'full' : 'controlled') : null };
};

const formatCheckin = (ts?: number): string => {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

export const MonitorHostList = ({ hosts }: MonitorHostListProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card">
      {/* Header row */}
      <div className="grid grid-cols-[2rem_1.5fr_2rem_2rem_2rem_2rem_2rem_2rem_0.7fr_0.8fr] gap-2 px-5 py-2 border-b border-border bg-muted/20 items-center">
        <span className="text-xs font-semibold text-muted-foreground">OS</span>
        <span className="text-xs font-semibold text-muted-foreground">Hostname</span>
        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><HardDrive size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent><p className="text-xs">HD Encrypted</p></TooltipContent></Tooltip></TooltipProvider>
        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><Lock size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent><p className="text-xs">Screenlock</p></TooltipContent></Tooltip></TooltipProvider>
        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><Package size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent><p className="text-xs">Installed Software</p></TooltipContent></Tooltip></TooltipProvider>
        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><FileCode size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent><p className="text-xs">Code Package Scanner</p></TooltipContent></Tooltip></TooltipProvider>
        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><Zap size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent><p className="text-xs">Response Actions</p></TooltipContent></Tooltip></TooltipProvider>
        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className="flex justify-center"><Send size={13} className="text-muted-foreground" /></span></TooltipTrigger><TooltipContent><p className="text-xs">Active Monitoring</p></TooltipContent></Tooltip></TooltipProvider>
        <span className="text-xs font-semibold text-muted-foreground">Group</span>
        <span className="text-xs font-semibold text-muted-foreground">Last Check-in</span>
      </div>

      {hosts.map((host, idx) => {
        const id = host.uuid || host.hostname || String(idx);
        const isExpanded = expanded.has(id);
        const hdState = triState(host.hd_encrypted);
        const screenlockState = triState(host.automatic_screen_lock_enabled);
        const softwareCount = Array.isArray(host.installed_software) ? host.installed_software.length : 0;
        const codeScanCount = Array.isArray(host.code_scanner) ? host.code_scanner.length : 0;
        const ra = parseResponseActionsState(host.response_actions);
        const lfOn = !!host.log_forwarding;

        return (
          <div key={id}>
            <div
              className="grid grid-cols-[2rem_1.5fr_2rem_2rem_2rem_2rem_2rem_2rem_0.7fr_0.8fr] gap-2 px-5 py-3 border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors items-center cursor-pointer"
              onClick={() => toggle(id)}
            >
              <div className="flex items-center justify-center">
                <OsIcon os={host.os} size={14} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight size={14} className={`text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <span className="text-sm font-medium text-foreground truncate">{host.hostname || '—'}</span>
                </div>
                {host.serial && (() => {
                  const raw = host.serial.trim();
                  const snMatch = raw.match(/Serial\s*Number\s*\(?\w*\)?\s*:\s*(\S+)/i);
                  const display = snMatch ? snMatch[1] : raw.split('\n')[0].trim().substring(0, 24);
                  return (
                    <span className="text-[0.65rem] text-muted-foreground/70 font-mono truncate ml-[30px] cursor-help" title={raw}>
                      SN: {display}
                    </span>
                  );
                })()}
              </div>
              <CheckDot on={hdState === 'on'} state={hdState} tip={`hd_encrypted: ${String(host.hd_encrypted ?? '(unset)')}`} />
              <CheckDot on={screenlockState === 'on'} state={screenlockState} tip={`screenlock: ${String(host.automatic_screen_lock_enabled ?? '(unset)')}`} />
              <CheckDot on={softwareCount > 0} tip={`installed_software: ${softwareCount} ${softwareCount === 1 ? 'item' : 'items'}`} />
              <CheckDot on={codeScanCount > 0} tip={`code_scanner: ${codeScanCount} ${codeScanCount === 1 ? 'project' : 'projects'}`} />
              <CheckDot
                on={ra.enabled}
                tip={`response_actions: ${String(host.response_actions ?? '(unset)')}`}
                color={ra.mode === 'full' ? 'bg-[hsl(var(--severity-high))]' : 'bg-[hsl(var(--severity-low))]'}
              />
              <CheckDot on={lfOn} tip={`log_forwarding: ${host.log_forwarding || '(unset)'}`} />
              <span className="text-xs text-muted-foreground truncate">{host.groupName || '—'}</span>
              <span className="text-xs text-muted-foreground">{formatCheckin(host.checkin)}</span>
            </div>
            {isExpanded && <HostDetailPanel host={host as any} variant="inline" />}
          </div>
        );
      })}
    </div>
  );
};

export default MonitorHostList;
