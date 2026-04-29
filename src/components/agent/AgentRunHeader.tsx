/**
 * AgentRunHeader — Shared visual header for an agent execution run.
 * Used in both the Activity Feed cards and the Action Drawer header.
 */

import { Box, Typography } from '@mui/material';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Zap,
  FileText,
  Globe,
  Server,
  Activity,
  AlertTriangle,
  HelpCircle,
  MinusCircle,
} from 'lucide-react';
import { Tooltip } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { AgentRun } from '@/services/agentActivity';
import { parseRunResult, getFailureInfo, hasOutputWarning } from '@/components/agent/AgentRunResultViewer';
import { getAgentSkipInfo } from '@/lib/agentParsers';

// ── Status config ──────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  FINISHED: { icon: <CheckCircle size={16} />, color: 'hsl(var(--severity-low))', label: 'Completed' },
  SUCCESS: { icon: <CheckCircle size={16} />, color: 'hsl(var(--severity-low))', label: 'Completed' },
  FAILED: { icon: <XCircle size={16} />, color: 'hsl(var(--severity-critical))', label: 'Failed' },
  ABORTED: { icon: <XCircle size={16} />, color: 'hsl(var(--severity-critical))', label: 'Aborted' },
  EXECUTING: { icon: <Loader2 size={16} />, color: 'hsl(var(--severity-medium))', label: 'Running' },
  RUNNING: { icon: <Loader2 size={16} />, color: 'hsl(var(--severity-medium))', label: 'Running' },
  WAITING: { icon: <Clock size={16} />, color: 'hsl(var(--severity-info))', label: 'Waiting' },
};

export const getRunIcon = (run: AgentRun): React.ReactNode => {
  const src = (run.execution_source || '').toLowerCase();
  const arg = (run.execution_argument || '').toLowerCase();
  if (src.includes('schedule') || src.includes('cron')) return <Clock size={18} />;
  if (src.includes('webhook') || src.includes('http')) return <Globe size={18} />;
  if (arg.includes('alert') || arg.includes('detect')) return <Activity size={18} />;
  if (arg.includes('report') || arg.includes('email')) return <FileText size={18} />;
  if (arg.includes('endpoint') || arg.includes('server')) return <Server size={18} />;
  return <Zap size={18} />;
};

export const getRunIconColor = (run: AgentRun): string => {
  const status = run.status?.toUpperCase() || '';
  if (status === 'FINISHED' || status === 'SUCCESS') return 'hsl(var(--severity-low))';
  if (status === 'FAILED' || status === 'ABORTED') return 'hsl(var(--severity-critical))';
  if (status === 'EXECUTING' || status === 'RUNNING') return 'hsl(var(--severity-medium))';
  return 'hsl(var(--primary))';
};

export const formatDuration = (run: AgentRun): string => {
  if (run.started_at && run.completed_at) {
    const startSec = Number(run.started_at);
    const endSec = Number(run.completed_at);
    if (!isNaN(startSec) && !isNaN(endSec)) {
      const ms = (endSec - startSec) * 1000;
      if (ms < 1000) return `${Math.round(ms)}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    }
  }
  if (run.duration) return `${run.duration.toFixed(1)}s`;
  return '';
};

export const getTimeAgo = (dateStr: string): string => {
  try {
    const date = isNaN(Number(dateStr)) ? new Date(dateStr) : new Date(Number(dateStr) * 1000);
    if (isNaN(date.getTime())) return dateStr;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
};

export const getRunTitle = (run: AgentRun): string => {
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

const truncateValue = (val: unknown, maxLen = 80): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const s = JSON.stringify(val);
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  }
  const s = String(val);
  if ((s.startsWith('{') || s.startsWith('[')) && s.length > maxLen) {
    return s.slice(0, maxLen) + '…';
  }
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
};

export const getRunSubtitle = (run: AgentRun): string => {
  const { parsed } = parseRunResult(run);
  if (parsed && typeof parsed === 'object') {
    if (parsed.output) return truncateValue(parsed.output);
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

// ── Component ──────────────────────────────────────────────────────────────────

interface AgentRunHeaderProps {
  run: AgentRun;
  /** If true, show the expand/collapse chevron and make it clickable */
  onClick?: () => void;
  /** Show chevron arrow */
  showChevron?: boolean;
  isExpanded?: boolean;
}

const AgentRunHeader = ({ run, onClick, showChevron, isExpanded }: AgentRunHeaderProps) => {
  const skipInfo = getAgentSkipInfo(run);
  const isSkipped = skipInfo.skipped;
  const skipColor = 'hsl(var(--muted-foreground))';
  const baseStatusCfg = STATUS_CONFIG[run.status?.toUpperCase() || ''] || STATUS_CONFIG.WAITING;
  const statusCfg = isSkipped
    ? { icon: <MinusCircle size={16} />, color: skipColor, label: 'Skipped' }
    : baseStatusCfg;
  const iconColor = isSkipped ? skipColor : getRunIconColor(run);
  const duration = formatDuration(run);
  const isFailed = !isSkipped && (run.status?.toUpperCase() === 'FAILED' || run.status?.toUpperCase() === 'ABORTED');
  const failureInfo = isFailed ? getFailureInfo(run) : null;
  const isUnsure = !isSkipped && !isFailed && hasOutputWarning(run);

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 2,
        ...(onClick && {
          cursor: 'pointer',
          transition: 'background 0.15s ease',
          '&:hover': {
            bgcolor: 'hsla(var(--muted) / 0.5)',
          },
        }),
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
          {isUnsure ? (
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'hsl(var(--severity-medium))' }}>
              <HelpCircle size={16} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', color: statusCfg.color }}>
              {statusCfg.icon}
            </Box>
          )}
        </Box>

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

      {/* Chevron */}
      {showChevron && (
        <Box sx={{ color: 'hsl(var(--muted-foreground))', opacity: 0.5, flexShrink: 0, transition: 'transform 0.2s ease' }}>
          {isExpanded ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          )}
        </Box>
      )}
    </Box>
  );
};

export default AgentRunHeader;
