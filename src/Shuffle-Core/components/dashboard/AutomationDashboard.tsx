/**
 * AutomationDashboard — Shuffle Automation analytics view.
 *
 * Fetches GET /api/v1/orgs/{orgId}/stats and renders:
 *   - Total errors / Errors resolved stat cards
 *   - Successful vs Failed Runs (Workflows) area chart
 *   - Workflow Success Rate radial gauges
 *   - Workflows per-month bar chart
 *
 * Standalone port (no host AuthContext / shadcn). Pass `orgId` + optional
 * `displayName`. API helpers come from `../../api` (Shuffle-Core).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box, Typography, Skeleton, IconButton, Tooltip as MuiTooltip,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, BarChart, Bar, RadialBarChart, RadialBar,
  PolarAngleAxis, Cell,
} from 'recharts';
import { AlertCircle, RefreshCw, Zap, Workflow, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SegmentedControl } from '../ui/segmented-control';
import { getApiUrl, getAuthHeader } from '../../api';
import { NEON, TooltipContent, KpiTile, Panel, EmptyState } from './_shared';

import type { ShuffleCoreHostProps } from '../../types/host-props';

export interface AutomationDashboardProps extends ShuffleCoreHostProps {
  /** Organization id to fetch stats for. Falls back to `userdata.active_org.id`. */
  orgId?: string | null;
  /** Optional display name used in the greeting. Falls back to `userdata.username`. */
  displayName?: string;
  /** Optional content rendered on the left of the header row (e.g. dashboard tabs). */
  headerLeft?: React.ReactNode;
}

interface Addition { key: string; value: number }
interface DailyStat {
  date: string;
  app_executions?: number;
  app_executions_failed?: number;
  workflow_executions?: number;
  workflow_executions_finished?: number;
  workflow_executions_failed?: number;
  additions?: Addition[] | null;
  [k: string]: any;
}
interface StatsResponse {
  org_id?: string;
  org_name?: string;
  daily_statistics?: DailyStat[];
  additions?: Addition[] | null;
  [k: string]: any;
}

type ModeKind = 'workflows' | 'apps';
type GranKind = 'daily' | 'monthly';

