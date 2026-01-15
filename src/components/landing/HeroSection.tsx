import { Box, Container, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Floating integration icons data
const floatingIcons = [
  { name: 'Slack', color: '#E01E5A', x: '8%', y: '15%', delay: 0, size: 48 },
  { name: 'Jira', color: '#0052CC', x: '85%', y: '20%', delay: 0.2, size: 44 },
  { name: 'AWS', color: '#FF9900', x: '12%', y: '65%', delay: 0.4, size: 52 },
  { name: 'Azure', color: '#0089D6', x: '88%', y: '55%', delay: 0.6, size: 46 },
  { name: 'Splunk', color: '#65A637', x: '5%', y: '40%', delay: 0.8, size: 40 },
  { name: 'PagerDuty', color: '#06AC38', x: '92%', y: '38%', delay: 1.0, size: 42 },
  { name: 'ServiceNow', color: '#81B5A1', x: '15%', y: '85%', delay: 1.2, size: 38 },
  { name: 'GCP', color: '#4285F4', x: '82%', y: '75%', delay: 1.4, size: 44 },
];

const FloatingIcon = ({ name, color, x, y, delay, size }: typeof floatingIcons[0]) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 1, scale: 1 }}
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
        y: [0, -12, 0],
        rotate: [0, 5, -5, 0],
      }}
      transition={{ 
        duration: 4 + Math.random() * 2,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: delay,
      }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          boxShadow: `0 8px 32px ${color}20`,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'scale(1.1)',
            boxShadow: `0 12px 40px ${color}30`,
          },
        }}
      >
        <Typography sx={{ fontSize: size * 0.4, fontWeight: 700, color }}>
          {name.slice(0, 2).toUpperCase()}
        </Typography>
      </Box>
    </motion.div>
  </motion.div>
);

export const HeroSection = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        pt: 8,
        pb: 12,
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
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 102, 0, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 90% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 10% 80%, rgba(34, 197, 94, 0.06) 0%, transparent 50%)
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
            linear-gradient(rgba(255, 102, 0, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 102, 0, 0.03) 1px, transparent 1px)
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
          {/* Playful badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                mb: 4,
                py: 1,
                px: 2.5,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(255, 102, 0, 0.15) 0%, rgba(255, 133, 51, 0.1) 100%)',
                border: '1px solid rgba(255, 102, 0, 0.25)',
              }}
            >
              <Box
                component={motion.div}
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                sx={{ fontSize: '1.2rem' }}
              >
                🚀
              </Box>
              <Typography sx={{ color: 'primary.main', fontWeight: 600, fontSize: '0.9rem' }}>
                Connect in minutes, not months
              </Typography>
            </Box>
          </motion.div>

          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
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
          </motion.div>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Typography
              variant="h5"
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
              to="/login"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                py: 2,
                px: 6,
                fontSize: '1.2rem',
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
              No credit card required • Setup in 5 minutes
            </Typography>
          </motion.div>

          {/* Integration logos strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <Box sx={{ mt: 10 }}>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  mb: 3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Connects to everything you already use
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                {['Slack', 'Jira', 'ServiceNow', 'PagerDuty', 'Splunk', 'AWS', 'Azure', 'GCP'].map((name, i) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.05 }}
                  >
                    <Box
                      sx={{
                        py: 1,
                        px: 2.5,
                        borderRadius: 2,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          background: 'rgba(255, 255, 255, 0.06)',
                          borderColor: 'rgba(255, 102, 0, 0.3)',
                        },
                      }}
                    >
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', fontWeight: 500 }}>
                        {name}
                      </Typography>
                    </Box>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                >
                  <Box
                    sx={{
                      py: 1,
                      px: 2.5,
                      borderRadius: 2,
                      background: 'rgba(255, 102, 0, 0.1)',
                      border: '1px solid rgba(255, 102, 0, 0.25)',
                    }}
                  >
                    <Typography sx={{ color: 'primary.main', fontSize: '0.85rem', fontWeight: 600 }}>
                      + 200 more
                    </Typography>
                  </Box>
                </motion.div>
              </Box>
            </Box>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
};