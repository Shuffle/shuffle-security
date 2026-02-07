/**
 * Expandable result viewer for an agent execution run.
 * Parses and renders JSON from results[0].result using react18-json-view.
 */

import { Box, Typography } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import 'react18-json-view/src/dark.css';
import { AgentRun } from '@/services/agentActivity';

/** Try to parse the result JSON from results[0].result */
export const parseRunResult = (run: AgentRun): { raw: string | null; parsed: any | null } => {
  const firstResult = run.results?.[0]?.result;
  if (!firstResult) return { raw: null, parsed: null };

  try {
    return { raw: firstResult, parsed: JSON.parse(firstResult) };
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

/** Check if a run's result matches a search query */
export const runMatchesSearch = (run: AgentRun, query: string): boolean => {
  const q = query.toLowerCase();

  // Search basic fields
  if (
    run.execution_id?.toLowerCase().includes(q) ||
    run.status?.toLowerCase().includes(q) ||
    run.execution_argument?.toLowerCase().includes(q) ||
    run.execution_source?.toLowerCase().includes(q) ||
    run.workflow?.name?.toLowerCase().includes(q)
  ) return true;

  // Search through results
  if (run.results) {
    for (const r of run.results) {
      if (r.result?.toLowerCase().includes(q)) return true;
      if (r.action?.app_name?.toLowerCase().includes(q)) return true;
      if (r.action?.label?.toLowerCase().includes(q)) return true;
    }
  }

  return false;
};

interface AgentRunResultViewerProps {
  run: AgentRun;
}

const AgentRunResultViewer = ({ run }: AgentRunResultViewerProps) => {
  const { raw, parsed } = parseRunResult(run);
  const isFailed = run.status?.toUpperCase() === 'FAILED' || run.status?.toUpperCase() === 'ABORTED';
  const failureInfo = getFailureInfo(run);

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

      {/* JSON viewer */}
      <Box sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'hsl(var(--muted))',
        border: '1px solid hsl(var(--border))',
        maxHeight: 400,
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
    </Box>
  );
};

export default AgentRunResultViewer;
