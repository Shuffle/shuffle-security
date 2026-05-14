/**
 * AgentActivityList — standalone list of agent workflow executions.
 *
 * Self-contained: no project hooks, contexts, or services. Pass
 * `apiKey` / `apiBaseUrl` / `orgId` to authenticate against any Shuffle
 * backend. `onRunClick(run)` is called when a row is clicked — the
 * consumer decides what happens next (typically: open AgentExecutionDrawer).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Globe,
  Loader2,
  Server,
  XCircle,
  Zap,
} from 'lucide-react';

import {
  searchAgentActivity,
  listAgentScheduleWorkflows,
  type AgentRun,
  type AgentScheduleWorkflow,
} from './agentActivity';

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
  const status = (run.status || '').toUpperCase();
  if (status === 'FINISHED' || status === 'SUCCESS') return 'hsl(var(--severity-low, 142 71% 45%))';
  if (status === 'FAILED' || status === 'ABORTED') return 'hsl(var(--severity-critical, 0 72% 55%))';
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

const getRunTitle = (run: AgentRun): string => {
  if (run.workflow?.name) return run.workflow.name;
  if (run.execution_argument) {
    try {
      const parsed = JSON.parse(run.execution_argument);
      if (parsed.title) return parsed.title;
      if (parsed.action) return parsed.action;
      if (parsed.name) return parsed.name;
    } catch {
      const clean = run.execution_argument.replace(/[{}"]/g, '').trim();
      if (clean.length > 0 && clean.length < 80) return clean;
    }
  }
  return `Execution ${run.execution_id?.slice(0, 8) || '—'}`;
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

interface RunRowProps {
  run: AgentRun;
  onClick: () => void;
  sx?: SxProps<Theme>;
}

const AgentRunRow = ({ run, onClick, sx }: RunRowProps) => {
  const statusKey = (run.status || '').toUpperCase();
  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.WAITING;
  const iconColor = getRunIconColor(run);
  const duration = formatDuration(run);

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
        </Box>
      </Box>
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

export interface AgentActivityListProps {
  /** Optional Shuffle API key. Falls back to the shared API_CONFIG. */
  apiKey?: string;
  /** Optional Shuffle backend base URL. Falls back to the shared API_CONFIG. */
  apiBaseUrl?: string;
  /** Optional Shuffle Org ID — sent as the `Org-Id` header. */
  orgId?: string;
  /** Called when a run row is clicked. */
  onRunClick?: (run: AgentRun) => void;
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
  showSearchBar = true,
  showStatusChips = true,
  limit = 50,
  emptyTitle = 'No agent activity found',
  emptySubtitle = 'The agent has not performed any actions yet',
  className,
  sx,
  toolbarSx,
  rowSx,
}: AgentActivityListProps) => {
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

  const loadMore = useCallback(() => {
    if (cursor && !isLoading) fetchRuns(true, cursor);
  }, [cursor, isLoading, fetchRuns]);

  const filteredRuns = debouncedQuery
    ? runs.filter((r) => {
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
    : runs;

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
                      <SearchIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
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
          {showStatusChips &&
            STATUS_FILTERS.map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                size="small"
                variant={statusFilter === f.value ? 'filled' : 'outlined'}
                onClick={() => setStatusFilter(f.value)}
                sx={{
                  fontSize: '0.75rem',
                  height: 28,
                  borderColor:
                    statusFilter === f.value ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  bgcolor:
                    statusFilter === f.value ? 'hsla(var(--primary) / 0.15)' : 'transparent',
                  color:
                    statusFilter === f.value ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  '&:hover': { bgcolor: 'hsl(var(--muted))' },
                }}
              />
            ))}
          {isLoading && runs.length > 0 && (
            <CircularProgress size={16} sx={{ color: 'hsl(var(--primary))', ml: 0.5 }} />
          )}
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
    </Box>
  );
};

export default AgentActivityList;
export { getRunTitle, getRunSubtitle, formatDuration, getTimeAgo, STATUS_CONFIG };
