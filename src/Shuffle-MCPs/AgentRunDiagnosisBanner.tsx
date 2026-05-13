/**
 * AgentRunDiagnosisBanner — shared "Needs attention / Failed" banner that
 * shows the same diagnosis (title, explanation, remediation, and the FIRST
 * piece of evidence) used everywhere a single agent run is displayed.
 *
 * Returns `null` when the run has no failure and no output warning, so it
 * is safe to mount unconditionally above other content.
 */

import { Box, Tooltip, Typography } from '@mui/material';
import { AlertTriangle, ArrowUpRight, HelpCircle } from 'lucide-react';
import {
  diagnoseOutputWarning,
  extractDecisionIndex,
  getFailureInfo,
  hasOutputWarning,
  type DiagnosableRun,
} from './agentDiagnosis';

interface Props {
  run: DiagnosableRun | null | undefined;
  /** Outer padding wrapper. Defaults to `{ px: 2.5, pb: 0.5 }`. */
  sx?: Record<string, unknown>;
  /** When provided, the "Where this was found" evidence box becomes a button
   *  that asks the host to jump to the underlying decision (e.g. switch to
   *  the detailed timeline, expand that row, scroll to it). The decision
   *  index is the original index in `agentData.decisions`. */
  onJumpToEvidence?: (decisionIndex: number) => void;
}

const AgentRunDiagnosisBanner = ({ run, sx, onJumpToEvidence }: Props) => {
  if (!run) return null;

  const status = (run.status || '').toUpperCase();
  const isFailed = status === 'FAILED' || status === 'ABORTED';
  const failureInfo = isFailed ? getFailureInfo(run) : null;
  const outputWarning = !isFailed && hasOutputWarning(run);
  const diagnosis = outputWarning ? diagnoseOutputWarning(run) : null;

  if (!failureInfo && !diagnosis) return null;

  // Show only the FIRST evidence entry — repeated identical errors are noise.
  const firstEvidence = diagnosis?.evidence?.[0] || null;
  const jumpDecisionIndex = firstEvidence ? extractDecisionIndex(firstEvidence.path) : null;
  const canJump = !!(onJumpToEvidence && jumpDecisionIndex !== null);

  return (
    <Box sx={{ px: 2.5, pb: 0.5, ...(sx || {}) }}>
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
            {firstEvidence && (
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
                <Tooltip title={canJump ? 'Open this decision in the detailed timeline' : ''} placement="top" arrow>
                  <Box
                    {...(canJump
                      ? {
                          role: 'button' as const,
                          tabIndex: 0,
                          onClick: () => onJumpToEvidence!(jumpDecisionIndex!),
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onJumpToEvidence!(jumpDecisionIndex!);
                            }
                          },
                        }
                      : {})}
                    sx={{
                      p: 0.75,
                      borderRadius: 0.5,
                      bgcolor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      position: 'relative',
                      cursor: canJump ? 'pointer' : 'default',
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                      ...(canJump && {
                        '&:hover': {
                          borderColor: 'hsl(var(--severity-medium))',
                          bgcolor: 'hsla(var(--severity-medium) / 0.04)',
                        },
                        '&:focus-visible': {
                          outline: 'none',
                          borderColor: 'hsl(var(--severity-medium))',
                          boxShadow: '0 0 0 2px hsla(var(--severity-medium) / 0.25)',
                        },
                      }),
                    }}
                  >
                    {canJump && (
                      <ArrowUpRight
                        size={12}
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          color: 'hsl(var(--muted-foreground))',
                        }}
                      />
                    )}
                    <Typography sx={{
                      fontSize: '0.65rem',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                      color: 'hsl(var(--severity-medium))',
                      fontWeight: 600,
                      mb: 0.25,
                      wordBreak: 'break-all',
                      pr: canJump ? 2 : 0,
                    }}>
                      results[0].result.{firstEvidence.path || '(root)'}
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
                      {firstEvidence.value}
                    </Typography>
                    {canJump && (
                      <Typography sx={{
                        mt: 0.5,
                        fontSize: '0.65rem',
                        color: 'hsl(var(--severity-medium))',
                        fontWeight: 600,
                      }}>
                        Open Decision #{(jumpDecisionIndex ?? 0) + 1} in detailed timeline →
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AgentRunDiagnosisBanner;
