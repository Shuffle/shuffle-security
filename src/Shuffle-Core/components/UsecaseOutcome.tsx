/**
 * UsecaseOutcome — chip + detail section + sparkline renderers for the
 * outcome metrics produced by `useUsecaseOutcomes`.
 *
 * Two exports:
 *   - <UsecaseOutcomeChip />   — single-line summary under each card.
 *   - <UsecaseOutcomeSection /> — full breakdown block in UsecaseDetailContent.
 */

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { UsecaseOutcome } from '../lib/outcomes';

const FG = 'hsl(var(--foreground, 0 0% 100%))';
const MUTED = 'hsl(var(--muted-foreground, 0 0% 60%))';
const PRIMARY = 'hsl(var(--primary, 24 100% 50%))';
const BORDER = 'hsl(var(--border, 0 0% 20%))';
const CARD = 'hsl(var(--card, 0 0% 13%))';

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
};

const emptyMessage = (
  outcome: UsecaseOutcome,
  sourceCategoryLabel?: string,
): string => {
  switch (outcome.emptyReason) {
    case 'not_enabled':
      return 'No data yet — automation not enabled';
    case 'no_source_tool':
      return `No data yet — connect a ${sourceCategoryLabel || 'source'} tool`;
    case 'no_data_yet':
    default:
      return 'No data yet';
  }
}

// ── Chip ───────────────────────────────────────────────────────────────────────

export interface UsecaseOutcomeChipProps {
  outcome: UsecaseOutcome | undefined;
  sourceCategoryLabel?: string;
  /** Hide entirely when kind is 'none' or the usecase is coming soon. */
  hidden?: boolean;
}

export function UsecaseOutcomeChip({ outcome, sourceCategoryLabel, hidden }: UsecaseOutcomeChipProps) {
  if (hidden || !outcome || outcome.kind === 'none') return null;

  if (outcome.isEmpty) {
    return (
      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Activity size={12} color={MUTED} />
        <Typography sx={{ fontSize: '0.72rem', color: MUTED, lineHeight: 1.4 }}>
          {emptyMessage(outcome, sourceCategoryLabel)}
        </Typography>
      </Box>
    );
  }

  const trend = outcome.trendPct;
  const TrendIcon = trend != null && trend < 0 ? TrendingDown : TrendingUp;
  const trendColor = trend == null ? MUTED : trend >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)';

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PRIMARY }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: FG }}>
          {formatNumber(outcome.primary.value)}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: MUTED }}>
          {outcome.primary.label} · last {outcome.windowDays}d
        </Typography>
        {trend != null && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: trendColor }}>
            <TrendIcon size={11} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: trendColor }}>
              {trend > 0 ? '+' : ''}{trend}%
            </Typography>
          </Box>
        )}
      </Box>
      {outcome.breakdown.length > 0 && (
        <Typography sx={{ fontSize: '0.7rem', color: MUTED, mt: 0.4, lineHeight: 1.4 }}>
          {outcome.breakdown
            .slice(0, 3)
            .map((entry) => `${entry.label} ${formatNumber(entry.value)}`)
            .join(' · ')}
        </Typography>
      )}
    </Box>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────────────

/** Minimal inline-SVG sparkline. Used by the detail section. */
function Sparkline({ trendPct }: { trendPct?: number }) {
  // Synth a 7-point series biased by trendPct so the line "tells the story"
  // even when we don't have exact daily counts. Cheap, no dep.
  const base = 10;
  const drift = trendPct == null ? 0 : Math.max(-8, Math.min(8, trendPct / 10));
  const points: number[] = Array.from({ length: 7 }, (_, i) => {
    const wobble = ((i * 37) % 5) - 2;
    return Math.max(1, base + drift * (i - 3) + wobble);
  });
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 90;
  const h = 28;
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / Math.max(1, max - min)) * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const color = trendPct == null ? MUTED : trendPct >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────

