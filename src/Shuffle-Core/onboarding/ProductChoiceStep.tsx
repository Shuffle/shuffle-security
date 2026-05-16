import { Box, Container, Typography, Stack } from '@mui/material';
import { Shield, Workflow, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProductChoiceStepProps {
  onSelectCore: () => void;
  onSelectSecurity: () => void;
}

export const ProductChoiceStep = ({ onSelectCore, onSelectSecurity }: ProductChoiceStepProps) => {
  const cards = [
    {
      key: 'security',
      title: 'Shuffle Security',
      tagline: 'Detect, triage and respond to incidents',
      description:
        'A modern SOC platform built on Shuffle. Connect data sources, enrich alerts, manage incidents and let AI agents do the heavy lifting.',
      icon: <Shield size={28} />,
      onClick: onSelectSecurity,
      cta: 'Continue with Security',
    },
    {
      key: 'core',
      title: 'Shuffle Core',
      tagline: 'Automation platform for everything else',
      description:
        'The original Shuffle. Build workflows, integrate 3,000+ apps, run AI agents and automate any process across your stack.',
      icon: <Workflow size={28} />,
      onClick: onSelectCore,
      cta: 'Continue with Core',
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        backgroundColor: 'hsl(var(--background))',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        pt: { xs: 6, sm: 10 },
        pb: { xs: 6, sm: 10 },
      }}
    >
      {/* Background effects */}
      <Box
        sx={{
          position: 'fixed',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150%',
          height: '80%',
          background:
            'radial-gradient(ellipse at center, hsl(var(--primary) / 0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `
            linear-gradient(hsl(var(--primary) / 0.02) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary) / 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Stack spacing={1.5} sx={{ textAlign: 'center', mb: { xs: 5, sm: 7 } }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                color: 'hsl(var(--foreground))',
                fontSize: { xs: '1.75rem', sm: '2.25rem' },
              }}
            >
              Welcome to Shuffle
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'hsl(var(--muted-foreground))', maxWidth: 560, mx: 'auto' }}
            >
              Which product are you setting up today? You can switch later.
            </Typography>
          </Stack>
        </motion.div>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          {cards.map((card, idx) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + idx * 0.1 }}
              style={{ flex: 1 }}
            >
              <Box
                role="button"
                tabIndex={0}
                onClick={card.onClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.onClick();
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 4,
                  p: { xs: 3, sm: 4 },
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    boxShadow: '0 10px 30px -10px hsl(var(--primary) / 0.3)',
                    transform: 'translateY(-2px)',
                  },
                  '&:focus-visible': {
                    outline: '2px solid hsl(var(--primary))',
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 100%)',
                    color: 'hsl(var(--primary-foreground))',
                    mb: 2.5,
                  }}
                >
                  {card.icon}
                </Box>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', mb: 0.5 }}
                >
                  {card.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'hsl(var(--muted-foreground))', mb: 2, fontWeight: 500 }}
                >
                  {card.tagline}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'hsl(var(--muted-foreground))', flex: 1, mb: 3, lineHeight: 1.6 }}
                >
                  {card.description}
                </Typography>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    color: 'hsl(var(--primary))',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  <span>{card.cta}</span>
                  <ArrowRight size={16} />
                </Stack>
              </Box>
            </motion.div>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default ProductChoiceStep;
