/**
 * CombinedDashboard — single surface that stacks the security
 * DashboardOverview on top and the AutomationDashboard below.
 *
 * Self-sufficient: when mounted with just the standard Shuffle-Core host
 * props (`serverside`, `isLoaded`, `isLoggedIn`, `userdata`, `globalUrl`,
 * `theme`), this component fetches everything DashboardOverview needs:
 *   - Incidents     -> `useDatastore({ category: INCIDENTS })`
 *   - Vulnerabilities -> raw list_cache fetch + inline severity tallying
 *   - Sensors / Hosts -> `/api/v1/getenvironments`
 *
 * Mirrors the logic used by the host `/dashboard` page (single-org branch
 * only; multi-tenant view-as-child is host-specific and intentionally not
 * replicated here). Any data prop the caller passes explicitly wins over
 * the internally-fetched value, so this stays a drop-in.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { useDatastore } from '../../hooks/useDatastore';
import { DATASTORE_CATEGORIES, getApiUrl, getAuthHeader } from '@shuffleio/shuffle-mcps';
import DashboardOverview, { type OverviewProps } from './DashboardOverview';
import AutomationDashboard, { type AutomationDashboardProps } from './AutomationDashboard';
import type { ShuffleCoreHostProps } from '../../types/host-props';

type VulnCounts = { critical: number; high: number; medium: number; low: number; info: number };
const EMPTY_VULNS: VulnCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

export interface CombinedDashboardProps
  extends ShuffleCoreHostProps,
    Partial<Omit<OverviewProps, keyof ShuffleCoreHostProps | 'days'>>,
    Partial<Omit<AutomationDashboardProps, keyof ShuffleCoreHostProps | 'gran' | 'customRange' | 'onRangeSelect' | 'days'>> {
  /** Gap (in MUI spacing units) between the two dashboards. Defaults to 4. */
  gap?: number;
  /** Time range — number (overview days) or string (automation days). */
  days?: number | string;
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

const CombinedDashboard = ({
  gap = 4,
  // Overview data overrides (when supplied, used as-is)
  incidents: incidentsProp,
  incidentsLoading: incidentsLoadingProp,
  vulnSeverityCounts: vulnSeverityCountsProp,
  vulnLoading: vulnLoadingProp,
  monitorHostCount: monitorHostCountProp,
  runningSensorCount: runningSensorCountProp,
  monitorsLoading: monitorsLoadingProp,
  days,
  gran,
  customRange,
  onRangeSelect,
  // Automation-specific
  orgId,
  displayName,
  headerLeft,
  onDaysChange,
  onGranChange,
  mode,
  onModeChange,
  refreshKey,
  hideRefresh,
  // Host props — forwarded to both inner dashboards
  ...host
}: CombinedDashboardProps) => {
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
  }, [vulnSeverityCountsProp]);

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
  }, [monitorHostCountProp, runningSensorCountProp]);

  // ── Resolve effective values (caller overrides win) ──────────────────────
  const eIncidents = incidentsProp ?? fetchedIncidents;
  const eIncidentsLoading = incidentsLoadingProp ?? (incidentsProp === undefined ? incidentsFetching : false);
  const eVulns = vulnSeverityCountsProp ?? fetchedVulns;
  const eVulnLoading = vulnLoadingProp ?? (vulnSeverityCountsProp === undefined ? vulnsFetching : false);
  const eHostCount = monitorHostCountProp !== undefined ? monitorHostCountProp : fetchedHostCount;
  const eSensorCount = runningSensorCountProp !== undefined ? runningSensorCountProp : fetchedSensorCount;
  const eMonitorsLoading = monitorsLoadingProp ?? monitorsFetching;

  const overviewDays = typeof days === 'number' ? days : (typeof days === 'string' ? parseInt(days, 10) || 30 : undefined);
  const automationDays = typeof days === 'string' ? days : (typeof days === 'number' ? String(days) : undefined);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap }}>
      <DashboardOverview
        {...host}
        incidents={eIncidents}
        incidentsLoading={eIncidentsLoading}
        vulnSeverityCounts={eVulns}
        vulnLoading={eVulnLoading}
        monitorHostCount={eHostCount}
        runningSensorCount={eSensorCount}
        monitorsLoading={eMonitorsLoading}
        days={overviewDays}
        gran={gran}
        customRange={customRange}
        onRangeSelect={onRangeSelect}
      />
      <AutomationDashboard
        {...host}
        orgId={orgId}
        displayName={displayName}
        headerLeft={headerLeft}
        days={automationDays}
        onDaysChange={onDaysChange}
        gran={gran}
        onGranChange={onGranChange}
        mode={mode}
        onModeChange={onModeChange}
        refreshKey={refreshKey}
        hideRefresh={hideRefresh}
        customRange={customRange}
        onRangeSelect={onRangeSelect}
      />
    </Box>
  );
};

export default CombinedDashboard;
