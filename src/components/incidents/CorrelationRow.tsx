import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { Link } from 'react-router-dom';

export interface Correlation {
  key: string;
  amount: number;
  ref: string[];
}

interface CorrelationRowProps {
  correlation: Correlation;
  /** Current incident ID — references to it will be filtered out so the row only shows OTHER matches. */
  currentIncidentId?: string;
  /** Highlight class (e.g. for timeline flash). */
  className?: string;
  /** Compact density variant for inline rendering inside observable rows. */
  compact?: boolean;
}

/**
 * Shared correlation row used by both the Correlations tab and the per-observable
 * inline correlations on the Observables tab. Mirrors the rich layout used on
 * the Correlations page: groups refs by datastore category, dims the current
 * incident, and renders incident chips as links.
 */
export const CorrelationRow = ({ correlation, currentIncidentId, className, compact = false }: CorrelationRowProps) => {
  // Group refs by category, excluding the current incident itself.
  const refsByCategory: Record<string, string[]> = {};
  correlation.ref.forEach((r) => {
    const [category, key] = r.split('|');
    if (!category || !key) return;
    if (category === 'shuffle-security_incidents' && currentIncidentId && key.toLowerCase() === currentIncidentId.toLowerCase()) {
      return;
    }
    if (!refsByCategory[category]) refsByCategory[category] = [];
    refsByCategory[category].push(key);
  });

  const categories = Object.keys(refsByCategory);
  // Effective match count after filtering out the current incident.
  const effectiveAmount = categories.reduce((sum, c) => sum + refsByCategory[c].length, 0);
  const isHighMatch = effectiveAmount >= 5;
  const isMediumMatch = effectiveAmount >= 3 && effectiveAmount < 5;
  const dotColor = isHighMatch ? '#ff6600' : isMediumMatch ? '#eab308' : 'hsl(var(--muted-foreground))';

  const formatCategory = (cat: string) => cat.replace('shuffle-', '').replace(/_/g, ' ');

  // Hide rows that have nothing to show after filtering (e.g. only the current incident).
  if (effectiveAmount === 0) return null;

  return (
    <Box
      data-corr-key={correlation.key}
      className={className}
      sx={{
        p: compact ? 1.25 : 1.75,
        borderRadius: 1.5,
        bgcolor: 'transparent',
        border: '1px solid hsl(var(--border))',
        transition: 'border-color 120ms ease',
        '&:hover': { borderColor: 'hsl(var(--border) / 0.8)' },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: categories.length > 0 ? (compact ? 1 : 1.25) : 0 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontSize: compact ? '0.72rem' : '0.78rem',
            fontWeight: 600,
            color: 'text.primary',
            wordBreak: 'break-all',
          }}
        >
          {correlation.key}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', ml: 'auto', flexShrink: 0, fontSize: compact ? '0.65rem' : undefined }}
        >
          {effectiveAmount} match{effectiveAmount !== 1 ? 'es' : ''}
        </Typography>
      </Box>

      {/* Refs grouped by category */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {categories.map((category) => {
          const keys = refsByCategory[category];
          const isIncidentCategory = category === 'shuffle-security_incidents';

          return (
            <Box key={category} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  minWidth: compact ? 84 : 100,
                  textTransform: 'capitalize',
                  pt: 0.25,
                  fontSize: compact ? '0.65rem' : '0.7rem',
                }}
              >
                {formatCategory(category)}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {keys.slice(0, 5).map((key) => (
                  <Chip
                    key={key}
                    label={key}
                    size="small"
                    variant="outlined"
                    component={isIncidentCategory ? Link : 'div'}
                    to={isIncidentCategory ? `/incidents/${key}` : undefined}
                    clickable={isIncidentCategory}
                    onClick={isIncidentCategory ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
                    sx={{
                      height: compact ? 20 : 22,
                      fontSize: compact ? '0.65rem' : '0.7rem',
                      fontFamily: 'monospace',
                      bgcolor: 'transparent',
                      borderColor: 'hsl(var(--border))',
                      color: isIncidentCategory ? 'hsl(var(--primary))' : 'text.secondary',
                      cursor: isIncidentCategory ? 'pointer' : 'default',
                      '&:hover': isIncidentCategory
                        ? {
                            bgcolor: 'hsl(var(--primary) / 0.06)',
                            borderColor: 'hsl(var(--primary) / 0.5)',
                          }
                        : {},
                    }}
                  />
                ))}
                {keys.length > 5 && (
                  <Tooltip title={keys.slice(5).join(', ')} arrow>
                    <Chip
                      label={`+${keys.length - 5}`}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: compact ? 20 : 22,
                        fontSize: compact ? '0.65rem' : '0.7rem',
                        bgcolor: 'transparent',
                        borderColor: 'hsl(var(--border))',
                        color: 'text.disabled',
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default CorrelationRow;
