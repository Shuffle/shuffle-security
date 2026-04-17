import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, Terminal, ShieldX, CheckCircle2, Maximize2 } from 'lucide-react';
import type { ActionDebugEntry } from '@/hooks/useHostActions';

/**
 * Shared "Run Action" popover used in BOTH the host list view (VulnAssetsPage)
 * and the standalone /monitors/:id page (MonitorDetailPage). Both pages must
 * look and behave identically — do not fork this.
 *
 * The `trigger` prop controls the visual trigger:
 *  - 'icon'    → ghost icon button (used in the dense list row actions)
 *  - 'button'  → outlined "Run Action" button (used in the detail page header)
 */

export interface HostActionPopoverHost {
  uuid: string;
  hostname: string;
  groupName: string;
  /** Raw response_actions value, e.g. "full" or "controlled" */
  responseActions?: string;
}

interface HostActionPopoverProps {
  host: HostActionPopoverHost;
  trigger?: 'icon' | 'button';
  /** From useHostActions */
  actionHistoryMap: Map<string, ActionDebugEntry[]>;
  actionExecuting: Set<string>;
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
}

const PREDEFINED_DISABLED = [
  { id: 'isolate_host', name: 'Isolate Host' },
  { id: 'disable_user', name: 'Disable User Accounts' },
  { id: 'restart_now', name: 'Restart Endpoint' },
];

