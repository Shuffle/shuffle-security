/**
 * Banner listing incidents that share the same `thread_id` as the one
 * being viewed. Read-only surface plus an optional "Auto-merge" CTA that
 * lets the analyst collapse the thread — the newest incident is kept as
 * primary and the rest become non-primary merged links.
 */

import { Box, Typography, Chip, IconButton, Tooltip, CircularProgress, Button } from '@mui/material';
import { MessagesSquare, ExternalLink, GitMerge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LinkedIncidentSummary } from '@/hooks/useRelatedIncidents';

interface ThreadCorrelatedBannerProps {
  threadId: string | null;
  incidents: LinkedIncidentSummary[];
  invisibleCount: number;
  loading?: boolean;
  /** Optional callback to auto-merge all thread siblings into the latest. */
  onAutoMerge?: () => void | Promise<void>;
  /** Disables the CTA and shows a spinner while a merge is in flight. */
  autoMergeBusy?: boolean;
}

export const ThreadCorrelatedBanner = ({
  threadId,
  incidents,
  invisibleCount,
  loading,
  onAutoMerge,
  autoMergeBusy,
}: ThreadCorrelatedBannerProps) => {
  const navigate = useNavigate();
  if (!threadId) return null;
  if (!loading && incidents.length === 0 && invisibleCount === 0) return null;

  return (
    <Box
      sx={{
        px: 2.5,
        py: 1.75,
        mb: 2,
        borderRadius: 2,
        bgcolor: 'hsl(var(--muted) / 0.35)',
        border: '1px solid hsl(var(--border))',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <MessagesSquare size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {incidents.length === 1
            ? '1 incident shares this thread'
            : `${incidents.length} incidents share this thread`}
        </Typography>
        <Tooltip title="Shared thread_id">
          <Chip
            size="small"
            label={threadId.length > 24 ? `${threadId.substring(0, 24)}…` : threadId}
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontFamily: 'monospace',
              bgcolor: 'hsl(var(--background) / 0.6)',
              border: '1px solid hsl(var(--border))',
            }}
          />
        </Tooltip>
        {loading && <CircularProgress size={12} sx={{ color: 'hsl(var(--muted-foreground))' }} />}
        {invisibleCount > 0 && (
          <Chip
            size="small"
            label={`${invisibleCount} not visible`}
            sx={{ height: 18, fontSize: '0.65rem' }}
          />
        )}
        {onAutoMerge && incidents.length > 0 && (
          <Box sx={{ ml: 'auto' }}>
            <Button
              size="small"
              variant="outlined"
              disabled={autoMergeBusy}
              onClick={() => { void onAutoMerge(); }}
              startIcon={autoMergeBusy
                ? <CircularProgress size={12} sx={{ color: 'inherit' }} />
                : <GitMerge size={14} />}
              sx={{
                height: 28,
                fontSize: '0.7rem',
                textTransform: 'none',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                '&:hover': {
                  borderColor: 'hsl(var(--primary))',
                  bgcolor: 'hsl(var(--primary) / 0.08)',
                },
              }}
            >
              {autoMergeBusy ? 'Merging…' : 'Auto-merge into latest'}
            </Button>
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
        {incidents.map((l) => (
          <Box
            key={l.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: 1.5,
              bgcolor: 'hsl(var(--background) / 0.5)',
              '&:hover': { bgcolor: 'hsl(var(--muted) / 0.4)' },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {l.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              {l.id.substring(0, 10)}…
            </Typography>
            <Tooltip title="Open">
              <IconButton
                size="small"
                onClick={() => navigate(`/incidents/${encodeURIComponent(l.id)}`)}
                sx={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <ExternalLink size={14} />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

