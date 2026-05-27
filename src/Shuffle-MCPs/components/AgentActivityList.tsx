/**
 * AgentActivityList — standalone list of agent workflow executions.
 *
 * Self-contained: no project hooks, contexts, or services. Pass
 * `apiKey` / `apiBaseUrl` / `orgId` to authenticate against any Shuffle
 * backend. `onRunClick(run)` is called when a row is clicked — the
 * consumer decides what happens next (typically: open AgentExecutionDrawer).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  GitBranch,
  Globe,
  Loader2,
  Server,
  XCircle,
  Zap,
  Search as SearchIcon
} from 'lucide-react';

import {
  searchAgentActivity,
  listAgentScheduleWorkflows,
  getAgentScheduleConfig,
  stopAgentSchedule,
  type AgentRun,
  type AgentDecision,
  type AgentScheduleWorkflow,
} from '@/Shuffle-MCPs/agentActivity';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { diagnoseOutputWarning } from '@/Shuffle-MCPs/agentDiagnosis';
import { fetchAppsViaApiConfig } from '@/Shuffle-MCPs/appsCache';
import { Pencil, StopCircle, AlertTriangle } from 'lucide-react';
import { SegmentedControl } from '@/Shuffle-MCPs/components/SegmentedControl';
import type { ShuffleHostProps } from '@/Shuffle-MCPs/host-props';
import AppDetailDrawer from '@/Shuffle-MCPs/views/AppDetailDrawer';

// ── Status / icon helpers ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  FINISHED: { icon: <CheckCircle size={16} />, color: 'hsl(var(--severity-low, 142 71% 45%))', label: 'Completed' },
  SUCCESS: { icon: <CheckCircle size={16} />, color: 'hsl(var(--severity-low, 142 71% 45%))', label: 'Completed' },
  FAILED: { icon: <XCircle size={16} />, color: 'hsl(var(--severity-critical, 0 72% 55%))', label: 'Failed' },
  ABORTED: { icon: <XCircle size={16} />, color: 'hsl(var(--severity-critical, 0 72% 55%))', label: 'Aborted' },
  EXECUTING: { icon: <Loader2 size={16} />, color: 'hsl(var(--severity-medium, 38 92% 50%))', label: 'Running' },
  RUNNING: { icon: <Loader2 size={16} />, color: 'hsl(var(--severity-medium, 38 92% 50%))', label: 'Running' },
  WAITING: { icon: <Clock size={16} />, color: 'hsl(var(--severity-info, 217 91% 60%))', label: 'Waiting' },
  LIMIT_REACHED: { icon: <AlertTriangle size={16} />, color: 'hsl(var(--severity-medium, 38 92% 50%))', label: 'Limit reached' },
};

/** Returns a synthetic "LIMIT_REACHED" status when the run finished but its
 *  output indicates an AI token-limit hit. Otherwise returns the raw status. */
const getEffectiveStatus = (run: AgentRun): string => {
  const raw = (run.status || '').toUpperCase();
  if (raw === 'FINISHED' || raw === 'SUCCESS' || raw === 'FAILED' || raw === 'ABORTED') {
    try {
      const d = diagnoseOutputWarning(run as any);
      if (d?.kind === 'token_limit') return 'LIMIT_REACHED';
    } catch {
      // ignore
    }
  }
  return raw;
};

const getRunIcon = (run: AgentRun): React.ReactNode => {
  const src = (run.execution_source || '').toLowerCase();
  const arg = (run.execution_argument || '').toLowerCase();
  if (src.includes('schedule') || src.includes('cron')) return <Clock size={18} />;
  if (src.includes('webhook') || src.includes('http')) return <Globe size={18} />;
  if (arg.includes('alert') || arg.includes('detect')) return <Activity size={18} />;
  if (arg.includes('report') || arg.includes('email')) return <FileText size={18} />;
  if (arg.includes('endpoint') || arg.includes('server')) return <Server size={18} />;
  return <Zap size={18} />;
};

const getRunIconColor = (run: AgentRun): string => {
  const status = getEffectiveStatus(run);
  if (status === 'FINISHED' || status === 'SUCCESS') return 'hsl(var(--severity-low, 142 71% 45%))';
  if (status === 'FAILED' || status === 'ABORTED') return 'hsl(var(--severity-critical, 0 72% 55%))';
  if (status === 'LIMIT_REACHED') return 'hsl(var(--severity-medium, 38 92% 50%))';
  if (status === 'EXECUTING' || status === 'RUNNING') return 'hsl(var(--severity-medium, 38 92% 50%))';
  return 'hsl(var(--primary, 24 100% 50%))';
};