export const HostActionPopover = ({
  host,
  trigger = 'icon',
  actionHistoryMap,
  actionExecuting,
  executeHostAction,
  abortHostAction,
  hydrateHost,
  getCommandHistory,
}: HostActionPopoverProps) => {
  const navigate = useNavigate();
  const [customAction, setCustomAction] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);

  const responseActionsRaw = host.responseActions;
  const responseActionsOn = !!responseActionsRaw;
  const responseActionsMode = responseActionsRaw
    ? (responseActionsRaw.toLowerCase().includes('full') ? 'full' : 'controlled')
    : null;

  // Disabled trigger when response actions aren't enabled
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

  const isFull = responseActionsMode === 'full';

  return (
    <Popover onOpenChange={(open) => { if (open) hydrateHost(host.uuid); }}>
      <PopoverTrigger asChild>
        {trigger === 'icon' ? (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
            {actionExecuting.has(host.uuid) ? (
              <Loader2 size={14} className="animate-spin text-primary" />
            ) : (
              <Play size={14} />
            )}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 h-8">
            {actionExecuting.has(host.uuid) ? (
              <Loader2 size={13} className="animate-spin text-primary" />
            ) : (
              <Terminal size={13} />
            )}
            Run Action
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side={trigger === 'button' ? 'bottom' : 'left'}
        collisionPadding={16}
        className="w-[34rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto p-0"
        onClick={e => e.stopPropagation()}
      >
        {(() => {
          const hostHistory = actionHistoryMap.get(host.uuid) || [];
          const actionDebug = hostHistory[hostHistory.length - 1];
          const isRunning = actionDebug && (actionDebug.status === 'sending' || actionDebug.status === 'polling');
          const finishedHistory = hostHistory.filter(e => e.status === 'success' || e.status === 'error');

          return (
            <div className="flex flex-col" style={{ maxHeight: 'min(70vh, 32rem)' }}>
              {/* Header */}
              <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
                <Terminal size={12} className="text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{host.hostname}</p>
                  <p className="text-[0.6rem] text-muted-foreground">{isFull ? 'Full control (RCE)' : 'Controlled'}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => navigate(`/monitors/${host.uuid}/terminal`, { state: { hostname: host.hostname, groupName: host.groupName, mode: responseActionsMode || 'controlled' } })}
                >
                  <Maximize2 size={10} />
                </Button>
                {isRunning && <Loader2 size={12} className="animate-spin text-primary shrink-0" />}
              </div>

              {/* Scrollable session log */}
              <div
                className="flex-1 overflow-y-auto min-h-0"
                ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
              >
                {finishedHistory.length === 0 && !isRunning && (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">No actions run yet</div>
                )}
                {finishedHistory.map((entry, i) => {
                  const isLatest = i === finishedHistory.length - 1;
                  return (
                    <div key={entry.entryId || i} className={`border-b border-border/50 last:border-b-0 ${isLatest ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}>
                      <div className={`px-3 py-1.5 flex items-center gap-2 ${isLatest ? 'bg-primary/10' : 'bg-muted/20'}`}>
                        <span className="text-[0.6rem] font-mono text-primary">$</span>
                        <span className="text-[0.65rem] font-mono font-medium text-foreground flex-1 truncate">{entry.actionName}</span>
                        {entry.status === 'success' ? (
                          <CheckCircle2 size={10} className="text-[hsl(var(--severity-low))] shrink-0" />
                        ) : (
                          <ShieldX size={10} className="text-destructive shrink-0" />
                        )}
                        <span className="text-[0.55rem] text-muted-foreground font-mono shrink-0">
                          {new Date(entry.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[0.55rem] text-muted-foreground font-mono shrink-0">
                          {entry.finishedAt ? `${Math.round((entry.finishedAt - entry.startedAt) / 1000)}s` : ''}
                        </span>
                      </div>
                      {(entry.actionOutput || entry.error) && (
                        <div className="px-3 py-1.5">
                          {entry.actionOutput && (
                            <pre className="text-[0.6rem] font-mono text-foreground/80 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">{entry.actionOutput}</pre>
                          )}
                          {entry.error && (
                            <pre className="text-[0.6rem] font-mono text-destructive whitespace-pre-wrap break-words">{entry.error}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isRunning && actionDebug && (
                  <div className="border-b border-border/50">
                    <div className="px-3 py-1.5 flex items-center gap-2 bg-muted/20">
                      <span className="text-[0.6rem] font-mono text-primary">$</span>
                      <span className="text-[0.65rem] font-mono font-medium text-foreground flex-1 truncate">{actionDebug.actionName}</span>
                      <Loader2 size={10} className="animate-spin text-primary shrink-0" />
                    </div>
                    <div className="px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[0.6rem] text-muted-foreground">
                        {actionDebug.status === 'sending' ? 'Sending…' : 'Waiting for result…'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-[0.6rem] text-destructive hover:text-destructive"
                        onClick={() => abortHostAction(host.uuid)}
                      >
                        Stop
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Predefined action chips */}
              <div className="px-3 py-2 flex flex-wrap gap-1 border-t border-border/50 shrink-0">
                <button
                  key="disable_rce"
                  className="px-2 py-1 text-[0.65rem] rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => executeHostAction('disable_rce', 'Disable RCE', host.hostname, host.groupName, host.uuid, true)}
                >
                  Disable RCE
                </button>
                {PREDEFINED_DISABLED.map(s => (
                  <button
                    key={s.id}
                    disabled
                    title="Not yet available on the endpoint"
                    className="px-2 py-1 text-[0.65rem] rounded-md border border-border text-muted-foreground opacity-50 cursor-not-allowed"
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Command input */}
              <div className="px-3 py-2 border-t border-border shrink-0">
                <div className="flex gap-1.5 items-center">
                  <span className="text-[0.65rem] font-mono text-primary shrink-0">$</span>
                  <Input
                    placeholder={isFull ? 'Type command…' : 'Custom action…'}
                    value={customAction}
                    onChange={e => setCustomAction(e.target.value)}
                    className="h-7 text-xs flex-1 font-mono"
                    ref={el => { if (el) requestAnimationFrame(() => el.focus()); }}
                    onKeyDown={e => {
                      const history = getCommandHistory(host.uuid);
                      if (e.key === 'Enter' && customAction.trim()) {
                        setHistoryIndex(-1);
                        executeHostAction(customAction.trim(), customAction.trim(), host.hostname, host.groupName, host.uuid);
                        setCustomAction('');
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHistoryIndex(prev => {
                          const next = Math.min(prev + 1, history.length - 1);
                          if (next >= 0) setCustomAction(history[next]);
                          return next;
                        });
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHistoryIndex(prev => {
                          const next = prev - 1;
                          if (next < 0) { setCustomAction(''); return -1; }
                          setCustomAction(history[next]);
                          return next;
                        });
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    disabled={!customAction.trim()}
                    onClick={() => {
                      if (customAction.trim()) {
                        executeHostAction(customAction.trim(), customAction.trim(), host.hostname, host.groupName, host.uuid);
                        setCustomAction('');
                      }
                    }}
                  >
                    <Play size={12} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </PopoverContent>
    </Popover>
  );
};

export default HostActionPopover;
