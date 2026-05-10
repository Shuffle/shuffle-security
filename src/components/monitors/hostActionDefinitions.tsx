/**
 * Single source of truth for the predefined RCE chips shown on every host
 * action surface (the inline popover on /monitors, the popover on the host
 * detail page, and the full-screen /monitors/:id/terminal page).
 *
 * If you want to add, rename, enable or disable a predefined action, do it
 * here — every UI location renders from this list so they stay in sync.
 */
import { useState } from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MousePointerClick } from 'lucide-react';

export const SYSTEM_USERS = new Set([
  'root', '_root', 'system', 'daemon', 'nobody', 'launchd', '_windowserver',
  '_spotlight', '_coreaudiod', '_locationd', '_softwareupdate', '_assetcache',
  '_networkd', '_timed', '_mdnsresponder', '_distnote', '_usbmuxd',
  'systemd', 'syslog', 'messagebus', 'dbus', 'sshd', 'nt authority\\system',
  'local service', 'network service',
]);

/** Best-effort active-user detection: top non-system user across process_list. */
export const getActiveUser = (host: unknown): string | null => {
  const v = (host as { process_list?: unknown } | null | undefined)?.process_list;
  if (!Array.isArray(v)) return null;
  const counts = new Map<string, number>();
  for (const p of v as Array<{ user?: unknown }>) {
    const u = String(p?.user || '').trim();
    if (!u) continue;
    if (SYSTEM_USERS.has(u.toLowerCase()) || u.startsWith('_')) continue;
    counts.set(u, (counts.get(u) || 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

export type AgentPrivilege = 'system' | 'user' | 'unknown';

/**
 * Infer whether the host monitor agent is running as SYSTEM (Windows) /
 * root (unix) by inspecting which processes it was able to enumerate user
 * info for.
 *
 * Heuristic: a SYSTEM-context agent can read `user` for processes owned by
 * NT AUTHORITY\SYSTEM, Local Service, Network Service (or root on unix). A
 * user-context agent typically gets empty `user` strings on those rows
 * (access denied) and can only attribute its own user's processes.
 *
 * Returns 'unknown' when there's no process_list to reason about.
 */
export const inferAgentPrivilege = (host: unknown): AgentPrivilege => {
  const v = (host as { process_list?: unknown } | null | undefined)?.process_list;
  if (!Array.isArray(v) || v.length === 0) return 'unknown';
  let systemRows = 0;
  for (const p of v as Array<{ user?: unknown }>) {
    const u = String(p?.user || '').trim().toLowerCase();
    if (!u) continue;
    if (
      u === 'system' ||
      u === 'root' ||
      u === 'nt authority\\system' ||
      u === 'local service' ||
      u === 'nt authority\\local service' ||
      u === 'network service' ||
      u === 'nt authority\\network service'
    ) {
      systemRows++;
    }
  }
  return systemRows > 0 ? 'system' : 'user';
};

export type PredefinedActionVariant = 'destructive' | 'normal' | 'disabled';

export interface PredefinedHostAction {
  id: string;
  name: string;
  variant: PredefinedActionVariant;
  /** When true the chip needs an active user resolved via getActiveUser */
  requiresActiveUser?: boolean;
  /** When true the action only works if the agent is running as SYSTEM/root */
  requiresSystem?: boolean;
  disabledReason?: string;
}

/**
 * The ordered, canonical list of predefined RCE chips. Order = display order.
 * `disabled` variant chips are always rendered greyed out.
 */
export const PREDEFINED_HOST_ACTIONS: PredefinedHostAction[] = [
  { id: 'disable_rce', name: 'Disable RCE', variant: 'destructive', requiresSystem: true },
  { id: 'screenshot', name: 'Screenshot', variant: 'normal' },
  { id: 'isolate_host', name: 'Isolate Host', variant: 'normal', requiresSystem: true },
  { id: 'unisolate_host', name: 'Unisolate', variant: 'normal', requiresSystem: true },
  { id: 'disable_user', name: 'Disable User Accounts', variant: 'disabled', disabledReason: 'Not yet available on the endpoint' },
  { id: 'restart_now', name: 'Restart Endpoint', variant: 'disabled', disabledReason: 'Not yet available on the endpoint' },
];

interface HostActionChipsProps {
  activeUser: string | null;
  /**
   * Called when the user clicks an enabled chip. `actionId` is the bare id
   * (no `script:` prefix — caller adds that via `isPredefined: true`).
   * For chips that require an active user, `actionId` already includes the
   * user (e.g. "screenshot frikky"). `displayName` is what should appear in
   * the session log.
   */
  onRun: (args: { actionId: string; displayName: string; isPredefined: boolean }) => void;
  /** Optional per-id override — return true to suppress the default onRun. */
  customHandler?: (id: string) => boolean;
  /** Disable every chip (e.g. host couldn't be resolved). */
  allDisabled?: boolean;
  /** Compact = popover, comfortable = full-page terminal */
  size?: 'compact' | 'comfortable';
  /** Extra reason rendered as tooltip when allDisabled is true */
  allDisabledReason?: string;
  /**
   * Inferred privilege of the host monitor agent. When 'user', any action
   * marked `requiresSystem` is rendered disabled with an explanatory tooltip
   * (Windows: needs SYSTEM, unix: needs root). 'unknown' leaves them enabled
   * since we can't tell.
   */
  agentPrivilege?: AgentPrivilege;
  /**
   * Host architecture/OS string (e.g. "windows", "linux", "darwin"). When it
   * indicates Windows, an extra "Remote Control" chip is rendered next to
   * the Screenshot chip — this is a simple UI for issuing
   * `script:remote_control { ... }` commands (mouse.move/click/drag,
   * keyboard.press, system.wait) and is Windows-only for now.
   */
  arch?: string;
}

const isWindowsArch = (arch?: string) => /win/i.test(String(arch || ''));

type RemoteOp = 'mouse.move' | 'mouse.click' | 'mouse.drag' | 'keyboard.press' | 'system.wait';

interface RemoteControlChipProps {
  size: 'compact' | 'comfortable';
  disabled: boolean;
  onSend: (json: string) => void;
}

const RemoteControlChip = ({ size, disabled, onSend }: RemoteControlChipProps) => {
  const sizing = size === 'compact'
    ? 'px-2 py-1 text-[0.65rem]'
    : 'px-3 py-1.5 text-xs';
  const className =
    sizing +
    ' rounded-md border transition-colors inline-flex items-center gap-1 ' +
    (disabled
      ? 'border-border text-muted-foreground opacity-50 cursor-not-allowed'
      : 'border-border text-foreground hover:bg-muted/50');

  const [op, setOp] = useState<RemoteOp>('mouse.click');
  const [x, setX] = useState('600');
  const [y, setY] = useState('400');
  const [toX, setToX] = useState('800');
  const [toY, setToY] = useState('500');
  const [button, setButton] = useState<'left' | 'right' | 'middle'>('left');
  const [delayMs, setDelayMs] = useState('100');
  const [keyCode, setKeyCode] = useState('13');
  const [waitMs, setWaitMs] = useState('250');

  const buildPayload = () => {
    let params: Record<string, unknown> = {};
    if (op === 'mouse.move') {
      params = { x: Number(x), y: Number(y) };
    } else if (op === 'mouse.click') {
      params = { x: Number(x), y: Number(y), button, delay_ms: Number(delayMs) };
    } else if (op === 'mouse.drag') {
      params = { from_x: Number(x), from_y: Number(y), to_x: Number(toX), to_y: Number(toY), button };
    } else if (op === 'keyboard.press') {
      params = { key: Number(keyCode) };
    } else if (op === 'system.wait') {
      params = { ms: Number(waitMs) };
    }
    return JSON.stringify({ actions: [{ op, params }] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button disabled={disabled} className={className}>
          <MousePointerClick size={size === 'compact' ? 10 : 12} />
          Remote Control
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-3 z-[9999] space-y-2"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <label className="text-[0.65rem] font-mono text-muted-foreground">Operation</label>
          <select
            value={op}
            onChange={e => setOp(e.target.value as RemoteOp)}
            className="w-full mt-0.5 h-7 text-xs rounded-md border border-border bg-background px-2"
          >
            <option value="mouse.move">mouse.move</option>
            <option value="mouse.click">mouse.click</option>
            <option value="mouse.drag">mouse.drag</option>
            <option value="keyboard.press">keyboard.press</option>
            <option value="system.wait">system.wait</option>
          </select>
        </div>

        {(op === 'mouse.move' || op === 'mouse.click' || op === 'mouse.drag') && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[0.65rem] font-mono text-muted-foreground">{op === 'mouse.drag' ? 'from_x' : 'x'}</label>
              <Input value={x} onChange={e => setX(e.target.value)} className="h-7 text-xs font-mono" />
            </div>
            <div>
              <label className="text-[0.65rem] font-mono text-muted-foreground">{op === 'mouse.drag' ? 'from_y' : 'y'}</label>
              <Input value={y} onChange={e => setY(e.target.value)} className="h-7 text-xs font-mono" />
            </div>
          </div>
        )}

        {op === 'mouse.drag' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[0.65rem] font-mono text-muted-foreground">to_x</label>
              <Input value={toX} onChange={e => setToX(e.target.value)} className="h-7 text-xs font-mono" />
            </div>
            <div>
              <label className="text-[0.65rem] font-mono text-muted-foreground">to_y</label>
              <Input value={toY} onChange={e => setToY(e.target.value)} className="h-7 text-xs font-mono" />
            </div>
          </div>
        )}

        {(op === 'mouse.click' || op === 'mouse.drag') && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[0.65rem] font-mono text-muted-foreground">button</label>
              <select
                value={button}
                onChange={e => setButton(e.target.value as 'left' | 'right' | 'middle')}
                className="w-full mt-0.5 h-7 text-xs rounded-md border border-border bg-background px-2"
              >
                <option value="left">left</option>
                <option value="right">right</option>
                <option value="middle">middle</option>
              </select>
            </div>
            {op === 'mouse.click' && (
              <div>
                <label className="text-[0.65rem] font-mono text-muted-foreground">delay_ms</label>
                <Input value={delayMs} onChange={e => setDelayMs(e.target.value)} className="h-7 text-xs font-mono" />
              </div>
            )}
          </div>
        )}

        {op === 'keyboard.press' && (
          <div>
            <label className="text-[0.65rem] font-mono text-muted-foreground">key (virtual key code)</label>
            <Input value={keyCode} onChange={e => setKeyCode(e.target.value)} className="h-7 text-xs font-mono" />
          </div>
        )}

        {op === 'system.wait' && (
          <div>
            <label className="text-[0.65rem] font-mono text-muted-foreground">ms</label>
            <Input value={waitMs} onChange={e => setWaitMs(e.target.value)} className="h-7 text-xs font-mono" />
          </div>
        )}

        <pre className="text-[0.6rem] font-mono text-muted-foreground bg-muted/30 rounded p-1.5 max-h-20 overflow-auto whitespace-pre-wrap break-all">
          {buildPayload()}
        </pre>

        <Button
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => onSend(buildPayload())}
        >
          Send
        </Button>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Renders the canonical predefined-action chip row. Used by:
 *  - MonitorHostTable inline popover
 *  - HostActionPopover (host detail page)
 *  - HostTerminalPage (full screen)
 */
export const HostActionChips = ({
  activeUser,
  onRun,
  customHandler,
  allDisabled = false,
  size = 'compact',
  allDisabledReason,
  agentPrivilege = 'unknown',
  arch,
}: HostActionChipsProps) => {
  const sizing = size === 'compact'
    ? 'px-2 py-1 text-[0.65rem]'
    : 'px-3 py-1.5 text-xs';

  const showRemoteControl = isWindowsArch(arch);

  return (
    <div className={`flex flex-wrap ${size === 'compact' ? 'gap-1' : 'gap-1.5'}`}>
      {PREDEFINED_HOST_ACTIONS.map(a => {
        const needsUser = !!a.requiresActiveUser;
        const userMissing = needsUser && !activeUser;
        const isPermanentlyDisabled = a.variant === 'disabled';
        const needsSystem = !!a.requiresSystem && agentPrivilege === 'user';
        const isDisabled = isPermanentlyDisabled || allDisabled || userMissing || needsSystem;

        let className = sizing + ' rounded-md border transition-colors ';
        if (isDisabled) {
          className += 'border-border text-muted-foreground opacity-50 cursor-not-allowed';
        } else if (a.variant === 'destructive') {
          className += 'border-destructive/40 text-destructive hover:bg-destructive/10';
        } else {
          className += 'border-border text-foreground hover:bg-muted/50';
        }

        const label = needsUser && activeUser
          ? `${a.name} (${activeUser})`
          : a.name;

        const tooltip = isPermanentlyDisabled
          ? a.disabledReason
          : needsSystem
            ? 'Requires the host monitor to run as SYSTEM (Windows) or root. Currently running as a regular user.'
            : userMissing
              ? 'No active user detected on this host'
              : allDisabled
                ? allDisabledReason
                : undefined;

        const handleClick = () => {
          if (isDisabled) return;
          if (customHandler && customHandler(a.id)) return;
          const actionId = a.id === 'screenshot'
            ? `${a.id} ${activeUser || 'TEST'}`
            : (needsUser && activeUser ? `${a.id} ${activeUser}` : a.id);
          const displayName = needsUser && activeUser ? `Screenshot (${activeUser})` : a.name;
          onRun({ actionId, displayName, isPredefined: true });
        };

        const button = (
          <button
            key={a.id}
            disabled={isDisabled}
            className={className}
            onClick={handleClick}
          >
            {label}
          </button>
        );

        const wrapped = tooltip ? (
          <TooltipProvider key={a.id} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild><span>{button}</span></TooltipTrigger>
              <TooltipContent className="text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : button;

        // Inject the Remote Control chip immediately after Screenshot on Windows
        if (showRemoteControl && a.id === 'screenshot') {
          return (
            <span key={a.id} className="contents">
              {wrapped}
              <RemoteControlChip
                size={size}
                disabled={allDisabled}
                onSend={(json) => onRun({
                  actionId: `remote_control ${json}`,
                  displayName: 'Remote Control',
                  isPredefined: true,
                })}
              />
            </span>
          );
        }
        return wrapped;
      })}
    </div>
  );
};

