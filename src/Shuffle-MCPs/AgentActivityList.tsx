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
  getAgentScheduleConfig,
  stopAgentSchedule,
  type AgentRun,
  type AgentScheduleWorkflow,
} from './agentActivity';
import { Pencil, StopCircle } from 'lucide-react';

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

/** Extract distinct tools/apps used in this run from results + decisions. */
const getRunTools = (run: AgentRun): string[] => {
  const out = new Set<string>();
  const add = (v?: string) => {
    if (!v) return;
    const s = String(v).trim();
    if (!s) return;
    // Skip the agent itself.
    if (/^(ai\s*agent|shuffle\s*agent|shuffle_agent)$/i.test(s)) return;
    out.add(s);
  };
  (run.results || []).forEach((r) => {
    add(r?.action?.app_name);
    if (!r?.action?.app_name) add(r?.action?.label);
  });
  (run.decisions || []).forEach((d) => {
    add(typeof d?.tool === 'string' ? d.tool : undefined);
  });
  return Array.from(out).slice(0, 6);
};

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
  const tools = getRunTools(run);

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

      {tools.length > 0 && (
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: 0.5,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            maxWidth: 220,
            flexShrink: 0,
          }}
        >
          {tools.map((t) => (
            <Tooltip key={t} title={t} arrow>
              <Chip
                label={t}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.68rem',
                  maxWidth: 120,
                  bgcolor: 'hsla(var(--muted) / 0.5)',
                  color: 'hsl(var(--muted-foreground))',
                  border: '1px solid hsl(var(--border))',
                  '& .MuiChip-label': {
                    px: 0.75,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            </Tooltip>
          ))}
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

export interface AgentActivityListProps {
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
  const [stopOpen, setStopOpen] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
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
    </Box>
  );
};

export default AgentActivityList;
export { getRunTitle, getRunSubtitle, formatDuration, getTimeAgo, STATUS_CONFIG };
