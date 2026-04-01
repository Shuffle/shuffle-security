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
 * Get agent runs that reference a specific incident key.
 */
export const getAgentRunsForIncident = (
  runs: AgentRun[],
  incidentKey: string
): AgentRun[] => {
  return runs.filter((run) => {
    const ref = parseDatastoreReference(run);
    return ref && isIncidentReference(ref) && ref.key === incidentKey;
  });
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