const formatDuration = (run: AgentRun): string => {
  if (run.started_at && run.completed_at) {
    const start = Number(run.started_at);
    const end = Number(run.completed_at);
    if (!isNaN(start) && !isNaN(end)) {
      // Backend may return Unix milliseconds or seconds. Normalize to ms
      // while preserving sub-second precision.
      const toMs = (n: number) => (n > 1e12 ? n : n * 1000);
      const ms = Math.max(0, toMs(end) - toMs(start));
      if (ms < 1000) return `${(ms / 1000).toFixed(2)}s`;
      if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    }
  }
  if (run.duration) return `${run.duration.toFixed(2)}s`;
  return '';
};

const getTimeAgo = (dateStr: string): string => {
  try {
    const ts = isNaN(Number(dateStr)) ? new Date(dateStr).getTime() : Number(dateStr) * 1000;
    if (isNaN(ts)) return dateStr;
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return dateStr;
  }
};

/** Extract the original user prompt from a run, when available. */
const getRunPrompt = (run: AgentRun): string | null => {
  if (run.result) {
    try {
      const p = JSON.parse(run.result);
      if (typeof p?.original_input === 'string' && p.original_input.trim()) return p.original_input.trim();
    } catch { /* ignore */ }
  }
  if (run.execution_argument) {
    try {
      const p = JSON.parse(run.execution_argument);
      if (typeof p?.input === 'string' && p.input.trim()) return p.input.trim();
      if (typeof p?.prompt === 'string' && p.prompt.trim()) return p.prompt.trim();
      if (typeof p?.original_input === 'string' && p.original_input.trim()) return p.original_input.trim();
    } catch {
      const clean = run.execution_argument.replace(/[{}"]/g, '').trim();
      if (clean && clean.length < 240) return clean;
    }
  }
  return null;
};

const getRunTitle = (run: AgentRun): string => {
  const prompt = getRunPrompt(run);
  if (prompt) {
    const oneLine = prompt.replace(/\s+/g, ' ').trim();
    return oneLine.length > 80 ? oneLine.slice(0, 80) + '…' : oneLine;
  }
  if (run.workflow?.name) return run.workflow.name;
  return `Execution ${run.execution_id?.slice(0, 8) || '—'}`;
};

/** Count the number of decisions the agent made during this run. */
const getDecisionCount = (run: AgentRun): number => {
  if (Array.isArray(run.decisions)) return run.decisions.length;
  return 0;
};

const getRunSubtitle = (run: AgentRun): string => {
  if (run.result) {
    try {
      const p = JSON.parse(run.result);
      if (p.output && typeof p.output === 'string') {
        return p.output.length > 120 ? p.output.slice(0, 120) + '…' : p.output;
      }
      if (p.original_input && typeof p.original_input === 'string') {
        return p.original_input.length > 120 ? p.original_input.slice(0, 120) + '…' : p.original_input;
      }
      if (p.message && typeof p.message === 'string') return p.message;
    } catch {
      if (run.result.length < 120) return run.result;
    }
  }
  return run.execution_source || 'Agent execution';
};

// ── Run row ──────────────────────────────────────────────────────────────────

export type ToolStatus = 'success' | 'failure' | 'waiting' | 'unknown';

export interface RunTool {
  name: string;
  status: ToolStatus;
  id?: string;
}

const normalizeResultStatus = (s?: string): ToolStatus => {
  const v = (s || '').toUpperCase();
  if (v === 'SUCCESS' || v === 'FINISHED') return 'success';
  if (v === 'FAILURE' || v === 'FAILED' || v === 'ABORTED') return 'failure';
  if (v === 'WAITING' || v === 'SKIPPED') return 'waiting';
  return 'unknown';
};

/** Extract distinct tools/apps used in this run.
 *
 *  Prefers the agent's own `allowed_actions` list (format: "app:<id>:<name>"),
 *  which is the authoritative set of apps configured for the run. Falls back
 *  to scraping results/decisions only when allowed_actions is not available
 *  (e.g. very old runs). Per-app status is derived from matching results. */
const getRunTools = (run: AgentRun): RunTool[] => {
  const map = new Map<string, ToolStatus>();
  const ids = new Map<string, string>();
  const skip = (s: string) => /^(ai\s*agent|shuffle\s*agent|shuffle_agent)$/i.test(s);
  const rank: Record<ToolStatus, number> = { failure: 3, waiting: 2, success: 1, unknown: 0 };
  const merge = (name?: string, status?: ToolStatus, id?: string) => {
    if (!name) return;
    const s = String(name).trim();
    if (!s || skip(s)) return;
    const next = status || 'unknown';
    const prev = map.get(s);
    if (!prev || rank[next] > rank[prev]) map.set(s, next);
    if (id && !ids.has(s)) ids.set(s, id);
  };

  const allowed: string[] | undefined = (run as any).allowed_actions;
  if (Array.isArray(allowed) && allowed.length > 0) {
    // 1) Seed from allowed_actions — the configured app list.
    for (const entry of allowed) {
      if (typeof entry !== 'string') continue;
      const parts = entry.split(':');
      if (parts.length < 3 || parts[0] !== 'app') continue;
      const id = parts[1];
      const name = parts.slice(2).join(':');
      merge(name, 'unknown', id);
    }
    // 2) Upgrade statuses from any results/decisions that match by name.
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '_');
    const known = new Map<string, string>();
    for (const real of map.keys()) known.set(normalize(real), real);
    const apply = (name?: string, status?: ToolStatus) => {
      if (!name) return;
      const hit = known.get(normalize(name));
      if (hit) merge(hit, status);
    };
    (run.results || []).forEach((r) => {
      apply(r?.action?.app_name || r?.action?.label, normalizeResultStatus(r?.status));
    });
    (run.decisions || []).forEach((d) => {
      if (typeof d?.tool === 'string') apply(d.tool, normalizeResultStatus(d?.status as string));
    });
  } else {
    // Legacy fallback for runs without allowed_actions.
    (run.results || []).forEach((r) => {
      merge(r?.action?.app_name || r?.action?.label, normalizeResultStatus(r?.status));
    });
    (run.decisions || []).forEach((d) => {
      if (typeof d?.tool === 'string') merge(d.tool, normalizeResultStatus(d?.status as string));
    });
  }
  return Array.from(map.entries()).slice(0, 6).map(([name, status]) => ({ name, status, id: ids.get(name) }));
};

const TOOL_STATUS_RING: Record<ToolStatus, string> = {
  success: 'hsl(var(--severity-low, 142 71% 45%))',
  failure: 'hsl(var(--severity-critical, 0 72% 55%))',
  waiting: 'hsl(var(--severity-medium, 38 92% 50%))',
  unknown: 'hsl(var(--border))',
};

const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  success: 'ran successfully',
  failure: 'failed',
  waiting: 'needs input',
  unknown: 'used',
};

