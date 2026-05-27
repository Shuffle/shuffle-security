/**
 * CombinedDashboard — single surface that mirrors the host `/dashboard`
 * page's tabbed layout: a "Security Operations" view (DashboardOverview)
 * and an "Automation" view (AutomationDashboard), switched via a shared
 * SegmentedControl header that also exposes the date range, mode
 * (workflows/apps), granularity (daily/monthly), and a refresh button.
 *
 * Self-sufficient: when mounted with just the standard Shuffle-Core host
 * props (`serverside`, `isLoaded`, `isLoggedIn`, `userdata`, `globalUrl`,
 * `theme`) this component fetches everything the inner dashboards need:
 *   - Incidents       -> `useDatastore({ category: INCIDENTS })`
 *   - Vulnerabilities -> raw list_cache fetch + inline severity tallying
 *   - Sensors / Hosts -> `/api/v1/getenvironments`
 *
 * Any data prop the caller passes explicitly wins over the internally
 * fetched value, so this stays a drop-in replacement for the single-org
 * branch of the host `/dashboard` page.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, FormControl, IconButton, InputLabel, MenuItem, Select, Tooltip as MuiTooltip } from '@mui/material';
import { RefreshCw as RefreshIcon, X as CloseIcon } from 'lucide-react';
import { useDatastore } from '../../hooks/useDatastore';
import { DATASTORE_CATEGORIES } from '@shuffleio/shuffle-mcps';
import { getApiUrl, getAuthHeader } from '../../api';
import DashboardOverview, { type OverviewProps } from './DashboardOverview';
import AutomationDashboard, { type AutomationDashboardProps, AUTOMATION_RANGE_OPTIONS } from './AutomationDashboard';
import { SegmentedControl } from '../ui/segmented-control';
import type { ShuffleCoreHostProps } from '../../types/host-props';
import { useSyncHostBaseUrl } from '../../useSyncHostBaseUrl';
import { UsecaseDrawer } from '../../views/Usecases';

type VulnCounts = { critical: number; high: number; medium: number; low: number; info: number };
const EMPTY_VULNS: VulnCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

export interface CombinedDashboardProps
  extends ShuffleCoreHostProps,
    Partial<Omit<OverviewProps, keyof ShuffleCoreHostProps | 'days'>>,
    Partial<Omit<AutomationDashboardProps, keyof ShuffleCoreHostProps | 'gran' | 'customRange' | 'onRangeSelect' | 'days'>> {
  /** Default tab on first mount. Persisted to localStorage thereafter. */
  defaultTab?: 'security' | 'automation';
}

// ── helpers (mirrors DashboardPage.overviewIncidents transform) ─────────────
const SEV_MAP: Record<number, string> = { 1: 'informational', 2: 'low', 3: 'medium', 4: 'high', 5: 'critical', 6: 'critical' };
const STATUS_MAP: Record<number, string> = { 1: 'new', 2: 'in_progress', 3: 'resolved', 4: 'on_hold' };
const STATUS_SYNONYMS: Record<string, string> = {
  open: 'new', created: 'new', pending: 'new', reported: 'new',
  inprogress: 'in_progress', active: 'in_progress', investigating: 'in_progress',
  working: 'in_progress', assigned: 'in_progress', acknowledged: 'in_progress',
  closed: 'resolved', done: 'resolved', complete: 'resolved', completed: 'resolved',
  fixed: 'resolved', remediated: 'resolved', mitigated: 'resolved',
};
const normalizeTs = (t: unknown): number => {
  if (!t) return 0;
  const n = typeof t === 'string' ? Number(t) : (typeof t === 'number' ? t : 0);
  if (!n || isNaN(n) || n <= 0) {
    if (typeof t === 'string') {
      const d = new Date(t).getTime();
      return isNaN(d) ? 0 : d;
    }
    return 0;
  }
  if (n < 1e12) return n * 1000;
  if (n < 1e15) return n;
  if (n < 1e18) return n / 1000;
  return n / 1e6;
};

