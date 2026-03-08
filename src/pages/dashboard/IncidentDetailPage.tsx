import { useState, useEffect, useMemo, useCallback, useRef, forwardRef } from 'react';
import AgentIcon from '@/components/agent/AgentIcon';
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
  Dialog,
  DialogTitle,
  DialogContent,
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
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ForwardIcon from '@mui/icons-material/Forward';
import CloseIcon from '@mui/icons-material/Close';
import Menu from '@mui/material/Menu';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { useAppDetail } from '@/context/AppDetailContext';
import { DATASTORE_CATEGORIES, getDatastoreItem, getDatastoreItemPublic, setDatastoreItem } from '@/services/datastore';
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
import { isAIAssignee, deduplicateTasks, htmlToPlainText, decodeHtmlEntities, decodeIfBase64 } from '@/lib/utils';
import { useIncidentAgentRuns } from '@/hooks/useIncidentAgentRuns';
import AgentActivityFeed from '@/components/agent/AgentActivityFeed';

// TaskTemplate interface is now imported from useCaseTemplates

interface DisplayIncident {
  id: string;
  title?: string;
  source?: string;
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
  labels?: string[];
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



// Strict check: only return string if it has meaningful non-whitespace content
// Also rejects raw JSON objects/arrays that shouldn't be displayed as text
const meaningfulString = (val: unknown): string | undefined => {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (trimmed.length === 0) return undefined;
  // Reject values that look like serialized JSON objects or arrays
  // Skip JSON.parse for large strings (>10KB) to avoid blocking the main thread
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    if (trimmed.length > 10_000) {
      console.warn(`[Perf] meaningfulString: skipping JSON.parse on large string (${(trimmed.length / 1024).toFixed(1)}KB)`);
      return undefined; // Large JSON-looking strings are never meaningful display strings
    }
    try {
      JSON.parse(trimmed);
      return undefined; // It's valid JSON — not a meaningful display string
    } catch {
      // Not valid JSON, treat as regular string
    }
  }
  return decodeHtmlEntities(trimmed);
};

