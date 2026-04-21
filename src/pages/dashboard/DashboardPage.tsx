/**
 * Dashboard Page — CTA-focused setup guide + AI Agent notifications.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Skeleton,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Avatar,
  LinearProgress,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  HelpCircle,
  Clock,
  Eye,
  MessageSquare,
  ChevronRight,
  Plug,
  KeyRound,
  ArrowDownToLine,
  Send,
  Radar,
  Monitor,
  Shield,
  Sparkles,
  Check,
  ArrowRight,
  ExternalLink,
  EyeOff,
  Undo2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AgentQuestionDialog from '@/components/agent/AgentQuestionDialog';
import AgentQuickViewDrawer, { type QuickViewItem } from '@/components/agent/AgentQuickViewDrawer';
import { useAgentNotifications } from '@/hooks/useNotifications';
import { isApprovalNotification, approveAgentAction, type AgentNotification } from '@/services/notifications';
import { getTimeAgo } from '@/components/agent/AgentRunHeader';
import { useEntityPreference } from '@/hooks/useEntityLabel';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useWorkflows } from '@/hooks/useWorkflows';
import { findIngestTicketsWorkflow } from '@/lib/ingestionDetection';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { toast } from 'sonner';
import { DemoModeCard } from '@/components/demo/DemoModeCard';

// ── Setup Step ─────────────────────────────────────────────────────────────────

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'complete' | 'action-needed' | 'not-started';
  ctaLabel: string;
  ctaPath: string;
  priority: number; // lower = more important
  detail?: string;
  disabled?: boolean;
  disabledReason?: string;
}

const statusColors = {
  'complete': { dot: 'hsl(var(--severity-low))', bg: 'hsl(var(--severity-low) / 0.08)', border: 'hsl(var(--severity-low) / 0.2)' },
  'action-needed': { dot: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.08)', border: 'hsl(var(--primary) / 0.25)' },
  'not-started': { dot: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--muted) / 0.3)', border: 'hsl(var(--border))' },
};

const IGNORED_STEPS_KEY = 'shuffle_setup_ignored_steps';

const SetupStepCard = ({ step, index, ignored, onIgnore, onRestore }: {
  step: SetupStep;
  index: number;
  ignored?: boolean;
  onIgnore?: (id: string) => void;
  onRestore?: (id: string) => void;
}) => {
  const navigate = useNavigate();
  const colors = ignored
    ? { dot: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--muted) / 0.15)', border: 'hsl(var(--border))' }
    : statusColors[step.status];
  const isComplete = step.status === 'complete';
  const isDisabled = !!step.disabled && !isComplete && !ignored;
  const isInteractive = !isComplete && !ignored && !isDisabled;

  const cardContent = (
    <Box
      onClick={() => isInteractive && navigate(step.ctaPath)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 2,
        borderRadius: 2,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bg,
        cursor: isInteractive ? 'pointer' : isDisabled ? 'not-allowed' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': isInteractive ? {
          borderColor: 'hsl(var(--primary) / 0.5)',
          backgroundColor: 'hsl(var(--primary) / 0.06)',
        } : {},
        opacity: isComplete || ignored ? 0.5 : isDisabled ? 0.55 : 1,
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ignored || isDisabled ? 'hsl(var(--muted) / 0.3)' : isComplete ? 'hsl(var(--severity-low) / 0.15)' : 'hsl(var(--primary) / 0.12)',
          color: ignored || isDisabled ? 'hsl(var(--muted-foreground))' : isComplete ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))',
          flexShrink: 0,
        }}
      >
        {ignored ? <EyeOff size={20} /> : isComplete ? <Check size={20} /> : step.icon}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: ignored || isDisabled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
            textDecoration: isComplete || ignored ? 'line-through' : 'none',
          }}>
            {step.title}
          </Typography>
          {isComplete && !ignored && (
            <Chip
              label="Done"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--severity-low) / 0.15)',
                color: 'hsl(var(--severity-low))',
              }}
            />
          )}
          {ignored && (
            <Chip
              label="Ignored"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--muted) / 0.3)',
                color: 'hsl(var(--muted-foreground))',
              }}
            />
          )}
          {isDisabled && (
            <Chip
              label="Locked"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--muted) / 0.3)',
                color: 'hsl(var(--muted-foreground))',
              }}
            />
          )}
        </Box>
        <Typography sx={{
          fontSize: '0.78rem',
          color: 'hsl(var(--muted-foreground))',
          mt: 0.25,
        }}>
          {step.description}
        </Typography>
        {step.detail && !isComplete && !ignored && !isDisabled && (
          <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', mt: 0.5, fontWeight: 500 }}>
            {step.detail}
          </Typography>
        )}
        {isDisabled && step.disabledReason && (
          <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', mt: 0.5, fontWeight: 500 }}>
            {step.disabledReason}
          </Typography>
        )}
      </Box>

      {/* Actions */}
      {ignored ? (
        <Tooltip title="Restore this step">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onRestore?.(step.id); }}
            sx={{
              color: 'hsl(var(--muted-foreground))',
              '&:hover': { color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.08)' },
            }}
          >
            <Undo2 size={16} />
          </IconButton>
        </Tooltip>
      ) : !isComplete && !isDisabled ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Tooltip title="Ignore this step">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onIgnore?.(step.id); }}
              sx={{
                color: 'hsl(var(--muted-foreground))',
                opacity: 0.5,
                '&:hover': { opacity: 1, color: 'hsl(var(--muted-foreground))' },
              }}
            >
              <EyeOff size={14} />
            </IconButton>
          </Tooltip>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--primary))', whiteSpace: 'nowrap' }}>
            {step.ctaLabel}
          </Typography>
          <ChevronRight size={16} style={{ color: 'hsl(var(--primary))' }} />
        </Box>
      ) : null}
    </Box>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
    >
      {isDisabled && step.disabledReason ? (
        <Tooltip title={step.disabledReason} placement="top">
          <Box>{cardContent}</Box>
        </Tooltip>
      ) : cardContent}
    </motion.div>
  );
};

