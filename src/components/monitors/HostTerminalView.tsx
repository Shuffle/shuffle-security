/**
 * Shared terminal surface used by BOTH the popover (HostActionPopover, size="compact")
 * and the full /monitors/:id/terminal page (HostTerminalPage, size="comfortable").
 *
 * They are the EXACT SAME COMPONENT — only sizing tokens and a few outer chrome
 * choices differ. Do not fork the body. If a feature lands, it lands here so the
 * popover and the page never drift again.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  ShieldX,
  Terminal,
  X,
} from 'lucide-react';
import {
  HostActionChips,
  type AgentPrivilege,
} from './hostActionDefinitions';
import { ActionOutputView } from './ActionOutputView';
import {
  type ActionDebugEntry,
  type useHostActions,
  isOutputTruncated,
} from '@/hooks/useHostActions';

export type HostTerminalSize = 'compact' | 'comfortable';

export interface HostTerminalViewHost {
  uuid: string;
  hostname: string;
  groupName: string;
  arch?: string;
  os?: string;
  raw?: unknown;
  responseActions?: string;
  activeUser?: string | null;
  agentPrivilege?: AgentPrivilege;
}

interface HostTerminalViewProps {
  host: HostTerminalViewHost;
  size: HostTerminalSize;
  hostActions: ReturnType<typeof useHostActions>;
  /** Inline header at the top of the view — popover renders this; page hides it. */
  showInlineHeader?: boolean;
  /** Action rendered inside the inline header (e.g. maximize button). */
  inlineHeaderAction?: React.ReactNode;
  /** Banner above the session log (e.g. resolution error). */
  topBanner?: React.ReactNode;
  /** Empty-state node (replaces "No commands run yet" message when provided). */
  emptyState?: React.ReactNode;
  /** Disable all run buttons (e.g. host couldn't be resolved). */
  disabled?: boolean;
  disabledReason?: string;
  /** Hide the predefined chips block. */
  hideChips?: boolean;
  /** Hide the command input row. */
  hideInput?: boolean;
  /** Disable the free-form command input (chips remain). */
  inputDisabled?: boolean;
  inputPlaceholder?: string;
  /** Optional override for chip clicks (used by demo mode). */
  customChipHandler?: (id: string) => boolean;
  /** Optional footer note rendered below the input. */
  footerNote?: string;
  /** Constrain max height of the scrollable log. Popover sets a CSS clamp; page lets it flex. */
  scrollMaxHeight?: string;
  className?: string;
}

const SIZES = {
  compact: {
    rowPad: 'px-3 py-1.5',
    headerPad: 'px-3 py-2',
    chipsPad: 'px-3 py-2',
    inputPad: 'px-3 py-2',
    rowText: 'text-[0.65rem]',
    metaText: 'text-[0.55rem]',
    outputClass: 'text-[0.6rem] font-mono text-foreground/80 whitespace-pre-wrap break-words max-h-28 overflow-y-auto',
    errorClass: 'text-[0.6rem] font-mono text-destructive whitespace-pre-wrap break-words max-h-28 overflow-y-auto',
    inputH: 'h-7',
    inputText: 'text-xs',
    promptText: 'text-[0.65rem]',
    sendBtn: 'h-7 w-7',
    sendIcon: 12,
    statusIcon: 10,
    chevronIcon: 12,
    headerIcon: 12,
    chipSize: 'compact' as const,
    stopBtn: 'h-5 px-2 text-[0.6rem]',
  },
  comfortable: {
    rowPad: 'px-6 py-2.5',
    headerPad: 'px-6 py-3',
    chipsPad: 'px-6 py-3',
    inputPad: 'px-6 py-3',
    rowText: 'text-sm',
    metaText: 'text-xs',
    outputClass: 'text-sm font-mono text-foreground/80 whitespace-pre-wrap break-words',
    errorClass: 'text-sm font-mono text-destructive whitespace-pre-wrap break-words',
    inputH: 'h-9',
    inputText: 'text-sm',
    promptText: 'text-sm',
    sendBtn: 'h-9 w-9',
    sendIcon: 14,
    statusIcon: 14,
    chevronIcon: 14,
    headerIcon: 14,
    chipSize: 'comfortable' as const,
    stopBtn: 'h-6 px-2 text-xs',
  },
};

