import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
} from '@mui/material';
import { motion } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const caseTemplates = [
  {
    id: 'TPL-001',
    name: 'Ransomware Investigation',
    description: 'Standard procedure for investigating ransomware incidents including containment and recovery.',
    tasks: 12,
    severity: 'critical',
    usageCount: 45,
  },
  {
    id: 'TPL-002',
    name: 'Phishing Analysis',
    description: 'Template for analyzing and responding to phishing attempts and campaigns.',
    tasks: 8,
    severity: 'high',
    usageCount: 128,
  },
  {
    id: 'TPL-003',
    name: 'Malware Analysis',
    description: 'Comprehensive malware analysis workflow including static and dynamic analysis.',
    tasks: 15,
    severity: 'high',
    usageCount: 67,
  },
  {
    id: 'TPL-004',
    name: 'Data Breach Response',
    description: 'Incident response procedure for potential data breach scenarios.',
    tasks: 18,
    severity: 'critical',
    usageCount: 23,
  },
  {
    id: 'TPL-005',
    name: 'Unauthorized Access',
    description: 'Investigation template for unauthorized access attempts and credential compromise.',
    tasks: 10,
    severity: 'medium',
    usageCount: 89,
  },
  {
    id: 'TPL-006',
    name: 'DDoS Attack Response',
    description: 'Response and mitigation procedures for distributed denial of service attacks.',
    tasks: 7,
    severity: 'high',
    usageCount: 34,
  },
];

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const TemplatesPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Case Templates
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          New Template
        </Button>
      </Box>

      <Grid container spacing={3}>
        {caseTemplates.map((template, index) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={template.id}>
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
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: `${severityColors[template.severity]}15`,
                        color: severityColors[template.severity],
                      }}
                    >
                      <AssignmentIcon />
                    </Box>
                    <IconButton size="small">
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {template.name}
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
                      minHeight: 40,
                    }}
                  >
                    {template.description}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                    <Chip
                      label={template.severity}
                      size="small"
                      sx={{
                        backgroundColor: `${severityColors[template.severity]}20`,
                        color: severityColors[template.severity],
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                    <Chip
                      label={`${template.tasks} tasks`}
                      size="small"
                      sx={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Used {template.usageCount} times
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      sx={{ color: 'primary.main' }}
                    >
                      Use Template
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>
    </motion.div>
  );
};

export default TemplatesPage;
