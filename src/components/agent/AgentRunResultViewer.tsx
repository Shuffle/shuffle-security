/**
 * Expandable result viewer for an agent execution run.
 * Renders output as Markdown + JSON from results[0].result using react18-json-view.
 */

import { Box, Typography, Collapse } from '@mui/material';
import { useState } from 'react';
import { AlertTriangle, HelpCircle, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import 'react18-json-view/src/dark.css';
import { AgentRun } from '@/services/agentActivity';
import { parseDatastoreReference, DatastoreReference } from '@/lib/agentParsers';
export type { DatastoreReference };

/**
 * Recursively parse string values that look like JSON into actual objects.
 * This handles cases where the API returns nested JSON-as-string fields (e.g. "input", "messages").
 */
const deepParseJsonStrings = (obj: any, depth = 0): any => {
  if (depth > 5) return obj;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        // Only promote if we got an object/array (not a plain string)
        if (typeof parsed === 'object' && parsed !== null) {
          return deepParseJsonStrings(parsed, depth + 1);
        }
        return parsed;
      } catch {
        return obj;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(item => deepParseJsonStrings(item, depth + 1));
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepParseJsonStrings(value, depth + 1);
    }
    return result;
  }
  return obj;
};

/** Try to parse the result JSON from results[0].result, unwrapping AGENT-type executions */
export const parseRunResult = (run: AgentRun): { raw: string | null; parsed: any | null } => {
  const firstResult = run.results?.[0]?.result;
  if (!firstResult) return { raw: null, parsed: null };

  try {
    let parsed = JSON.parse(firstResult);

    // If the result is an AGENT-type execution wrapper, unwrap to the inner result
    if (parsed && typeof parsed === 'object' && parsed.type === 'AGENT' && Array.isArray(parsed.results) && parsed.results.length > 0) {
      const innerResult = parsed.results[0]?.result;
      if (innerResult) {
        try {
          parsed = JSON.parse(innerResult);
        } catch {
          return { raw: innerResult, parsed: null };
        }
      }
    }

    // Deep-parse any JSON strings nested inside the result
    const deepParsed = deepParseJsonStrings(parsed);

    return { raw: firstResult, parsed: deepParsed };
  } catch {
    return { raw: firstResult, parsed: null };
  }
};

/** Extract failure info (success + reason) from a failed/aborted run */
export const getFailureInfo = (run: AgentRun): { reason: string } | null => {
  const status = run.status?.toUpperCase();
  if (status !== 'FAILED' && status !== 'ABORTED') return null;

  const { parsed } = parseRunResult(run);
  if (parsed && typeof parsed === 'object') {
    if (parsed.success === false && parsed.reason) {
      return { reason: parsed.reason };
    }
    if (parsed.message) return { reason: parsed.message };
    if (parsed.error) return { reason: typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error) };
  }

  return null;
};

/** Detect if the output content hints at an error/failure even if the run status is "finished" */
export const hasOutputWarning = (run: AgentRun): boolean => {
  const { parsed } = parseRunResult(run);
  if (!parsed || typeof parsed !== 'object') return false;

  // Explicit success: false
  if (parsed.success === false) return true;

  // Check the output string for error keywords
  const output = typeof parsed.output === 'string' ? parsed.output.toLowerCase() : '';
  if (!output) return false;

  const errorPatterns = ['error', 'failed', 'failure', 'exception', 'timed out', 'timeout', 'unauthorized', 'forbidden', 'not found', 'could not'];
  return errorPatterns.some(p => output.includes(p));
};

/** Check if a run's result matches a search query */
export const runMatchesSearch = (run: AgentRun, query: string): boolean => {
  const q = query.toLowerCase();

  if (
    run.execution_id?.toLowerCase().includes(q) ||
    run.status?.toLowerCase().includes(q) ||
    run.execution_argument?.toLowerCase().includes(q) ||
    run.execution_source?.toLowerCase().includes(q) ||
    run.workflow?.name?.toLowerCase().includes(q)
  ) return true;

  if (run.results) {
    for (const r of run.results) {
      if (r.result?.toLowerCase().includes(q)) return true;
      if (r.action?.app_name?.toLowerCase().includes(q)) return true;
      if (r.action?.label?.toLowerCase().includes(q)) return true;
    }
  }

  return false;
};

/** Extract the output/description text from a run result */
const getOutputText = (parsed: any): string | null => {
  if (!parsed || typeof parsed !== 'object') return null;
  if (typeof parsed.output === 'string' && parsed.output.trim()) return parsed.output;
  if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
  return null;
};

// parseDatastoreReference and DatastoreReference are now imported from @/lib/agentParsers
export { parseDatastoreReference };

/** Get a link path if the reference is to a known entity */
const getReferencePath = (ref: DatastoreReference): string | null => {
  if (ref.category === 'shuffle-security_incidents') {
    return `/incidents/${ref.key}`;
  }
  return null;
};

interface AgentRunResultViewerProps {
  run: AgentRun;
}

