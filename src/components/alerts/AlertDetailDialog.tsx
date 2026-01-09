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
  IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import { 
  OCSFDetection, 
  Observable, 
  severityOptions, 
  observableTypes,
  tlpLevels,
  papLevels,
} from './CreateAlertDialog';

interface DisplayAlert {
  id: string;
  title: string;
  source: string;
  severity: string;
  status: string;
  assignee: string | null;
  created: string;
  edited?: string;
  tlp?: string;
  pap?: string;
  references?: string[];
  observables?: Observable[];
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

export const AlertDetailDialog = ({ open, alert, onClose, onResolve, onUpdate }: AlertDetailDialogProps) => {
  const [editedTitle, setEditedTitle] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [editedSeverity, setEditedSeverity] = useState('');
  const [editedAssignee, setEditedAssignee] = useState('');
  const [editedTlp, setEditedTlp] = useState('TLP:AMBER');
  const [editedPap, setEditedPap] = useState('PAP:AMBER');
  const [editedReferences, setEditedReferences] = useState<string[]>([]);
  const [newReference, setNewReference] = useState('');
  const [editedObservables, setEditedObservables] = useState<Observable[]>([]);
  const [newObservableType, setNewObservableType] = useState('ip');
  const [newObservableValue, setNewObservableValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form when alert changes
  useEffect(() => {
    if (alert) {
      setEditedTitle(alert.title);
      setEditedMessage(alert.rawOCSF?.message || '');
      setEditedSeverity(alert.severity);
      setEditedAssignee(alert.assignee || '');
      setEditedTlp(alert.tlp || 'TLP:AMBER');
      setEditedPap(alert.pap || 'PAP:AMBER');
      setEditedReferences(alert.references || []);
      setEditedObservables(alert.observables || []);
      setHasChanges(false);
    }
  }, [alert]);

  // Track changes
  useEffect(() => {
    if (!alert) return;
    const changed = 
      editedTitle !== alert.title ||
      editedMessage !== (alert.rawOCSF?.message || '') ||
      editedSeverity !== alert.severity ||
      editedAssignee !== (alert.assignee || '') ||
      editedTlp !== (alert.tlp || 'TLP:AMBER') ||
      editedPap !== (alert.pap || 'PAP:AMBER') ||
      JSON.stringify(editedReferences) !== JSON.stringify(alert.references || []) ||
      JSON.stringify(editedObservables) !== JSON.stringify(alert.observables || []);
    setHasChanges(changed);
  }, [alert, editedTitle, editedMessage, editedSeverity, editedAssignee, editedTlp, editedPap, editedReferences, editedObservables]);

  const handleAddReference = () => {
    if (newReference.trim()) {
      setEditedReferences([...editedReferences, newReference.trim()]);
      setNewReference('');
    }
  };

  const handleRemoveReference = (index: number) => {
    setEditedReferences(editedReferences.filter((_, i) => i !== index));
  };

  const handleAddObservable = () => {
    if (newObservableValue.trim()) {
      setEditedObservables([...editedObservables, { type: newObservableType, value: newObservableValue.trim() }]);
      setNewObservableValue('');
    }
  };

  const handleRemoveObservable = (index: number) => {
    setEditedObservables(editedObservables.filter((_, i) => i !== index));
  };

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
      message: editedMessage || editedTitle,
      severity_id: severityOption?.id || 3,
      severity: severityOption?.label || 'Medium',
      tlp: editedTlp,
      pap: editedPap,
      assignee: editedAssignee.trim() || undefined,
      observables: editedObservables.length > 0 ? editedObservables : undefined,
      finding_info: {
        ...alert.rawOCSF.finding_info,
        title: editedTitle,
        references: editedReferences.length > 0 ? editedReferences : undefined,
        src_url: editedReferences[0] || '',
      },
    };

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
          {/* Title */}
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

          {/* Message */}
          <TextField
            label="Message / Description"
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            fullWidth
            multiline
            rows={3}
            disabled={isDemo}
            sx={inputSx}
          />

          <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)' }} />

          {/* Fields Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
            {/* Severity */}
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

            {/* Status (read-only) */}
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

            {/* TLP */}
            <FormControl fullWidth size="small" disabled={isDemo}>
              <InputLabel>TLP</InputLabel>
              <Select
                value={editedTlp}
                label="TLP"
                onChange={(e) => setEditedTlp(e.target.value)}
                sx={inputSx['& .MuiOutlinedInput-root']}
              >
                {tlpLevels.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color, border: opt.color === '#ffffff' ? '1px solid #666' : 'none' }} />
                      {opt.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* PAP */}
            <FormControl fullWidth size="small" disabled={isDemo}>
              <InputLabel>PAP</InputLabel>
              <Select
                value={editedPap}
                label="PAP"
                onChange={(e) => setEditedPap(e.target.value)}
                sx={inputSx['& .MuiOutlinedInput-root']}
              >
                {papLevels.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color, border: opt.color === '#ffffff' ? '1px solid #666' : 'none' }} />
                      {opt.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Assignee */}
            <TextField
              label="Assignee"
              value={editedAssignee}
              onChange={(e) => setEditedAssignee(e.target.value)}
              size="small"
              disabled={isDemo}
              placeholder="Unassigned"
              sx={inputSx}
            />

            {/* Source */}
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

            {/* Created */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Created
              </Typography>
              <Typography variant="body2">
                {alert.created}
              </Typography>
            </Box>

            {/* Edited */}
            {alert.edited && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Last Edited
                </Typography>
                <Typography variant="body2">
                  {alert.edited}
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)' }} />

          {/* URL References */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              URL References
            </Typography>
            {!isDemo && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  placeholder="https://example.com/reference"
                  fullWidth
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddReference();
                    }
                  }}
                  sx={inputSx}
                />
                <IconButton 
                  onClick={handleAddReference} 
                  size="small" 
                  sx={{ bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                  disabled={!newReference.trim()}
                >
                  <AddIcon />
                </IconButton>
              </Box>
            )}
            {editedReferences.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {editedReferences.map((ref, idx) => (
                  <Chip
                    key={idx}
                    label={ref.length > 40 ? ref.substring(0, 40) + '...' : ref}
                    size="small"
                    onDelete={isDemo ? undefined : () => handleRemoveReference(idx)}
                    sx={{ maxWidth: '100%' }}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                No references
              </Typography>
            )}
          </Box>

          {/* Observables */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Observables (IOCs)
            </Typography>
            {!isDemo && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  select
                  size="small"
                  value={newObservableType}
                  onChange={(e) => setNewObservableType(e.target.value)}
                  sx={{ minWidth: 120, ...inputSx }}
                >
                  {observableTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  value={newObservableValue}
                  onChange={(e) => setNewObservableValue(e.target.value)}
                  placeholder="Value..."
                  fullWidth
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddObservable();
                    }
                  }}
                  sx={inputSx}
                />
                <IconButton 
                  onClick={handleAddObservable} 
                  size="small" 
                  sx={{ bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                  disabled={!newObservableValue.trim()}
                >
                  <AddIcon />
                </IconButton>
              </Box>
            )}
            {editedObservables.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {editedObservables.map((obs, idx) => (
                  <Chip
                    key={idx}
                    label={`${obs.type}: ${obs.value}`}
                    size="small"
                    onDelete={isDemo ? undefined : () => handleRemoveObservable(idx)}
                    sx={{ 
                      bgcolor: 'rgba(255, 102, 0, 0.15)',
                      '& .MuiChip-label': { fontFamily: 'monospace', fontSize: '0.75rem' }
                    }}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                No observables
              </Typography>
            )}
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