const RANGE_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export const AutomationDashboard = ({
  orgId: orgIdProp,
  displayName,
  serverside,
  isLoaded = true,
  isLoggedIn = true,
  globalUrl,
  userdata,
  headerLeft,
}: AutomationDashboardProps) => {
  const orgId = orgIdProp ?? userdata?.active_org?.id ?? null;
  const _name = (displayName || userdata?.username || '').split('@')[0] || 'there';
  const navigate = useNavigate();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedStat, setSelectedStat] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState<string>('30');
  const [mode, setMode] = useState<ModeKind>('workflows');
  const [gran, setGran] = useState<GranKind>('daily');

  const buildUrl = (path: string) =>
    globalUrl ? `${globalUrl.replace(/\/$/, '')}${path}` : getApiUrl(path);

  const load = async (silent = false) => {
    if (serverside || !isLoaded || !isLoggedIn || !orgId) { setLoading(false); return; }
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [statsRes, notifRes] = await Promise.all([
        fetch(buildUrl(`/api/v1/orgs/${orgId}/stats`), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
        fetch(buildUrl(`/api/v1/notifications`), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (notifRes.ok) {
        const nd = await notifRes.json();
        setNotifications(Array.isArray(nd) ? nd : (nd.notifications || []));
      }
    } catch { /* noop */ } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId, isLoaded, isLoggedIn, globalUrl]);

  const daily = stats?.daily_statistics || [];
  const rangeDays = parseInt(days, 10);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - rangeDays * 86400_000;
    return daily
      .filter(d => new Date(d.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [daily, rangeDays]);

  const isApps = mode === 'apps';
  const successKey = isApps ? 'app_executions' : 'workflow_executions_finished';
  const failedKey = isApps ? 'app_executions_failed' : 'workflow_executions_failed';

  const chartData = useMemo(() => filtered.map(d => ({
    date: d.date.slice(5, 10),
    success: (d as any)[successKey] || 0,
    failed: (d as any)[failedKey] || 0,
  })), [filtered, successKey, failedKey]);

  const totalSuccess = chartData.reduce((s, d) => s + d.success, 0);
  const totalFailed = chartData.reduce((s, d) => s + d.failed, 0);
  const total = totalSuccess + totalFailed;
  const successRate = total > 0 ? Math.round((totalSuccess / total) * 100) : 0;
  const failRate = total > 0 ? 100 - successRate : 0;

  // Count of notifications whose created_at falls within the selected range.
  // `created_at` may arrive as seconds or milliseconds — normalise to ms.
  const notificationCount = useMemo(() => {
    const cutoff = Date.now() - rangeDays * 86400_000;
    return notifications.filter((n: any) => {
      const raw = Number(n?.created_at) || 0;
      if (!raw) return false;
      const ms = raw < 1e12 ? raw * 1000 : raw;
      return ms >= cutoff;
    }).length;
  }, [notifications, rangeDays]);

  /**
   * Custom stat keys come from two places in /api/v1/orgs/{orgId}/stats:
   *   1. Top-level `total_*` keys (map to the matching field in daily entries)
   *   2. `additions[].key` across the org-level + daily-level additions arrays
   */
  const statKeys = useMemo(() => {
    if (!stats) return [] as string[];
    const totals = Object.keys(stats).filter(k => k.startsWith('total_'));
    const additionKeys = new Set<string>();
    (stats.additions || []).forEach(a => a?.key && additionKeys.add(a.key));
    (stats.daily_statistics || []).forEach(d =>
      (d.additions || []).forEach(a => a?.key && additionKeys.add(a.key))
    );
    return Array.from(new Set([...totals, ...Array.from(additionKeys)])).sort();
  }, [stats]);

  useEffect(() => {
    if (!selectedStat && statKeys.length) setSelectedStat(statKeys[0]);
  }, [statKeys, selectedStat]);

  const statSeries = useMemo(() => {
    if (!selectedStat) return [] as Array<{ date: string; value: number }>;
    const fromTotal = selectedStat.startsWith('total_') ? selectedStat.slice(6) : null;
    return filtered.map(d => {
      let value = 0;
      if (fromTotal && d[fromTotal] != null) value = Number(d[fromTotal]) || 0;
      else {
        const hit = (d.additions || []).find(a => a?.key === selectedStat);
        value = hit ? Number(hit.value) || 0 : 0;
      }
      return { date: d.date.slice(5, 10), value };
    });
  }, [filtered, selectedStat]);


  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
        {[140, 320, 240].map((h, i) => (
          <Skeleton key={i} variant="rounded" height={h} sx={{ borderRadius: 2, bgcolor: 'hsl(var(--muted) / 0.3)' }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
      {/* Header row — caller-supplied left content (e.g. dashboard tabs) + filters */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 36 }}>
          {headerLeft}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Last</InputLabel>
            <Select label="Last" value={days} onChange={(e) => setDays(String(e.target.value))}>
              {RANGE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ alignSelf: 'flex-end' }}>
            <SegmentedControl
              ariaLabel="Mode"
              value={mode}
              onChange={(v) => setMode(v as ModeKind)}
              options={[{ value: 'workflows', label: 'Workflows' }, { value: 'apps', label: 'Apps' }]}
            />
          </Box>
          <Box sx={{ alignSelf: 'flex-end' }}>
            <SegmentedControl
              ariaLabel="Granularity"
              value={gran}
              onChange={(v) => setGran(v as GranKind)}
              options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }]}
            />
          </Box>
          <MuiTooltip title="Refresh">
            <IconButton size="small" onClick={() => load(true)} sx={{ color: 'hsl(var(--muted-foreground))', alignSelf: 'flex-end' }}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {/* KPI tiles */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        <KpiTile
          icon={AlertCircle}
          glow={NEON.magenta}
          value={notificationCount}
          label="Notifications"
          isLoading={loading}
          delay={0}
        />
        <KpiTile
          icon={Workflow}
          glow={NEON.green}
          value={totalSuccess}
          label={`Successful ${isApps ? 'App' : 'Workflow'} Runs`}
          spark={chartData.map(d => d.success)}
          isLoading={loading}
          delay={0.05}
        />
        <KpiTile
          icon={Zap}
          glow={NEON.red}
          value={totalFailed}
          label={`Failed ${isApps ? 'App' : 'Workflow'} Runs`}
          spark={chartData.map(d => d.failed)}
          isLoading={loading}
          delay={0.1}
        />
        <KpiTile
          icon={Activity}
          glow={NEON.cyan}
          value={`${successRate}%`}
          label="Success rate"
          isLoading={loading}
          delay={0.15}
        />
      </Box>

      {/* Hero chart + success rate gauges */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 1.5 }}>
        <Panel
          title={`${isApps ? 'App' : 'Workflow'} Activity`}
          accent={NEON.green}
          delay={0.2}
          action={
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {([['Successful', NEON.green], ['Failed', NEON.red]] as const).map(([label, color]) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                  <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>{label}</Typography>
                </Box>
              ))}
            </Box>
          }
        >
          <Box sx={{ height: 260 }}>
            {loading ? (
              <Skeleton variant="rounded" height={260} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
            ) : (totalSuccess + totalFailed) <= 2 ? (
              <EmptyState
                text={`Not enough ${isApps ? 'app' : 'workflow'} runs in this range to chart trends yet`}
                ctaLabel="Build a workflow"
                onCta={() => navigate('/workflows')}
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="auto-grad-success" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NEON.green} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={NEON.green} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="auto-grad-failed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NEON.red} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={NEON.red} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                  <RechartsTooltip content={<TooltipContent />} cursor={{ stroke: NEON.violet, strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="success" stroke={NEON.green} strokeWidth={2} fill="url(#auto-grad-success)" name="Successful" isAnimationActive={false} />
                  <Area type="monotone" dataKey="failed" stroke={NEON.red} strokeWidth={2} fill="url(#auto-grad-failed)" name="Failed" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Panel>

        <Panel title={`${isApps ? 'App' : 'Workflow'} Success Rates`} accent={NEON.cyan} delay={0.25}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center', flex: 1, minHeight: 240 }}>
            {(totalSuccess + totalFailed) <= 2 ? (
              <EmptyState
                text="Run a few workflows to see success rates"
                ctaLabel="Build a workflow"
                onCta={() => navigate('/workflows')}
              />
            ) : (
              <>
                <Gauge value={successRate} color={NEON.green} label="Successful runs" />
                <Gauge value={failRate} color={NEON.red} label="Failed runs" />
              </>
            )}
          </Box>
        </Panel>
      </Box>

      {/* Custom Stats */}
      <Panel
        title="Custom Stats"
        accent={NEON.violet}
        delay={0.3}
        action={
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <Select
              displayEmpty
              value={selectedStat}
              onChange={(e) => setSelectedStat(String(e.target.value))}
              renderValue={(v) => (v as string) || 'Select stat'}
            >
              {statKeys.length === 0 && (
                <MenuItem value="" disabled>No stats available</MenuItem>
              )}
              {statKeys.map(k => (
                <MenuItem key={k} value={k}>{k}</MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      >
        <Box sx={{ height: 260 }}>
          {statKeys.length === 0 ? (
            <EmptyState
              text="No custom stats yet — increment any key from a workflow and it shows up here."
              ctaLabel="View Custom Stats API"
              onCta={() => window.open('https://shuffler.io/docs/API#count-stats-for-custom-key', '_blank', 'noopener,noreferrer')}
            />
          ) : statSeries.every(p => p.value === 0) ? (
            <EmptyState text={`No values for "${selectedStat}" in the last ${days} days`} />
                    ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="auto-bar-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON.violet} stopOpacity={1} />
                    <stop offset="100%" stopColor={NEON.violet} stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <RechartsTooltip content={<TooltipContent />} cursor={{ fill: 'hsl(var(--muted) / 0.15)' }} />
                <Bar dataKey="value" name={selectedStat || 'value'} radius={[6, 6, 0, 0]} maxBarSize={64} fill="url(#auto-bar-fill)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Panel>
    </Box>
  );
};

const Gauge = ({ value, color, label }: { value: number; color: string; label: string }) => {
  const data = [{ name: 'v', value, fill: color }];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 110, height: 110, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="75%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: 'hsl(var(--muted) / 0.3)' }} dataKey="value" cornerRadius={20} />
          </RadialBarChart>
        </ResponsiveContainer>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'hsl(var(--foreground))' }}>{value}%</Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>{label}</Typography>
    </Box>
  );
};

export default AutomationDashboard;
