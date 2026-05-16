import { GitMerge as CallMergeIcon, X as CloseIcon, ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, ArrowRight as ArrowForwardIcon } from 'lucide-react';
import { useState } from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, Stack } from '@mui/material';
import { Button } from '@/components/ui/button';
import { ScoredMergeCandidate, MergeMatchReason } from '@/utils/mergeCandidateScoring';

interface MergeCandidatesBannerProps {
  candidates: ScoredMergeCandidate[];
  loading?: boolean;
  /** Open the merge dialog with this candidate preselected as the target. */
  onMergeWith: (candidateId: string) => void;
  /** Persistent storage key for the dismissed/collapsed state (per incident). */
  storageKey?: string;
}

const MAX_VALUES_PER_REASON = 2;

const reasonLabel = (r: MergeMatchReason): { label: string; tone: 'ioc' | 'corr' | 'obs' | 'title' } => {
  switch (r.kind) {
    case 'ioc': {
      const extra = r.values.length > MAX_VALUES_PER_REASON ? ` +${r.values.length - MAX_VALUES_PER_REASON}` : '';
      const head = r.values.slice(0, MAX_VALUES_PER_REASON).join(', ');
      return { label: `Known IOC: ${head}${extra}`, tone: 'ioc' };
    }
    case 'correlation': {
      const extra = r.values.length > MAX_VALUES_PER_REASON ? ` +${r.values.length - MAX_VALUES_PER_REASON}` : '';
      const head = r.values.slice(0, MAX_VALUES_PER_REASON).join(', ');
      return { label: `Shared correlation: ${head}${extra}`, tone: 'corr' };
    }
    case 'observable': {
      const extra = r.values.length > MAX_VALUES_PER_REASON ? ` +${r.values.length - MAX_VALUES_PER_REASON}` : '';
      const head = r.values.slice(0, MAX_VALUES_PER_REASON).join(', ');
      return { label: `Shared observable: ${head}${extra}`, tone: 'obs' };
    }
    case 'title':
      return { label: `Similar title (${Math.round(r.similarity * 100)}%)`, tone: 'title' };
  }
};

const toneStyles: Record<'ioc' | 'corr' | 'obs' | 'title', { bg: string; color: string; border: string }> = {
  ioc: {
    bg: 'hsl(var(--severity-high) / 0.12)',
    color: 'hsl(var(--severity-high))',
    border: 'hsl(var(--severity-high) / 0.35)',
  },
  corr: {
    bg: 'hsl(var(--severity-medium) / 0.12)',
    color: 'hsl(var(--severity-medium))',
    border: 'hsl(var(--severity-medium) / 0.35)',
  },
  obs: {
    bg: 'hsl(var(--muted) / 0.6)',
    color: 'hsl(var(--foreground))',
    border: 'hsl(var(--border))',
  },
  title: {
    bg: 'hsl(var(--primary) / 0.10)',
    color: 'hsl(var(--primary))',
    border: 'hsl(var(--primary) / 0.30)',
  },
};

const formatRelative = (ts: number): string => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
};

export const MergeCandidatesBanner = ({
  candidates,
  loading,
  onMergeWith,
  storageKey,
}: MergeCandidatesBannerProps) => {
  const dismissKey = storageKey ? `${storageKey}::dismissed` : null;
  const expandKey = storageKey ? `${storageKey}::expanded` : null;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!dismissKey) return false;
    try {
      return window.localStorage.getItem(dismissKey) === '1';
    } catch {
      return false;
    }
  });
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (!expandKey) return true;
    try {
      const v = window.localStorage.getItem(expandKey);
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });

  if (loading || dismissed || candidates.length === 0) return null;

  const persistExpanded = (v: boolean) => {
    setExpanded(v);
    if (expandKey) {
      try {
        window.localStorage.setItem(expandKey, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  };

  const persistDismissed = () => {
    setDismissed(true);
    if (dismissKey) {
      try {
        window.localStorage.setItem(dismissKey, '1');
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <Box
      sx={{
        mb: 2,
        borderRadius: 2,
        border: '1px solid hsl(var(--primary) / 0.35)',
        bgcolor: 'hsl(var(--primary) / 0.06)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
        }}
      >
        <CallMergeIcon size={20} style={{ color: 'hsl(var(--primary))' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            {candidates.length} possible duplicate{candidates.length === 1 ? '' : 's'} found in the last 30 days
          </Typography>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Past incidents that share observables, correlations, or known IOCs with this one.
          </Typography>
        </Box>
        <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
          <IconButton size="small" onClick={() => persistExpanded(!expanded)} sx={{ color: 'hsl(var(--muted-foreground))' }}>
            {expanded ? <ExpandLessIcon size={20} /> : <ExpandMoreIcon size={20} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Dismiss">
          <IconButton size="small" onClick={persistDismissed} sx={{ color: 'hsl(var(--muted-foreground))' }}>
            <CloseIcon size={20} />
          </IconButton>
        </Tooltip>
      </Box>

      {expanded && (
        <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {candidates.map(c => (
            <Box
              key={c.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    {c.title}
                  </Typography>
                  {c.created > 0 && (
                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
                      • {formatRelative(c.created)}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {c.reasons.map((r, idx) => {
                    const { label, tone } = reasonLabel(r);
                    const s = toneStyles[tone];
                    return (
                      <Chip
                        key={idx}
                        label={label}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          fontWeight: 500,
                          bgcolor: s.bg,
                          color: s.color,
                          border: `1px solid ${s.border}`,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    );
                  })}
                </Stack>
              </Box>
              <Button
                onClick={() => onMergeWith(c.id)}
                className="h-9 bg-[#ff6600] hover:bg-[#e55c00] text-white"
              >
                <ArrowForwardIcon size={16} style={{ marginRight: '4px' }} />
                Review &amp; merge
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
