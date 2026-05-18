/**
 * useUsecaseOutcomes — single batched hook that fetches the few datastore
 * categories needed to derive an OUTCOME metric per usecase, then memoises a
 * Map<usecaseId, UsecaseOutcome>.
 *
 * All data comes from endpoints we already query elsewhere (`list_cache`):
 *   - shuffle-security_incidents      → incidents_ingested / enrichments_run
 *   - shuffle-security_vulnerabilities → vulns_tracked
 *   - ioc_<type> (top 5)              → iocs_managed
 *
 * Single hook + React Query cache so cards, detail view, and the alluvial
 * diagram share one round trip per render.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiUrl, getAuthHeader } from '@shuffleio/shuffle-mcps';
import { resolveOutcomeKind, OUTCOME_PRIMARY_LABEL, type UsecaseOutcome, type OutcomeKind, type OutcomeBreakdownEntry } from '../lib/outcomes';

const INCIDENTS_CATEGORY = 'shuffle-security_incidents';
const VULNS_CATEGORY = 'shuffle-security_vulnerabilities';
const SENSORS_CATEGORY = 'shuffle-security_sensors';
const IOC_TYPES = ['ipv4_addr', 'domain', 'sha256', 'email_addr', 'url'];

interface UsecaseShape {
  id: string;
  source?: string;
  target?: string;
  phase?: string;
  automationArea?: string;
  animated?: boolean;
  status?: string;
}

interface SampledIncident {
  product?: string;
  sourceCategory?: string;
  createdAt?: number;
  hasEnrichments: boolean;
}

interface SampledVuln {
  source?: string;
  hostname?: string;
  severity?: string;
}

interface OutcomeBundle {
  incidents: { total: number; sample: SampledIncident[] };
  vulns: { total: number; sample: SampledVuln[] };
  iocs: Array<{ type: string; total: number }>;
  sensors: { total: number };
  iconByName: Record<string, string>;
}

const getOrgId = (): string | null => {
  try {
    const raw = localStorage.getItem('shuffle_user_info');
    return raw ? JSON.parse(raw)?.active_org?.id ?? null : null;
  } catch {
    return null;
  }
};

const fetchListCache = async (orgId: string, category: string, top: number) => {
  const url = getApiUrl(
    `/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(category)}&top=${top}`,
  );
  try {
    const res = await fetch(url, { credentials: 'include', headers: { ...getAuthHeader() } });
    if (!res.ok) return { items: [] as any[], total: 0 };
    const data = await res.json();
    const items = Array.isArray(data) ? data : data?.keys || data?.data || [];
    const total = data?.total_amount ?? data?.total ?? data?.amount ?? (Array.isArray(items) ? items.length : 0);
    return { items: Array.isArray(items) ? items : [], total: typeof total === 'number' ? total : 0 };
  } catch {
    return { items: [] as any[], total: 0 };
  }
};

const parseJsonValue = (raw: any): any => {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
};

const extractIncidentProduct = (incident: any): string | undefined => {
  const product =
    incident?.metadata?.product?.name ||
    incident?.metadata?.product?.vendor_name ||
    incident?.finding_info?.product?.name ||
    incident?.product?.name ||
    incident?.source ||
    incident?.src_tool ||
    incident?.source_tool;
  if (typeof product !== 'string') return undefined;
  return product.trim() || undefined;
};

const extractIncidentSourceCategory = (incident: any): string | undefined => {
  const cat =
    incident?.metadata?.product?.feature?.name ||
    incident?.source_category ||
    incident?.category;
  if (typeof cat !== 'string') return undefined;
  return cat.toLowerCase().trim() || undefined;
};

const extractIncidentCreatedAt = (incident: any): number | undefined => {
  const raw =
    incident?.time ||
    incident?.created_at ||
    incident?.metadata?.original_time ||
    incident?.start_time;
  if (!raw) return undefined;
  const ms = typeof raw === 'number' ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : undefined;
};

const incidentHasEnrichments = (incident: any): boolean => {
  const list =
    incident?.enrichments ||
    incident?.enrichment ||
    incident?.metadata?.enrichments ||
    incident?.context?.enrichments;
  if (Array.isArray(list)) return list.length > 0;
  if (list && typeof list === 'object') return Object.keys(list).length > 0;
  return false;
};

const extractVulnSource = (vuln: any): string | undefined => {
  const s = vuln?.source || vuln?.scanner || vuln?.tool || vuln?.metadata?.product?.name;
  return typeof s === 'string' && s.trim() ? s.trim() : undefined;
};

const extractVulnHostname = (vuln: any): string | undefined => {
  const h = vuln?.asset_name || vuln?.asset_id || vuln?.hostname || vuln?.host?.hostname;
  return typeof h === 'string' && h.trim() ? h.trim() : undefined;
};

const SOURCE_KEYWORDS: Record<string, RegExp[]> = {
  siem: [/splunk/i, /sentinel/i, /qradar/i, /elastic/i, /chronicle/i, /sumo/i, /datadog/i],
  edr: [/crowdstrike/i, /defender/i, /sentinelone/i, /carbon black/i, /cortex/i],
  email: [/gmail/i, /outlook|office\s*365|o365|microsoft 365/i, /proofpoint/i, /mimecast/i],
  iam: [/okta/i, /azure ad|entra/i, /ping/i, /jumpcloud/i, /duo/i],
  network: [/palo alto|panorama/i, /fortinet|fortigate/i, /cisco|firepower/i, /zscaler/i, /cloudflare/i],
  cloud: [/aws|cloudtrail|guardduty/i, /gcp|google cloud/i, /azure/i],
  threat_intel: [/misp/i, /virustotal/i, /alienvault|otx/i, /recordedfuture/i, /abuseipdb/i],
  case_management: [/jira/i, /servicenow/i, /pagerduty/i, /opsgenie/i, /zendesk/i],
  communication: [/slack/i, /teams/i, /discord/i, /smtp/i, /mailgun/i, /sendgrid/i],
  vulnerability: [/tenable|nessus/i, /qualys/i, /rapid7|nexpose/i, /wiz/i, /snyk/i],
};

const productMatchesCategory = (product: string | undefined, category: string | undefined): boolean => {
  if (!product || !category) return false;
  const patterns = SOURCE_KEYWORDS[category];
  if (!patterns) return false;
  return patterns.some((re) => re.test(product));
};

async function fetchAppIconMap(): Promise<Record<string, string>> {
  try {
    const res = await fetch(getApiUrl('/api/v1/apps'), { credentials: 'include', headers: { ...getAuthHeader() } });
    if (!res.ok) return {};
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.data || []);
    const map: Record<string, string> = {};
    for (const a of Array.isArray(list) ? list : []) {
      const n = a?.name ? String(a.name).toLowerCase() : '';
      const icon = a?.large_image || a?.image || '';
      if (n && icon && !map[n]) map[n] = icon;
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchOutcomeBundle(): Promise<OutcomeBundle> {
  const orgId = getOrgId();
  if (!orgId) {
    return {
      incidents: { total: 0, sample: [] },
      vulns: { total: 0, sample: [] },
      iocs: IOC_TYPES.map((type) => ({ type, total: 0 })),
      iconByName: {},
    };
  }

  const [incidentsRes, vulnsRes, iconByName, ...iocResults] = await Promise.all([
    fetchListCache(orgId, INCIDENTS_CATEGORY, 100),
    fetchListCache(orgId, VULNS_CATEGORY, 100),
    fetchAppIconMap(),
    ...IOC_TYPES.map((t) => fetchListCache(orgId, `ioc_${t}`, 1)),
  ]);

  const incidentSample: SampledIncident[] = incidentsRes.items.map((item: any) => {
    const value = parseJsonValue(item?.value);
    return {
      product: extractIncidentProduct(value),
      sourceCategory: extractIncidentSourceCategory(value),
      createdAt: extractIncidentCreatedAt(value),
      hasEnrichments: incidentHasEnrichments(value),
    };
  });

  const vulnSample: SampledVuln[] = vulnsRes.items.map((item: any) => {
    const value = parseJsonValue(item?.value);
    return {
      source: extractVulnSource(value),
      hostname: extractVulnHostname(value),
      severity: typeof value?.severity === 'string' ? value.severity : undefined,
    };
  });

  return {
    incidents: { total: incidentsRes.total, sample: incidentSample },
    vulns: { total: vulnsRes.total, sample: vulnSample },
    iocs: IOC_TYPES.map((type, idx) => ({ type, total: iocResults[idx].total })),
    iconByName,
  };
}

// ── Outcome derivation per usecase ─────────────────────────────────────────────

const topN = (counts: Map<string, number>, n: number): OutcomeBreakdownEntry[] =>
  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, value]) => ({ key, label: key, value }));

const trendPct = (sample: { createdAt?: number }[]): number | undefined => {
  if (sample.length < 4) return undefined;
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  let recent = 0;
  let prior = 0;
  for (const item of sample) {
    if (!item.createdAt) continue;
    const age = now - item.createdAt;
    if (age <= sevenDays) recent += 1;
    else if (age <= 2 * sevenDays) prior += 1;
  }
  if (prior === 0 && recent === 0) return undefined;
  if (prior === 0) return 100;
  return Math.round(((recent - prior) / prior) * 100);
};

function deriveIncidentsOutcome(
  bundle: OutcomeBundle,
  usecase: UsecaseShape,
): UsecaseOutcome {
  const { sample, total } = bundle.incidents;
  const matchingSample = sample.filter((s) => {
    if (!usecase.source) return true;
    if (s.sourceCategory && s.sourceCategory === usecase.source) return true;
    if (productMatchesCategory(s.product, usecase.source)) return true;
    return false;
  });
  // Scale: matching share of sample × total.
  const sampleShare = sample.length > 0 ? matchingSample.length / sample.length : 0;
  const value = Math.round(total * sampleShare);

  const counts = new Map<string, number>();
  for (const inc of matchingSample) {
    const key = inc.product || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  // Scale breakdown values up to match the total.
  const breakdown = topN(counts, 4).map((entry) => ({
    ...entry,
    value: matchingSample.length > 0 ? Math.round((entry.value / matchingSample.length) * value) : 0,
  }));

  return {
    kind: 'incidents_ingested',
    primary: { value, label: OUTCOME_PRIMARY_LABEL.incidents_ingested },
    trendPct: trendPct(matchingSample),
    breakdown,
    windowDays: 30,
    isEmpty: value === 0,
    emptyReason: value === 0 ? (total === 0 ? 'no_data_yet' : 'no_source_tool') : undefined,
  };
}

function deriveEnrichmentsOutcome(bundle: OutcomeBundle): UsecaseOutcome {
  const { sample, total } = bundle.incidents;
  const enriched = sample.filter((s) => s.hasEnrichments);
  const ratio = sample.length > 0 ? enriched.length / sample.length : 0;
  const value = Math.round(total * ratio);
  const counts = new Map<string, number>();
  for (const inc of enriched) {
    const key = inc.product || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return {
    kind: 'enrichments_run',
    primary: { value, label: OUTCOME_PRIMARY_LABEL.enrichments_run },
    trendPct: trendPct(enriched),
    breakdown: topN(counts, 4),
    windowDays: 30,
    isEmpty: value === 0,
    emptyReason: value === 0 ? 'no_data_yet' : undefined,
  };
}

function deriveVulnsOutcome(bundle: OutcomeBundle): UsecaseOutcome {
  const { sample, total } = bundle.vulns;
  const perTool = new Map<string, number>();
  const perHost = new Map<string, number>();
  for (const v of sample) {
    if (v.source) perTool.set(v.source, (perTool.get(v.source) || 0) + 1);
    if (v.hostname) perHost.set(v.hostname, (perHost.get(v.hostname) || 0) + 1);
  }
  return {
    kind: 'vulns_tracked',
    primary: { value: total, label: OUTCOME_PRIMARY_LABEL.vulns_tracked },
    breakdown: topN(perTool, 4),
    secondary: perHost.size > 0 ? { label: 'Top hosts', entries: topN(perHost, 3) } : undefined,
    windowDays: 30,
    isEmpty: total === 0,
    emptyReason: total === 0 ? 'no_data_yet' : undefined,
  };
}

function deriveIocsOutcome(bundle: OutcomeBundle): UsecaseOutcome {
  const total = bundle.iocs.reduce((sum, e) => sum + e.total, 0);
  const breakdown: OutcomeBreakdownEntry[] = bundle.iocs
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
    .map((e) => ({ key: e.type, label: e.type.replace(/_/g, ' '), value: e.total }));
  return {
    kind: 'iocs_managed',
    primary: { value: total, label: OUTCOME_PRIMARY_LABEL.iocs_managed },
    breakdown,
    windowDays: 30,
    isEmpty: total === 0,
    emptyReason: total === 0 ? 'no_data_yet' : undefined,
  };
}

function emptyOutcome(kind: OutcomeKind, reason: UsecaseOutcome['emptyReason']): UsecaseOutcome {
  return {
    kind,
    primary: { value: 0, label: OUTCOME_PRIMARY_LABEL[kind] },
    breakdown: [],
    windowDays: 30,
    isEmpty: true,
    emptyReason: reason,
  };
}

function attachIcons(outcome: UsecaseOutcome, iconByName: Record<string, string>): UsecaseOutcome {
  if (!outcome.breakdown.length) return outcome;
  const enrich = (entries: OutcomeBreakdownEntry[]) =>
    entries.map((e) => {
      if (e.iconUrl) return e;
      const url = iconByName[String(e.key).toLowerCase()] || iconByName[String(e.label).toLowerCase()];
      return url ? { ...e, iconUrl: url } : e;
    });
  return {
    ...outcome,
    breakdown: enrich(outcome.breakdown),
    secondary: outcome.secondary ? { ...outcome.secondary, entries: enrich(outcome.secondary.entries) } : outcome.secondary,
  };
}

function deriveOutcome(usecase: UsecaseShape, bundle: OutcomeBundle): UsecaseOutcome {
  const kind = resolveOutcomeKind(usecase);
  if (kind === 'none') return emptyOutcome('none', 'no_data_yet');

  // For not-yet-enabled usecases we still compute the metric (it reflects what
  // the org currently has at scale across all flows), but flag it so the UI
  // can soften the chip when wanted.
  const notEnabled = usecase.animated === false || usecase.status === 'disabled';

  let outcome: UsecaseOutcome;
  switch (kind) {
    case 'incidents_ingested':
      outcome = deriveIncidentsOutcome(bundle, usecase);
      break;
    case 'enrichments_run':
      outcome = deriveEnrichmentsOutcome(bundle);
      break;
    case 'vulns_tracked':
      outcome = deriveVulnsOutcome(bundle);
      break;
    case 'iocs_managed':
      outcome = deriveIocsOutcome(bundle);
      break;
    case 'responses_executed':
      // Response action telemetry is not in list_cache; surface as not-tracked
      // for now so we are honest about the missing data source.
      outcome = emptyOutcome('responses_executed', 'no_data_yet');
      break;
    case 'comms_sent':
      outcome = emptyOutcome('comms_sent', 'no_data_yet');
      break;
    default:
      outcome = emptyOutcome('none', 'no_data_yet');
  }

  if (notEnabled && outcome.isEmpty) {
    outcome.emptyReason = 'not_enabled';
  }
  return attachIcons(outcome, bundle.iconByName);
}

export function useUsecaseOutcomes(usecases: UsecaseShape[] | undefined) {
  const query = useQuery<OutcomeBundle>({
    queryKey: ['usecase-outcomes-bundle'],
    queryFn: fetchOutcomeBundle,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const outcomes = useMemo(() => {
    const map = new Map<string, UsecaseOutcome>();
    if (!query.data || !usecases) return map;
    for (const uc of usecases) {
      map.set(uc.id, deriveOutcome(uc, query.data));
    }
    return map;
  }, [query.data, usecases]);

  return {
    outcomes,
    isLoading: query.isLoading,
    getOutcome: (id: string): UsecaseOutcome | undefined => outcomes.get(id),
  };
}

export type { UsecaseOutcome, OutcomeKind, OutcomeBreakdownEntry } from '../lib/outcomes';