const AgentRunResultViewer = ({ run }: AgentRunResultViewerProps) => {
  const { raw, parsed } = parseRunResult(run);
  const isFailed = run.status?.toUpperCase() === 'FAILED' || run.status?.toUpperCase() === 'ABORTED';
  const failureInfo = getFailureInfo(run);
  const outputWarning = !isFailed && hasOutputWarning(run);
  const outputText = getOutputText(parsed);
  const datastoreRef = parseDatastoreReference(run);
  const refPath = datastoreRef ? getReferencePath(datastoreRef) : null;
  const [debugOpen, setDebugOpen] = useState(false);

  if (!raw) {
    return (
      <Box sx={{ px: 2.5, py: 1.5 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
          No result data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2.5, pb: 2, pt: 1 }}>
      {/* Failure reason banner */}
      {isFailed && failureInfo && (
        <Box sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          px: 1.5,
          py: 1,
          mb: 1.5,
          borderRadius: 1,
          bgcolor: 'hsla(var(--severity-critical) / 0.08)',
          border: '1px solid hsla(var(--severity-critical) / 0.2)',
        }}>
          <AlertTriangle size={14} style={{ color: 'hsl(var(--severity-critical))', marginTop: 2, flexShrink: 0 }} />
          <Typography sx={{
            fontSize: '0.78rem',
            color: 'hsl(var(--severity-critical))',
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}>
            {failureInfo.reason}
          </Typography>
        </Box>
      )}

      {/* Output warning banner (unsure / needs review) */}
      {outputWarning && (
        <Box sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          px: 1.5,
          py: 1,
          mb: 1.5,
          borderRadius: 1,
          bgcolor: 'hsla(var(--severity-medium) / 0.08)',
          border: '1px solid hsla(var(--severity-medium) / 0.2)',
        }}>
          <HelpCircle size={14} style={{ color: 'hsl(var(--severity-medium))', marginTop: 2, flexShrink: 0 }} />
          <Typography sx={{
            fontSize: '0.78rem',
            color: 'hsl(var(--severity-medium))',
            lineHeight: 1.5,
          }}>
            This result may need review — the output contains error indicators
          </Typography>
        </Box>
      )}

      {/* Datastore reference link */}
      {datastoreRef && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          mb: 1.5,
          borderRadius: 1,
          bgcolor: 'hsla(var(--primary) / 0.06)',
          border: '1px solid hsla(var(--primary) / 0.15)',
        }}>
          {refPath ? (
            <Link
              to={refPath}
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ExternalLink size={13} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
              <Typography sx={{
                fontSize: '0.78rem',
                color: 'hsl(var(--primary))',
                fontWeight: 500,
                '&:hover': { textDecoration: 'underline' },
              }}>
                Incident {datastoreRef.key.slice(0, 12)}…
              </Typography>
            </Link>
          ) : (
            <>
              <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                {datastoreRef.category}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7, fontFamily: 'monospace' }}>
                {datastoreRef.key.slice(0, 16)}…
              </Typography>
            </>
          )}
        </Box>
      )}

      {/* Output as rendered Markdown */}
      {outputText && (
        <Box sx={{
          mb: 1.5,
          px: 0.5,
          '& p': {
            fontSize: '0.82rem',
            color: 'hsl(var(--foreground))',
            lineHeight: 1.65,
            m: 0,
            mb: 0.5,
          },
          '& p:last-child': { mb: 0 },
          '& a': {
            color: 'hsl(var(--primary))',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          },
          '& code': {
            fontSize: '0.75rem',
            bgcolor: 'hsl(var(--muted))',
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          },
          '& pre': {
            bgcolor: 'hsl(var(--muted))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 1,
            p: 1.5,
            overflow: 'auto',
            '& code': { bgcolor: 'transparent', p: 0 },
          },
          '& ul, & ol': {
            fontSize: '0.82rem',
            color: 'hsl(var(--foreground))',
            pl: 2.5,
            m: 0,
            mb: 0.5,
          },
          '& li': { mb: 0.25 },
          '& blockquote': {
            borderLeft: '3px solid hsl(var(--border))',
            pl: 1.5,
            ml: 0,
            color: 'hsl(var(--muted-foreground))',
            fontStyle: 'italic',
          },
          '& h1, & h2, & h3, & h4': {
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            mt: 1,
            mb: 0.5,
          },
        }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {outputText}
          </ReactMarkdown>
        </Box>
      )}

      {/* DEBUG section — collapsed by default; contains raw JSON viewer */}
      <Box sx={{ mt: 1 }}>
        <Box
          onClick={() => setDebugOpen((v) => !v)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            cursor: 'pointer',
            userSelect: 'none',
            px: 0.5,
            py: 0.5,
            borderRadius: 0.75,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))' },
          }}
        >
          {debugOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Typography sx={{
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Debug
          </Typography>
        </Box>
        <Collapse in={debugOpen} unmountOnExit>
          <Box sx={{
            mt: 0.75,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'hsl(var(--muted))',
            border: '1px solid hsl(var(--border))',
            overflow: 'auto',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'hsl(var(--muted-foreground) / 0.3)',
              borderRadius: 3,
            },
            '& .json-view': {
              fontSize: '0.75rem !important',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace !important',
              bgcolor: 'transparent !important',
            },
          }}>
            {parsed ? (
              <JsonView
                src={parsed}
                dark
                collapsed={2}
                collapseStringMode="word"
                collapseStringsAfterLength={120}
                enableClipboard
                displaySize
              />
            ) : (
              <pre style={{
                margin: 0,
                fontSize: '0.72rem',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                color: 'hsl(var(--foreground))',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6,
              }}>
                {raw}
              </pre>
            )}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

export default AgentRunResultViewer;
