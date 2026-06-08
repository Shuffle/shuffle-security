import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, Terminal, Maximize2 } from 'lucide-react';
import type { ActionDebugEntry } from '@/hooks/useHostActions';
import { getActiveUser, inferAgentPrivilege } from './hostActionDefinitions';
import { hostUrlSegment } from '@/utils/hostUrlSegment';
import { HostTerminalView } from './HostTerminalView';

/**
 * Mini-popover wrapper around the shared <HostTerminalView size="compact" />.
 * The terminal body is the EXACT SAME COMPONENT used by the full
 * /monitors/:id/terminal page — only sizing / outer chrome differ.
 */

export interface HostActionPopoverHost {
  uuid: string;
  hostname: string;
  groupName: string;
  arch?: string;
  os?: string;
  responseActions?: string;
  raw?: unknown;
}

interface HostActionPopoverProps {
  host: HostActionPopoverHost;
  trigger?: 'icon' | 'button';
  // Hook results from useHostActions (caller owns the instance so it can refetch on completion)
  actionHistoryMap: Map<string, ActionDebugEntry[]>;
  actionExecuting: Set<string>;
  loadingEntries?: Set<string>;
  executeHostAction: (
    actionId: string,
    actionName: string,
    hostname: string,
    groupName: string,
    hostUuid: string,
    isPredefined?: boolean,
    skipConfirm?: boolean,
  ) => Promise<void> | void;
  abortHostAction: (hostUuid: string) => void;
  hydrateHost: (hostUuid: string) => void;
  getCommandHistory: (hostUuid: string) => string[];
  removeHistoryEntry?: (hostUuid: string, entryId: string) => void;
  fetchEntryResult?: (hostUuid: string, entry: ActionDebugEntry) => Promise<void> | void;
  // Optional fields (forwarded as-is for the shared view to consume)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingDisableRce?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPendingDisableRce?: any;
  confirmDisableRce?: () => void;
}

export const HostActionPopover = ({
  host,
  trigger = 'icon',
  ...rest
}: HostActionPopoverProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const responseActionsRaw = host.responseActions;
  const rawLower = String(responseActionsRaw ?? '').toLowerCase().trim();
  const responseActionsOn = !!responseActionsRaw && rawLower !== 'false' && rawLower !== '0' && rawLower !== 'no' && rawLower !== 'off';
  const responseActionsMode: 'full' | 'controlled' | null = responseActionsOn
    ? (rawLower.includes('full') ? 'full' : 'controlled')
    : null;
  const isFull = responseActionsMode === 'full';

  // Disabled state when response actions aren't enabled at all.
  if (!responseActionsOn) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            {trigger === 'icon' ? (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground opacity-40 cursor-not-allowed" disabled>
                <Play size={14} />
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 opacity-40 cursor-not-allowed" disabled>
                <Terminal size={13} /> Run Action
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-xs">Response Actions not enabled on this host</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detail-page header trigger: bypass popover entirely → full terminal page.
  if (trigger === 'button') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8"
        onClick={() => navigate(
          `/monitors/${encodeURIComponent(hostUrlSegment(host))}/terminal`,
          { state: { hostname: host.hostname, groupName: host.groupName, mode: responseActionsMode || 'controlled' } },
        )}
      >
        {rest.actionExecuting.has(host.uuid) ? (
          <Loader2 size={13} className="animate-spin text-primary" />
        ) : (
          <Terminal size={13} />
        )}
        Run Action
      </Button>
    );
  }

  const goFull = () => navigate(
    `/monitors/${encodeURIComponent(hostUrlSegment(host))}/terminal`,
    { state: { hostname: host.hostname, groupName: host.groupName, mode: responseActionsMode || 'controlled' } },
  );

  // Build the partial hostActions shape the shared view expects.
  const hostActions = {
    actionHistoryMap: rest.actionHistoryMap,
    actionExecuting: rest.actionExecuting,
    loadingEntries: rest.loadingEntries ?? new Set<string>(),
    pendingDisableRce: rest.pendingDisableRce ?? null,
    setPendingDisableRce: rest.setPendingDisableRce ?? (() => {}),
    confirmDisableRce: rest.confirmDisableRce ?? (() => {}),
    executeHostAction: rest.executeHostAction,
    abortHostAction: rest.abortHostAction,
    hydrateHost: rest.hydrateHost,
    getCommandHistory: rest.getCommandHistory,
    removeHistoryEntry: rest.removeHistoryEntry ?? (() => {}),
    fetchEntryResult: rest.fetchEntryResult ?? (() => Promise.resolve()),
  } as unknown as Parameters<typeof HostTerminalView>[0]['hostActions'];

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) rest.hydrateHost(host.uuid); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
          {rest.actionExecuting.has(host.uuid) ? (
            <Loader2 size={14} className="animate-spin text-primary" />
          ) : (
            <Play size={14} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="left"
        collisionPadding={16}
        className="w-[34rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ maxHeight: 'min(70vh, 32rem)' }} className="flex flex-col">
          <HostTerminalView
            host={{
              uuid: host.uuid,
              hostname: host.hostname,
              groupName: host.groupName,
              arch: host.arch,
              os: host.os,
              raw: host.raw,
              responseActions: host.responseActions,
              activeUser: getActiveUser(host.raw),
              agentPrivilege: inferAgentPrivilege(host.raw),
            }}
            size="compact"
            hostActions={hostActions}
            showInlineHeader
            inlineHeaderAction={
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={goFull}>
                <Maximize2 size={10} />
              </Button>
            }
            inputPlaceholder={isFull ? 'Type command…' : 'Custom action…'}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default HostActionPopover;
