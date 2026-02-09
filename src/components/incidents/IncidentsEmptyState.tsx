import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import InboxIcon from '@mui/icons-material/Inbox';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export const IncidentsEmptyState = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 12,
          px: 4,
          textAlign: 'center',
          maxWidth: 520,
          mx: 'auto',
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '20px',
            backgroundColor: 'rgba(255, 102, 0, 0.08)',
            border: '1px solid rgba(255, 102, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 4,
          }}
        >
          <InboxIcon sx={{ fontSize: 36, color: '#FF6600', opacity: 0.8 }} />
        </Box>

        {/* Title */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            mb: 1.5,
          }}
        >
          No incidents yet
        </Typography>

        {/* Description */}
        <Typography
          variant="body1"
          sx={{
            color: 'hsl(var(--muted-foreground))',
            mb: 5,
            lineHeight: 1.7,
            maxWidth: 420,
          }}
        >
          Connect your security tools to start ingesting alerts and incidents automatically. 
          Set up your sources in just a few minutes.
        </Typography>

        {/* CTA */}
        <Button
          component={Link}
          to="/onboarding/sources"
          variant="contained"
          size="large"
          startIcon={<RocketLaunchIcon />}
          endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
          sx={{
            px: 4,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            backgroundColor: '#FF6600',
            '&:hover': {
              backgroundColor: '#e55c00',
            },
          }}
        >
          Set Up Ingestion
        </Button>

        {/* Secondary hint */}
        <Typography
          variant="caption"
          sx={{
            mt: 3,
            color: 'hsl(var(--muted-foreground))',
            opacity: 0.6,
          }}
        >
          You can also create incidents manually using the + button above
        </Typography>
      </Box>
    </motion.div>
  );
};
