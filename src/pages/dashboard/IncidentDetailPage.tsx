import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  Avatar,
  Button,
  Tooltip,
  Skeleton,
  Collapse,
  LinearProgress,
} from '@mui/material';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SecurityIcon from '@mui/icons-material/Security';
import LinkIcon from '@mui/icons-material/Link';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { DATASTORE_CATEGORIES, getDatastoreItem } from '@/services/datastore';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { useUsers } from '@/hooks/useUsers';
import { useCustomFields, CustomField } from '@/hooks/useCustomFields';
import { useIOCTypes } from '@/hooks/useIOCTypes';
import { ObservableTypeSelector } from '@/components/incidents/ObservableTypeSelector';
import { useCaseTemplates, CaseTemplate } from '@/hooks/useCaseTemplates';
import { 
  ActivityItem,
  tlpLevels,
} from '@/components/incidents/CreateIncidentDialog';
import { 
  OCSFIncidentFinding, 
  Observable, 
  IncidentTask, 
  FileAttachment,
  Comment,
  severityOptions, 
  taskCategories,
  TLP_LABELS,
  TLP_STRING_TO_INT,
  mapOCSFSeverity,
  mapOCSFStatus,
  convertLegacyTlp,
} from '@/config/ocsfIncidentSchema';
import { ResolveIncidentDialog, ResolutionData, RESOLUTION_REASONS } from '@/components/incidents/ResolveIncidentDialog';
import { MentionText } from '@/components/incidents/MentionText';
import { MentionInput } from '@/components/incidents/MentionInput';
import { TaskDateTimePicker } from '@/components/incidents/TaskDateTimePicker';
import { FileAttachments } from '@/components/incidents/FileAttachments';
import { toast } from 'sonner';

// TaskTemplate interface is now imported from useCaseTemplates

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
  tasks?: IncidentTask[];
  rawOCSF?: any; // Use any to support both new and legacy formats
}

// Status and severity colors now imported from shared config
import { statusConfig, severityColors } from '@/config/incidentConfig';

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

