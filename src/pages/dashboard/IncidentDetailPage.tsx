import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
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
  CircularProgress,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Avatar,
  Button,
  ButtonGroup,
  Tooltip,
  Skeleton,
} from '@mui/material';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { DATASTORE_CATEGORIES, getDatastoreItem } from '@/services/datastore';
import { useUsers } from '@/hooks/useUsers';
import { useCustomFields, CustomField } from '@/hooks/useCustomFields';
import { 
  OCSFIncidentFinding, 
  Observable, 
  severityOptions, 
  observableTypes,
  tlpLevels,
  papLevels,
  ActivityItem,
} from '@/components/incidents/CreateIncidentDialog';
import { toast } from 'sonner';

// Re-export ActivityItem type is now imported from CreateIncidentDialog

interface DisplayIncident {
  id: string;
  title: string;
  source: string;
  severity: string;
  status: string;
  assignee: string | null;
  created: string;
  createdTs: number;
  edited?: string;
  editedTs?: number;
  tlp?: string;
  pap?: string;
  references?: string[];
  observables?: Observable[];
  customFields?: Record<string, string | number | boolean>;
  relatedFindings?: string[];
  activity?: ActivityItem[];
  rawOCSF?: OCSFIncidentFinding;
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
  in_progress: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  escalated: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  resolved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
};

const formatTimestamp = (timestamp: number | string | undefined): string => {
  if (!timestamp) return 'Unknown';
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  const ms = ts < 10000000000 ? ts * 1000 : ts;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(timestamp);
};

const parseTimestamp = (timestamp: number | string | undefined): number => {
  if (!timestamp) return 0;
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  return ts < 10000000000 ? ts * 1000 : ts;
};

const mapOCSFSeverity = (severityId: number): string => {
  switch (severityId) {
    case 1: return 'informational';
    case 2: return 'low';
    case 3: return 'medium';
    case 4: return 'high';
    case 5: return 'critical';
    default: return 'medium';
  }
};

const mapOCSFStatus = (statusId: number): string => {
  switch (statusId) {
    case 1: return 'new';
    case 2: return 'in_progress';
    case 3: return 'resolved';
    default: return 'new';
  }
};