interface RunRowProps {
  run: AgentRun;
  onClick: () => void;
  sx?: SxProps<Theme>;
  appIcons?: Record<string, string>;
  onAppClick?: (app: { id?: string; name: string }) => void;
}

const normToolKey = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, '_');

const AgentRunRow = ({ run, onClick, sx, appIcons, onAppClick }: RunRowProps) => {
  const navigate = useNavigate();
  const statusKey = getEffectiveStatus(run);
  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.WAITING;
  const iconColor = getRunIconColor(run);
  const duration = formatDuration(run);
  const tools = getRunTools(run);
  const decisionCount = getDecisionCount(run);

  return (
    <Box
      onClick={onClick}
      sx={[
        {
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2.5,
          py: 2,
          cursor: 'pointer',
          transition: 'background 0.15s ease, border-color 0.15s ease',
          '&:hover': {
            bgcolor: 'hsla(var(--muted) / 0.5)',
            borderColor: 'hsl(var(--muted-foreground) / 0.3)',
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${iconColor}15`,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {getRunIcon(run)}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: 'hsl(var(--foreground))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {getRunTitle(run)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', color: cfg.color, flexShrink: 0 }}>
            {cfg.icon}
          </Box>
        </Box>

        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'hsl(var(--muted-foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {getRunSubtitle(run)}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
            {run.started_at ? getTimeAgo(run.started_at) : '—'}
          </Typography>
          {duration && (
            <>
              <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.4 }}>·</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
                {duration}
              </Typography>
            </>
          )}
          {decisionCount > 0 && (
            <>
              <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.4 }}>·</Typography>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
                <GitBranch size={11} />
                <Typography sx={{ fontSize: '0.72rem', color: 'inherit' }}>
                  {decisionCount} {decisionCount === 1 ? 'decision' : 'decisions'}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Box>

      {tools.length > 0 && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            flexShrink: 0,
            ml: 1,
          }}
        >
          <AvatarGroup
            max={5}
            sx={{
              '& .MuiAvatar-root': {
                width: 28,
                height: 28,
                fontSize: '0.7rem',
                borderColor: 'hsl(var(--border))',
                bgcolor: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
              },
            }}
          >
            {tools.map((t) => {
              const icon = appIcons?.[normToolKey(t.name)];
              const label = t.name.replace(/_/g, ' ');
              const slug = t.name.toLowerCase().replace(/\s+/g, '_');
              const ring = TOOL_STATUS_RING[t.status];
              return (
                <Tooltip key={t.name} title={`${label} — ${TOOL_STATUS_LABEL[t.status]}`} arrow>
                  <Avatar
                    src={icon || undefined}
                    alt={label}
                    variant="rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onAppClick) {
                        onAppClick({ id: t.id, name: t.name });
                      } else {
                        navigate(`/apps/${encodeURIComponent(slug)}`);
                      }
                    }}
                    sx={{
                      cursor: 'pointer',
                      borderColor: `${ring} !important`,
                      borderWidth: t.status === 'unknown' ? '1px' : '2px',
                      borderStyle: 'solid',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                      '&:hover': {
                        transform: 'scale(1.08)',
                        borderColor: 'hsl(var(--primary)) !important',
                      },
                    }}
                  >
                    {label.charAt(0).toUpperCase()}
                  </Avatar>
                </Tooltip>
              );
            })}
          </AvatarGroup>
        </Box>
      )}
    </Box>
  );
};

// ── List ─────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Completed', value: 'FINISHED' },
  { label: 'Running', value: 'EXECUTING' },
  { label: 'Failed', value: 'ABORTED' },
];

export interface AgentActivityListProps extends ShuffleHostProps {
  /** Optional Shuffle API key. Falls back to the shared API_CONFIG. */
  apiKey?: string;
  /** Optional Shuffle backend base URL. Falls back to the shared API_CONFIG. */
  apiBaseUrl?: string;
  /** Optional Shuffle Org ID — sent as the `Org-Id` header. */
  orgId?: string;
  /** Called when a run row is clicked. */
  onRunClick?: (run: AgentRun) => void;
  /** Called when "Edit" is clicked on a selected scheduled workflow. */
  onEditWorkflow?: (info: { workflowId: string; name: string; prompt: string; apps: Array<{ name: string; id?: string }> }) => void;
  /** Show the search box. Default: true. */
  showSearchBar?: boolean;
  /** Show the status filter chips. Default: true. */
  showStatusChips?: boolean;
  /** Page size. Default: 50. */
  limit?: number;
  /** Empty-state heading. */
  emptyTitle?: string;
  /** Empty-state subtitle. */
  emptySubtitle?: string;
  /** Optional className forwarded to the root container. */
  className?: string;
  /** Style overrides merged into the root container sx. */
  sx?: SxProps<Theme>;
  /** Style overrides for the filter/search toolbar. */
  toolbarSx?: SxProps<Theme>;
  /** Style overrides for each individual run row. */
  rowSx?: SxProps<Theme>;
}

const AgentActivityList = ({
  apiKey,
  apiBaseUrl,
  orgId,
  onRunClick,
  
  onEditWorkflow,
  showSearchBar = true,
  showStatusChips = true,
  limit = 50,
  emptyTitle = 'No agent activity found',
  emptySubtitle = 'The agent has not performed any actions yet',
  className,
  sx,
  toolbarSx,
  rowSx,
  globalUrl,
  theme,
  colorMode,
}: AgentActivityListProps) => {
  const [appDrawer, setAppDrawer] = useState<{ id?: string; name: string } | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [cursor, setCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [agentWorkflows, setAgentWorkflows] = useState<AgentScheduleWorkflow[]>([]);
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [stopOpen, setStopOpen] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  const [enrichedRuns, setEnrichedRuns] = useState<Record<string, Partial<AgentRun>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const selectedAgentWorkflow = agentWorkflows.find((w) => w.id === workflowFilter) || null;

  const openEditPrompt = useCallback(async () => {
    if (!workflowFilter) return;
    try {
      const { prompt, apps } = await getAgentScheduleConfig(workflowFilter, { apiKey, apiBaseUrl, orgId });
      onEditWorkflow?.({
        workflowId: workflowFilter,
        name: selectedAgentWorkflow?.name || 'Schedule',
        prompt,
        apps,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflow');
    }
  }, [workflowFilter, selectedAgentWorkflow, apiKey, apiBaseUrl, orgId, onEditWorkflow]);


  const confirmStop = useCallback(async () => {
    if (!workflowFilter) return;
    setStopLoading(true);
    try {
      await stopAgentSchedule(workflowFilter, { apiKey, apiBaseUrl, orgId });
      setStopOpen(false);
      // Refresh workflow list and clear the filter so list goes back to "All".
      const items = await listAgentScheduleWorkflows({ apiKey, apiBaseUrl, orgId });
      setAgentWorkflows(items);
      setWorkflowFilter('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop schedule');
    } finally {
      setStopLoading(false);
    }
  }, [workflowFilter, apiKey, apiBaseUrl, orgId]);

  const updateSearchQuery = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(q), 350);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const fetchRuns = useCallback(
    async (append = false, cursorParam = '') => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await searchAgentActivity({
          limit,
          status: statusFilter,
          cursor: cursorParam,
          apiKey,
          apiBaseUrl,
          orgId,
          workflowId: workflowFilter || 'AGENT',
        });
        if (result.success) {
          setRuns((prev) => (append ? [...prev, ...result.runs] : result.runs));
          setCursor(result.cursor);
          setHasMore(!!result.cursor && result.runs.length > 0);
        } else {
          setError('Failed to fetch agent activity');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch agent activity');
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, limit, apiKey, apiBaseUrl, orgId, workflowFilter],
  );

  useEffect(() => {
    fetchRuns(false, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, apiKey, apiBaseUrl, orgId, workflowFilter]);

  // Load the agentic workflow list (workflow_type = AGENT_SCHEDULE) once.
  useEffect(() => {
    let cancelled = false;
    listAgentScheduleWorkflows({ apiKey, apiBaseUrl, orgId })
      .then((items) => { if (!cancelled) setAgentWorkflows(items); })
      .catch(() => { /* non-fatal — dropdown stays "All" only */ });
    return () => { cancelled = true; };
  }, [apiKey, apiBaseUrl, orgId]);

  // Load app icons once so each run row can render the same Avatar-based
  // app indicators used elsewhere in the agent UI.
  useEffect(() => {
    let cancelled = false;
    fetchAppsViaApiConfig()
      .then((apps) => {
        if (cancelled || !Array.isArray(apps)) return;
        const map: Record<string, string> = {};
        for (const a of apps as Array<{ name?: string; large_image?: string; image_url?: string; image?: string }>) {
          const name = a?.name;
          const img = a?.large_image || a?.image_url || a?.image;
          if (!name || !img) continue;
          map[normToolKey(name)] = img;
        }
        setAppIcons(map);
      })
      .catch(() => { /* icons are non-critical — fall back to initials */ });
    return () => { cancelled = true; };
  }, []);

  // Enrich each visible run with full execution details (results, decisions,
  // execution_argument). The search endpoint returns a lightweight summary, so
  // we hydrate each row via /api/v1/streams/results to render real prompts,
  // app icons, decision counts, and per-tool status.
  useEffect(() => {
    if (!runs.length) return;
    let cancelled = false;
    const targets = runs
      .map((r) => r.execution_id)
      .filter((id) => !!id && !enrichedRuns[id]);
    if (!targets.length) return;

    const CONCURRENCY = 4;
    let i = 0;
    const fetchOne = async (executionId: string) => {
      try {
        const resp = await fetch(getApiUrl('/api/v1/streams/results'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : getAuthHeader()),
            ...(orgId ? { 'Org-Id': orgId } : {}),
          },
          body: JSON.stringify({ execution_id: executionId, authorization: executionId }),
        });
        if (!resp.ok || cancelled) return;
        const json = await resp.json().catch(() => null);
        if (!json || cancelled) return;
        let decisions: AgentDecision[] | undefined;
        let originalInput: string | undefined;
        let allowedActions: string[] | undefined;
        // Decisions / original_input / allowed_actions live inside the AI
        // Agent action result.
        const agentResult = Array.isArray(json.results)
          ? json.results.find((r: any) => r?.action?.app_name === 'AI Agent')
          : null;
        if (agentResult?.result) {
          try {
            const parsed = JSON.parse(agentResult.result);
            if (Array.isArray(parsed?.decisions)) decisions = parsed.decisions;
            if (typeof parsed?.original_input === 'string') originalInput = parsed.original_input;
            if (Array.isArray(parsed?.allowed_actions)) allowedActions = parsed.allowed_actions;
          } catch { /* ignore */ }
        }
        const patch: Partial<AgentRun> & { allowed_actions?: string[] } = {
          results: json.results,
          execution_argument: json.execution_argument,
          result: agentResult?.result,
          decisions,
          allowed_actions: allowedActions,
        };
        if (originalInput && !patch.execution_argument) {
          patch.execution_argument = JSON.stringify({ original_input: originalInput });
        }
        setEnrichedRuns((prev) => ({ ...prev, [executionId]: patch }));
      } catch { /* non-critical */ }
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
      while (!cancelled && i < targets.length) {
        const id = targets[i++];
        await fetchOne(id);
      }
    });
    Promise.all(workers).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, apiKey, orgId]);

  const mergedRuns = runs.map((r) => {
    const patch = r.execution_id ? enrichedRuns[r.execution_id] : undefined;
    return patch ? { ...r, ...patch } : r;
  });

  const loadMore = useCallback(() => {
    if (cursor && !isLoading) fetchRuns(true, cursor);
  }, [cursor, isLoading, fetchRuns]);

  const filteredRuns = debouncedQuery
    ? mergedRuns.filter((r) => {
        const hay = [
          getRunTitle(r),
          getRunSubtitle(r),
          r.execution_id,
          r.execution_source,
          r.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(debouncedQuery.toLowerCase());
      })
    : mergedRuns;

  return (
    <Box
      className={className}
      sx={[{ display: 'flex', flexDirection: 'column', gap: 2 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    >
      {(showSearchBar || showStatusChips) && (
        <Box sx={[{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }, ...(Array.isArray(toolbarSx) ? toolbarSx : toolbarSx ? [toolbarSx] : [])]}>
          <Select
            size="small"
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(String(e.target.value))}
            displayEmpty
            renderValue={(val) => {
              if (!val) return 'All Agent runs';
              const wf = agentWorkflows.find((w) => w.id === val);
              return wf?.name || 'Selected workflow';
            }}
            sx={{
              height: 36,
              minWidth: 200,
              maxWidth: 260,
              fontSize: '0.85rem',
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              borderRadius: 1.5,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--muted-foreground) / 0.3)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--primary))' },
            }}
            MenuProps={{
              slotProps: {
                paper: {
                  sx: {
                    bgcolor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    maxHeight: 320,
                  },
                },
              },
            }}
          >
            <MenuItem value="" sx={{ fontSize: '0.85rem' }}>All Agent runs</MenuItem>
            {agentWorkflows.map((w) => (
              <MenuItem key={w.id} value={w.id} sx={{ fontSize: '0.85rem' }}>
                {w.name}
              </MenuItem>
            ))}
          </Select>
          {showSearchBar && (
            <TextField
              placeholder="Search results..."
              size="small"
              value={searchQuery}
              onChange={(e) => updateSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon size={18} color={'hsl(var(--muted-foreground))'} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                flex: 1,
                maxWidth: 280,
                minWidth: 160,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'hsl(var(--card))',
                  borderRadius: 1.5,
                  fontSize: '0.85rem',
                  height: 36,
                  '& fieldset': { borderColor: 'hsl(var(--border))' },
                  '&:hover fieldset': { borderColor: 'hsl(var(--muted-foreground) / 0.3)' },
                  '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                },
                '& .MuiInputBase-input': { color: 'hsl(var(--foreground))' },
              }}
            />
          )}
          {showStatusChips && (
            <SegmentedControl
              size="sm"
              ariaLabel="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
            />
          )}
          {isLoading && runs.length > 0 && (
            <CircularProgress size={16} sx={{ color: 'hsl(var(--primary))', ml: 0.5 }} />
          )}
        </Box>
      )}

      {selectedAgentWorkflow && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            border: '1px solid hsl(var(--border))',
            bgcolor: 'hsl(var(--card))',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedAgentWorkflow.name}
            </Typography>
            {selectedAgentWorkflow.description && (
              <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedAgentWorkflow.description}
              </Typography>
            )}
          </Box>
          <Button
            size="small"
            startIcon={<Pencil size={14} />}
            onClick={openEditPrompt}
            sx={{
              height: 36,
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              color: 'hsl(var(--foreground))',
              textTransform: 'none',
              fontSize: '0.8rem',
              px: 1.5,
              '&:hover': { bgcolor: 'hsl(var(--muted))' },
            }}
          >
            Edit
          </Button>
          <Button
            size="small"
            startIcon={<StopCircle size={14} />}
            onClick={() => setStopOpen(true)}
            sx={{
              height: 36,
              border: '1px solid hsl(var(--severity-critical, 0 72% 55%) / 0.4)',
              borderRadius: 1.5,
              color: 'hsl(var(--severity-critical, 0 72% 55%))',
              textTransform: 'none',
              fontSize: '0.8rem',
              px: 1.5,
              '&:hover': { bgcolor: 'hsla(var(--severity-critical, 0 72% 55%) / 0.08)' },
            }}
          >
            Stop schedule
          </Button>
        </Box>
      )}

      {isLoading && runs.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={28} sx={{ color: 'hsl(var(--primary))' }} />
        </Box>
      ) : error ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 6 }}>
          <AlertCircle size={28} style={{ color: 'hsl(var(--severity-critical, 0 72% 55%))', marginBottom: 8 }} />
          <Typography
            sx={{ color: 'hsl(var(--severity-critical, 0 72% 55%))', fontSize: '0.9rem', mb: 1 }}
          >
            {error}
          </Typography>
          <Button
            size="small"
            onClick={() => fetchRuns(false, '')}
            sx={{ color: 'hsl(var(--primary))', textTransform: 'none' }}
          >
            Try again
          </Button>
        </Box>
      ) : filteredRuns.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 8 }}>
          <Activity
            size={40}
            style={{ color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}
          />
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
            {emptyTitle}
          </Typography>
          <Typography
            sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mt: 0.5, opacity: 0.7 }}
          >
            {emptySubtitle}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filteredRuns.map((run, idx) => (
            <AgentRunRow
              key={run.execution_id || idx}
              run={run}
              onClick={() => onRunClick?.(run)}
              sx={rowSx}
              appIcons={appIcons}
              onAppClick={(app) => setAppDrawer(app)}
            />
          ))}
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <Button
                size="small"
                onClick={loadMore}
                disabled={isLoading}
                sx={{ color: 'hsl(var(--primary))', textTransform: 'none', fontSize: '0.8rem' }}
              >
                {isLoading ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                Load more
              </Button>
            </Box>
          )}
        </Box>
      )}

      <Dialog
        open={stopOpen}
        onClose={() => (stopLoading ? null : setStopOpen(false))}
        slotProps={{ paper: { sx: { bgcolor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' } } }}
      >
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Stop schedule?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
            This will stop "{selectedAgentWorkflow?.name}" and delete the scheduled workflow. Past executions remain visible. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStopOpen(false)} disabled={stopLoading} sx={{ textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}>
            Cancel
          </Button>
          <Button
            onClick={confirmStop}
            disabled={stopLoading}
            sx={{ textTransform: 'none', bgcolor: 'hsl(var(--severity-critical, 0 72% 55%))', color: 'hsl(var(--primary-foreground))', '&:hover': { bgcolor: 'hsla(var(--severity-critical, 0 72% 55%) / 0.9)' } }}
          >
            {stopLoading ? <CircularProgress size={16} sx={{ color: 'hsl(var(--primary-foreground))', mr: 1 }} /> : null}
            Stop schedule
          </Button>
        </DialogActions>
      </Dialog>

      <AppDetailDrawer
        open={!!appDrawer}
        onClose={() => setAppDrawer(null)}
        appName={appDrawer?.name || null}
        appId={appDrawer?.id || null}
        activeOrgId={orgId || null}
        globalUrl={globalUrl || apiBaseUrl}
        theme={theme}
        colorMode={colorMode}
      />
    </Box>
  );
};

export default AgentActivityList;
export { getRunTitle, getRunSubtitle, formatDuration, getTimeAgo, STATUS_CONFIG };
