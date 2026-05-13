import { useState } from 'react';
import { Box, Typography, Chip, Tooltip, Popover, IconButton } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import IncidentCorrelationPreview from './IncidentCorrelationPreview';
import CorrelationContextStrip from './CorrelationContextStrip';
import { useIgnoredObservables } from '@/hooks/useIgnoredObservables';

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

interface CorrelationVisibilityOptions {
  currentIncidentId?: string;
  isValueIgnored?: (value: string) => boolean;
}

export const getVisibleCorrelationRefs = (
  correlation: Pick<Correlation, 'key' | 'ref'>,
  options: CorrelationVisibilityOptions = {},
): Array<{ category: string; key: string }> => {
  if (!correlation?.ref?.length) return [];
  if (options.isValueIgnored?.(String(correlation.key || ''))) return [];
  const currentIncidentId = options.currentIncidentId?.toLowerCase();

  return correlation.ref.reduce<Array<{ category: string; key: string }>>((acc, r) => {
    const [category, key] = r.split('|');
    if (!category || !key) return acc;
    if (category.toLowerCase() === 'ignored-observables') return acc;
    if (
      category === 'shuffle-security_incidents' &&
      currentIncidentId &&
      key.toLowerCase() === currentIncidentId
    ) {
      return acc;
    }
    acc.push({ category, key });
    return acc;
  }, []);
};

/**
 * Count the effective correlation refs after filtering out the current incident.
 * Mirrors the filtering logic inside CorrelationRow so callers can show accurate
 * "X correlations" counts without including self-references.
 */
export const getEffectiveCorrelationCount = (
  correlation: Pick<Correlation, 'key' | 'ref'>,
  currentIncidentIdOrOptions?: string | CorrelationVisibilityOptions,
): number => getVisibleCorrelationRefs(
  correlation,
  typeof currentIncidentIdOrOptions === 'string'
    ? { currentIncidentId: currentIncidentIdOrOptions }
    : currentIncidentIdOrOptions,
).length;

/**
 * Returns only correlations that have at least one ref OTHER than the current
 * incident — useful for hiding noise from list counts and badges.
 */
export const filterMeaningfulCorrelations = <T extends Pick<Correlation, 'ref'>>(
  correlations: T[],
  currentIncidentIdOrOptions?: string | CorrelationVisibilityOptions,
): T[] => correlations.filter((c) => getEffectiveCorrelationCount(c as T & Pick<Correlation, 'key'>, currentIncidentIdOrOptions) > 0);

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
  // Pivot popover state — keyed by the incident key the user clicked so two
  // chips in the same row don't fight over the same anchor element.
  const [pivotAnchor, setPivotAnchor] = useState<{ el: HTMLElement; key: string; category: string } | null>(null);
  const closePivot = () => setPivotAnchor(null);

  // Per-org "ignored observables" list — same datastore the Observables tab
  // uses, value-based so it filters correlations regardless of OCSF type.
  const ignoredObs = useIgnoredObservables();
  const isHidden = ignoredObs.isValueIgnored(correlation.key);

  // Group refs by category, excluding the current incident itself and any
  // refs coming from the per-org `ignored-observables` datastore — those are
  // user-suppressed entries and should not count as a correlation match.
  const refsByCategory: Record<string, string[]> = {};
  correlation.ref.forEach((r) => {
    const [category, key] = r.split('|');
    if (!category || !key) return;
    if (category.toLowerCase() === 'ignored-observables') return;
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
        {/* Hide / show — writes to the same per-org `ignored-observables`
            datastore as the Observables tab, value-based so the same row
            disappears from both places. */}
        <Tooltip title={isHidden ? 'Stop ignoring this observable' : 'Hide this observable from the default view'} arrow>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              if (isHidden) ignoredObs.unignore('value', correlation.key);
              else ignoredObs.ignore('value', correlation.key);
            }}
            sx={{
              p: 0.25,
              ml: 0.25,
              flexShrink: 0,
              color: isHidden ? 'hsl(var(--primary))' : 'text.disabled',
              '&:hover': { color: 'hsl(var(--primary))' },
            }}
          >
            {isHidden
              ? <VisibilityIcon sx={{ fontSize: compact ? 14 : 16 }} />
              : <VisibilityOffIcon sx={{ fontSize: compact ? 14 : 16 }} />}
          </IconButton>
        </Tooltip>
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
                  const isFocused = isIncidentCategory && focusedIncidentKey && key.toLowerCase() === focusedIncidentKey.toLowerCase();
                  // Incident chips open a preview popover instead of hard-navigating.
                  // The popover loads the target incident and lets the user decide
                  // whether to actually pivot — keeps context, avoids churn.
                  const handleClick = isIncidentCategory
                    ? (e: React.MouseEvent<HTMLDivElement>) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setPivotAnchor({ el: e.currentTarget, key, category });
                      }
                    : undefined;
                  return (
                    <Chip
                      key={key}
                      label={key}
                      size="small"
                      variant="outlined"
                      clickable={isIncidentCategory}
                      onClick={handleClick}
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

      {/* When the correlation is sparse (≤2 other incidents), eagerly fetch
          each referenced incident and show severity + recency inline. Being
          a "Known IOC" is just one signal — relevance also depends on how
          recent and how severe the related incidents are. We deliberately
          gate this on a small ref count so we don't fan out N requests on
          high-signal correlations (those already have enough metadata to
          justify a click). */}
      {(() => {
        const incidentRefs = refsByCategory['shuffle-security_incidents'] || [];
        if (incidentRefs.length === 0 || incidentRefs.length >= 3) return null;
        return <CorrelationContextStrip incidentKeys={incidentRefs} compact={compact} />;
      })()}

      {/* Pivot preview popover — opens when an incident chip is clicked. */}
      <Popover
        open={!!pivotAnchor}
        anchorEl={pivotAnchor?.el}
        onClose={closePivot}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
            sx: {
              mt: 0.5,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--popover))',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            },
          },
        }}
      >
        {pivotAnchor && (
          <IncidentCorrelationPreview
            incidentKey={pivotAnchor.key}
            category={pivotAnchor.category}
            correlationKey={correlation.key}
            currentIncidentId={currentIncidentId}
          />
        )}
      </Popover>
    </Box>
  );
};

export default CorrelationRow;
