import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  IconButton,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

// Generate a 10-character unique ID
const generateAlertId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(10);
  crypto.getRandomValues(array);
  for (let i = 0; i < 10; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
};

// Observable interface
export interface Observable {
  type: string;
  value: string;
}

// OCSF Detection Finding format
export interface OCSFDetection {
  message: string;
  severity_id: number;
  severity: string;
  type_uid: number;
  type_name: string;
  activity_id: number;
  activity_name: string;
  status_id: number;
  status: string;
  time: number;
  finding_info: {
    title: string;
    uid: string;
    src_url?: string;
    types?: string[];
    references?: string[];
  };
  observables?: Observable[];
  metadata: {
    product: {
      name: string;
      vendor_name: string;
    };
    version: string;
  };
}

interface CreateAlertDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (alert: OCSFDetection) => Promise<void>;
}

const severityOptions = [
  { id: 1, label: 'Informational' },
  { id: 2, label: 'Low' },
  { id: 3, label: 'Medium' },
  { id: 4, label: 'High' },
  { id: 5, label: 'Critical' },
];

const observableTypes = [
  'ip',
  'domain',
  'url',
  'email',
  'hash_md5',
  'hash_sha1',
  'hash_sha256',
  'file_name',
  'user',
  'hostname',
  'other',
];

export const CreateAlertDialog = ({ open, onClose, onSubmit }: CreateAlertDialogProps) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severityId, setSeverityId] = useState(3);
  const [source, setSource] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [newReference, setNewReference] = useState('');
  const [observables, setObservables] = useState<Observable[]>([]);
  const [newObservableType, setNewObservableType] = useState('ip');
  const [newObservableValue, setNewObservableValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddReference = () => {
    if (newReference.trim()) {
      setReferences([...references, newReference.trim()]);
      setNewReference('');
    }
  };

  const handleRemoveReference = (index: number) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  const handleAddObservable = () => {
    if (newObservableValue.trim()) {
      setObservables([...observables, { type: newObservableType, value: newObservableValue.trim() }]);
      setNewObservableValue('');
    }
  };

  const handleRemoveObservable = (index: number) => {
    setObservables(observables.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    const severity = severityOptions.find(s => s.id === severityId)?.label || 'Medium';
    const alertId = generateAlertId();

    const detection: OCSFDetection = {
      message: message || title,
      severity_id: severityId,
      severity,
      type_uid: 200101, // Detection Finding: Create
      type_name: 'Detection Finding',
      activity_id: 1,
      activity_name: 'Create',
      status_id: 1, // Always start as New
      status: 'New',
      time: Date.now(),
      finding_info: {
        title,
        uid: alertId,
        src_url: references[0] || '',
        types: [source || 'Manual'],
        references: references.length > 0 ? references : undefined,
      },
      observables: observables.length > 0 ? observables : undefined,
      metadata: {
        product: {
          name: source || 'Manual Entry',
          vendor_name: 'Shuffle',
        },
        version: '1.0.0',
      },
    };

    await onSubmit(detection);
    setIsSubmitting(false);
    handleClose();
  };

  const handleClose = () => {
    setTitle('');
    setMessage('');
    setSeverityId(3);
    setSource('');
    setReferences([]);
    setNewReference('');
    setObservables([]);
    setNewObservableType('ip');
    setNewObservableValue('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Create Alert (OCSF Detection)
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            placeholder="e.g., Suspicious Login Activity"
          />
          <TextField
            label="Message / Description"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Detailed description of the alert..."
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Source / Product"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              fullWidth
              placeholder="e.g., SIEM, EDR, Firewall"
            />
            <TextField
              select
              label="Severity"
              value={severityId}
              onChange={(e) => setSeverityId(Number(e.target.value))}
              fullWidth
            >
              {severityOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* URL References */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              URL References
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small"
                value={newReference}
                onChange={(e) => setNewReference(e.target.value)}
                placeholder="https://example.com/reference"
                fullWidth
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddReference())}
              />
              <IconButton onClick={handleAddReference} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <AddIcon />
              </IconButton>
            </Box>
            {references.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {references.map((ref, idx) => (
                  <Chip
                    key={idx}
                    label={ref.length > 40 ? ref.substring(0, 40) + '...' : ref}
                    size="small"
                    onDelete={() => handleRemoveReference(idx)}
                    sx={{ maxWidth: '100%' }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Observables */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Observables (IOCs)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                select
                size="small"
                value={newObservableType}
                onChange={(e) => setNewObservableType(e.target.value)}
                sx={{ minWidth: 120 }}
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
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObservable())}
              />
              <IconButton onClick={handleAddObservable} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <AddIcon />
              </IconButton>
            </Box>
            {observables.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {observables.map((obs, idx) => (
                  <Chip
                    key={idx}
                    label={`${obs.type}: ${obs.value}`}
                    size="small"
                    onDelete={() => handleRemoveObservable(idx)}
                    sx={{ 
                      bgcolor: 'rgba(255, 102, 0, 0.15)',
                      '& .MuiChip-label': { fontFamily: 'monospace', fontSize: '0.75rem' }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!title.trim() || isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Alert'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
