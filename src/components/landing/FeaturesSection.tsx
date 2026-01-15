import { Box, Container, Typography, Grid, Card, CardContent } from '@mui/material';
import { motion } from 'framer-motion';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import TuneIcon from '@mui/icons-material/Tune';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import VisibilityIcon from '@mui/icons-material/Visibility';

const features = [
  {
    icon: <SmartToyIcon sx={{ fontSize: 40 }} />,
    title: 'Automatic, But Controllable',
    description: 'AI agents handle triage, enrichment, and response automatically—but every action requires your approval. You control when automation runs free and when it pauses for human review.',
    color: '#FF6600',
  },
  {
    icon: <CloudSyncIcon sx={{ fontSize: 40 }} />,
    title: 'Universal Reach',
    description: 'Connect to any environment: cloud APIs, on-premises systems, air-gapped networks, or hybrid infrastructure. One platform that reaches everywhere your security needs to go.',
    color: '#22c55e',
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 40 }} />,
    title: 'Instant Response',
    description: 'Automated playbooks execute in seconds, not hours. Isolate hosts, block IPs, disable accounts, and collect forensics—all triggered automatically when threats are detected.',
    color: '#ef4444',
  },
  {
    icon: <TuneIcon sx={{ fontSize: 40 }} />,
    title: 'Deep Configurability',
    description: 'Every workflow, threshold, and automation rule is fully customizable. Match the platform to how your team works, not the other way around.',
    color: '#f59e0b',
  },
  {
    icon: <VisibilityIcon sx={{ fontSize: 40 }} />,
    title: 'Complete Visibility',
    description: 'Every automated action is logged with full context. Review what happened, why it triggered, and what the AI recommended—audit trails you can trust.',
    color: '#8b5cf6',
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 40 }} />,
    title: 'Zero Trust by Design',
    description: 'Your data stays yours. Run entirely on-premises, in your cloud, or hybrid. No external dependencies required—the platform works wherever you deploy it.',
    color: '#06b6d4',
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
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Automatic
            </Box>{' '}
            Security That You{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Control
            </Box>
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              maxWidth: 700,
              mx: 'auto',
              mb: 8,
              fontWeight: 400,
            }}
          >
            Automated incident response that works across every environment—with you in the driver's seat.
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