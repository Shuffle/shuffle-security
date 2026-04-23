import { Box, Typography, Chip, Tooltip } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Link } from 'react-router-dom';

/**
 * Returns true when a datastore category represents a threat-intelligence
 * source (known IOCs, threat feeds). A correlation pointing to one of these
 * means the observable matches a *known bad* indicator and should be
 * surfaced loudly to the user.
 */
export const isIocCategory = (category: string): boolean => {
  const c = (category || '').toLowerCase();
  return c.includes('ioc') || c.includes('threat-feed') || c.includes('threat_feed');
};

/**
 * Returns true if any ref in the correlation points to an IOC / threat-feed
 * category — i.e. the correlated value is a known indicator of compromise.
 */
export const hasIocMatch = (correlation: Pick<Correlation, 'ref'>): boolean => {
  if (!correlation?.ref?.length) return false;
  return correlation.ref.some((r) => {
    const [category] = r.split('|');
    return category ? isIocCategory(category) : false;
  });
};


export interface Correlation {
  key: string;
  amount: number;
  ref: string[];
}

/**
 * Count the effective correlation refs after filtering out the current incident.
 * Mirrors the filtering logic inside CorrelationRow so callers can show accurate
 * "X correlations" counts without including self-references.
 */
export const getEffectiveCorrelationCount = (
  correlation: Pick<Correlation, 'ref'>,
  currentIncidentId?: string,
): number => {
  if (!correlation?.ref?.length) return 0;
  let count = 0;
  for (const r of correlation.ref) {
    const [category, key] = r.split('|');
    if (!category || !key) continue;
    if (
      category === 'shuffle-security_incidents' &&
      currentIncidentId &&
      key.toLowerCase() === currentIncidentId.toLowerCase()
    ) {
      continue;
    }
    count += 1;
  }
  return count;
};

/**
 * Returns only correlations that have at least one ref OTHER than the current
 * incident — useful for hiding noise from list counts and badges.
 */
export const filterMeaningfulCorrelations = <T extends Pick<Correlation, 'ref'>>(
  correlations: T[],
  currentIncidentId?: string,
): T[] => correlations.filter((c) => getEffectiveCorrelationCount(c, currentIncidentId) > 0);

interface CorrelationRowProps {
  correlation: Correlation;
  /** Current incident ID — references to it will be filtered out so the row only shows OTHER matches. */
  currentIncidentId?: string;
  /** Highlight class (e.g. for timeline flash). */
  className?: string;
  /** Compact density variant for inline rendering inside observable rows. */
  compact?: boolean;
  /** When set, the matching incident chip in this row gets a pulse highlight (used when arriving via ?focus=…). */
  focusedIncidentKey?: string;
}

/**
 * Shared correlation row used by both the Correlations tab and the per-observable
 * inline correlations on the Observables tab. Mirrors the rich layout used on
 * the Correlations page: groups refs by datastore category, dims the current
 * incident, and renders incident chips as links.
 */