// ── Notification row ──────────────────────────────────────────────────────────

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
          {!isApproval && (
            <Chip
              icon={<HelpCircle size={12} />}
              label="Questions"
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
            background: 'var(--agent-gradient-subtle)',
          }}>
            <Typography sx={{
              fontSize: '0.72rem',
              fontWeight: 600,
              background: 'var(--agent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {isApproval ? (
          <>
            <Button
              data-tour="agent-approve-button"
              onClick={() => onApprove(notification)}
              size="small"
              variant="contained"
              startIcon={<CheckCircle size={14} />}
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

// ── Page ───────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const DashboardPage = () => {
  const navigate = useNavigate();
  const { notifications, isLoading, refresh: refreshNotifications } = useAgentNotifications();
  const { singular: entitySingular, basePath: entityBasePath } = useEntityPreference();
  const { authenticatedApps, loading: authLoading } = useAppAuth();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ignoredSteps, setIgnoredSteps] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(IGNORED_STEPS_KEY) || '[]');
    } catch { return []; }
  });
  const [questionNotification, setQuestionNotification] = useState<AgentNotification | null>(null);
  const [quickViewItem, setQuickViewItem] = useState<QuickViewItem | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'approval' | 'question'>('all');
  const [hasRunningSensor, setHasRunningSensor] = useState<boolean | null>(null);

  // Check for running detection sensors
  useEffect(() => {
    const checkSensors = async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (res.ok) {
          const envs = await res.json();
          const now = Math.floor(Date.now() / 1000);
          const running = Array.isArray(envs) && envs.some(
            (e: any) => e.Type === 'onprem' && e.checkin > 0 && (now - e.checkin) < 300 && e.data_lake?.enabled === true
          );
          setHasRunningSensor(running);
        } else {
          setHasRunningSensor(false);
        }
      } catch {
        setHasRunningSensor(false);
      }
    };
    checkSensors();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshNotifications();
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

  // ── Derive setup step statuses ──────────────────────────────────────────────

  const setupSteps = useMemo((): SetupStep[] => {
    const activatedApps = authenticatedApps.filter(a => a.active);
    const validatedApps = authenticatedApps.filter(a => a.validation?.valid);
    const hasActivatedApps = activatedApps.length > 0;
    const hasAuthenticatedApps = validatedApps.length > 0;

    const workflowList = Array.isArray(workflows) ? workflows : [];
    const ingestWorkflow = findIngestTicketsWorkflow(workflowList);
    const hasIngest = !!ingestWorkflow;

    // Detection: check for a running sensor (fetched via useEffect)
    const hasDetection = hasRunningSensor === true;

    // Vulnerability: check for vuln-scanner related workflows
    const hasVulnSetup = workflowList.some(w =>
      w.name?.toLowerCase().includes('vulnerabilit') ||
      (w.tags || []).some((t: string) => t.toLowerCase().includes('vuln'))
    );

    const steps: SetupStep[] = [
      {
        id: 'setup-endpoints',
        title: 'Set up host monitors',
        description: 'Deploy lightweight host monitors to check compliance, encryption, and posture.',
        icon: <Monitor size={20} />,
        status: 'not-started',
        ctaLabel: 'Set Up',
        ctaPath: '/monitors?add_host=true',
        priority: 1,
      },
      {
        id: 'activate-apps',
        title: 'Activate apps',
        description: 'Browse the app catalog and activate the tools your team uses.',
        icon: <Plug size={20} />,
        status: hasActivatedApps ? 'complete' : 'not-started',
        ctaLabel: 'Browse Apps',
        ctaPath: '/apps',
        priority: 2,
        detail: hasActivatedApps ? undefined : 'Activate at least one app to unlock other steps.',
      },
      {
        id: 'authenticate-apps',
        title: 'Authenticate apps',
        description: hasActivatedApps && !hasAuthenticatedApps
          ? `You have ${activatedApps.length} app${activatedApps.length !== 1 ? 's' : ''} activated but none authenticated yet.`
          : hasAuthenticatedApps
          ? `${validatedApps.length} app${validatedApps.length !== 1 ? 's' : ''} authenticated and validated.`
          : 'Add API keys or OAuth credentials so Shuffle can interact with your tools.',
        icon: <KeyRound size={20} />,
        status: hasAuthenticatedApps ? 'complete' : hasActivatedApps ? 'action-needed' : 'not-started',
        ctaLabel: 'Set Up Auth',
        ctaPath: '/onboarding/authenticate',
        priority: 3,
        detail: hasActivatedApps && !hasAuthenticatedApps
          ? `${activatedApps.length} activated — add credentials to connect.`
          : undefined,
        disabled: activatedApps.length < 2,
        disabledReason: activatedApps.length < 2 ? 'Activate at least 2 apps first' : undefined,
      },
      {
        id: 'enable-ingest',
        title: 'Enable incident ingestion',
        description: hasIngest
          ? 'Incident ingestion is configured and pulling data.'
          : 'Set up automatic ingestion to pull incidents from your connected tools.',
        icon: <ArrowDownToLine size={20} />,
        status: hasIngest ? 'complete' : hasAuthenticatedApps ? 'action-needed' : 'not-started',
        ctaLabel: 'Configure',
        ctaPath: '/incidents',
        priority: 4,
      },
      {
        id: 'setup-vulns',
        title: 'Set up vulnerability ingestion',
        description: hasVulnSetup
          ? 'Vulnerability scanners are connected and feeding data.'
          : 'Connect vulnerability scanners to track CVEs, misconfigs, and identity risks.',
        icon: <Shield size={20} />,
        status: hasVulnSetup ? 'complete' : 'not-started',
        ctaLabel: 'Set Up',
        ctaPath: '/vulnerabilities',
        priority: 5,
      },
      {
        id: 'setup-detection',
        title: 'Set up log ingestion',
        description: hasDetection
          ? 'Log ingestion is running and forwarding events to detection.'
          : 'Set up log ingestion to collect logs, network traffic, and endpoint events.',
        icon: <Radar size={20} />,
        status: hasDetection ? 'complete' : 'not-started',
        ctaLabel: 'Set Up',
        ctaPath: '/detection',
        priority: 6,
      },
    ];
    // Preserve the explicit priority order requested by the user
    steps.sort((a, b) => a.priority - b.priority);

    return steps;
  }, [authenticatedApps, workflows, hasRunningSensor]);

  const handleIgnoreStep = (id: string) => {
    const next = [...ignoredSteps, id];
    setIgnoredSteps(next);
    localStorage.setItem(IGNORED_STEPS_KEY, JSON.stringify(next));
  };

  const handleRestoreStep = (id: string) => {
    const next = ignoredSteps.filter(s => s !== id);
    setIgnoredSteps(next);
    localStorage.setItem(IGNORED_STEPS_KEY, JSON.stringify(next));
  };

  const visibleSteps = setupSteps.filter(s => !ignoredSteps.includes(s.id));
  const ignoredStepsList = setupSteps.filter(s => ignoredSteps.includes(s.id));
  const completedCount = visibleSteps.filter(s => s.status === 'complete').length;
  const totalSteps = visibleSteps.length;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 100;
  const allComplete = completedCount === totalSteps;
  const setupLoading = authLoading || workflowsLoading;

  // Notification counts & filter
  const approvalCount = notifications.filter(n => isApprovalNotification(n)).length;
  const questionCount = notifications.filter(n => !isApprovalNotification(n)).length;
  const totalCount = notifications.length;

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'approval') return notifications.filter(n => isApprovalNotification(n));
    if (filter === 'question') return notifications.filter(n => !isApprovalNotification(n));
    return notifications;
  }, [notifications, filter]);

  const filteredCount = filteredNotifications.length;
  const totalPages = Math.ceil(filteredCount / ITEMS_PER_PAGE);
  const paginated = filteredNotifications.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  return (
    <>
    <Box sx={{ maxWidth: 1100, width: '100%', mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Dashboard
          </Typography>
          {(isLoading || setupLoading) && !isRefreshing && (
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
        Get started by completing the setup steps below, then monitor agent activity.
      </Typography>

      {/* ── Demo Mode CTA ────────────────────────────────────────────────────── */}
      <DemoModeCard />

      {/* ── Setup Checklist ──────────────────────────────────────────────────── */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Sparkles size={18} style={{ color: 'hsl(var(--primary))' }} />
            <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
              Setup Guide
            </Typography>
            <Chip
              label={`${completedCount}/${totalSteps}`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: allComplete ? 'hsl(var(--severity-low) / 0.15)' : 'hsl(var(--primary) / 0.15)',
                color: allComplete ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))',
              }}
            />
          </Box>
        </Box>

        {/* Progress bar */}
        <Box sx={{ mb: 2.5 }}>
          <LinearProgress
            variant={setupLoading ? 'indeterminate' : 'determinate'}
            value={progressPercent}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'hsl(var(--muted))',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                backgroundColor: allComplete ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))',
                transition: 'transform 0.6s ease',
              },
            }}
          />
        </Box>

        {/* Steps */}
        {setupLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} variant="rounded" height={68} sx={{ borderRadius: 2, bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {visibleSteps.map((step, i) => (
              <SetupStepCard key={step.id} step={step} index={i} onIgnore={handleIgnoreStep} onRestore={handleRestoreStep} />
            ))}
            {ignoredStepsList.length > 0 && (
              <>
                <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', mt: 1, opacity: 0.7 }}>
                  Ignored ({ignoredStepsList.length})
                </Typography>
                {ignoredStepsList.map((step, i) => (
                  <SetupStepCard key={step.id} step={step} index={visibleSteps.length + i} ignored onRestore={handleRestoreStep} />
                ))}
              </>
            )}
          </Box>
        )}
      </Box>

      {/* ── Agent Notifications ──────────────────────────────────────────────── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AlertTriangle size={18} style={{ color: 'hsl(var(--severity-high))' }} />
          <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
            Agent Notifications
          </Typography>
          {totalCount > 0 && (
            <Chip
              label={totalCount}
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
            { key: 'all' as const, label: 'All', count: totalCount },
            { key: 'approval' as const, label: 'Needs Approval', count: approvalCount },
            { key: 'question' as const, label: 'Pending Question', count: questionCount },
          ]).map(f => (
            <Chip
              key={f.key}
              label={`${f.label}${f.count > 0 ? ` (${f.count})` : ''}`}
              size="small"
              variant={filter === f.key ? 'filled' : 'outlined'}
              onClick={() => { setFilter(f.key); setCurrentPage(0); }}
              sx={{
                fontSize: '0.75rem',
                height: 28,
                borderColor: filter === f.key ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                bgcolor: filter === f.key ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                color: filter === f.key ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--muted))' },
              }}
            />
          ))}
        </Box>

        {isLoading && filteredCount === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 2, bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ))}
          </Box>
        ) : filteredCount === 0 ? (
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
              All clear — no notifications requiring your attention.
            </Typography>
          </Box>
        ) : (
          <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {paginated.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <NotificationRow
                  notification={notification}
                  entityBasePath={entityBasePath}
                  onApprove={handleApprove}
                  onQuickView={(n) => setQuickViewItem({ type: 'notification', notification: n })}
                  onAnswer={setQuestionNotification}
                />
              </motion.div>
            ))}
          </Box>
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
              <Button
                size="small"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(p => p - 1)}
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
                {currentPage + 1} / {totalPages}
              </Typography>
              <Button
                size="small"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(p => p + 1)}
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
