/**
 * Banner shown at the top of a MERGED incident's detail page. Directs the
 * analyst to the primary incident that absorbed this one.
 */

import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { GitMerge, ArrowRight, Link2Off } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { unlinkMergePair } from '@/lib/incidentRelations';
import type { LinkedIncidentSummary } from '@/hooks/useRelatedIncidents';

interface MergedIncidentBannerProps {
  currentIncidentId: string;
  primary: LinkedIncidentSummary | null;
  primaryPointerId?: string;
  loading?: boolean;
  onUnlinked?: () => void;
}

export const MergedIncidentBanner = ({
  currentIncidentId,
  primary,
  primaryPointerId,
  loading,
  onUnlinked,
}: MergedIncidentBannerProps) => {
  const navigate = useNavigate();
  const primaryId = primary?.id || primaryPointerId;
  if (!primaryId) return null;

  const jump = () => {
    if (!primaryId) return;
    navigate(`/incidents/${encodeURIComponent(primaryId)}`);
  };

  const unmerge = async () => {
    if (!primaryId) return;
    const res = await unlinkMergePair({
      primaryId,
      sourceId: currentIncidentId,
    });
    if (res.success) {
      toast.success('Incident unmerged');
      onUnlinked?.();
    } else {
      toast.error(res.error || 'Failed to unmerge');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 1.75,
        mb: 2,
        borderRadius: 2,
        bgcolor: 'hsl(var(--muted) / 0.5)',
        border: '1px solid hsl(var(--border))',
      }}
    >
      <GitMerge size={20} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          This incident was merged into another
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'hsl(var(--muted-foreground))',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
          }}
        >
          {loading
            ? 'Loading primary incident...'
            : primary
              ? primary.title
              : `Primary: ${primaryId}`}
        </Typography>
      </Box>
      <Tooltip title="Unmerge">
        <IconButton size="small" onClick={unmerge} sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <Link2Off size={16} />
        </IconButton>
      </Tooltip>
      <Button
        onClick={jump}
        className="bg-[#ff6600] hover:bg-[#e55c00] text-white h-9"
      >
        Open primary incident
        <ArrowRight size={16} style={{ marginLeft: 4 }} />
      </Button>
    </Box>
  );
};
