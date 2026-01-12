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
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useUsers } from '@/hooks/useUsers';
import { useCustomFields, CustomField } from '@/hooks/useCustomFields';

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

// TLP and PAP levels
export const tlpLevels = [
  { value: 'TLP:CLEAR', label: 'TLP:CLEAR', color: '#ffffff' },
  { value: 'TLP:GREEN', label: 'TLP:GREEN', color: '#22c55e' },
  { value: 'TLP:AMBER', label: 'TLP:AMBER', color: '#f59e0b' },
  { value: 'TLP:AMBER+STRICT', label: 'TLP:AMBER+STRICT', color: '#f59e0b' },
  { value: 'TLP:RED', label: 'TLP:RED', color: '#ef4444' },
];

export const papLevels = [
  { value: 'PAP:CLEAR', label: 'PAP:CLEAR', color: '#ffffff' },
  { value: 'PAP:GREEN', label: 'PAP:GREEN', color: '#22c55e' },
  { value: 'PAP:AMBER', label: 'PAP:AMBER', color: '#f59e0b' },
  { value: 'PAP:RED', label: 'PAP:RED', color: '#ef4444' },
];

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
  tlp?: string;
  pap?: string;
  assignee?: string;
  customFields?: Record<string, string | number | boolean>;
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

export const severityOptions = [
  { id: 1, label: 'Informational', value: 'informational' },
  { id: 2, label: 'Low', value: 'low' },
  { id: 3, label: 'Medium', value: 'medium' },
  { id: 4, label: 'High', value: 'high' },
  { id: 5, label: 'Critical', value: 'critical' },
];

export const observableTypes = [
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
  const [tlp, setTlp] = useState('TLP:AMBER');
  const [pap, setPap] = useState('PAP:AMBER');
  const [assignee, setAssignee] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [newReference, setNewReference] = useState('');
  const [observables, setObservables] = useState<Observable[]>([]);
  const [newObservableType, setNewObservableType] = useState('ip');
  const [newObservableValue, setNewObservableValue] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number | boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { users, loading: usersLoading } = useUsers();
  const { fields: customFields, loading: fieldsLoading } = useCustomFields();

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
      tlp,
      pap,
      assignee: assignee.trim() || undefined,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
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
    setTlp('TLP:AMBER');
    setPap('PAP:AMBER');
    setAssignee('');
    setReferences([]);
    setNewReference('');
    setObservables([]);
    setNewObservableType('ip');
    setNewObservableValue('');
    setCustomFieldValues({});
    onClose();
  };

  const handleCustomFieldChange = (field: CustomField, value: string | number | boolean) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [field.key]: value,
    }));
  };

  const renderCustomField = (field: CustomField) => {
    const value = customFieldValues[field.key];
    
    switch (field.type) {
      case 'text':
        return (
          <TextField
            key={field.key}
            label={field.name}
            value={value || ''}
            onChange={(e) => handleCustomFieldChange(field, e.target.value)}
            fullWidth
            required={field.required}
            placeholder={field.description}
            size="small"
          />
        );
      case 'number':
        return (
          <TextField
            key={field.key}
            label={field.name}
            type="number"
            value={value || ''}
            onChange={(e) => handleCustomFieldChange(field, Number(e.target.value))}
            fullWidth
            required={field.required}
            placeholder={field.description}
            size="small"
          />
        );
      case 'select':
        return (
          <FormControl key={field.key} fullWidth size="small">
            <InputLabel>{field.name}</InputLabel>
            <Select
              value={value || ''}
              label={field.name}
              onChange={(e) => handleCustomFieldChange(field, e.target.value)}
              required={field.required}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {field.options?.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'date':
        return (
          <TextField
            key={field.key}
            label={field.name}
            type="date"
            value={value || ''}
            onChange={(e) => handleCustomFieldChange(field, e.target.value)}
            fullWidth
            required={field.required}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
        );
      case 'boolean':
        return (
          <FormControlLabel
            key={field.key}
            control={
              <Switch
                checked={Boolean(value)}
                onChange={(e) => handleCustomFieldChange(field, e.target.checked)}
              />
            }
            label={field.name}
          />
        );
      default:
        return null;
    }
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
          {/* Title */}
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            placeholder="e.g., Suspicious Login Activity"
          />

          {/* Message */}
          <TextField
            label="Message / Description"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Detailed description of the alert..."
          />

          {/* Source + Severity */}
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

          {/* TLP + PAP */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="TLP"
              value={tlp}
              onChange={(e) => setTlp(e.target.value)}
              fullWidth
            >
              {tlpLevels.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color, border: opt.color === '#ffffff' ? '1px solid #666' : 'none' }} />
                    {opt.label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="PAP"
              value={pap}
              onChange={(e) => setPap(e.target.value)}
              fullWidth
            >
              {papLevels.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color, border: opt.color === '#ffffff' ? '1px solid #666' : 'none' }} />
                    {opt.label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Assignee */}
          <FormControl fullWidth>
            <InputLabel>Assignee</InputLabel>
            <Select
              value={assignee}
              label="Assignee"
              onChange={(e) => setAssignee(e.target.value)}
              disabled={usersLoading}
              endAdornment={usersLoading ? <CircularProgress size={20} sx={{ mr: 2 }} /> : null}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    zIndex: 9999,
                  },
                },
              }}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.username}>
                  {user.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddReference();
                  }
                }}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddObservable();
                  }
                }}
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

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                Custom Fields
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {customFields.map((field) => renderCustomField(field))}
              </Box>
            </Box>
          )}
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
