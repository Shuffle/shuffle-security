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
  PolarAngleAxis,
} from 'recharts';
import { AlertCircle, CheckCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { SegmentedControl } from '../ui/segmented-control';
import { getApiUrl, getAuthHeader } from '../../api';

import type { ShuffleCoreHostProps } from '../../types/host-props';

export interface AutomationDashboardProps extends ShuffleCoreHostProps {
  /** Organization id to fetch stats for. Falls back to `userdata.active_org.id`. */
  orgId?: string | null;
  /** Optional display name used in the greeting. Falls back to `userdata.username`. */
  displayName?: string;
  /** Optional content rendered on the left of the header row (e.g. dashboard tabs). */
  headerLeft?: React.ReactNode;
}

interface DailyStat {
  date: string;
  app_executions?: number;
  app_executions_failed?: number;
  workflow_executions?: number;
  workflow_executions_finished?: number;
  workflow_executions_failed?: number;
}
interface StatsResponse {
  org_id?: string;
  org_name?: string;
  daily_statistics?: DailyStat[];
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

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [statKeys, setStatKeys] = useState<string[]>([]);
  const [selectedStat, setSelectedStat] = useState<string>('');
  const [statSeries, setStatSeries] = useState<Array<{ date: string; value: number }>>([]);
  const [statLoading, setStatLoading] = useState(false);
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
      const [statsRes, notifRes, statListRes] = await Promise.all([
        fetch(buildUrl(`/api/v1/orgs/${orgId}/stats`), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
        fetch(buildUrl(`/api/v1/notifications`), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
        fetch(buildUrl(`/api/v1/stats`), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (notifRes.ok) {
        const nd = await notifRes.json();
        setNotifications(Array.isArray(nd) ? nd : (nd.notifications || []));
      }
      if (statListRes.ok) {
        const sd = await statListRes.json();
        // Tolerate multiple shapes: string[], {stats:[...]}, {key:value}.
        let keys: string[] = [];
        const raw = Array.isArray(sd) ? sd : (sd?.stats ?? sd?.keys ?? sd);
        if (Array.isArray(raw)) {
          keys = raw.map((x: any) => typeof x === 'string' ? x : (x?.name || x?.key || x?.id)).filter(Boolean);
        } else if (raw && typeof raw === 'object') {
          keys = Object.keys(raw);
        }
        keys = Array.from(new Set(keys)).sort();
        setStatKeys(keys);
        setSelectedStat(prev => prev || keys[0] || '');
      }
    } catch { /* noop */ } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId, isLoaded, isLoggedIn, globalUrl]);

  // Fetch the selected custom stat series whenever the key or range changes.
  useEffect(() => {
    if (serverside || !isLoaded || !isLoggedIn || !selectedStat) return;
    let cancelled = false;
    setStatLoading(true);
    fetch(buildUrl(`/api/v1/stats/${encodeURIComponent(selectedStat)}?days=${days}`), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d) { setStatSeries([]); return; }
        // Normalise into [{date, value}]. Accept several common shapes.
        const raw = Array.isArray(d) ? d
          : d.additions ?? d.data ?? d.values ?? d.daily_statistics ?? d.series ?? [];
        const series = (Array.isArray(raw) ? raw : []).map((item: any) => {
          const date = item?.date || item?.day || item?.timestamp || item?.t || '';
          const value = Number(
            item?.value ?? item?.count ?? item?.total ?? item?.amount ?? item?.v ?? 0
          ) || 0;
          return { date: String(date).slice(0, 10), value };
        }).filter(p => p.date);
        series.sort((a, b) => a.date.localeCompare(b.date));
        setStatSeries(series);
      })
      .catch(() => { if (!cancelled) setStatSeries([]); })
      .finally(() => { if (!cancelled) setStatLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [selectedStat, days, isLoaded, isLoggedIn, globalUrl]);

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

  // Per-month aggregated counts for the bottom bar chart.
  const monthData = useMemo(() => {
    const map: Record<string, number> = {};
    daily.forEach(d => {
      const dt = new Date(d.date);
      const k = dt.toLocaleString('en', { month: 'short' });
      map[k] = (map[k] || 0) + ((d as any)[successKey] || 0) + ((d as any)[failedKey] || 0);
    });
    const order = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
    return order.map(m => ({ month: m, runs: map[m] || 0 }));
  }, [daily, successKey, failedKey]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
        {[140, 320, 240].map((h, i) => (
          <Skeleton key={i} variant="rounded" height={h} sx={{ borderRadius: 2, bgcolor: 'hsl(var(--muted) / 0.3)' }} />
        ))}
      </Box>
    );
  }

  const cardSx = {
    border: '1px solid hsl(var(--border))',
    borderRadius: 2,
    backgroundColor: 'hsl(var(--card))',
    p: 3,
  } as const;

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

      {/* Stat cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <Box sx={{ ...cardSx, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1.1 }}>
              {notificationCount}
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', mt: 0.5 }}>
              Notifications
            </Typography>
          </Box>
          <AlertCircle size={22} style={{ color: 'hsl(var(--severity-high))' }} />
        </Box>
        <Box sx={{ ...cardSx, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1.1 }}>
              0
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', mt: 0.5 }}>
              Errors resolved
            </Typography>
          </Box>
          <CheckCircle size={22} style={{ color: 'hsl(var(--severity-low))' }} />
        </Box>
      </Box>

      {/* Area chart + success rate gauges */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2 }}>
        <Box sx={cardSx}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))', mb: 2 }}>
            Successful vs Failed Runs ({isApps ? 'Apps' : 'Workflows'})
          </Typography>
          <Box sx={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="successFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--severity-low))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--severity-low))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="failFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--severity-high))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--severity-high))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="success" stroke="hsl(var(--severity-low))" fill="url(#successFill)" strokeWidth={2} name="Successful" />
                <Area type="monotone" dataKey="failed" stroke="hsl(var(--severity-high))" fill="url(#failFill)" strokeWidth={2} name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
            <LegendDot color="hsl(var(--severity-low))" label="Successful Runs" />
            <LegendDot color="hsl(var(--severity-high))" label="Failed Runs" />
            <Typography sx={{ ml: 'auto', fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
              X: Date (MM-DD)  |  Y: Runs
            </Typography>
          </Box>
        </Box>

        <Box sx={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            {isApps ? 'App' : 'Workflow'} Success Rates
          </Typography>
          <Gauge value={successRate} color="hsl(var(--severity-low))" label="Successful runs" />
          <Gauge value={failRate} color="hsl(var(--severity-high))" label="Failed runs" />
        </Box>
      </Box>

      {/* Bottom bar chart — custom stat from /api/v1/stats */}
      <Box sx={cardSx}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Custom Stats
              </Typography>
              <Box
                component="span"
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  px: 0.75,
                  py: 0.2,
                  borderRadius: 0.75,
                  color: 'hsl(var(--primary))',
                  border: '1px solid hsl(var(--primary) / 0.4)',
                  bgcolor: 'hsl(var(--primary) / 0.08)',
                }}
              >
                Track anything
              </Box>
            </Box>
            <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.45 }}>
              Count anything across your tenant with a custom key — usage, runs, errors, tokens, business events. Increment from any workflow and it shows up here.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Find your Stat</InputLabel>
              <Select
                label="Find your Stat"
                value={selectedStat}
                onChange={(e) => setSelectedStat(String(e.target.value))}
              >
                {statKeys.length === 0 && (
                  <MenuItem value="" disabled>No stats available</MenuItem>
                )}
                {statKeys.map(k => (
                  <MenuItem key={k} value={k}>{k}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <MuiTooltip title="View Custom Stats API docs">
              <IconButton
                size="small"
                component="a"
                href="https://shuffler.io/docs/API#count-stats-for-custom-key"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <ExternalLink size={14} />
              </IconButton>
            </MuiTooltip>
          </Box>
        </Box>
        {selectedStat && (
          <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', mb: 1.5 }}>
            Showing <Box component="span" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>{selectedStat}</Box> · {statSeries.length} data points
          </Typography>
        )}
        <Box sx={{ height: 320, position: 'relative' }}>
          {statLoading ? (
            <Skeleton variant="rounded" height={320} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }} />
          ) : statSeries.length === 0 ? (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
                {selectedStat ? 'No data for this range' : 'Select a stat to view data'}
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statSeries} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name={selectedStat} fill="url(#barFill)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
    <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>{label}</Typography>
  </Box>
);

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
