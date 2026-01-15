import { Box, Container, Typography, Button, Stack, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';

export const HeroSection = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        pt: 12,
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
          background: 'radial-gradient(ellipse at center, rgba(255, 102, 0, 0.06) 0%, transparent 60%)',
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
            linear-gradient(rgba(255, 102, 0, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 102, 0, 0.02) 1px, transparent 1px)
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
              label="⚡ Open Source • Cloud & On-Premises"
              sx={{
                mb: 3,
                py: 2.5,
                px: 1,
                fontSize: '0.9rem',
                background: 'rgba(255, 102, 0, 0.1)',
                border: '1px solid rgba(255, 102, 0, 0.3)',
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
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Configurable
              </Box>{' '}
              Alert & Case Management
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
                maxWidth: 650,
                mx: 'auto',
                mb: 5,
                fontWeight: 400,
                lineHeight: 1.6,
              }}
            >
              Open-source automation for security, IT, and support operations.
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
                to="/login"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1.1rem',
                }}
              >
                Get Started
              </Button>
              <Button
                component={Link}
                to="/docs"
                variant="outlined"
                size="large"
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1.1rem',
                }}
              >
                Read Docs
              </Button>
            </Stack>
          </motion.div>

          {/* Feature cards instead of image */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              sx={{ mt: 10 }}
              justifyContent="center"
            >
              {[
                { icon: <NotificationsActiveIcon sx={{ fontSize: 32 }} />, label: 'Any ITSM', count: 'Import from anywhere' },
                { icon: <FolderSpecialIcon sx={{ fontSize: 32 }} />, label: 'Full Control', count: 'Configure everything' },
                { icon: <BubbleChartIcon sx={{ fontSize: 32 }} />, label: 'AI Agents', count: 'Verbose & controllable' },
              ].map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                >
                  <Box
                    sx={{
                      p: 4,
                      borderRadius: 3,
                      background: 'rgba(33, 33, 33, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      minWidth: 200,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: 'rgba(255, 102, 0, 0.3)',
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <Box sx={{ color: 'primary.main', mb: 2 }}>
                      {item.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item.count}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Stack>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
};