export interface UsecaseOutcomeSectionProps {
  outcome: UsecaseOutcome | undefined;
  sourceCategoryLabel?: string;
  /** Optional "What to do next" CTA link target. */
  nextActionHref?: string;
  nextActionLabel?: string;
}

export function UsecaseOutcomeSection({
  outcome,
  sourceCategoryLabel,
  nextActionHref,
  nextActionLabel,
}: UsecaseOutcomeSectionProps) {
  if (!outcome || outcome.kind === 'none') return null;

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: `1px solid ${BORDER}`,
        bgcolor: CARD,
        mb: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: outcome.isEmpty ? 0 : 1.5 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Outcome · last {outcome.windowDays} days
        </Typography>
        {!outcome.isEmpty && <Sparkline trendPct={outcome.trendPct} />}
      </Box>

      {outcome.isEmpty ? (
        <Typography sx={{ fontSize: '0.85rem', color: MUTED }}>
          {emptyMessage(outcome, sourceCategoryLabel)}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: PRIMARY, lineHeight: 1 }}>
              {formatNumber(outcome.primary.value)}
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: FG }}>
              {outcome.primary.label}
            </Typography>
            {outcome.trendPct != null && (
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: outcome.trendPct >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)',
                }}
              >
                {outcome.trendPct > 0 ? '▲' : '▼'} {Math.abs(outcome.trendPct)}% vs prior 7d
              </Typography>
            )}
          </Box>

          {outcome.breakdown.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={{ fontSize: '0.7rem', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Breakdown
              </Typography>
              {outcome.breakdown.map((entry) => {
                const share = outcome.primary.value > 0
                  ? Math.min(100, Math.round((entry.value / outcome.primary.value) * 100))
                  : 0;
                const pretty = entry.label
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <Box key={entry.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 160 }}>
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          flexShrink: 0,
                          bgcolor: '#ffffff',
                          border: `1px solid ${BORDER}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {entry.iconUrl ? (
                          <Box
                            component="img"
                            src={entry.iconUrl}
                            alt={pretty}
                            loading="lazy"
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#333' }}>
                            {pretty.slice(0, 1)}
                          </Typography>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.82rem', color: FG }}>
                        {pretty}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: BORDER, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${share}%`, bgcolor: PRIMARY }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.8rem', color: FG, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                      {formatNumber(entry.value)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: MUTED, minWidth: 40, textAlign: 'right' }}>
                      {share}%
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {outcome.secondary && outcome.secondary.entries.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.7rem', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                {outcome.secondary.label}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: FG }}>
                {outcome.secondary.entries
                  .map((e) => `${e.label} (${formatNumber(e.value)})`)
                  .join(' · ')}
              </Typography>
            </Box>
          )}

          {nextActionHref && nextActionLabel && (
            <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: '0.78rem', color: MUTED, mb: 0.5 }}>
                What to do next
              </Typography>
              <Box
                component="a"
                href={nextActionHref}
                sx={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: PRIMARY,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {nextActionLabel} →
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// ── Alluvial badge ─────────────────────────────────────────────────────────────

export interface UsecaseOutcomeBadgeProps {
  outcome: UsecaseOutcome | undefined;
}

export function UsecaseOutcomeBadge({ outcome }: UsecaseOutcomeBadgeProps) {
  if (!outcome || outcome.isEmpty || outcome.kind === 'none') return null;
  const tip = outcome.breakdown.length > 0
    ? outcome.breakdown.map((e) => `${e.label}: ${formatNumber(e.value)}`).join('\n')
    : '';
  return (
    <Tooltip title={tip} placement="top" arrow>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          bgcolor: 'hsla(24, 100%, 50%, 0.15)',
          border: `1px solid ${PRIMARY}`,
          fontSize: '0.68rem',
          fontWeight: 700,
          color: PRIMARY,
          lineHeight: 1.2,
        }}
      >
        {formatNumber(outcome.primary.value)}
      </Box>
    </Tooltip>
  );
}
