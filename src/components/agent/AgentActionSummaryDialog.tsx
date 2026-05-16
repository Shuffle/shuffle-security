/**
 * Dialog showing a summary of what the AI agent was doing on an incident,
 * what went wrong or needs attention, and what the user should do next.
 */

import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogContent,
} from '@mui/material';
import { ArrowRight, AlertTriangle, CheckCircle, Clock, HelpCircle, XCircle, Search, X as CloseIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AgentRun } from '@/services/agentActivity';
import { getAgentRunOutput, getIncidentTitleFromRun, getIncidentSeverityFromRun, parseDatastoreReference, isIncidentReference } from '@/lib/agentParsers';
import { hasOutputWarning, getFailureInfo } from '@/components/agent/AgentRunResultViewer';
import { getRunTitle, getRunSubtitle, getTimeAgo, formatDuration } from '@/components/agent/AgentRunHeader';

interface Props {
  open: boolean;
  onClose: () => void;
  run: AgentRun | null;
  entityBasePath: string;
}

/** Get the full, untruncated AI description for the modal */
const getFullDescription = (run: AgentRun): string => {
  const status = run.status?.toUpperCase() || '';
  const output = getAgentRunOutput(run);
  const failureInfo = (status === 'FAILED' || status === 'ABORTED') ? getFailureInfo(run) : null;

  if (failureInfo?.reason) return failureInfo.reason;
  if (output) return output.replace(/[#*`]/g, '').trim();
  if (status === 'WAITING') return 'The AI agent is waiting for your approval before it can proceed.';
  return getRunSubtitle(run);
};

/** Get what the user needs to do */
const getUserAction = (run: AgentRun): { title: string; steps: string[]; type: 'approve' | 'investigate' | 'review' } => {
  const status = run.status?.toUpperCase() || '';

  if (status === 'WAITING') {
    return {
      title: 'Approve or Reject the Proposed Action',
      type: 'approve',
      steps: [
        'Review the AI agent\'s proposed action above.',
        'Open the incident to see full context and details.',
        'Approve the action to let the agent continue, or reject it to stop.',
      ],
    };
  }

  if (status === 'FAILED' || status === 'ABORTED') {
    return {
      title: 'Investigate and Resolve the Failure',
      type: 'investigate',
      steps: [
        'Review the error details above to understand what went wrong.',
        'Open the incident to manually complete the action the agent could not.',
        'If this is a recurring issue, check the agent permissions and configuration.',
      ],
    };
  }

  if (hasOutputWarning(run)) {
    return {
      title: 'Review and Confirm the Agent\'s Findings',
      type: 'review',
      steps: [
        'The agent flagged uncertainty in its output — review its analysis above.',
        'Open the incident to verify the findings against the actual data.',
        'Confirm or correct the agent\'s conclusions.',
      ],
    };
  }

  return {
    title: 'Review the Agent\'s Output',
    type: 'review',
    steps: [
      'Review what the agent did or is reporting.',
      'Open the incident for full details.',
    ],
  };
};

const getStatusConfig = (run: AgentRun) => {
  const status = run.status?.toUpperCase() || '';
  if (status === 'WAITING') return { icon: <Clock size={16} />, label: 'Waiting for Approval', color: '--severity-info' };
  if (status === 'FAILED') return { icon: <XCircle size={16} />, label: 'Failed', color: '--severity-critical' };
  if (status === 'ABORTED') return { icon: <XCircle size={16} />, label: 'Aborted', color: '--severity-critical' };
  if (hasOutputWarning(run)) return { icon: <HelpCircle size={16} />, label: 'Needs Review', color: '--severity-medium' };
  return { icon: <AlertTriangle size={16} />, label: 'Attention Required', color: '--severity-high' };
};

const AgentActionSummaryDialog = ({ open, onClose, run, entityBasePath }: Props) => {
  if (!run) return null;

  const title = getIncidentTitleFromRun(run) || getRunTitle(run);
  const severity = getIncidentSeverityFromRun(run);
  const effectiveSeverity = severity.level === 'unknown'
    ? { label: 'High', colorToken: '--severity-high' }
    : severity;
  const description = getFullDescription(run);
  const userAction = getUserAction(run);
  const statusCfg = getStatusConfig(run);
  const duration = formatDuration(run);
  const ref = parseDatastoreReference(run);
  const incidentKey = ref && isIncidentReference(ref) ? ref.key : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'hsl(var(--card))',
          backgroundImage: 'none',
          border: '1px solid hsl(var(--border))',
          borderRadius: 3,
          maxHeight: '85vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Header */}
        <Box sx={{
          px: 3,
          pt: 2.5,
          pb: 2,
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
        }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <Chip
                icon={statusCfg.icon}
                label={statusCfg.label}
                size="small"
                sx={{
                  height: 24,
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  backgroundColor: `hsl(var(${statusCfg.color}) / 0.12)`,
                  color: `hsl(var(${statusCfg.color}))`,
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
              <Chip
                label={effectiveSeverity.label}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  backgroundColor: `hsl(var(${effectiveSeverity.colorToken}) / 0.12)`,
                  color: `hsl(var(${effectiveSeverity.colorToken}))`,
                }}
              />
            </Box>
            <Typography sx={{
              fontWeight: 600,
              fontSize: '1.05rem',
              color: 'hsl(var(--foreground))',
              lineHeight: 1.3,
            }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', mt: 0.5 }}>
              {run.started_at ? getTimeAgo(run.started_at) : '—'}
              {duration && ` · ${duration}`}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))', mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* What the AI was doing */}
        <Box sx={{ px: 3, py: 2.5 }}>
          <Typography sx={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            mb: 1,
          }}>
            What the AI agent reported
          </Typography>
          <Box sx={{
            px: 2.5,
            py: 2,
            borderRadius: 2,
            backgroundColor: 'hsl(var(--muted) / 0.3)',
            border: '1px solid hsl(var(--border))',
          }}>
            <Typography sx={{
              fontSize: '0.85rem',
              color: 'hsl(var(--foreground))',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {description}
            </Typography>
          </Box>
        </Box>

        {/* What the user needs to do */}
        <Box sx={{
          px: 3,
          pb: 2.5,
        }}>
          <Typography sx={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            mb: 1,
          }}>
            What you need to do
          </Typography>
          <Box sx={{
            px: 2.5,
            py: 2,
            borderRadius: 2,
            backgroundColor: `hsl(var(${statusCfg.color}) / 0.06)`,
            border: `1px solid hsl(var(${statusCfg.color}) / 0.15)`,
          }}>
            <Typography sx={{
              fontSize: '0.88rem',
              fontWeight: 600,
              color: `hsl(var(${statusCfg.color}))`,
              mb: 1.5,
            }}>
              {userAction.title}
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
              {userAction.steps.map((step, i) => (
                <Box component="li" key={i} sx={{ mb: 0.75 }}>
                  <Typography sx={{
                    fontSize: '0.82rem',
                    color: 'hsl(var(--foreground))',
                    lineHeight: 1.5,
                  }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{
          px: 3,
          pb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          justifyContent: 'flex-end',
        }}>
          <Button
            onClick={onClose}
            size="small"
            sx={{
              fontSize: '0.8rem',
              textTransform: 'none',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            Close
          </Button>
          {incidentKey && (
            <Button
              component={Link}
              to={`${entityBasePath}/${incidentKey}?agent_action=${run.execution_id}`}
              size="small"
              variant="contained"
              endIcon={<ArrowRight size={14} />}
              onClick={onClose}
              sx={{
                fontSize: '0.8rem',
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                px: 2.5,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: 'hsl(var(--primary) / 0.9)',
                  boxShadow: 'none',
                },
              }}
            >
              Open Incident
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AgentActionSummaryDialog;
