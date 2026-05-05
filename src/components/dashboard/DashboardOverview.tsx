/**
 * Dashboard Overview — modern KPI tiles with inline sparklines, a hero
 * incident-activity chart, severity breakdown, and monitor coverage radial.
 * Inspired by Vicarius / Linear / Vercel style: dense, gradient accents,
 * bold numbers, minimal chrome.
 */
import { useMemo } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  AlertTriangle,
  Monitor,
  ShieldAlert,
  Flame,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface OverviewIncident {
  status: string;
  severity: string;
  createdTs: number;
}

interface OverviewProps {
  incidents: OverviewIncident[];
  incidentsLoading?: boolean;
  vulnSeverityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  vulnLoading?: boolean;
  monitorHostCount: number | null;
  runningSensorCount: number | null;
  monitorsLoading?: boolean;
}

const SEV = {
  critical: 'hsl(var(--severity-critical))',
  high: 'hsl(var(--severity-high))',
  medium: 'hsl(var(--severity-medium))',
  low: 'hsl(var(--severity-low))',
  info: 'hsl(var(--severity-info))',
};

const STATUS_COLORS = {
  New: 'hsl(var(--severity-info))',
  'In Progress': 'hsl(var(--primary))',
  Resolved: 'hsl(var(--severity-low))',
};

