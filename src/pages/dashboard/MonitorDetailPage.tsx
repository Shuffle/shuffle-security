import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Laptop, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { useHostActions } from '@/hooks/useHostActions';
import { useVulnerabilities } from '@/hooks/useVulnerabilities';
import { HostActionPopover } from '@/components/monitors/HostActionPopover';
import { HostDetailPanel } from '@/components/monitors/HostDetailPanel';
import { DisableRceConfirmDialog } from '@/components/monitors/DisableRceConfirmDialog';
import { fetchHostSupplements, mergeHost } from '@/lib/mergeMonitorHosts';
import { isDemoActive } from '@/services/demoMode';
import { DEMO_HOST_HOSTNAME } from '@/services/demoLiveEnvironment';

// ── OS icon (kept local — also used inline in the header) ────────────────────
const OsIcon = ({ os, size = 14, className = '' }: { os: string; size?: number; className?: string }) => {
  const lower = (os || '').toLowerCase();
  if (lower.includes('windows') || lower.includes('win'))
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M0 3.5l9.9-1.4v9.6H0zm11.1-1.5L24 0v11.7H11.1zM0 12.6h9.9v9.6L0 20.7zm11.1-.3H24V24l-12.9-1.8z"/></svg>;
  if (lower.includes('mac') || lower.includes('darwin'))
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M18.7 19.4c-.7 1-1.4 2-2.6 2s-1.7-.7-3.2-.7-2 .7-3.2.7-1.7-.9-2.5-1.9C5.5 17.2 4 13.6 5.7 11.3c.8-1.1 2.2-1.8 3.7-1.9 1.2 0 2.3.8 3 .8s2.1-.9 3.5-.8c.6 0 2.3.2 3.4 1.8-3 1.8-2.5 5.5.4 7.2zM15.3 2c-2.2.1-4 2.4-3.7 4.3 2 .2 4-2 3.7-4.3z"/></svg>;
  return <Laptop size={size} className={className} />;
};

interface SensorHost {
  arch: string;
  automatic_screen_lock_enabled: boolean | string;
  checkin: number;
  elevated_access: boolean;
  hd_encrypted: boolean | string;
  hostname: string;
  installed_software: { name: string; [key: string]: unknown }[];
  code_scanner?: { path: string; type: string; packages: { name: string; version: string }[] }[];
  log_forwarding: string;
  os: string;
  sensor_mode: boolean;
  serial: string;
  uuid: string;
  response_actions?: string;
  [key: string]: unknown;
}

const MonitorDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [host, setHost] = useState<SensorHost | null>(null);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  usePageMeta({ title: host ? `${host.hostname} — Monitor` : 'Monitor Detail', description: 'Host monitor detail view' });

  const fetchHost = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Pull env stub (lightweight host metadata + group association).
      const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) { setError(`Failed to load (HTTP ${res.status})`); setLoading(false); return; }
      const data = await res.json();
      const envs = Array.isArray(data) ? data.filter((e: any) => !e.archived && e.sensor_group === true) : [];

      let envHost: SensorHost | null = null;
      let envGroupName = '';
      const decodedId = id ? decodeURIComponent(id) : '';
      const idLower = decodedId.toLowerCase().trim();
      // Strip common domain suffixes for tolerant matching (matches list-page display behavior)
      const stripDomain = (h: string) => h.toLowerCase().trim().replace(/\.(local|lan|home|internal|corp)$/i, '');
      const idStripped = stripDomain(decodedId);

      for (const env of envs) {
        const hosts: SensorHost[] = Array.isArray(env.sensor_hosts) ? env.sensor_hosts : [];
        const found = hosts.find((h: SensorHost) => {
          const hn = (h.hostname || '').toLowerCase().trim();
          return h.uuid === decodedId || hn === idLower || stripDomain(hn) === idStripped;
        });
        if (found) {
          envHost = found;
          envGroupName = env.Name || '';
          break;
        }
      }

      // 2) Cross-load shuffle-security_sensors + shuffle-security_assets.
      //    Hosts may exist in sensors/assets without an env stub — fall back to
      //    those records when the env lookup fails.
      const supplements = await fetchHostSupplements();
      if (supplements.errors.length) {
        console.warn('[MonitorDetail] Host supplement load issues:', supplements.errors);
      }

      if (!envHost) {
        // Try to locate by hostname in the sensors/assets datastores directly.
        const findInMap = (map: Map<string, Record<string, unknown>>) => {
          if (map.has(idLower)) return map.get(idLower)!;
          if (map.has(idStripped)) return map.get(idStripped)!;
          for (const [key, val] of map.entries()) {
            if (stripDomain(key) === idStripped) return val;
          }
          return null;
        };
        const fromSensors = findInMap(supplements.sensorsByHost);
        const fromAssets = findInMap(supplements.assetsByHost);
        const fallback = fromSensors || fromAssets;
        if (!fallback) {
          setError('Host not found');
          setLoading(false);
          return;
        }
        envHost = { hostname: decodedId, ...(fallback as Record<string, unknown>) } as unknown as SensorHost;

        // Even though there's no env stub for this host, scan envs for any
        // group that *mentions* this hostname/uuid so terminal actions get a
        // valid sensor_group. Without this, /api/v1/apps/sensors/run rejects
        // requests with "'sensor_group' can't be empty".
        const fallbackHostname = String((fallback as Record<string, unknown>).hostname || decodedId).toLowerCase().trim();
        const fallbackUuid = String((fallback as Record<string, unknown>).uuid || '');
        outer: for (const env of envs) {
          const hosts: SensorHost[] = Array.isArray(env.sensor_hosts) ? env.sensor_hosts : [];
          for (const h of hosts) {
            const hn = (h.hostname || '').toLowerCase().trim();
            if ((fallbackUuid && h.uuid === fallbackUuid) || hn === fallbackHostname || stripDomain(hn) === stripDomain(fallbackHostname)) {
              envGroupName = env.Name || '';
              break outer;
            }
          }
        }
        // Last resort: if there's exactly one sensor group, assume this host belongs to it.
        if (!envGroupName && envs.length === 1) {
          envGroupName = envs[0].Name || '';
        }
      }

      const merged = mergeHost(envHost as unknown as Record<string, unknown>, supplements.sensorsByHost, supplements.assetsByHost) as unknown as SensorHost;

      setHost(merged);
      setGroupName(envGroupName);
    } catch {
      setError('Failed to reach the API');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchHost(); }, [fetchHost]);

  // Tick every second to keep "Last check-in" live
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Shared host action state — same hook used by /monitors list view
  const hostActions = useHostActions({ onActionComplete: fetchHost });

  // Cross-load vulnerabilities and filter to this host (by hostname, with domain-stripped fallback)
  const { vulnerabilities: allVulns, hasFetched: vulnsFetched } = useVulnerabilities({ tab: 'assets' });
  const hostVulnerabilities = useMemo(() => {
    if (!host) return undefined;
    if (!vulnsFetched) return undefined; // undefined → don't render the summary block yet
    const stripDomain = (h: string) => h.toLowerCase().trim().replace(/\.(local|lan|home|internal|corp)$/i, '');
    const target = stripDomain(host.hostname || '');
    if (!target) return [];
    return allVulns.filter(v => v.asset_name && stripDomain(v.asset_name) === target);
  }, [allVulns, vulnsFetched, host]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !host) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate('/monitors')} className="mb-4 gap-1.5">
          <ArrowLeft size={14} /> Back to Monitors
        </Button>
        <div className="text-center py-16">
          <p className="text-muted-foreground">{error || 'Host not found'}</p>
        </div>
      </div>
    );
  }

  const checkinDate = host.checkin ? new Date(host.checkin * 1000) : null;
  const isRecent = checkinDate ? (Date.now() - checkinDate.getTime()) < 5 * 60 * 1000 : false;

  const relativeTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/monitors')} className="gap-1.5 shrink-0">
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <OsIcon os={host.os} size={20} className="text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{host.hostname}</h1>
            <p className="text-xs text-muted-foreground">
              Group: {groupName}
              {checkinDate && (
                <> · Last check-in: <span className={isRecent ? 'text-green-500' : ''}>{relativeTime(checkinDate)}</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <HostActionPopover
            host={{ uuid: host.uuid, hostname: host.hostname, groupName, responseActions: host.response_actions }}
            trigger="button"
            actionHistoryMap={hostActions.actionHistoryMap}
            actionExecuting={hostActions.actionExecuting}
            executeHostAction={hostActions.executeHostAction}
            abortHostAction={hostActions.abortHostAction}
            hydrateHost={hostActions.hydrateHost}
            getCommandHistory={hostActions.getCommandHistory}
          />
          <Button variant="outline" size="sm" onClick={fetchHost} className="gap-1.5 h-8 shrink-0">
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* Detail panel — same component used by /monitors list expansion */}
      <HostDetailPanel
        host={host}
        variant="page"
        collapsibleSections
        hostUuid={host.uuid}
        hostname={host.hostname}
        groupName={groupName}
        vulnerabilities={hostVulnerabilities}
      />

      <DisableRceConfirmDialog
        pending={hostActions.pendingDisableRce}
        onCancel={() => hostActions.setPendingDisableRce(null)}
        onConfirm={hostActions.confirmDisableRce}
      />
    </div>
  );
};

export default MonitorDetailPage;
