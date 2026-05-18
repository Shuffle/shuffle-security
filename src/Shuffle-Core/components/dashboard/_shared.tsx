/**
 * Shared building blocks for dashboard surfaces (DashboardOverview,
 * AutomationDashboard). Keeps the visual language identical between them:
 * cyberpunk neon palette, KPI tiles with sparklines, Panel wrapper with
 * uppercase title, EmptyState CTA, and shared chart tooltip.
 */
import { Box, Typography, Skeleton } from '@mui/material';
import { motion } from 'framer-motion';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

// Cyberpunk neon palette shared across dashboards.
export const NEON = {
  magenta: '#FF2E9F',
  pink: '#EC517C',
  violet: '#9C5AF2',
  cyan: '#22E6FF',
  amber: '#FFB020',
  red: '#FF3B5C',
  green: '#3DF5A0',
  orange: '#FF6600', // brand
} as const;

// Shared recharts tooltip — glass card, monospace numbers.
export const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      bgcolor: 'hsl(var(--popover) / 0.85)',
      border: '1px solid hsl(var(--border))',
      borderRadius: 1.5,
      px: 1.25,
      py: 0.85,
      boxShadow: '0 8px 24px hsl(0 0% 0% / 0.4)',
      backdropFilter: 'blur(12px)',
    }}>
      {label != null && (
        <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 600, display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </Typography>
      )}
      {payload.map((entry: any) => (
        <Box key={entry.name ?? entry.dataKey} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.15 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: entry.color || entry.payload?.fill, flexShrink: 0 }} />
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>
            {entry.name}
          </Typography>
          <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.72rem', fontWeight: 700, ml: 'auto', fontFamily: 'ui-monospace, monospace' }}>
            {entry.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// ── KPI Tile ────────────────────────────────────────────────────────────────
export interface KpiTileProps {
  icon: LucideIcon;
  glow: string;
  value: number | string;
  label: string;
  delta?: { value: string; positive: boolean } | null;
  spark?: number[];
  isLoading?: boolean;
  onClick?: () => void;
  delay?: number;
}

export const KpiTile = ({ icon: Icon, glow, value, label, delta, spark, isLoading, onClick, delay = 0 }: KpiTileProps) => {
  const sparkData = (spark ?? []).map((v, i) => ({ i, v }));
  const sparkId = `spark-${label.replace(/\s/g, '')}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <Box
        onClick={onClick}
        sx={{
          position: 'relative',
          p: 2,
          borderRadius: 2,
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'border-color 0.2s, transform 0.2s',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          '&:hover': onClick ? {
            borderColor: 'hsl(var(--border) / 1)',
            transform: 'translateY(-1px)',
            '& .kpi-arrow': { opacity: 1, transform: 'translate(0,0)' },
          } : {},
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.25, position: 'relative' }}>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: 1.25,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: `${glow}1A`,
              border: `1px solid ${glow}33`,
            }}
          >
            <Icon size={16} style={{ color: glow }} />
          </Box>
          {onClick && (
            <ArrowUpRight
              size={14}
              className="kpi-arrow"
              style={{
                color: 'hsl(var(--muted-foreground))',
                opacity: 0,
                transform: 'translate(-4px, 4px)',
                transition: 'all 0.2s ease',
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, position: 'relative' }}>
          {isLoading ? (
            <Skeleton variant="text" width={70} height={32} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
          ) : (
            <Typography sx={{
              fontWeight: 600,
              fontSize: '1.6rem',
              lineHeight: 1,
              color: 'hsl(var(--foreground))',
              letterSpacing: '-0.02em',
            }}>
              {value}
            </Typography>
          )}
          {delta && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.25,
              px: 0.6, py: 0.15,
              borderRadius: 1,
              fontSize: '0.65rem',
              fontWeight: 600,
              color: delta.positive ? NEON.green : NEON.red,
              backgroundColor: delta.positive ? `${NEON.green}1A` : `${NEON.red}1A`,
            }}>
              {delta.positive ? '↓' : '↑'} {delta.value}
            </Box>
          )}
        </Box>
        <Typography sx={{
          fontSize: '0.72rem',
          color: 'hsl(var(--muted-foreground))',
          mt: 0.5,
          fontWeight: 500,
          position: 'relative',
        }}>
          {label}
        </Typography>

        {sparkData.length > 1 && !isLoading && (
          <Box sx={{ height: 28, mt: 'auto', pt: 1, mx: -0.5, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <defs>
                  <linearGradient id={sparkId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={glow} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={glow} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={glow}
                  strokeOpacity={0.7}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Box>
    </motion.div>
  );
};

// ── Panel wrapper ───────────────────────────────────────────────────────────
export const Panel = ({ title, action, children, delay = 0 }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  accent?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    style={{ height: '100%' }}
  >
    <Box sx={{
      position: 'relative',
      p: 2.5,
      borderRadius: 2,
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, position: 'relative', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'hsl(var(--foreground))',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {title}
        </Typography>
        {action}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {children}
      </Box>
    </Box>
  </motion.div>
);

export const EmptyState = ({ text, ctaLabel, onCta }: { text: string; ctaLabel?: string; onCta?: () => void }) => (
  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 120, gap: 1.25, textAlign: 'center', px: 2 }}>
    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.78rem' }}>{text}</Typography>
    {ctaLabel && onCta && (
      <Box
        component="button"
        onClick={onCta}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          height: 28,
          px: 1.5,
          borderRadius: 1,
          border: '1px solid hsl(var(--primary) / 0.4)',
          bgcolor: 'hsl(var(--primary) / 0.1)',
          color: 'hsl(var(--primary))',
          fontSize: '0.72rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          '&:hover': { bgcolor: 'hsl(var(--primary) / 0.18)', borderColor: 'hsl(var(--primary))' },
        }}
      >
        {ctaLabel}
        <ArrowUpRight size={12} />
      </Box>
    )}
  </Box>
);
