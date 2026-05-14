/**
 * AgentRunHeader — Shared visual header for an agent execution run.
 * Used in both the Activity Feed cards and the Action Drawer header.
 */

import { useEffect, useState } from 'react';
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
  ExternalLink,
} from 'lucide-react';
import { Tooltip } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { AgentRun } from '@/services/agentActivity';
import { parseRunResult, getFailureInfo, hasOutputWarning } from '@/components/agent/AgentRunResultViewer';
import { getAgentSkipInfo, parseDatastoreReference, isIncidentReference } from '@/lib/agentParsers';

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

const toMs = (n: number) => (n > 1e12 ? n : n * 1000);

const formatMs = (ms: number): string => {
  ms = Math.max(0, ms);
  if (ms < 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

export const formatDuration = (run: AgentRun, nowMs: number = Date.now()): string => {
  const start = run.started_at != null ? Number(run.started_at) : NaN;
  const end = run.completed_at != null ? Number(run.completed_at) : NaN;
  if (!isNaN(start)) {
    const startMs = toMs(start);
    const status = (run.status || '').toUpperCase();
    const isInProgress = status === 'EXECUTING' || status === 'WAITING' || status === 'RUNNING';
    const endMs = !isNaN(end) && !isInProgress ? toMs(end) : nowMs;
    return formatMs(endMs - startMs);
  }
  if (run.duration) return formatMs(run.duration * 1000);
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
  const status = (run.status || '').toUpperCase();
  const isInProgress = status === 'EXECUTING' || status === 'WAITING' || status === 'RUNNING';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isInProgress) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isInProgress]);
  const duration = formatDuration(run, now);
  const isFailed = !isSkipped && (run.status?.toUpperCase() === 'FAILED' || run.status?.toUpperCase() === 'ABORTED');
  const failureInfo = isFailed ? getFailureInfo(run) : null;
  const isUnsure = !isSkipped && !isFailed && hasOutputWarning(run);

  // Pivot link — when this run references an incident via a Datastore block,
  // expose a click-through so users can jump straight to the related incident
  // from the Agent Activity view.
  const dsRef = parseDatastoreReference(run);
  const incidentKey = dsRef && isIncidentReference(dsRef) ? dsRef.key : null;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 2,
        ...(isSkipped && {
          bgcolor: 'hsla(var(--muted) / 0.2)',
        }),
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
        ...(isSkipped && {
          border: '1px dashed hsl(var(--border))',
          bgcolor: 'transparent',
        }),
      }}>
        {getRunIcon(run)}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Typography sx={{
            fontSize: '0.9rem',
            fontWeight: 500,
            color: isSkipped ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {getRunTitle(run)}
          </Typography>
          {isSkipped ? (
            <Tooltip title={skipInfo.reason || 'Workflow check determined the agent should not run'} arrow>
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 0.75,
                py: 0.125,
                borderRadius: 1,
                border: '1px dashed hsl(var(--border))',
                bgcolor: 'hsla(var(--muted) / 0.4)',
                color: 'hsl(var(--muted-foreground))',
                fontSize: '0.7rem',
                fontWeight: 500,
                lineHeight: 1.4,
              }}>
                <MinusCircle size={12} />
                Skipped — agent did not run
              </Box>
            </Tooltip>
          ) : isUnsure ? (
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'hsl(var(--severity-medium))' }}>
              <HelpCircle size={16} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', color: statusCfg.color }}>
              {statusCfg.icon}
            </Box>
          )}
          {incidentKey && (
            <Tooltip title={`Open incident ${incidentKey}`} arrow>
              <Box
                component="a"
                href={`/incidents/${incidentKey}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.875,
                  py: 0.25,
                  ml: 0.5,
                  borderRadius: 999,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--muted) / 0.4)',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: '#ff6600',
                    color: '#ff6600',
                    bgcolor: 'rgba(255, 102, 0, 0.08)',
                  },
                }}
              >
                <ExternalLink size={11} />
                Open incident
              </Box>
            </Tooltip>
          )}
        </Box>

        {isSkipped && skipInfo.reason ? (
          <Tooltip title={skipInfo.reason} arrow placement="bottom-start">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, minWidth: 0 }}>
              <Typography sx={{
                fontSize: '0.78rem',
                color: 'hsl(var(--muted-foreground))',
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: 1,
              }}>
                {skipInfo.reason}
              </Typography>
            </Box>
          </Tooltip>
        ) : isFailed && failureInfo ? (
          <Tooltip title={failureInfo.reason} arrow placement="bottom-start">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, minWidth: 0 }}>
              <AlertTriangle size={12} style={{ color: 'hsl(var(--severity-critical))', flexShrink: 0 }} />
              <Typography sx={{
                fontSize: '0.78rem',
                color: 'hsl(var(--severity-critical))',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: 1,
              }}>
                {failureInfo.reason}
              </Typography>
            </Box>
          </Tooltip>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography sx={{
              fontSize: '0.78rem',
              color: 'hsl(var(--muted-foreground))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
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
