import { Box, Container, Typography, Grid, Stack } from '@mui/material';
import { motion } from 'framer-motion';

interface FeatureSectionProps {
  icon: React.ReactNode;
  title: string;
  highlight: string;
  description: string;
  bullets: string[];
  color: string;
  reverse?: boolean;
  visual: React.ReactNode;
}

const FeatureSection = ({ title, highlight, description, bullets, color, reverse, visual }: FeatureSectionProps) => (
  <Box 
    sx={{ 
      py: { xs: 10, md: 16 },
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Section background glow */}
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: reverse ? '20%' : '80%',
        transform: 'translate(-50%, -50%)',
        width: '60%',
        height: '80%',
        background: `radial-gradient(ellipse at center, ${color}08 0%, transparent 60%)`,
        pointerEvents: 'none',
      }}
    />

    <Container maxWidth="lg">
      <Grid 
        container 
        spacing={{ xs: 6, md: 10 }} 
        alignItems="center"
        direction={reverse ? 'row-reverse' : 'row'}
      >
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div
            initial={{ opacity: 0, x: reverse ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 700,
                mb: 3,
                lineHeight: 1.15,
              }}
            >
              {title}{' '}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {highlight}
              </Box>
            </Typography>
            <Typography
              sx={{
                color: 'text.secondary',
                fontWeight: 400,
                mb: 5,
                lineHeight: 1.8,
                fontSize: { xs: '1rem', md: '1.15rem' },
              }}
            >
              {description}
            </Typography>
            <Stack spacing={2.5}>
              {bullets.map((bullet, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: `${color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        mt: 0.25,
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: color,
                        }}
                      />
                    </Box>
                    <Typography sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '1.05rem' }}>
                      {bullet}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Stack>
          </motion.div>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div
            initial={{ opacity: 0, x: reverse ? -40 : 40, scale: 0.95 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {visual}
          </motion.div>
        </Grid>
      </Grid>
    </Container>
  </Box>
);

// Custom visual components for each feature
const AIAgentVisual = () => (
  <Box
    sx={{
      p: 4,
      borderRadius: 4,
      background: 'linear-gradient(145deg, rgba(255, 102, 0, 0.08) 0%, rgba(255, 102, 0, 0.02) 100%)',
      border: '1px solid rgba(255, 102, 0, 0.15)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Chat-like interface */}
    <Stack spacing={3}>
      {/* AI thinking bubble */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box
          component={motion.div}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            flexShrink: 0,
          }}
        >
          🤖
        </Box>
        <Box
          sx={{
            flex: 1,
            p: 2.5,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mb: 1.5 }}>
            Detected suspicious login from unusual location
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ py: 0.5, px: 1.5, borderRadius: 2, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <Typography sx={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>High Risk</Typography>
            </Box>
            <Box sx={{ py: 0.5, px: 1.5, borderRadius: 2, background: 'rgba(255, 102, 0, 0.15)', border: '1px solid rgba(255, 102, 0, 0.3)' }}>
              <Typography sx={{ color: '#FF6600', fontSize: '0.75rem', fontWeight: 600 }}>Awaiting Approval</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Suggested action */}
      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.03) 100%)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
        }}
      >
        <Typography sx={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600, mb: 1 }}>
          SUGGESTED ACTION
        </Typography>
        <Typography sx={{ color: 'text.primary', fontSize: '0.95rem', mb: 2 }}>
          Disable account and require password reset
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box
            component={motion.div}
            whileHover={{ scale: 1.05 }}
            sx={{
              py: 1,
              px: 3,
              borderRadius: 2,
              background: '#22c55e',
              cursor: 'pointer',
            }}
          >
            <Typography sx={{ color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>Approve</Typography>
          </Box>
          <Box
            sx={{
              py: 1,
              px: 3,
              borderRadius: 2,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
            }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Modify</Typography>
          </Box>
        </Box>
      </Box>
    </Stack>
  </Box>
);

const UniversalReachVisual = () => (
  <Box
    sx={{
      p: 4,
      borderRadius: 4,
      background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.06) 0%, rgba(34, 197, 94, 0.01) 100%)',
      border: '1px solid rgba(34, 197, 94, 0.12)',
      position: 'relative',
    }}
  >
    {/* Environment nodes */}
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {[
        { label: 'Cloud', items: ['AWS', 'Azure', 'GCP'], color: '#4285F4', status: 'connected' },
        { label: 'On-Premises', items: ['DC1', 'DC2', 'DR Site'], color: '#8b5cf6', status: 'connected' },
        { label: 'Hybrid', items: ['VPN', 'DirectConnect'], color: '#22c55e', status: 'syncing' },
      ].map((env, i) => (
        <motion.div
          key={env.label}
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15 }}
        >
          <Box
            sx={{
              p: 2.5,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{env.label}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  component={motion.div}
                  animate={env.status === 'syncing' ? { opacity: [1, 0.5, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: env.status === 'connected' ? '#22c55e' : '#f59e0b',
                  }}
                />
                <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {env.status === 'connected' ? 'Connected' : 'Syncing'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {env.items.map((item) => (
                <Box
                  key={item}
                  sx={{
                    py: 0.75,
                    px: 2,
                    borderRadius: 2,
                    background: `${env.color}10`,
                    border: `1px solid ${env.color}25`,
                  }}
                >
                  <Typography sx={{ color: env.color, fontSize: '0.8rem', fontWeight: 500 }}>{item}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </motion.div>
      ))}
    </Box>
  </Box>
);

const IntegrationsVisual = () => (
  <Box
    sx={{
      p: 4,
      borderRadius: 4,
      background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.01) 100%)',
      border: '1px solid rgba(139, 92, 246, 0.12)',
    }}
  >
    {/* Integration grid */}
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
      {[
        { name: 'Slack', emoji: '💬' },
        { name: 'Jira', emoji: '📋' },
        { name: 'Teams', emoji: '👥' },
        { name: 'Email', emoji: '📧' },
        { name: 'Splunk', emoji: '📊' },
        { name: 'S3', emoji: '🪣' },
        { name: 'Okta', emoji: '🔐' },
        { name: 'API', emoji: '🔌' },
      ].map((int, i) => (
        <motion.div
          key={int.name}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          whileHover={{ scale: 1.1, y: -4 }}
        >
          <Box
            sx={{
              aspectRatio: '1',
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: 'rgba(139, 92, 246, 0.1)',
                borderColor: 'rgba(139, 92, 246, 0.3)',
              },
            }}
          >
            <Typography sx={{ fontSize: '1.5rem' }}>{int.emoji}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 500 }}>{int.name}</Typography>
          </Box>
        </motion.div>
      ))}
    </Box>
    <Box sx={{ mt: 3, p: 2, borderRadius: 2, background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
      <Typography sx={{ color: '#8b5cf6', fontSize: '0.85rem', textAlign: 'center' }}>
        200+ integrations • REST API • Webhooks • Custom SDK
      </Typography>
    </Box>
  </Box>
);

const features: Omit<FeatureSectionProps, 'reverse'>[] = [
  {
    icon: null,
    title: 'AI Agents That Are',
    highlight: 'Controllable',
    description: 'Your AI co-pilot handles the grunt work—but always asks permission before acting. You decide when automation runs free and when it pauses for your approval.',
    bullets: [
      'Automatic triage and threat enrichment in seconds',
      'Suggested response actions you approve with one click',
      'Works with any LLM—cloud APIs or your own models',
      'Full transparency into why the AI made each decision',
    ],
    color: '#FF6600',
    visual: <AIAgentVisual />,
  },
  {
    icon: null,
    title: 'Universal',
    highlight: 'Reach',
    description: 'One platform that connects everywhere. Cloud, on-prem, air-gapped—no environment is out of reach. Your security automation finally works everywhere your infrastructure lives.',
    bullets: [
      'Native connectors for AWS, Azure, GCP, and more',
      'On-prem agents for internal and isolated networks',
      'Hybrid deployments that bridge everything',
      'Zero trust—your data stays where you want it',
    ],
    color: '#22c55e',
    visual: <UniversalReachVisual />,
  },
  {
    icon: null,
    title: 'Endless',
    highlight: 'Integrations',
    description: 'Connect to everything you already use. Pull alerts from any source, push actions to any system, and build workflows that span your entire stack.',
    bullets: [
      'ServiceNow, Jira, PagerDuty, Splunk, and 200+ more',
      'Bi-directional sync keeps everything in lockstep',
      'REST API and webhooks for custom systems',
      'Build new integrations in minutes with our SDK',
    ],
    color: '#8b5cf6',
    visual: <IntegrationsVisual />,
  },
];

export const FeaturesSection = () => {
  return (
    <Box id="features">
      {/* Section header */}
      <Box 
        sx={{ 
          py: { xs: 10, md: 14 }, 
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <Container maxWidth="md">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant="h2"
              sx={{
                mb: 3,
                fontSize: { xs: '2.25rem', md: '3.5rem' },
                fontWeight: 700,
              }}
            >
              Built for teams who want{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                results
              </Box>
              , not busywork
            </Typography>
            <Typography
              sx={{
                color: 'text.secondary',
                maxWidth: 600,
                mx: 'auto',
                fontWeight: 400,
                fontSize: { xs: '1.05rem', md: '1.25rem' },
                lineHeight: 1.7,
              }}
            >
              Stop drowning in alerts. Let AI handle the noise while you focus on what matters.
            </Typography>
          </motion.div>
        </Container>
      </Box>

      {/* Individual feature sections */}
      {features.map((feature, index) => (
        <FeatureSection key={feature.title} {...feature} reverse={index % 2 === 1} />
      ))}
    </Box>
  );
};