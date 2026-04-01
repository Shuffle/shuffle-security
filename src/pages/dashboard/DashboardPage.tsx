/**
 * Dashboard Page — Overview of AI Agent activity on incidents.
 * Highlights runs needing user approval/input prominently.
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Skeleton,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AgentIcon from '@/components/agent/AgentIcon';
import { useAgentActivity } from '@/hooks/useAgentActivity';
import { parseDatastoreReference, isIncidentReference } from '@/lib/agentParsers';
import { hasOutputWarning, parseRunResult } from '@/components/agent/AgentRunResultViewer';
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

/** Determine if a run needs user attention */
const needsUserInput = (run: AgentRun): boolean => {
  const status = run.status?.toUpperCase() || '';
  // Failed / aborted always need attention
  if (status === 'FAILED' || status === 'ABORTED') return true;
  // Runs flagged "unsure" — agent couldn't fully resolve
  if (hasOutputWarning(run)) return true;
  // Waiting status
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

// ── Stat card ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  delay: number;
  isLoading?: boolean;
}

const StatCard = ({ icon, iconColor, iconBg, value, label, delay, isLoading }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, delay }}
  >
    <Box
      sx={{
        px: 2.5,
        py: 2,
        borderRadius: 2,
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconBg,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        {isLoading ? (
          <Skeleton variant="text" width={40} height={28} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
        ) : (
          <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.2, color: 'hsl(var(--foreground))' }}>
            {value}
          </Typography>
        )}
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', lineHeight: 1.3 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  </motion.div>
);

// ── Run row ────────────────────────────────────────────────────────────────────

const RunRow = ({ run, entityBasePath }: { run: AgentRun; entityBasePath: string }) => {
  const statusCfg = STATUS_CONFIG[run.status?.toUpperCase() || ''] || STATUS_CONFIG.WAITING;
  const iconColor = getRunIconColor(run);
  const duration = formatDuration(run);
  const isUnsure = hasOutputWarning(run);
  const isFailed = run.status?.toUpperCase() === 'FAILED' || run.status?.toUpperCase() === 'ABORTED';
  const incidentKey = getIncidentKey(run);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 1.5,
        borderRadius: 2,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card))',
        transition: 'border-color 0.15s ease',
        '&:hover': { borderColor: 'hsl(var(--primary) / 0.4)' },
      }}
    >
      {/* Icon */}
      <Box sx={{
        width: 36,
        height: 36,
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{
            fontSize: '0.85rem',
            fontWeight: 500,
            color: 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {getRunTitle(run)}
          </Typography>
          {isUnsure ? (
            <HelpCircle size={15} style={{ color: 'hsl(var(--severity-medium))', flexShrink: 0 }} />
          ) : (
            <Box sx={{ color: statusCfg.color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {statusCfg.icon}
            </Box>
          )}
        </Box>
        <Typography sx={{
          fontSize: '0.75rem',
          color: 'hsl(var(--muted-foreground))',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {getRunSubtitle(run)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
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

      {/* Link to incident if applicable */}
      {incidentKey && (
        <Tooltip title="View incident">
          <IconButton
            component={Link}
            to={`${entityBasePath}/${incidentKey}`}
            size="small"
            sx={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <ArrowRight size={16} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { runs, isLoading, stats, refresh } = useAgentActivity();
  const { singular: entitySingular, basePath: entityBasePath } = useEntityPreference();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Categorise runs
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
      recentCompleted: completed.slice(0, 10),
      activeRuns: active,
    };
  }, [runs]);

  return (
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
        AI Agent overview — see what's happening and what needs your attention.
      </Typography>

      {/* Stat cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        <StatCard
          icon={<AlertTriangle size={18} />}
          iconColor="hsl(var(--severity-high))"
          iconBg="hsl(var(--severity-high) / 0.12)"
          value={needsAttention.length}
          label="Needs Your Input"
          delay={0}
          isLoading={isLoading}
        />
        <StatCard
          icon={<Loader2 size={18} />}
          iconColor="hsl(var(--severity-medium))"
          iconBg="hsl(var(--severity-medium) / 0.12)"
          value={activeRuns.length}
          label="Currently Running"
          delay={0.05}
          isLoading={isLoading}
        />
        <StatCard
          icon={<CheckCircle size={18} />}
          iconColor="hsl(var(--severity-low))"
          iconBg="hsl(var(--severity-low) / 0.12)"
          value={stats.successCount}
          label="Completed"
          delay={0.1}
          isLoading={isLoading}
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

      {/* Needs Attention Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AlertTriangle size={18} style={{ color: 'hsl(var(--severity-high))' }} />
          <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
            Needs Your Attention
          </Typography>
          {needsAttention.length > 0 && (
            <Chip
              label={needsAttention.length}
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

        {isLoading && needsAttention.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 2, bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ))}
          </Box>
        ) : needsAttention.length === 0 ? (
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {needsAttention.map((run) => (
              <motion.div
                key={run.execution_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Box
                  sx={{
                    borderLeft: '3px solid hsl(var(--severity-high))',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <RunRow run={run} entityBasePath={entityBasePath} />
                </Box>
              </motion.div>
            ))}
          </Box>
        )}
      </Box>

      {/* Currently Running */}
      {activeRuns.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Loader2 size={18} style={{ color: 'hsl(var(--severity-medium))', animation: 'spin 2s linear infinite' }} />
            <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
              Currently Running
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {activeRuns.map((run) => (
              <RunRow key={run.execution_id} run={run} entityBasePath={entityBasePath} />
            ))}
          </Box>
        </Box>
      )}

      {/* Recent Activity */}
      <Box>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {recentCompleted.map((run) => (
              <RunRow key={run.execution_id} run={run} entityBasePath={entityBasePath} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DashboardPage;
