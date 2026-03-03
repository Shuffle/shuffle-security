import { useState } from 'react';
import { Box, IconButton, Popover, Typography, Tooltip, InputBase } from '@mui/material';
import WebhookIcon from '@mui/icons-material/Webhook';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { toast } from 'sonner';

interface WebhookIngestionButtonProps {
  webhookUrl: string;
}

export const WebhookIngestionButton = ({ webhookUrl }: WebhookIngestionButtonProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);
  const popoverOpen = Boolean(anchorEl);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success('Webhook URL copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Tooltip title="Ingestion Webhook (push)" placement="bottom">
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          sx={{
            width: 30,
            height: 30,
            border: '1px solid rgba(34, 197, 94, 0.20)',
            bgcolor: 'rgba(34, 197, 94, 0.10)',
            borderRadius: 1,
            transition: 'opacity 0.15s ease',
            '&:hover': {
              bgcolor: 'rgba(34, 197, 94, 0.18)',
            },
          }}
        >
          <WebhookIcon sx={{ fontSize: 16, color: '#4ade80' }} />
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
        </Typography>
        <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', mb: 1, display: 'block', lineHeight: 1.4 }}>
          Send alerts to this URL to push incidents directly.
        </Typography>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: 'hsl(var(--muted) / 0.5)',
          border: '1px solid hsl(var(--border))',
          borderRadius: 1,
          px: 1,
          py: 0.5,
        }}>
          <InputBase
            value={webhookUrl}
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
            {copied ? <CheckIcon sx={{ fontSize: 14, color: '#4ade80' }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Box>
      </Popover>
    </Box>
  );
};
