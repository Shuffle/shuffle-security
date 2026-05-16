/**
 * RoutingSuggestionBanner — surfaces routing suggestions written by the
 * incident automation workflow.
 *
 * The workflow writes the suggestion payload into the incident at:
 *   rawOCSF.metadata.extensions.custom_attributes.routing_suggestions = [
 *     {
 *       ruleId: string,
 *       ruleName: string,
 *       targetOrgId: string,
 *       targetOrgName?: string,
 *       reason?: string,
 *       suggestedTs: number,
 *       status?: 'pending' | 'accepted' | 'dismissed',
 *     }
 *   ]
 *
 * This component reads that array, shows the most recent pending entry as
 * a CTA, and lets the user accept (triggers onAccept callback — the page
 * decides what to do, typically the existing "Move incident" action) or
 * dismiss (writes status: 'dismissed' back into the array).
 *
 * Standalone: takes the incident shape it needs as props plus an updater
 * callback. No knowledge of the page that hosts it.
 */
import { X as CloseIcon, GitBranch as CallSplitIcon } from 'lucide-react';
import { Box, Typography, Button, IconButton, Tooltip } from '@mui/material';
export interface RoutingSuggestion {
  ruleId: string;
  ruleName: string;
  targetOrgId: string;
  targetOrgName?: string;
  reason?: string;
  suggestedTs?: number;
  status?: 'pending' | 'accepted' | 'dismissed';
}

interface RoutingSuggestionBannerProps {
  suggestions: RoutingSuggestion[] | undefined | null;
  onAccept: (suggestion: RoutingSuggestion) => void;
  onDismiss: (suggestion: RoutingSuggestion) => void;
  isWorking?: boolean;
}

export const RoutingSuggestionBanner = ({
  suggestions,
  onAccept,
  onDismiss,
  isWorking = false,
}: RoutingSuggestionBannerProps) => {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;

  // Most recent pending suggestion wins.
  const pending = suggestions
    .filter((s) => !s.status || s.status === 'pending')
    .sort((a, b) => (b.suggestedTs || 0) - (a.suggestedTs || 0))[0];

  if (!pending) return null;

  const targetLabel = pending.targetOrgName || pending.targetOrgId.slice(0, 8);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        mb: 1.5,
        borderRadius: 2,
        bgcolor: 'hsl(var(--primary) / 0.08)',
        border: '1px solid hsl(var(--primary) / 0.4)',
      }}
    >
      <CallSplitIcon size={18} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
          Routing rule suggests moving this incident to{' '}
          <Box component="span" sx={{ color: 'hsl(var(--primary))' }}>
            {targetLabel}
          </Box>
        </Typography>
        <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          {pending.ruleName}
          {pending.reason ? ` — ${pending.reason}` : ''}
        </Typography>
      </Box>
      <Button
        variant="contained"
        size="small"
        onClick={() => onAccept(pending)}
        disabled={isWorking}
        sx={{
          height: 36,
          bgcolor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          textTransform: 'none',
          fontWeight: 600,
          '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
        }}
      >
        Move to {targetLabel}
      </Button>
      <Tooltip title="Dismiss suggestion">
        <IconButton
          size="small"
          onClick={() => onDismiss(pending)}
          disabled={isWorking}
          sx={{ width: 36, height: 36, color: 'hsl(var(--muted-foreground))' }}
        >
          <CloseIcon size={18} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default RoutingSuggestionBanner;
