/**
 * AgentRunDiagnosisBanner — shared "Needs attention / Failed" banner that
 * shows the same diagnosis (title, explanation, remediation, and evidence
 * paths) used by the timeline status pill (`AgentRunStatusBadge`) and the
 * inline `AgentRunResultViewer`. Drop this at the top of any surface that
 * displays a single agent run so the user sees identical reasoning
 * everywhere a run is opened.
 *
 * Returns `null` when the run has no failure and no output warning, so it
 * is safe to mount unconditionally above other content.
 */

import { Box, Typography } from '@mui/material';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import type { AgentRun } from '@/services/agentActivity';
import {
  diagnoseOutputWarning,
  getFailureInfo,
  hasOutputWarning,
} from '@/components/agent/AgentRunResultViewer';

interface Props {
  run: AgentRun | null;
}

const AgentRunDiagnosisBanner = ({ run }: Props) => {
  if (!run) return null;

  const status = (run.status || '').toUpperCase();
  const isFailed = status === 'FAILED' || status === 'ABORTED';
  const failureInfo = isFailed ? getFailureInfo(run) : null;
  const outputWarning = !isFailed && hasOutputWarning(run);
  const diagnosis = outputWarning ? diagnoseOutputWarning(run) : null;

  if (!failureInfo && !diagnosis) return null;

  return (
    <Box sx={{ px: 2.5, pb: 0.5 }}>
      {failureInfo && (
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

      {diagnosis && (
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
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'hsl(var(--severity-medium))',
              lineHeight: 1.4,
              mb: 0.25,
            }}>
              {diagnosis.title}
            </Typography>
            <Typography sx={{
              fontSize: '0.74rem',
              color: 'hsl(var(--foreground))',
              lineHeight: 1.5,
              mb: 0.5,
            }}>
              {diagnosis.explanation}
            </Typography>
            <Typography sx={{
              fontSize: '0.74rem',
              color: 'hsl(var(--foreground))',
              lineHeight: 1.5,
            }}>
              <Box component="span" sx={{ fontWeight: 600, color: 'hsl(var(--severity-medium))' }}>
                How to fix:
              </Box>{' '}
              {diagnosis.remediation}
            </Typography>
            {diagnosis.evidence && diagnosis.evidence.length > 0 && (
              <Box sx={{ mt: 0.75 }}>
                <Typography sx={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'hsl(var(--muted-foreground))',
                  mb: 0.5,
                }}>
                  Where this was found
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {diagnosis.evidence.map((ev, idx) => (
                    <Box
                      key={`${ev.path}-${idx}`}
                      sx={{
                        p: 0.75,
                        borderRadius: 0.5,
                        bgcolor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                      }}
                    >
                      <Typography sx={{
                        fontSize: '0.65rem',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                        color: 'hsl(var(--severity-medium))',
                        fontWeight: 600,
                        mb: 0.25,
                        wordBreak: 'break-all',
                      }}>
                        results[0].result.{ev.path || '(root)'}
                      </Typography>
                      <Typography sx={{
                        fontSize: '0.7rem',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                        color: 'hsl(var(--foreground))',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 80,
                        overflow: 'auto',
                      }}>
                        {ev.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AgentRunDiagnosisBanner;
