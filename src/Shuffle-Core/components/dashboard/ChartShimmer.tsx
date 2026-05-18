/**
 * ChartShimmer — clearly-visible loading placeholder for chart panels.
 *
 * Replaces flat MUI <Skeleton> blocks (which were nearly invisible because
 * the explicit bgcolor override killed the wave animation). Renders a tiny
 * fake chart silhouette (area / bars / radial) plus an animated shimmer
 * sweep and a small "Loading…" label so users know data is on its way
 * without a giant circular spinner.
 */
import { Box, Typography } from '@mui/material';
import { Loader2 } from 'lucide-react';

type ChartShimmerVariant = 'area' | 'bars' | 'radial';

export interface ChartShimmerProps {
  height: number;
  variant: ChartShimmerVariant;
  label?: string;
}

const SHIMMER_KEYFRAMES = {
  '@keyframes shuffle-shimmer-sweep': {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(100%)' },
  },
  '@keyframes shuffle-shimmer-pulse': {
    '0%, 100%': { opacity: 0.45 },
    '50%': { opacity: 0.85 },
  },
};

const Silhouette = ({ variant }: { variant: ChartShimmerVariant }) => {
  const stroke = 'hsl(var(--muted-foreground) / 0.35)';
  const fill = 'hsl(var(--muted-foreground) / 0.12)';

  if (variant === 'bars') {
    const bars = [40, 70, 55, 85, 30, 60];
    return (
      <svg width="100%" height="100%" viewBox="0 0 240 100" preserveAspectRatio="none" aria-hidden>
        {bars.map((h, i) => (
          <rect
            key={i}
            x={i * 38 + 8}
            y={100 - h}
            width={28}
            height={h}
            rx={4}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
        ))}
      </svg>
    );
  }

  if (variant === 'radial') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 120 120" aria-hidden>
        <circle cx={60} cy={60} r={48} fill="none" stroke={fill} strokeWidth={14} />
        <circle
          cx={60}
          cy={60}
          r={48}
          fill="none"
          stroke={stroke}
          strokeWidth={14}
          strokeDasharray="120 300"
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </svg>
    );
  }

  // area
  return (
    <svg width="100%" height="100%" viewBox="0 0 240 100" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0,80 C30,60 50,70 80,50 C110,30 140,55 170,40 C200,28 220,45 240,35 L240,100 L0,100 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
    </svg>
  );
};

export const ChartShimmer = ({ height, variant, label = 'Loading' }: ChartShimmerProps) => {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: 'hsl(var(--muted) / 0.18)',
        border: '1px solid hsl(var(--border) / 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...SHIMMER_KEYFRAMES,
      }}
    >
      {/* Silhouette */}
      <Box
        sx={{
          position: 'absolute',
          inset: variant === 'radial' ? 0 : '12px 12px 12px 12px',
          display: 'flex',
          alignItems: variant === 'bars' ? 'flex-end' : 'center',
          justifyContent: 'center',
          animation: 'shuffle-shimmer-pulse 1.8s ease-in-out infinite',
        }}
      >
        <Silhouette variant={variant} />
      </Box>

      {/* Sweeping shimmer */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, transparent 0%, hsl(var(--foreground) / 0.06) 50%, transparent 100%)',
          animation: 'shuffle-shimmer-sweep 1.6s linear infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Label */}
      <Box
        sx={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: 999,
          bgcolor: 'hsl(var(--background) / 0.7)',
          backdropFilter: 'blur(4px)',
          border: '1px solid hsl(var(--border))',
        }}
      >
        <Loader2
          size={12}
          style={{
            color: 'hsl(var(--muted-foreground))',
            animation: 'shuffle-shimmer-spin 1s linear infinite',
          }}
        />
        <Typography
          sx={{
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </Typography>
        <Box
          component="style"
          dangerouslySetInnerHTML={{
            __html:
              '@keyframes shuffle-shimmer-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
          }}
        />
      </Box>
    </Box>
  );
};

export default ChartShimmer;
