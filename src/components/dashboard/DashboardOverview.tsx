/**
 * Dashboard Overview — cyberpunk-inspired analytics: neon gradients,
 * glow effects, vivid bar/area gradients. Reference: Vicarius / cyberpunk
 * dashboards with magenta→violet→cyan palette over dark surfaces.
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
  MonitorCheck,
  Bug,
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

// ── Cyberpunk neon palette ──────────────────────────────────────────────────
const NEON = {
  magenta: '#FF2E9F',
  pink: '#EC517C',
  violet: '#9C5AF2',
  cyan: '#22E6FF',
  amber: '#FFB020',
  red: '#FF3B5C',
  green: '#3DF5A0',
  orange: '#FF6600', // brand
};

const STATUS_COLORS = {
  New: NEON.cyan,
  'In Progress': NEON.orange,
  Resolved: NEON.green,
};

// ── Tooltip ─────────────────────────────────────────────────────────────────
const TooltipContent = ({ active, payload, label }: any) => {
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
interface KpiTileProps {
  icon: LucideIcon;
  glow: string;
  gradient: string;
  value: number | string;
  label: string;
  delta?: { value: string; positive: boolean } | null;
  spark?: number[];
  isLoading?: boolean;
  onClick?: () => void;
  delay?: number;
}

const KpiTile = ({ icon: Icon, glow, value, label, delta, spark, isLoading, onClick, delay = 0 }: KpiTileProps) => {
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
const Panel = ({ title, action, children, delay = 0, accent }: {
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, position: 'relative' }}>
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

  const vulnTotal =
    vulnSeverityCounts.critical + vulnSeverityCounts.high + vulnSeverityCounts.medium +
    vulnSeverityCounts.low + vulnSeverityCounts.info;
  const vulnData = [
    { name: 'Critical', value: vulnSeverityCounts.critical, color: NEON.red, gradId: 'vuln-crit' },
    { name: 'High', value: vulnSeverityCounts.high, color: NEON.magenta, gradId: 'vuln-high' },
    { name: 'Medium', value: vulnSeverityCounts.medium, color: NEON.violet, gradId: 'vuln-med' },
    { name: 'Low', value: vulnSeverityCounts.low, color: NEON.cyan, gradId: 'vuln-low' },
    { name: 'Info', value: vulnSeverityCounts.info, color: NEON.green, gradId: 'vuln-info' },
  ];
  const vulnCriticalPct = vulnTotal > 0
    ? Math.round(((vulnSeverityCounts.critical + vulnSeverityCounts.high) / vulnTotal) * 100)
    : 0;

  const monitorTotal = (monitorHostCount ?? 0) + (runningSensorCount ?? 0);
  const radialData = [
    { name: 'Sensors', value: runningSensorCount ?? 0, fill: NEON.cyan },
    { name: 'Hosts', value: monitorHostCount ?? 0, fill: NEON.violet },
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
          icon={AlertTriangle}
          glow={NEON.magenta}
          gradient={''}
          value={incidentStats.openCount}
          label="Open Incidents"
          delta={incidentStats.delta}
          isLoading={incidentsLoading}
          onClick={() => navigate('/incidents')}
          delay={0}
        />
        <KpiTile
          icon={Flame}
          glow={NEON.red}
          gradient={''}
          value={incidentStats.criticalCount}
          label="Critical / High"
          isLoading={incidentsLoading}
          onClick={() => navigate('/incidents?severity=critical,high')}
          delay={0.05}
        />
        <KpiTile
          icon={MonitorCheck}
          glow={NEON.cyan}
          gradient={''}
          value={monitorHostCount ?? 0}
          label={runningSensorCount ? `Hosts • ${runningSensorCount} sensors` : 'Host Monitors'}
          isLoading={monitorsLoading}
          onClick={() => navigate('/monitors')}
          delay={0.1}
        />
        <KpiTile
          icon={Bug}
          glow={NEON.violet}
          gradient={''}
          value={vulnTotal}
          label={vulnCriticalPct ? `Vulnerabilities • ${vulnCriticalPct}% crit/high` : 'Vulnerabilities'}
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
          title="Incident Activity"
          accent={NEON.magenta}
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
          <Box sx={{ height: 260 }}>
            {incidentsLoading ? (
              <Skeleton variant="rounded" height={260} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ) : trendHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    {Object.entries(STATUS_COLORS).map(([k, c]) => (
                      <linearGradient key={k} id={`ov-grad-${k.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                  <RechartsTooltip content={<TooltipContent />} cursor={{ stroke: NEON.violet, strokeOpacity: 0.3, strokeWidth: 1 }} />
                  {Object.entries(STATUS_COLORS).map(([k, c]) => (
                    <Area
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={c}
                      strokeWidth={2}
                      fill={`url(#ov-grad-${k.replace(/\s/g, '')})`}
                      fillOpacity={0.6}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No incident activity in the last 30 days" />
            )}
          </Box>
        </Panel>

        <Panel title="Detection Coverage" accent={NEON.cyan} delay={0.25}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 240 }}>
            {monitorsLoading ? (
              <Skeleton variant="circular" width={160} height={160} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ) : monitorTotal > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <RadialBarChart
                    innerRadius="62%"
                    outerRadius="100%"
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                    barSize={14}
                  >
                    <defs>
                      <linearGradient id="radial-host" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={NEON.violet} />
                        <stop offset="100%" stopColor={NEON.magenta} />
                      </linearGradient>
                      <linearGradient id="radial-sensor" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={NEON.cyan} />
                        <stop offset="100%" stopColor={NEON.green} />
                      </linearGradient>
                    </defs>
                    <PolarAngleAxis type="number" domain={[0, Math.max(monitorTotal, 1)]} tick={false} />
                    <RadialBar
                      dataKey="value"
                      cornerRadius={8}
                      background={{ fill: 'hsl(var(--muted) / 0.15)' }}
                    >
                      {radialData.map((d, i) => (
                        <Cell key={d.name} fill={i === 0 ? 'url(#radial-sensor)' : 'url(#radial-host)'} />
                      ))}
                    </RadialBar>
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
                  <Typography sx={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'hsl(var(--foreground))',
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                    fontFamily: 'ui-monospace, monospace',
                    
                  }}>
                    {monitorTotal}
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: 'hsl(var(--muted-foreground))', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
                    Total
                  </Typography>
                </Box>
              </>
            ) : (
              <EmptyState text="No host monitors or pipeline sensors deployed yet" />
            )}
          </Box>
          {monitorTotal > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-around', pt: 1.5, borderTop: '1px solid hsl(var(--border))' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: NEON.violet }} />
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--foreground))', fontFamily: 'ui-monospace, monospace' }}>{monitorHostCount ?? 0}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.62rem', color: 'hsl(var(--muted-foreground))', mt: 0.25, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Host Monitors</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: NEON.cyan }} />
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--foreground))', fontFamily: 'ui-monospace, monospace' }}>{runningSensorCount ?? 0}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.62rem', color: 'hsl(var(--muted-foreground))', mt: 0.25, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sensors</Typography>
              </Box>
            </Box>
          )}
        </Panel>
      </Box>

      {/* Vulnerability severity */}
      <Panel
        title="Vulnerabilities by Severity"
        accent={NEON.violet}
        delay={0.3}
        action={
          <Typography
            onClick={() => navigate('/vulnerabilities')}
            sx={{ fontSize: '0.7rem', color: NEON.cyan, cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            View all →
          </Typography>
        }
      >
        <Box sx={{ height: 200 }}>
          {vulnLoading ? (
            <Skeleton variant="rounded" height={200} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
          ) : vulnTotal > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vulnData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  {vulnData.map((d) => (
                    <linearGradient key={d.gradId} id={d.gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={d.color} stopOpacity={0.25} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <RechartsTooltip content={<TooltipContent />} cursor={{ fill: 'hsl(var(--muted) / 0.15)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {vulnData.map((d) => (
                    <Cell key={d.name} fill={`url(#${d.gradId})`} />
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
