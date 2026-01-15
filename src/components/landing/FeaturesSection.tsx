import { Box, Container, Typography, Grid, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import TuneIcon from '@mui/icons-material/Tune';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SpeedIcon from '@mui/icons-material/Speed';

interface FeatureSectionProps {
  icon: React.ReactNode;
  title: string;
  highlight: string;
  description: string;
  bullets: string[];
  color: string;
  reverse?: boolean;
}

const FeatureSection = ({ icon, title, highlight, description, bullets, color, reverse }: FeatureSectionProps) => (
  <Box sx={{ py: { xs: 8, md: 12 } }}>
    <Container maxWidth="lg">
      <Grid 
        container 
        spacing={{ xs: 4, md: 8 }} 
        alignItems="center"
        direction={reverse ? 'row-reverse' : 'row'}
      >
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div
            initial={{ opacity: 0, x: reverse ? 30 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                p: 2,
                borderRadius: 3,
                background: `${color}15`,
                color: color,
                mb: 3,
              }}
            >
              {icon}
            </Box>
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                fontWeight: 700,
                mb: 2,
                lineHeight: 1.2,
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
              variant="h6"
              sx={{
                color: 'text.secondary',
                fontWeight: 400,
                mb: 4,
                lineHeight: 1.7,
              }}
            >
              {description}
            </Typography>
            <Stack spacing={2}>
              {bullets.map((bullet, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: color,
                      mt: 1,
                      flexShrink: 0,
                    }}
                  />
                  <Typography sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    {bullet}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </motion.div>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div
            initial={{ opacity: 0, x: reverse ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Box
              sx={{
                p: { xs: 4, md: 6 },
                borderRadius: 4,
                background: 'rgba(33, 33, 33, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(10px)',
                position: 'relative',
                overflow: 'hidden',
                minHeight: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: '-50%',
                  right: '-50%',
                  width: '100%',
                  height: '100%',
                  background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }}
              />
              <Box sx={{ color: color, opacity: 0.3 }}>
                {React.cloneElement(icon as React.ReactElement, { sx: { fontSize: 180 } })}
              </Box>
            </Box>
          </motion.div>
        </Grid>
      </Grid>
    </Container>
  </Box>
);

const features: Omit<FeatureSectionProps, 'reverse'>[] = [
  {
    icon: <SmartToyIcon sx={{ fontSize: 48 }} />,
    title: 'AI Agents That Are',
    highlight: 'Controllable',
    description: 'Intelligent automation that handles the heavy lifting—but always asks before acting. You decide when AI runs autonomously and when it pauses for approval.',
    bullets: [
      'Automatic triage and enrichment of incoming alerts',
      'AI-suggested response actions with human approval gates',
      'Run on cloud APIs (OpenAI, Anthropic) or your own local models',
      'Full transparency into AI reasoning and recommendations',
    ],
    color: '#FF6600',
  },
  {
    icon: <CloudSyncIcon sx={{ fontSize: 48 }} />,
    title: 'Universal',
    highlight: 'Reach',
    description: 'One platform that connects everywhere your security needs to go. Cloud services, on-premises infrastructure, air-gapped networks—no environment is out of reach.',
    bullets: [
      'Native connectors for AWS, Azure, GCP, and major cloud platforms',
      'On-premises agents for internal networks and isolated systems',
      'Hybrid deployments that bridge cloud and datacenter',
      'Zero trust architecture—your data stays where you want it',
    ],
    color: '#22c55e',
  },
  {
    icon: <IntegrationInstructionsIcon sx={{ fontSize: 48 }} />,
    title: 'Endless',
    highlight: 'Integrations',
    description: 'Connect to the tools you already use. Import alerts from any source, trigger actions in any system, and build workflows that span your entire stack.',
    bullets: [
      'ServiceNow, Jira, PagerDuty, Splunk, and 200+ integrations',
      'REST API and webhook support for custom systems',
      'Bi-directional sync keeps everything in lockstep',
      'Build custom integrations with our SDK in minutes',
    ],
    color: '#8b5cf6',
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 48 }} />,
    title: 'Instant',
    highlight: 'Response',
    description: 'When threats are detected, every second counts. Automated playbooks execute immediately—isolating hosts, blocking IPs, and collecting evidence while you sleep.',
    bullets: [
      'Sub-30-second mean time to respond for automated actions',
      'Pre-built playbooks for common incident types',
      'Automatic evidence collection and forensic snapshots',
      'Escalation paths that adapt based on severity and time',
    ],
    color: '#ef4444',
  },
  {
    icon: <TuneIcon sx={{ fontSize: 48 }} />,
    title: 'Deep',
    highlight: 'Configurability',
    description: 'Your security operations are unique. Every workflow, threshold, and automation rule is fully customizable to match exactly how your team works.',
    bullets: [
      'Visual workflow builder with drag-and-drop simplicity',
      'Custom fields, statuses, and categorization schemes',
      'Role-based access with granular permission controls',
      'White-label options for MSSPs and enterprise teams',
    ],
    color: '#f59e0b',
  },
  {
    icon: <VisibilityIcon sx={{ fontSize: 48 }} />,
    title: 'Complete',
    highlight: 'Visibility',
    description: 'Every automated action is logged with full context. Review what happened, why it triggered, and what decisions were made—audit trails you can trust.',
    bullets: [
      'Immutable audit logs for compliance and forensics',
      'Real-time dashboards and custom reporting',
      'AI decision explanations in plain language',
      'Export to SIEM, data lake, or long-term storage',
    ],
    color: '#06b6d4',
  },
];

import React from 'react';

export const FeaturesSection = () => {
  return (
    <Box id="features">
      {/* Section header */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
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
                fontWeight: 400,
              }}
            >
              Automated incident response that works across every environment—with you in the driver's seat.
            </Typography>
          </motion.div>
        </Container>
      </Box>

      {/* Individual feature sections */}
      {features.map((feature, index) => (
        <Box
          key={feature.title}
          sx={{
            borderBottom: index < features.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
          }}
        >
          <FeatureSection {...feature} reverse={index % 2 === 1} />
        </Box>
      ))}
    </Box>
  );
};