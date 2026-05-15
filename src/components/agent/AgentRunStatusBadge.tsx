/**
 * AgentRunStatusBadge — single source of truth for the small status pill
 * that appears next to an agent run anywhere in the app (incident timeline,
 * agent activity list, drawer header, etc.).
 *
 * Renders one of:
 *   • Skipped — agent did not run        (workflow condition prevented it)
 *   • Running…                            (live execution)
 *   • Failed — needs attention            (FAILED / ABORTED)
 *   • Needs attention — <reason>          (output diagnosed as a problem)
 *   • <statusCfg label>                   (clean success)
 *
 * Tooltip explains WHY the badge is showing what it is (diagnosis title +
 * explanation + remediation + WHERE in the result the evidence was found).
 *
 * Lives under `src/components/agent` so it can import the existing
 * diagnosis helpers; export it from any lib index that needs to reuse the
 * exact same look + behavior.
 */

import { Box, Typography, Tooltip } from '@mui/material';
import { AlertTriangle as AlertTriangleIcon, Loader2 as Loader2Icon } from 'lucide-react';
import type { AgentRun } from '@/services/agentActivity';
import {
  diagnoseOutputWarning,
  getFailureInfo,
  hasOutputWarning,
  type OutputDiagnosis,
} from '@/components/agent/AgentRunResultViewer';
import AgentDiagnosisCtas, { diagnosisHasCtas } from '@/Shuffle-MCPs/AgentDiagnosisCtas';

/** Same shape as the IncidentDetailPage helper — kept inline so consumers
 *  do not need to recreate it. */
export interface AgentSkipInfo {
  skipped: boolean;
  reason?: string;
}

export interface AgentRunStatusBadgeProps {
  run: AgentRun;
  /** Optional skip detection result. When `skipped: true`, a "Skipped" pill is rendered. */
  skip?: AgentSkipInfo;
  /** Optional fallback status config for the clean (non-warning) case. */
  statusCfg?: { label: string; color: string };
  /** Compact mode — slightly smaller font/padding for dense lists. */
  compact?: boolean;
  /** Cap for the warning pill width — used in narrow contexts (e.g. the
   *  Timeline sidebar) where the default 280px overflows the column. */
  maxWidth?: number;
}

const stripHttp = (title: string) => title.replace(/\s*\(HTTP \d+\)/i, '');

const buildTooltip = (
  failureReason: string | null,
  diagnosis: OutputDiagnosis | null,
): React.ReactNode => {
  if (failureReason) {
    return (
      <Box sx={{ maxWidth: 360, py: 0.25 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, mb: 0.5 }}>
          Action failed
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', lineHeight: 1.4, opacity: 0.95 }}>
          {failureReason}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', mt: 0.75, opacity: 0.7 }}>
          Click for full details and how to fix.
        </Typography>
      </Box>
    );
  }
  if (diagnosis) {
    return (
      <Box sx={{ maxWidth: 360, py: 0.25 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, mb: 0.5 }}>
          {diagnosis.title}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', lineHeight: 1.4, opacity: 0.95 }}>
          {diagnosis.explanation}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', lineHeight: 1.4, mt: 0.5 }}>
          <Box component="span" sx={{ fontWeight: 600 }}>How to fix: </Box>
          {diagnosis.remediation}
        </Typography>
        {diagnosis.evidence && diagnosis.evidence.length > 0 && (
          <Box sx={{ mt: 0.75, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <Typography sx={{ fontSize: '0.62rem', opacity: 0.75, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', mb: 0.25 }}>
              Where it was found
            </Typography>
            {diagnosis.evidence.slice(0, 2).map((ev, i) => (
              <Box key={`${ev.path}-${i}`} sx={{ mb: 0.25 }}>
                <Typography sx={{ fontSize: '0.65rem', fontFamily: 'ui-monospace, monospace', opacity: 0.85 }}>
                  results[0].result.{ev.path || '(root)'}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', fontFamily: 'ui-monospace, monospace', opacity: 0.7, wordBreak: 'break-word' }}>
                  {ev.value.length > 90 ? `${ev.value.slice(0, 90)}…` : ev.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        <Typography sx={{ fontSize: '0.65rem', mt: 0.75, opacity: 0.7 }}>
          Click for full details.
        </Typography>
        {diagnosisHasCtas(diagnosis) && (
          <Box sx={{ mt: 1, pt: 0.75, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <AgentDiagnosisCtas diagnosis={diagnosis} compact tone="medium" />
          </Box>
        )}
      </Box>
    );
  }
  return 'The agent completed but the output suggests it may need a human to review or assist. Click for details.';
};

const AgentRunStatusBadge = ({ run, skip, statusCfg, compact = false, maxWidth = 280 }: AgentRunStatusBadgeProps) => {
  const status = run.status?.toUpperCase() || '';
  const isFailed = status === 'FAILED' || status === 'ABORTED';
  const isRunning = status === 'EXECUTING' || status === 'RUNNING';
  const failureInfo = isFailed ? getFailureInfo(run) : null;
  const outputDiagnosis = !skip?.skipped && !isRunning && !isFailed && hasOutputWarning(run)
    ? diagnoseOutputWarning(run)
    : null;
  const hasWarning = !skip?.skipped && (isFailed || !!outputDiagnosis);

  const fontSize = compact ? '0.7rem' : '0.72rem';
  const px = compact ? 0.75 : 1;

  if (skip?.skipped) {
    return (
      <Tooltip title={skip.reason || 'A workflow condition prevented the AI Agent from running.'} arrow>
        <Typography
          sx={{
            fontSize,
            color: 'hsl(var(--muted-foreground))',
            flexShrink: 0,
            fontStyle: 'italic',
            border: '1px solid hsl(var(--border))',
            borderRadius: 999,
            px,
            py: 0.1,
          }}
        >
          Skipped — agent did not run
        </Typography>
      </Tooltip>
    );
  }

  if (isRunning) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        <Loader2Icon size={11} className="animate-spin" style={{ color: 'hsl(var(--severity-medium))' }} />
        <Typography sx={{ fontSize, color: 'hsl(var(--severity-medium))' }}>
          Running…
        </Typography>
      </Box>
    );
  }

  if (hasWarning) {
    const label = failureInfo
      ? 'Failed — needs attention'
      : outputDiagnosis
        ? `Needs attention — ${stripHttp(outputDiagnosis.title)}`
        : 'Completed — needs attention';

    return (
      <Tooltip title={buildTooltip(failureInfo?.reason ?? null, outputDiagnosis)} arrow placement="top">
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            flexShrink: 0,
            border: '1px solid hsl(var(--severity-medium) / 0.5)',
            bgcolor: 'hsl(var(--severity-medium) / 0.12)',
            borderRadius: 999,
            px,
            py: 0.1,
            maxWidth,
          }}
        >
          <AlertTriangleIcon size={11} style={{ color: 'hsl(var(--severity-medium))', flexShrink: 0 }} />
          <Typography
            sx={{
              fontSize,
              color: 'hsl(var(--severity-medium))',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  if (statusCfg) {
    return (
      <Typography sx={{ fontSize, color: statusCfg.color, flexShrink: 0 }}>
        {statusCfg.label}
      </Typography>
    );
  }

  return null;
};

export default AgentRunStatusBadge;
