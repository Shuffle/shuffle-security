/**
 * Expandable result viewer for an agent execution run.
 * Parses and renders JSON from results[0].result.
 */

import { useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
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
    // Sometimes the reason is nested differently
    if (parsed.message) return { reason: parsed.message };
    if (parsed.error) return { reason: typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error) };
  }

  return null;
};

interface AgentRunResultViewerProps {
  run: AgentRun;
}

const AgentRunResultViewer = ({ run }: AgentRunResultViewerProps) => {
  const [expanded, setExpanded] = useState(false);
  const { raw, parsed } = parseRunResult(run);

  if (!raw) {
    return (
      <Box sx={{ px: 2.5, py: 1.5 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
          No result data available
        </Typography>
      </Box>
    );
  }

  const displayJson = parsed ? JSON.stringify(parsed, null, 2) : raw;
  const isFailed = run.status?.toUpperCase() === 'FAILED' || run.status?.toUpperCase() === 'ABORTED';
  const failureInfo = getFailureInfo(run);

  return (
    <Box sx={{ px: 2.5, pb: 2, pt: 0.5 }}>
      {/* Failure reason banner */}
      {isFailed && failureInfo && (
        <Box sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          px: 1.5,
          py: 1,
          mb: 1,
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

      {/* Toggle for full JSON */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          userSelect: 'none',
          color: 'hsl(var(--muted-foreground))',
          '&:hover': { color: 'hsl(var(--foreground))' },
          transition: 'color 0.15s ease',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 500 }}>
          {expanded ? 'Hide result' : 'View result'}
        </Typography>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{
          mt: 1,
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'hsl(var(--muted))',
          border: '1px solid hsl(var(--border))',
          maxHeight: 320,
          overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'hsl(var(--muted-foreground) / 0.3)',
            borderRadius: 3,
          },
        }}>
          <pre style={{
            margin: 0,
            fontSize: '0.72rem',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            color: 'hsl(var(--foreground))',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}>
            {displayJson}
          </pre>
        </Box>
      </Collapse>
    </Box>
  );
};

export default AgentRunResultViewer;
