import { useState } from 'react';
import { Box, IconButton, Popover, Typography, Tooltip, InputBase, Button, Chip } from '@mui/material';
import WebhookIcon from '@mui/icons-material/Webhook';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { toast } from 'sonner';

export interface WebhookIngestionInfo {
  /** Webhook URL to display (null if workflow doesn't exist yet) */
  url: string | null;
  /** Whether the workflow exists */
  exists: boolean;
  /** Whether the workflow is currently running (not stopped) */
  enabled: boolean;
  /** The workflow ID (needed for start/stop) */
  workflowId: string | null;
}

interface WebhookIngestionButtonProps {
  webhook: WebhookIngestionInfo;
  onToggled?: () => void;
}

export const WebhookIngestionButton = ({ webhook, onToggled }: WebhookIngestionButtonProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
  const popoverOpen = Boolean(anchorEl);

  const isEnabled = optimisticEnabled !== null ? optimisticEnabled : webhook.enabled;

  const handleCopy = async () => {
    if (!webhook.url) return;
    try {
      await navigator.clipboard.writeText(webhook.url);
      setCopied(true);
      toast.success('Webhook URL copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleToggle = async () => {

    const willBeEnabled = !isEnabled;
    setOptimisticEnabled(willBeEnabled);
    setAnchorEl(null);

    try {
      if (willBeEnabled) {
        // Generate/enable the webhook workflow
        const res = await fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'Ingest Tickets_webhook',
          }),
        });
        if (!res.ok) throw new Error('Failed to create webhook workflow');
      } else {
        // Remove the webhook by calling generate with action: remove
        const res = await fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'Ingest Tickets_webhook',
            action_name: 'remove',
          }),
        });
        if (!res.ok) throw new Error('Failed to remove webhook workflow');
      }

      toast.success(willBeEnabled ? 'Ingestion Webhook enabled' : 'Ingestion Webhook disabled');
      setOptimisticEnabled(null);
      onToggled?.();
    } catch (error) {
      setOptimisticEnabled(null);
      console.error('Failed to toggle webhook:', error);
      toast.error('Failed to update webhook status');
    }
  };

  return (
    <Box sx={{ position: 'relative' }} data-tour="webhook-ingestion-button">
      <Tooltip title={isEnabled ? 'Ingestion Webhook (push)' : 'Ingestion Webhook (inactive)'} placement="bottom">
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          sx={{
            width: 30,
            height: 30,
            border: '1px solid',
            borderColor: isEnabled ? 'rgba(34, 197, 94, 0.5)' : 'divider',
            bgcolor: isEnabled ? 'rgba(34, 197, 94, 0.12)' : 'background.paper',
            borderRadius: 1,
            opacity: isEnabled ? 1 : 0.35,
            filter: isEnabled ? 'none' : 'grayscale(1)',
            transition: 'opacity 0.15s ease, filter 0.15s ease',
            '&:hover': {
              bgcolor: isEnabled ? 'rgba(34, 197, 94, 0.18)' : 'action.hover',
              opacity: isEnabled ? 1 : 0.7,
              filter: 'none',
            },
          }}
        >
          <WebhookIcon sx={{ fontSize: 16, color: isEnabled ? '#22c55e' : 'text.disabled' }} />
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
              minWidth: 280,
              maxWidth: 400,
            },
          },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.5, display: 'block' }}>
          Ingestion Webhook
          {!isEnabled && (
            <Chip label="Not Active" size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }} />
          )}
        </Typography>
        <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', mb: 1, display: 'block', lineHeight: 1.4 }}>
          {isEnabled
            ? 'Send alerts to this URL to push incidents directly.'
            : webhook.exists
              ? 'This webhook is currently stopped. Enable it to receive pushed alerts.'
              : 'Enable to create a webhook endpoint for pushing alerts.'}
        </Typography>

        {/* Show URL field only when enabled and URL exists */}
        {isEnabled && webhook.url && (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'hsl(var(--muted) / 0.5)',
            border: '1px solid hsl(var(--border))',
            borderRadius: 1,
            px: 1,
            py: 0.5,
            mb: 1,
          }}>
            <InputBase
              value={webhook.url}
              readOnly
              fullWidth
              sx={{
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                color: 'hsl(var(--foreground))',
                '& input': { p: 0 },
              }}
            />
            <IconButton size="small" onClick={handleCopy} sx={{ p: 0.5, color: 'hsl(var(--muted-foreground))' }}>
              {copied ? <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </Box>
        )}

        {/* Enable / Disable button */}
        <Button
          size="small"
          startIcon={isEnabled ? <BlockIcon sx={{ fontSize: 14 }} /> : <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
          onClick={handleToggle}
          sx={{
            justifyContent: 'flex-start',
            textTransform: 'none',
            fontSize: '0.75rem',
            color: isEnabled ? 'hsl(var(--destructive))' : 'hsl(var(--severity-low))',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            '&:hover': { bgcolor: isEnabled ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--severity-low) / 0.1)' },
          }}
        >
          {isEnabled ? 'Disable Webhook' : 'Enable Webhook'}
        </Button>
      </Popover>
    </Box>
  );
};
