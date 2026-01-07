import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Avatar,
  AvatarGroup,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';

const cases = [
  {
    id: 'CASE-001',
    title: 'Ransomware Incident Investigation',
    description: 'Investigating potential ransomware infection on multiple endpoints in the finance department.',
    severity: 'critical',
    status: 'in_progress',
    progress: 45,
    alerts: 5,
    observables: 12,
    tasks: { completed: 3, total: 8 },
    assignees: ['JD', 'SM', 'MR'],
    created: '2026-01-05',
    updated: '2 hours ago',
  },
  {
    id: 'CASE-002',
    title: 'Phishing Campaign Analysis',
    description: 'Analysis of coordinated phishing campaign targeting executive staff members.',
    severity: 'high',
    status: 'in_progress',
    progress: 70,
    alerts: 12,
    observables: 28,
    tasks: { completed: 7, total: 10 },
    assignees: ['SM', 'JD'],
    created: '2026-01-04',
    updated: '4 hours ago',
  },
  {
    id: 'CASE-003',
    title: 'Data Exfiltration Attempt',
    description: 'Investigating unusual data transfer patterns from internal database servers.',
    severity: 'high',
    status: 'open',
    progress: 15,
    alerts: 3,
    observables: 7,
    tasks: { completed: 1, total: 6 },
    assignees: ['MR'],
    created: '2026-01-06',
    updated: '1 hour ago',
  },
  {
    id: 'CASE-004',
    title: 'Unauthorized Access Review',
    description: 'Review of failed authentication attempts and potential credential compromise.',
    severity: 'medium',
    status: 'in_progress',
    progress: 85,
    alerts: 8,
    observables: 15,
    tasks: { completed: 5, total: 6 },
    assignees: ['JD', 'SM'],
    created: '2026-01-02',
    updated: '30 min ago',
  },
  {
    id: 'CASE-005',
    title: 'Malware Sample Analysis',
    description: 'Deep analysis of malware sample discovered on developer workstation.',
    severity: 'medium',
    status: 'resolved',
    progress: 100,
    alerts: 2,
    observables: 20,
    tasks: { completed: 5, total: 5 },
    assignees: ['SM'],
    created: '2025-12-28',
    updated: '1 day ago',
  },
  {
    id: 'CASE-006',
    title: 'Network Scanning Activity',
    description: 'Investigation of internal network scanning from unknown source.',
    severity: 'low',
    status: 'open',
    progress: 10,
    alerts: 1,
    observables: 4,
    tasks: { completed: 0, total: 4 },
    assignees: [],
    created: '2026-01-07',
    updated: '10 min ago',
  },
];

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: 'rgba(34, 184, 207, 0.15)', text: '#22b8cf' },
  in_progress: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  resolved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  closed: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
};

const CasesPage = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Cases
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          New Case
        </Button>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          placeholder="Search cases..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{ width: 300 }}
        />
        <Button variant="outlined" startIcon={<FilterListIcon />}>
          Filters
        </Button>
      </Box>

      <Grid container spacing={3}>
        {cases.map((caseItem, index) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={caseItem.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px -12px rgba(0, 0, 0, 0.4)',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: severityColors[caseItem.severity],
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {caseItem.id}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, lineHeight: 1.3 }}>
                    {caseItem.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {caseItem.description}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                    <Chip
                      label={caseItem.severity}
                      size="small"
                      sx={{
                        backgroundColor: `${severityColors[caseItem.severity]}20`,
                        color: severityColors[caseItem.severity],
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                    <Chip
                      label={caseItem.status.replace('_', ' ')}
                      size="small"
                      sx={{
                        backgroundColor: statusColors[caseItem.status].bg,
                        color: statusColors[caseItem.status].text,
                        fontWeight: 500,
                        textTransform: 'capitalize',
                      }}
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Progress
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {caseItem.progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={caseItem.progress}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: 'primary.main',
                          borderRadius: 3,
                        },
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AssignmentIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {caseItem.tasks.completed}/{caseItem.tasks.total} tasks
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <BubbleChartIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {caseItem.observables} IOCs
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
                      {caseItem.assignees.map((assignee) => (
                        <Avatar
                          key={assignee}
                          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
                        >
                          {assignee}
                        </Avatar>
                      ))}
                    </AvatarGroup>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {caseItem.updated}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            minWidth: 160,
            backgroundImage: 'linear-gradient(145deg, #1e293b 0%, #162032 100%)',
          },
        }}
      >
        <MenuItem onClick={() => setAnchorEl(null)}>View Details</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Edit Case</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Assign Users</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>Close Case</MenuItem>
      </Menu>
    </motion.div>
  );
};

export default CasesPage;
