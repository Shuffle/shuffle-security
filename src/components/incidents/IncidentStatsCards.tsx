import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  TrendingUp,
  Clock,
  MessageSquare,
  AlertTriangle,
  Shield,
} from 'lucide-react';

interface DisplayIncident {
  id: string;
  status: string;
  severity: string;
  createdTs: number;
  editedTs?: number;
}

interface IncidentStatsCardsProps {
  incidents: DisplayIncident[];
  onFilterChange?: (type: 'status' | 'severity', value: string | null) => void;
}

interface StatCardProps {
  icon: typeof CheckCircle;
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

export const IncidentStatsCards = ({ incidents, onFilterChange }: IncidentStatsCardsProps) => {
  // Calculate stats
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;
  const totalCount = incidents.length;
  const resolutionRate = totalCount > 0 ? ((resolvedCount / totalCount) * 100).toFixed(1) : '0';
  
  const criticalCount = incidents.filter(i => i.severity === 'critical' || i.severity === 'high').length;
  const newCount = incidents.filter(i => i.status === 'new').length;

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

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 2,
      }}
    >
      <StatCard
        icon={MessageSquare}
        iconColor="#22b8cf"
        iconBg="rgba(34, 184, 207, 0.15)"
        value={newCount}
        label="New"
        delay={0}
        clickable={!!onFilterChange}
        onClick={() => onFilterChange?.('status', 'new')}
      />
      <StatCard
        icon={CheckCircle}
        iconColor="#22c55e"
        iconBg="rgba(34, 197, 94, 0.15)"
        value={resolvedCount}
        label="Resolved"
        delay={0.05}
        clickable={!!onFilterChange}
        onClick={() => onFilterChange?.('status', 'resolved')}
      />
      <StatCard
        icon={TrendingUp}
        iconColor="#3b82f6"
        iconBg="rgba(59, 130, 246, 0.15)"
        value={`${resolutionRate}%`}
        label="Resolution Rate"
        delay={0.1}
      />
      <StatCard
        icon={AlertTriangle}
        iconColor="#ef4444"
        iconBg="rgba(239, 68, 68, 0.15)"
        value={criticalCount}
        label="Critical/High"
        delay={0.15}
        clickable={!!onFilterChange}
        onClick={() => onFilterChange?.('severity', 'critical')}
      />
      <StatCard
        icon={Clock}
        iconColor="#f59e0b"
        iconBg="rgba(245, 158, 11, 0.15)"
        value={avgResponseTime}
        label="Avg Response"
        delay={0.2}
      />
    </Box>
  );
};