// ── Tooltip ─────────────────────────────────────────────────────────────────
const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      bgcolor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 1.5,
      px: 1.25,
      py: 0.85,
      boxShadow: '0 8px 24px hsl(0 0% 0% / 0.4)',
      backdropFilter: 'blur(8px)',
    }}>
      {label != null && (
        <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 600, display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </Typography>
      )}
      {payload.map((entry: any) => (
        <Box key={entry.name ?? entry.dataKey} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.15 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: entry.color || entry.payload?.fill, flexShrink: 0 }} />
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>
            {entry.name}
          </Typography>
          <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.72rem', fontWeight: 700, ml: 'auto' }}>
            {entry.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// ── KPI Tile with sparkline ─────────────────────────────────────────────────
interface KpiTileProps {
  icon: LucideIcon;
  accent: string;
  value: number | string;
  label: string;
  delta?: { value: string; positive: boolean } | null;
  spark?: number[];
  isLoading?: boolean;
  onClick?: () => void;
  delay?: number;
}

const KpiTile = ({ icon: Icon, accent, value, label, delta, spark, isLoading, onClick, delay = 0 }: KpiTileProps) => {
  const sparkData = (spark ?? []).map((v, i) => ({ i, v }));
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Box
        onClick={onClick}
        sx={{
          position: 'relative',
          p: 2.25,
          borderRadius: 2.5,
          background: `linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.6) 100%)`,
          border: '1px solid hsl(var(--border))',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.25s ease',
          overflow: 'hidden',
          height: '100%',
          minHeight: 132,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 100% 0%, ${accent} 0%, transparent 55%)`,
            opacity: 0.08,
            pointerEvents: 'none',
          },
          '&:hover': onClick ? {
            borderColor: accent,
            transform: 'translateY(-1px)',
            '&::before': { opacity: 0.16 },
            '& .kpi-arrow': { opacity: 1, transform: 'translate(0,0)' },
          } : {},
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5, position: 'relative' }}>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: `${accent.replace('))', ') / 0.12)')}`,
              border: `1px solid ${accent.replace('))', ') / 0.25)')}`,
            }}
          >
            <Icon size={16} style={{ color: accent }} />
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

        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, position: 'relative' }}>
          {isLoading ? (
            <Skeleton variant="text" width={60} height={36} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
          ) : (
            <Typography sx={{
              fontWeight: 700,
              fontSize: '1.85rem',
              lineHeight: 1,
              color: 'hsl(var(--foreground))',
              fontFeatureSettings: '"tnum"',
              letterSpacing: '-0.02em',
            }}>
              {value}
            </Typography>
          )}
          {delta && (
            <Typography sx={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: delta.positive ? 'hsl(var(--severity-low))' : 'hsl(var(--severity-high))',
              mb: 0.4,
            }}>
              {delta.positive ? '↑' : '↓'} {delta.value}
            </Typography>
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
          <Box sx={{ height: 28, mt: 1, mx: -0.5 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={accent}
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
const Panel = ({ title, action, children, delay = 0, sx }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  sx?: any;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    style={{ height: '100%' }}
  >
    <Box sx={{
      p: 2.5,
      borderRadius: 2.5,
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      ...sx,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'hsl(var(--foreground))',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </Typography>
        {action}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Box>
  </motion.div>
);

const EmptyState = ({ text }: { text: string }) => (
  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.78rem' }}>{text}</Typography>
  </Box>
);

// ── Main ────────────────────────────────────────────────────────────────────
export const DashboardOverview = ({
  incidents,
  incidentsLoading,
  vulnSeverityCounts,
  vulnLoading,
  monitorHostCount,
  runningSensorCount,
  monitorsLoading,
}: OverviewProps) => {
  const navigate = useNavigate();

  const incidentStats = useMemo(() => {
    const open = incidents.filter(i => i.status !== 'resolved' && i.status !== 'closed');
    const critical = incidents.filter(i =>
      (i.severity === 'critical' || i.severity === 'high') &&
      i.status !== 'resolved' && i.status !== 'closed'
    ).length;
    const last24h = incidents.filter(i => i.createdTs && Date.now() - i.createdTs < 86400_000).length;
    const prev24h = incidents.filter(i => i.createdTs && Date.now() - i.createdTs >= 86400_000 && Date.now() - i.createdTs < 172800_000).length;
    let delta: { value: string; positive: boolean } | null = null;
    if (prev24h > 0) {
      const pct = Math.round(((last24h - prev24h) / prev24h) * 100);
      if (pct !== 0) delta = { value: `${Math.abs(pct)}%`, positive: pct < 0 };
    }
    return { openCount: open.length, criticalCount: critical, last24h, delta };
  }, [incidents]);

  // 14-day sparkline of new incidents
  const incidentSpark = useMemo(() => {
    const days = 14;
    const arr = new Array(days).fill(0);
    const today = startOfDay(new Date()).getTime();
    for (const inc of incidents) {
      if (!inc.createdTs) continue;
      const day = startOfDay(new Date(inc.createdTs)).getTime();
      const diff = Math.round((today - day) / 86400_000);
      if (diff >= 0 && diff < days) arr[days - 1 - diff]++;
    }
    return arr;
  }, [incidents]);

  // 30-day stacked area
  const trendData = useMemo(() => {
    const buckets: { date: string; ms: number; New: number; 'In Progress': number; Resolved: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(today, i));
      buckets.push({ date: format(d, 'MMM d'), ms: d.getTime(), New: 0, 'In Progress': 0, Resolved: 0 });
    }
    for (const inc of incidents) {
      if (!inc.createdTs) continue;
      const dayMs = startOfDay(new Date(inc.createdTs)).getTime();
      const b = buckets.find(x => x.ms === dayMs);
      if (!b) continue;
      const s = (inc.status || '').toLowerCase().replace(/[_\s]+/g, '');
      if (s === 'resolved' || s === 'closed') b.Resolved++;
      else if (s === 'inprogress') b['In Progress']++;
      else b.New++;
    }
    return buckets;
  }, [incidents]);

  const trendHasData = trendData.some(d => d.New || d['In Progress'] || d.Resolved);

  // Vulnerability data
  const vulnTotal =
    vulnSeverityCounts.critical + vulnSeverityCounts.high + vulnSeverityCounts.medium +
    vulnSeverityCounts.low + vulnSeverityCounts.info;
  const vulnData = [
    { name: 'Critical', value: vulnSeverityCounts.critical, color: SEV.critical },
    { name: 'High', value: vulnSeverityCounts.high, color: SEV.high },
    { name: 'Medium', value: vulnSeverityCounts.medium, color: SEV.medium },
    { name: 'Low', value: vulnSeverityCounts.low, color: SEV.low },
    { name: 'Info', value: vulnSeverityCounts.info, color: SEV.info },
  ];
  const vulnCriticalPct = vulnTotal > 0
    ? Math.round(((vulnSeverityCounts.critical + vulnSeverityCounts.high) / vulnTotal) * 100)
    : 0;

  // Monitor radial: hosts vs sensors as % of combined target
  const monitorTotal = (monitorHostCount ?? 0) + (runningSensorCount ?? 0);
  const radialData = [
    { name: 'Sensors', value: runningSensorCount ?? 0, fill: 'hsl(var(--severity-low))' },
    { name: 'Hosts', value: monitorHostCount ?? 0, fill: 'hsl(var(--primary))' },
  ];

  return (
    <Box sx={{ mb: 5 }}>
      {/* KPI tiles */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <KpiTile
          icon={Flame}
          accent={SEV.high}
          value={incidentStats.openCount}
          label="Open incidents"
          delta={incidentStats.delta}
          spark={incidentSpark}
          isLoading={incidentsLoading}
          onClick={() => navigate('/incidents')}
          delay={0}
        />
        <KpiTile
          icon={AlertTriangle}
          accent={SEV.critical}
          value={incidentStats.criticalCount}
          label="Critical & high priority"
          isLoading={incidentsLoading}
          onClick={() => navigate('/incidents?severity=critical')}
          delay={0.05}
        />
        <KpiTile
          icon={Monitor}
          accent="hsl(var(--primary))"
          value={monitorHostCount ?? 0}
          label={runningSensorCount ? `Hosts • ${runningSensorCount} sensors` : 'Host monitors'}
          isLoading={monitorsLoading}
          onClick={() => navigate('/monitors')}
          delay={0.1}
        />
        <KpiTile
          icon={ShieldAlert}
          accent={SEV.medium}
          value={vulnTotal}
          label={vulnCriticalPct ? `Vulnerabilities • ${vulnCriticalPct}% critical/high` : 'Vulnerabilities'}
          isLoading={vulnLoading}
          onClick={() => navigate('/vulnerabilities')}
          delay={0.15}
        />
      </Box>

      {/* Hero chart + monitor radial */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Panel
          title="Incident activity"
          delay={0.2}
          action={
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {Object.entries(STATUS_COLORS).map(([label, color]) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                  <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>{label}</Typography>
                </Box>
              ))}
            </Box>
          }
        >
          <Box sx={{ height: 240 }}>
            {incidentsLoading ? (
              <Skeleton variant="rounded" height={240} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ) : trendHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    {Object.entries(STATUS_COLORS).map(([k, c]) => (
                      <linearGradient key={k} id={`ov-grad-${k.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                  <RechartsTooltip content={<TooltipContent />} />
                  {Object.entries(STATUS_COLORS).map(([k, c]) => (
                    <Area
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stackId="1"
                      stroke={c}
                      strokeWidth={1.75}
                      fill={`url(#ov-grad-${k.replace(/\s/g, '')})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No incident activity in the last 30 days" />
            )}
          </Box>
        </Panel>

        <Panel title="Monitor coverage" delay={0.25}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 240 }}>
            {monitorsLoading ? (
              <Skeleton variant="circular" width={160} height={160} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ) : monitorTotal > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <RadialBarChart
                    innerRadius="60%"
                    outerRadius="100%"
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                    barSize={12}
                  >
                    <PolarAngleAxis type="number" domain={[0, Math.max(monitorTotal, 1)]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'hsl(var(--muted) / 0.2)' }} />
                    <RechartsTooltip content={<TooltipContent />} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <Box sx={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}>
                  <Typography sx={{ fontSize: '1.85rem', fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {monitorTotal}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Total
                  </Typography>
                </Box>
              </>
            ) : (
              <EmptyState text="No monitors deployed yet" />
            )}
          </Box>
          {monitorTotal > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-around', pt: 1.5, borderTop: '1px solid hsl(var(--border))' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'hsl(var(--primary))' }} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{monitorHostCount ?? 0}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>Hosts</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'hsl(var(--severity-low))' }} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{runningSensorCount ?? 0}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>Sensors</Typography>
              </Box>
            </Box>
          )}
        </Panel>
      </Box>

      {/* Vulnerability severity */}
      <Panel
        title="Vulnerabilities by severity"
        delay={0.3}
        action={
          <Typography
            onClick={() => navigate('/vulnerabilities')}
            sx={{ fontSize: '0.7rem', color: 'hsl(var(--primary))', cursor: 'pointer', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
          >
            View all →
          </Typography>
        }
      >
        <Box sx={{ height: 180 }}>
          {vulnLoading ? (
            <Skeleton variant="rounded" height={180} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
          ) : vulnTotal > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vulnData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <RechartsTooltip content={<TooltipContent />} cursor={{ fill: 'hsl(var(--muted) / 0.2)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {vulnData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No vulnerabilities ingested yet" />
          )}
        </Box>
      </Panel>
    </Box>
  );
};

export default DashboardOverview;
