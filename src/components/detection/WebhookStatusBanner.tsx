import { Box, Typography, Button, CircularProgress, Chip } from '@mui/material';
import WebhookIcon from '@mui/icons-material/Webhook';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from 'sonner';

/**
 * Small chip shown inline next to page titles when webhook is active.
 */
export const WebhookActiveChip = () => {
  const { exists, enabled, isLoading } = useWebhookStatus();

  if (isLoading || !exists || !enabled) return null;

  return (
    <Chip
      icon={<WebhookIcon sx={{ fontSize: '14px !important', color: '#22c55e !important' }} />}
      label="Webhook Active"
      size="small"
      sx={{
        height: 22,
        fontSize: '0.65rem',
        fontWeight: 600,
        bgcolor: 'rgba(34, 197, 94, 0.10)',
        color: '#22c55e',
        border: '1px solid rgba(34, 197, 94, 0.25)',
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
};

/**
 * Full-width banner shown when webhook is NOT active.
 * Includes an enable button.
 */
const WebhookStatusBanner = () => {
  const { exists, enabled, isLoading, enable, isEnabling } = useWebhookStatus();

  // Don't render if loading or webhook is already active
  if (isLoading || (exists && enabled)) return null;

  const handleEnable = async () => {
    try {
      await enable();
      toast.success('Ingestion Webhook enabled');
    } catch {
      toast.error('Failed to enable webhook');
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 2,
      py: 1,
      borderRadius: 1.5,
      border: '1px solid rgba(255, 152, 0, 0.25)',
      bgcolor: 'rgba(255, 152, 0, 0.06)',
    }}>
      <WebhookIcon sx={{ fontSize: 16, color: 'hsl(var(--severity-medium))' }} />
      <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500, flex: 1 }}>
        Ingestion Webhook is not active — detections won't forward to incidents.
      </Typography>
      <Button
        size="small"
        variant="outlined"
        disabled={isEnabling}
        onClick={handleEnable}
        startIcon={isEnabling ? <CircularProgress size={12} /> : <WebhookIcon sx={{ fontSize: 14 }} />}
        sx={{
          textTransform: 'none',
          fontSize: '0.75rem',
          fontWeight: 600,
          borderColor: 'rgba(255, 152, 0, 0.4)',
          color: 'hsl(var(--foreground))',
          whiteSpace: 'nowrap',
          '&:hover': { borderColor: 'rgba(255, 152, 0, 0.7)', bgcolor: 'rgba(255, 152, 0, 0.08)' },
        }}
      >
        {isEnabling ? 'Enabling…' : 'Enable Webhook'}
      </Button>
    </Box>
  );
};

export default WebhookStatusBanner;
