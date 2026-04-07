/**
 * Dashboard Page — Overview of AI Agent notifications.
 * Currently only loads /notifications?type=agent_question.
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
  Clock,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AgentQuestionDialog from '@/components/agent/AgentQuestionDialog';
import AgentQuickViewDrawer, { type QuickViewItem } from '@/components/agent/AgentQuickViewDrawer';
import { useAgentNotifications } from '@/hooks/useNotifications';
import { isApprovalNotification, approveAgentAction, type AgentNotification } from '@/services/notifications';
import { getTimeAgo } from '@/components/agent/AgentRunHeader';
import { useEntityPreference } from '@/hooks/useEntityLabel';
import { toast } from 'sonner';

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

// ── Notification row ───────────────────────────────────────────────────────────

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
  const { notifications, isLoading, refresh: refreshNotifications } = useAgentNotifications();
  const { singular: entitySingular, basePath: entityBasePath } = useEntityPreference();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [questionNotification, setQuestionNotification] = useState<AgentNotification | null>(null);
  const [quickViewItem, setQuickViewItem] = useState<QuickViewItem | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'approval' | 'question'>('all');
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

  // Counts
  const approvalCount = notifications.filter(n => isApprovalNotification(n)).length;
  const questionCount = notifications.filter(n => !isApprovalNotification(n)).length;
  const totalCount = notifications.length;

  // Filter
  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'approval') return notifications.filter(n => isApprovalNotification(n));
    if (filter === 'question') return notifications.filter(n => !isApprovalNotification(n));
    return notifications;
  }, [notifications, filter]);

  const filteredCount = filteredNotifications.length;
  const totalPages = Math.ceil(filteredCount / ITEMS_PER_PAGE);
  const paginated = filteredNotifications.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  const statCards = (compact = false) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: compact ? 1.5 : 2 }}>
      <StatCard
        icon={<AlertTriangle size={18} />}
        iconColor="hsl(var(--severity-high))"
        iconBg="hsl(var(--severity-high) / 0.12)"
        value={totalCount}
        label="Total Notifications"
        delay={0}
        isLoading={isLoading}
        onClick={() => { setFilter('all'); setCurrentPage(0); }}
        compact={compact}
      />
      <StatCard
        icon={<Clock size={18} />}
        iconColor="hsl(var(--primary))"
        iconBg="hsl(var(--primary) / 0.12)"
        value={approvalCount}
        label="Needs Approval"
        delay={compact ? 0 : 0.05}
        isLoading={isLoading}
        onClick={() => { setFilter('approval'); setCurrentPage(0); }}
        compact={compact}
      />
      <StatCard
        icon={<HelpCircle size={18} />}
        iconColor="hsl(var(--severity-medium))"
        iconBg="hsl(var(--severity-medium) / 0.12)"
        value={questionCount}
        label="Pending Questions"
        delay={compact ? 0 : 0.1}
        isLoading={isLoading}
        onClick={() => { setFilter('question'); setCurrentPage(0); }}
        compact={compact}
      />
    </Box>
  );

  return (
    <>
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Dashboard
          </Typography>
          {isLoading && !isRefreshing && (
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
        AI Agent notifications — see what needs your attention.
      </Typography>

      {/* Stat cards */}
      <Box ref={statCardsRef} sx={{ mb: 4 }}>
        {statCards()}
      </Box>

      {/* Sticky compact stat bar */}
      {isSticky && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1100,
            backgroundColor: 'hsl(var(--background) / 0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid hsl(var(--border))',
            mx: { xs: -1.5, sm: -2, md: -3 },
            px: { xs: 1.5, sm: 2, md: 3 },
            py: 1,
          }}
        >
          <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
            {statCards(true)}
          </Box>
        </Box>
      )}

      {/* Notifications list */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AlertTriangle size={18} style={{ color: 'hsl(var(--severity-high))' }} />
          <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
            Needs Your Attention
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