const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${days}d ${hours % 24}h`;
};

const parseTimestamp = (timestamp: number | string | undefined): number => {
  if (!timestamp) return 0;
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  return ts < 10000000000 ? ts * 1000 : ts;
};


const parseIncidentFromDatastore = (item: { key: string; value: string; created?: number; edited?: number }): DisplayIncident | null => {
  try {
    const data = JSON.parse(item.value);
    
    // Check if this is new OCSF format (has finding_uid at root)
    const isNewFormat = 'finding_uid' in data && 'title' in data;
    // Check if legacy OCSF format
    const isLegacyOCSF = data.finding_info_list || data.finding_info || data.severity_id !== undefined;
    
    if (isNewFormat) {
      // New OCSF format
      const ocsf = data as OCSFIncidentFinding;
      const customAttrs = ocsf.metadata?.extensions?.custom_attributes;
      const tlpValue = customAttrs?.tlp;
      const tlpLabel = typeof tlpValue === 'number' ? TLP_LABELS[tlpValue]?.label : undefined;
      
      // Convert comments to activity for display
      const comments = customAttrs?.comments || [];
      const activityFromComments: ActivityItem[] = comments.map((c, i) => ({
        id: `comment-${i}`,
        type: 'comment' as const,
        user: c.author,
        timestamp: new Date(c.timestamp).getTime(),
        content: c.text,
      }));
      
      return {
        id: item.key, // Always use datastore key as the canonical ID
        title: ocsf.title,
        source: ocsf.product?.name || ocsf.types?.[0] || 'Unknown',
        severity: mapOCSFSeverity(ocsf.severity_id || 3),
        status: mapOCSFStatus(ocsf.status_id || 1),
        assignee: customAttrs?.assignee || null,
        created: formatTimestamp(item.created),
        createdTs: parseTimestamp(item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: tlpLabel,
        references: ocsf.references,
        observables: customAttrs?.observables,
        customFields: customAttrs?.customFields,
        relatedFindings: ocsf.related_events,
        activity: activityFromComments,
        tasks: customAttrs?.tasks,
        rawOCSF: data, // Store raw data for updates
      };
    } else if (isLegacyOCSF) {
      // Legacy OCSF format
      const legacyData = data as any;
      const findingInfo = legacyData.finding_info_list?.[0] || legacyData.finding_info;
      const customAttrs = legacyData.metadata?.extensions?.custom_attributes;
      const tlp = customAttrs?.tlp || legacyData.tlp;
      const pap = customAttrs?.pap || legacyData.pap;
      const tasks = customAttrs?.tasks || legacyData.tasks;
      const activity = customAttrs?.activity || legacyData.activity;
      const customFields = customAttrs?.customFields || legacyData.customFields;
      
      return {
        id: item.key, // Always use datastore key as the canonical ID
        title: findingInfo?.title || legacyData.message || 'Untitled',
        source: legacyData.metadata?.product?.name || findingInfo?.types?.[0] || 'Unknown',
        severity: mapOCSFSeverity(legacyData.severity_id),
        status: mapOCSFStatus(legacyData.status_id),
        assignee: legacyData.assignee || null,
        created: formatTimestamp(item.created),
        createdTs: parseTimestamp(item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: typeof tlp === 'string' ? tlp : (tlp ? TLP_LABELS[tlp]?.label : undefined),
        pap,
        references: findingInfo?.references,
        observables: legacyData.observables,
        customFields,
        relatedFindings: legacyData.related_findings,
        activity: activity || [],
        tasks,
        rawOCSF: legacyData,
      };
    }
    
    // Non-OCSF format
    return {
      id: item.key, // Always use datastore key as the canonical ID
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

// Collapsible Section Component
const Section = ({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true,
  badge,
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: string | number;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <Box sx={{ 
      bgcolor: 'rgba(255,255,255,0.02)', 
      borderRadius: 2, 
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <Box 
        onClick={() => setOpen(!open)}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          px: 2.5, 
          py: 2,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
        }}
      >
        <Icon sx={{ fontSize: 20, color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
          {title}
        </Typography>
        {badge !== undefined && (
          <Chip 
            label={badge} 
            size="small" 
            sx={{ 
              height: 20, 
              fontSize: '0.7rem',
              bgcolor: 'rgba(255, 102, 0, 0.15)',
              color: '#ff6600',
            }} 
          />
        )}
        {open ? <ExpandLessIcon sx={{ color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
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
  const [editedReferences, setEditedReferences] = useState<string[]>([]);
  const [newReference, setNewReference] = useState('');
  const [editedObservables, setEditedObservables] = useState<Observable[]>([]);
  const [newObservableType, setNewObservableType] = useState('ip');
  const [newObservableValue, setNewObservableValue] = useState('');
  const [editedCustomFields, setEditedCustomFields] = useState<Record<string, string | number | boolean>>({});
  
  // Activity/comments
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<FileAttachment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  
  // Tasks
  const [tasks, setTasks] = useState<IncidentTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  
  // Incident-level attachments
  const [incidentAttachments, setIncidentAttachments] = useState<FileAttachment[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0=Tasks, 1=Details, 2=Observables, 3=Correlations
  const [correlations, setCorrelations] = useState<Array<{ key: string; amount: number; ref: string[] }>>([]);
  const [correlationsLoading, setCorrelationsLoading] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef(false);
  
  const { users, loading: usersLoading } = useUsers();
  const { fields: customFields } = useCustomFields();
  const { observableTypeNames, iocTypes, refetch: refetchIOCTypes } = useIOCTypes();
  const { templates: caseTemplates, trackUsage: trackTemplateUsage } = useCaseTemplates();
  const { addItem } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });

  // Load incident function (reusable for refresh)
  const loadIncident = useCallback(async (showLoading = true) => {
    if (!id) {
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    const result = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS);
    
    if (result.success && result.item) {
      const itemData = {
        key: result.item.key || id,
        value: result.item.value,
        created: result.item.created,
        edited: result.item.edited,
      };
      const parsed = parseIncidentFromDatastore(itemData);
      
      if (parsed) {
        setIncident(parsed);
        setEditedTitle(parsed.title);
        // Use desc (new OCSF) first, fall back to message (legacy), strip HTML
        const rawDesc = parsed.rawOCSF?.desc || parsed.rawOCSF?.message || '';
        const strippedDesc = rawDesc.replace(/<[^>]*>/g, '').trim();
        setEditedMessage(strippedDesc);
        setEditedSeverity(parsed.severity);
        setEditedAssignee(parsed.assignee || '');
        setEditedStatus(parsed.status);
        setEditedTlp(parsed.tlp || 'TLP:AMBER');
        setEditedReferences(parsed.references || []);
        setEditedObservables(parsed.observables || []);
        const customAttrs = parsed.rawOCSF?.metadata?.extensions?.custom_attributes;
        setEditedCustomFields(customAttrs?.customFields || (parsed.rawOCSF as any)?.customFields || {});
        setActivity(parsed.activity || []);
        const loadedTasks = parsed.tasks || customAttrs?.tasks || (parsed.rawOCSF as any)?.tasks || [];
        setTasks(loadedTasks);
        // Auto-switch to Details tab if no tasks (only on initial load)
        if (showLoading && loadedTasks.length === 0) {
          setActiveTab(1);
        }
        setLoading(false);
        return;
      }
    }
    
    setLoading(false);
  }, [id]);

  // Initial load
  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  // Auto-refresh every 30 seconds to keep incident up-to-date
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Only refresh if not currently saving
      if (!pendingSaveRef.current && !isSaving) {
        loadIncident(false);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [loadIncident, isSaving]);

  // Fetch correlations
  useEffect(() => {
    const fetchCorrelations = async () => {
      if (!id) return;
      
      setCorrelationsLoading(true);
      try {
        const response = await fetch(getApiUrl('/api/v2/correlations'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(API_CONFIG.apiKey),
          },
          body: JSON.stringify({
            type: 'datastore',
            key: id,
            category: DATASTORE_CATEGORIES.INCIDENTS,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          // API returns array directly with { key, amount, ref[] }
          const correlationData = Array.isArray(data) ? data : (data.correlations || data.data || []);
          // Filter out noise: current incident key, status values, severity values, and common non-meaningful keys
          const noiseKeys = new Set([
            'new', 'in_progress', 'resolved', 'escalated', 'closed', 'open', 'pending',
            'critical', 'high', 'medium', 'low', 'informational', 'info', 'warning', 'error',
            'unknown', 'none', 'null', 'undefined', 'true', 'false',
            id?.toLowerCase(),
          ].filter(Boolean));
          setCorrelations(correlationData.filter((c: { key: string }) => !noiseKeys.has(c.key.toLowerCase())));
        }
      } catch (error) {
        console.error('Failed to fetch correlations:', error);
      } finally {
        setCorrelationsLoading(false);
      }
    };

    fetchCorrelations();
  }, [id]);

  // Auto-save with debounce
  const saveToDatastore = useCallback(async () => {
    if (!incident?.id) return;
    
    setIsSaving(true);
    pendingSaveRef.current = false;
    
    const severityOption = severityOptions.find(s => s.value === editedSeverity);
    const statusId = statusConfig[editedStatus]?.id || 1;
    
    // Get existing finding info from list (new) or direct (legacy)
    const existingFindingInfo = incident.rawOCSF?.finding_info_list?.[0] || (incident.rawOCSF as any)?.finding_info;
    const statusLabel = editedStatus === 'new' ? 'New' : editedStatus === 'in_progress' ? 'In Progress' : editedStatus === 'on_hold' ? 'On Hold' : 'Resolved';
    
    const updatedData = incident.rawOCSF ? {
      ...incident.rawOCSF,
      message: editedMessage || editedTitle,
      severity_id: severityOption?.id || 3,
      severity: severityOption?.label || 'Medium',
      status_id: statusId,
      status: statusLabel,
      assignee: editedAssignee.trim() || undefined,
      observables: editedObservables.length > 0 ? editedObservables : undefined,
      finding_info_list: [{
        ...existingFindingInfo,
        title: editedTitle,
        references: editedReferences.length > 0 ? editedReferences : undefined,
        src_url: editedReferences[0] || '',
      }],
      metadata: {
        ...incident.rawOCSF.metadata,
        extensions: {
          custom_attributes: {
            tlp: editedTlp,
            customFields: Object.keys(editedCustomFields).length > 0 ? editedCustomFields : undefined,
            activity,
            tasks: tasks.length > 0 ? tasks : undefined,
          },
        },
      },
    } : {
      id: incident.id,
      title: editedTitle,
      source: incident.source,
      severity: editedSeverity,
      status: editedStatus,
      assignee: editedAssignee.trim() || undefined,
      tlp: editedTlp,
      references: editedReferences,
      observables: editedObservables,
      customFields: editedCustomFields,
      activity,
      tasks,
    };

    try {
      await addItem(incident.id, updatedData);
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [incident, editedTitle, editedMessage, editedSeverity, editedAssignee, editedStatus, editedTlp, editedReferences, editedObservables, editedCustomFields, activity, tasks, addItem]);

  // Debounced auto-save
  useEffect(() => {
    if (!incident) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    const customAttrs = incident.rawOCSF?.metadata?.extensions?.custom_attributes;
    const hasChanges = 
      editedTitle !== incident.title ||
      editedMessage !== (incident.rawOCSF?.message || '') ||
      editedSeverity !== incident.severity ||
      editedAssignee !== (incident.assignee || '') ||
      editedStatus !== incident.status ||
      editedTlp !== (incident.tlp || 'TLP:AMBER') ||
      JSON.stringify(editedReferences) !== JSON.stringify(incident.references || []) ||
      JSON.stringify(editedObservables) !== JSON.stringify(incident.observables || []) ||
      JSON.stringify(editedCustomFields) !== JSON.stringify(customAttrs?.customFields || (incident.rawOCSF as any)?.customFields || {}) ||
      JSON.stringify(tasks) !== JSON.stringify(incident.tasks || customAttrs?.tasks || (incident.rawOCSF as any)?.tasks || []);
    
    if (hasChanges) {
      pendingSaveRef.current = true;
      saveTimeoutRef.current = setTimeout(() => {
        saveToDatastore();
      }, 800);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [incident, editedTitle, editedMessage, editedSeverity, editedAssignee, editedStatus, editedTlp, editedReferences, editedObservables, editedCustomFields, tasks, saveToDatastore]);

  // Metrics calculation with MTTD and MTTR
  const metrics = useMemo(() => {
    if (!incident) return null;
    
    const createdAt = incident.createdTs;
    const now = Date.now();
    const age = now - createdAt;
    
    // MTTD (Mean Time to Detect): Time from event creation to first status change or activity
    const firstActivity = incident.activity?.find(a => a.type !== 'created');
    const mttdMs = firstActivity ? firstActivity.timestamp - createdAt : age;
    
    // MTTR (Mean Time to Resolve): Time from creation to resolution
    const resolvedAt = incident.status === 'resolved' ? (incident.editedTs || now) : null;
    const mttrMs = resolvedAt ? resolvedAt - createdAt : null;
    
    // Progress bars: Max thresholds for visualization
    const maxMttd = 4 * 60 * 60 * 1000; // 4 hours target for detection
    const maxMttr = 24 * 60 * 60 * 1000; // 24 hours target for resolution
    const maxAge = 24 * 60 * 60 * 1000;
    
    const mttdProgress = Math.min((mttdMs / maxMttd) * 100, 100);
    const mttrProgress = mttrMs ? Math.min((mttrMs / maxMttr) * 100, 100) : Math.min((age / maxMttr) * 100, 100);
    const ageProgress = Math.min((age / maxAge) * 100, 100);
    
    // Determine color based on performance
    const getMttdColor = (progress: number) => progress < 50 ? '#22c55e' : progress < 80 ? '#f59e0b' : '#ef4444';
    const getMttrColor = (progress: number) => progress < 50 ? '#22c55e' : progress < 80 ? '#f59e0b' : '#ef4444';
    
    return { 
      age: formatDuration(age),
      ageMs: age,
      ageProgress,
      mttd: formatDuration(mttdMs),
      mttdMs,
      mttdProgress,
      mttdColor: getMttdColor(mttdProgress),
      mttr: mttrMs ? formatDuration(mttrMs) : null,
      mttrMs,
      mttrProgress,
      mttrColor: getMttrColor(mttrProgress),
      isResolved: !!resolvedAt,
    };
  }, [incident]);

  // Auto-transition status to "in_progress" when any action is taken
  const autoProgressStatus = useCallback(() => {
    if (editedStatus === 'new') {
      setEditedStatus('in_progress');
    }
  }, [editedStatus]);

  const handleAddReference = () => {
    if (newReference.trim()) {
      autoProgressStatus();
      setEditedReferences([...editedReferences, newReference.trim()]);
      setNewReference('');
    }
  };

  const handleRemoveReference = (index: number) => {
    autoProgressStatus();
    setEditedReferences(editedReferences.filter((_, i) => i !== index));
  };

  const handleAddObservable = () => {
    if (newObservableValue.trim()) {
      autoProgressStatus();
      setEditedObservables([...editedObservables, { type: newObservableType, value: newObservableValue.trim() }]);
      setNewObservableValue('');
    }
  };

  const handleRemoveObservable = (index: number) => {
    autoProgressStatus();
    setEditedObservables(editedObservables.filter((_, i) => i !== index));
  };

  const handleAddComment = async () => {
    if ((!newComment.trim() && commentAttachments.length === 0) || !incident?.rawOCSF) return;
    
    autoProgressStatus();
    
    const commentActivity: ActivityItem = {
      id: `comment-${Date.now()}`,
      type: 'comment',
      user: currentUsername,
      timestamp: Date.now(),
      content: newComment.trim() || (commentAttachments.length > 0 ? `Attached ${commentAttachments.length} file(s)` : ''),
      attachments: commentAttachments.length > 0 ? [...commentAttachments] : undefined,
    };
    
    const updatedActivity = [...activity, commentActivity];
    setActivity(updatedActivity);
    setNewComment('');
    setCommentAttachments([]);
    
    const updatedOCSF: OCSFIncidentFinding = {
      ...incident.rawOCSF!,
      metadata: {
        ...incident.rawOCSF!.metadata,
        extensions: {
          custom_attributes: {
            ...incident.rawOCSF!.metadata?.extensions?.custom_attributes,
            activity: updatedActivity,
          },
        },
      },
    };
    await addItem(incident.id, updatedOCSF);
    toast.success('Comment added');
  };

  const handleResolve = async (resolutionData: ResolutionData) => {
    if (!incident) return;
    
    setIsSaving(true);
    
    const reasonLabel = RESOLUTION_REASONS.find(r => r.value === resolutionData.reason)?.label || resolutionData.reason;
    
    const resolveActivity: ActivityItem = {
      id: `status-${Date.now()}`,
      type: 'status',
      user: currentUsername,
      timestamp: Date.now(),
      content: `Resolved: ${reasonLabel}${resolutionData.notes ? ` - ${resolutionData.notes}` : ''}`,
    };
    
    const updatedActivity = [...activity, resolveActivity];
    
    const existingFindingInfo = incident.rawOCSF?.finding_info_list?.[0] || (incident.rawOCSF as any)?.finding_info;
    const resolvedData = incident.rawOCSF ? {
      ...incident.rawOCSF,
      status_id: 3,
      status: 'Resolved',
      status_detail: `${resolutionData.reason}${resolutionData.notes ? `: ${resolutionData.notes}` : ''}`,
      metadata: {
        ...incident.rawOCSF.metadata,
        extensions: {
          custom_attributes: {
            ...incident.rawOCSF.metadata?.extensions?.custom_attributes,
            activity: updatedActivity,
          },
        },
      },
    } : {
      id: incident.id,
      title: editedTitle,
      source: incident.source,
      severity: editedSeverity,
      status: 'resolved',
      status_detail: `${resolutionData.reason}${resolutionData.notes ? `: ${resolutionData.notes}` : ''}`,
      assignee: editedAssignee.trim() || undefined,
      activity: updatedActivity,
    };

    await addItem(incident.id, resolvedData);
    setIsSaving(false);
    setShowResolveDialog(false);
    toast.success('Incident resolved');
    navigate('/incidents');
  };

  const handleCustomFieldChange = (field: CustomField, value: string | number | boolean) => {
    setEditedCustomFields(prev => ({
      ...prev,
      [field.key]: value,
    }));
  };

  // Task handlers
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    autoProgressStatus();
    const newTask: IncidentTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      completed: false,
      createdAt: Date.now(),
      createdBy: currentUsername,
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const handleToggleTask = (taskId: string) => {
    autoProgressStatus();
    setTasks(tasks.map(task => 
      task.id === taskId 
        ? { 
            ...task, 
            completed: !task.completed, 
            completedAt: !task.completed ? Date.now() : undefined 
          } 
        : task
    ));
  };

  const handleUpdateTaskAssignee = (taskId: string, assignee: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, assignee } : task
    ));
  };

  const handleUpdateTaskDueDate = (taskId: string, dueDate: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, dueDate } : task
    ));
  };

  const handleUpdateTaskDescription = (taskId: string, description: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, description } : task
    ));
  };

  const handleUpdateTaskTitle = (taskId: string, title: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, title } : task
    ));
  };

  const handleUpdateTaskCategory = (taskId: string, category: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, category } : task
    ));
  };

  const handleUpdateTaskAttachments = (taskId: string, attachments: FileAttachment[]) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, attachments } : task
    ));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const handleApplyTemplate = async (template: CaseTemplate) => {
    autoProgressStatus();
    const newTasks: IncidentTask[] = template.tasks.map((t, index) => ({
      id: `task-${Date.now()}-${index}`,
      title: t.title,
      description: t.description,
      category: t.category,
      completed: false,
      assignee: t.assignee || undefined,
      dependsOn: t.dependsOn,
      createdAt: Date.now(),
      createdBy: currentUsername,
    }));
    setTasks([...tasks, ...newTasks]);
    setShowTemplateMenu(false);
    await trackTemplateUsage(template.id);
    toast.success(`Applied "${template.name}" template`);
  };

  const isTaskBlocked = (task: IncidentTask): boolean => {
    if (!task.dependsOn) return false;
    const dependencyTask = tasks.find(t => t.title === task.dependsOn);
    return dependencyTask ? !dependencyTask.completed : false;
  };

  const getTaskProgress = () => {
    if (tasks.length === 0) return 0;
    const completedCount = tasks.filter(t => t.completed).length;
    return Math.round((completedCount / tasks.length) * 100);
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
        <Skeleton variant="rectangular" height={120} sx={{ mb: 3, borderRadius: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 2 }} />
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
        <Button 
          component={Link} 
          to="/incidents" 
          variant="outlined" 
          startIcon={<ArrowBackIcon />}
        >
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
      {/* Compact Header */}
      <Box sx={{ mb: 2 }}>
        {/* Back link */}
        <Box 
          component={Link}
          to="/incidents"
          sx={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 0.5, 
            color: '#22b8cf', 
            textDecoration: 'none',
            mb: 2,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2">Back to Incidents</Typography>
        </Box>

        {/* Main header card */}
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
        }}>
          {/* Icon */}
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${severityColors[editedSeverity]}15`,
              border: `1px solid ${severityColors[editedSeverity]}30`,
              flexShrink: 0,
            }}
          >
            <TaskAltIcon sx={{ fontSize: 28, color: severityColors[editedSeverity] }} />
          </Box>

          {/* Title and meta */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TextField
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  sx: { 
                    fontSize: '1.1rem', 
                    fontWeight: 600,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                    borderRadius: 1,
                    px: 0.5,
                  },
                }}
                sx={{ flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              {/* Status badge (read-only) */}
              <Chip
                label={statusConfig[editedStatus]?.label || editedStatus.replace('_', ' ')}
                size="small"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  height: 22,
                  bgcolor: statusConfig[editedStatus]?.bg,
                  color: statusConfig[editedStatus]?.color,
                  '& .MuiChip-label': { px: 1.5 },
                }}
              />
              
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>•</Typography>
              
              {/* Severity dropdown */}
              <FormControl size="small" variant="standard">
                <Select
                  value={editedSeverity}
                  onChange={(e) => setEditedSeverity(e.target.value)}
                  disableUnderline
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: `${severityColors[editedSeverity]}20`,
                    color: severityColors[editedSeverity],
                    borderRadius: 1,
                    px: 1,
                    py: 0.25,
                    textTransform: 'capitalize',
                    '& .MuiSelect-select': { py: 0, pr: 2.5 },
                    '& .MuiSvgIcon-root': { color: severityColors[editedSeverity], fontSize: 16 },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                    }
                  }}
                >
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="informational">Informational</MenuItem>
                </Select>
              </FormControl>
              
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>•</Typography>
              
              {/* Assignee dropdown - styled like chips */}
              <FormControl size="small" variant="standard">
                <Select
                  value={editedAssignee || ''}
                  onChange={(e) => setEditedAssignee(e.target.value)}
                  displayEmpty
                  disableUnderline
                  disabled={usersLoading}
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: editedAssignee ? 'rgba(168, 85, 247, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                    color: editedAssignee ? '#a855f7' : 'text.secondary',
                    borderRadius: 1,
                    px: 1,
                    py: 0.25,
                    '& .MuiSelect-select': { py: 0, pr: 2.5 },
                    '& .MuiSvgIcon-root': { color: editedAssignee ? '#a855f7' : 'text.secondary', fontSize: 16 },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                    }
                  }}
                  renderValue={(value) => value || 'Unassigned'}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  <MenuItem value="AI Agent">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22c55e' }} />
                      AI Agent
                    </Box>
                  </MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.username}>{user.username}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>•</Typography>
              
              {/* Last edited */}
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 12 }} />
                {incident.editedTs ? formatTimestamp(incident.editedTs) : formatTimestamp(incident.createdTs)}
              </Typography>
            </Box>
          </Box>

          {/* Right side actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isSaving && <CircularProgress size={18} />}
            
            <Tooltip title="Refresh">
              <IconButton 
                size="small"
                onClick={() => loadIncident(false)}
                sx={{ 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1,
                  width: 32,
                  height: 32,
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Button 
              variant="outlined"
              size="small"
              startIcon={<SecurityIcon sx={{ fontSize: 16 }} />}
              onClick={() => toast.info('Enrich functionality coming soon')}
              disabled={isSaving}
              sx={{ 
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                height: 32,
                minWidth: 'auto',
                px: 1.5,
                '&:hover': { borderColor: '#22b8cf', bgcolor: 'rgba(34, 184, 207, 0.1)' },
              }}
            >
              Enrich
            </Button>

            <Button 
              variant="outlined"
              size="small"
              startIcon={<AutoFixHighIcon sx={{ fontSize: 16 }} />}
              onClick={() => toast.info('AI Agent functionality coming soon')}
              disabled={isSaving}
              sx={{ 
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                height: 32,
                minWidth: 'auto',
                px: 1.5,
                '&:hover': { borderColor: '#a855f7', bgcolor: 'rgba(168, 85, 247, 0.1)' },
              }}
            >
              AI Agent
            </Button>

            {!isResolved && (
              <Button 
                variant="outlined"
                size="small"
                onClick={() => setShowResolveDialog(true)} 
                disabled={isSaving}
                sx={{ 
                  borderColor: '#22c55e',
                  color: '#22c55e',
                  height: 32,
                  minWidth: 'auto',
                  px: 2,
                  '&:hover': { borderColor: '#22c55e', bgcolor: 'rgba(34, 197, 94, 0.1)' },
                }}
              >
                Resolve
              </Button>
            )}

          </Box>
        </Box>
      </Box>

      {/* Main content with Activity sidebar */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, mt: 2 }}>
        {/* Left content area */}
        <Box sx={{ flex: 1, minWidth: 0, order: { xs: 1, lg: 0 } }}>
          {/* Modern Pill Tabs */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 2,
          }}>
            <Box sx={{ 
              display: 'flex', 
              gap: 0.5, 
              p: 0.5, 
              bgcolor: 'rgba(255,255,255,0.03)', 
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {[
                { label: 'Tasks', count: tasks.length > 0 ? `${tasks.filter(t => t.completed).length}/${tasks.length}` : null },
                { label: 'Details', count: null },
                { label: 'Observables', count: editedObservables.length > 0 ? editedObservables.length : null },
                { label: 'Correlations', count: correlations.length > 0 ? correlations.length : null, loading: correlationsLoading },
              ].map((tab, index) => (
                <Box
                  key={tab.label}
                  onClick={() => setActiveTab(index)}
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    transition: 'all 0.2s ease',
                    bgcolor: activeTab === index ? 'rgba(255, 102, 0, 0.15)' : 'transparent',
                    color: activeTab === index ? '#ff6600' : 'text.secondary',
                    fontWeight: activeTab === index ? 600 : 400,
                    fontSize: '0.875rem',
                    '&:hover': {
                      bgcolor: activeTab === index ? 'rgba(255, 102, 0, 0.15)' : 'rgba(255,255,255,0.05)',
                    },
                  }}
                >
                  {tab.label}
                  {tab.loading ? (
                    <CircularProgress size={12} sx={{ color: 'text.secondary' }} />
                  ) : tab.count !== null && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: activeTab === index ? 'rgba(255, 102, 0, 0.3)' : 'rgba(255,255,255,0.08)',
                        color: activeTab === index ? '#ff6600' : 'text.secondary',
                      }}
                    >
                      {tab.count}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Tab Content */}
      {activeTab === 0 && (
        /* Tasks Tab */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Tasks Section - inline, no collapsible wrapper */}
          <Box sx={{ 
            bgcolor: 'rgba(255,255,255,0.02)', 
            borderRadius: 2, 
            border: '1px solid rgba(255,255,255,0.06)',
            p: 2.5,
          }}>
            {/* Progress bar */}
            {tasks.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Progress
                  </Typography>
                  <Typography variant="caption" sx={{ color: getTaskProgress() === 100 ? '#22c55e' : 'text.secondary' }}>
                    {getTaskProgress()}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={getTaskProgress()} 
                  sx={{ 
                    height: 4, 
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getTaskProgress() === 100 ? '#22c55e' : '#ff6600',
                      borderRadius: 2,
                    },
                  }} 
                />
              </Box>
            )}

            {/* Add task input + template button */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <MentionInput
                size="small"
                value={newTaskTitle}
                onChange={setNewTaskTitle}
                onSubmit={handleAddTask}
                placeholder="Add a task... (type @ to assign)"
                fullWidth
                sx={inputSx}
              />
              <IconButton onClick={handleAddTask} disabled={!newTaskTitle.trim()} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <AddIcon />
              </IconButton>
              <Box sx={{ position: 'relative' }}>
                <Tooltip title="Apply template">
                  <IconButton 
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)} 
                    sx={{ bgcolor: 'rgba(255, 102, 0, 0.15)', color: '#ff6600', '&:hover': { bgcolor: 'rgba(255, 102, 0, 0.25)' } }}
                  >
                    <PlaylistAddIcon />
                  </IconButton>
                </Tooltip>
                {showTemplateMenu && (
                  <Box sx={{ 
                    position: 'absolute', 
                    top: '100%', 
                    right: 0, 
                    mt: 1, 
                    bgcolor: '#2a2a2a', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 1,
                    py: 1,
                    minWidth: 200,
                    zIndex: 10,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}>
                    <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Apply Template
                    </Typography>
                    {caseTemplates.map((template) => (
                      <Box 
                        key={template.id}
                        onClick={() => handleApplyTemplate(template)}
                        sx={{ 
                          px: 2, 
                          py: 1, 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {template.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {template.tasks.length} tasks
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Task list */}
            {tasks.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {tasks.map((task) => {
                  const isBlocked = isTaskBlocked(task);
                  const dependencyTask = task.dependsOn ? tasks.find(t => t.title === task.dependsOn) : null;
                  const isExpanded = expandedTaskId === task.id;
                  const categoryInfo = taskCategories.find(c => c.value === task.category);
                  
                  return (
                    <Box key={task.id}>
                      {/* Task Header Row */}
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: isExpanded ? '8px 8px 0 0' : 1,
                          bgcolor: task.completed ? 'rgba(34, 197, 94, 0.08)' : isBlocked ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)',
                          border: '1px solid',
                          borderColor: task.completed ? 'rgba(34, 197, 94, 0.2)' : isBlocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                          borderBottom: isExpanded ? 'none' : undefined,
                          opacity: isBlocked ? 0.6 : 1,
                        }}
                      >
                        {/* Expand toggle */}
                        <IconButton 
                          size="small" 
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          sx={{ p: 0.25, color: 'text.secondary' }}
                        >
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                        
                        <IconButton 
                          size="small" 
                          onClick={() => !isBlocked && handleToggleTask(task.id)}
                          disabled={isBlocked}
                          sx={{ 
                            p: 0.5,
                            color: task.completed ? '#22c55e' : 'text.secondary',
                          }}
                        >
                          {task.completed ? (
                            <CheckCircleIcon fontSize="small" />
                          ) : (
                            <Box sx={{ 
                              width: 18, 
                              height: 18, 
                              borderRadius: '50%', 
                              border: '2px solid currentColor',
                            }} />
                          )}
                        </IconButton>
                        
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <MentionInput
                              value={task.title}
                              onChange={(value) => handleUpdateTaskTitle(task.id, value)}
                              size="small"
                              variant="standard"
                              placeholder="Task title..."
                              InputProps={{
                                disableUnderline: true,
                                sx: { 
                                  fontSize: '0.875rem',
                                  textDecoration: task.completed ? 'line-through' : 'none',
                                  color: task.completed ? 'text.secondary' : 'text.primary',
                                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                                  borderRadius: 0.5,
                                  px: 0.5,
                                },
                              }}
                              sx={{ flex: 1, minWidth: 120 }}
                            />
                            {categoryInfo && (
                              <Chip
                                size="small"
                                label={categoryInfo.label}
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 500,
                                  bgcolor: `${categoryInfo.color}20`,
                                  color: categoryInfo.color,
                                  border: `1px solid ${categoryInfo.color}40`,
                                }}
                              />
                            )}
                            {task.assignee === 'AI Agent' && (
                              <Chip
                                size="small"
                                label={task.aiWorking ? 'AI Working...' : 'AI Agent'}
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  bgcolor: task.aiWorking ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                                  color: '#22c55e',
                                  border: task.aiWorking ? '1px solid rgba(34, 197, 94, 0.4)' : 'none',
                                  animation: task.aiWorking ? 'pulse 2s infinite' : 'none',
                                  '@keyframes pulse': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0.6 },
                                  },
                                }}
                              />
                            )}
                          </Box>
                          {isBlocked && dependencyTask && (
                            <Typography variant="caption" sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              ⏳ Waiting on: {dependencyTask.title}
                            </Typography>
                          )}
                        </Box>
                        
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={task.assignee || ''}
                            onChange={(e) => handleUpdateTaskAssignee(task.id, e.target.value)}
                            variant="standard"
                            disableUnderline
                            displayEmpty
                            disabled={usersLoading}
                            sx={{ fontSize: '0.75rem' }}
                          >
                            <MenuItem value=""><em>Unassigned</em></MenuItem>
                            <MenuItem value="AI Agent" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box component="span" sx={{ 
                                width: 6, 
                                height: 6, 
                                borderRadius: '50%', 
                                bgcolor: '#22c55e',
                                display: 'inline-block',
                              }} />
                              AI Agent
                            </MenuItem>
                            {users.map((user) => (
                              <MenuItem key={user.id} value={user.username}>{user.username}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        
                        <TaskDateTimePicker
                          value={task.dueDate || ''}
                          onChange={(value) => handleUpdateTaskDueDate(task.id, value)}
                        />
                        
                        <Box sx={{ width: 16 }} />
                        
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteTask(task.id)}
                          sx={{ 
                            color: 'text.disabled',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 1,
                            '&:hover': { 
                              color: '#ef4444',
                              bgcolor: 'rgba(239, 68, 68, 0.1)',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                            } 
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      {/* Expanded Task Details */}
                      <Collapse in={isExpanded}>
                        <Box sx={{
                          p: 2,
                          pt: 1.5,
                          bgcolor: task.completed ? 'rgba(34, 197, 94, 0.04)' : 'rgba(0,0,0,0.15)',
                          borderRadius: '0 0 8px 8px',
                          border: '1px solid',
                          borderColor: task.completed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.08)',
                          borderTop: 'none',
                        }}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, mb: 2 }}>
                            {/* Category selector */}
                            <FormControl size="small" fullWidth>
                              <InputLabel>Category</InputLabel>
                              <Select
                                value={task.category || ''}
                                label="Category"
                                onChange={(e) => handleUpdateTaskCategory(task.id, e.target.value)}
                                sx={{
                                  bgcolor: 'rgba(0,0,0,0.2)',
                                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                                }}
                              >
                                <MenuItem value=""><em>No category</em></MenuItem>
                                {taskCategories.map((cat) => (
                                  <MenuItem key={cat.value} value={cat.value}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Box sx={{ 
                                        width: 10, 
                                        height: 10, 
                                        borderRadius: '50%', 
                                        bgcolor: cat.color,
                                      }} />
                                      {cat.label}
                                    </Box>
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                          
                          {/* Description textarea with mention support */}
                          <MentionInput
                            value={task.description || ''}
                            onChange={(value) => handleUpdateTaskDescription(task.id, value)}
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            placeholder="Add task details, notes, or instructions... (type @ to mention)"
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                bgcolor: 'rgba(0, 0, 0, 0.2)',
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                              },
                            }}
                          />
                          
                          {/* File attachments */}
                          <Box sx={{ mt: 1.5 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                              Attachments
                            </Typography>
                            <FileAttachments
                              attachments={task.attachments || []}
                              onChange={(attachments) => handleUpdateTaskAttachments(task.id, attachments)}
                              namespace="incidents"
                              labels={[`task-${task.id}`, incident.id]}
                              compact
                            />
                          </Box>
                          
                          {/* Task metadata */}
                          <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                              Created: {new Date(task.createdAt).toLocaleDateString()}
                            </Typography>
                            {task.createdBy && (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                By: {task.createdBy}
                              </Typography>
                            )}
                            {task.completedAt && (
                              <Typography variant="caption" sx={{ color: '#22c55e' }}>
                                Completed: {new Date(task.completedAt).toLocaleDateString()}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                No tasks yet. Add a task or apply a template to get started.
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {activeTab === 1 && (
        /* Details Tab */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Description */}
          <Section title="Description" icon={DescriptionIcon} defaultOpen={true}>
            <MentionInput
              value={editedMessage}
              onChange={setEditedMessage}
              fullWidth
              multiline
              rows={3}
              placeholder="Add a description... (type @ to mention)"
              size="small"
              sx={inputSx}
            />
          </Section>

          {/* Metrics Section */}
          <Section title="Metrics" icon={TrendingUpIcon} defaultOpen={false}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: 2, 
            }}>
              {/* MTTD */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTimeIcon sx={{ fontSize: 16, color: metrics?.mttdColor || 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                      MTTD (Time to Detect)
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: metrics?.mttdColor }}>
                    {metrics?.mttd || '—'}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={metrics?.mttdProgress || 0}
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: metrics?.mttdColor,
                      borderRadius: 3,
                    },
                  }} 
                />
                <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
                  Target: &lt;4h
                </Typography>
              </Box>

              {/* MTTR */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: metrics?.isResolved ? '#22c55e' : (metrics?.mttrColor || 'text.secondary') }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                      MTTR (Time to Resolve)
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: metrics?.isResolved ? '#22c55e' : metrics?.mttrColor }}>
                    {metrics?.mttr || (metrics?.isResolved ? '—' : 'In progress')}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant={metrics?.isResolved ? 'determinate' : 'buffer'}
                  value={metrics?.isResolved ? (metrics?.mttrProgress || 0) : 0}
                  valueBuffer={metrics?.mttrProgress || 0}
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: metrics?.isResolved ? '#22c55e' : metrics?.mttrColor,
                      borderRadius: 3,
                    },
                    '& .MuiLinearProgress-dashed': {
                      backgroundSize: '8px 8px',
                    },
                    '& .MuiLinearProgress-bar2Buffer': {
                      bgcolor: `${metrics?.mttrColor}40`,
                    },
                  }} 
                />
                <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
                  Target: &lt;24h
                </Typography>
              </Box>
            </Box>
          </Section>

          {/* Metadata Section */}
          <Section title="Metadata" icon={DescriptionIcon} defaultOpen={true}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>ID</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{incident.id}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Source</Typography>
                <Typography variant="body2">{incident.source}</Typography>
              </Box>
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
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Age</Typography>
                <Typography variant="body2">{metrics?.age}</Typography>
              </Box>
            </Box>

            {/* Attachments - inline like task attachments */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Attachments
              </Typography>
              <FileAttachments
                attachments={incidentAttachments}
                onChange={setIncidentAttachments}
                namespace="incidents"
                labels={[incident.id]}
              />
            </Box>
          </Section>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <Section title="Custom Fields" icon={SettingsIcon} defaultOpen={false}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                {customFields.map((field) => renderCustomField(field))}
              </Box>
            </Section>
          )}

          {/* References */}
          <Section 
            title="References" 
            icon={LinkIcon} 
            defaultOpen={editedReferences.length > 0}
            badge={editedReferences.length > 0 ? editedReferences.length : undefined}
          >
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
          </Section>
        </Box>
      )}

      {activeTab === 2 && (
        /* Observables Tab */
        <Box sx={{ 
          bgcolor: 'rgba(255,255,255,0.02)', 
          borderRadius: 2, 
          border: '1px solid rgba(255,255,255,0.06)',
          p: 2.5,
        }}>
          {/* Add Observable input */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <ObservableTypeSelector
              value={newObservableType}
              onChange={setNewObservableType}
              iocTypes={iocTypes}
              onTypeCreated={refetchIOCTypes}
            />
            <TextField
              size="small"
              value={newObservableValue}
              onChange={(e) => setNewObservableValue(e.target.value)}
              placeholder="Enter observable value..."
              fullWidth
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObservable())}
              sx={inputSx}
            />
            <IconButton onClick={handleAddObservable} disabled={!newObservableValue.trim()} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
              <AddIcon />
            </IconButton>
          </Box>
          
          {/* Observables list */}
          {editedObservables.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {editedObservables.map((obs, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    p: 1.5, 
                    borderRadius: 1, 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Chip 
                    label={obs.type} 
                    size="small" 
                    sx={{ 
                      fontWeight: 600, 
                      fontSize: '0.7rem',
                      bgcolor: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                    }} 
                  />
                  <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {obs.value}
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => handleRemoveObservable(idx)}
                    sx={{ 
                      p: 0.5, 
                      color: 'text.disabled',
                      '&:hover': { color: '#ef4444' },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 4 }}>
              No observables added. Add IOCs, IPs, domains, hashes, or other indicators.
            </Typography>
          )}
        </Box>
      )}

      {activeTab === 3 && (
        /* Correlations Tab */
        <Box sx={{
          bgcolor: 'rgba(255,255,255,0.02)', 
          borderRadius: 2, 
          border: '1px solid rgba(255,255,255,0.06)',
          p: 2.5,
        }}>
          {correlationsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : correlations.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              No correlations found for this incident
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Correlation summary */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                p: 2, 
                bgcolor: 'rgba(255, 102, 0, 0.08)', 
                borderRadius: 1.5,
                border: '1px solid rgba(255, 102, 0, 0.2)',
              }}>
                <Box sx={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 1, 
                  bgcolor: 'rgba(255, 102, 0, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <LinkIcon sx={{ color: '#ff6600' }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {correlations.length} Shared Attribute{correlations.length !== 1 ? 's' : ''}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Values found across multiple datastore categories
                  </Typography>
                </Box>
              </Box>

              {/* Correlation list */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {correlations.map((corr, idx) => {
                  // Group refs by category
                  const refsByCategory: Record<string, string[]> = {};
                  corr.ref.forEach(r => {
                    const [category, key] = r.split('|');
                    if (!refsByCategory[category]) refsByCategory[category] = [];
                    // Exclude current incident from shuffle-security_incidents
                    if (!(category === 'shuffle-security_incidents' && key.toLowerCase() === id?.toLowerCase())) {
                      refsByCategory[category].push(key);
                    }
                  });
                  
                  const categories = Object.keys(refsByCategory);
                  const isHighMatch = corr.amount >= 5;
                  const isMediumMatch = corr.amount >= 3 && corr.amount < 5;
                  
                  // Helper to format category name
                  const formatCategory = (cat: string) => cat.replace('shuffle-', '').replace(/_/g, ' ');
                  
                  return (
                    <Box 
                      key={corr.key || idx} 
                      sx={{ 
                        p: 2, 
                        borderRadius: 1.5, 
                        bgcolor: isHighMatch ? 'rgba(255, 102, 0, 0.05)' : 'rgba(0,0,0,0.2)',
                        border: '1px solid',
                        borderColor: isHighMatch ? 'rgba(255, 102, 0, 0.2)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      {/* Correlation header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: categories.length > 0 ? 1.5 : 0 }}>
                        <Chip 
                          label={corr.key}
                          size="small"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            bgcolor: isHighMatch ? 'rgba(255, 102, 0, 0.15)' : isMediumMatch ? 'rgba(234, 179, 8, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                            color: isHighMatch ? '#ff6600' : isMediumMatch ? '#eab308' : 'text.secondary',
                            fontWeight: 600,
                          }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Found in <strong>{corr.amount}</strong> items across {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Refs by category */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {categories.map(category => {
                          const keys = refsByCategory[category];
                          const isIncidentCategory = category === 'shuffle-security_incidents';
                          
                          return (
                            <Box key={category} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: 'text.disabled', 
                                  minWidth: 100, 
                                  textTransform: 'capitalize',
                                  pt: 0.25,
                                }}
                              >
                                {formatCategory(category)}:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {keys.slice(0, 5).map((key) => (
                                  <Chip
                                    key={key}
                                    label={key}
                                    size="small"
                                    component={isIncidentCategory ? Link : 'div'}
                                    to={isIncidentCategory ? `/incidents/${key}` : undefined}
                                    clickable={isIncidentCategory}
                                    sx={{
                                      height: 22,
                                      fontSize: '0.7rem',
                                      fontFamily: 'monospace',
                                      bgcolor: isIncidentCategory ? 'rgba(255, 102, 0, 0.1)' : 'rgba(255,255,255,0.05)',
                                      color: isIncidentCategory ? '#ff6600' : 'text.secondary',
                                      cursor: isIncidentCategory ? 'pointer' : 'default',
                                      '&:hover': isIncidentCategory ? { bgcolor: 'rgba(255, 102, 0, 0.2)' } : {},
                                    }}
                                  />
                                ))}
                                {keys.length > 5 && (
                                  <Tooltip title={keys.slice(5).join(', ')} arrow>
                                    <Chip
                                      label={`+${keys.length - 5}`}
                                      size="small"
                                      sx={{
                                        height: 22,
                                        fontSize: '0.7rem',
                                        bgcolor: 'rgba(148, 163, 184, 0.1)',
                                        color: 'text.disabled',
                                      }}
                                    />
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>
      )}
        </Box>

        {/* Right Activity Sidebar - Shows at bottom on smaller screens */}
        <Box sx={{ 
          width: { xs: '100%', lg: 380 },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'hsl(var(--card))',
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          overflow: 'hidden',
          maxHeight: { xs: 400, lg: 'calc(100vh - 180px)' },
          order: { xs: 2, lg: 0 },
        }}>
          {/* Activity Header */}
          <Box sx={{ 
            px: 2, 
            py: 1.5, 
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Activity</Typography>
              {activity.length > 0 && (
                <Chip 
                  label={activity.length} 
                  size="small" 
                  sx={{ 
                    height: 18, 
                    fontSize: '0.65rem',
                    bgcolor: 'rgba(255, 102, 0, 0.15)',
                    color: '#ff6600',
                  }} 
                />
              )}
            </Box>
          </Box>

          {/* Comment Input */}
          <Box sx={{ 
            p: 2, 
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255, 102, 0, 0.2)' }}>
                <PersonIcon sx={{ fontSize: 16, color: '#ff6600' }} />
              </Avatar>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ position: 'relative' }}>
                  <MentionInput
                    value={newComment}
                    onChange={setNewComment}
                    onSubmit={() => {
                      if (newComment.trim() || commentAttachments.length > 0) {
                        handleAddComment();
                      }
                    }}
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Add a comment... (Enter to send, Shift+Enter for new line)"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(0, 0, 0, 0.2)',
                        fontSize: '0.8rem',
                        pr: 5,
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                        '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                      },
                    }}
                  />
                  <IconButton 
                    size="small" 
                    onClick={handleAddComment}
                    disabled={!newComment.trim() && commentAttachments.length === 0}
                    sx={{ 
                      position: 'absolute',
                      right: 8,
                      bottom: 8,
                      bgcolor: (newComment.trim() || commentAttachments.length > 0) ? 'rgba(255, 102, 0, 0.15)' : 'transparent',
                      color: (newComment.trim() || commentAttachments.length > 0) ? '#ff6600' : 'text.disabled',
                      '&:hover': { bgcolor: 'rgba(255, 102, 0, 0.25)' },
                    }}
                  >
                    <SendIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                {/* Comment Attachments */}
                <FileAttachments
                  attachments={commentAttachments}
                  onChange={setCommentAttachments}
                  namespace="incidents"
                  labels={[incident.id, 'comments']}
                  compact
                />
              </Box>
            </Box>
          </Box>

          {/* Activity Feed */}
          <Box sx={{ 
            flex: 1, 
            overflowY: 'auto',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}>
            {activity.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                py: 4,
                color: 'text.secondary',
              }}>
                <HistoryIcon sx={{ fontSize: 32, mb: 1, opacity: 0.5 }} />
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  No activity yet
                </Typography>
              </Box>
            ) : (
              [...activity].reverse().map((item) => {
                // Check if user can delete this message (own message within 5 minutes)
                const isOwnMessage = item.user === currentUsername;
                const messageAge = Date.now() - item.timestamp;
                const canDelete = isOwnMessage && item.type === 'comment' && messageAge < 5 * 60 * 1000; // 5 minutes
                const timeRemaining = Math.max(0, Math.ceil((5 * 60 * 1000 - messageAge) / 60000));
                
                return (
                  <Box
                    key={item.id}
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: item.type === 'comment' ? 'rgba(255, 102, 0, 0.05)' : 'rgba(0,0,0,0.15)',
                      border: '1px solid',
                      borderColor: item.type === 'comment' ? 'rgba(255, 102, 0, 0.1)' : 'rgba(255,255,255,0.04)',
                      position: 'relative',
                      '&:hover .delete-btn': {
                        opacity: 1,
                      },
                    }}
                  >
                    <Avatar sx={{ 
                      width: 24, 
                      height: 24, 
                      bgcolor: item.type === 'comment' ? 'rgba(255, 102, 0, 0.2)' : 'rgba(255,255,255,0.08)',
                    }}>
                      {getActivityIcon(item.type)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                          {item.user}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                          {formatRelativeTime(item.timestamp)}
                        </Typography>
                      </Box>
                      <MentionText 
                        text={item.content} 
                        sx={{ fontSize: '0.8rem', color: 'text.secondary' }}
                      />
                      {/* Display attachments if present */}
                      {item.attachments && item.attachments.length > 0 && (
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {item.attachments.map((att, i) => (
                            <Chip
                              key={i}
                              label={att.filename}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                bgcolor: 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6',
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                    {/* Delete button for own messages within 5 minutes */}
                    {canDelete && (
                      <Tooltip title={`Delete (${timeRemaining}m left)`} arrow>
                        <IconButton
                          className="delete-btn"
                          size="small"
                          onClick={() => {
                            // Remove the message from activity
                            setActivity(prev => prev.filter(a => a.id !== item.id));
                            // Trigger save
                            pendingSaveRef.current = true;
                            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                            saveTimeoutRef.current = setTimeout(() => {
                              saveToDatastore();
                            }, 500);
                            toast.success('Message deleted');
                          }}
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 20,
                            height: 20,
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            bgcolor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            '&:hover': {
                              bgcolor: 'rgba(239, 68, 68, 0.2)',
                            },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>


      <ResolveIncidentDialog
        open={showResolveDialog}
        onClose={() => setShowResolveDialog(false)}
        onResolve={handleResolve}
        incidentTitle={incident?.title || ''}
        isLoading={isSaving}
      />
    </motion.div>
  );
};

export default IncidentDetailPage;
