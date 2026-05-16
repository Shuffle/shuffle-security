import { ArrowRight as ArrowForwardIcon } from 'lucide-react';
import { Box, Container, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { trackCTA } from '@/lib/analytics';

export const CTASection = () => {
  return (
    <Box 
      sx={{ 
        py: { xs: 12, md: 20 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background gradients */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255, 102, 0, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 20% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Box sx={{ textAlign: 'center' }}>



            <Typography
              variant="h2"
              sx={{
                mb: 3,
                fontWeight: 700,
                fontSize: { xs: '2rem', md: '3.25rem' },
                lineHeight: 1.15,
              }}
            >
              Ready to stop drowning
              <br />
              in{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                alerts
              </Box>
              ?
            </Typography>
            <Typography
              sx={{
                color: 'text.secondary',
                mb: 6,
                fontWeight: 400,
                maxWidth: 500,
                mx: 'auto',
                fontSize: { xs: '1.05rem', md: '1.2rem' },
                lineHeight: 1.7,
              }}
            >
              Get started in minutes. No credit card, no sales call, no 47-page enterprise agreement.
            </Typography>

            <Button
              component={Link}
              to="/login"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => trackCTA('start_for_free', 'cta_section')}
              sx={{
                py: { xs: 1.5, md: 2 },
                px: { xs: 4, md: 6 },
                fontSize: { xs: '1rem', md: '1.15rem' },
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
                mt: 3,
                color: 'text.secondary',
                fontSize: '0.9rem',
              }}
            >
              Free tier available • Setup in 5 minutes • Cancel anytime
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};