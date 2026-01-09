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
} from '@mui/material';

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
  };
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

const statusOptions = [
  { id: 1, label: 'New' },
  { id: 2, label: 'Escalated' },
  { id: 3, label: 'Resolved' },
];

export const CreateAlertDialog = ({ open, onClose, onSubmit }: CreateAlertDialogProps) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severityId, setSeverityId] = useState(3);
  const [statusId, setStatusId] = useState(1);
  const [source, setSource] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    const severity = severityOptions.find(s => s.id === severityId)?.label || 'Medium';
    const status = statusOptions.find(s => s.id === statusId)?.label || 'New';

    const detection: OCSFDetection = {
      message: message || title,
      severity_id: severityId,
      severity,
      type_uid: 200101, // Detection Finding: Create
      type_name: 'Detection Finding',
      activity_id: 1,
      activity_name: 'Create',
      status_id: statusId,
      status,
      time: Date.now(),
      finding_info: {
        title,
        uid: `ALR-${Date.now()}`,
        src_url: '',
        types: [source || 'Manual'],
      },
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
    setStatusId(1);
    setSource('');
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
          <TextField
            label="Source / Product"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            fullWidth
            placeholder="e.g., SIEM, EDR, Firewall"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
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
            <TextField
              select
              label="Status"
              value={statusId}
              onChange={(e) => setStatusId(Number(e.target.value))}
              fullWidth
            >
              {statusOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
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
