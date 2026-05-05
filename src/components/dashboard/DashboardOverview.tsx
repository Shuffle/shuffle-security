/**
 * Dashboard Overview — KPI cards + charts summarizing incidents,
 * host monitors, and vulnerabilities. Surfaced once the Setup Guide
 * is mostly complete so the dashboard becomes useful at a glance.
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  Monitor,
  Shield,
  Activity,
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

// ── Tokens ────────────────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, string> = {
  critical: 'hsl(var(--severity-critical, 0 75% 55%))',
  high: 'hsl(var(--severity-high))',
  medium: 'hsl(var(--severity-medium))',
  low: 'hsl(var(--severity-low))',
  info: 'hsl(var(--muted-foreground))',
};

const STATUS_COLORS = {
  New: '#60a5fa',
  'In Progress': '#f59e0b',
  Resolved: '#22c55e',
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  sublabel?: string;
  delay?: number;
  isLoading?: boolean;
  onClick?: () => void;
}

const KpiCard = ({ icon: Icon, iconColor, iconBg, value, label, sublabel, delay = 0, isLoading, onClick }: KpiCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, delay }}
  >
    <Box
      onClick={onClick}
      sx={{
        px: 2,
        py: 1.75,
        borderRadius: 2,
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        height: '100%',
        '&:hover': onClick ? {
          borderColor: 'hsl(var(--primary) / 0.4)',
          backgroundColor: 'hsl(var(--primary) / 0.04)',
        } : {},
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconBg,
            flexShrink: 0,
          }}
        >
          <Icon size={18} color={iconColor} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {isLoading ? (
            <Skeleton variant="text" width={48} height={28} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
          ) : (
            <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.1, color: 'hsl(var(--foreground))' }}>
              {value}
            </Typography>
          )}
          <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
            {label}
          </Typography>
        </Box>
      </Box>
      {sublabel && (
        <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', mt: 1, opacity: 0.8 }}>
          {sublabel}
        </Typography>
      )}
    </Box>
  </motion.div>
);

// ── Chart Card wrapper ────────────────────────────────────────────────────────

const ChartCard = ({ title, subtitle, children, delay = 0 }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
  >
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'hsl(var(--muted-foreground))',
        }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--foreground))', mt: 0.25, fontWeight: 500 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {children}
      </Box>
    </Box>
  </motion.div>
);

// ── Tooltip ──────────────────────────────────────────────────────────────────

const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      bgcolor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 1.5,
      px: 1.5,
      py: 1,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      {label != null && (
        <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, display: 'block', mb: 0.5 }}>
          {label}
        </Typography>
      )}
      {payload.map((entry: any) => (
        <Box key={entry.name ?? entry.dataKey} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.15 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color || entry.payload?.fill, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'hsl(var(--foreground))', fontSize: '0.72rem' }}>
            {entry.name}: <strong>{entry.value}</strong>
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────

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

  // ── Aggregations ───────────────────────────────────────────────────────────
  const incidentStats = useMemo(() => {
    const open = incidents.filter(i => i.status !== 'resolved' && i.status !== 'closed');
    const critical = incidents.filter(i =>
      (i.severity === 'critical' || i.severity === 'high') &&
      i.status !== 'resolved' && i.status !== 'closed'
    ).length;
    const last24h = incidents.filter(i => i.createdTs && Date.now() - i.createdTs < 86400_000).length;
    return { openCount: open.length, criticalCount: critical, last24h };
  }, [incidents]);

  // 30-day trend (stacked area)
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

  // Vulnerability severity bars
  const vulnTotal =
    vulnSeverityCounts.critical + vulnSeverityCounts.high + vulnSeverityCounts.medium +
    vulnSeverityCounts.low + vulnSeverityCounts.info;
  const vulnData = [
    { name: 'Critical', value: vulnSeverityCounts.critical, color: SEV_COLORS.critical },
    { name: 'High', value: vulnSeverityCounts.high, color: SEV_COLORS.high },
    { name: 'Medium', value: vulnSeverityCounts.medium, color: SEV_COLORS.medium },
    { name: 'Low', value: vulnSeverityCounts.low, color: SEV_COLORS.low },
    { name: 'Info', value: vulnSeverityCounts.info, color: SEV_COLORS.info },
  ];

  // Monitor pie (covered hosts vs running sensors as a simple split)
  const monitorPie = useMemo(() => {
    const hosts = monitorHostCount ?? 0;
    const sensors = runningSensorCount ?? 0;
    if (!hosts && !sensors) return [];
    return [
      { name: 'Host monitors', value: hosts, color: 'hsl(var(--primary))' },
      { name: 'Pipeline sensors', value: sensors, color: '#22c55e' },
    ].filter(d => d.value > 0);
  }, [monitorHostCount, runningSensorCount]);

  return (
    <Box sx={{ mb: 5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Activity size={18} style={{ color: 'hsl(var(--primary))' }} />
        <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
          Overview
        </Typography>
      </Box>

      {/* KPI row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 2,
        }}
      >
        <KpiCard
          icon={AlertTriangle}
          iconColor="hsl(var(--severity-high))"
          iconBg="hsl(var(--severity-high) / 0.12)"
          value={incidentStats.openCount}
          label="Open incidents"
          sublabel={`${incidentStats.last24h} new in last 24h`}
          delay={0}
          isLoading={incidentsLoading}
          onClick={() => navigate('/incidents')}
        />
        <KpiCard
          icon={AlertTriangle}
          iconColor={SEV_COLORS.critical}
          iconBg="hsl(0 75% 55% / 0.12)"
          value={incidentStats.criticalCount}
          label="Critical / High"
          delay={0.05}
          isLoading={incidentsLoading}
          onClick={() => navigate('/incidents')}
        />
        <KpiCard
          icon={Monitor}
          iconColor="hsl(var(--primary))"
          iconBg="hsl(var(--primary) / 0.12)"
          value={monitorHostCount ?? 0}
          label="Host monitors"
          sublabel={runningSensorCount ? `${runningSensorCount} running sensor${runningSensorCount === 1 ? '' : 's'}` : undefined}
          delay={0.1}
          isLoading={monitorsLoading}
          onClick={() => navigate('/monitors')}
        />
        <KpiCard
          icon={Shield}
          iconColor={SEV_COLORS.medium}
          iconBg="hsl(var(--severity-medium) / 0.12)"
          value={vulnTotal}
          label="Open vulnerabilities"
          sublabel={vulnSeverityCounts.critical + vulnSeverityCounts.high > 0
            ? `${vulnSeverityCounts.critical + vulnSeverityCounts.high} critical/high`
            : undefined}
          delay={0.15}
          isLoading={vulnLoading}
          onClick={() => navigate('/vulnerabilities')}
        />
      </Box>

      {/* Charts row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <ChartCard title="Incident activity — last 30 days" delay={0.2}>
          <Box sx={{ height: 200 }}>
            {incidentsLoading ? (
              <Skeleton variant="rounded" height={200} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ) : trendHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    {Object.entries(STATUS_COLORS).map(([k, c]) => (
                      <linearGradient key={k} id={`ov-grad-${k.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip content={<TooltipContent />} />
                  {Object.entries(STATUS_COLORS).map(([k, c]) => (
                    <Area
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stackId="1"
                      stroke={c}
                      strokeWidth={2}
                      fill={`url(#ov-grad-${k.replace(/\s/g, '')})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No incident activity yet" />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1, justifyContent: 'flex-end' }}>
            {Object.entries(STATUS_COLORS).map(([label, color]) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </ChartCard>

        <ChartCard title="Monitor coverage" delay={0.25}>
          <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {monitorsLoading ? (
              <Skeleton variant="circular" width={140} height={140} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ) : monitorPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={monitorPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {monitorPie.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<TooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No monitors yet" />
            )}
          </Box>
          {monitorPie.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              {monitorPie.map(d => (
                <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                  <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>
                    {d.name} ({d.value})
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </ChartCard>
      </Box>

      {/* Vulnerabilities by severity */}
      <ChartCard title="Vulnerabilities by severity" delay={0.3}>
        <Box sx={{ height: 180 }}>
          {vulnLoading ? (
            <Skeleton variant="rounded" height={180} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
          ) : vulnTotal > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vulnData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip content={<TooltipContent />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
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
      </ChartCard>
    </Box>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>{text}</Typography>
  </Box>
);

export default DashboardOverview;
