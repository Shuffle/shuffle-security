/**
 * Single source of truth for the predefined RCE chips shown on every host
 * action surface (the inline popover on /monitors, the popover on the host
 * detail page, and the full-screen /monitors/:id/terminal page).
 *
 * If you want to add, rename, enable or disable a predefined action, do it
 * here — every UI location renders from this list so they stay in sync.
 */
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

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
}

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
}: HostActionChipsProps) => {
  const sizing = size === 'compact'
    ? 'px-2 py-1 text-[0.65rem]'
    : 'px-3 py-1.5 text-xs';

  return (
    <div className={`flex flex-wrap ${size === 'compact' ? 'gap-1' : 'gap-1.5'}`}>
      {PREDEFINED_HOST_ACTIONS.map(a => {
        const needsUser = !!a.requiresActiveUser;
        const userMissing = needsUser && !activeUser;
        const isPermanentlyDisabled = a.variant === 'disabled';
        const isDisabled = isPermanentlyDisabled || allDisabled || userMissing;

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
          : userMissing
            ? 'No active user detected on this host'
            : allDisabled
              ? allDisabledReason
              : undefined;

        const handleClick = () => {
          if (isDisabled) return;
          if (customHandler && customHandler(a.id)) return;
          // Build the canonical actionId. The caller always sends with
          // isPredefined=true so the executor prepends "script:".
          const actionId = needsUser && activeUser ? `${a.id} ${activeUser}` : a.id;
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

        if (tooltip) {
          return (
            <TooltipProvider key={a.id} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><span>{button}</span></TooltipTrigger>
                <TooltipContent className="text-xs">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return button;
      })}
    </div>
  );
};
