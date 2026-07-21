/**
 * Banner shown at the top of a PRIMARY incident's detail page. Lists the
 * incidents that were merged INTO this one, with an unlink action per row.
 */

import { Box, Typography, Chip, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { GitMerge, ExternalLink, Link2Off } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { unlinkMergePair } from '@/lib/incidentRelations';
import type { LinkedIncidentSummary } from '@/hooks/useRelatedIncidents';

interface RelatedIncidentsBannerProps {
  currentIncidentId: string;
  linked: LinkedIncidentSummary[];
  invisibleCount: number;
  loading?: boolean;
  onUnlinked?: () => void;
}

export const RelatedIncidentsBanner = ({
  currentIncidentId,
  linked,
  invisibleCount,
  loading,
  onUnlinked,
}: RelatedIncidentsBannerProps) => {
  const navigate = useNavigate();
  if (!loading && linked.length === 0 && invisibleCount === 0) return null;

  const handleUnlink = async (sourceId: string) => {
    const res = await unlinkMergePair({
      primaryId: currentIncidentId,
      sourceId,
    });
    if (res.success) {
      toast.success('Unmerged');
      onUnlinked?.();
    } else {
      toast.error(res.error || 'Failed to unmerge');
    }
  };

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: linked.length > 0 ? 1 : 0 }}>
        <GitMerge size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {(() => {
            const total = linked.length + invisibleCount;
            return total === 1
              ? '1 incident merged into this one'
              : `${total} incidents merged into this one`;
          })()}
        </Typography>
        {loading && <CircularProgress size={12} sx={{ color: 'hsl(var(--muted-foreground))' }} />}
        {invisibleCount > 0 && (
          <Tooltip title="Merged sources that could not be loaded (deleted or inaccessible)">
            <Chip
              size="small"
              label={`${invisibleCount} unavailable`}
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          </Tooltip>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
        {linked.map((l) => (
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
            <Tooltip title="Unmerge">
              <IconButton
                size="small"
                onClick={() => handleUnlink(l.id)}
                sx={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <Link2Off size={14} />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
