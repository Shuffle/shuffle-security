import { Box, Typography, Skeleton } from '@mui/material';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  LucideIcon,
} from 'lucide-react';
import { statusConfig } from '@/config/incidentConfig';

interface TaskItem {
  id: string;
  assignee?: string;
  completed?: boolean;
}

interface DisplayIncident {
  id: string;
  status: string;
  severity: string;
  assignee?: string | null;
  createdTs: number;
  editedTs?: number;
  tasks?: TaskItem[];
}

interface IncidentStatsCardsProps {
  incidents: DisplayIncident[];
  onFilterChange?: (type: 'status' | 'severity' | 'assignee', value: string | null) => void;
  currentUsername?: string;
  isLoading?: boolean;
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
  isLoading?: boolean;
}

const StatCard = ({ icon: Icon, iconColor, iconBg, value, label, delay, onClick, clickable, isLoading }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, delay }}
  >
    <Box
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        backgroundColor: 'transparent',
        border: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': clickable ? {
          borderColor: iconColor,
          bgcolor: `${iconBg}`,
        } : {},
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconBg,
          flexShrink: 0,
        }}
      >
        <Icon size={14} color={iconColor} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        {isLoading ? (
          <Skeleton variant="text" width={32} height={22} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
        ) : (
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1rem',
              lineHeight: 1.2,
              color: 'hsl(var(--foreground))',
            }}
          >
            {value}
          </Typography>
        )}
        <Typography
          sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem', lineHeight: 1.2 }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  </motion.div>
);

export const IncidentStatsCards = ({ incidents, onFilterChange, currentUsername, isLoading }: IncidentStatsCardsProps) => {
  // Calculate stats
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;
  
  const criticalCount = incidents.filter(i => i.severity === 'critical' || i.severity === 'high').length;
  const newCount = incidents.filter(i => i.status === 'new').length;
  const inProgressCount = incidents.filter(i => i.status === 'in_progress').length;
  // "Yours" includes incidents assigned to user OR where a task is assigned to user
  const yourCount = currentUsername ? incidents.filter(i => {
    if (i.status === 'resolved') return false;
    // Check incident assignee
    if (i.assignee === currentUsername) return true;
    // Check if any task is assigned to this user
    if (i.tasks && i.tasks.length > 0) {
      return i.tasks.some(task => 
        task.assignee?.toLowerCase() === currentUsername.toLowerCase()
      );
    }
    return false;
  }).length : 0;

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
        gap: 1,
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
          isLoading={isLoading}
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
        isLoading={isLoading}
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
        isLoading={isLoading}
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
        isLoading={isLoading}
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
        isLoading={isLoading}
      />
      <StatCard
        icon={Clock}
        iconColor="#f59e0b"
        iconBg="rgba(245, 158, 11, 0.15)"
        value={avgResponseTime}
        label="Avg Response"
        delay={0.3}
        isLoading={isLoading}
      />
    </Box>
  );
};