const fmtShort = (ms: number) => {
  const d = new Date(ms);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${M} ${d.getDate()}`;
};

const CombinedDashboard = ({
  defaultTab = 'security',
  // Overview data overrides (when supplied, used as-is)
  incidents: incidentsProp,
  incidentsLoading: incidentsLoadingProp,
  vulnSeverityCounts: vulnSeverityCountsProp,
  vulnLoading: vulnLoadingProp,
  monitorHostCount: monitorHostCountProp,
  runningSensorCount: runningSensorCountProp,
  monitorsLoading: monitorsLoadingProp,
  // Automation-specific (callers may pre-control)
  orgId,
  displayName,
  headerLeft,
  refreshKey: refreshKeyProp,
  // Host props — forwarded to both inner dashboards
  ...host
}: CombinedDashboardProps) => {
  useSyncHostBaseUrl(host.globalUrl);

  // ── Shared filter state (mirrors DashboardPage) ──────────────────────────
  const [tab, setTab] = useState<'security' | 'automation'>(() => {
    try {
      const stored = localStorage.getItem('shuffle_dashboard_tab');
      if (stored === 'security' || stored === 'automation') return stored;
    } catch { /* noop */ }
    return defaultTab;
  });
  useEffect(() => { try { localStorage.setItem('shuffle_dashboard_tab', tab); } catch { /* noop */ } }, [tab]);

  const [days, setDays] = useState<string>('30');
  const [gran, setGran] = useState<'daily' | 'monthly'>('daily');
  const [mode, setMode] = useState<'workflows' | 'apps'>('workflows');
  const [customRange, setCustomRange] = useState<{ fromMs: number; toMs: number } | null>(null);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);

  // ── Incidents ─────────────────────────────────────────────────────────────
  const { items: incidentItems, isLoading: incidentsFetching, fetchItems, hasFetched } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });
  useEffect(() => { if (!hasFetched && incidentsProp === undefined) fetchItems(); }, [hasFetched, fetchItems, incidentsProp]);

  const fetchedIncidents = useMemo(() => {
    const out: { status: string; severity: string; createdTs: number }[] = [];
    const seen = new Set<string>();
    for (const item of incidentItems) {
      try {
        if (!item.value || (typeof item.value === 'string' && item.value.length > 5_000_000)) continue;
        const data = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
        const customAttrs = data?.metadata?.extensions?.custom_attributes;
        const severityId = data?.severity_id;
        const severity = (data?.severity || SEV_MAP[severityId] || 'medium').toString().toLowerCase();
        const rawStatus = (data?.status || customAttrs?.status || STATUS_MAP[data?.status_id] || 'new').toString().toLowerCase().trim().replace(/[\s-]+/g, '_');
        const status = STATUS_SYNONYMS[rawStatus] || STATUS_SYNONYMS[rawStatus.replace(/_/g, '')] || rawStatus;
        const createdTs = normalizeTs(data?.created_time) || normalizeTs((item as { created?: number }).created);
        const dedupeKey = (item.key || '').includes('::') ? item.key.split('::').pop()! : item.key;
        if (dedupeKey && seen.has(dedupeKey)) continue;
        if (dedupeKey) seen.add(dedupeKey);
        out.push({ status, severity, createdTs });
      } catch { /* skip */ }
    }
    return out;
  }, [incidentItems]);

  // ── Vulnerabilities ──────────────────────────────────────────────────────
  const [fetchedVulns, setFetchedVulns] = useState<VulnCounts>(EMPTY_VULNS);
  const [vulnsFetching, setVulnsFetching] = useState<boolean>(vulnSeverityCountsProp === undefined);
  useEffect(() => {
    if (vulnSeverityCountsProp !== undefined) { setVulnsFetching(false); return; }
    let cancelled = false;
    (async () => {
      setVulnsFetching(true);
      try {
        const url = getApiUrl(`/api/v1/list_cache?category=${encodeURIComponent('shuffle-security_vulnerabilities')}&top=100`);
        const res = await fetch(url, { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json', ...getAuthHeader() } });
        if (!res.ok) { if (!cancelled) { setFetchedVulns(EMPTY_VULNS); setVulnsFetching(false); } return; }
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.keys || data.data || []);
        const counts: VulnCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        for (const item of list) {
          try {
            const v = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            const sevRaw = (v?.severity || v?.database_specific?.severity || '').toString().toLowerCase();
            let sev: keyof VulnCounts = 'info';
            if (sevRaw.startsWith('crit')) sev = 'critical';
            else if (sevRaw.startsWith('high') || sevRaw === 'severe') sev = 'high';
            else if (sevRaw.startsWith('mod') || sevRaw.startsWith('med')) sev = 'medium';
            else if (sevRaw.startsWith('low')) sev = 'low';
            counts[sev]++;
          } catch { /* skip */ }
        }
        if (!cancelled) { setFetchedVulns(counts); setVulnsFetching(false); }
      } catch {
        if (!cancelled) { setFetchedVulns(EMPTY_VULNS); setVulnsFetching(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [vulnSeverityCountsProp, internalRefreshKey]);

  // ── Sensors / Host monitors ──────────────────────────────────────────────
  const [fetchedSensorCount, setFetchedSensorCount] = useState<number | null>(null);
  const [fetchedHostCount, setFetchedHostCount] = useState<number | null>(null);
  const [monitorsFetching, setMonitorsFetching] = useState<boolean>(
    monitorHostCountProp === undefined && runningSensorCountProp === undefined
  );
  useEffect(() => {
    if (monitorHostCountProp !== undefined && runningSensorCountProp !== undefined) { setMonitorsFetching(false); return; }
    let cancelled = false;
    (async () => {
      setMonitorsFetching(true);
      try {
        const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!res.ok) { if (!cancelled) { setFetchedSensorCount(0); setFetchedHostCount(0); setMonitorsFetching(false); } return; }
        const envs = await res.json();
        const now = Math.floor(Date.now() / 1000);
        const runningEnvs = Array.isArray(envs) ? envs.filter(
          (e: any) => e.Type === 'onprem' && e.checkin > 0 && (now - e.checkin) < 300 && e.data_lake?.enabled === true
        ) : [];
        let hostCount = 0;
        if (Array.isArray(envs)) {
          for (const e of envs) if (!e.archived && Array.isArray(e.sensor_hosts)) hostCount += e.sensor_hosts.length;
        }
        if (!cancelled) {
          setFetchedSensorCount(runningEnvs.length);
          setFetchedHostCount(hostCount);
          setMonitorsFetching(false);
        }
      } catch {
        if (!cancelled) { setFetchedSensorCount(0); setFetchedHostCount(0); setMonitorsFetching(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [monitorHostCountProp, runningSensorCountProp, internalRefreshKey]);

  // ── Resolve effective values (caller overrides win) ──────────────────────
  const eIncidents = incidentsProp ?? fetchedIncidents;
  const eIncidentsLoading = incidentsLoadingProp ?? (incidentsProp === undefined ? incidentsFetching : false);
  const eVulns = vulnSeverityCountsProp ?? fetchedVulns;
  const eVulnLoading = vulnLoadingProp ?? (vulnSeverityCountsProp === undefined ? vulnsFetching : false);
  const eHostCount = monitorHostCountProp !== undefined ? monitorHostCountProp : fetchedHostCount;
  const eSensorCount = runningSensorCountProp !== undefined ? runningSensorCountProp : fetchedSensorCount;
  const eMonitorsLoading = monitorsLoadingProp ?? monitorsFetching;

  const handleRefresh = () => {
    setInternalRefreshKey(k => k + 1);
    try { fetchItems(); } catch { /* noop */ }
  };

  const customRangeLabel = customRange
    ? `${fmtShort(customRange.fromMs)} → ${fmtShort(customRange.toMs)}`
    : null;

  const sharedHeader = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 36 }}>
        <SegmentedControl
          ariaLabel="Dashboard view"
          value={tab}
          onChange={(v) => setTab(v as 'security' | 'automation')}
          options={[
            { value: 'security', label: 'Security Operations' },
            { value: 'automation', label: 'Automation' },
          ]}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: customRangeLabel ? 220 : 130 }}>
          <InputLabel>Last</InputLabel>
          <Select
            label="Last"
            value={customRange ? '__custom__' : days}
            onChange={(e) => {
              const v = String(e.target.value);
              if (v === '__custom__') return;
              setCustomRange(null);
              setDays(v);
            }}
            renderValue={() => customRangeLabel ?? (AUTOMATION_RANGE_OPTIONS.find(o => o.value === days)?.label ?? `${days} days`)}
            endAdornment={customRange ? (
              <IconButton
                size="small"
                onMouseDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); setCustomRange(null); }}
                sx={{ mr: 3, p: 0.25, color: 'hsl(var(--muted-foreground))' }}
                aria-label="Clear custom range"
              >
                <CloseIcon size={14} />
              </IconButton>
            ) : undefined}
          >
            {customRangeLabel && (
              <MenuItem value="__custom__" disabled>{customRangeLabel} (custom)</MenuItem>
            )}
            {AUTOMATION_RANGE_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ alignSelf: 'flex-end', opacity: tab === 'security' ? 0.5 : 1, pointerEvents: tab === 'security' ? 'none' : 'auto' }}>
          <SegmentedControl
            ariaLabel="Mode"
            value={mode}
            onChange={(v) => setMode(v as 'workflows' | 'apps')}
            options={[
              { value: 'workflows', label: 'Workflows', disabled: tab === 'security' },
              { value: 'apps', label: 'Apps', disabled: tab === 'security' },
            ]}
          />
        </Box>
        <Box sx={{ alignSelf: 'flex-end' }}>
          <SegmentedControl
            ariaLabel="Granularity"
            value={gran}
            onChange={(v) => setGran(v as 'daily' | 'monthly')}
            options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }]}
          />
        </Box>
        <MuiTooltip title="Refresh">
          <IconButton
            size="small"
            onClick={handleRefresh}
            sx={{ color: 'hsl(var(--muted-foreground))', alignSelf: 'flex-end', width: 36, height: 36, borderRadius: '8px' }}
          >
            <RefreshIcon size={16} />
          </IconButton>
        </MuiTooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 1100, width: '100%', mx: 'auto', pt: '25px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {sharedHeader}
      {tab === 'automation' ? (
        <AutomationDashboard
          {...host}
          orgId={orgId}
          displayName={displayName}
          headerLeft={headerLeft}
          days={days}
          onDaysChange={setDays}
          gran={gran}
          onGranChange={setGran}
          mode={mode}
          onModeChange={setMode}
          refreshKey={(refreshKeyProp ?? 0) + internalRefreshKey}
          hideRefresh
          customRange={customRange}
          onRangeSelect={(fromMs, toMs) => setCustomRange({ fromMs, toMs })}
        />
      ) : (
        <DashboardOverview
          {...host}
          incidents={eIncidents}
          incidentsLoading={eIncidentsLoading}
          vulnSeverityCounts={eVulns}
          vulnLoading={eVulnLoading}
          monitorHostCount={eHostCount}
          runningSensorCount={eSensorCount}
          monitorsLoading={eMonitorsLoading}
          days={parseInt(days, 10) || 30}
          gran={gran}
          customRange={customRange}
          onRangeSelect={(fromMs, toMs) => setCustomRange({ fromMs, toMs })}
        />
      )}
    </Box>
  );
};

export default CombinedDashboard;
