import { ArrowRight as ArrowForwardIcon, Cloud as CloudIcon, Shield as SecurityIcon, Database as StorageIcon, Mail as EmailIcon, Bug as BugReportIcon, Wrench as BuildIcon } from 'lucide-react';
import { Box, Container, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { trackCTA } from '@/lib/analytics';

// Floating integration icons - styled boxes with names
const floatingIcons = [
  { name: 'Splunk', abbr: 'SPL', color: '#65A637', x: '6%', y: '12%', delay: 0, size: 44 },
  { name: 'CrowdStrike', abbr: 'CS', color: '#E01E5A', x: '88%', y: '15%', delay: 0.15, size: 40 },
  { name: 'AWS', abbr: 'AWS', color: '#FF9900', x: '4%', y: '45%', delay: 0.3, size: 38 },
  { name: 'ServiceNow', abbr: 'SN', color: '#81B5A1', x: '92%', y: '40%', delay: 0.45, size: 40 },
  { name: 'Azure', abbr: 'AZ', color: '#0089D6', x: '10%', y: '75%', delay: 0.6, size: 36 },
  { name: 'GCP', abbr: 'GCP', color: '#4285F4', x: '85%', y: '70%', delay: 0.75, size: 42 },
  { name: 'Jira', abbr: 'JRA', color: '#0052CC', x: '18%', y: '28%', delay: 0.9, size: 34 },
  { name: 'Slack', abbr: 'SLK', color: '#4A154B', x: '80%', y: '85%', delay: 1.05, size: 38 },
];

const FloatingIcon = ({ name, abbr, color, x, y, delay, size }: typeof floatingIcons[0]) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 0.35, scale: 1 }}
    whileHover={{ opacity: 1 }}
    transition={{ duration: 0.6, delay: delay + 0.5 }}
    style={{
      position: 'absolute',
      left: x,
      top: y,
      zIndex: 0,
    }}
  >
    <motion.div
      animate={{ 
        y: [0, -15, 0],
      }}
      transition={{ 
        duration: 5 + Math.random() * 2,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: delay,
      }}
    >
      <Box
        component={Link}
        to={`/apps?search=${encodeURIComponent(name)}`}
        sx={{
          width: size,
          height: size,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`,
          border: `1px solid ${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          boxShadow: `0 4px 16px ${color}10`,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          textDecoration: 'none',
          cursor: 'pointer',
          '&:hover': {
            transform: 'scale(1.15)',
            borderColor: color,
            boxShadow: `0 12px 40px ${color}40`,
          },
        }}
      >
        <Typography 
          sx={{ 
            fontSize: size * 0.28, 
            fontWeight: 700, 
            color,
            letterSpacing: '-0.02em',
          }}
        >
          {abbr}
        </Typography>
      </Box>
    </motion.div>
  </motion.div>
);

// Category icons with MUI icons
const categoryIcons: Record<string, React.ReactNode> = {
  'SIEM': <StorageIcon size={20} />,
  'Email': <EmailIcon size={20} />,
  'EDR': <BugReportIcon size={20} />,
  'ITSM': <BuildIcon size={20} />,
  'Threat Intel': <SecurityIcon size={20} />,
  'Cloud': <CloudIcon size={20} />,
};

export const HeroSection = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        pt: { xs: 12, md: 16, xl: 20 },
        pb: { xs: 8, md: 12, xl: 16 },
      }}
    >
      {/* Vibrant gradient background */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 102, 0, 0.07) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 90% 80%, rgba(139, 92, 246, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 10% 80%, rgba(34, 197, 94, 0.03) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
        }}
      />

      {/* Animated mesh grid */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(255, 102, 0, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 102, 0, 0.015) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        }}
      />

      {/* Floating integration icons */}
      <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
        {floatingIcons.map((icon) => (
          <FloatingIcon key={icon.name} {...icon} />
        ))}
      </Box>

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center' }}>
          {/* Main headline - rendered immediately for LCP */}
          <div>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.75rem', sm: '4rem', md: '5rem' },
                fontWeight: 800,
                lineHeight: 1.05,
                mb: 4,
                letterSpacing: '-0.02em',
              }}
            >
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 50%, #FFB380 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Automatic
              </Box>{' '}
              Security
              <br />
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 50%, #FFB380 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                You Control
              </Box>
            </Typography>
          </div>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Typography
              variant="h2"
              component="p"
              sx={{
                color: 'text.secondary',
                maxWidth: 600,
                mx: 'auto',
                mb: 6,
                fontWeight: 400,
                lineHeight: 1.7,
                fontSize: { xs: '1.1rem', md: '1.35rem' },
              }}
            >
              AI-powered incident response that reaches{' '}
              <Box component="span" sx={{ color: '#22c55e', fontWeight: 600 }}>
                everywhere
              </Box>
              —cloud, on-prem, hybrid. Every action is logged, every decision is yours.
            </Typography>
          </motion.div>

          {/* Single prominent CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Button
              component={Link}
              to="/register"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => trackCTA('start_for_free', 'hero')}
              sx={{
                py: { xs: 1.5, md: 2 },
                px: { xs: 4, md: 6 },
                fontSize: { xs: '1rem', md: '1.2rem' },
                fontWeight: 600,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                boxShadow: '0 8px 32px rgba(255, 102, 0, 0.35)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 40px rgba(255, 102, 0, 0.45)',
                },
              }}
            >
              Start for Free
            </Button>
            <Typography
              sx={{
                mt: 2,
                color: 'text.secondary',
                fontSize: '0.9rem',
              }}
            >
              Setup in 5 minutes
            </Typography>
          </motion.div>

          {/* Tool category badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <Box sx={{ mt: 16 }}>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  mb: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Your existing tools. Your data sources. Connected.
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 2,
                  mb: 4,
                }}
              >
                {[
                  { name: 'Cloud', color: '#4285F4', category: 'cloud' },
                  { name: 'SIEM', color: '#65A637', category: 'siem' },
                  { name: 'Email', color: '#EA4335', category: 'email' },
                  { name: 'EDR', color: '#E01E5A', category: 'edr' },
                  { name: 'ITSM', color: '#81B5A1', category: 'itsm' },
                  { name: 'Threat Intel', color: '#8b5cf6', category: 'threat intel' },
                ].map((cat, i) => (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.08 }}
                  >
                    <Box
                      component={Link}
                      to={`/apps?category=${encodeURIComponent(cat.category)}`}
                      sx={{
                        py: 1.5,
                        px: 3,
                        borderRadius: 3,
                        background: `${cat.color}10`,
                        border: `1px solid ${cat.color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        transition: 'all 0.2s ease',
                        color: cat.color,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        '&:hover': {
                          background: `${cat.color}20`,
                          borderColor: `${cat.color}50`,
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      {categoryIcons[cat.name]}
                      <Typography sx={{ color: 'text.primary', fontSize: '0.9rem', fontWeight: 500 }}>
                        {cat.name}
                      </Typography>
                    </Box>
                  </motion.div>
                ))}
              </Box>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
              >
                <Box
                  component={Link}
                  to="/apps"
                  sx={{
                    display: 'inline-flex',
                    py: 1,
                    px: 3,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(255, 102, 0, 0.15) 0%, rgba(255, 102, 0, 0.05) 100%)',
                    border: '1px solid rgba(255, 102, 0, 0.25)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Typography sx={{ color: 'primary.main', fontSize: '0.9rem', fontWeight: 600 }}>
                    + 3,000 MCP-ready integrations
                  </Typography>
                </Box>
              </motion.div>
            </Box>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
};