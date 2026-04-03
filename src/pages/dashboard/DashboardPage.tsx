/**
 * Dashboard Page — Overview of AI Agent activity on incidents.
 * Highlights runs needing user approval/input prominently.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Skeleton,
  Chip,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  HelpCircle,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  RotateCcw,
  Search,
  
  MessageSquare,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AgentQuestionDialog from '@/components/agent/AgentQuestionDialog';
import AgentQuickViewDrawer, { type QuickViewItem } from '@/components/agent/AgentQuickViewDrawer';
import AgentIcon from '@/components/agent/AgentIcon';
import { useAgentActivity } from '@/hooks/useAgentActivity';
import { useAgentNotifications } from '@/hooks/useNotifications';
import { isApprovalNotification, approveAgentAction, type AgentNotification } from '@/services/notifications';
import { parseDatastoreReference, isIncidentReference, getAgentRunOutput, getIncidentTitleFromRun, getIncidentSeverityFromRun } from '@/lib/agentParsers';
import { hasOutputWarning, parseRunResult, getFailureInfo } from '@/components/agent/AgentRunResultViewer';
import {
  getRunTitle,
  getRunSubtitle,
  getTimeAgo,
  formatDuration,
  getRunIcon,
  getRunIconColor,
  STATUS_CONFIG,
} from '@/components/agent/AgentRunHeader';
import type { AgentRun } from '@/services/agentActivity';
import { useEntityPreference } from '@/hooks/useEntityLabel';
import { toast } from 'sonner';

/** Determine if a run needs user attention */
const needsUserInput = (run: AgentRun): boolean => {
  const status = run.status?.toUpperCase() || '';
  if (status === 'FAILED' || status === 'ABORTED') return true;
  if (hasOutputWarning(run)) return true;
  if (status === 'WAITING') return true;
  return false;
};

/** Determine if a run is related to incidents */
const isIncidentRun = (run: AgentRun): boolean => {
  const ref = parseDatastoreReference(run);
  return ref ? isIncidentReference(ref) : false;
};

/** Get incident key from run if it references one */
const getIncidentKey = (run: AgentRun): string | null => {
  const ref = parseDatastoreReference(run);
  return ref && isIncidentReference(ref) ? ref.key : null;
};

