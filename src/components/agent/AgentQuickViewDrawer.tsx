/**
 * Quick View Drawer — slides in from the right to show notification or run details,
 * with Approve / Configure actions for approvals, and findings/resolution for completed runs.
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Drawer,
  TextField,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CheckCircle, Settings, ArrowRight, Clock, AlertTriangle, HelpCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AgentNotification } from '@/services/notifications';
import type { AgentRun } from '@/services/agentActivity';
import {
  parseDatastoreReference,
  isIncidentReference,
  getAgentRunOutput,
  getIncidentTitleFromRun,
  getIncidentSeverityFromRun,
} from '@/lib/agentParsers';
import { hasOutputWarning, getFailureInfo } from '@/components/agent/AgentRunResultViewer';
import { getTimeAgo, formatDuration } from '@/components/agent/AgentRunHeader';

export type QuickViewItem =
  | { type: 'notification'; notification: AgentNotification }
  | { type: 'run'; run: AgentRun };

interface Props {
  open: boolean;
  onClose: () => void;
  item: QuickViewItem | null;
  entityBasePath: string;
  onApprove?: (notification: AgentNotification) => void;
  onConfigureApprove?: (notificationId: string, modifiedAction?: string) => void;
}

const AgentQuickViewDrawer = ({ open, onClose, item, entityBasePath, onApprove, onConfigureApprove }: Props) => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [modifiedAction, setModifiedAction] = useState('');

  if (!item) return null;

  const handleClose = () => {
    setIsConfiguring(false);
    setModifiedAction('');
    onClose();
  };

  // ── Notification (approval) view ──
  if (item.type === 'notification') {
    const notification = item.notification;
    const actionDescription = notification.action || notification.description || '';
    const timeAgo = notification.created_at
      ? new Date(notification.created_at * 1000).toLocaleString()
      : '—';
    const incidentId = notification.incident_id || notification.reference_url;

    const handleApprove = () => {
      onApprove?.(notification);
      handleClose();
    };

    const handleConfigureSubmit = () => {
      onConfigureApprove?.(notification.id, modifiedAction);
      setModifiedAction('');
      setIsConfiguring(false);
      onClose();
    };

    return (
      <Drawer anchor="right" open={open} onClose={handleClose} PaperProps={{ sx: drawerPaperSx }}>
        <DrawerHeader onClose={handleClose} />
        <Box sx={{ px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflow: 'auto' }}>
          {/* Title */}
          <Box>
            <SectionLabel>Title</SectionLabel>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.5 }}>
              {notification.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              {notification.severity && (
                <Chip label={notification.severity} size="small" sx={severityChipSx} />
              )}
              <Chip
                icon={<Clock size={12} />}
                label="Approval Needed"
                size="small"
                sx={infoChipSx}
              />
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', mt: 1 }}>
              {timeAgo}
            </Typography>
          </Box>

          {/* Description */}
          {notification.description && (
            <Box>
              <SectionLabel>What Happened</SectionLabel>
              <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {notification.description}
              </Typography>
            </Box>
          )}

          {/* Proposed action */}
          {notification.action && (
            <Box>
              <SectionLabel>Proposed Action</SectionLabel>
              <Box sx={actionBoxSx}>
                <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {notification.action}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Configure section */}
          {isConfiguring && (
            <Box>
              <SectionLabel>Modify Action</SectionLabel>
              <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', mb: 1.5 }}>
                Provide an alternative action for the agent to execute instead.
              </Typography>
              <TextField
                fullWidth multiline minRows={3} maxRows={6}
                placeholder="Describe the modified action…"
                value={modifiedAction}
                onChange={(e) => setModifiedAction(e.target.value)}
                sx={textFieldSx}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <Button onClick={() => { setIsConfiguring(false); setModifiedAction(''); }} size="small"
                  sx={{ fontSize: '0.78rem', textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}>
                  Cancel
                </Button>
                <Button onClick={handleConfigureSubmit} size="small" variant="contained" disabled={!modifiedAction.trim()}
                  startIcon={<Settings size={14} />}
                  sx={{ fontSize: '0.78rem', textTransform: 'none', fontWeight: 600, backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', boxShadow: 'none', '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)', boxShadow: 'none' } }}>
                  Submit Modified Action
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={footerSx}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleApprove} fullWidth variant="contained" startIcon={<CheckCircle size={15} />}
              sx={{ ...approveButtonSx }}>
              Approve
            </Button>
            {!isConfiguring && (
              <Button onClick={() => setIsConfiguring(true)} fullWidth variant="outlined" startIcon={<Settings size={15} />}
                sx={outlineButtonSx}>
                Configure
              </Button>
            )}
          </Box>
          {incidentId && (
            <Button component={Link} to={`${entityBasePath}/${notification.incident_id}`} fullWidth variant="outlined"
              endIcon={<ArrowRight size={14} />} sx={outlineButtonSx}>
              View Full Incident
            </Button>
          )}
        </Box>
      </Drawer>
    );
  }

  // ── Run view (failed/unsure or completed) ──
  const run = item.run;
  const status = run.status?.toUpperCase() || '';
  const runFailed = status === 'FAILED' || status === 'ABORTED';
  const isUnsure = hasOutputWarning(run);
  const isCompleted = status === 'FINISHED' || status === 'SUCCESS';
  const incidentTitle = getIncidentTitleFromRun(run);
  const output = getAgentRunOutput(run);
  const failureInfo = runFailed ? getFailureInfo(run) : null;
  const severity = getIncidentSeverityFromRun(run);
  const duration = formatDuration(run);
  const ref = parseDatastoreReference(run);
  const incidentKey = ref && isIncidentReference(ref) ? ref.key : null;
  const timeAgo = run.started_at ? getTimeAgo(run.started_at) : '—';

  // For completed runs, extract the clean output as findings
  const findings = output ? output.replace(/[#*`]/g, '').trim() : null;
  const failureReason = failureInfo?.reason || (runFailed && output ? output.replace(/[#*`]/g, '').trim() : null);

  return (
    <Drawer anchor="right" open={open} onClose={handleClose} PaperProps={{ sx: drawerPaperSx }}>
      <DrawerHeader onClose={handleClose} />
      <Box sx={{ px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflow: 'auto' }}>
        {/* Title */}
        <Box>
          <SectionLabel>Title</SectionLabel>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.5 }}>
            {incidentTitle || run.workflow?.name || 'Agent Run'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Chip label={severity.label} size="small"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, backgroundColor: `hsl(var(${severity.colorToken}) / 0.12)`, color: `hsl(var(${severity.colorToken}))` }} />
            {runFailed && (
              <Chip icon={<XCircle size={12} />} label={status === 'ABORTED' ? 'Aborted' : 'Failed'} size="small"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, backgroundColor: 'hsl(var(--severity-critical) / 0.12)', color: 'hsl(var(--severity-critical))', '& .MuiChip-icon': { color: 'inherit' } }} />
            )}
            {isUnsure && (
              <Chip icon={<HelpCircle size={12} />} label="Unsure" size="small"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, backgroundColor: 'hsl(var(--severity-medium) / 0.12)', color: 'hsl(var(--severity-medium))', '& .MuiChip-icon': { color: 'inherit' } }} />
            )}
            {isCompleted && (
              <Chip icon={<CheckCircle size={12} />} label="Resolved" size="small"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, backgroundColor: 'hsl(var(--severity-low) / 0.12)', color: 'hsl(var(--severity-low))', '& .MuiChip-icon': { color: 'inherit' } }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>{timeAgo}</Typography>
            {duration && (
              <>
                <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', opacity: 0.4 }}>·</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>{duration}</Typography>
              </>
            )}
          </Box>
        </Box>

        {/* Failure reason (for failed/unsure) */}
        {(runFailed || isUnsure) && failureReason && (
          <Box>
            <SectionLabel>{runFailed ? 'Failure Reason' : 'Issue Detected'}</SectionLabel>
            <Box sx={{
              px: 2.5, py: 2, borderRadius: 2,
              backgroundColor: 'hsl(var(--severity-critical) / 0.06)',
              border: '1px solid hsl(var(--severity-critical) / 0.15)',
            }}>
              <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {failureReason}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Action taken (for completed runs) */}
        {isCompleted && run.workflow?.name && (
          <Box>
            <SectionLabel>Action Taken</SectionLabel>
            <Box sx={actionBoxSx}>
              <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', lineHeight: 1.6 }}>
                Executed workflow "{run.workflow.name}"
                {run.workflow?.actions?.length ? ` (${run.workflow.actions.length} actions)` : ''}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Findings / Resolution */}
        {findings && (
          <Box>
            <SectionLabel>{isCompleted ? 'Findings & Resolution' : 'Agent Output'}</SectionLabel>
            <Typography sx={{
              fontSize: '0.85rem', color: 'hsl(var(--foreground))', lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {findings}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={footerSx}>
        {incidentKey && (
          <Button component={Link} to={`${entityBasePath}/${incidentKey}?agent_action=${run.execution_id}`}
            fullWidth variant="outlined" endIcon={<ArrowRight size={14} />} sx={outlineButtonSx}>
            View Full Incident
          </Button>
        )}
      </Box>
    </Drawer>
  );
};

// ── Shared sub-components & styles ──

const DrawerHeader = ({ onClose }: { onClose: () => void }) => (
  <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>Quick View</Typography>
    <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
      <CloseIcon fontSize="small" />
    </IconButton>
  </Box>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{
    fontSize: '0.72rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))',
    textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.75,
  }}>
    {children}
  </Typography>
);

const drawerPaperSx = {
  width: { xs: '100%', sm: 440 },
  bgcolor: 'hsl(var(--background))',
  backgroundImage: 'none',
  borderLeft: '1px solid hsl(var(--border))',
};

const actionBoxSx = {
  px: 2.5, py: 2, borderRadius: 2,
  backgroundColor: 'hsl(var(--severity-info) / 0.06)',
  border: '1px solid hsl(var(--severity-info) / 0.15)',
};

const severityChipSx = {
  height: 20, fontSize: '0.68rem', fontWeight: 600,
  backgroundColor: 'hsl(var(--severity-high) / 0.12)',
  color: 'hsl(var(--severity-high))',
};

const infoChipSx = {
  height: 20, fontSize: '0.68rem', fontWeight: 600,
  backgroundColor: 'hsl(var(--severity-info) / 0.12)',
  color: 'hsl(var(--severity-info))',
  '& .MuiChip-icon': { color: 'inherit' },
};

const footerSx = {
  px: 3, py: 2.5, borderTop: '1px solid hsl(var(--border))',
  display: 'flex', flexDirection: 'column', gap: 1.5,
};

const approveButtonSx = {
  fontSize: '0.8rem', textTransform: 'none', fontWeight: 600,
  backgroundColor: 'hsl(var(--severity-low))',
  color: 'hsl(var(--primary-foreground))',
  py: 1, boxShadow: 'none',
  '&:hover': { backgroundColor: 'hsl(var(--severity-low) / 0.9)', boxShadow: 'none' },
};

const outlineButtonSx = {
  fontSize: '0.8rem', textTransform: 'none', fontWeight: 500,
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--foreground))',
  py: 1,
  '&:hover': { borderColor: 'hsl(var(--primary) / 0.5)', backgroundColor: 'hsl(var(--primary) / 0.08)' },
};

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    fontSize: '0.85rem', bgcolor: 'hsl(var(--card))',
    '& fieldset': { borderColor: 'hsl(var(--border))' },
    '&:hover fieldset': { borderColor: 'hsl(var(--primary) / 0.5)' },
    '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
  },
  '& .MuiOutlinedInput-input': { color: 'hsl(var(--foreground))' },
};

export default AgentQuickViewDrawer;