export const CorrelationRow = ({ correlation, currentIncidentId, className, compact = false, focusedIncidentKey }: CorrelationRowProps) => {
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
  // IOC / threat-feed matches override severity coloring — known-bad always wins.
  const iocMatch = categories.some(isIocCategory);
  const isHighMatch = effectiveAmount >= 5;
  const isMediumMatch = effectiveAmount >= 3 && effectiveAmount < 5;
  const dotColor = iocMatch
    ? 'hsl(var(--destructive))'
    : isHighMatch ? '#ff6600' : isMediumMatch ? '#eab308' : 'hsl(var(--muted-foreground))';

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
        bgcolor: iocMatch ? 'hsl(var(--destructive) / 0.06)' : 'transparent',
        border: iocMatch
          ? '1px solid hsl(var(--destructive) / 0.5)'
          : '1px solid hsl(var(--border))',
        transition: 'border-color 120ms ease',
        '&:hover': {
          borderColor: iocMatch ? 'hsl(var(--destructive) / 0.7)' : 'hsl(var(--border) / 0.8)',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: categories.length > 0 ? (compact ? 1 : 1.25) : 0 }}>
        <Tooltip
          arrow
          title={
            iocMatch
              ? 'Known IOC / threat-feed match — investigate immediately.'
              : isHighMatch
                ? `High signal: ${effectiveAmount} matches across other incidents and sources.`
                : isMediumMatch
                  ? `Medium signal: ${effectiveAmount} matches across other incidents and sources.`
                  : `Low signal: ${effectiveAmount} match${effectiveAmount === 1 ? '' : 'es'} — this indicator is not widespread.`
          }
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0, cursor: 'help' }} />
        </Tooltip>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontSize: compact ? '0.72rem' : '0.78rem',
            fontWeight: 600,
            color: iocMatch ? 'hsl(var(--destructive))' : 'text.primary',
            wordBreak: 'break-all',
          }}
        >
          {correlation.key}
        </Typography>
        {iocMatch && (
          <Tooltip
            title="This value matches a known Indicator of Compromise (IOC) or threat-feed entry. Investigate immediately."
            arrow
          >
            <Chip
              icon={<WarningAmberIcon sx={{ fontSize: 12, color: 'hsl(var(--destructive)) !important' }} />}
              label="Known IOC"
              size="small"
              sx={{
                height: compact ? 18 : 20,
                fontSize: compact ? '0.6rem' : '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                bgcolor: 'hsl(var(--destructive) / 0.12)',
                color: 'hsl(var(--destructive))',
                border: '1px solid hsl(var(--destructive) / 0.4)',
                '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
              }}
            />
          </Tooltip>
        )}
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
          const isIoc = isIocCategory(category);

          return (
            <Box key={category} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: isIoc ? 'hsl(var(--destructive))' : 'text.disabled',
                  fontWeight: isIoc ? 700 : undefined,
                  minWidth: compact ? 84 : 100,
                  textTransform: 'capitalize',
                  pt: 0.25,
                  fontSize: compact ? '0.65rem' : '0.7rem',
                }}
              >
                {formatCategory(category)}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {keys.slice(0, 5).map((key) => {
                  // For incident pivots, jump into the target incident's Correlations tab
                  // and pass back the current incident as `focus` so the matching chip
                  // there pulses — making the bidirectional link obvious.
                  const incidentTo = isIncidentCategory
                    ? `/incidents/${key}?tab=correlations&correlation=${encodeURIComponent(correlation.key)}${currentIncidentId ? `&focus=${encodeURIComponent(currentIncidentId)}` : ''}`
                    : undefined;
                  const isFocused = isIncidentCategory && focusedIncidentKey && key.toLowerCase() === focusedIncidentKey.toLowerCase();
                  return (
                    <Chip
                      key={key}
                      label={key}
                      size="small"
                      variant="outlined"
                      component={isIncidentCategory ? Link : 'div'}
                      to={incidentTo}
                      clickable={isIncidentCategory}
                      onClick={isIncidentCategory ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
                      className={isFocused ? 'incident-new-flash' : undefined}
                      sx={{
                        height: compact ? 20 : 22,
                        fontSize: compact ? '0.65rem' : '0.7rem',
                        fontFamily: 'monospace',
                        bgcolor: isFocused
                          ? 'hsl(var(--primary) / 0.18)'
                          : isIoc ? 'hsl(var(--destructive) / 0.08)' : 'transparent',
                        borderColor: isFocused
                          ? 'hsl(var(--primary))'
                          : isIoc
                            ? 'hsl(var(--destructive) / 0.5)'
                            : 'hsl(var(--border))',
                        borderWidth: isFocused ? 2 : 1,
                        color: isIoc
                          ? 'hsl(var(--destructive))'
                          : isIncidentCategory ? 'hsl(var(--primary))' : 'text.secondary',
                        fontWeight: isFocused ? 700 : undefined,
                        cursor: isIncidentCategory ? 'pointer' : 'default',
                        '&:hover': isIncidentCategory
                          ? {
                              bgcolor: 'hsl(var(--primary) / 0.06)',
                              borderColor: 'hsl(var(--primary) / 0.5)',
                            }
                          : {},
                      }}
                    />
                  );
                })}
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
                        borderColor: isIoc ? 'hsl(var(--destructive) / 0.4)' : 'hsl(var(--border))',
                        color: isIoc ? 'hsl(var(--destructive))' : 'text.disabled',
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
