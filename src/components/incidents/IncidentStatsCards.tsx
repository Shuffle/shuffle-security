import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  LucideIcon,
} from 'lucide-react';
import { statusConfig } from '@/config/incidentConfig';

interface DisplayIncident {
  id: string;
  status: string;
  severity: string;
  assignee?: string | null;
  createdTs: number;
  editedTs?: number;
}

interface IncidentStatsCardsProps {
  incidents: DisplayIncident[];
  onFilterChange?: (type: 'status' | 'severity' | 'assignee', value: string | null) => void;
  currentUsername?: string;
}

interface StatCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  trend?: { value: string; positive: boolean };
  delay: number;
  onClick?: () => void;
  clickable?: boolean;
}

const StatCard = ({ icon: Icon, iconColor, iconBg, value, label, trend, delay, onClick, clickable }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
  >
    <Box
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: 2,
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        height: '100%',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': clickable ? {
          borderColor: iconColor,
          bgcolor: `${iconBg}`,
        } : {},
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconBg,
          }}
        >
          <Icon size={20} color={iconColor} />
        </Box>
        {trend && (
          <Typography
            variant="caption"
            sx={{
              color: trend.positive ? '#22c55e' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontWeight: 500,
            }}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </Typography>
        )}
      </Box>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: 'hsl(var(--foreground))',
          mb: 0.5,
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'hsl(var(--muted-foreground))' }}
      >
        {label}
      </Typography>
    </Box>
  </motion.div>
);

export const IncidentStatsCards = ({ incidents, onFilterChange, currentUsername }: IncidentStatsCardsProps) => {
  // Calculate stats
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;
  
  const criticalCount = incidents.filter(i => i.severity === 'critical' || i.severity === 'high').length;
  const newCount = incidents.filter(i => i.status === 'new').length;
  const inProgressCount = incidents.filter(i => i.status === 'in_progress').length;
  const yourCount = currentUsername ? incidents.filter(i => i.assignee === currentUsername && i.status !== 'resolved').length : 0;

  // Calculate average response time (time from created to first update)
  const incidentsWithUpdates = incidents.filter(i => i.editedTs && i.editedTs !== i.createdTs);
  let avgResponseTime = '—';
  if (incidentsWithUpdates.length > 0) {
    const totalResponseMs = incidentsWithUpdates.reduce((sum, i) => {
      return sum + ((i.editedTs || i.createdTs) - i.createdTs);
    }, 0);
    const avgMs = totalResponseMs / incidentsWithUpdates.length;
    const avgHours = avgMs / 3600000;
    if (avgHours < 1) {
      avgResponseTime = `${Math.round(avgMs / 60000)}m`;
    } else if (avgHours < 24) {
      avgResponseTime = `${avgHours.toFixed(1)}h`;
    } else {
      avgResponseTime = `${(avgHours / 24).toFixed(1)}d`;
    }
  }

  // Get icons and colors from shared config
  const newConfig = statusConfig.new;
  const inProgressConfig = statusConfig.in_progress;
  const resolvedConfig = statusConfig.resolved;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 2,
      }}
    >
      {currentUsername && (
        <StatCard
          icon={statusConfig.new.icon}
          iconColor="#a855f7"
          iconBg="rgba(168, 85, 247, 0.15)"
          value={yourCount}
          label="Yours"
          delay={0}
          clickable={!!onFilterChange}
          onClick={() => onFilterChange?.('assignee', currentUsername)}
        />
      )}
      <StatCard
        icon={newConfig.icon}
        iconColor={newConfig.color}
        iconBg={newConfig.bg}
        value={newCount}
        label="New"
        delay={0.05}
        clickable={!!onFilterChange}
        onClick={() => onFilterChange?.('status', 'new')}
      />
      <StatCard
        icon={inProgressConfig.icon}
        iconColor={inProgressConfig.color}
        iconBg={inProgressConfig.bg}
        value={inProgressCount}
        label="In Progress"
        delay={0.1}
        clickable={!!onFilterChange}
        onClick={() => onFilterChange?.('status', 'in_progress')}
      />
      <StatCard
        icon={resolvedConfig.icon}
        iconColor={resolvedConfig.color}
        iconBg={resolvedConfig.bg}
        value={resolvedCount}
        label="Resolved"
        delay={0.15}
        clickable={!!onFilterChange}
        onClick={() => onFilterChange?.('status', 'resolved')}
      />
      <StatCard
        icon={statusConfig.escalated.icon}
        iconColor={statusConfig.escalated.color}
        iconBg={statusConfig.escalated.bg}
        value={criticalCount}
        label="Critical/High"
        delay={0.25}
        clickable={!!onFilterChange}
        onClick={() => onFilterChange?.('severity', 'critical')}
      />
      <StatCard
        icon={Clock}
        iconColor="#f59e0b"
        iconBg="rgba(245, 158, 11, 0.15)"
        value={avgResponseTime}
        label="Avg Response"
        delay={0.3}
      />
    </Box>
  );
};