/** Get a human-readable description of what the AI did or needs */
const getAIDescription = (run: AgentRun, context: 'attention' | 'general' = 'general'): string => {
  const status = run.status?.toUpperCase() || '';
  const output = getAgentRunOutput(run);
  const failureInfo = (status === 'FAILED' || status === 'ABORTED') ? getFailureInfo(run) : null;

  if (context === 'attention') {
    if (status === 'WAITING') {
      const reason = output ? output.replace(/[#*`]/g, '').trim() : '';
      if (reason) return `Approval needed: ${reason.length > 140 ? reason.slice(0, 140) + '…' : reason}`;
      return 'The AI agent requires your approval before it can continue processing this incident. Review the proposed action and approve or reject it.';
    }
    if (isFailed(status)) {
      const reason = failureInfo?.reason || output?.replace(/[#*`]/g, '').trim() || '';
      if (reason) return `Failed: ${reason.length > 140 ? reason.slice(0, 140) + '…' : reason}`;
      return 'The AI agent encountered an error and could not complete this task. Manual investigation is required.';
    }
    if (hasOutputWarning(run)) {
      const detail = output ? output.replace(/[#*`]/g, '').trim() : '';
      if (detail) return `Needs review: ${detail.length > 140 ? detail.slice(0, 140) + '…' : detail}`;
      return 'The AI agent flagged uncertainty in its analysis. Please review the output and confirm or correct its findings.';
    }
  }

  if (failureInfo?.reason) return failureInfo.reason;
  if (output) {
    const clean = output.replace(/[#*`]/g, '').trim();
    return clean.length > 150 ? clean.slice(0, 150) + '…' : clean;
  }
  if (status === 'WAITING') return 'Waiting for approval to proceed';
  if (status === 'EXECUTING' || status === 'RUNNING') return 'Currently processing…';
  return getRunSubtitle(run);
};

const isFailed = (status: string) => status === 'FAILED' || status === 'ABORTED';

// ── Stat card ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  delay: number;
  isLoading?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

const StatCard = ({ icon, iconColor, iconBg, value, label, delay, isLoading, onClick, compact }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, delay }}
  >
    <Box
      onClick={onClick}
      sx={{
        px: compact ? 1.5 : 2.5,
        py: compact ? 0.75 : 2,
        borderRadius: compact ? 1.5 : 2,
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 1 : 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onClick ? { borderColor: iconColor } : {},
      }}
    >
      <Box
        sx={{
          width: compact ? 28 : 40,
          height: compact ? 28 : 40,
          borderRadius: compact ? 1 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconBg,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {compact ? <Box sx={{ '& > *': { width: 14, height: 14 } }}>{icon}</Box> : icon}
      </Box>
      <Box>
        {isLoading ? (
          <Skeleton variant="text" width={compact ? 28 : 40} height={compact ? 20 : 28} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
        ) : (
          <Typography sx={{ fontWeight: 700, fontSize: compact ? '0.875rem' : '1.25rem', lineHeight: 1.2, color: 'hsl(var(--foreground))' }}>
            {value}
          </Typography>
        )}
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: compact ? '0.6rem' : '0.75rem', lineHeight: 1.3 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  </motion.div>
);

// ── Run row (standard — for completed and running) ─────────────────────────────

const RunRow = ({ run, entityBasePath, onQuickView }: { run: AgentRun; entityBasePath: string; onQuickView: (run: AgentRun) => void }) => {
  const duration = formatDuration(run);
  const incidentKey = getIncidentKey(run);
  const incidentTitle = getIncidentTitleFromRun(run);
  const description = getAIDescription(run);
  const severity = getIncidentSeverityFromRun(run);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 2,
        borderRadius: 2,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card))',
        transition: 'border-color 0.15s ease',
        '&:hover': { borderColor: 'hsl(var(--primary) / 0.4)' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {incidentTitle || getRunTitle(run)}
          </Typography>
          <Chip
            label={severity.label}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 600,
              backgroundColor: `hsl(var(${severity.colorToken}) / 0.12)`,
              color: `hsl(var(${severity.colorToken}))`,
            }}
          />
          <Chip
            icon={<CheckCircle size={12} />}
            label="Resolved"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 600,
              backgroundColor: 'hsl(var(--severity-low) / 0.12)',
              color: 'hsl(var(--severity-low))',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
        </Box>
        <Typography sx={{
          fontSize: '0.78rem',
          color: 'hsl(var(--muted-foreground))',
          mt: 0.5,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {description}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
            {run.started_at ? getTimeAgo(run.started_at) : '—'}
          </Typography>
          {duration && (
            <>
              <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.4 }}>·</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>{duration}</Typography>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Button
          onClick={() => onQuickView(run)}
          size="small"
          variant="outlined"
          startIcon={<Eye size={14} />}
          sx={{
            fontSize: '0.75rem',
            textTransform: 'none',
            fontWeight: 500,
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            px: 1.5,
            py: 0.5,
            whiteSpace: 'nowrap',
            '&:hover': {
              borderColor: 'hsl(var(--primary) / 0.5)',
              backgroundColor: 'hsl(var(--primary) / 0.08)',
            },
          }}
        >
          Quick View
        </Button>
        {incidentKey && (
          <Tooltip title="Open incident">
            <IconButton
              component={Link}
              to={`${entityBasePath}/${incidentKey}`}
              size="small"
              sx={{
                color: 'hsl(var(--muted-foreground))',
                flexShrink: 0,
                '&:hover': { color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.08)' },
              }}
            >
              <OpenInNewIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

// ── Notification row (for agent_question notifications) ────────────────────────

interface NotificationRowProps {
  notification: AgentNotification;
  entityBasePath: string;
  onApprove: (n: AgentNotification) => void;
  onQuickView: (n: AgentNotification) => void;
  onAnswer: (n: AgentNotification) => void;
}

const NotificationRow = ({ notification, entityBasePath, onApprove, onQuickView, onAnswer }: NotificationRowProps) => {
  const isApproval = isApprovalNotification(notification);
  const timeAgo = notification.created_at
    ? getTimeAgo(new Date(notification.created_at * 1000).toISOString())
    : '—';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 2,
        borderRadius: 2,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card))',
        transition: 'border-color 0.15s ease',
        '&:hover': { borderColor: 'hsl(var(--primary) / 0.4)' },
      }}
    >
      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {notification.title}
          </Typography>
          {notification.severity && (
            <Chip
              label={notification.severity}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--severity-high) / 0.12)',
                color: 'hsl(var(--severity-high))',
              }}
            />
          )}
          <Chip
            icon={isApproval ? <Clock size={12} /> : <HelpCircle size={12} />}
            label={isApproval ? 'Approval Needed' : 'Questions'}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 600,
              backgroundColor: isApproval
                ? 'hsl(var(--severity-info) / 0.12)'
                : 'hsl(var(--severity-medium) / 0.12)',
              color: isApproval
                ? 'hsl(var(--severity-info))'
                : 'hsl(var(--severity-medium))',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
        </Box>

        <Typography sx={{
          fontSize: '0.78rem',
          color: 'hsl(var(--muted-foreground))',
          mt: 0.5,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {notification.description}
        </Typography>

        {isApproval && notification.action && notification.action !== notification.description && (
          <Box sx={{
            mt: 1,
            px: 1.5,
            py: 1,
            borderRadius: 1.5,
            backgroundColor: 'hsl(var(--severity-info) / 0.06)',
            border: '1px solid hsl(var(--severity-info) / 0.15)',
          }}>
            <Typography sx={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'hsl(var(--severity-info))',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              mb: 0.25,
            }}>
              Proposed Action
            </Typography>
            <Typography sx={{
              fontSize: '0.78rem',
              color: 'hsl(var(--foreground))',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {notification.action}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
            {timeAgo}
          </Typography>
        </Box>
      </Box>

      {/* CTAs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {isApproval ? (
          <>
            <Button
              onClick={() => onApprove(notification)}
              size="small"
              variant="contained"
              startIcon={<CheckCircle size={14} />}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--severity-low))',
                color: 'hsl(var(--primary-foreground))',
                px: 2,
                py: 0.5,
                boxShadow: 'none',
                whiteSpace: 'nowrap',
                '&:hover': {
                  backgroundColor: 'hsl(var(--severity-low) / 0.9)',
                  boxShadow: 'none',
                },
              }}
            >
              Approve
            </Button>
            <Button
              onClick={() => onQuickView(notification)}
              size="small"
              variant="outlined"
              startIcon={<Eye size={14} />}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                fontWeight: 500,
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                px: 1.5,
                py: 0.5,
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: 'hsl(var(--primary) / 0.5)',
                  backgroundColor: 'hsl(var(--primary) / 0.08)',
                },
              }}
            >
              Quick View
            </Button>
          </>
        ) : (
          <Button
            onClick={() => onAnswer(notification)}
            size="small"
            variant="contained"
            startIcon={<MessageSquare size={14} />}
            sx={{
              fontSize: '0.75rem',
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              px: 2,
              py: 0.5,
              boxShadow: 'none',
              whiteSpace: 'nowrap',
              '&:hover': {
                backgroundColor: 'hsl(var(--primary) / 0.9)',
                boxShadow: 'none',
              },
            }}
          >
            Answer Questions
          </Button>
        )}

        {notification.incident_id && (
          <Tooltip title="Open incident">
            <IconButton
              component={Link}
              to={`${entityBasePath}/${notification.incident_id}`}
              size="small"
              sx={{
                color: 'hsl(var(--muted-foreground))',
                flexShrink: 0,
                '&:hover': { color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.08)' },
              }}
            >
              <OpenInNewIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        {notification.reference_url && !notification.incident_id && (
          <Tooltip title="Open incident">
            <IconButton
              component={Link}
              to={notification.reference_url}
              size="small"
              sx={{
                color: 'hsl(var(--muted-foreground))',
                flexShrink: 0,
                '&:hover': { color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.08)' },
              }}
            >
              <OpenInNewIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

// ── Attention row (for agent runs that failed/need review) ─────────────────────

const AttentionRunRow = ({ run, entityBasePath, onViewDetails }: { run: AgentRun; entityBasePath: string; onViewDetails: (run: AgentRun) => void }) => {
  const incidentKey = getIncidentKey(run);
  const incidentTitle = getIncidentTitleFromRun(run);
  const description = getAIDescription(run, 'attention');
  const duration = formatDuration(run);
  const status = run.status?.toUpperCase() || '';
  const runFailed = status === 'FAILED' || status === 'ABORTED';
  const isUnsure = hasOutputWarning(run);
  const rawSeverity = getIncidentSeverityFromRun(run);
  const severity = rawSeverity.level === 'unknown'
    ? { level: 'high' as const, label: 'High', colorToken: '--severity-high' }
    : rawSeverity;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 2,
        borderRadius: 2,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card))',
        transition: 'border-color 0.15s ease',
        '&:hover': { borderColor: 'hsl(var(--primary) / 0.4)' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {incidentTitle || getRunTitle(run)}
          </Typography>
          <Chip
            label={severity.label}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 600,
              backgroundColor: `hsl(var(${severity.colorToken}) / 0.12)`,
              color: `hsl(var(${severity.colorToken}))`,
            }}
          />
          {runFailed && (
            <Chip
              label={status === 'ABORTED' ? 'Aborted' : 'Failed'}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--severity-critical) / 0.12)',
                color: 'hsl(var(--severity-critical))',
              }}
            />
          )}
          {isUnsure && (
            <Chip
              icon={<HelpCircle size={12} />}
              label="Unsure"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--severity-medium) / 0.12)',
                color: 'hsl(var(--severity-medium))',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          )}
          {status === 'WAITING' && (
            <Chip
              icon={<Clock size={12} />}
              label="Waiting"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--severity-info) / 0.12)',
                color: 'hsl(var(--severity-info))',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          )}
        </Box>

        <Typography sx={{
          fontSize: '0.78rem',
          color: runFailed ? 'hsl(var(--severity-critical) / 0.85)' : 'hsl(var(--muted-foreground))',
          mt: 0.5,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {description}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
            {run.started_at ? getTimeAgo(run.started_at) : '—'}
          </Typography>
          {duration && (
            <>
              <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.4 }}>·</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>{duration}</Typography>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Button
          onClick={() => onViewDetails(run)}
          size="small"
          variant="outlined"
          startIcon={<Eye size={14} />}
          sx={{
            fontSize: '0.75rem',
            textTransform: 'none',
            fontWeight: 500,
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            px: 1.5,
            py: 0.5,
            whiteSpace: 'nowrap',
            '&:hover': {
              borderColor: 'hsl(var(--primary) / 0.5)',
              backgroundColor: 'hsl(var(--primary) / 0.08)',
            },
          }}
        >
          Quick View
        </Button>
        {incidentKey && (
          <Tooltip title="Open incident">
            <IconButton
              component={Link}
              to={`${entityBasePath}/${incidentKey}?agent_action=${run.execution_id}`}
              size="small"
              sx={{
                color: 'hsl(var(--muted-foreground))',
                flexShrink: 0,
                '&:hover': { color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.08)' },
              }}
            >
              <OpenInNewIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const DashboardPage = () => {
  const { runs, isLoading, stats, refresh } = useAgentActivity();
  const { notifications, isLoading: notificationsLoading, refresh: refreshNotifications } = useAgentNotifications();
  const { singular: entitySingular, basePath: entityBasePath } = useEntityPreference();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [questionNotification, setQuestionNotification] = useState<AgentNotification | null>(null);
  const [quickViewItem, setQuickViewItem] = useState<QuickViewItem | null>(null);
  const [attentionPage, setAttentionPage] = useState(0);
  const [completedPage, setCompletedPage] = useState(0);
  const [attentionFilter, setAttentionFilter] = useState<'all' | 'failed' | 'approval' | 'question'>('all');
  const [isSticky, setIsSticky] = useState(false);
  const statCardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (statCardsRef.current) {
        const rect = statCardsRef.current.getBoundingClientRect();
        setIsSticky(rect.top < 0);
      }
    };
    const scrollContainer = document.querySelector('main') || window;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refresh(), refreshNotifications()]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleApprove = async (notification: AgentNotification) => {
    try {
      await approveAgentAction(notification.id);
      toast.success('Action approved — the agent will continue.');
      refreshNotifications();
    } catch {
      toast.error('Failed to approve action.');
    }
  };

  const handleConfigureApprove = async (notificationId: string, modifiedAction?: string) => {
    try {
      // For now, approve the notification (modified action could be sent in a future API extension)
      await approveAgentAction(notificationId);
      toast.success(modifiedAction ? 'Modified action submitted.' : 'Action approved.');
      refreshNotifications();
    } catch {
      toast.error('Failed to approve action.');
    }
  };

  const handleSubmitAnswers = async (notificationId: string, answers: Record<number, string>) => {
    try {
      await approveAgentAction(notificationId);
      toast.success('Answers submitted — the agent will continue.');
      refreshNotifications();
    } catch {
      toast.error('Failed to submit answers.');
    }
  };

  // Categorise runs (excluding WAITING since those are now handled by notifications)
  const { needsAttention, incidentRuns, recentCompleted, activeRuns } = useMemo(() => {
    const attention: AgentRun[] = [];
    const incidents: AgentRun[] = [];
    const completed: AgentRun[] = [];
    const active: AgentRun[] = [];

    for (const run of runs) {
      const status = run.status?.toUpperCase() || '';
      if (needsUserInput(run)) attention.push(run);
      if (isIncidentRun(run)) incidents.push(run);
      if (status === 'EXECUTING' || status === 'RUNNING') active.push(run);
      if (status === 'FINISHED' || status === 'SUCCESS') completed.push(run);
    }

    return {
      needsAttention: attention,
      incidentRuns: incidents,
      recentCompleted: completed,
      activeRuns: active,
    };
  }, [runs]);

  // Combine attention items: notifications first, then run-based
  const allAttentionItems = useMemo(() => {
    const notifItems = notifications.map(n => ({ type: 'notification' as const, notification: n }));
    const runItems = needsAttention.map(r => ({ type: 'run' as const, run: r }));
    return [...notifItems, ...runItems];
  }, [notifications, needsAttention]);

  // Filter attention items
  const filteredAttentionItems = useMemo(() => {
    if (attentionFilter === 'all') return allAttentionItems;
    return allAttentionItems.filter(item => {
      if (attentionFilter === 'approval') {
        return item.type === 'notification' && isApprovalNotification(item.notification);
      }
      if (attentionFilter === 'question') {
        return item.type === 'notification' && !isApprovalNotification(item.notification);
      }
      if (attentionFilter === 'failed') {
        if (item.type === 'run') return true; // all attention runs are failed/unsure
        return false;
      }
      return true;
    });
  }, [allAttentionItems, attentionFilter]);

  // Count per filter for badges
  const attentionCounts = useMemo(() => ({
    failed: allAttentionItems.filter(i => i.type === 'run').length,
    approval: allAttentionItems.filter(i => i.type === 'notification' && isApprovalNotification(i.notification)).length,
    question: allAttentionItems.filter(i => i.type === 'notification' && !isApprovalNotification(i.notification)).length,
  }), [allAttentionItems]);

  const totalAttentionCount = allAttentionItems.length;
  const filteredAttentionCount = filteredAttentionItems.length;
  const attentionTotalPages = Math.ceil(filteredAttentionCount / ITEMS_PER_PAGE);
  const paginatedAttention = filteredAttentionItems.slice(attentionPage * ITEMS_PER_PAGE, (attentionPage + 1) * ITEMS_PER_PAGE);

  const completedTotalPages = Math.ceil(recentCompleted.length / ITEMS_PER_PAGE);
  const paginatedCompleted = recentCompleted.slice(completedPage * ITEMS_PER_PAGE, (completedPage + 1) * ITEMS_PER_PAGE);

  return (
    <>
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Dashboard
          </Typography>
          {(isLoading || notificationsLoading) && !isRefreshing && (
            <Loader2 size={18} style={{ color: 'hsl(var(--muted-foreground))', animation: 'spin 1s linear infinite' }} />
          )}
        </Box>
        <Tooltip title="Refresh">
          <IconButton
            onClick={handleRefresh}
            size="small"
            sx={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <RefreshIcon
              fontSize="small"
              sx={{
                transition: 'transform 0.6s ease',
                ...(isRefreshing && { animation: 'spin 0.6s linear' }),
              }}
            />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mb: 4 }}>
        AI Agent overview — see what's happening and what needs your attention.
      </Typography>

      {/* Stat cards - original position (used as scroll sentinel) */}
      <Box ref={statCardsRef} sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        <StatCard
          icon={<AlertTriangle size={18} />}
          iconColor="hsl(var(--severity-high))"
          iconBg="hsl(var(--severity-high) / 0.12)"
          value={totalAttentionCount}
          label="Needs Your Input"
          delay={0}
          isLoading={isLoading && notificationsLoading}
          onClick={() => document.getElementById('section-attention')?.scrollIntoView({ behavior: 'smooth' })}
        />
        <StatCard
          icon={<Loader2 size={18} />}
          iconColor="hsl(var(--severity-medium))"
          iconBg="hsl(var(--severity-medium) / 0.12)"
          value={activeRuns.length}
          label="Currently Running"
          delay={0.05}
          isLoading={isLoading}
          onClick={() => document.getElementById('section-running')?.scrollIntoView({ behavior: 'smooth' })}
        />
        <StatCard
          icon={<CheckCircle size={18} />}
          iconColor="hsl(var(--severity-low))"
          iconBg="hsl(var(--severity-low) / 0.12)"
          value={stats.successCount}
          label="Completed"
          delay={0.1}
          isLoading={isLoading}
          onClick={() => document.getElementById('section-completed')?.scrollIntoView({ behavior: 'smooth' })}
        />
        <StatCard
          icon={<Clock size={18} />}
          iconColor="hsl(var(--primary))"
          iconBg="hsl(var(--primary) / 0.12)"
          value={stats.avgDuration > 0 ? `${stats.avgDuration.toFixed(0)}s` : '—'}
          label="Avg Duration"
          delay={0.15}
          isLoading={isLoading}
        />
      </Box>

      {/* Sticky compact stat bar */}
      <Box
        sx={{
          position: 'sticky',
          top: -32,
          zIndex: 1100,
          transform: isSticky ? 'translateY(0)' : 'translateY(-100%)',
          opacity: isSticky ? 1 : 0,
          transition: 'transform 0.25s ease, opacity 0.25s ease',
          backgroundColor: 'hsl(var(--background) / 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid hsl(var(--border))',
          mx: -4,
          px: 4,
          py: 1,
          mb: isSticky ? 2 : -6,
        }}
      >
        <Box sx={{ maxWidth: 1400, mx: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
          <StatCard
            icon={<AlertTriangle size={18} />}
            iconColor="hsl(var(--severity-high))"
            iconBg="hsl(var(--severity-high) / 0.12)"
            value={totalAttentionCount}
            label="Needs Your Input"
            delay={0}
            isLoading={isLoading && notificationsLoading}
            onClick={() => document.getElementById('section-attention')?.scrollIntoView({ behavior: 'smooth' })}
            compact
          />
          <StatCard
            icon={<Loader2 size={18} />}
            iconColor="hsl(var(--severity-medium))"
            iconBg="hsl(var(--severity-medium) / 0.12)"
            value={activeRuns.length}
            label="Currently Running"
            delay={0}
            isLoading={isLoading}
            onClick={() => document.getElementById('section-running')?.scrollIntoView({ behavior: 'smooth' })}
            compact
          />
          <StatCard
            icon={<CheckCircle size={18} />}
            iconColor="hsl(var(--severity-low))"
            iconBg="hsl(var(--severity-low) / 0.12)"
            value={stats.successCount}
            label="Completed"
            delay={0}
            isLoading={isLoading}
            onClick={() => document.getElementById('section-completed')?.scrollIntoView({ behavior: 'smooth' })}
            compact
          />
          <StatCard
            icon={<Clock size={18} />}
            iconColor="hsl(var(--primary))"
            iconBg="hsl(var(--primary) / 0.12)"
            value={stats.avgDuration > 0 ? `${stats.avgDuration.toFixed(0)}s` : '—'}
            label="Avg Duration"
            delay={0}
            isLoading={isLoading}
            compact
          />
        </Box>
      </Box>

      {/* Needs Attention Section */}
      <Box id="section-attention" sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AlertTriangle size={18} style={{ color: 'hsl(var(--severity-high))' }} />
          <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
            Needs Your Attention
          </Typography>
          {totalAttentionCount > 0 && (
            <Chip
              label={totalAttentionCount}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--severity-high) / 0.15)',
                color: 'hsl(var(--severity-high))',
              }}
            />
          )}
        </Box>

        {/* Filter chips */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {([
            { key: 'all' as const, label: 'All', count: totalAttentionCount },
            { key: 'failed' as const, label: 'Failed / Unsure', count: attentionCounts.failed },
            { key: 'approval' as const, label: 'Needs Approval', count: attentionCounts.approval },
            { key: 'question' as const, label: 'Pending Question', count: attentionCounts.question },
          ]).map(f => (
            <Chip
              key={f.key}
              label={`${f.label}${f.count > 0 ? ` (${f.count})` : ''}`}
              size="small"
              variant={attentionFilter === f.key ? 'filled' : 'outlined'}
              onClick={() => { setAttentionFilter(f.key); setAttentionPage(0); }}
              sx={{
                fontSize: '0.75rem',
                height: 28,
                borderColor: attentionFilter === f.key ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                bgcolor: attentionFilter === f.key ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                color: attentionFilter === f.key ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--muted))' },
              }}
            />
          ))}
        </Box>

        {(isLoading && notificationsLoading) && filteredAttentionCount === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 2, bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ))}
          </Box>
        ) : filteredAttentionCount === 0 ? (
          <Box
            sx={{
              px: 3,
              py: 4,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
              textAlign: 'center',
            }}
          >
            <CheckCircle size={28} style={{ color: 'hsl(var(--severity-low))', marginBottom: 8 }} />
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
              All clear — the agent is handling everything autonomously.
            </Typography>
          </Box>
        ) : (
          <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {paginatedAttention.map((item) =>
              item.type === 'notification' ? (
                <motion.div
                  key={item.notification.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <NotificationRow
                    notification={item.notification}
                    entityBasePath={entityBasePath}
                    onApprove={handleApprove}
                    onQuickView={(n) => setQuickViewItem({ type: 'notification', notification: n })}
                    onAnswer={setQuestionNotification}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={item.run.execution_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <AttentionRunRow run={item.run} entityBasePath={entityBasePath} onViewDetails={(r) => setQuickViewItem({ type: 'run', run: r })} />
                </motion.div>
              )
            )}
          </Box>
          {attentionTotalPages > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
              <Button
                size="small"
                disabled={attentionPage === 0}
                onClick={() => setAttentionPage(p => p - 1)}
                sx={{
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  color: 'hsl(var(--foreground))',
                  minWidth: 32,
                  '&.Mui-disabled': { color: 'hsl(var(--muted-foreground) / 0.4)' },
                }}
              >
                Previous
              </Button>
              <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                {attentionPage + 1} / {attentionTotalPages}
              </Typography>
              <Button
                size="small"
                disabled={attentionPage >= attentionTotalPages - 1}
                onClick={() => setAttentionPage(p => p + 1)}
                sx={{
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  color: 'hsl(var(--foreground))',
                  minWidth: 32,
                  '&.Mui-disabled': { color: 'hsl(var(--muted-foreground) / 0.4)' },
                }}
              >
                Next
              </Button>
            </Box>
          )}
          </>
        )}
      </Box>

      {/* Currently Running */}
      {activeRuns.length > 0 && (
        <Box id="section-running" sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Loader2 size={18} style={{ color: 'hsl(var(--severity-medium))', animation: 'spin 2s linear infinite' }} />
            <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
              Currently Running
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {activeRuns.map((run) => (
              <RunRow key={run.execution_id} run={run} entityBasePath={entityBasePath} onQuickView={(r) => setQuickViewItem({ type: 'run', run: r })} />
            ))}
          </Box>
        </Box>
      )}

      {/* Recent Activity */}
      <Box id="section-completed">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
            Recent Completed
          </Typography>
          <Chip
            label="View all activity →"
            component={Link}
            to="/agent"
            clickable
            size="small"
            sx={{
              height: 26,
              fontSize: '0.75rem',
              backgroundColor: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
              '&:hover': { backgroundColor: 'hsl(var(--muted) / 0.8)' },
            }}
          />
        </Box>
        {isLoading && recentCompleted.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 2, bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ))}
          </Box>
        ) : recentCompleted.length === 0 ? (
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem', py: 3, textAlign: 'center' }}>
            No completed runs yet.
          </Typography>
        ) : (
          <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {paginatedCompleted.map((run) => (
              <RunRow key={run.execution_id} run={run} entityBasePath={entityBasePath} onQuickView={(r) => setQuickViewItem({ type: 'run', run: r })} />
            ))}
          </Box>
          {completedTotalPages > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
              <Button
                size="small"
                disabled={completedPage === 0}
                onClick={() => setCompletedPage(p => p - 1)}
                sx={{
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  color: 'hsl(var(--foreground))',
                  minWidth: 32,
                  '&.Mui-disabled': { color: 'hsl(var(--muted-foreground) / 0.4)' },
                }}
              >
                Previous
              </Button>
              <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                {completedPage + 1} / {completedTotalPages}
              </Typography>
              <Button
                size="small"
                disabled={completedPage >= completedTotalPages - 1}
                onClick={() => setCompletedPage(p => p + 1)}
                sx={{
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  color: 'hsl(var(--foreground))',
                  minWidth: 32,
                  '&.Mui-disabled': { color: 'hsl(var(--muted-foreground) / 0.4)' },
                }}
              >
                Next
              </Button>
            </Box>
          )}
          </>
        )}
      </Box>
    </Box>

    <AgentQuestionDialog
      open={!!questionNotification}
      onClose={() => setQuestionNotification(null)}
      notification={questionNotification}
      onSubmit={handleSubmitAnswers}
    />

    <AgentQuickViewDrawer
      open={!!quickViewItem}
      onClose={() => setQuickViewItem(null)}
      item={quickViewItem}
      entityBasePath={entityBasePath}
      onApprove={handleApprove}
      onConfigureApprove={handleConfigureApprove}
      onSubmitAnswers={handleSubmitAnswers}
    />
    </>
  );
};

export default DashboardPage;