const parseIncidentFromDatastore = (item: { key: string; value: string; created?: number; edited?: number }): DisplayIncident | null => {
  try {
    const data = JSON.parse(item.value);
    const isOCSF = data.finding_info || data.severity_id !== undefined;
    
    if (isOCSF) {
      const ocsf = data as OCSFIncidentFinding;
      return {
        id: ocsf.finding_info?.uid || item.key,
        title: ocsf.finding_info?.title || ocsf.message || 'Untitled',
        source: ocsf.metadata?.product?.name || ocsf.finding_info?.types?.[0] || 'Unknown',
        severity: mapOCSFSeverity(ocsf.severity_id),
        status: mapOCSFStatus(ocsf.status_id),
        assignee: ocsf.assignee || null,
        created: formatTimestamp(item.created),
        createdTs: parseTimestamp(item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: ocsf.tlp,
        pap: ocsf.pap,
        references: ocsf.finding_info?.references,
        observables: ocsf.observables,
        customFields: ocsf.customFields,
        relatedFindings: ocsf.related_findings,
        activity: ocsf.activity || [],
        rawOCSF: ocsf,
      };
    }
    
    // Fallback for legacy/simple format
    return {
      id: data.id || item.key,
      title: data.title || 'Untitled',
      source: data.source || 'Unknown',
      severity: data.severity || 'medium',
      status: data.status || 'new',
      assignee: data.assignee || null,
      created: data.created || formatTimestamp(item.created),
      createdTs: parseTimestamp(item.created),
      edited: item.edited ? formatTimestamp(item.edited) : undefined,
      editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
      tlp: data.tlp,
      pap: data.pap,
      references: data.references || [],
      observables: data.observables || [],
      customFields: data.customFields || {},
      relatedFindings: data.relatedFindings || [],
      activity: data.activity || [],
      rawOCSF: data,
    };
  } catch {
    return null;
  }
};

const IncidentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userInfo } = useAuth();
  const currentUsername = userInfo?.username || '';

  const [incident, setIncident] = useState<DisplayIncident | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Editable fields
  const [editedTitle, setEditedTitle] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [editedSeverity, setEditedSeverity] = useState('');
  const [editedAssignee, setEditedAssignee] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [editedTlp, setEditedTlp] = useState('TLP:AMBER');
  const [editedPap, setEditedPap] = useState('PAP:AMBER');
  const [editedReferences, setEditedReferences] = useState<string[]>([]);
  const [newReference, setNewReference] = useState('');
  const [editedObservables, setEditedObservables] = useState<Observable[]>([]);
  const [newObservableType, setNewObservableType] = useState('ip');
  const [newObservableValue, setNewObservableValue] = useState('');
  const [editedCustomFields, setEditedCustomFields] = useState<Record<string, string | number | boolean>>({});
  
  // Activity/comments
  const [newComment, setNewComment] = useState('');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { users, loading: usersLoading } = useUsers();
  const { fields: customFields } = useCustomFields();
  const { addItem } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });

  // Load incident using direct key lookup (faster than list API)
  useEffect(() => {
    const loadIncident = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      // Try direct key lookup first
      const result = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS);
      console.log('getDatastoreItem result:', result);
      
      if (result.success && result.item) {
        // API returns { key, value, ... } directly - use item.key or fall back to the id
        const itemData = {
          key: result.item.key || id,
          value: result.item.value,
          created: result.item.created,
          edited: result.item.edited,
        };
        console.log('Parsing item:', itemData);
        const parsed = parseIncidentFromDatastore(itemData);
        
        if (parsed) {
          setIncident(parsed);
          setEditedTitle(parsed.title);
          setEditedMessage(parsed.rawOCSF?.message || '');
          setEditedSeverity(parsed.severity);
          setEditedAssignee(parsed.assignee || '');
          setEditedStatus(parsed.status);
          setEditedTlp(parsed.tlp || 'TLP:AMBER');
          setEditedPap(parsed.pap || 'PAP:AMBER');
          setEditedReferences(parsed.references || []);
          setEditedObservables(parsed.observables || []);
          setEditedCustomFields(parsed.rawOCSF?.customFields || {});
          setActivity(parsed.activity || []);
          setLoading(false);
          return;
        }
      }
      
      // Key not found - incident doesn't exist
      setLoading(false);
    };

    loadIncident();
  }, [id]);

  // Track changes
  useEffect(() => {
    if (!incident) return;
    const changed = 
      editedTitle !== incident.title ||
      editedMessage !== (incident.rawOCSF?.message || '') ||
      editedSeverity !== incident.severity ||
      editedAssignee !== (incident.assignee || '') ||
      editedStatus !== incident.status ||
      editedTlp !== (incident.tlp || 'TLP:AMBER') ||
      editedPap !== (incident.pap || 'PAP:AMBER') ||
      JSON.stringify(editedReferences) !== JSON.stringify(incident.references || []) ||
      JSON.stringify(editedObservables) !== JSON.stringify(incident.observables || []) ||
      JSON.stringify(editedCustomFields) !== JSON.stringify(incident.rawOCSF?.customFields || {});
    setHasChanges(changed);
  }, [incident, editedTitle, editedMessage, editedSeverity, editedAssignee, editedStatus, editedTlp, editedPap, editedReferences, editedObservables, editedCustomFields]);

  // MTTD/MTTR calculation
  const metrics = useMemo(() => {
    if (!incident) return null;
    
    const createdAt = incident.createdTs;
    const resolvedAt = incident.status === 'resolved' ? (incident.editedTs || Date.now()) : null;
    
    // MTTD: Time from detection (created) - we'd need external data for true detection time
    // For now, show time since created
    const mttd = createdAt ? formatRelativeTime(createdAt) : null;
    
    // MTTR: Time to resolve
    const mttr = resolvedAt ? Math.round((resolvedAt - createdAt) / 60000) : null;
    const mttrFormatted = mttr ? (mttr < 60 ? `${mttr}m` : `${Math.round(mttr / 60)}h ${mttr % 60}m`) : null;
    
    return { mttd, mttr: mttrFormatted };
  }, [incident]);

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

  const handleAddComment = async () => {
    if (!newComment.trim() || !incident?.rawOCSF) return;
    
    const commentActivity: ActivityItem = {
      id: `comment-${Date.now()}`,
      type: 'comment',
      user: currentUsername,
      timestamp: Date.now(),
      content: newComment.trim(),
    };
    
    const updatedActivity = [...activity, commentActivity];
    setActivity(updatedActivity);
    setNewComment('');
    
    // Save to datastore
    const updatedOCSF: OCSFIncidentFinding = {
      ...incident.rawOCSF,
      activity: updatedActivity,
    };
    await addItem(incident.id, updatedOCSF);
    toast.success('Comment added');
  };

  const handleSave = async () => {
    if (!incident?.rawOCSF) return;
    
    setSaving(true);
    const severityOption = severityOptions.find(s => s.value === editedSeverity);
    const statusId = editedStatus === 'new' ? 1 : editedStatus === 'in_progress' ? 2 : 3;
    
    // Track changes for activity log
    const changes: string[] = [];
    if (editedTitle !== incident.title) changes.push(`Title changed to "${editedTitle}"`);
    if (editedSeverity !== incident.severity) changes.push(`Severity changed to ${editedSeverity}`);
    if (editedAssignee !== (incident.assignee || '')) {
      changes.push(editedAssignee ? `Assigned to ${editedAssignee}` : 'Unassigned');
    }
    if (editedStatus !== incident.status) changes.push(`Status changed to ${editedStatus}`);
    
    const changeActivity: ActivityItem[] = changes.map(content => ({
      id: `change-${Date.now()}-${Math.random()}`,
      type: 'change' as const,
      user: currentUsername,
      timestamp: Date.now(),
      content,
    }));
    
    const updatedActivity = [...activity, ...changeActivity];
    
    const updatedOCSF: OCSFIncidentFinding = {
      ...incident.rawOCSF,
      message: editedMessage || editedTitle,
      severity_id: severityOption?.id || 3,
      severity: severityOption?.label || 'Medium',
      status_id: statusId,
      status: editedStatus === 'new' ? 'New' : editedStatus === 'in_progress' ? 'In Progress' : 'Resolved',
      tlp: editedTlp,
      pap: editedPap,
      assignee: editedAssignee.trim() || undefined,
      observables: editedObservables.length > 0 ? editedObservables : undefined,
      customFields: Object.keys(editedCustomFields).length > 0 ? editedCustomFields : undefined,
      activity: updatedActivity,
      finding_info: {
        ...incident.rawOCSF.finding_info,
        title: editedTitle,
        references: editedReferences.length > 0 ? editedReferences : undefined,
        src_url: editedReferences[0] || '',
      },
    };

    await addItem(incident.id, updatedOCSF);
    setActivity(updatedActivity);
    setSaving(false);
    setHasChanges(false);
    toast.success('Incident updated');
  };

  const handleResolve = async () => {
    if (!incident?.rawOCSF) return;
    
    setSaving(true);
    const resolveActivity: ActivityItem = {
      id: `status-${Date.now()}`,
      type: 'status',
      user: currentUsername,
      timestamp: Date.now(),
      content: 'Marked as Resolved',
    };
    
    const updatedActivity = [...activity, resolveActivity];
    
    const updatedOCSF: OCSFIncidentFinding = {
      ...incident.rawOCSF,
      status_id: 3,
      status: 'Resolved',
      activity: updatedActivity,
    };

    await addItem(incident.id, updatedOCSF);
    setSaving(false);
    toast.success('Incident resolved');
    navigate('/incidents');
  };

  const handleCustomFieldChange = (field: CustomField, value: string | number | boolean) => {
    setEditedCustomFields(prev => ({
      ...prev,
      [field.key]: value,
    }));
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(0, 0, 0, 0.2)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&.Mui-focused fieldset': { borderColor: '#FF6600' },
    },
  };

  const renderCustomField = (field: CustomField) => {
    const value = editedCustomFields[field.key];
    
    switch (field.type) {
      case 'text':
        return (
          <TextField
            key={field.key}
            label={field.name}
            value={value || ''}
            onChange={(e) => handleCustomFieldChange(field, e.target.value)}
            fullWidth
            size="small"
            sx={inputSx}
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
            size="small"
            sx={inputSx}
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
              sx={inputSx['& .MuiOutlinedInput-root']}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {field.options?.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
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
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={inputSx}
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
            sx={{ color: 'hsl(var(--foreground))' }}
          />
        );
      default:
        return null;
    }
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'comment': return <PersonIcon fontSize="small" />;
      case 'change': return <EditIcon fontSize="small" />;
      case 'status': return <CheckCircleIcon fontSize="small" />;
      case 'assignment': return <PersonIcon fontSize="small" />;
      case 'created': return <AddIcon fontSize="small" />;
      default: return <HistoryIcon fontSize="small" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 3 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3 }}>
          <Skeleton variant="rectangular" height={400} />
          <Skeleton variant="rectangular" height={400} />
        </Box>
      </Box>
    );
  }

  if (!incident) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
          Incident not found
        </Typography>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/incidents')}>
          Back to Incidents
        </Button>
      </Box>
    );
  }

  const isResolved = incident.status === 'resolved';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/incidents')} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {editedTitle}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                {incident.id}
              </Typography>
              <Chip
                label={editedStatus.replace('_', ' ')}
                size="small"
                sx={{
                  backgroundColor: statusColors[editedStatus]?.bg,
                  color: statusColors[editedStatus]?.text,
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}
              />
              <Chip
                label={editedSeverity}
                size="small"
                sx={{
                  backgroundColor: `${severityColors[editedSeverity]}20`,
                  color: severityColors[editedSeverity],
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}
              />
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Metrics */}
          {metrics && (
            <Box sx={{ display: 'flex', gap: 3, mr: 2 }}>
              <Tooltip title="Time since created">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Age
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {metrics.mttd}
                  </Typography>
                </Box>
              </Tooltip>
              {metrics.mttr && (
                <Tooltip title="Mean Time to Resolve">
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      MTTR
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#22c55e' }}>
                      {metrics.mttr}
                    </Typography>
                  </Box>
                </Tooltip>
              )}
            </Box>
          )}
          
          <ButtonGroup variant="outlined">
            {hasChanges && (
              <Button startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
                Save
              </Button>
            )}
            {!isResolved && (
              <Button 
                startIcon={<CheckCircleIcon />} 
                onClick={handleResolve} 
                disabled={saving}
                sx={{ color: '#22c55e', borderColor: '#22c55e', '&:hover': { borderColor: '#22c55e', bgcolor: 'rgba(34, 197, 94, 0.1)' } }}
              >
                Resolve
              </Button>
            )}
          </ButtonGroup>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
        {/* Left Column - Details */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Basic Info */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2 }}>
                Details
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  label="Title"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  fullWidth
                  size="small"
                  sx={inputSx}
                />
                <TextField
                  label="Description"
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  sx={inputSx}
                />
                
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={editedSeverity}
                      label="Severity"
                      onChange={(e) => setEditedSeverity(e.target.value)}
                      sx={inputSx['& .MuiOutlinedInput-root']}
                    >
                      {severityOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: severityColors[opt.value] }} />
                            {opt.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={editedStatus}
                      label="Status"
                      onChange={(e) => setEditedStatus(e.target.value)}
                      sx={inputSx['& .MuiOutlinedInput-root']}
                    >
                      <MenuItem value="new">New</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="resolved">Resolved</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small">
                    <InputLabel>Assignee</InputLabel>
                    <Select
                      value={editedAssignee}
                      label="Assignee"
                      onChange={(e) => setEditedAssignee(e.target.value)}
                      disabled={usersLoading}
                      sx={inputSx['& .MuiOutlinedInput-root']}
                      MenuProps={{ PaperProps: { sx: { bgcolor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', zIndex: 9999 } } }}
                    >
                      <MenuItem value=""><em>Unassigned</em></MenuItem>
                      {users.map((user) => (
                        <MenuItem key={user.id} value={user.username}>{user.username}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small">
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
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Created</Typography>
                    <Typography variant="body2">{incident.created}</Typography>
                  </Box>
                  {incident.edited && (
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Last Updated</Typography>
                      <Typography variant="body2">{incident.edited}</Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Source</Typography>
                    <Typography variant="body2">{incident.source}</Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Observables */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2 }}>
                Observables (IOCs)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  select
                  size="small"
                  value={newObservableType}
                  onChange={(e) => setNewObservableType(e.target.value)}
                  sx={{ minWidth: 120, ...inputSx }}
                >
                  {observableTypes.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  value={newObservableValue}
                  onChange={(e) => setNewObservableValue(e.target.value)}
                  placeholder="Value..."
                  fullWidth
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObservable())}
                  sx={inputSx}
                />
                <IconButton onClick={handleAddObservable} disabled={!newObservableValue.trim()} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <AddIcon />
                </IconButton>
              </Box>
              {editedObservables.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {editedObservables.map((obs, idx) => (
                    <Chip
                      key={idx}
                      label={`${obs.type}: ${obs.value}`}
                      size="small"
                      onDelete={() => handleRemoveObservable(idx)}
                      sx={{ bgcolor: 'rgba(255, 102, 0, 0.15)', '& .MuiChip-label': { fontFamily: 'monospace', fontSize: '0.75rem' } }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  No observables added
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Custom Fields
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  {customFields.map((field) => renderCustomField(field))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* References */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2 }}>
                References
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small"
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  placeholder="https://example.com/reference"
                  fullWidth
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddReference())}
                  sx={inputSx}
                />
                <IconButton onClick={handleAddReference} disabled={!newReference.trim()} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <AddIcon />
                </IconButton>
              </Box>
              {editedReferences.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {editedReferences.map((ref, idx) => (
                    <Chip
                      key={idx}
                      label={ref.length > 50 ? ref.substring(0, 50) + '...' : ref}
                      size="small"
                      onDelete={() => handleRemoveReference(idx)}
                      onClick={() => window.open(ref, '_blank')}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  No references added
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Right Column - Activity */}
        <Box>
          <Card sx={{ position: 'sticky', top: 16 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon fontSize="small" />
                Activity
              </Typography>
              
              {/* Comment input */}
              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <TextField
                  size="small"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  fullWidth
                  multiline
                  maxRows={4}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  sx={inputSx}
                />
                <IconButton onClick={handleAddComment} disabled={!newComment.trim()} sx={{ bgcolor: 'rgba(255, 102, 0, 0.15)', color: '#ff6600', '&:hover': { bgcolor: 'rgba(255, 102, 0, 0.25)' } }}>
                  <SendIcon />
                </IconButton>
              </Box>

              <Divider sx={{ mb: 2, borderColor: 'rgba(148, 163, 184, 0.1)' }} />

              {/* Activity list */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 500, overflowY: 'auto' }}>
                {activity.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                    No activity yet
                  </Typography>
                ) : (
                  [...activity].reverse().map((item) => (
                    <Box key={item.id} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.2)' }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: item.type === 'comment' ? 'rgba(255, 102, 0, 0.2)' : 'rgba(148, 163, 184, 0.2)' }}>
                        {getActivityIcon(item.type)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.user}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AccessTimeIcon sx={{ fontSize: 12 }} />
                            {formatRelativeTime(item.timestamp)}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: item.type === 'comment' ? 'text.primary' : 'text.secondary' }}>
                          {item.content}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </motion.div>
  );
};

export default IncidentDetailPage;
