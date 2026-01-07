import { Box, Container, Typography, Button, Stack, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

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
      }}
    >
      {/* Background effects */}
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150%',
          height: '80%',
          background: 'radial-gradient(ellipse at center, rgba(34, 184, 207, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(34, 184, 207, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 184, 207, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Chip
              label="🚀 Now with AI-powered threat detection"
              sx={{
                mb: 3,
                py: 2.5,
                px: 1,
                fontSize: '0.9rem',
                background: 'rgba(34, 184, 207, 0.1)',
                border: '1px solid rgba(34, 184, 207, 0.3)',
                color: 'primary.main',
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
                fontWeight: 700,
                lineHeight: 1.1,
                mb: 3,
              }}
            >
              Security Operations,{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #22b8cf 0%, #0ea5e9 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Unified
              </Box>
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Typography
              variant="h5"
              sx={{
                color: 'text.secondary',
                maxWidth: 700,
                mx: 'auto',
                mb: 5,
                fontWeight: 400,
                lineHeight: 1.6,
              }}
            >
              Streamline your security workflows with intelligent alert management,
              collaborative case investigation, and automated response actions.
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
              alignItems="center"
            >
              <Button
                component={Link}
                to="/dashboard"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1.1rem',
                }}
              >
                Start Free Trial
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<PlayArrowIcon />}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1.1rem',
                }}
              >
                Watch Demo
              </Button>
            </Stack>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <Box
              sx={{
                mt: 8,
                p: 2,
                borderRadius: 3,
                background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(22, 32, 50, 0.8) 100%)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              <Box
                component="img"
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop"
                alt="Dashboard Preview"
                sx={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: 2,
                  opacity: 0.9,
                }}
              />
            </Box>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
};
