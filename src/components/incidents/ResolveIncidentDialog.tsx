import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export interface ResolutionData {
  reason: string;
  notes: string;
}

const RESOLUTION_REASONS = [
  { value: 'true_positive_remediated', label: 'True Positive - Remediated' },
  { value: 'true_positive_accepted', label: 'True Positive - Risk Accepted' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'duplicate', label: 'Duplicate Incident' },
  { value: 'not_applicable', label: 'Not Applicable' },
  { value: 'no_action_required', label: 'No Action Required' },
  { value: 'escalated', label: 'Escalated to External Team' },
  { value: 'other', label: 'Other' },
] as const;

interface ResolveIncidentDialogProps {
  open: boolean;
  onClose: () => void;
  onResolve: (data: ResolutionData) => void;
  incidentTitle: string;
  isLoading?: boolean;
}

export const ResolveIncidentDialog = React.forwardRef<HTMLDivElement, ResolveIncidentDialogProps>(({
  open,
  onClose,
  onResolve,
  incidentTitle,
  isLoading = false,
}, _ref) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleResolve = () => {
    if (!reason) return;
    onResolve({ reason, notes: notes.trim() });
  };

  const handleClose = () => {
    setReason('');
    setNotes('');
    onClose();
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.03)',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
    },
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(180deg, #262626 0%, #1f1f1f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CheckCircleIcon sx={{ color: '#22c55e' }} />
          <Typography variant="h6">Resolve Incident</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Resolving: <strong>{incidentTitle}</strong>
        </Typography>

        <FormControl fullWidth sx={{ mb: 3, ...inputSx }}>
          <InputLabel>Resolution Reason *</InputLabel>
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            label="Resolution Reason *"
          >
            {RESOLUTION_REASONS.map((r) => (
              <MenuItem key={r.value} value={r.value}>
                {r.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Resolution Notes (optional)"
          placeholder="Add any additional context about how this incident was resolved..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          sx={inputSx}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleResolve}
          disabled={!reason || isLoading}
          startIcon={<CheckCircleIcon />}
          sx={{
            bgcolor: '#22c55e',
            '&:hover': { bgcolor: '#16a34a' },
          }}
        >
          {isLoading ? 'Resolving...' : 'Resolve Incident'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

export { RESOLUTION_REASONS };
