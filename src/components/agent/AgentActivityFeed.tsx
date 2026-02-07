/**
 * Agent Activity Feed - shows individual execution cards with expandable results
 */

import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Activity,
  Zap,
  FileText,
  Globe,
  Server,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AgentRun } from '@/services/agentActivity';
import AgentRunResultViewer, { getFailureInfo, parseRunResult, hasOutputWarning } from '@/components/agent/AgentRunResultViewer';

// Map status to icon and color
const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  FINISHED: { icon: <CheckCircle size={16} />, color: 'hsl(var(--severity-low))', label: 'Completed' },
  SUCCESS: { icon: <CheckCircle size={16} />, color: 'hsl(var(--severity-low))', label: 'Completed' },
  FAILED: { icon: <XCircle size={16} />, color: 'hsl(var(--severity-critical))', label: 'Failed' },
  ABORTED: { icon: <XCircle size={16} />, color: 'hsl(var(--severity-critical))', label: 'Aborted' },
  EXECUTING: { icon: <Loader2 size={16} />, color: 'hsl(var(--severity-medium))', label: 'Running' },
  RUNNING: { icon: <Loader2 size={16} />, color: 'hsl(var(--severity-medium))', label: 'Running' },
  WAITING: { icon: <Clock size={16} />, color: 'hsl(var(--severity-info))', label: 'Waiting' },
};

// Assign icons based on execution patterns
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
  const status = run.status?.toUpperCase() || '';
  if (status === 'FINISHED' || status === 'SUCCESS') return 'hsl(var(--severity-low))';
  if (status === 'FAILED' || status === 'ABORTED') return 'hsl(var(--severity-critical))';
  if (status === 'EXECUTING' || status === 'RUNNING') return 'hsl(var(--severity-medium))';
  return 'hsl(var(--primary))';
};

const formatDuration = (run: AgentRun): string => {
  if (run.started_at && run.completed_at) {
    const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
  if (run.duration) return `${run.duration.toFixed(1)}s`;
  return '';
};

const getTimeAgo = (dateStr: string): string => {
  try {
    const date = isNaN(Number(dateStr)) ? new Date(dateStr) : new Date(Number(dateStr) * 1000);
    if (isNaN(date.getTime())) return dateStr;
    return formatDistanceToNow(date, { addSuffix: true });
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

/** Truncate a value, collapsing JSON-like structures */
const truncateValue = (val: unknown, maxLen = 80): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const s = JSON.stringify(val);
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  }
  const s = String(val);
  // If it looks like JSON or a long structure, truncate
  if ((s.startsWith('{') || s.startsWith('[')) && s.length > maxLen) {
    return s.slice(0, maxLen) + '…';
  }
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
};

const getRunSubtitle = (run: AgentRun): string => {
  // Try to extract from results[0].result parsed JSON
  const { parsed } = parseRunResult(run);
  if (parsed && typeof parsed === 'object') {
    // Prefer "output" field
    if (parsed.output) return truncateValue(parsed.output);
    // Fall back to "original_input"
    if (parsed.original_input) return truncateValue(parsed.original_input);
  }

  const parts: string[] = [];
  if (run.execution_source) parts.push(run.execution_source);
  if (run.result) {
    try {
      const p = JSON.parse(run.result);
      if (p.output) return truncateValue(p.output);
      if (p.original_input) return truncateValue(p.original_input);
      if (p.message) parts.push(p.message);
    } catch {
      if (run.result.length < 100) parts.push(run.result);
    }
  }
  return parts.join(' · ') || 'Agent execution';
};

interface AgentActivityFeedProps {
  runs: AgentRun[];
}

const AgentActivityFeed = ({ runs }: AgentActivityFeedProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Activity size={40} style={{ color: 'hsl(var(--muted-foreground))', marginBottom: 12 }} />
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
          No agent activity found
        </Typography>
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mt: 0.5, opacity: 0.7 }}>
          The agent hasn't performed any actions yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {runs.map((run, idx) => {
        const statusCfg = STATUS_CONFIG[run.status?.toUpperCase() || ''] || STATUS_CONFIG.WAITING;
        const iconColor = getRunIconColor(run);
        const duration = formatDuration(run);
        const isExpanded = expandedId === run.execution_id;
        const isFailed = run.status?.toUpperCase() === 'FAILED' || run.status?.toUpperCase() === 'ABORTED';
        const failureInfo = isFailed ? getFailureInfo(run) : null;
        const isUnsure = !isFailed && hasOutputWarning(run);

        return (
          <motion.div
            key={run.execution_id || idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
          >
            <Box sx={{
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              overflow: 'hidden',
              transition: 'border-color 0.15s ease',
              ...(isExpanded && {
                borderColor: 'hsl(var(--muted-foreground) / 0.3)',
              }),
            }}>
              {/* Header row - clickable */}
              <Box
                onClick={() => setExpandedId(isExpanded ? null : run.execution_id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 2.5,
                  py: 2,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  '&:hover': {
                    bgcolor: 'hsla(var(--muted) / 0.5)',
                  },
                }}
              >
                {/* Icon */}
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: `${iconColor}15`,
                  color: iconColor,
                  flexShrink: 0,
                }}>
                  {getRunIcon(run)}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    <Typography sx={{
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      color: 'hsl(var(--foreground))',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {getRunTitle(run)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', color: statusCfg.color }}>
                        {statusCfg.icon}
                      </Box>
                      {isUnsure && (
                        <Box sx={{ display: 'flex', alignItems: 'center', color: 'hsl(var(--severity-medium))' }}>
                          <HelpCircle size={14} />
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Show failure reason inline if failed */}
                  {isFailed && failureInfo ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                      <AlertTriangle size={12} style={{ color: 'hsl(var(--severity-critical))', flexShrink: 0 }} />
                      <Typography sx={{
                        fontSize: '0.78rem',
                        color: 'hsl(var(--severity-critical))',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 400,
                      }}>
                        {failureInfo.reason}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{
                        fontSize: '0.78rem',
                        color: 'hsl(var(--muted-foreground))',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 300,
                      }}>
                        {getRunSubtitle(run)}
                      </Typography>
                    </Box>
                  )}

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

                {/* Expand/collapse arrow */}
                <Box sx={{ color: 'hsl(var(--muted-foreground))', opacity: 0.5, flexShrink: 0, transition: 'transform 0.2s ease' }}>
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </Box>
              </Box>

              {/* Expandable result viewer */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <Box sx={{ borderTop: '1px solid hsl(var(--border))' }}>
                      <AgentRunResultViewer run={run} />
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
};

export default AgentActivityFeed;