const parseIncidentFromDatastore = (item: { key: string; value: string; created?: number; edited?: number }): DisplayIncident | null => {
  const parseStart = performance.now();
  try {
    const jsonStart = performance.now();
    const data = JSON.parse(item.value);
    const jsonTime = performance.now() - jsonStart;
    if (jsonTime > 5) {
      console.warn(`[Perf] JSON.parse took ${jsonTime.toFixed(1)}ms for incident ${item.key} (${(item.value.length / 1024).toFixed(1)}KB)`);
    }
    
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
      
      // Read tasks and activity from top level first, fallback to metadata
      const topLevelTasks = (data as any).tasks;
      const topLevelActivity = (data as any).activity;
      const metadataTasks = customAttrs?.tasks;
      const metadataActivity = (customAttrs as any)?.activity;
      const tasks = topLevelTasks || metadataTasks || [];
      const activity = topLevelActivity || metadataActivity || [];
      
      // Convert comments to activity for display (legacy format support)
      const comments = customAttrs?.comments || [];
      const activityFromComments: ActivityItem[] = comments.map((c, i) => ({
        id: `comment-${i}`,
        type: 'comment' as const,
        user: c.author,
        timestamp: new Date(c.timestamp).getTime(),
        content: c.text,
      }));
      
      // Use top-level/metadata activity if exists, otherwise fallback to comments
      const mergedActivity = activity.length > 0 ? activity : activityFromComments;
      
      return {
        id: item.key, // Always use datastore key as the canonical ID
        title: meaningfulString(ocsf.title),
        source: meaningfulString(ocsf.product?.name) || meaningfulString(ocsf.types?.[0]),
        severity: mapOCSFSeverity(ocsf.severity_id || 3),
        status: mapOCSFStatus(ocsf.status_id || 1),
        assignee: customAttrs?.assignee || (data as any).assignee || null,
        created: formatTimestamp(item.created),
        createdTs: parseTimestamp(item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: tlpLabel,
        references: ocsf.references,
        observables: customAttrs?.observables || (data as any).observables,
        // Support both customFields and custom_fields naming
        customFields: customAttrs?.customFields || (customAttrs as any)?.custom_fields || (data as any).customFields || (data as any).custom_fields,
        relatedFindings: ocsf.related_events,
        activity: mergedActivity,
        tasks,
        rawOCSF: data, // Store raw data for updates
        labels: Array.isArray(ocsf.types) ? ocsf.types : [],
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
      const customFields = customAttrs?.customFields || (customAttrs as any)?.custom_fields || legacyData.customFields || legacyData.custom_fields;
      
      return {
        id: item.key, // Always use datastore key as the canonical ID
        title: meaningfulString(findingInfo?.title) || meaningfulString(legacyData.message),
        source: meaningfulString(legacyData.metadata?.product?.name) || meaningfulString(findingInfo?.types?.[0]),
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
        labels: Array.isArray(findingInfo?.types) ? findingInfo.types : [],
      };
    }
    
    // Non-OCSF format
    return {
      id: item.key, // Always use datastore key as the canonical ID
      title: meaningfulString(data.title),
      source: meaningfulString(data.source),
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
      tasks: data.tasks || [],
      rawOCSF: data,
    };
  } catch (err) {
    console.error(`[Perf] parseIncidentFromDatastore failed for ${item.key}:`, err);
    return null;
  } finally {
    const totalTime = performance.now() - parseStart;
    if (totalTime > 10) {
      console.warn(`[Perf] parseIncidentFromDatastore total: ${totalTime.toFixed(1)}ms for ${item.key}`);
    }
  }
};

// Collapsible Section Component
const Section = forwardRef<HTMLDivElement, { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: string | number;
}>(({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true,
  badge,
}, ref) => {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <Box ref={ref} sx={{ 
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
});
Section.displayName = 'Section';

const IncidentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userInfo } = useAuth();
  const { openApp } = useAppDetail();
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
  const [editedLabels, setEditedLabels] = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState('');
  
  // Activity/comments
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<FileAttachment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  
  // Tasks
  const [tasks, setTasks] = useState<IncidentTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const TASKS_PER_PAGE = 25;
  const [visibleTaskCount, setVisibleTaskCount] = useState(TASKS_PER_PAGE);
  
  // Incident-level attachments
  const [incidentAttachments, setIncidentAttachments] = useState<FileAttachment[]>([]);
  
  // Description editing state
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState<null | HTMLElement>(null);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [publicAuthorization, setPublicAuthorization] = useState<string>('');
   const [activeTab, setActiveTab] = useState(0); // 0=Tasks, 1=Details, 2=Observables, 3=Correlations, 4=Raw
   const [rawJsonText, setRawJsonText] = useState('');
  const [forwardingApps, setForwardingApps] = useState<Array<{ id: string; name: string; large_image: string; categories: string[] }>>([]);
  const [forwardingAppsLoading, setForwardingAppsLoading] = useState(false);
  const [sourceAppImage, setSourceAppImage] = useState<string | null>(null);
  const [correlations, setCorrelations] = useState<Array<{ key: string; amount: number; ref: string[] }>>([]);
  const [correlationsLoading, setCorrelationsLoading] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef(false);
  // Track the initial normalized values so auto-save doesn't fire on load
  const initialValuesRef = useRef<{
    title: string;
    message: string;
    severity: string;
    assignee: string;
    status: string;
    tlp: string;
    references: string;
    observables: string;
    customFields: string;
    tasks: string;
    labels: string;
  } | null>(null);
  
  const { users, loading: usersLoading } = useUsers();
  const { fields: customFields } = useCustomFields();
  const { observableTypeNames, iocTypes, refetch: refetchIOCTypes } = useIOCTypes();
  const { templates: caseTemplates, trackUsage: trackTemplateUsage } = useCaseTemplates();
  const { addItem } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });

  // Fetch agent runs for this incident — deferred until incident loaded
  const { runsForIncident: agentRuns, isLoading: agentRunsLoading } = useIncidentAgentRuns(!loading ? id : undefined);

  // Fetch source app image when incident source is known
  useEffect(() => {
    if (!incident?.source) return;
    const source = incident.source.toLowerCase().replace(/[\s_-]/g, '');
    fetch(getApiUrl('/api/v1/apps/authentication'), {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    })
      .then(r => r.json())
      .then(result => {
        const authData = result.data || result;
        if (Array.isArray(authData)) {
          const match = authData.find((a: any) => {
            const appName = (a.app?.name || '').toLowerCase().replace(/[\s_-]/g, '');
            return appName === source;
          });
          if (match?.app?.large_image) {
            setSourceAppImage(match.app.large_image);
          }
        }
      })
      .catch(() => {});
  }, [incident?.source]);

  // Load incident function (reusable for refresh)
  const loadIncident = useCallback(async (showLoading = true) => {
    if (!id) {
      setLoading(false);
      return;
    }

    const loadStart = performance.now();
    if (showLoading) setLoading(true);
    const result = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS);
    const fetchTime = performance.now() - loadStart;
    console.log(`[Perf] Incident fetch: ${fetchTime.toFixed(1)}ms, size: ${((result.item?.value?.length || 0) / 1024).toFixed(1)}KB`);
    
    if (result.success && result.item) {
      setPublicAuthorization(result.item.public_authorization || '');
      const itemData = {
        key: result.item.key || id,
        value: result.item.value,
        created: result.item.created,
        edited: result.item.edited,
      };
      const parseStart = performance.now();
      const parsed = parseIncidentFromDatastore(itemData);
      console.log(`[Perf] parseIncidentFromDatastore: ${(performance.now() - parseStart).toFixed(1)}ms`);
      
      if (parsed) {
        const stateStart = performance.now();
        setIncident(parsed);
        setEditedTitle(parsed.title);
        // Use desc (new OCSF) first, fall back to message (legacy), convert HTML to readable text
        const rawDesc = parsed.rawOCSF?.desc || parsed.rawOCSF?.message || '';
        
        // Try base64 on raw first; if unchanged, strip HTML then try base64 again
        const rawDecoded = decodeIfBase64(rawDesc);
        const processedDesc = rawDecoded !== rawDesc 
          ? rawDecoded 
          : decodeIfBase64(htmlToPlainText(rawDesc));
        setEditedMessage(htmlToPlainText(processedDesc));
        setEditedSeverity(parsed.severity);
        // Normalize assignee: must be a valid team member or AI Agent
        const rawAssignee = parsed.assignee || '';
        const normalizedAssignee = (() => {
          if (isAIAssignee(rawAssignee)) return 'AI Agent';
          // Check if assignee is a valid team member (will be validated after users load)
          return rawAssignee;
        })();
        setEditedAssignee(normalizedAssignee);
        setEditedStatus(parsed.status);
        setEditedTlp(parsed.tlp || 'TLP:AMBER');
        const rawRefs = parsed.references;
        setEditedReferences(
          Array.isArray(rawRefs) ? rawRefs :
          typeof rawRefs === 'string' ? (() => { try { const p = JSON.parse(rawRefs); return Array.isArray(p) ? p : []; } catch { return []; } })() :
          []
        );
        setEditedObservables(parsed.observables || []);
        const customAttrs = parsed.rawOCSF?.metadata?.extensions?.custom_attributes;
        // Support both customFields and custom_fields naming at various levels
        let loadedCustomFields: any = 
          (parsed.rawOCSF as any)?.customFields ||
          (parsed.rawOCSF as any)?.custom_fields ||
          customAttrs?.customFields ||
          (customAttrs as any)?.custom_fields ||
          parsed.customFields ||
          {};
        
        // If customFields resolved to a JSON string, parse it into an object
        if (typeof loadedCustomFields === 'string') {
          console.warn('[CustomFields] customFields was a string, parsing:', loadedCustomFields.substring(0, 200));
          try {
            const parsed2 = JSON.parse(loadedCustomFields);
            if (parsed2 && typeof parsed2 === 'object' && !Array.isArray(parsed2)) {
              loadedCustomFields = parsed2;
            } else {
              console.warn('[CustomFields] Parsed value is not a plain object, ignoring');
              loadedCustomFields = {};
            }
          } catch {
            console.warn('[CustomFields] Failed to parse string as JSON, ignoring');
            loadedCustomFields = {};
          }
        } else if (Array.isArray(loadedCustomFields)) {
          console.warn('[CustomFields] customFields was an array, converting to empty object');
          loadedCustomFields = {};
        }
        
        // Flatten object values to strings — APIs like Notion return nested objects
        const flattenedCustomFields: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(loadedCustomFields)) {
          if (v === null || v === undefined) {
            flattenedCustomFields[k] = '';
          } else if (typeof v === 'object') {
            // Try to extract a meaningful string from common patterns
            const obj = v as any;
            const meaningful = obj.name || obj.title || obj.label || obj.value || obj.display || obj.text;
            if (typeof meaningful === 'string') {
              flattenedCustomFields[k] = meaningful;
            } else {
              flattenedCustomFields[k] = JSON.stringify(v);
            }
            console.log(`[CustomFields] Flattened object field "${k}":`, typeof v, '->', flattenedCustomFields[k]?.toString().substring(0, 100));
          } else {
            flattenedCustomFields[k] = v as string | number | boolean;
          }
        }
        
        // Log custom fields size — large custom_fields are a known perf bottleneck
        const cfStr = JSON.stringify(flattenedCustomFields);
        if (cfStr.length > 5_000) {
          console.warn(`[Perf] customFields is large: ${(cfStr.length / 1024).toFixed(1)}KB`);
        }
        console.log('[CustomFields] Loaded fields:', Object.keys(flattenedCustomFields));
        
        setEditedCustomFields(flattenedCustomFields);
        setEditedLabels(parsed.labels || []);
        setActivity(parsed.activity || []);
        const loadedTasks = parsed.tasks || customAttrs?.tasks || (parsed.rawOCSF as any)?.tasks || [];
        // Ensure all tasks have unique IDs (but don't filter duplicates - just normalize IDs)
        const normalizedTasks = loadedTasks.map((task: IncidentTask, index: number) => ({
          ...task,
          id: task.id || `task-${Date.now()}-${index}`,
        }));
        setTasks(normalizedTasks);
        // Snapshot the normalized values so auto-save won't fire on load
        // Pre-stringify here (once) so auto-save comparisons are cheap
        const refsStr = JSON.stringify(parsed.references || []);
        const obsStr = JSON.stringify(parsed.observables || []);
        const tasksStr = JSON.stringify(normalizedTasks);
        const labelsStr = JSON.stringify(parsed.labels || []);
        initialValuesRef.current = {
          title: parsed.title,
          message: htmlToPlainText(processedDesc),
          severity: parsed.severity,
          assignee: normalizedAssignee,
          status: parsed.status,
          tlp: parsed.tlp || 'TLP:AMBER',
          references: refsStr,
          observables: obsStr,
          customFields: cfStr,
          tasks: tasksStr,
          labels: labelsStr,
        };
        console.log(`[Perf] State hydration: ${(performance.now() - stateStart).toFixed(1)}ms`);
        // Auto-switch to Details tab if no tasks (only on initial load)
        if (showLoading && loadedTasks.length === 0) {
          setActiveTab(1);
        }
        setLoading(false);
        console.log(`[Perf] Total loadIncident: ${(performance.now() - loadStart).toFixed(1)}ms`);
        return;
      }
    }
    
    setLoading(false);
  }, [id]);

  // Initial load
  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  // Validate assignee against team members once users finish loading
  useEffect(() => {
    if (usersLoading || !editedAssignee) return;
    
    // AI Agent is always valid
    if (isAIAssignee(editedAssignee)) {
      if (editedAssignee !== 'AI Agent') {
        setEditedAssignee('AI Agent');
        // Update snapshot so this normalization isn't treated as a user change
        if (initialValuesRef.current) {
          initialValuesRef.current.assignee = 'AI Agent';
        }
      }
      return;
    }
    
    // Check if assignee is a valid team member
    const validUsernames = users.map(u => u.username.toLowerCase());
    if (!validUsernames.includes(editedAssignee.toLowerCase())) {
      // Invalid assignee - clear it
      setEditedAssignee('');
      // Update snapshot so this normalization isn't treated as a user change
      if (initialValuesRef.current) {
        initialValuesRef.current.assignee = '';
      }
    }
  }, [usersLoading, users, editedAssignee]);

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

  // Fetch correlations — deferred until incident is loaded to avoid blocking the UI
  useEffect(() => {
    const fetchCorrelations = async () => {
      if (!id || loading) return;
      
      setCorrelationsLoading(true);
      try {
        const response = await fetch(getApiUrl('/api/v2/correlations'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
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
  }, [id, loading]);

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
    
    // CRITICAL: Never use undefined - always use empty values to prevent field deletion
    const updatedData = incident.rawOCSF ? {
      ...incident.rawOCSF,
      desc: editedMessage || editedTitle,
      message: editedMessage || editedTitle,
      severity_id: severityOption?.id || 3,
      severity: severityOption?.label || 'Medium',
      status_id: statusId,
      status: statusLabel,
      assignee: editedAssignee.trim() || '',
      types: editedLabels, // OCSF types[] field for labels
      observables: editedObservables, // Always include, even if empty array
      // Store tasks and activity at top level (primary location)
      tasks: tasks, // Always include, even if empty array
      activity: activity, // Always include, even if empty array
      finding_info_list: [{
        ...existingFindingInfo,
        title: editedTitle,
        references: editedReferences, // Always include, even if empty array
        src_url: editedReferences[0] || '',
      }],
      metadata: {
        ...incident.rawOCSF.metadata,
        extensions: {
          ...incident.rawOCSF.metadata?.extensions,
          custom_attributes: {
            ...incident.rawOCSF.metadata?.extensions?.custom_attributes,
            tlp: editedTlp,
            assignee: editedAssignee.trim() || '', // Sync metadata assignee with top-level
            customFields: editedCustomFields, // Always include, even if empty object
          },
        },
      },
    } : {
      id: incident.id,
      title: editedTitle,
      source: incident.source,
      severity: editedSeverity,
      status: editedStatus,
      assignee: editedAssignee.trim() || '',
      tlp: editedTlp,
      references: editedReferences,
      observables: editedObservables,
      customFields: editedCustomFields,
      activity: activity,
      tasks: tasks,
    };

    try {
      await addItem(incident.id, updatedData);
      // Update the initial snapshot so future comparisons are against the saved state
      // Use cached JSON refs to avoid redundant serialization
      initialValuesRef.current = {
        title: editedTitle,
        message: editedMessage,
        severity: editedSeverity,
        assignee: editedAssignee,
        status: editedStatus,
        tlp: editedTlp,
        references: refsJsonRef.current,
        observables: obsJsonRef.current,
        customFields: cfJsonRef.current,
        tasks: tasksJsonRef.current,
        labels: labelsJsonRef.current,
      };
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [incident, editedTitle, editedMessage, editedSeverity, editedAssignee, editedStatus, editedTlp, editedReferences, editedObservables, editedCustomFields, editedLabels, activity, tasks, addItem]);

  // Cache stringified complex values to avoid re-serializing on every render
  const tasksJsonRef = useRef('');
  const refsJsonRef = useRef('');
  const obsJsonRef = useRef('');
  const cfJsonRef = useRef('');
  const labelsJsonRef = useRef('');
  useEffect(() => { tasksJsonRef.current = JSON.stringify(tasks); }, [tasks]);
  useEffect(() => { refsJsonRef.current = JSON.stringify(editedReferences); }, [editedReferences]);
  useEffect(() => { obsJsonRef.current = JSON.stringify(editedObservables); }, [editedObservables]);
  useEffect(() => { labelsJsonRef.current = JSON.stringify(editedLabels); }, [editedLabels]);
  useEffect(() => {
    const start = performance.now();
    cfJsonRef.current = JSON.stringify(editedCustomFields);
    const elapsed = performance.now() - start;
    if (elapsed > 5) {
      console.warn(`[Perf] JSON.stringify(customFields) took ${elapsed.toFixed(1)}ms (${(cfJsonRef.current.length / 1024).toFixed(1)}KB)`);
    }
  }, [editedCustomFields]);

  // Debounced auto-save
  useEffect(() => {
    if (!incident || !initialValuesRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Compare against the initial normalized values, not raw data
    // Uses cached JSON strings to avoid re-serializing large objects every render
    const init = initialValuesRef.current;
    const changedFields: string[] = [];
    if (editedTitle !== init.title) changedFields.push(`title: "${editedTitle}" vs "${init.title}"`);
    if (editedMessage !== init.message) changedFields.push(`message: "${editedMessage.slice(0, 60)}..." vs "${init.message.slice(0, 60)}..."`);
    if (editedSeverity !== init.severity) changedFields.push(`severity: "${editedSeverity}" vs "${init.severity}"`);
    if (editedAssignee !== init.assignee) changedFields.push(`assignee: "${editedAssignee}" vs "${init.assignee}"`);
    if (editedStatus !== init.status) changedFields.push(`status: "${editedStatus}" vs "${init.status}"`);
    if (editedTlp !== init.tlp) changedFields.push(`tlp: "${editedTlp}" vs "${init.tlp}"`);
    if (refsJsonRef.current !== init.references) changedFields.push('references');
    if (obsJsonRef.current !== init.observables) changedFields.push('observables');
    if (cfJsonRef.current !== init.customFields) changedFields.push('customFields');
    if (tasksJsonRef.current !== init.tasks) changedFields.push('tasks');
    if (labelsJsonRef.current !== init.labels) changedFields.push('labels');
    const hasChanges = changedFields.length > 0;
    
    if (hasChanges) {
      console.log('[AutoSave] Changes detected:', changedFields);
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
  }, [incident, editedTitle, editedMessage, editedSeverity, editedAssignee, editedStatus, editedTlp, editedReferences, editedObservables, editedCustomFields, editedLabels, tasks, saveToDatastore]);

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
      details: {},
      attachments: commentAttachments.length > 0 ? [...commentAttachments] : [],
    };
    
    const updatedActivity = [...activity, commentActivity];
    setActivity(updatedActivity);
    setNewComment('');
    setCommentAttachments([]);
    
    // CRITICAL: Never delete fields - always preserve existing structure
    const updatedOCSF = {
      ...incident.rawOCSF!,
      // Store activity at top level (primary location)
      activity: updatedActivity,
      metadata: {
        ...incident.rawOCSF!.metadata,
        extensions: {
          ...incident.rawOCSF!.metadata?.extensions,
          custom_attributes: {
            ...incident.rawOCSF!.metadata?.extensions?.custom_attributes,
            // Preserve all existing custom attributes
          },
        },
      },
    };
    await addItem(incident.id, updatedOCSF);
    toast.success('Comment added');
  };

  const handleResolve = async (resolutionData: ResolutionData) => {
    if (!incident) return;
    
    // Immediately update local status so auto-save won't revert it
    setEditedStatus('resolved');
    setIsSaving(true);
    
    const reasonLabel = RESOLUTION_REASONS.find(r => r.value === resolutionData.reason)?.label || resolutionData.reason;
    
    const resolveActivity: ActivityItem = {
      id: `status-${Date.now()}`,
      type: 'status',
      user: currentUsername,
      timestamp: Date.now(),
      content: `Resolved: ${reasonLabel}${resolutionData.notes ? ` - ${resolutionData.notes}` : ''}`,
      details: {},
      attachments: [],
    };
    
    const updatedActivity = [...activity, resolveActivity];
    
    const existingFindingInfo = incident.rawOCSF?.finding_info_list?.[0] || (incident.rawOCSF as any)?.finding_info;
    // CRITICAL: Never use undefined - always preserve existing structure
    const resolvedData = incident.rawOCSF ? {
      ...incident.rawOCSF,
      status_id: 3,
      status: 'Resolved',
      status_detail: `${resolutionData.reason}${resolutionData.notes ? `: ${resolutionData.notes}` : ''}`,
      // Store activity at top level (primary location)
      activity: updatedActivity,
      metadata: {
        ...incident.rawOCSF.metadata,
        extensions: {
          ...incident.rawOCSF.metadata?.extensions,
          custom_attributes: {
            ...incident.rawOCSF.metadata?.extensions?.custom_attributes,
            // Preserve all existing custom attributes
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
      assignee: editedAssignee.trim() || '',
      activity: updatedActivity,
      tasks: tasks,
      observables: editedObservables,
      customFields: editedCustomFields,
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
      description: '',
      category: '',
      completed: false,
      assignee: '',
      dueDate: '',
      dependsOn: '',
      createdAt: Date.now(),
      completedAt: 0,
      createdBy: currentUsername,
      attachments: [],
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
            completedAt: !task.completed ? Date.now() : 0 
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
    // Soft delete: mark as disabled instead of removing (preserved for backend persistence)
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, disabled: true } : task
    ));
  };

  const handleApplyTemplate = async (template: CaseTemplate) => {
    autoProgressStatus();
    const newTasks: IncidentTask[] = template.tasks.map((t, index) => ({
      id: `task-${Date.now()}-${index}`,
      title: t.title,
      description: t.description || '',
      category: t.category || '',
      completed: false,
      completedAt: 0,
      assignee: t.assignee || '',
      dependsOn: t.dependsOn || '',
      dueDate: '',
      createdAt: Date.now(),
      createdBy: currentUsername,
      attachments: [],
    }));
    setTasks([...tasks, ...newTasks]);
    setShowTemplateMenu(false);
    await trackTemplateUsage(template.id);
    toast.success(`Applied "${template.name}" template`);
  };

  // Pre-build dependency lookup map to avoid O(n²) searches
  const taskDependencyMap = useMemo(() => {
    const map = new Map<string, IncidentTask>();
    for (const t of tasks) {
      map.set(t.title, t);
    }
    return map;
  }, [tasks]);

  const isTaskBlocked = useCallback((task: IncidentTask): boolean => {
    if (!task.dependsOn) return false;
    const dependencyTask = taskDependencyMap.get(task.dependsOn);
    return dependencyTask ? !dependencyTask.completed : false;
  }, [taskDependencyMap]);

  // Deduplicate tasks for display only — full list is preserved for API persistence
  const visibleTasks = useMemo(() => deduplicateTasks(tasks), [tasks]);

  const taskProgress = useMemo(() => {
    if (visibleTasks.length === 0) return 0;
    const completedCount = visibleTasks.filter(t => t.completed).length;
    return Math.round((completedCount / visibleTasks.length) * 100);
  }, [visibleTasks]);

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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment': return <PersonIcon fontSize="small" />;
      case 'change': return <EditIcon fontSize="small" />;
      case 'status': return <CheckCircleIcon fontSize="small" />;
      case 'assignment': return <PersonIcon fontSize="small" />;
      case 'created': return <AddIcon fontSize="small" />;
      case 'agent': return <AutoFixHighIcon fontSize="small" />;
      default: return <HistoryIcon fontSize="small" />;
    }
  };

  // Agent runs are rendered separately using AgentActivityFeed component

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
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: { xs: '100%', sm: 'auto' }, flex: { sm: 1 }, minWidth: 0 }}>
          {/* Icon */}
          <Box
            sx={{
              width: { xs: 40, sm: 56 },
              height: { xs: 40, sm: 56 },
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: sourceAppImage ? 'transparent' : `${severityColors[editedSeverity]}15`,
              border: sourceAppImage ? 'none' : `1px solid ${severityColors[editedSeverity]}30`,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {sourceAppImage ? (
              <img src={sourceAppImage} alt={incident?.source || ''} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8 }} />
            ) : (
              <TaskAltIcon sx={{ fontSize: 28, color: severityColors[editedSeverity] }} />
            )}
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
              {/* Status dropdown */}
              <FormControl size="small" variant="standard">
                <Select
                  value={editedStatus}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'resolved') {
                      setShowResolveDialog(true);
                      return;
                    }
                    setEditedStatus(val);
                  }}
                  disableUnderline
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: statusConfig[editedStatus]?.color || 'hsl(var(--muted-foreground))',
                    '& .MuiSelect-select': { 
                      py: 0.25, px: 1,
                      borderRadius: 3,
                      bgcolor: statusConfig[editedStatus]?.bg || 'transparent',
                    },
                    '& .MuiSelect-icon': { color: statusConfig[editedStatus]?.color || 'hsl(var(--muted-foreground))', fontSize: 16 },
                  }}
                  renderValue={(val) => statusConfig[val]?.label || val.replace('_', ' ')}
                >
                  {Object.entries(statusConfig).map(([key, cfg]) => {
                    const isDisabled = key === 'on_hold' || key === 'escalated';
                    return (
                      <MenuItem key={key} value={key} disabled={isDisabled} sx={{ fontSize: '0.8rem', gap: 1, opacity: isDisabled ? 0.4 : 1 }}>
                        <cfg.icon size={14} color={cfg.color} />
                        {cfg.label}
                        {isDisabled && <Typography component="span" sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', ml: 'auto' }}>Soon</Typography>}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              
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
                    bgcolor: isAIAssignee(editedAssignee) 
                      ? 'rgba(34, 197, 94, 0.15)' 
                      : editedAssignee 
                        ? 'rgba(251, 146, 60, 0.15)' 
                        : 'rgba(148, 163, 184, 0.1)',
                    color: isAIAssignee(editedAssignee) 
                      ? '#22c55e' 
                      : editedAssignee 
                        ? '#fb923c' 
                        : 'text.secondary',
                    borderRadius: 1,
                    px: 1,
                    py: 0.25,
                    '& .MuiSelect-select': { py: 0, pr: 2.5 },
                    '& .MuiSvgIcon-root': { 
                      color: isAIAssignee(editedAssignee) 
                        ? '#22c55e' 
                        : editedAssignee 
                          ? '#fb923c' 
                          : 'text.secondary', 
                      fontSize: 16 
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                    }
                  }}
                  renderValue={(value) => {
                    if (isAIAssignee(value as string)) {
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AgentIcon size={16} /> AI Agent
                        </Box>
                      );
                    }
                    return value || 'Unassigned';
                  }}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  <MenuItem value="AI Agent">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AgentIcon size={16} />
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
          </Box>

          {/* Right side actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
            {isSaving && <CircularProgress size={18} />}
            {isResyncing && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, borderRadius: 1, backgroundColor: 'rgba(255, 102, 0, 0.08)', border: '1px solid rgba(255, 102, 0, 0.2)' }}>
                <CircularProgress size={14} sx={{ color: '#ff6600' }} />
                <Typography variant="caption" sx={{ color: '#ff6600', fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1, fontSize: '0.75rem' }}>
                  {incident?.source ? `Resyncing from ${incident.source}…` : 'Resyncing…'}
                </Typography>
              </Box>
            )}
            
            <Tooltip title="Refresh">
              <IconButton 
                size="small"
                onClick={() => loadIncident(true)}
                disabled={loading}
                sx={{ 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1,
                  width: 32,
                  height: 32,
                }}
              >
                <RefreshIcon fontSize="small" sx={{ animation: loading ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
              </IconButton>
            </Tooltip>

            {/* Share Dialog */}
            <Dialog
              open={showShareDialog}
              onClose={() => setShowShareDialog(false)}
              maxWidth="sm"
              fullWidth
              PaperProps={{ sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 2 } }}
            >
              <DialogTitle sx={{ pb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Share Incident</Typography>
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                  Anyone with this link can view the incident without logging in.
                </Typography>
              </DialogTitle>
              <DialogContent>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', mb: 0.5, display: 'block' }}>
                    Public link
                  </Typography>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid hsl(var(--border))',
                  }}>
                    <Typography
                      variant="body2"
                      sx={{
                        flex: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--foreground))',
                        wordBreak: 'break-all',
                        minWidth: 0,
                        userSelect: 'all',
                      }}
                    >
                      {`${window.location.origin}/incidents/${incident?.id}?authorization=${publicAuthorization}&org=${userInfo?.active_org?.id || ''}`}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const url = `${window.location.origin}/incidents/${incident?.id}?authorization=${publicAuthorization}&org=${userInfo?.active_org?.id || ''}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Link copied to clipboard');
                      }}
                      sx={{
                        flexShrink: 0,
                        textTransform: 'none',
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' },
                      }}
                    >
                      Copy
                    </Button>
                  </Box>
                  {!publicAuthorization && (
                    <Typography variant="caption" sx={{ color: '#fb923c', mt: 1, display: 'block' }}>
                      No public authorization token found for this incident. The link may not work for unauthenticated users.
                    </Typography>
                  )}
                </Box>
              </DialogContent>
            </Dialog>

            <Tooltip title="Actions">
              <IconButton
                size="small"
                onClick={(e) => setActionsMenuAnchor(e.currentTarget)}
                sx={{ 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1,
                  width: 32,
                  height: 32,
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={actionsMenuAnchor}
              open={Boolean(actionsMenuAnchor)}
              onClose={() => setActionsMenuAnchor(null)}
              PaperProps={{
                sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', minWidth: 160 },
              }}
            >
              {/* Share */}
              <MenuItem
                onClick={() => {
                  setActionsMenuAnchor(null);
                  setShowShareDialog(true);
                }}
              >
                <LinkIcon sx={{ fontSize: 16, mr: 1 }} />
                Share
              </MenuItem>
              {/* Visit Source */}
              <MenuItem disabled>
                <LinkIcon sx={{ fontSize: 16, mr: 1 }} />
                Visit Source
              </MenuItem>
              <Divider />
              {/* Resync */}
              <MenuItem
                disabled={isSaving || !incident?.source || (() => {
                  const product = incident?.rawOCSF?.product || incident?.rawOCSF?.metadata?.product;
                  const name = product?.name;
                  const id = product?.id;
                  const uid = product?.uid;
                  return name && (name === id || name === uid);
                })()}
                onClick={async () => {
                  setActionsMenuAnchor(null);
                  if (!incident?.id) return;
                  const source = incident.source || '';
                  setIsResyncing(true);
                  const label = source ? `Resyncing from ${source}…` : 'Resyncing…';
                  toast.success(label, { duration: 30000 });
                  try {
                    const preResult = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS);
                    const previousEdited = preResult.item?.edited || 0;

                    const response = await fetch(getApiUrl('/api/v1/apps/categories/run'), {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                      },
                      body: JSON.stringify({
                        action: 'get_ticket',
                        category: 'cases',
                        fields: [{ key: 'id', value: incident.id }],
                        app_name: source,
                      }),
                    });
                    if (!response.ok) {
                      toast.error('Resync failed');
                      setIsResyncing(false);
                      return;
                    }
                    setTimeout(async () => {
                      await loadIncident(false);
                      setIsResyncing(false);
                      const postResult = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS);
                      const newEdited = postResult.item?.edited || 0;
                      if (newEdited && newEdited !== previousEdited) {
                        toast.success('Resync complete — update found');
                      } else {
                        toast.info('Resync complete — no changes detected');
                      }
                    }, 30000);
                  } catch {
                    toast.error('Resync failed');
                    setIsResyncing(false);
                  }
                }}
              >
                <RefreshIcon sx={{ fontSize: 16, mr: 1 }} />
                Resync
              </MenuItem>
              {/* Forward */}
              <MenuItem
                disabled
                onClick={() => {
                  setActionsMenuAnchor(null);
                  setShowForwardDialog(true);
                  setForwardingAppsLoading(true);
                  fetch(getApiUrl('/api/v1/apps/authentication'), {
                    credentials: 'include',
                    headers: { ...getAuthHeader() },
                  })
                    .then(r => r.json())
                    .then(result => {
                      const authData = result.data || result;
                      if (Array.isArray(authData)) {
                        const seen = new Set<string>();
                        const apps = authData
                          .filter((a: any) => a.app?.name && a.validation?.valid)
                          .filter((a: any) => {
                            if (seen.has(a.app.name)) return false;
                            seen.add(a.app.name);
                            return true;
                          })
                          .map((a: any) => {
                            const rawCategories = a.app?.categories ?? a.categories ?? a.app?.category ?? a.category ?? [];
                            const categories = Array.isArray(rawCategories)
                              ? rawCategories
                              : typeof rawCategories === 'string'
                                ? [rawCategories]
                                : typeof rawCategories === 'object' && rawCategories !== null
                                  ? Object.keys(rawCategories)
                                  : [];
                            return {
                              id: a.app.name,
                              name: (a.app.name || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                              large_image: a.app.large_image || '',
                              categories,
                            };
                          });
                        setForwardingApps(apps);
                      }
                    })
                    .catch(() => setForwardingApps([]))
                    .finally(() => setForwardingAppsLoading(false));
                }}
              >
                <ForwardIcon sx={{ fontSize: 16, mr: 1 }} />
                Forward
              </MenuItem>
              {!isResolved && <Divider />}
              {!isResolved && (
                <MenuItem
                  disabled={isSaving}
                  onClick={() => {
                    setActionsMenuAnchor(null);
                    setShowResolveDialog(true);
                  }}
                  sx={{ color: '#22c55e' }}
                >
                  <CheckCircleIcon sx={{ fontSize: 16, mr: 1 }} />
                  Resolve
                </MenuItem>
              )}
            </Menu>

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
              alignItems: 'center',
              gap: 0.5, 
              p: 0.5, 
              bgcolor: 'rgba(255,255,255,0.03)', 
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.06)',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}>
              {[
                { label: 'Tasks', count: visibleTasks.length > 0 ? `${visibleTasks.filter(t => t.completed).length}/${visibleTasks.length}` : null },
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

              {/* Spacer pushes Raw tab to the right */}
              <Box sx={{ flex: 1 }} />

              <Box
                onClick={() => {
                  if (incident?.rawOCSF) {
                    // Build a live snapshot merging rawOCSF with current edited fields
                    const severityOption = severityOptions.find(s => s.value === editedSeverity);
                    const statusLabel = editedStatus === 'new' ? 'New' : editedStatus === 'in_progress' ? 'In Progress' : editedStatus === 'on_hold' ? 'On Hold' : 'Resolved';
                    const existingFindingInfo = incident.rawOCSF?.finding_info_list?.[0] || (incident.rawOCSF as any)?.finding_info;
                    const liveSnapshot = {
                      ...incident.rawOCSF,
                      desc: editedMessage || editedTitle,
                      message: editedMessage || editedTitle,
                      severity_id: severityOption?.id || 3,
                      severity: severityOption?.label || 'Medium',
                      status: statusLabel,
                      assignee: editedAssignee.trim() || '',
                      types: editedLabels,
                      observables: editedObservables,
                      tasks,
                      activity,
                      finding_info_list: [{
                        ...existingFindingInfo,
                        title: editedTitle,
                        references: editedReferences,
                        src_url: editedReferences[0] || '',
                      }],
                      metadata: {
                        ...incident.rawOCSF.metadata,
                        extensions: {
                          ...incident.rawOCSF.metadata?.extensions,
                          custom_attributes: {
                            ...incident.rawOCSF.metadata?.extensions?.custom_attributes,
                            tlp: editedTlp,
                            assignee: editedAssignee.trim() || '',
                            customFields: editedCustomFields,
                          },
                        },
                      },
                    };
                    setRawJsonText(JSON.stringify(liveSnapshot, null, 2));
                  }
                  setActiveTab(4);
                }}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  transition: 'all 0.2s ease',
                  bgcolor: activeTab === 4 ? 'rgba(255, 102, 0, 0.15)' : 'transparent',
                  color: activeTab === 4 ? '#ff6600' : 'text.disabled',
                  fontWeight: activeTab === 4 ? 600 : 400,
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  '&:hover': {
                    bgcolor: activeTab === 4 ? 'rgba(255, 102, 0, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: activeTab === 4 ? '#ff6600' : 'text.secondary',
                  },
                }}
              >
                {'{ }'}
              </Box>
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
            {visibleTasks.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Progress
                  </Typography>
                  <Typography variant="caption" sx={{ color: taskProgress === 100 ? '#22c55e' : 'text.secondary' }}>
                    {taskProgress}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={taskProgress} 
                  sx={{ 
                    height: 4, 
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: taskProgress === 100 ? '#22c55e' : '#ff6600',
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

            {/* Task list - paginated for performance */}
            {visibleTasks.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {visibleTasks.slice(0, visibleTaskCount).map((task) => {
                  const isBlocked = isTaskBlocked(task);
                  const dependencyTask = task.dependsOn ? taskDependencyMap.get(task.dependsOn) : null;
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTaskId(isExpanded ? null : task.id);
                          }}
                          sx={{ p: 0.25, color: 'text.secondary' }}
                        >
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                        
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isBlocked) handleToggleTask(task.id);
                          }}
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
                            {/* Use lightweight MentionText for collapsed tasks, MentionInput only when expanded */}
                            {isExpanded ? (
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
                                sx={{ flex: 1, minWidth: 200 }}
                              />
                            ) : (
                              <Box 
                                onClick={() => setExpandedTaskId(task.id)}
                                sx={{ 
                                  flex: 1, 
                                  minWidth: 200, 
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  textDecoration: task.completed ? 'line-through' : 'none',
                                  color: task.completed ? 'text.secondary' : 'text.primary',
                                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                                  borderRadius: 0.5,
                                  px: 0.5,
                                  py: 0.25,
                                }}
                              >
                                <MentionText text={task.title} />
                              </Box>
                            )}
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
                              <AgentIcon size={16} />
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(task.id);
                          }}
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
                            {task.createdAt > 0 && (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                Created: {new Date(task.createdAt).toLocaleString()}
                              </Typography>
                            )}
                            {task.createdBy && (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                By: {task.createdBy}
                              </Typography>
                            )}
                            {task.completedAt > 0 && (
                              <Typography variant="caption" sx={{ color: '#22c55e' }}>
                                Completed: {new Date(task.completedAt).toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}

                {/* Show more button for pagination */}
                {visibleTasks.length > visibleTaskCount && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                    <Box
                      component="button"
                      onClick={() => setVisibleTaskCount(prev => prev + TASKS_PER_PAGE)}
                      sx={{
                        px: 3,
                        py: 1,
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        color: 'text.secondary',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255, 102, 0, 0.1)',
                          borderColor: 'rgba(255, 102, 0, 0.3)',
                          color: '#ff6600',
                        },
                      }}
                    >
                      Show more ({visibleTasks.length - visibleTaskCount} remaining)
                    </Box>
                  </Box>
                )}
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
          {/* Metadata Section - now includes Description */}
          <Section title="Metadata" icon={DescriptionIcon} defaultOpen={true}>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
              {/* Description on the left */}
              <Box sx={{ flex: '1 1 50%', minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Description</Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => setIsEditingDescription(!isEditingDescription)}
                    sx={{ 
                      color: isEditingDescription ? '#FF6600' : 'text.secondary',
                      '&:hover': { color: '#FF6600' },
                    }}
                  >
                    {isEditingDescription ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <EditIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Box>
                {isEditingDescription ? (
                  <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                    <MentionInput
                      value={editedMessage}
                      onChange={setEditedMessage}
                      fullWidth
                      multiline
                      minRows={4}
                      maxRows={12}
                      placeholder="Add a description... (type @ to mention)"
                      size="small"
                      sx={inputSx}
                    />
                  </Box>
                ) : (
                  <Box 
                    sx={{ 
                      p: 1.5, 
                      bgcolor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: 1,
                      border: '1px solid rgba(255,255,255,0.1)',
                      minHeight: 120,
                      maxHeight: 350,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'rgba(255,255,255,0.2)' },
                    }}
                    onClick={() => setIsEditingDescription(true)}
                  >
                    {editedMessage ? (
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {editedMessage}
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                        No description. Click to add one.
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* Metadata fields on the right */}
              <Box sx={{ flex: '0 0 220px', maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>{incident.id}</Typography>
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Source</Typography>
                  <Box 
                    sx={{ 
                      display: 'flex', alignItems: 'center', gap: 0.75, 
                      cursor: incident.source ? 'pointer' : 'default',
                      borderRadius: 1,
                      '&:hover': incident.source ? { bgcolor: 'rgba(255,255,255,0.05)' } : {},
                      mx: -0.5, px: 0.5, py: 0.25,
                    }}
                    onClick={() => {
                      if (incident.source) {
                        openApp(incident.source);
                      }
                    }}
                  >
                    {sourceAppImage && (
                      <img src={sourceAppImage} alt={incident.source || ''} style={{ width: 18, height: 18, objectFit: 'contain', borderRadius: 4 }} />
                    )}
                    <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: incident.source ? '#06b6d4' : undefined }}>{incident.source || <Typography component="span" variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>Unknown</Typography>}</Typography>
                  </Box>
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

            {/* Labels */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Labels
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                {editedLabels.map((label, idx) => (
                  <Chip
                    key={idx}
                    label={label}
                    size="small"
                    onDelete={() => {
                      autoProgressStatus();
                      setEditedLabels(editedLabels.filter((_, i) => i !== idx));
                    }}
                    sx={{
                      height: 24,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      bgcolor: 'rgba(6, 182, 212, 0.12)',
                      color: '#06b6d4',
                      '& .MuiChip-deleteIcon': { fontSize: 16, color: '#06b6d4', '&:hover': { color: '#67e8f9' } },
                    }}
                  />
                ))}
                <Box
                  component="form"
                  onSubmit={(e: React.FormEvent) => {
                    e.preventDefault();
                    const trimmed = newLabelInput.trim();
                    if (trimmed && !editedLabels.includes(trimmed)) {
                      autoProgressStatus();
                      setEditedLabels([...editedLabels, trimmed]);
                      setNewLabelInput('');
                    }
                  }}
                  sx={{ display: 'inline-flex' }}
                >
                  <TextField
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    placeholder="+ Add label"
                    variant="outlined"
                    size="small"
                    InputProps={{
                      sx: {
                        fontSize: '0.75rem',
                        height: 28,
                        bgcolor: 'rgba(0,0,0,0.2)',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' },
                        '&:hover fieldset': { borderColor: 'rgba(6, 182, 212, 0.3)' },
                        '&.Mui-focused fieldset': { borderColor: '#06b6d4' },
                      },
                    }}
                    sx={{ width: 120 }}
                  />
                </Box>
              </Box>
            </Box>
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

          {/* Custom Fields */}
          {(() => {
            // Get keys from defined custom fields
            const definedFieldKeys = new Set(customFields.map(f => f.key));
            // Get keys from actual data that don't have definitions
            const dataFieldKeys = Object.keys(editedCustomFields).filter(k => !definedFieldKeys.has(k));
            // Create dynamic fields for data that doesn't have definitions
            const dynamicFields: CustomField[] = dataFieldKeys.map(key => ({
              name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              key,
              type: typeof editedCustomFields[key] === 'boolean' ? 'boolean' as const : 
                    typeof editedCustomFields[key] === 'number' ? 'number' as const : 'text' as const,
              required: false,
            }));
            // Combine defined fields + dynamic fields from data
            const allFields = [...customFields, ...dynamicFields];
            
            return allFields.length > 0 || Object.keys(editedCustomFields).length > 0 ? (
              <Section title="Custom Fields" icon={SettingsIcon} defaultOpen={Object.keys(editedCustomFields).length > 0}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  {allFields.map((field) => renderCustomField(field))}
                </Box>
              </Section>
            ) : null;
          })()}

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
          {/* Auto-ingestion note */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.18)' }}>
            <Typography variant="caption" sx={{ color: '#fb923c', fontWeight: 500 }}>
              Automatic observable extraction is not yet fully enabled. You can add observables manually below.
            </Typography>
          </Box>
          {/* Add Observable input */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <ObservableTypeSelector
              value={newObservableType}
              onChange={setNewObservableType}
              iocTypes={iocTypes}
              onTypeCreated={refetchIOCTypes}
            />
            {(() => {
              const selectedIoc = iocTypes.find(t => t.name === newObservableType);
              const regexPattern = selectedIoc?.regex;
              const val = newObservableValue.trim();
              let regexWarning = '';
              if (val && regexPattern) {
                try {
                  if (!new RegExp(regexPattern).test(val)) {
                    regexWarning = `Value doesn't match expected pattern for "${newObservableType}"`;
                  }
                } catch { /* invalid regex, skip */ }
              }
              return (
                <>
                  <TextField
                    size="small"
                    value={newObservableValue}
                    onChange={(e) => setNewObservableValue(e.target.value)}
                    placeholder="Enter observable value..."
                    fullWidth
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObservable())}
                    sx={inputSx}
                    error={!!regexWarning}
                    helperText={regexWarning || undefined}
                  />
                  <IconButton onClick={handleAddObservable} disabled={!newObservableValue.trim()} sx={{ bgcolor: 'rgba(255,255,255,0.05)', alignSelf: regexWarning ? 'flex-start' : 'center', mt: regexWarning ? '4px' : 0 }}>
                    <AddIcon />
                  </IconButton>
                </>
              );
            })()}
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
                  <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
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

      {activeTab === 4 && (
        /* Raw JSON Tab */
        <Box sx={{
          bgcolor: 'rgba(255,255,255,0.02)',
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.06)',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
              Raw OCSF{' '}
              <a href="https://schema.ocsf.io/1.7.0/classes/incident_finding" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
                Incident Finding 2005
              </a>
              {' '}(editable)
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={async () => {
                if (!incident?.id) return;
                try {
                  const parsed = JSON.parse(rawJsonText);
                  setIsSaving(true);
                  const result = await setDatastoreItem(incident.id, parsed, DATASTORE_CATEGORIES.INCIDENTS);
                  if (result.success) {
                    toast.success('Raw data saved');
                    loadIncident(false);
                  } else {
                    toast.error(result.error || 'Failed to save');
                  }
                } catch (e: any) {
                  toast.error(e?.message?.includes('JSON') ? 'Invalid JSON' : 'Failed to save');
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
              sx={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#ff6600',
                fontSize: '0.75rem',
                height: 28,
                '&:hover': { borderColor: '#ff6600', bgcolor: 'rgba(255, 102, 0, 0.08)' },
              }}
            >
              Save
            </Button>
          </Box>
          <TextField
            multiline
            fullWidth
            minRows={16}
            maxRows={40}
            value={rawJsonText}
            onChange={(e) => setRawJsonText(e.target.value)}
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                lineHeight: 1.6,
                bgcolor: 'rgba(0,0,0,0.3)',
                borderRadius: 1.5,
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.08)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.15)',
              },
            }}
          />
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
          order: { xs: 2, lg: 0 },
        }}>
          {/* Agent runs loading indicator */}
          {agentRunsLoading && (
            <LinearProgress sx={{ 
              height: 2, 
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': { bgcolor: 'hsl(var(--primary))' },
            }} />
          )}
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
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}>
            {/* Agent runs rendered with the same component as /agent page */}
            {agentRuns.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <AgentActivityFeed runs={agentRuns} />
              </Box>
            )}

            {activity.length === 0 && agentRuns.length === 0 ? (
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
                        <Typography variant="caption" sx={{ 
                          fontWeight: 600, 
                          fontSize: '0.75rem',
                        }}>
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

      {/* Forward Dialog */}
      <Dialog
        open={showForwardDialog}
        onClose={() => setShowForwardDialog(false)}
        PaperProps={{
          sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', minWidth: 400, maxWidth: 500 },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>Forward Incident</Typography>
          <IconButton size="small" onClick={() => setShowForwardDialog(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Choose a tool to forward this incident to.
          </Typography>
          {forwardingAppsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : forwardingApps.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 4 }}>
              No authenticated tools available. Configure integrations in Settings.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {forwardingApps.map((app) => (
                <MenuItem
                  key={app.id}
                  onClick={async () => {
                    setShowForwardDialog(false);
                    try {
                      const categories = (app.categories || []).map((c: string) => c.toLowerCase());
                      const isMessaging = categories.includes('communication') || categories.includes('email') || app.id.toLowerCase() === 'gmail';
                      const ticketPayload = incident?.rawOCSF || incident || {};
                      const forwardBody: Record<string, any> = isMessaging
                        ? {
                            action: 'send_message',
                            category: 'cases',
                            key: incident?.id,
                            app_name: app.id,
                            body: ticketPayload,
                            fields: {
                              body: ticketPayload,
                            },
                          }
                        : {
                            action: 'update_ticket',
                            category: 'cases',
                            key: incident?.id,
                            app_name: app.id,
                            fields: [{ key: 'key', value: JSON.stringify(ticketPayload) }],
                          };
                      const response = await fetch(getApiUrl('/api/v1/apps/categories/run'), {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                          ...getAuthHeader(),
                        },
                        body: JSON.stringify(forwardBody),
                      });
                      if (response.ok) {
                        toast.success(`Forwarded to ${app.name}`);
                      } else {
                        toast.error(`Failed to forward to ${app.name}`);
                      }
                    } catch {
                      toast.error(`Failed to forward to ${app.name}`);
                    }
                  }}
                  sx={{ borderRadius: 1, py: 1 }}
                >
                  <Avatar
                    src={app.large_image}
                    sx={{ width: 28, height: 28, mr: 1.5, borderRadius: 1 }}
                    variant="rounded"
                  >
                    {app.name.charAt(0)}
                  </Avatar>
                  <Typography variant="body2">{app.name}</Typography>
                </MenuItem>
              ))}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default IncidentDetailPage;
