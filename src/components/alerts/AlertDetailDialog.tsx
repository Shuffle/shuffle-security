import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { OCSFDetection } from './CreateAlertDialog';

interface DisplayAlert {
  id: string;
  title: string;
  source: string;
  severity: string;
  status: string;
  assignee: string | null;
  created: string;
  isDummy?: boolean;
  rawOCSF?: OCSFDetection;
}

interface AlertDetailDialogProps {
  open: boolean;
  alert: DisplayAlert | null;
  onClose: () => void;
  onResolve: (alertId: string) => Promise<void>;
}

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  informational: '#3b82f6',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  new: { bg: 'rgba(34, 184, 207, 0.15)', text: '#22b8cf' },
  escalated: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  resolved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
};

export const AlertDetailDialog = ({ open, alert, onClose, onResolve }: AlertDetailDialogProps) => {
  if (!alert) return null;

  const isResolved = alert.status === 'resolved';

  const handleResolve = async () => {
    await onResolve(alert.id);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Alert Details
            </Typography>
            {alert.isDummy && (
              <Chip
                label="Demo"
                size="small"
                sx={{
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                  color: '#a78bfa',
                }}
              />
            )}
          </Box>
          <Chip
            label={alert.status.replace('_', ' ')}
            size="small"
            sx={{
              backgroundColor: statusColors[alert.status]?.bg || 'rgba(148, 163, 184, 0.1)',
              color: statusColors[alert.status]?.text || '#94a3b8',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Header Info */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              {alert.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ID: {alert.id}
            </Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)' }} />

          {/* Details Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Severity
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: severityColors[alert.severity] || '#94a3b8',
                  }}
                />
                <Typography
                  variant="body1"
                  sx={{
                    color: severityColors[alert.severity] || '#94a3b8',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {alert.severity}
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Source
              </Typography>
              <Chip
                label={alert.source}
                size="small"
                sx={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Assignee
              </Typography>
              <Typography variant="body1">
                {alert.assignee || 'Unassigned'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Created
              </Typography>
              <Typography variant="body1">
                {alert.created}
              </Typography>
            </Box>
          </Box>

          {/* OCSF Data (if available) */}
          {alert.rawOCSF && (
            <>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)' }} />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                  OCSF Detection Data
                </Typography>
                <Box
                  sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 1,
                    p: 2,
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(alert.rawOCSF, null, 2)}
                  </pre>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={onClose}>
          Close
        </Button>
        {!isResolved && !alert.isDummy && (
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleResolve}
          >
            Mark as Resolved
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
