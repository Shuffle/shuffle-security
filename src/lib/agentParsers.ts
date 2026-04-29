/**
 * Shared parsers for agent execution data.
 * Used by AgentRunResultViewer and incident activity feed.
 */

import type { AgentRun } from '@/services/agentActivity';

/** Reference to a datastore entity extracted from agent execution input */
export interface DatastoreReference {
  key: string;
  category: string;
}

/**
 * Parse a datastore Key and Category from an agent run's original_input.
 * The input string looks like:
 *   "### Datastore Value\nKey: 91c23c963371cd392a86432738330dc5\nCategory: shuffle-security_incidents"
 */
export const parseDatastoreReference = (run: AgentRun): DatastoreReference | null => {
  // Try parsed JSON first
  const firstResult = run.results?.[0]?.result;
  if (firstResult) {
    try {
      const parsed = JSON.parse(firstResult);
      const input = parsed?.original_input;
      if (input && typeof input === 'string') {
        return extractReference(input);
      }
    } catch {
      // Not JSON — ignore
    }
  }

  // Fallback: check execution_argument directly
  if (run.execution_argument && typeof run.execution_argument === 'string') {
    return extractReference(run.execution_argument);
  }

  return null;
};

/** Core regex extraction from a raw string */
const extractReference = (input: string): DatastoreReference | null => {
  const keyMatch = input.match(/Key:\s*([a-f0-9]+)/i);
  const categoryMatch = input.match(/Category:\s*([\w-]+)/i);

  if (keyMatch && categoryMatch) {
    return { key: keyMatch[1], category: categoryMatch[1] };
  }
  return null;
};

/**
 * Check if a datastore reference points to an incident.
 */
export const isIncidentReference = (ref: DatastoreReference): boolean => {
  return ref.category === 'shuffle-security_incidents';
};

/**
 * Collect every string field from an agent run that might reference an incident.
 * Includes execution_argument, every result.result, decisions, and the result blob.
 */
const collectRunText = (run: AgentRun): string => {
  const parts: string[] = [];
  if (typeof run.execution_argument === 'string') parts.push(run.execution_argument);
  if (typeof run.result === 'string') parts.push(run.result);
  if (Array.isArray(run.results)) {
    for (const r of run.results) {
      if (r && typeof r.result === 'string') parts.push(r.result);
    }
  }
  if (Array.isArray(run.decisions)) {
    for (const d of run.decisions) {
      try { parts.push(JSON.stringify(d)); } catch { /* ignore */ }
    }
  }
  return parts.join('\n');
};

/**
 * Get agent runs that reference a specific incident key.
 * Matches via:
 *   1) Datastore reference (Key: / Category:)
 *   2) Bare occurrence of the incident key/uid anywhere in run text
 *      (covers OCSF finding.uid, incident_id, embedded JSON, URLs, etc.)
 */
export const getAgentRunsForIncident = (
  runs: AgentRun[],
  incidentKey: string
): AgentRun[] => {
  if (!incidentKey) return [];
  const needle = incidentKey.toLowerCase();
  return runs.filter((run) => {
    const ref = parseDatastoreReference(run);
    if (ref && isIncidentReference(ref) && ref.key === incidentKey) return true;
    // Fallback: substring match in any run text field
    const haystack = collectRunText(run).toLowerCase();
    if (!haystack) return false;
    return haystack.includes(needle);
  });
};

/**
 * Detect a "skipped" agent run — the workflow checked whether the agent
 * should run but a branch condition rejected it (decision_string.success === false).
 * The agent itself never executed; only the routing decision did.
 */
export interface AgentSkipInfo {
  skipped: boolean;
  reason?: string;
}

export const getAgentSkipInfo = (run: AgentRun): AgentSkipInfo => {
  const tryParse = (s: unknown): any => {
    if (!s || typeof s !== 'string') return null;
    try { return JSON.parse(s); } catch { return null; }
  };

  const candidates: any[] = [];
  const top = tryParse((run as any).result) ?? (run as any).result;
  if (top && typeof top === 'object') candidates.push(top);
  if (Array.isArray(run.results)) {
    for (const r of run.results) {
      const parsed = tryParse(r?.result);
      if (parsed && typeof parsed === 'object') candidates.push(parsed);
    }
  }

  for (const obj of candidates) {
    const ds = obj?.decision_string;
    if (ds && typeof ds === 'object' && ds.success === false) {
      return {
        skipped: true,
        reason: typeof ds.reason === 'string' ? ds.reason : undefined,
      };
    }
  }
  return { skipped: false };
};
/**
 * Get the output text summary from an agent run result.
 */
export const getAgentRunOutput = (run: AgentRun): string | null => {
  const firstResult = run.results?.[0]?.result;
  if (!firstResult) return null;

  try {
    const parsed = JSON.parse(firstResult);
    if (typeof parsed?.output === 'string' && parsed.output.trim()) return parsed.output;
    if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message;
  } catch {
    // Not JSON
  }

  return null;
};

/**
 * Extract the incident title from an agent run's original_input or execution_argument.
 * The input may contain embedded JSON with finding.title or title fields.
 */
export const getIncidentTitleFromRun = (run: AgentRun): string | null => {
  const sources = [
    run.results?.[0]?.result,
    run.execution_argument,
  ];

  for (const source of sources) {
    if (!source || typeof source !== 'string') continue;
    try {
      const parsed = JSON.parse(source);
      // Check nested original_input JSON
      const input = parsed?.original_input;
      if (input && typeof input === 'string') {
        const title = extractTitleFromText(input);
        if (title) return title;
      }
      // Direct title fields
      if (parsed?.finding?.title) return parsed.finding.title;
      if (parsed?.title) return parsed.title;
    } catch {
      // Try regex on raw text
      const title = extractTitleFromText(source);
      if (title) return title;
    }
  }

  return null;
};

