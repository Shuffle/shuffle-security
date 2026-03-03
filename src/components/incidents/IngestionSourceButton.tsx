import { useState } from 'react';
import { Box, IconButton, Popover, Typography, Chip, Button, Tooltip } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import { ValidatedIngestionApp } from '@/lib/ingestionDetection';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { toast } from 'sonner';

interface IngestionSourceButtonProps {
  app: ValidatedIngestionApp;
  allApps: ValidatedIngestionApp[];
  onToggled?: () => void;
}

export const IngestionSourceButton = ({ app, allApps, onToggled }: IngestionSourceButtonProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
  const popoverOpen = Boolean(anchorEl);
  const displayName = app.name.replace(/_/g, ' ');

  // Use optimistic state if set, otherwise fall back to actual
  const isEnabled = optimisticEnabled !== null ? optimisticEnabled : app.enabled;

  const handleToggle = async () => {
    const willBeEnabled = !isEnabled;

    // Optimistic update: flip immediately & close popover
    setOptimisticEnabled(willBeEnabled);
    setAnchorEl(null);

    // Compute new list of all active app names after this toggle
    const activeNames = allApps
      .filter(a => a.name === app.name ? willBeEnabled : a.enabled)
      .map(a => a.name);

    try {
      // Regenerate the Ingest Tickets workflow with the updated app list
      await fetch(getApiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: 'Ingest Tickets',
          app_name: activeNames.join(','),
          category: 'cases',
        }),
      });

      toast.success(willBeEnabled ? `${displayName} sync enabled` : `${displayName} sync disabled`);
      // Reset optimistic state and let parent refetch from workflows
      setOptimisticEnabled(null);
      onToggled?.();
    } catch (error) {
      // Rollback
      setOptimisticEnabled(null);
      console.error('Failed to toggle app:', error);
      toast.error('Failed to update app status');
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Tooltip title={displayName} placement="bottom">
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          sx={{
            width: 30,
            height: 30,
            border: '1px solid',
            borderColor: isEnabled ? 'rgba(34, 197, 94, 0.20)' : 'transparent',
            bgcolor: isEnabled ? 'rgba(34, 197, 94, 0.10)' : 'transparent',
            borderRadius: 1,
            opacity: isEnabled ? 1 : 0.35,
            filter: isEnabled ? 'none' : 'grayscale(1)',
            transition: 'opacity 0.15s ease, filter 0.15s ease',
            '&:hover': {
              bgcolor: isEnabled ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255,255,255,0.1)',
              opacity: isEnabled ? 1 : 0.7,
              filter: 'none',
            },
          }}
        >
          {app.image ? (
            <Box
              component="img"
              src={app.image}
              alt={app.name}
              sx={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'contain' }}
            />
          ) : (
            <DownloadIcon sx={{ fontSize: 16, color: isEnabled ? '#4ade80' : 'rgba(255,255,255,0.4)' }} />
          )}
        </IconButton>
      </Tooltip>
      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              p: 1.5,
              minWidth: 160,
            },
          },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', textTransform: 'capitalize', mb: 1, display: 'block' }}>
          {displayName}
          {!isEnabled && (
            <Chip label="Not Active" size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }} />
          )}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Button
            component="a"
            href={`/apps/${app.name.toLowerCase()}`}
            target="_blank"
            size="small"
            startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            onClick={() => setAnchorEl(null)}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontSize: '0.75rem',
              color: 'hsl(var(--foreground))',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              '&:hover': { bgcolor: 'hsl(var(--muted))' },
            }}
          >
            Visit app
          </Button>
          <Button
            size="small"
            startIcon={isEnabled ? <BlockIcon sx={{ fontSize: 14 }} /> : <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={handleToggle}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontSize: '0.75rem',
              color: isEnabled ? 'hsl(var(--destructive))' : '#22c55e',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              '&:hover': { bgcolor: isEnabled ? 'hsl(var(--destructive) / 0.1)' : 'rgba(34, 197, 94, 0.1)' },
            }}
          >
            {isEnabled ? 'Disable Sync' : 'Enable Sync'}
          </Button>
        </Box>
      </Popover>
    </Box>
  );
};
