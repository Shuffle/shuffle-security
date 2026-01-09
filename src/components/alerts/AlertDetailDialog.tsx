import { useState, useEffect } from 'react';
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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';
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
  onUpdate?: (alertId: string, updates: Partial<OCSFDetection>) => Promise<void>;
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

const severityOptions = [
  { value: 'informational', label: 'Informational', id: 1 },
  { value: 'low', label: 'Low', id: 2 },
  { value: 'medium', label: 'Medium', id: 3 },
  { value: 'high', label: 'High', id: 4 },
  { value: 'critical', label: 'Critical', id: 5 },
];

const statusOptions = [
  { value: 'new', label: 'New', id: 1 },
  { value: 'escalated', label: 'Escalated', id: 2 },
  { value: 'resolved', label: 'Resolved', id: 3 },
];

export const AlertDetailDialog = ({ open, alert, onClose, onResolve, onUpdate }: AlertDetailDialogProps) => {
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSeverity, setEditedSeverity] = useState('');
  const [editedAssignee, setEditedAssignee] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form when alert changes
  useEffect(() => {
    if (alert) {
      setEditedTitle(alert.title);
      setEditedSeverity(alert.severity);
      setEditedAssignee(alert.assignee || '');
      setHasChanges(false);
    }
  }, [alert]);

  // Track changes (status is not editable directly)
  useEffect(() => {
    if (!alert) return;
    const changed = 
      editedTitle !== alert.title ||
      editedSeverity !== alert.severity ||
      editedAssignee !== (alert.assignee || '');
    setHasChanges(changed);
  }, [alert, editedTitle, editedSeverity, editedAssignee]);

  if (!alert) return null;

  const isResolved = alert.status === 'resolved';
  const isDemo = alert.isDummy;

  const handleResolve = async () => {
    setSaving(true);
    await onResolve(alert.id);
    setSaving(false);
    onClose();
  };

  const handleSave = async () => {
    if (!onUpdate || !alert.rawOCSF) return;
    
    setSaving(true);
    const severityOption = severityOptions.find(s => s.value === editedSeverity);
    
    const updates: Partial<OCSFDetection> = {
      message: editedTitle,
      severity_id: severityOption?.id || 3,
      severity: severityOption?.label || 'Medium',
    };

    if (alert.rawOCSF.finding_info) {
      updates.finding_info = {
        ...alert.rawOCSF.finding_info,
        title: editedTitle,
      };
    }

    await onUpdate(alert.id, updates);
    setSaving(false);
    setHasChanges(false);
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(0, 0, 0, 0.2)',
      '& fieldset': {
        borderColor: 'rgba(255,255,255,0.1)',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(255,255,255,0.2)',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#FF6600',
      },
    },
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
            {isDemo && (
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          {/* Editable Title */}
          <Box>
            <TextField
              label="Title"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              fullWidth
              disabled={isDemo}
              sx={inputSx}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              ID: {alert.id}
            </Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)' }} />

          {/* Editable Fields Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
            <FormControl fullWidth size="small" disabled={isDemo}>
              <InputLabel>Severity</InputLabel>
              <Select
                value={editedSeverity}
                label="Severity"
                onChange={(e) => setEditedSeverity(e.target.value)}
                sx={{
                  ...inputSx['& .MuiOutlinedInput-root'],
                  '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  },
                }}
              >
                {severityOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: severityColors[opt.value],
                        }}
                      />
                      {opt.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Status
              </Typography>
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

            <TextField
              label="Assignee"
              value={editedAssignee}
              onChange={(e) => setEditedAssignee(e.target.value)}
              size="small"
              disabled={isDemo}
              placeholder="Unassigned"
              sx={inputSx}
            />

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
                Created
              </Typography>
              <Typography variant="body2">
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
      <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
        <Button onClick={onClose}>
          Close
        </Button>
        {!isDemo && hasChanges && onUpdate && (
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            Save Changes
          </Button>
        )}
        {!isResolved && !isDemo && (
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleResolve}
            disabled={saving}
          >
            Resolve Alert
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
