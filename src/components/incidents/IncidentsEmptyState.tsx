import { Box, Typography, Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import InboxIcon from '@mui/icons-material/Inbox';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { ValidatedIngestionApp } from '@/lib/ingestionDetection';
import { IngestionSourceButton } from './IngestionSourceButton';

interface IncidentsEmptyStateProps {
  ingestionApps?: ValidatedIngestionApp[];
  onIngestionToggled?: () => void;
  isSyncing?: boolean;
  onSyncNow?: () => void;
}

export const IncidentsEmptyState = ({ ingestionApps = [], onIngestionToggled, isSyncing = false, onSyncNow }: IncidentsEmptyStateProps) => {
  const hasApps = ingestionApps.length > 0;

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
            mb: 3,
            lineHeight: 1.7,
            maxWidth: 420,
          }}
        >
          {hasApps
            ? 'Your ingestion sources are configured below. Incidents will appear here once alerts start flowing in.'
            : 'Connect your security tools to start ingesting alerts and incidents automatically. Set up your sources in just a few minutes.'}
        </Typography>

        {/* Ingestion sources bar */}
        {hasApps && (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'hsl(var(--muted) / 0.4)',
            border: '1px solid hsl(var(--border))',
            borderRadius: 1.5,
            px: 1,
            py: 0.75,
            mb: 4,
          }}>
            {ingestionApps.map(app => (
              <IngestionSourceButton key={app.name} app={app} allApps={ingestionApps} onToggled={onIngestionToggled} />
            ))}
            <Tooltip title="Add ingestion source" placement="bottom">
              <IconButton
                component={Link}
                to="/onboarding/automate"
                size="small"
                sx={{
                  width: 28,
                  height: 28,
                  color: 'hsl(var(--muted-foreground))',
                  border: '1px dashed hsl(var(--border))',
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'hsl(var(--muted))',
                    borderStyle: 'solid',
                    color: 'hsl(var(--primary))',
                  },
                }}
              >
                <AddIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {onSyncNow && (
              <Tooltip title="Sync now" placement="bottom">
                <IconButton
                  size="small"
                  disabled={isSyncing}
                  onClick={onSyncNow}
                  sx={{
                    width: 28,
                    height: 28,
                    color: isSyncing ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: 'hsl(var(--muted))',
                      color: 'hsl(var(--primary))',
                    },
                  }}
                >
                  {isSyncing ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

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
          {hasApps ? 'Manage Sources' : 'Set Up Ingestion'}
        </Button>

      </Box>
    </motion.div>
  );
};