export const HostTerminalView = ({
  host,
  size,
  hostActions,
  showInlineHeader = false,
  inlineHeaderAction,
  topBanner,
  emptyState,
  disabled = false,
  disabledReason,
  hideChips = false,
  hideInput = false,
  inputDisabled = false,
  inputPlaceholder,
  customChipHandler,
  footerNote,
  scrollMaxHeight,
  className,
}: HostTerminalViewProps) => {
  const S = SIZES[size];
  const {
    actionHistoryMap,
    loadingEntries,
    executeHostAction,
    abortHostAction,
    hydrateHost,
    getCommandHistory,
    removeHistoryEntry,
    fetchEntryResult,
  } = hostActions;

  const [customAction, setCustomAction] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const autoSideloadedRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);

  // Hydrate this host's stored history on first mount.
  useEffect(() => {
    if (hydratedRef.current || !host.uuid) return;
    hydratedRef.current = true;
    hydrateHost(host.uuid);
  }, [host.uuid, hydrateHost]);

  const history = actionHistoryMap.get(host.uuid) || [];
  const finishedHistory = history.filter(e => e.status === 'success' || e.status === 'error');
  const runningEntries = history.filter(e => e.status === 'sending' || e.status === 'polling');

  // Keep the log auto-scrolled to the latest entry.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history.length]);

  // Focus the command input on mount (and again when the tab regains focus).
  useEffect(() => {
    if (hideInput || inputDisabled) return;
    inputRef.current?.focus();
    const onVis = () => {
      if (document.visibilityState === 'visible') setTimeout(() => inputRef.current?.focus(), 50);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [hideInput, inputDisabled]);

  const toggleExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const n = new Set(prev);
      if (n.has(entryId)) n.delete(entryId); else n.add(entryId);
      return n;
    });
  };

  const handleSubmit = () => {
    const text = customAction.trim();
    if (!text || disabled || inputDisabled) return;
    executeHostAction(text, text, host.hostname, host.groupName, host.uuid);
    setCustomAction('');
    setHistoryIndex(-1);
  };

  const cmdHistory = () =>
    [...history].reverse().map(e => e.commandText || e.actionName).filter(Boolean);

  const renderRow = (entry: ActionDebugEntry, idx: number, lastFinishedIdx: number) => {
    const isRunning = entry.status === 'sending' || entry.status === 'polling';
    const isLatest = !isRunning && idx === lastFinishedIdx;
    const hasOutput = !!(entry.actionOutput || entry.error);
    const isExpanded = expandedEntries.has(entry.entryId);
    const isLoading = loadingEntries.has(entry.entryId);
    const canReload = !isRunning && !!entry.executionId && !!entry.authorization;
    const truncated = isOutputTruncated(entry.actionOutput) || isOutputTruncated(entry.error);

    return (
      <div
        key={entry.entryId}
        className={`border-b border-border/50 last:border-b-0 ${isLatest ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}
      >
        <button
          type="button"
          className={`w-full text-left ${S.rowPad} flex items-center gap-2 transition-colors hover:bg-muted/30 ${isLatest ? 'bg-primary/10' : isRunning ? 'bg-muted/30' : 'bg-muted/10'}`}
          onClick={() => {
            if (isRunning) return;
            if (hasOutput) {
              const willExpand = !isExpanded;
              toggleExpanded(entry.entryId);
              if (willExpand && truncated && canReload && !autoSideloadedRef.current.has(entry.entryId)) {
                autoSideloadedRef.current.add(entry.entryId);
                fetchEntryResult(host.uuid, entry);
              }
            } else if (canReload) {
              fetchEntryResult(host.uuid, entry);
            }
          }}
        >
          {!isRunning && (hasOutput || canReload) && (
            <span className="shrink-0 text-muted-foreground">
              {isExpanded && hasOutput ? <ChevronDown size={S.chevronIcon} /> : <ChevronRight size={S.chevronIcon} />}
            </span>
          )}
          <span className={`${S.rowText} font-mono text-primary`}>$</span>
          <span className={`${S.rowText} font-mono font-medium text-foreground flex-1 truncate`}>{entry.actionName}</span>
          {isLoading || isRunning ? (
            <Loader2 size={S.statusIcon} className="animate-spin text-primary shrink-0" />
          ) : entry.status === 'success' ? (
            <CheckCircle2 size={S.statusIcon} className="text-[hsl(var(--severity-low))] shrink-0" />
          ) : (
            <ShieldX size={S.statusIcon} className="text-destructive shrink-0" />
          )}
          {(!hasOutput || truncated) && canReload && !isLoading && (
            <RefreshCw size={S.statusIcon} className={truncated ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
          )}
          <span className={`${S.metaText} text-muted-foreground font-mono shrink-0`}>
            {new Date(entry.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {entry.finishedAt && (
            <span className={`${S.metaText} text-muted-foreground font-mono shrink-0`}>
              {Math.round((entry.finishedAt - entry.startedAt) / 1000)}s
            </span>
          )}
          {isRunning ? (
            <Button
              variant="ghost"
              size="sm"
              className={`${S.stopBtn} text-destructive hover:text-destructive`}
              onClick={(e) => { e.stopPropagation(); abortHostAction(host.uuid); }}
            >
              Stop
            </Button>
          ) : (
            <button
              type="button"
              className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors p-0.5"
              onClick={(e) => { e.stopPropagation(); removeHistoryEntry(host.uuid, entry.entryId); }}
              title="Remove from history"
            >
              <X size={S.chevronIcon} />
            </button>
          )}
        </button>
        {isRunning && (
          <div className={`${S.rowPad}`}>
            <span className={`${S.metaText} text-muted-foreground`}>
              {entry.status === 'sending' ? 'Sending…' : 'Waiting for result…'}
            </span>
          </div>
        )}
        {isExpanded && hasOutput && (
          <div className={`${S.rowPad}`}>
            {entry.actionOutput && (
              <ActionOutputView output={entry.actionOutput} className={S.outputClass} />
            )}
            {entry.error && (
              <pre className={S.errorClass}>{entry.error}</pre>
            )}
          </div>
        )}
      </div>
    );
  };

  const lastFinishedIdx = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const s = history[i].status;
      if (s === 'success' || s === 'error') return i;
    }
    return -1;
  })();

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {showInlineHeader && (
        <div className={`${S.headerPad} border-b border-border flex items-center gap-2 shrink-0`}>
          <Terminal size={S.headerIcon} className="text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className={`${S.rowText} font-semibold text-foreground truncate`}>{host.hostname}</p>
            {host.responseActions && (
              <p className={`${S.metaText} text-muted-foreground`}>
                {String(host.responseActions).toLowerCase().includes('full') ? 'Full control (RCE)' : 'Controlled'}
              </p>
            )}
          </div>
          {runningEntries.length > 0 && (
            <Loader2 size={S.statusIcon} className="animate-spin text-primary shrink-0" />
          )}
          {inlineHeaderAction}
        </div>
      )}

      {topBanner}

      <div
        className="flex-1 overflow-y-auto min-h-0"
        ref={scrollRef}
        style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
      >
        {history.length === 0 && (
          emptyState ?? (
            <div className={`${S.rowPad} text-center text-muted-foreground ${S.rowText}`}>
              No actions run yet
            </div>
          )
        )}
        {history.map((e, i) => renderRow(e, i, lastFinishedIdx))}
      </div>

      {!hideChips && (
        <div className={`${S.chipsPad} border-t border-border/50 shrink-0`}>
          <HostActionChips
            activeUser={host.activeUser ?? null}
            agentPrivilege={host.agentPrivilege ?? 'unknown'}
            arch={`${host.os || ''} ${host.arch || ''} ${host.hostname || ''}`}
            size={S.chipSize}
            allDisabled={disabled}
            allDisabledReason={disabledReason}
            customHandler={customChipHandler}
            onRun={({ actionId, displayName }) =>
              executeHostAction(actionId, displayName, host.hostname, host.groupName, host.uuid, true)
            }
          />
        </div>
      )}

      {!hideInput && (
        <div className={`${S.inputPad} border-t border-border shrink-0 bg-background`}>
          <div className="flex gap-1.5 items-center">
            <span className={`${S.promptText} font-mono text-primary shrink-0`}>$</span>
            <Input
              placeholder={inputPlaceholder ?? 'Type command…'}
              value={customAction}
              onChange={e => setCustomAction(e.target.value)}
              className={`${S.inputH} ${S.inputText} flex-1 font-mono`}
              ref={inputRef}
              disabled={disabled || inputDisabled}
              onKeyDown={(e) => {
                const h = cmdHistory();
                if (e.key === 'Enter' && customAction.trim()) {
                  handleSubmit();
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHistoryIndex(prev => {
                    const next = Math.min(prev + 1, h.length - 1);
                    if (next >= 0) setCustomAction(h[next]);
                    return next;
                  });
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHistoryIndex(prev => {
                    const next = prev - 1;
                    if (next < 0) { setCustomAction(''); return -1; }
                    setCustomAction(h[next]);
                    return next;
                  });
                }
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className={`${S.sendBtn} shrink-0`}
              disabled={disabled || inputDisabled || !customAction.trim()}
              onClick={handleSubmit}
            >
              <Play size={S.sendIcon} />
            </Button>
          </div>
          {footerNote && (
            <p className={`${S.metaText} text-muted-foreground/60 mt-2 pl-5`}>{footerNote}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default HostTerminalView;
