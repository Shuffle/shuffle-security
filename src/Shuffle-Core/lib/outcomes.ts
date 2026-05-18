/**
 * Outcome taxonomy + resolver for usecases.
 *
 * Each usecase maps to a single "outcome kind" — the metric that best
 * represents what the automation is *producing* (incidents ingested,
 * enrichments performed, vulnerabilities tracked, response actions executed,
 * IOCs managed, notifications sent). The resolver is pure and only looks at
 * `phase`, `source`, `target`, and `automationArea`, so it works for both
 * curated and backend-only usecases.
 */

export type OutcomeKind =
  | 'incidents_ingested'
  | 'enrichments_run'
  | 'vulns_tracked'
  | 'responses_executed'
  | 'iocs_managed'
  | 'comms_sent'
  | 'none';

export interface OutcomeBreakdownEntry {
  /** Stable key (tool slug, severity bucket, …) */
  key: string;
  /** Human label rendered in the UI */
  label: string;
  value: number;
  iconUrl?: string;
}

export interface UsecaseOutcome {
  kind: OutcomeKind;
  primary: { value: number; label: string };
  /** Last 7d vs prior 7d, as a signed percentage. Omit when trend is unknown. */
  trendPct?: number;
  breakdown: OutcomeBreakdownEntry[];
  /** Optional secondary line, e.g. top hosts for vulns. */
  secondary?: { label: string; entries: OutcomeBreakdownEntry[] };
  windowDays: 30;
  isEmpty: boolean;
  emptyReason?: 'not_enabled' | 'no_source_tool' | 'no_data_yet';
}

interface UsecaseShape {
  source?: string;
  target?: string;
  phase?: string;
  automationArea?: string;
}

const COMMS_TARGETS = new Set(['communication', 'email']);
const VULN_CATEGORIES = new Set(['vulnerability', 'vuln_management', 'scanner', 'asset_management']);
const IOC_CATEGORIES = new Set(['threat_intel']);

export function resolveOutcomeKind(usecase: UsecaseShape | undefined | null): OutcomeKind {
  if (!usecase) return 'none';
  const source = (usecase.source || '').toLowerCase();
  const target = (usecase.target || '').toLowerCase();
  const phase = (usecase.phase || '').toLowerCase();
  const area = (usecase.automationArea || '').toLowerCase();

  // Notifications take precedence over the generic "response" bucket.
  if (area === 'notifications' || COMMS_TARGETS.has(target)) return 'comms_sent';

  // Vulnerability-flavoured flows.
  if (VULN_CATEGORIES.has(source) || VULN_CATEGORIES.has(target)) return 'vulns_tracked';

  // Threat-intel / IOC management.
  if (IOC_CATEGORIES.has(source) && (target === 'case_management' || area === 'threat_intel'))
    return 'enrichments_run';
  if (IOC_CATEGORIES.has(source) || area === 'threat_intel') return 'iocs_managed';

  // Response / containment.
  if (phase === 'response' || area === 'response') return 'responses_executed';

  // Correlation / enrichment.
  if (phase === 'correlation' || area === 'correlation') return 'enrichments_run';

  // Ingest → cases is the canonical "tickets ingested" outcome.
  if (target === 'case_management') return 'incidents_ingested';
  if (phase === 'ingest' || area === 'automatic_ingestion' || area === 'forward_updates')
    return 'incidents_ingested';

  return 'none';
}

export const OUTCOME_PRIMARY_LABEL: Record<OutcomeKind, string> = {
  incidents_ingested: 'incidents ingested',
  enrichments_run: 'enrichments performed',
  vulns_tracked: 'open vulnerabilities',
  responses_executed: 'response actions',
  iocs_managed: 'IOCs tracked',
  comms_sent: 'notifications delivered',
  none: '',
};