/** Try to extract a title from raw datastore text */
const extractTitleFromText = (text: string): string | null => {
  // Look for JSON with finding.title or title
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj?.finding?.title) return obj.finding.title;
      if (obj?.title) return obj.title;
    } catch {
      // ignore
    }
  }
  // Look for "title": "..." pattern
  const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/);
  if (titleMatch) return titleMatch[1];
  return null;
};

/** Severity levels and their theme token mappings */
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown';

export interface SeverityInfo {
  level: IncidentSeverity;
  label: string;
  colorToken: string; // CSS variable name like --severity-critical
}

const SEVERITY_MAP: Record<IncidentSeverity, SeverityInfo> = {
  critical: { level: 'critical', label: 'Critical', colorToken: '--severity-critical' },
  high: { level: 'high', label: 'High', colorToken: '--severity-high' },
  medium: { level: 'medium', label: 'Medium', colorToken: '--severity-medium' },
  low: { level: 'low', label: 'Low', colorToken: '--severity-low' },
  info: { level: 'info', label: 'Info', colorToken: '--severity-info' },
  unknown: { level: 'unknown', label: 'Unknown', colorToken: '--muted-foreground' },
};

/**
 * Extract severity from an agent run's embedded incident data.
 * Looks for severity_id (OCSF), severity, or priority fields.
 */
export const getIncidentSeverityFromRun = (run: AgentRun): SeverityInfo => {
  const sources = [
    run.results?.[0]?.result,
    run.execution_argument,
  ];

  for (const source of sources) {
    if (!source || typeof source !== 'string') continue;
    try {
      const parsed = JSON.parse(source);
      const severity = extractSeverityFromObj(parsed);
      if (severity) return severity;
      // Check nested original_input
      if (parsed?.original_input && typeof parsed.original_input === 'string') {
        const jsonMatch = parsed.original_input.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const nested = JSON.parse(jsonMatch[0]);
            const sev = extractSeverityFromObj(nested);
            if (sev) return sev;
          } catch { /* ignore */ }
        }
        // Also try regex on raw original_input text
        const sev = extractSeverityFromText(parsed.original_input);
        if (sev) return sev;
      }
      // Check all result strings for nested severity
      if (typeof parsed === 'object' && parsed !== null) {
        const deepSev = deepFindSeverity(parsed);
        if (deepSev) return deepSev;
      }
    } catch {
      // Try regex on raw text
      const sev = extractSeverityFromText(source);
      if (sev) return sev;
    }
  }

  // Also check all results beyond the first
  if (run.results && run.results.length > 1) {
    for (let i = 1; i < run.results.length; i++) {
      const result = run.results[i]?.result;
      if (!result || typeof result !== 'string') continue;
      const sev = extractSeverityFromText(result);
      if (sev) return sev;
    }
  }

  return SEVERITY_MAP.unknown;
};

/** Recursively search an object for severity fields (max 3 levels deep) */
const deepFindSeverity = (obj: Record<string, any>, depth = 0): SeverityInfo | null => {
  if (depth > 3) return null;
  const direct = extractSeverityFromObj(obj);
  if (direct) return direct;
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sev = deepFindSeverity(val as Record<string, any>, depth + 1);
      if (sev) return sev;
    }
    if (typeof val === 'string' && val.includes('severity')) {
      const sev = extractSeverityFromText(val);
      if (sev) return sev;
    }
  }
  return null;
};

/** Extract severity from a parsed JSON object */
const extractSeverityFromObj = (obj: Record<string, any>): SeverityInfo | null => {
  // OCSF severity_id: 1=info, 2=low, 3=medium, 4=high, 5=critical
  const sevId = obj?.severity_id ?? obj?.finding?.severity_id;
  if (typeof sevId === 'number') {
    if (sevId >= 5) return SEVERITY_MAP.critical;
    if (sevId === 4) return SEVERITY_MAP.high;
    if (sevId === 3) return SEVERITY_MAP.medium;
    if (sevId === 2) return SEVERITY_MAP.low;
    if (sevId <= 1) return SEVERITY_MAP.info;
  }

  // String severity field
  const sevStr = (obj?.severity ?? obj?.finding?.severity ?? obj?.priority ?? '') as string;
  if (typeof sevStr === 'string' && sevStr) {
    return normalizeSeverity(sevStr);
  }

  return null;
};

/** Extract severity from raw text via regex */
const extractSeverityFromText = (text: string): SeverityInfo | null => {
  const match = text.match(/"(?:severity|priority)"\s*:\s*"([^"]+)"/i);
  if (match) return normalizeSeverity(match[1]);
  const idMatch = text.match(/"severity_id"\s*:\s*(\d)/);
  if (idMatch) {
    const id = parseInt(idMatch[1]);
    if (id >= 5) return SEVERITY_MAP.critical;
    if (id === 4) return SEVERITY_MAP.high;
    if (id === 3) return SEVERITY_MAP.medium;
    if (id === 2) return SEVERITY_MAP.low;
    return SEVERITY_MAP.info;
  }
  return null;
};

/** Normalize a severity string to our known levels */
const normalizeSeverity = (raw: string): SeverityInfo => {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('critical') || lower === '5' || lower === 'fatal') return SEVERITY_MAP.critical;
  if (lower.includes('high') || lower === '4' || lower === 'urgent') return SEVERITY_MAP.high;
  if (lower.includes('medium') || lower.includes('moderate') || lower === '3') return SEVERITY_MAP.medium;
  if (lower.includes('low') || lower === '2') return SEVERITY_MAP.low;
  if (lower.includes('info') || lower === '1' || lower === '0') return SEVERITY_MAP.info;
  return SEVERITY_MAP.unknown;
};
