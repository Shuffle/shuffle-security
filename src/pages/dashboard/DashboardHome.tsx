import { Grid, Card, CardContent, Typography, Box, Chip, LinearProgress } from '@mui/material';
import { motion } from 'framer-motion';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const stats = [
  {
    title: 'Open Alerts',
    value: '127',
    change: '+12%',
    trend: 'up',
    icon: <NotificationsActiveIcon />,
    color: '#ef4444',
  },
  {
    title: 'Active Cases',
    value: '23',
    change: '-5%',
    trend: 'down',
    icon: <FolderSpecialIcon />,
    color: '#22b8cf',
  },
  {
    title: 'Tasks Completed',
    value: '89',
    change: '+18%',
    trend: 'up',
    icon: <AssignmentTurnedInIcon />,
    color: '#22c55e',
  },
  {
    title: 'Avg. Response Time',
    value: '2.4h',
    change: '-23%',
    trend: 'down',
    icon: <AccessTimeIcon />,
    color: '#f59e0b',
  },
];

const recentAlerts = [
  { id: 'ALR-001', title: 'Suspicious Login Activity', severity: 'critical', time: '5 min ago' },
  { id: 'ALR-002', title: 'Malware Detection', severity: 'high', time: '12 min ago' },
  { id: 'ALR-003', title: 'Unusual Network Traffic', severity: 'medium', time: '25 min ago' },
  { id: 'ALR-004', title: 'Failed Authentication Attempts', severity: 'high', time: '1 hour ago' },
  { id: 'ALR-005', title: 'Policy Violation Detected', severity: 'low', time: '2 hours ago' },
];

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const DashboardHome = () => {
  return (
    <Box>
      <Grid container spacing={3}>
        {stats.map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={stat.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: `${stat.color}15`,
                        color: stat.color,
                      }}
                    >
                      {stat.icon}
                    </Box>
                    <Chip
                      size="small"
                      label={stat.change}
                      icon={stat.trend === 'up' ? <TrendingUpIcon /> : <TrendingDownIcon />}
                      sx={{
                        backgroundColor: stat.trend === 'up' 
                          ? stat.title === 'Open Alerts' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'
                          : stat.title === 'Avg. Response Time' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: stat.trend === 'up'
                          ? stat.title === 'Open Alerts' ? '#ef4444' : '#22c55e'
                          : stat.title === 'Avg. Response Time' ? '#22c55e' : '#ef4444',
                        '& .MuiChip-icon': {
                          color: 'inherit',
                        },
                      }}
                    />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {stat.title}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Recent Alerts
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {recentAlerts.map((alert) => (
                    <Box
                      key={alert.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: 'rgba(148, 163, 184, 0.05)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(34, 184, 207, 0.05)',
                          borderColor: 'rgba(34, 184, 207, 0.2)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: severityColors[alert.severity],
                          }}
                        />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {alert.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {alert.id}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip
                          label={alert.severity}
                          size="small"
                          sx={{
                            backgroundColor: `${severityColors[alert.severity]}20`,
                            color: severityColors[alert.severity],
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {alert.time}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Alert Distribution
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {[
                    { label: 'Critical', count: 12, color: '#ef4444', percentage: 15 },
                    { label: 'High', count: 34, color: '#f97316', percentage: 42 },
                    { label: 'Medium', count: 28, color: '#eab308', percentage: 35 },
                    { label: 'Low', count: 7, color: '#22c55e', percentage: 8 },
                  ].map((item) => (
                    <Box key={item.label}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {item.count} ({item.percentage}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={item.percentage}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: 'rgba(148, 163, 184, 0.1)',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: item.color,
                            borderRadius: 4,
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardHome;
