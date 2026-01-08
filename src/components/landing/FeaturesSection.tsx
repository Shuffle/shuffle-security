import { Box, Container, Typography, Grid, Card, CardContent } from '@mui/material';
import { motion } from 'framer-motion';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import PeopleIcon from '@mui/icons-material/People';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

const features = [
  {
    icon: <AutoFixHighIcon sx={{ fontSize: 40 }} />,
    title: 'AI Agents',
    description: 'Verbose, controllable AI agents assist with alert triage, case escalations, and response actions—with full visibility into every decision.',
    color: '#FF6600',
  },
  {
    icon: <NotificationsActiveIcon sx={{ fontSize: 40 }} />,
    title: 'Universal ITSM Import',
    description: "Import alerts and cases from any ITSM system you're currently using. ServiceNow, Jira, PagerDuty, or custom—we connect to all of them.",
    color: '#ef4444',
  },
  {
    icon: <BubbleChartIcon sx={{ fontSize: 40 }} />,
    title: 'Cloud & On-Premises',
    description: 'Built on Shuffle Automation to reach into both cloud and on-premises environments. No data leaves your control unless you want it to.',
    color: '#22c55e',
  },
  {
    icon: <AssignmentIcon sx={{ fontSize: 40 }} />,
    title: 'Full Configurability',
    description: 'Control is a core priority. Customize every workflow, template, and automation rule to match how your team actually works.',
    color: '#f59e0b',
  },
  {
    icon: <FolderSpecialIcon sx={{ fontSize: 40 }} />,
    title: 'Case Investigation',
    description: 'Create comprehensive cases from alerts, track investigation progress, and maintain detailed audit trails.',
    color: '#FF6600',
  },
  {
    icon: <PeopleIcon sx={{ fontSize: 40 }} />,
    title: 'Multi-Tenancy',
    description: 'Securely manage multiple organizations with isolated data, custom branding, and role-based access.',
    color: '#8b5cf6',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export const FeaturesSection = () => {
  return (
    <Box
      id="features"
      sx={{
        py: 15,
        position: 'relative',
      }}
    >
      <Container maxWidth="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Typography
            variant="h2"
            sx={{
              textAlign: 'center',
              mb: 2,
              fontSize: { xs: '2rem', md: '3rem' },
            }}
          >
            Everything You Need for{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Effective Response
            </Box>
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              mb: 8,
              fontWeight: 400,
            }}
          >
            A comprehensive platform designed by security professionals, for security professionals.
          </Typography>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <Grid container spacing={4}>
            {features.map((feature) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.title}>
                <motion.div variants={itemVariants}>
                  <Card
                    sx={{
                      height: '100%',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: `0 20px 40px -20px ${feature.color}40`,
                        '& .feature-icon': {
                          transform: 'scale(1.1)',
                        },
                      },
                    }}
                  >
                    <CardContent sx={{ p: 4 }}>
                      <Box
                        className="feature-icon"
                        sx={{
                          display: 'inline-flex',
                          p: 1.5,
                          borderRadius: 2,
                          background: `${feature.color}15`,
                          color: feature.color,
                          mb: 3,
                          transition: 'transform 0.3s ease',
                        }}
                      >
                        {feature.icon}
                      </Box>
                      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      </Container>
    </Box>
  );
};
