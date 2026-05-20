import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

/**
 * Reusable usage bar showing `usage / limit` for any quota (app runs,
 * agent tokens, storage, etc.). Mirrors the visual treatment used in the
 * left sidebar's App-run warning, but always renders so it can be embedded
 * in detail panels (e.g. the Local LLM sidebar) regardless of the current
 * percentage.
 *
 * Color thresholds:
 *   < 65%  → primary/neutral (ok)
 *   65-99% → severity-medium (warning)
 *   >=100% → destructive (over)
 */
export interface UsageBarProps {
  label: string;
  usage: number;
  limit: number;
  /** Suffix shown after numbers, e.g. "runs", "tokens". Optional. */
  unit?: string;
  /** Optional sub-line shown under the label (e.g. "Resets Dec 1"). */
  hint?: string;
  /** Optional upgrade / docs link rendered on the right side. */
  actionLabel?: string;
  actionHref?: string;
  /** Forces a smaller variant suitable for sidebars. */
  dense?: boolean;
}

const formatNumber = (n: number) => n.toLocaleString();

export const UsageBar: React.FC<UsageBarProps> = ({
  label,
  usage,
  limit,
  unit,
  hint,
  actionLabel,
  actionHref,
  dense = false,
}) => {
  const safeLimit = Math.max(limit, 0);
  const pct = safeLimit > 0 ? (usage / safeLimit) * 100 : 0;
  const isOver = pct >= 100;
  const isWarn = pct >= 65 && !isOver;

  const accent = isOver
    ? 'hsl(var(--destructive))'
    : isWarn
      ? 'hsl(var(--severity-medium))'
      : 'hsl(var(--primary))';
  const accentBg = isOver
    ? 'hsl(var(--destructive) / 0.08)'
    : isWarn
      ? 'hsl(var(--severity-medium) / 0.08)'
      : 'hsla(var(--muted) / 0.3)';
  const accentBorder = isOver
    ? 'hsl(var(--destructive) / 0.25)'
    : isWarn
      ? 'hsl(var(--severity-medium) / 0.25)'
      : 'hsl(var(--border))';

  const tooltipText = safeLimit > 0
    ? `${pct.toFixed(0)}% used · ${formatNumber(usage)} / ${formatNumber(safeLimit)}${unit ? ' ' + unit : ''}`
    : `${formatNumber(usage)}${unit ? ' ' + unit : ''}`;

  return (
    <Tooltip title={tooltipText} placement="top" arrow>
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: accentBg,
          border: `1px solid ${accentBorder}`,
        }}
      >
        <Box sx={{ p: dense ? 1.25 : 1.5, pb: dense ? 1 : 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
            <Typography
              sx={{
                fontSize: dense ? '0.7rem' : '0.75rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              {label}
            </Typography>
            <Typography
              sx={{
                fontSize: dense ? '0.65rem' : '0.7rem',
                fontWeight: 500,
                color: accent,
                whiteSpace: 'nowrap',
              }}
            >
              {safeLimit > 0
                ? `${formatNumber(usage)} / ${formatNumber(safeLimit)}${unit ? ' ' + unit : ''}`
                : `${formatNumber(usage)}${unit ? ' ' + unit : ''}`}
            </Typography>
          </Box>
          {hint && (
            <Typography
              sx={{
                fontSize: '0.65rem',
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.4,
                mb: actionLabel ? 0.75 : 0,
              }}
            >
              {hint}
            </Typography>
          )}
          {actionLabel && actionHref && (
            <Box
              component="a"
              href={actionHref}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontSize: '0.65rem',
                fontWeight: 600,
                color: accent,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {actionLabel} →
            </Box>
          )}
        </Box>
        {/* Bottom progress bar */}
        <Box sx={{ width: '100%', height: 3, bgcolor: 'hsl(var(--muted) / 0.5)' }}>
          <Box
            sx={{
              width: `${Math.min(Math.max(pct, 0), 100)}%`,
              height: '100%',
              bgcolor: accent,
              transition: 'width 0.3s ease',
            }}
          />
        </Box>
      </Box>
    </Tooltip>
  );
};

export default UsageBar;
