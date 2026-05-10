/**
 * AgentDebugger — Standalone agent run inspector.
 *
 * Lists recent agent executions with status, duration, prompt, and an
 * expandable result viewer. Polls every `pollIntervalMs` (default 30s).
 *
 * Pair with {@link AgentRunner} for a complete "start + debug" surface.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Collapse,
  Tooltip,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { CheckCircle2, XCircle, Clock, Activity } from 'lucide-react';

import AgentRunResultViewer from '@/components/agent/AgentRunResultViewer';
import { searchAgentActivity, type AgentRun } from '@/services/agentActivity';

export interface AgentDebuggerProps {
  /** Maximum number of runs to fetch. Defaults to 25. */
  limit?: number;
  /** Auto-refresh interval in ms. 0 disables polling. Defaults to 30000. */
  pollIntervalMs?: number;
  /** Optional title shown above the list. */
  title?: string;
}

const STATUS_META: Record<string, { color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  FINISHED: { color: 'hsl(142, 71%, 45%)', bg: 'hsla(142, 71%, 45%, 0.12)', Icon: CheckCircle2 },
  SUCCESS: { color: 'hsl(142, 71%, 45%)', bg: 'hsla(142, 71%, 45%, 0.12)', Icon: CheckCircle2 },
  FAILURE: { color: 'hsl(0, 72%, 55%)', bg: 'hsla(0, 72%, 55%, 0.12)', Icon: XCircle },
  ABORTED: { color: 'hsl(0, 72%, 55%)', bg: 'hsla(0, 72%, 55%, 0.12)', Icon: XCircle },
  EXECUTING: { color: 'hsl(38, 92%, 50%)', bg: 'hsla(38, 92%, 50%, 0.12)', Icon: Clock },
  WAITING: { color: 'hsl(38, 92%, 50%)', bg: 'hsla(38, 92%, 50%, 0.12)', Icon: Clock },
};

const formatTimeAgo = (iso: string): string => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || Number.isNaN(ms)) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const formatDuration = (run: AgentRun): string => {
  if (typeof run.duration === 'number' && run.duration > 0) {
    return run.duration < 60 ? `${run.duration.toFixed(1)}s` : `${Math.floor(run.duration / 60)}m ${Math.floor(run.duration % 60)}s`;
  }
  if (run.started_at && run.completed_at) {
    const d = (new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000;
    if (d > 0) return d < 60 ? `${d.toFixed(1)}s` : `${Math.floor(d / 60)}m ${Math.floor(d % 60)}s`;
  }
  return '—';
};

const AgentDebugger = ({
  limit = 25,
  pollIntervalMs = 30000,
  title = 'Agent runs',
}: AgentDebuggerProps) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchAgentActivity({ limit });
      setRuns(result.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent runs.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pollIntervalMs) return;
    const id = setInterval(load, pollIntervalMs);
    return () => clearInterval(id);
  }, [load, pollIntervalMs]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) =>
      (r.execution_argument || '').toLowerCase().includes(q) ||
      (r.execution_id || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    );
  }, [runs, filter]);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: 'hsla(var(--primary) / 0.12)', color: 'hsl(var(--primary))',
        }}>
          <Activity size={16} />
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: 'hsl(var(--foreground))', flex: 1 }}>
          {title}
        </Typography>
        <TextField
          size="small"
          placeholder="Search prompt, id, status…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }} />
              </InputAdornment>
            ),
            sx: {
              fontSize: '0.85rem',
              height: 36,
              bgcolor: 'hsl(var(--card))',
              '& fieldset': { borderColor: 'hsl(var(--border))' },
            },
          }}
          sx={{ minWidth: 240 }}
        />
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={load} disabled={loading} size="small" sx={{
              border: '1px solid hsl(var(--border))', borderRadius: 1.5,
              color: 'hsl(var(--muted-foreground))',
              '&:hover': { color: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))' },
            }}>
              {loading ? <CircularProgress size={14} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem' }}>{error}</Alert>
      )}

      <Box sx={{
        borderRadius: 2,
        border: '1px solid hsl(var(--border))',
        bgcolor: 'hsl(var(--card))',
        overflow: 'hidden',
      }}>
        {visible.length === 0 && !loading && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
            No agent runs yet. Start one above and it will appear here.
          </Box>
        )}

        {visible.map((run, idx) => {
          const meta = STATUS_META[run.status?.toUpperCase()] || STATUS_META.EXECUTING;
          const isOpen = expanded.has(run.execution_id);
          return (
            <Box key={run.execution_id || idx} sx={{
              borderBottom: idx < visible.length - 1 ? '1px solid hsl(var(--border))' : 'none',
            }}>
              <Box
                onClick={() => toggle(run.execution_id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  '&:hover': { bgcolor: 'hsl(var(--muted) / 0.4)' },
                }}
              >
                <Chip
                  icon={<meta.Icon size={12} />}
                  label={run.status || 'UNKNOWN'}
                  size="small"
                  sx={{
                    bgcolor: meta.bg,
                    color: meta.color,
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 22,
                    '& .MuiChip-icon': { color: meta.color, ml: 0.75 },
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    fontSize: '0.85rem',
                    color: 'hsl(var(--foreground))',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}>
                    {run.execution_argument || run.workflow?.name || run.execution_id || 'Untitled run'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
                    {formatTimeAgo(run.started_at)} · {formatDuration(run)} · {(run.execution_id || '').slice(0, 8)}
                  </Typography>
                </Box>
                <ExpandMoreIcon
                  sx={{
                    fontSize: 18,
                    color: 'hsl(var(--muted-foreground))',
                    transition: 'transform 0.2s',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </Box>
              <Collapse in={isOpen} unmountOnExit>
                <Box sx={{ borderTop: '1px solid hsl(var(--border))', bgcolor: 'hsl(var(--background))' }}>
                  <AgentRunResultViewer run={run} />
                </Box>
              </Collapse>
            </Box>
          );
        })}

        {loading && visible.length === 0 && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        )}
      </Box>

      {visible.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
          <Button
            size="small"
            onClick={load}
            disabled={loading}
            sx={{
              textTransform: 'none',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.75rem',
            }}
          >
            {loading ? 'Refreshing…' : `Showing ${visible.length} of ${runs.length}`}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default AgentDebugger;
