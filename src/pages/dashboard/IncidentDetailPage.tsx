import { useState, useEffect, useMemo, useCallback, useRef, forwardRef } from 'react';
import DOMPurify from 'dompurify';
import AgentIcon from '@/components/agent/AgentIcon';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEntityLabel, useTaskStatuses } from '@/hooks/useEntityLabel';
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
  Paper,
  Popover,
  Checkbox,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { motion, LayoutGroup } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import ReplyIcon from '@mui/icons-material/Reply';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { createAndUploadFile } from '@/services/files';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SecurityIcon from '@mui/icons-material/Security';
import LinkIcon from '@mui/icons-material/Link';
import PeopleIcon from '@mui/icons-material/People';
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
import CallMergeIcon from '@mui/icons-material/CallMerge';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LanguageIcon from '@mui/icons-material/Language';
import SearchIcon from '@mui/icons-material/Search';
import Menu from '@mui/material/Menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDatastore } from '@/hooks/useDatastore';
import { CorrelationRow, getEffectiveCorrelationCount, filterMeaningfulCorrelations, hasIocMatch } from '@/components/incidents/CorrelationRow';
import { IocDetailsCard } from '@/components/incidents/IocDetailsCard';
import { useAuth } from '@/context/AuthContext';
import { useAppDetail } from '@/context/AppDetailContext';
import { DATASTORE_CATEGORIES, getDatastoreItem, getDatastoreItemPublic, setDatastoreItem } from '@/services/datastore';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { resyncState } from '@/lib/resyncState';
import { useUsers } from '@/hooks/useUsers';
import { useSubOrgs } from '@/hooks/useSubOrgs';
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
import { normalizeStatus } from '@/config/incidentConfig';
import { ResolveIncidentDialog, ResolutionData, RESOLUTION_REASONS } from '@/components/incidents/ResolveIncidentDialog';
import { MergeIncidentDialog } from '@/components/incidents/MergeIncidentDialog';
import { MentionText } from '@/components/incidents/MentionText';
import { TaskKanbanBoard } from '@/components/incidents/TaskKanbanBoard';
import { MentionInput } from '@/components/incidents/MentionInput';
import { TaskDateTimePicker } from '@/components/incidents/TaskDateTimePicker';
import { FileAttachments } from '@/components/incidents/FileAttachments';
import { toast } from 'sonner';
import { isAIAssignee, deduplicateTasks, htmlToPlainText, decodeHtmlEntities, decodeIfBase64, deepMergeIncidents } from '@/lib/utils';
import { useIncidentAgentRuns } from '@/hooks/useIncidentAgentRuns';
import { useSourceAppImage } from '@/hooks/useSourceAppImage';
import AgentActivityFeed from '@/components/agent/AgentActivityFeed';
import HighlightedFileEditor from '@/components/incidents/HighlightedFileEditor';
import EmailThreadPanel, { isEmailContent } from '@/components/incidents/EmailThreadPanel';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';
import AppSearchDrawer from '@/components/shared/AppSearchDrawer';

// TaskTemplate interface is now imported from useCaseTemplates

export interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  type: 'technical' | 'business';
  role?: string;
  location?: string;
  phone?: string;
}


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
  stakeholders?: Stakeholder[];
  observables?: Observable[];
  enrichments?: Array<{ type: string; value?: string; data?: string; first_seen?: string | number; last_seen?: string | number }>;
  customFields?: Record<string, string | number | boolean>;
  relatedFindings?: string[];
  activity?: ActivityItem[];
  tasks?: IncidentTask[];
  rawOCSF?: any; // Use any to support both new and legacy formats
  labels?: string[];
}

// Status and severity colors now imported from shared config
import { statusConfig, severityColors, getOCSFStatus } from '@/config/incidentConfig';

/**
 * Normalize any timestamp (Unix seconds, ms, µs, ns, ISO string, numeric string) to ms epoch.
 */
const normalizeToMs = (timestamp: number | string | undefined): number => {
  if (!timestamp) return 0;
  if (typeof timestamp === 'string' && /[^0-9.]/.test(timestamp)) {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const ts = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  if (isNaN(ts) || ts <= 0) return 0;
  if (ts < 1e12) return ts * 1000;
  if (ts < 1e15) return ts;
  if (ts < 1e18) return ts / 1000;
  return ts / 1e6;
};

const formatTimestamp = (timestamp: number | string | undefined): string => {
  const ms = normalizeToMs(timestamp);
  if (!ms) return 'Unknown';
  const date = new Date(ms);
  if (isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatRelativeTime = (timestamp: number): string => {
  const ms = normalizeToMs(timestamp);
  if (!ms) return 'Unknown';
  const now = Date.now();
  const diff = now - ms;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(ms);
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
  return normalizeToMs(timestamp);
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

/**
 * Resolve the "created" timestamp for an incident.
 * Priority: value.created_time → item.created (datastore envelope).
 */
const resolveCreatedTs = (data: any, itemCreated?: number): number => {
  if (data?.created_time) {
    const ct = typeof data.created_time === 'string' && /^\d+$/.test(data.created_time)
      ? Number(data.created_time) : data.created_time;
    const ms = normalizeToMs(ct);
    if (ms > 0) return ms;
  }
  return normalizeToMs(itemCreated);
};

/** Merge native (root-level) enrichments with OCSF-level enrichments, deduplicating by type+value */
const deduplicateEnrichments = (
  nativeEnrichments?: Array<{ type: string; value?: string; data?: string }>,
  ocsfEnrichments?: Array<{ type: string; value?: string; data?: string }>
): Array<{ type: string; value?: string; data?: string }> => {
  const native = Array.isArray(nativeEnrichments) ? nativeEnrichments : [];
  const ocsf = Array.isArray(ocsfEnrichments) ? ocsfEnrichments : [];
  const all = [...native, ...ocsf];
  const seen = new Set<string>();
  return all.filter(e => {
    const key = `${e.type}::${e.value || e.data || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const parseIncidentFromDatastore = (item: { key: string; value: string; created?: number; edited?: number; enrichments?: Array<{ type: string; value?: string; data?: string }> }): DisplayIncident | null => {
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
        title: meaningfulString(ocsf.title) || meaningfulString(ocsf.supporting_data) || meaningfulString(ocsf.desc),
        source: meaningfulString(ocsf.product?.name) || meaningfulString(ocsf.types?.[0]),
        severity: mapOCSFSeverity(ocsf.severity_id || 3),
        status: normalizeStatus(ocsf.status || mapOCSFStatus(ocsf.status_id || 1)),
        assignee: customAttrs?.assignee || (data as any).assignee || null,
        created: formatTimestamp(resolveCreatedTs(data, item.created)),
        createdTs: resolveCreatedTs(data, item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: tlpLabel,
        references: ocsf.references,
        stakeholders: (customAttrs as any)?.stakeholders || (data as any).stakeholders || [],
        observables: customAttrs?.observables || (data as any).observables,
        enrichments: deduplicateEnrichments(item.enrichments, (data as any).enrichments),
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
        title: meaningfulString(findingInfo?.title) || meaningfulString(legacyData.supporting_data) || meaningfulString(legacyData.desc) || meaningfulString(legacyData.message),
        source: meaningfulString(legacyData.metadata?.product?.name) || meaningfulString(findingInfo?.types?.[0]),
        severity: mapOCSFSeverity(legacyData.severity_id),
        status: normalizeStatus(legacyData.status || mapOCSFStatus(legacyData.status_id)),
        assignee: legacyData.assignee || null,
        created: formatTimestamp(resolveCreatedTs(legacyData, item.created)),
        createdTs: resolveCreatedTs(legacyData, item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: typeof tlp === 'string' ? tlp : (tlp ? TLP_LABELS[tlp]?.label : undefined),
        pap,
        references: findingInfo?.references,
        observables: legacyData.observables,
        enrichments: deduplicateEnrichments(item.enrichments, legacyData.enrichments),
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
      title: meaningfulString(data.title) || meaningfulString(data.supporting_data) || meaningfulString(data.desc) || meaningfulString(data.message),
      source: meaningfulString(data.source),
      severity: data.severity || 'medium',
      status: normalizeStatus(data.status),
      assignee: data.assignee || null,
      created: formatTimestamp(resolveCreatedTs(data, item.created)),
      createdTs: resolveCreatedTs(data, item.created),
      edited: item.edited ? formatTimestamp(item.edited) : undefined,
      editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
      tlp: data.tlp,
      pap: data.pap,
      references: data.references || [],
      stakeholders: data.stakeholders || [],
      observables: data.observables || [],
      enrichments: deduplicateEnrichments(item.enrichments, data.enrichments),
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
      bgcolor: 'hsl(var(--card))', 
      borderRadius: 2, 
      border: '1px solid hsl(var(--border))',
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
          '&:hover': { bgcolor: 'hsl(var(--muted))' },
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
            variant="outlined"
            sx={{ 
              height: 20, 
              fontSize: '0.7rem',
              bgcolor: 'transparent',
              color: '#ff6600',
              borderColor: 'rgba(255, 102, 0, 0.4)',
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
  const { id: rawId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { plural: entityPlural, singular: entitySingular, basePath: entityBasePath } = useEntityLabel();
  const taskStatuses = useTaskStatuses();
  const { userInfo } = useAuth();
  const { openApp } = useAppDetail();
  const currentUsername = userInfo?.username || '';

  // Parse namespaced org ID from sub-org incidents (format: "orgId::incidentId")
  const crossOrgId = useMemo(() => {
    if (!rawId || !rawId.includes('::')) return null;
    return rawId.split('::')[0];
  }, [rawId]);
  const id = useMemo(() => {
    if (!rawId) return rawId;
    return rawId.includes('::') ? (rawId.split('::').filter(Boolean).pop() || rawId) : rawId;
  }, [rawId]);
  const isCrossOrg = !!crossOrgId && crossOrgId !== userInfo?.active_org?.id;

  // Headers to include on every API call when viewing a cross-org incident
  const crossOrgHeaders = useMemo<Record<string, string>>(() => {
    if (!crossOrgId) return {};
    return { 'Org-Id': crossOrgId };
  }, [crossOrgId]);

  // Public sharing params
  const publicAuth = searchParams.get('authorization');
  const publicOrg = searchParams.get('org');
  const isPublicView = !!(publicAuth && publicOrg);

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
  const [editedStakeholders, setEditedStakeholders] = useState<Stakeholder[]>([]);
  const [showAddStakeholder, setShowAddStakeholder] = useState(false);
  const [newStakeholder, setNewStakeholder] = useState<Omit<Stakeholder, 'id'>>({ name: '', type: 'technical' });
  const [stakeholderSearch, setStakeholderSearch] = useState('');
  const [showStakeholderSuggestions, setShowStakeholderSuggestions] = useState(false);
  const [knownStakeholders, setKnownStakeholders] = useState<Stakeholder[]>([]);
  const [editedObservables, setEditedObservables] = useState<Observable[]>([]);
  const [enrichments, setEnrichments] = useState<Array<{ type: string; value?: string; data?: string; first_seen?: string | number; last_seen?: string | number }>>([]);
  const [expandedObsKey, setExpandedObsKey] = useState<string | null>(null);
  const [refreshingObservables, setRefreshingObservables] = useState(false);
  const obsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When an incident was just created (within the last 2 minutes) we keep the
  // observables area in a "loading" state so the user can see automated
  // enrichments stream in shortly after, instead of an empty list.
  const FRESH_OBS_WINDOW_MS = 2 * 60 * 1000;
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Keys of items that arrived via background poll — used to flash a
  // highlight so the user can spot the new content without losing focus.
  // Observable keys: `${type}::${value}` (lowercase). Activity keys: actItem.id.
  const [newlyArrivedObservables, setNewlyArrivedObservables] = useState<Set<string>>(() => new Set());
  const [newlyArrivedActivity, setNewlyArrivedActivity] = useState<Set<string>>(() => new Set());
  // Transient highlights triggered by clicking a timeline step pill — let the
  // user jump from the timeline to the corresponding row in the Observables /
  // Correlations tab without losing track of which item they followed.
  const [flashedObsKey, setFlashedObsKey] = useState<string | null>(null);
  const [flashedCorrelationKey, setFlashedCorrelationKey] = useState<string | null>(null);
  const flashedObsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashedCorrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the user's most recent keystroke so background polls can defer
  // while they're actively typing in a textfield.
  const lastKeystrokeRef = useRef<number>(0);
  const [showThreatIntelDrawer, setShowThreatIntelDrawer] = useState(false);
  const [showForwardAppsDrawer, setShowForwardAppsDrawer] = useState(false);
  const [newObservableType, setNewObservableType] = useState('ip');
  const [newObservableValue, setNewObservableValue] = useState('');
  const [obsFilterTypes, setObsFilterTypes] = useState<string[]>([]);
  const [obsFilterText, setObsFilterText] = useState('');
  const [obsSortField, setObsSortField] = useState<'first_seen' | 'last_seen' | 'type' | 'value'>('first_seen');
  const [obsSortDir, setObsSortDir] = useState<'asc' | 'desc'>('desc');
  const [editedCustomFields, setEditedCustomFields] = useState<Record<string, string | number | boolean>>({});
  const [editedLabels, setEditedLabels] = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState('');
  
  // Activity/comments
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<FileAttachment[]>([]);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  // When the user clicks "Reply" on a timeline item we capture enough context
  // here to render the chip above the input AND attach the parent reference
  // to the new comment when it's submitted. Cleared after submit / cancel.
  const [replyingTo, setReplyingTo] = useState<{ id: string; label: string; preview: string } | null>(null);
  const commentInputRef = useRef<HTMLDivElement>(null);
  const [commentUploading, setCommentUploading] = useState(false);
  const handleCommentAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setCommentUploading(true);
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      const result = await createAndUploadFile(file, 'incidents', incident?.id ? [incident.id, 'comments'] : ['comments']);
      if (result.success && result.file) {
        newAttachments.push({
          id: result.file.id,
          filename: result.file.filename,
          filesize: result.file.filesize,
          uploadedAt: Date.now(),
        });
        toast.success(`Uploaded ${file.name}`);
      } else {
        toast.error(`Failed to upload ${file.name}: ${result.reason}`);
      }
    }
    if (newAttachments.length > 0) {
      setCommentAttachments(prev => [...prev, ...newAttachments]);
    }
    setCommentUploading(false);
    if (commentFileInputRef.current) commentFileInputRef.current.value = '';
  };
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  /**
   * Pending soft-delete confirmation. We never hard-delete a comment — the
   * confirm dialog flips `deleted: true` on the original entity so the
   * timestamp, author and thread position survive. Set to the comment id
   * when the user clicks the delete icon; cleared on cancel/confirm.
   */
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  
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
  const [descriptionView, setDescriptionView] = useState<'rendered' | 'readable' | 'raw'>('readable');
  const [rawDescriptionHtml, setRawDescriptionHtml] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState<null | HTMLElement>(null);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [publicAuthorization, setPublicAuthorization] = useState<string>('');
  const TAB_NAMES = ['details', 'tasks', 'observables', 'correlations', 'raw', 'file', 'original'] as const;
  const [activityFilter, setActivityFilter] = useState<'all' | 'revisions' | 'agent' | 'manual' | 'steps'>('all');
  const [revisionDialogData, setRevisionDialogData] = useState<{ json: string; changedKeys: Set<string> } | null>(null);
  const initialTab = (() => {
    const t = searchParams.get('tab');
    if (t) { const idx = TAB_NAMES.indexOf(t as any); return idx >= 0 ? idx : 0; }
    return 0;
  })();
   const [activeTab, setActiveTabState] = useState(initialTab);
   const setActiveTab = (tab: number) => {
     setActiveTabState(tab);
     const newParams = new URLSearchParams(searchParams);
     if (tab === 0) { newParams.delete('tab'); } else { newParams.set('tab', TAB_NAMES[tab] || ''); }
     const paramStr = newParams.toString();
     window.history.replaceState(null, '', `${window.location.pathname}${paramStr ? '?' + paramStr : ''}`);
   };

   /**
    * Jump to the Observables tab and flash the row matching the given
    * `${type}::${value}` (lowercase) key. Used by clickable timeline pills so
    * the user can see exactly which observable the timeline entry refers to.
    */
   const focusObservableFromTimeline = (typeValueKey: string | null) => {
     setActiveTab(2);
     if (!typeValueKey) return;
     setFlashedObsKey(typeValueKey);
     if (flashedObsTimerRef.current) clearTimeout(flashedObsTimerRef.current);
     flashedObsTimerRef.current = setTimeout(() => setFlashedObsKey(null), 2200);
     // Defer scroll until the tab content has mounted.
     setTimeout(() => {
       const el = document.querySelector(`[data-obs-highlight-key="${typeValueKey}"]`) as HTMLElement | null;
       if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
     }, 80);
   };

   /**
    * Jump to the Correlations tab and flash the row with the given
    * correlation key. When `correlationKey` is null we just switch tabs
    * (used for the "incident-level correlations" pill that has no key).
    */
   const focusCorrelationFromTimeline = (correlationKey: string | null) => {
     setActiveTab(3);
     if (correlationKey) {
       setFlashedCorrelationKey(correlationKey);
       if (flashedCorrTimerRef.current) clearTimeout(flashedCorrTimerRef.current);
       flashedCorrTimerRef.current = setTimeout(() => setFlashedCorrelationKey(null), 2200);
       setTimeout(() => {
         const el = document.querySelector(`[data-corr-key="${CSS.escape(correlationKey)}"]`) as HTMLElement | null;
         if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
       }, 80);
     }
   };

   const [rawJsonText, setRawJsonText] = useState('');
   const [rawJsonValid, setRawJsonValid] = useState(true);
  // File editor state
  const [fileContent, setFileContent] = useState('');
  const [fileJsonValid, setFileJsonValid] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoaded, setFileLoaded] = useState(false);

  // Revisions (Changes tab)
  const [revisions, setRevisions] = useState<any[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsLoaded, setRevisionsLoaded] = useState(false);

  const loadRevisions = useCallback(async () => {
    if (!id) return;
    setRevisionsLoading(true);
    try {
      const categoryKey = DATASTORE_CATEGORIES.INCIDENTS;
      const response = await fetch(getApiUrl(`/api/v2/datastore/category/${encodeURIComponent(categoryKey)}/${encodeURIComponent(id)}/revisions`), {
        credentials: 'include',
        headers: { ...getAuthHeader(), ...(crossOrgId ? { 'Org-Id': crossOrgId } : {}) },
      });
      if (response.ok) {
        const result = await response.json();
        const rawRevisions: any[] = Array.isArray(result) ? result : (result.data || result.revisions || []);

        const NOISE_FIELDS = new Set(['activity', 'updated_by', 'edited_time', 'updated_at', 'last_updated', 'comments']);

        const getMeaningfulSignature = (rev: any): string => {
          let parsed: any = rev?.value;

          if (typeof parsed === 'string') {
            const decoded = decodeIfBase64(parsed);
            try {
              parsed = JSON.parse(decoded);
            } catch {
              try {
                parsed = JSON.parse(parsed);
              } catch {
                // keep raw string if not JSON
              }
            }
          }

          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const cleaned = { ...parsed } as Record<string, any>;
            NOISE_FIELDS.forEach((field) => delete cleaned[field]);
            return JSON.stringify(cleaned);
          }

          try {
            return JSON.stringify(parsed);
          } catch {
            return String(parsed ?? '');
          }
        };

        // Always sort revisions by normalized timestamp (newest first)
        const sorted = [...rawRevisions].sort((a: any, b: any) =>
          normalizeToMs(b.edited ?? b.created) - normalizeToMs(a.edited ?? a.created)
        );

        // Deduplicate by id/key and collapse consecutive semantically identical snapshots
        const seenRevisionIds = new Set<string>();
        const deduped: any[] = [];
        let previousSignature: string | null = null;

        for (const rev of sorted) {
          const revisionId = rev?.id || rev?.key;
          if (revisionId) {
            if (seenRevisionIds.has(revisionId)) continue;
            seenRevisionIds.add(revisionId);
          }

          const signature = getMeaningfulSignature(rev);
          if (signature && signature === previousSignature) continue;

          deduped.push(rev);
          previousSignature = signature;
        }

        setRevisions(deduped);
      } else {
        console.error('[Changes] Failed to load revisions:', response.status);
        setRevisions([]);
      }
    } catch (err) {
      console.error('[Changes] Error loading revisions:', err);
      setRevisions([]);
    } finally {
      setRevisionsLoading(false);
      setRevisionsLoaded(true);
    }
  }, [id, crossOrgId]);

  // Sanitized HTML for safe rendering of ingested HTML descriptions (email-client style)
  const sanitizedDescriptionHtml = useMemo(() => {
    if (!rawDescriptionHtml) return '';
    // Check if it actually contains HTML tags
    if (!/<[a-z][\s\S]*>/i.test(rawDescriptionHtml)) return '';
    return DOMPurify.sanitize(rawDescriptionHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        'b', 'i', 'u', 'strong', 'em', 'small', 'sub', 'sup', 's', 'mark',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
        'a', 'img', 'figure', 'figcaption',
        'blockquote', 'pre', 'code', 'span', 'div', 'section',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height',
        'style', 'class', 'align', 'valign', 'colspan', 'rowspan',
        'border', 'cellpadding', 'cellspacing', 'role',
        'target', 'rel',
      ],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur'],
    });
  }, [rawDescriptionHtml]);
  const hasHtmlDescription = sanitizedDescriptionHtml.length > 0;

  const enrichmentStatus = useEnrichmentStatus();


  const incidentFileRef = useMemo(() => {
    const raw = incident?.rawOCSF;
    if (!raw?.shuffle_translation_file) return null;
    const fileId = String(raw.shuffle_translation_file).trim();
    if (!fileId) return null;
    return fileId;
  }, [incident?.rawOCSF]);

  const isFileUUID = (id: string) => /^file_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Resolve non-UUID file references by looking up the namespace listing
  const [resolvedFileId, setResolvedFileId] = useState<string | null>(null);
  const [fileIdResolved, setFileIdResolved] = useState(false);

  useEffect(() => {
    if (!incidentFileRef) {
      setResolvedFileId(null);
      setFileIdResolved(true);
      return;
    }
    if (isFileUUID(incidentFileRef)) {
      setResolvedFileId(incidentFileRef);
      setFileIdResolved(true);
      return;
    }
    // Need to resolve via namespace listing
    setFileIdResolved(false);
    const resolve = async () => {
      try {
        const resp = await fetch(getApiUrl('/api/v1/files/namespaces/translation_output?ids=true'), {
          credentials: 'include',
          headers: { ...getAuthHeader(), ...crossOrgHeaders },
        });
        if (!resp.ok) {
          setResolvedFileId(null);
          setFileIdResolved(true);
          return;
        }
        const data = await resp.json();
        const list: Array<{ id?: string; name?: string }> = data?.list || data || [];
        // Match by name (with or without .json extension)
        const match = list.find((f: any) => {
          const name = f.name || '';
          return name === incidentFileRef || name === `${incidentFileRef}.json` || name.replace(/\.json$/, '') === incidentFileRef;
        });
        setResolvedFileId(match?.id || null);
      } catch {
        setResolvedFileId(null);
      } finally {
        setFileIdResolved(true);
      }
    };
    resolve();
  }, [incidentFileRef]);

  // Check if unmapped_original exists in the raw OCSF data
  const unmappedOriginal = useMemo(() => {
    const raw = incident?.rawOCSF;
    if (!raw?.unmapped_original) return null;
    return raw.unmapped_original;
  }, [incident?.rawOCSF]);

  // Load file content when File tab is activated
  const loadFileContent = useCallback(async () => {
    if (!resolvedFileId) return;
    setFileLoading(true);
    setFileError(null);
    try {
      const resp = await fetch(getApiUrl(`/api/v1/files/${resolvedFileId}/content`), {
        credentials: 'include',
        headers: { ...getAuthHeader(), ...crossOrgHeaders },
      });
      if (!resp.ok) throw new Error(`Failed to load file (${resp.status})`);
      const text = await resp.text();
      // Sort keys alphabetically to match the { } tab output
      try {
        const parsed = JSON.parse(text);
        const sortKeys = (obj: any): any => {
          if (Array.isArray(obj)) return obj.map(sortKeys);
          if (obj && typeof obj === 'object') {
            return Object.keys(obj).sort().reduce((acc: any, key: string) => {
              acc[key] = sortKeys(obj[key]);
              return acc;
            }, {});
          }
          return obj;
        };
        setFileContent(JSON.stringify(sortKeys(parsed), null, 2));
      } catch {
        setFileContent(text);
      }
      setFileLoaded(true);
    } catch (e: any) {
      setFileError(e.message || 'Failed to load file');
    } finally {
      setFileLoading(false);
    }
  }, [resolvedFileId]);

  useEffect(() => {
    if (activeTab === 5 && resolvedFileId && !fileLoaded) {
      loadFileContent();
    }
  }, [activeTab, resolvedFileId, fileLoaded, loadFileContent]);

  // Auto-load revisions when incident finishes loading, then poll every 60s
  useEffect(() => {
    if (!loading && id && !revisionsLoaded) {
      loadRevisions();
    }
  }, [loading, id, revisionsLoaded, loadRevisions]);

  useEffect(() => {
    if (!id || loading) return;
    const interval = setInterval(() => {
      loadRevisions();
    }, 60_000);
    return () => clearInterval(interval);
  }, [id, loading, loadRevisions]);

  const [forwardingApps, setForwardingApps] = useState<Array<{ id: string; name: string; large_image: string; categories: string[] }>>([]);
  const [forwardingAppsLoading, setForwardingAppsLoading] = useState(false);
  const sourceAppImage = useSourceAppImage(incident?.source ?? null, crossOrgId);

  // Reload authenticated tools every time the Forward dialog opens so newly
  // connected tools (e.g. just-authenticated email apps) appear immediately.
  useEffect(() => {
    if (!showForwardDialog) return;
    let cancelled = false;
    setForwardingAppsLoading(true);
    fetch(getApiUrl('/api/v1/apps/authentication'), {
      credentials: 'include',
      headers: { ...getAuthHeader(), ...crossOrgHeaders },
    })
      .then(r => r.json())
      .then(result => {
        if (cancelled) return;
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
      .catch(() => { if (!cancelled) setForwardingApps([]); })
      .finally(() => { if (!cancelled) setForwardingAppsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForwardDialog]);
  const [correlations, setCorrelations] = useState<Array<{ key: string; amount: number; ref: string[] }>>([]);
  const [correlationsLoading, setCorrelationsLoading] = useState(false);
  // Track when the incident-level correlations finished loading. Correlations
  // have no native timestamp so we use "discovered at" (when the API returned
  // them) to place them on the unified timeline.
  const [correlationsDiscoveredAt, setCorrelationsDiscoveredAt] = useState<number | null>(null);
  const [obsCorrelations, setObsCorrelations] = useState<Record<string, { loading: boolean; data: Array<{ key: string; amount: number; ref: string[] }>; discoveredAt?: number }>>({});
  const [obsCorrelationAnchor, setObsCorrelationAnchor] = useState<{ el: HTMLElement; obsKey: string } | null>(null);
  // Set of `${type}::${value}` (lowercase) observable keys whose correlations
  // include at least one ref into a known IOC / threat-feed datastore. Used to
  // surface a red "Known IOC" treatment everywhere the observable appears
  // (Observables tab, timeline pills, drawers).
  const iocObservableKeys = useMemo(() => {
    const set = new Set<string>();
    Object.entries(obsCorrelations).forEach(([obsKey, entry]) => {
      if (!entry?.data?.length) return;
      if (entry.data.some(hasIocMatch)) set.add(obsKey.toLowerCase());
    });
    return set;
  }, [obsCorrelations]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    stakeholders: string;
    labels: string;
  } | null>(null);
  
  const { users, loading: usersLoading } = useUsers();
  const { fields: customFields } = useCustomFields();
  const { observableTypeNames, iocTypes, refetch: refetchIOCTypes } = useIOCTypes();
  const { templates: caseTemplates, trackUsage: trackTemplateUsage } = useCaseTemplates();
  const { addItem, getItem } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
    orgId: crossOrgId || undefined,
  });

  const { subOrgs, parentOrg } = useSubOrgs(userInfo?.active_org?.id);
  const crossOrgInfo = useMemo(() => {
    if (!crossOrgId) return null;
    if (parentOrg && parentOrg.id === crossOrgId) return { name: parentOrg.name, image: parentOrg.image };
    const found = subOrgs.find(o => o.id === crossOrgId);
    return found ? { name: found.name, image: found.image } : null;
  }, [crossOrgId, subOrgs, parentOrg]);

  // Detect which other orgs share the same incident key
  // Primary source: shared_orgs query param from the list page (most reliable)
  // Fallback: probe each org via get_cache
  const [sharedOrgs, setSharedOrgs] = useState<Array<{ id: string; name: string; image?: string }>>([]);
  
  useEffect(() => {
    if (!id || !userInfo?.active_org?.id) return;
    
    // Check if list page passed shared org IDs
    const sharedOrgParam = searchParams.get('shared_orgs');
    const allKnownOrgs = [
      { id: userInfo.active_org!.id, name: userInfo.active_org!.name || '', image: userInfo.active_org!.image },
      ...(subOrgs || []),
      ...(parentOrg ? [parentOrg] : []),
    ];
    
    if (sharedOrgParam) {
      const sharedIds = sharedOrgParam.split(',').filter(Boolean);
      // The current viewing org is implicit — find the OTHER orgs
      const viewingOrgId = crossOrgId || userInfo.active_org?.id;
      const others = sharedIds
        .filter(oid => oid !== viewingOrgId)
        .map(oid => {
          const org = allKnownOrgs.find(o => o.id === oid);
          return org ? { id: org.id, name: org.name, image: org.image } : { id: oid, name: oid.slice(0, 8) + '…' };
        });
      if (others.length > 0) {
        setSharedOrgs(others);
        return;
      }
    }
    
    // Fallback: probe each org
    const orgsToProbe = allKnownOrgs.filter(o => {
      const viewingOrgId = crossOrgId || userInfo.active_org?.id;
      return o.id !== viewingOrgId;
    });
    if (orgsToProbe.length === 0) return;

    const probeOrgs = async () => {
      const found: Array<{ id: string; name: string; image?: string }> = [];
      
      const results = await Promise.allSettled(
        orgsToProbe.map(async (org) => {
          try {
            const result = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS, org.id);
            if (result.success && result.item?.value && result.item.value.length > 2) {
              return { id: org.id, name: org.name, image: org.image };
            }
          } catch {
            // Ignore probe failures
          }
          return null;
        })
      );
      
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          found.push(r.value);
        }
      }
      console.log(`[CrossOrg] Probed ${orgsToProbe.length} orgs for key "${id}", found in ${found.length} additional orgs:`, found.map(o => o.name));
      setSharedOrgs(found);
    };
    probeOrgs();
  }, [id, subOrgs, parentOrg, userInfo?.active_org?.id, crossOrgId, searchParams]);

  // Fetch agent runs for this incident — deferred until incident loaded
  const { runsForIncident: agentRuns, isLoading: agentRunsLoading } = useIncidentAgentRuns(!loading ? id : undefined);

  // Load incident function (reusable for refresh)
  const loadIncident = useCallback(async (showLoading = true) => {
    if (!id) {
      setLoading(false);
      return;
    }

    const loadStart = performance.now();
    if (showLoading) setLoading(true);
    let result: Awaited<ReturnType<typeof getDatastoreItem>>;
    try {
      result = isPublicView
        ? await getDatastoreItemPublic(id, publicOrg!, publicAuth!)
        : await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
    } catch (err) {
      console.error('[IncidentDetail] Failed to fetch incident:', err);
      setLoading(false);
      return;
    }
    const fetchTime = performance.now() - loadStart;
    console.log(`[Perf] Incident fetch: ${fetchTime.toFixed(1)}ms, size: ${((result.item?.value?.length || 0) / 1024).toFixed(1)}KB`);
    
    if (result.success && result.item) {
      setPublicAuthorization(result.item.public_authorization || '');
      const itemData = {
        key: result.item.key || id,
        value: result.item.value,
        created: result.item.created,
        edited: result.item.edited,
        enrichments: result.item.enrichments,
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
        
        // Store the raw HTML for rendered view
        const rawDecoded = decodeIfBase64(rawDesc);
        const htmlSource = rawDecoded !== rawDesc ? rawDecoded : rawDesc;
        setRawDescriptionHtml(htmlSource);
        
        // Also create plain-text version for editing
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
        setEnrichments(parsed.enrichments || []);
        setEditedStakeholders(parsed.stakeholders || []);
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
        const stakeholdersStr = JSON.stringify(parsed.stakeholders || []);
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
          stakeholders: stakeholdersStr,
          tasks: tasksStr,
          labels: labelsStr,
        };
        console.log(`[Perf] State hydration: ${(performance.now() - stateStart).toFixed(1)}ms`);
        // Details is now tab 0 (default), no auto-switch needed
        // If arriving with ?tab=raw, populate rawJsonText now that data is loaded
        if (showLoading && searchParams.get('tab') === 'raw') {
          setRawJsonText(JSON.stringify(parsed.rawOCSF || {}, null, 2));
        }
        setLoading(false);
        console.log(`[Perf] Total loadIncident: ${(performance.now() - loadStart).toFixed(1)}ms`);
        return;
      }
    }
    
    setLoading(false);
  }, [id, isPublicView, publicOrg, publicAuth]);

  // Initial load
  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  // Cross-org merge: once we know shared orgs and have the primary incident loaded,
  // fetch all other org versions and deep-merge them into the current data.
  const crossOrgMergedRef = useRef(false);
  useEffect(() => {
    if (!id || !incident || sharedOrgs.length === 0 || isPublicView || crossOrgMergedRef.current) return;
    crossOrgMergedRef.current = true;

    const mergeCrossOrg = async () => {
      console.log(`[CrossOrg] Merging data from ${sharedOrgs.length} other org(s)…`);
      const primaryRaw = incident.rawOCSF || {};
      const primaryEdited = incident.editedTs || incident.createdTs || 0;
      let merged = { ...primaryRaw };

      const results = await Promise.allSettled(
        sharedOrgs.map(org => getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS, org.id))
      );

      for (const r of results) {
        if (r.status !== 'fulfilled' || !r.value.success || !r.value.item?.value || r.value.item.value.length <= 2) continue;
        try {
          const otherData = JSON.parse(r.value.item.value);
          const otherEdited = r.value.item.edited ? (typeof r.value.item.edited === 'number' ? r.value.item.edited : Number(r.value.item.edited)) : 0;
          merged = deepMergeIncidents(merged, otherData, primaryEdited, otherEdited);
          console.log(`[CrossOrg] Merged data from org, edited=${otherEdited}`);
        } catch (err) {
          console.warn('[CrossOrg] Failed to parse/merge org data:', err);
        }
      }

      // Re-parse merged data as if it came from the datastore
      const mergedItem = {
        key: id,
        value: JSON.stringify(merged),
        created: incident.createdTs ? Math.floor(incident.createdTs / 1000) : undefined,
        edited: incident.editedTs ? Math.floor(incident.editedTs / 1000) : undefined,
      };
      const reParsed = parseIncidentFromDatastore(mergedItem);
      if (reParsed) {
        console.log('[CrossOrg] Merged incident applied');
        setIncident(reParsed);
        setEditedTitle(reParsed.title);
        const rawDesc = reParsed.rawOCSF?.desc || reParsed.rawOCSF?.message || '';
        const rawDecoded = decodeIfBase64(rawDesc);
        setRawDescriptionHtml(rawDecoded !== rawDesc ? rawDecoded : rawDesc);
        setEditedMessage(htmlToPlainText(rawDecoded !== rawDesc ? rawDecoded : decodeIfBase64(htmlToPlainText(rawDesc))));
        setEditedSeverity(reParsed.severity);
        const rawAssignee = reParsed.assignee || '';
        setEditedAssignee(isAIAssignee(rawAssignee) ? 'AI Agent' : rawAssignee);
        setEditedStatus(reParsed.status);
        setEditedTlp(reParsed.tlp || 'TLP:AMBER');
        setEditedReferences(Array.isArray(reParsed.references) ? reParsed.references : []);
        setEditedObservables(reParsed.observables || []);
        setEnrichments(reParsed.enrichments || []);
        setEditedStakeholders(reParsed.stakeholders || []);
        setEditedLabels(reParsed.labels || []);
        setActivity(reParsed.activity || []);
        const loadedTasks = reParsed.tasks || [];
        const normalizedTasks = loadedTasks.map((task: IncidentTask, index: number) => ({
          ...task,
          id: task.id || `task-${Date.now()}-${index}`,
        }));
        setTasks(normalizedTasks);
        // Update initial snapshot so auto-save doesn't fire from merge
        initialValuesRef.current = {
          title: reParsed.title,
          message: htmlToPlainText(rawDecoded !== rawDesc ? rawDecoded : decodeIfBase64(htmlToPlainText(rawDesc))),
          severity: reParsed.severity,
          assignee: isAIAssignee(rawAssignee) ? 'AI Agent' : rawAssignee,
          status: reParsed.status,
          tlp: reParsed.tlp || 'TLP:AMBER',
          references: JSON.stringify(reParsed.references || []),
          observables: JSON.stringify(reParsed.observables || []),
          customFields: JSON.stringify(reParsed.customFields || {}),
          stakeholders: JSON.stringify(reParsed.stakeholders || []),
          tasks: JSON.stringify(normalizedTasks),
          labels: JSON.stringify(reParsed.labels || []),
        };
      }
    };
    mergeCrossOrg();
  }, [id, incident?.id, sharedOrgs, isPublicView]);

  // Auto-resync untitled incidents immediately on load
  const autoResyncTriggeredRef = useRef(false);
  useEffect(() => {
    if (autoResyncTriggeredRef.current || loading || !incident || isResyncing || isPublicView) return;
    // Only trigger if incident has no meaningful title and has a resyncable source
    if (incident.title && incident.title !== incident.id) return;
    const source = incident.source || '';
    if (!source || source === 'Tenzir') return;
    // Check source is not a product id/uid (same guard as manual resync)
    const product = incident.rawOCSF?.product || incident.rawOCSF?.metadata?.product;
    if (product?.name && (product.name === product.id || product.name === product.uid)) return;

    autoResyncTriggeredRef.current = true;
    setIsResyncing(true);
    resyncState.add(incident.id);
    toast.success(`Resyncing from ${source}…`, { duration: 30000 });

    (async () => {
      try {
        const preResult = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
        const previousEdited = preResult.item?.edited || 0;

        const response = await fetch(getApiUrl('/api/v1/apps/categories/run'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...crossOrgHeaders },
          body: JSON.stringify({
            action: 'get_ticket',
            category: 'cases',
            fields: [{ key: 'id', value: incident.id }],
            app_name: source,
          }),
        });
        if (!response.ok) {
          toast.error('Auto-resync failed');
          setIsResyncing(false);
          resyncState.remove(incident.id);
          return;
        }
        // Poll every 5s for up to 30s checking if the item was updated
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
          pollCount++;
          const postResult = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
          const newEdited = postResult.item?.edited || 0;
          if (newEdited && newEdited !== previousEdited) {
            clearInterval(pollInterval);
            await loadIncident(false);
            setIsResyncing(false);
            resyncState.remove(incident.id);
            toast.success('Resync complete — update found');
          } else if (pollCount >= 6) {
            clearInterval(pollInterval);
            await loadIncident(false);
            setIsResyncing(false);
            resyncState.remove(incident.id);
            toast.info('Resync complete — no changes detected');
          }
        }, 5000);
      } catch {
        toast.error('Auto-resync failed');
        setIsResyncing(false);
        resyncState.remove(incident.id);
      }
    })();
  }, [loading, incident, isResyncing, isPublicView, loadIncident]);

  // Show toast for invalid data incidents (no title + no source)
  const invalidDataToastShown = useRef(false);
  useEffect(() => {
    if (invalidDataToastShown.current || loading || !incident) return;
    const hasTitle = !!incident.title;
    const hasSource = !!incident.source;
    if (!hasTitle && !hasSource) {
      invalidDataToastShown.current = true;
      toast.error('This incident is not in a valid OCSF format. Validate your ingest pipeline or contact support@shuffler.io', { duration: 8000 });
    }
  }, [loading, incident]);

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

  // Fetch correlations — extracted into a callback so the "Re-run" button on
  // the Correlations tab header can refresh on demand. Deferred until the
  // incident is loaded to avoid blocking the UI.
  const fetchCorrelations = useCallback(async () => {
    if (!id) return;

    setCorrelationsLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/v2/correlations'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
          ...crossOrgHeaders,
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
        const currentIdLower = (id || '').toLowerCase();
        const filteredCorr = correlationData.filter((c: { key: string; ref?: string[] }) => {
          if (noiseKeys.has(c.key.toLowerCase())) return false;
          // Exclude correlations whose only reference is the current incident itself —
          // a correlation needs at least one OTHER incident to be meaningful.
          const refs = Array.isArray(c.ref) ? c.ref : [];
          const otherRefs = refs.filter((r) => {
            const tail = (r.includes('|') ? r.split('|').pop() : r.split('/').pop()) || '';
            return tail.toLowerCase() !== currentIdLower;
          });
          return otherRefs.length > 0;
        });
        setCorrelations(filteredCorr);
        // Capture the discovery time so the timeline can place this event
        // chronologically. Only set on the first non-empty discovery so the
        // timestamp is stable across re-renders / refetches.
        if (filteredCorr.length > 0) {
          setCorrelationsDiscoveredAt((prev) => prev ?? Date.now());
        }
      }
    } catch (error) {
      console.error('Failed to fetch correlations:', error);
    } finally {
      setCorrelationsLoading(false);
    }
  }, [id, crossOrgHeaders]);

  useEffect(() => {
    if (loading) return;
    fetchCorrelations();
  }, [fetchCorrelations, loading]);


  // Tick periodically while the incident is "fresh" (created within the last
  // 2 minutes) so the observables area can show a loading state until the
  // background enrichment window has elapsed.
  useEffect(() => {
    const createdTs = incident?.createdTs || 0;
    if (!createdTs) return;
    const age = Date.now() - createdTs;
    if (age >= FRESH_OBS_WINDOW_MS) return;
    const tickId = window.setInterval(() => setNowTick(Date.now()), 2000);
    const expireId = window.setTimeout(() => setNowTick(Date.now()), FRESH_OBS_WINDOW_MS - age + 50);
    return () => { window.clearInterval(tickId); window.clearTimeout(expireId); };
  }, [incident?.createdTs]);

  // ── Keystroke tracker ──────────────────────────────────────────────────
  // The background poll defers when the user has typed in the last 1.5s so
  // we never disrupt active typing in a textfield.
  useEffect(() => {
    const onKey = () => { lastKeystrokeRef.current = Date.now(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // ── Background incident poll ───────────────────────────────────────────
  // Periodically re-fetches the incident from the datastore so freshly
  // computed observables / enrichments / activity stream in without a
  // page reload. Carefully avoids touching any field the user is editing.
  useEffect(() => {
    if (!incident || !id || isPublicView || loading) return;
    // Poll faster while the incident is "fresh" (just created), then slow
    // down to a gentle background heartbeat for the rest of the session.
    const ageMs = Date.now() - (incident.createdTs || 0);
    const intervalMs = ageMs < FRESH_OBS_WINDOW_MS ? 5000 : 15000;

    let cancelled = false;
    const tick = async () => {
      // Defer if the user is actively typing — we'll catch up on the next tick.
      if (Date.now() - lastKeystrokeRef.current < 1500) return;
      // Defer if a save is queued / in flight to avoid a stale overwrite.
      if (pendingSaveRef.current || isSaving) return;
      try {
        const result = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
        if (cancelled || !result.success || !result.item) return;
        const reParsed = parseIncidentFromDatastore({
          key: result.item.key || id,
          value: result.item.value,
          created: result.item.created,
          edited: result.item.edited,
          enrichments: result.item.enrichments,
        });
        if (!reParsed) return;

        // ─ Enrichments: always replace, these are server-managed ───────
        const newEnrichments = reParsed.enrichments || [];
        setEnrichments(prev => {
          const prevKeys = new Set(prev.map(e => `${(e.type || '').toLowerCase()}::${(e.value || e.data || '').toLowerCase()}`));
          const added: string[] = [];
          for (const e of newEnrichments) {
            const k = `${(e.type || '').toLowerCase()}::${(e.value || e.data || '').toLowerCase()}`;
            if (!prevKeys.has(k)) added.push(k);
          }
          if (added.length > 0) {
            setNewlyArrivedObservables(s => {
              const next = new Set(s);
              added.forEach(k => next.add(k));
              return next;
            });
            // Fade out the highlight after the animation completes.
            window.setTimeout(() => {
              setNewlyArrivedObservables(s => {
                const next = new Set(s);
                added.forEach(k => next.delete(k));
                return next;
              });
            }, 6000);
          }
          return newEnrichments;
        });

        // ─ Manual observables: only adopt if not dirty (user hasn't edited)
        const newObs = reParsed.observables || [];
        const obsDirty = obsJsonRef.current !== initialValuesRef.current?.observables;
        if (!obsDirty) {
          setEditedObservables(prev => {
            const prevKeys = new Set(prev.map(o => `${(o.type || '').toLowerCase()}::${(o.value || '').toLowerCase()}`));
            const added: string[] = [];
            for (const o of newObs) {
              const k = `${(o.type || '').toLowerCase()}::${(o.value || '').toLowerCase()}`;
              if (!prevKeys.has(k)) added.push(k);
            }
            if (added.length > 0) {
              setNewlyArrivedObservables(s => {
                const next = new Set(s);
                added.forEach(k => next.add(k));
                return next;
              });
              window.setTimeout(() => {
                setNewlyArrivedObservables(s => {
                  const next = new Set(s);
                  added.forEach(k => next.delete(k));
                  return next;
                });
              }, 6000);
            }
            return newObs;
          });
          // Keep snapshot in sync so auto-save doesn't fire from background poll.
          if (initialValuesRef.current) {
            initialValuesRef.current.observables = JSON.stringify(newObs);
          }
        }

        // ─ Activity feed: only adopt if not dirty ──────────────────────
        const newActivity = reParsed.activity || [];
        setActivity(prev => {
          // Only replace if the server has more / different items, otherwise
          // we'd risk wiping an optimistic local addition (e.g. a comment
          // posted milliseconds before the poll completed).
          if (newActivity.length <= prev.length) return prev;
          const prevIds = new Set(prev.map(a => a.id));
          const added: string[] = [];
          for (const a of newActivity) {
            if (a.id && !prevIds.has(a.id)) added.push(a.id);
          }
          if (added.length > 0) {
            setNewlyArrivedActivity(s => {
              const next = new Set(s);
              added.forEach(k => next.add(k));
              return next;
            });
            window.setTimeout(() => {
              setNewlyArrivedActivity(s => {
                const next = new Set(s);
                added.forEach(k => next.delete(k));
                return next;
              });
            }, 6000);
          }
          return newActivity;
        });

        // ─ incident.editedTs / lightweight metadata refresh ────────────
        setIncident(curr => {
          if (!curr) return curr;
          if ((reParsed.editedTs || 0) <= (curr.editedTs || 0)) return curr;
          // Only refresh server-managed fields; preserve any in-flight user edits.
          return {
            ...curr,
            editedTs: reParsed.editedTs,
            enrichments: newEnrichments,
            observables: obsDirty ? curr.observables : newObs,
            activity: (reParsed.activity || []).length > (curr.activity?.length || 0) ? reParsed.activity : curr.activity,
            rawOCSF: reParsed.rawOCSF,
          };
        });
      } catch (err) {
        // Silent: this is a background heartbeat, not a user action.
        console.debug('[IncidentPoll] tick failed:', err);
      }
    };

    const intervalId = window.setInterval(tick, intervalMs);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, [incident?.id, id, isPublicView, loading, crossOrgId, isSaving, FRESH_OBS_WINDOW_MS, incident?.createdTs]);


  // Fetch per-observable correlations when observables tab is active
  useEffect(() => {
    if (activeTab !== 2 || loading) return;
    const manualObs = editedObservables.filter(o => !o.archived);
    const enrichObs = enrichments.map(e => ({ type: e.type || 'unknown', value: e.value || e.data || '' }));
    const allObs = [...manualObs, ...enrichObs].filter(o => o.value);
    // Limit to 20
    const toFetch = allObs.slice(0, 20);
    if (toFetch.length === 0) return;

    const noiseKeys = new Set([
      'new', 'in_progress', 'resolved', 'escalated', 'closed', 'open', 'pending',
      'critical', 'high', 'medium', 'low', 'informational', 'info', 'warning', 'error',
      'unknown', 'none', 'null', 'undefined', 'true', 'false',
      id?.toLowerCase(),
    ].filter(Boolean));

    toFetch.forEach(async (obs) => {
      const obsKey = `${obs.type}::${obs.value}`;
      // Skip if already fetched (with data or empty) or currently loading
      if (obsCorrelations[obsKey] !== undefined) return;

      setObsCorrelations(prev => {
        if (prev[obsKey] !== undefined) return prev;
        return { ...prev, [obsKey]: { loading: true, data: [] } };
      });
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(getApiUrl('/api/v2/correlations'), {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...crossOrgHeaders },
          body: JSON.stringify({
            type: 'value',
            key: obs.value,
          }),
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = await resp.json();
          const corrData = Array.isArray(data) ? data : (data.correlations || data.data || []);
          const filtered = corrData.filter((c: { key: string }) => !noiseKeys.has(c.key.toLowerCase()));
          setObsCorrelations(prev => ({ ...prev, [obsKey]: { loading: false, data: filtered, discoveredAt: filtered.length > 0 ? Date.now() : undefined } }));
        } else {
          setObsCorrelations(prev => ({ ...prev, [obsKey]: { loading: false, data: [] } }));
        }
      } catch {
        setObsCorrelations(prev => ({ ...prev, [obsKey]: { loading: false, data: [] } }));
      }
    });
  }, [activeTab, loading, editedObservables, enrichments, id]);

  // Re-run correlation lookup for a single observable on demand. Used by the
  // small refresh button next to each observable's "Correlations" header so
  // the user can poke at it without leaving the row.
  const refetchObsCorrelation = useCallback(async (obs: { type: string; value: string }) => {
    if (!obs?.value) return;
    const obsKey = `${obs.type}::${obs.value}`;
    const noiseKeys = new Set([
      'new', 'in_progress', 'resolved', 'escalated', 'closed', 'open', 'pending',
      'critical', 'high', 'medium', 'low', 'informational', 'info', 'warning', 'error',
      'unknown', 'none', 'null', 'undefined', 'true', 'false',
      id?.toLowerCase(),
    ].filter(Boolean));
    setObsCorrelations(prev => ({ ...prev, [obsKey]: { loading: true, data: prev[obsKey]?.data || [] } }));
    try {
      const resp = await fetch(getApiUrl('/api/v2/correlations'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...crossOrgHeaders },
        body: JSON.stringify({ type: 'value', key: obs.value }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const corrData = Array.isArray(data) ? data : (data.correlations || data.data || []);
        const filtered = corrData.filter((c: { key: string }) => !noiseKeys.has(c.key.toLowerCase()));
        setObsCorrelations(prev => ({ ...prev, [obsKey]: { loading: false, data: filtered, discoveredAt: filtered.length > 0 ? Date.now() : prev[obsKey]?.discoveredAt } }));
      } else {
        setObsCorrelations(prev => ({ ...prev, [obsKey]: { loading: false, data: [] } }));
      }
    } catch {
      setObsCorrelations(prev => ({ ...prev, [obsKey]: { loading: false, data: [] } }));
    }
  }, [id, crossOrgHeaders]);


  const saveToDatastore = useCallback(async () => {
    if (!incident?.id) return;
    
    setIsSaving(true);
    pendingSaveRef.current = false;
    
    const severityOption = severityOptions.find(s => s.value === editedSeverity);
    const { label: statusLabel, id: statusId } = getOCSFStatus(editedStatus);
    
    // Get existing finding info from list (new) or direct (legacy)
    const existingFindingInfo = incident.rawOCSF?.finding_info_list?.[0] || (incident.rawOCSF as any)?.finding_info;
    
    // CRITICAL: Never use undefined - always use empty values to prevent field deletion
    const updatedData = incident.rawOCSF ? {
      ...incident.rawOCSF,
      desc: editedMessage || editedTitle,
      severity_id: severityOption?.id || 3,
      severity: severityOption?.label || 'Medium',
      status_id: statusId,
      status: statusLabel,
      assignee: editedAssignee.trim() || '',
      types: editedLabels, // OCSF types[] field for labels
      observables: editedObservables,
      stakeholders: editedStakeholders,
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
            customFields: editedCustomFields,
            stakeholders: editedStakeholders,
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
      stakeholders: editedStakeholders,
      observables: editedObservables,
      customFields: editedCustomFields,
      activity: activity,
      tasks: tasks,
    };

    try {
      const saveSuccess = await addItem(incident.id, updatedData);
      if (!saveSuccess) {
        toast.error('Failed to save changes');
        return;
      }
      
      // Sync to shared orgs (fire-and-forget to avoid blocking primary save)
      if (sharedOrgs.length > 0) {
        Promise.allSettled(
          sharedOrgs.map(org =>
            setDatastoreItem(incident.id, updatedData, DATASTORE_CATEGORIES.INCIDENTS, org.id)
          )
        ).then(results => {
          const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
          if (failed.length > 0) {
            console.warn(`[CrossOrgSync] ${failed.length}/${sharedOrgs.length} org saves failed`);
          }
        });
      }
      // Update local incident state so OCSF tab reflects the latest saved data
      setIncident(prev => prev ? { ...prev, rawOCSF: updatedData } : prev);
      // Also update the raw JSON text if the user has the raw tab open
      setRawJsonText(JSON.stringify(updatedData, null, 2));

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
        stakeholders: stakeholdersJsonRef.current,
        labels: labelsJsonRef.current,
      };

      // Post-save verification: pull back the data after a short delay and verify key fields
      setTimeout(async () => {
        try {
          const verified = await getItem(incident.id);
          if (!verified) {
            console.warn('[SaveVerify] Could not fetch back saved incident');
            toast.error('Save verification failed — could not confirm changes were persisted');
            return;
          }
          const savedData = typeof verified.value === 'string' ? JSON.parse(verified.value) : verified.value;
          const issues: string[] = [];

          // Verify observables
          const savedObs = savedData?.observables || savedData?.metadata?.extensions?.custom_attributes?.observables || [];
          const expectedObs = editedObservables;
          if (JSON.stringify(savedObs) !== JSON.stringify(expectedObs)) {
            issues.push('observables');
          }

          // Verify tasks
          const savedTasks = savedData?.tasks || savedData?.metadata?.extensions?.custom_attributes?.tasks || [];
          if (JSON.stringify(savedTasks) !== JSON.stringify(tasks)) {
            issues.push('tasks');
          }

          // Verify activity
          const savedActivity = savedData?.activity || [];
          if (JSON.stringify(savedActivity) !== JSON.stringify(activity)) {
            issues.push('activity');
          }

          if (issues.length > 0) {
            console.warn('[SaveVerify] Mismatch detected in:', issues);
            toast.error(`Save may not have persisted: ${issues.join(', ')} did not match. This is usually caused by security rules — try disabling them in "Automation for Incidents". Contact support@shuffler.io if the issue persists.`);
          } else {
            console.log('[SaveVerify] Verified successfully');
          }
        } catch (verifyErr) {
          console.warn('[SaveVerify] Verification error:', verifyErr);
        }
      }, 1500);

      // Refresh revisions after a short delay so the Activity feed shows the new change
      setTimeout(() => {
        loadRevisions();
      }, 3000);

      // Schedule observable/enrichment refresh ~7s after save
      // Backend may update enrichments asynchronously after the save
      if (obsRefreshTimerRef.current) clearTimeout(obsRefreshTimerRef.current);
      setRefreshingObservables(true);
      const refreshId = Date.now();
      (obsRefreshTimerRef as any)._activeId = refreshId;
      // Hard wall-clock safety: even if the refresh fetch hangs (the
      // datastore fetch has no abort signal), force the spinner off after
      // 20s so the UI never gets stuck. Stored on the ref so a subsequent
      // refresh can clear it.
      const hardTimeout = setTimeout(() => {
        if ((obsRefreshTimerRef as any)._activeId === refreshId) {
          console.warn('[ObsRefresh] Hard timeout reached — forcing spinner off');
          setRefreshingObservables(false);
        }
      }, 20000);
      (obsRefreshTimerRef as any)._hardTimeout = hardTimeout;
      obsRefreshTimerRef.current = setTimeout(async () => {
        try {
          const refreshResult = isPublicView
            ? await getDatastoreItemPublic(incident.id, publicOrg!, publicAuth!)
            : await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
          if (refreshResult.success && refreshResult.item) {
            const refreshData = {
              key: refreshResult.item.key || incident.id,
              value: refreshResult.item.value,
              created: refreshResult.item.created,
              edited: refreshResult.item.edited,
              enrichments: refreshResult.item.enrichments,
            };
            const reParsed = parseIncidentFromDatastore(refreshData);
            if (reParsed) {
              const prevCount = editedObservables.filter(o => !o.archived).length + enrichments.length;
              const newEnrichments = reParsed.enrichments || [];
              const newObservables = reParsed.observables || [];
              const newCount = newObservables.filter((o: any) => !o.archived).length + newEnrichments.length;
              setEnrichments(newEnrichments);
              // Only update manual observables if server added new ones (don't overwrite user edits)
              if (newObservables.length > editedObservables.length) {
                setEditedObservables(newObservables);
              }
              if (newCount > prevCount) {
                toast.info(`${newCount - prevCount} new observable${newCount - prevCount > 1 ? 's' : ''} detected`, { duration: 4000 });
              }
              console.log(`[ObsRefresh] Refreshed observables: ${prevCount} → ${newCount}`);
            }
          }
        } catch (err) {
          console.warn('[ObsRefresh] Failed to refresh observables:', err);
        } finally {
          clearTimeout(hardTimeout);
          // Only clear loading if this is still the active refresh
          if ((obsRefreshTimerRef as any)._activeId === refreshId) {
            setRefreshingObservables(false);
          }
        }
      }, 7000);
    } finally {
      setIsSaving(false);
    }
  }, [incident, editedTitle, editedMessage, editedSeverity, editedAssignee, editedStatus, editedTlp, editedReferences, editedObservables, editedCustomFields, editedLabels, editedStakeholders, activity, tasks, addItem, getItem, sharedOrgs, loadRevisions]);

  // Cache stringified complex values to avoid re-serializing on every render
  const tasksJsonRef = useRef('');
  const refsJsonRef = useRef('');
  const obsJsonRef = useRef('');
  const cfJsonRef = useRef('');
  const labelsJsonRef = useRef('');
  const stakeholdersJsonRef = useRef('');
  useEffect(() => { tasksJsonRef.current = JSON.stringify(tasks); }, [tasks]);
  useEffect(() => { refsJsonRef.current = JSON.stringify(editedReferences); }, [editedReferences]);
  useEffect(() => { obsJsonRef.current = JSON.stringify(editedObservables); }, [editedObservables]);
  useEffect(() => { labelsJsonRef.current = JSON.stringify(editedLabels); }, [editedLabels]);
  useEffect(() => { stakeholdersJsonRef.current = JSON.stringify(editedStakeholders); }, [editedStakeholders]);
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
    if (!incident || !initialValuesRef.current || isPublicView) return;
    
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
    if (stakeholdersJsonRef.current !== init.stakeholders) changedFields.push('stakeholders');
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
      if (obsRefreshTimerRef.current) {
        clearTimeout(obsRefreshTimerRef.current);
      }
    };
  }, [incident, editedTitle, editedMessage, editedSeverity, editedAssignee, editedStatus, editedTlp, editedReferences, editedObservables, editedCustomFields, editedLabels, editedStakeholders, tasks, saveToDatastore]);

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

  // Load known stakeholders from the users datastore for autocomplete
  useEffect(() => {
    const loadKnownStakeholders = async () => {
      try {
        const res = await fetch(
          getApiUrl(`/api/v1/datastores/${DATASTORE_CATEGORIES.USERS}?limit=500`),
          { credentials: 'include', headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const all: Stakeholder[] = [];
          for (const item of data.data) {
            try {
              const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
              // Only show external stakeholders (not internal platform users)
              const customAttrs = parsed?.metadata?.extensions?.custom_attributes;
              const isExternal = customAttrs?.external === true;
              if (!isExternal) continue;
              all.push({
                id: item.key || parsed?.user?.uid || `sh-${Date.now()}`,
                name: parsed?.user?.name || item.key,
                email: customAttrs?.email || '',
                type: customAttrs?.stakeholder_type || 'technical',
                role: parsed?.actor?.user?.type || '',
                location: customAttrs?.location || '',
                phone: customAttrs?.phone || '',
              });
            } catch { /* skip */ }
          }
          setKnownStakeholders(all);
        }
      } catch { /* silent */ }
    };
    loadKnownStakeholders();
  }, []);

  // Save a stakeholder to the users datastore (OCSF format)
  const saveStakeholderToRegistry = useCallback(async (s: Stakeholder) => {
    const key = s.email || s.name.toLowerCase().replace(/\s+/g, '_');
    const ocsfUser = {
      class_uid: 3002,
      class_name: 'Authentication',
      category_uid: 3,
      is_mfa: false,
      user: {
        name: s.name,
        uid: key,
      },
      org: {
        name: '',
      },
      actor: {
        user: {
          type: s.role || '',
        },
      },
      status: 'Success',
      status_id: 1,
      metadata: {
        version: '1.0.0',
        product: {
          name: 'Shuffle',
          vendor_name: 'Shuffle',
        },
        extensions: {
          custom_attributes: {
            external: true,
            stakeholder_type: s.type,
            email: s.email || '',
            location: s.location || '',
            phone: s.phone || '',
          },
        },
      },
    };
    try {
      await setDatastoreItem(key, ocsfUser, DATASTORE_CATEGORIES.USERS);
    } catch (err) {
      console.warn('[Stakeholder] Failed to save to registry:', err);
    }
  }, []);

  // Filter suggestions based on search input
  const stakeholderSuggestions = useMemo(() => {
    if (!stakeholderSearch.trim()) return [];
    const q = stakeholderSearch.toLowerCase();
    return knownStakeholders.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.role && s.role.toLowerCase().includes(q))
    );
  }, [stakeholderSearch, knownStakeholders]);

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
      const trimmed = newObservableValue.trim();
      const existingIdx = editedObservables.findIndex(
        o => !o.archived && o.type === newObservableType && o.value.toLowerCase() === trimmed.toLowerCase()
      );
      if (existingIdx >= 0) {
        // Merge: update last_seen on existing observable
        const updated = [...editedObservables];
        updated[existingIdx] = { ...updated[existingIdx], last_seen: Date.now() };
        setEditedObservables(updated);
        toast.info(`Observable already exists — updated last seen`);
      } else {
        const now = Date.now();
        setEditedObservables([...editedObservables, { type: newObservableType, value: trimmed, first_seen: now, last_seen: now }]);
      }
      setNewObservableValue('');
    }
  };

  const handleRemoveObservable = (index: number) => {
    autoProgressStatus();
    const updated = [...editedObservables];
    updated[index] = { ...updated[index], archived: true };
    setEditedObservables(updated);
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
      ...(replyingTo ? {
        replyToId: replyingTo.id,
        replyToLabel: replyingTo.label,
        replyToPreview: replyingTo.preview,
      } : {}),
    };
    
    const updatedActivity = [...activity, commentActivity];
    setActivity(updatedActivity);
    setNewComment('');
    setCommentAttachments([]);
    setReplyingTo(null);
    
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
    // Demo Mode signal — lets the tour mark "ask the agent" as complete.
    try { window.dispatchEvent(new CustomEvent('demo:incident-comment-sent')); } catch { /* no-op */ }

    // Schedule observable/enrichment refresh ~7s after comment save
    // Backend may extract IOCs from comment text and create enrichments
    if (obsRefreshTimerRef.current) clearTimeout(obsRefreshTimerRef.current);
    setRefreshingObservables(true);
    const refreshId = Date.now();
    (obsRefreshTimerRef as any)._activeId = refreshId;
    // Hard wall-clock safety: force the spinner off after 20s even if the
    // datastore fetch hangs. The original safety timer here was a no-op
    // (`setTimeout(() => {}, 15000)`), which let the spinner run forever
    // when the backend was slow.
    const hardTimeout = setTimeout(() => {
      if ((obsRefreshTimerRef as any)._activeId === refreshId) {
        console.warn('[ObsRefresh/Comment] Hard timeout reached — forcing spinner off');
        setRefreshingObservables(false);
      }
    }, 20000);
    (obsRefreshTimerRef as any)._hardTimeout = hardTimeout;
    obsRefreshTimerRef.current = setTimeout(async () => {
      try {
        const refreshResult = isPublicView
          ? await getDatastoreItemPublic(incident.id, publicOrg!, publicAuth!)
          : await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
        if (refreshResult.success && refreshResult.item) {
          const refreshData = {
            key: refreshResult.item.key || incident.id,
            value: refreshResult.item.value,
            created: refreshResult.item.created,
            edited: refreshResult.item.edited,
            enrichments: refreshResult.item.enrichments,
          };
          const reParsed = parseIncidentFromDatastore(refreshData);
          if (reParsed) {
            const prevCount = editedObservables.filter(o => !o.archived).length + enrichments.length;
            const newEnrichments = reParsed.enrichments || [];
            const newObservables = reParsed.observables || [];
            const newCount = newObservables.filter((o: any) => !o.archived).length + newEnrichments.length;
            setEnrichments(newEnrichments);
            if (newObservables.length > editedObservables.length) {
              setEditedObservables(newObservables);
            }
            if (newCount > prevCount) {
              toast.info(`${newCount - prevCount} new observable${newCount - prevCount > 1 ? 's' : ''} detected`, { duration: 4000 });
            }
            console.log(`[ObsRefresh/Comment] Refreshed observables: ${prevCount} → ${newCount}`);
          }
        }
      } catch (err) {
        console.warn('[ObsRefresh/Comment] Failed to refresh observables:', err);
      } finally {
        clearTimeout(hardTimeout);
        if ((obsRefreshTimerRef as any)._activeId === refreshId) {
          setRefreshingObservables(false);
        }
      }
    }, 7000);
  };

  const handleResolve = async (resolutionData: ResolutionData) => {
    if (!incident) return;
    
    // Immediately update local status so auto-save won't revert it
    setEditedStatus('resolved');
    setIsSaving(true);
    
    const reasonLabel = RESOLUTION_REASONS.find(r => r.value === resolutionData.reason)?.label || resolutionData.reason;
    // GA: track single-incident resolve
    import('@/lib/analytics').then(({ trackPredefinedEvent, GA_EVENTS }) => {
      trackPredefinedEvent(GA_EVENTS.INCIDENT_RESOLVE, resolutionData.reason);
    });
    
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
    const laneKeys = taskStatuses.map((s) => s.key);
    const defaultOpenLane = laneKeys.find((k) => k !== 'done') || laneKeys[0] || 'todo';
    setTasks(tasks.map(task => {
      if (task.id !== taskId) return task;
      const becomingDone = !task.completed;
      const previousLane = task.completed
        ? 'done'
        : (task._lane && laneKeys.includes(task._lane) ? task._lane : defaultOpenLane);
      const nextLane = becomingDone ? 'done' : defaultOpenLane;
      const historyEntry = {
        from: previousLane,
        to: nextLane,
        at: Date.now(),
        by: currentUsername || undefined,
      };
      return {
        ...task,
        completed: becomingDone,
        completedAt: becomingDone ? Date.now() : 0,
        _lane: nextLane,
        statusHistory: [...(task.statusHistory || []), historyEntry],
      };
    }));
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
      bgcolor: 'hsl(var(--input))',
      '& fieldset': { borderColor: 'hsl(var(--border))' },
      '&:hover fieldset': { borderColor: 'hsl(var(--muted-foreground) / 0.4)' },
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
          to={entityBasePath} 
          variant="outlined" 
          startIcon={<ArrowBackIcon />}
        >
          Back to {entityPlural}
        </Button>
      </Box>
    );
  }

  const isResolved = incident.status === 'resolved';

  // ===========================================================================
  // Shared Timeline panel — used in two places:
  //  1. Right sidebar (on Tasks / Observables / Correlations tabs)
  //  2. Inline below the Description (Details tab) where it reads as a true
  //     timeline with a vertical rail. Single source of truth so behaviour
  //     stays in sync everywhere.
  // ===========================================================================
  const renderTimelinePanel = (variant: 'sidebar' | 'inline' = 'sidebar') => (
    <>
      {/* Agent runs loading indicator */}
      {agentRunsLoading && (
        <LinearProgress sx={{
          height: 2,
          bgcolor: 'transparent',
          '& .MuiLinearProgress-bar': { bgcolor: 'hsl(var(--primary))' },
        }} />
      )}
      {/* Timeline header with filter chips */}
      <Box sx={{
        px: 2,
        py: 1.5,
        borderBottom: '1px solid hsl(var(--border))',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Timeline</Typography>
            {revisionsLoading && <CircularProgress size={14} sx={{ color: '#ff6600' }} />}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {([
              { key: 'all' as const, label: 'All', count: undefined as number | undefined },
              { key: 'revisions' as const, label: 'Changes', count: revisions.length },
              { key: 'agent' as const, label: 'Agent', count: agentRuns.length },
              { key: 'manual' as const, label: 'Comments', count: activity.length },
              { key: 'steps' as const, label: 'Steps', count: undefined as number | undefined },
            ]).map(({ key, label, count }) => (
              <Chip
                key={key}
                label={count !== undefined ? `${label} (${count})` : label}
                size="small"
                variant="outlined"
                onClick={() => setActivityFilter(key)}
                sx={{
                  height: 24,
                  fontSize: '0.7rem',
                  bgcolor: 'transparent',
                  borderColor: activityFilter === key ? 'rgba(255, 102, 0, 0.5)' : 'rgba(255,255,255,0.12)',
                  color: activityFilter === key ? '#ff6600' : 'text.secondary',
                  '&:hover': { bgcolor: 'rgba(255, 102, 0, 0.06)' },
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* Comment Input */}
      <Box sx={{ p: 2, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255, 102, 0, 0.2)' }}>
            <PersonIcon sx={{ fontSize: 16, color: '#ff6600' }} />
          </Avatar>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }} ref={commentInputRef}>
            {replyingTo && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: 'rgba(255, 102, 0, 0.08)',
                  border: '1px solid rgba(255, 102, 0, 0.25)',
                }}
              >
                <ReplyIcon sx={{ fontSize: 14, color: '#ff6600' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#ff6600', lineHeight: 1.2 }}>
                    Replying to {replyingTo.label}
                  </Typography>
                  {replyingTo.preview && (
                    <Typography sx={{
                      fontSize: '0.68rem',
                      color: 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}>
                      {replyingTo.preview}
                    </Typography>
                  )}
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setReplyingTo(null)}
                  sx={{ width: 20, height: 20, color: 'text.secondary', '&:hover': { color: '#ff6600' } }}
                >
                  <DeleteIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            )}
            <Box data-tour="incident-comment-input" sx={{ position: 'relative' }}>
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
                placeholder={replyingTo ? `Reply to ${replyingTo.label}…` : 'Add a comment... (Enter to send, Shift+Enter for new line)'}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'hsl(var(--input))',
                    fontSize: '0.8rem',
                    pr: 9,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                  },
                }}
              />
              <input
                type="file"
                ref={commentFileInputRef}
                onChange={handleCommentAttach}
                style={{ display: 'none' }}
                multiple
              />
              <Tooltip title="Attach file">
                <IconButton
                  size="small"
                  onClick={() => commentFileInputRef.current?.click()}
                  disabled={commentUploading}
                  sx={{
                    position: 'absolute',
                    right: 36,
                    bottom: 8,
                    color: 'text.secondary',
                    '&:hover': { color: '#ff6600', bgcolor: 'rgba(255, 102, 0, 0.08)' },
                  }}
                >
                  {commentUploading ? (
                    <CircularProgress size={14} sx={{ color: 'text.secondary' }} />
                  ) : (
                    <AttachFileIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>
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
            {commentAttachments.length > 0 && (
              <FileAttachments
                attachments={commentAttachments}
                onChange={setCommentAttachments}
                namespace="incidents"
                labels={[incident.id, 'comments']}
                compact
                hideAddButton
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Unified Timeline Feed — when inline, render with a vertical rail behind the items */}
      <Box sx={{
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        overflow: 'auto',
        ...(variant === 'inline' && {
          position: 'relative',
          pl: 4.5,
          py: 2,
          // Vertical rail — anchored at the bottom (oldest) and growing
          // upward toward the newest item, matching the timeline direction
          // (newest-first / top). A subtle fade at the top reinforces that
          // the latest events are the "growing edge" of the thread.
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 19,
            top: 18,
            bottom: 18,
            width: '2px',
            background: 'linear-gradient(to top, hsl(var(--border)) 0%, hsl(var(--border)) 70%, hsl(var(--border) / 0.15) 100%)',
            borderRadius: 1,
          },
          // Each direct child gets a dot anchored to the rail. Default
          // alignment matches taller cards (avatar at top: 12, size 24 →
          // visual centre ~24px). Compact step pills (Observable/Correlation/
          // Task markers) opt-in to a higher dot via data-timeline-compact.
          '& > *': {
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -22,
              top: 18,
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'hsl(var(--card))',
              border: '2px solid #ff6600',
              zIndex: 1,
              boxShadow: '0 0 0 3px hsl(var(--background))',
            },
            '&[data-timeline-compact="true"]::before': {
              // Pill content centre is roughly 12px from its top
              // (py: 0.5 = 4px + 12px icon / 2). Dot half-height = 6.
              top: 6,
            },
          },
        }),
      }}>
        {renderTimelineFeedItems()}
      </Box>
    </>
  );

  // Builder for the unified timeline items (revisions + agent runs + comments).
  // Returns an array of JSX nodes (or a single empty-state node).
  const renderTimelineFeedItems = () => {
    type StepKind = 'task-created' | 'task-completed' | 'task-status-changed' | 'observable-added' | 'correlation-found' | 'incident-created';
    type TimelineItem =
      | { type: 'revision'; timestamp: number; data: any; idx: number; parsedCurrent: any; parsedPrevious: any | null }
      | { type: 'agent'; timestamp: number; data: typeof agentRuns[number] }
      | { type: 'manual'; timestamp: number; data: ActivityItem }
      | { type: 'step'; timestamp: number; kind: StepKind; id: string; label: string; detail?: string; count?: number; corrCount?: number; corrObsKeys?: string[]; obsType?: string; obsValue?: string };

    const items: TimelineItem[] = [];

    const parsedRevisions = revisions.map((rev) => {
      try {
        return typeof rev.value === 'string' ? JSON.parse(rev.value) : rev.value;
      } catch { return null; }
    });

    revisions.forEach((rev, idx) => {
      // For the "Incident created" item (the oldest revision), prefer the
      // incident's true creation timestamp instead of the revision's `edited`
      // field. The first stored revision is often written *after* the user's
      // first comment (the comment triggers the save), so its `edited` time
      // can be later than that comment's `Date.now()` — which would
      // incorrectly push the first comment below "Incident created" in the
      // newest-first feed. Anchoring to `incident.createdTs` keeps creation
      // at the bottom of the timeline where it belongs.
      const isOldest = idx === revisions.length - 1;
      const ts = isOldest && incident?.createdTs
        ? normalizeToMs(incident.createdTs)
        : normalizeToMs(rev.edited ?? rev.created);
      items.push({
        type: 'revision',
        timestamp: ts,
        data: rev,
        idx,
        parsedCurrent: parsedRevisions[idx],
        parsedPrevious: idx < revisions.length - 1 ? parsedRevisions[idx + 1] : null,
      });
    });

    // Synthetic "Incident created" step — guarantees the timeline always
    // shows when the incident was created, even before any revision has
    // been written (e.g., a freshly created manual incident). Suppressed
    // when revisions exist because the oldest revision already renders as
    // "Incident created".
    if (revisions.length === 0 && incident?.createdTs) {
      const createdTs = normalizeToMs(incident.createdTs);
      if (createdTs > 0 && (activityFilter === 'all' || activityFilter === 'steps')) {
        const sourceLabel = incident.source ? ` from ${incident.source}` : '';
        items.push({
          type: 'step',
          kind: 'incident-created',
          timestamp: createdTs,
          id: 'step-incident-created',
          label: 'Incident created',
          detail: `${incident.title || 'Untitled incident'}${sourceLabel}`,
        });
      }
    }

    if (activityFilter === 'all' || activityFilter === 'agent') {
      agentRuns.forEach((run) => {
        const ts = normalizeToMs(run.started_at);
        items.push({ type: 'agent', timestamp: ts, data: run });
      });
    }

    if (activityFilter === 'all' || activityFilter === 'manual') {
      activity.forEach((item) => {
        items.push({ type: 'manual', timestamp: normalizeToMs(item.timestamp), data: item });
      });
    }

    // ── Step injection ─────────────────────────────────────────────────────
    // Render Tasks, Observables and Correlations as small "step" markers in
    // the timeline so users can see *when* each artefact appeared. These are
    // injected purely on the frontend — no persistence needed.
    //
    // Timestamp sources:
    //   • Tasks → `createdAt` (and `completedAt` for completion steps).
    //     Falls back to incident creation time if missing on legacy data.
    //   • Observables (manual + enrichments) → `first_seen` when present,
    //     otherwise the incident creation time.
    //   • Correlations → "discovered at" (when the correlations API returned
    //     them); they have no native timestamp.
    if (activityFilter === 'all' || activityFilter === 'steps') {
      const fallbackTs = incident?.createdTs ? normalizeToMs(incident.createdTs) : 0;

      // Tasks — creation, status transitions, and completion each produce
      // a step so the user can see exactly when state changed and by whom.
      const laneLabel = (key: string): string =>
        taskStatuses.find((s) => s.key === key)?.label
        || (key === 'done' ? 'Done' : key.replace(/[_-]+/g, ' '));

      tasks.filter(t => !t.disabled).forEach((t) => {
        const createdTs = t.createdAt ? normalizeToMs(t.createdAt) : fallbackTs;
        if (createdTs > 0) {
          items.push({
            type: 'step',
            kind: 'task-created',
            timestamp: createdTs,
            id: `step-task-created-${t.id}`,
            label: 'Task created',
            detail: t.title,
          });
        }
        // Status transitions captured in `statusHistory` (every drag between
        // kanban columns appends an entry). Skip the trivial → Done case
        // because the dedicated 'task-completed' step already covers it.
        (t.statusHistory || []).forEach((entry, hIdx) => {
          if (!entry?.at) return;
          if (entry.to === 'done') return;
          const ts = normalizeToMs(entry.at);
          if (ts <= 0) return;
          items.push({
            type: 'step',
            kind: 'task-status-changed',
            timestamp: ts,
            id: `step-task-status-${t.id}-${hIdx}`,
            label: 'Task moved',
            detail: `${t.title} · ${laneLabel(entry.from)} → ${laneLabel(entry.to)}${entry.by ? ` by ${entry.by}` : ''}`,
          });
        });
        if (t.completed && t.completedAt) {
          const completedTs = normalizeToMs(t.completedAt);
          if (completedTs > 0) {
            items.push({
              type: 'step',
              kind: 'task-completed',
              timestamp: completedTs,
              id: `step-task-completed-${t.id}`,
              label: 'Task completed',
              detail: t.title,
            });
          }
        }
      });

      // Observables — manual entries + automated enrichments. Dedupe by
      // type+value so the same indicator does not appear twice. Bulk
      // observables added within a ~3s window into a single summary pill so
      // a burst of enrichments does not flood the timeline. Known-IOC
      // observables are *always* kept as their own standalone pill so the
      // bad indicator visibly stands out.
      const seenObs = new Set<string>();
      const allObservables: Array<{ type: string; value: string; first_seen?: string | number; source: 'manual' | 'enrichment' }> = [
        ...editedObservables.filter(o => !o.archived).map(o => ({
          type: o.type,
          value: o.value,
          first_seen: o.first_seen,
          source: 'manual' as const,
        })),
        ...enrichments.map(e => ({
          type: e.type || 'unknown',
          value: e.value || e.data || '',
          first_seen: e.first_seen,
          source: 'enrichment' as const,
        })),
      ];
      type ObsEntry = { key: string; type: string; value: string; ts: number; isIoc: boolean };
      const obsEntries: ObsEntry[] = [];
      allObservables.forEach((o) => {
        if (!o.value) return;
        const k = `${o.type}::${o.value}`.toLowerCase();
        if (seenObs.has(k)) return;
        seenObs.add(k);
        const ts = o.first_seen ? normalizeToMs(o.first_seen) : fallbackTs;
        if (ts > 0) {
          obsEntries.push({ key: k, type: o.type, value: o.value, ts, isIoc: iocObservableKeys.has(k) });
        }
      });
      // Sort oldest-first for deterministic bucketing.
      obsEntries.sort((a, b) => a.ts - b.ts);
      const OBS_BUCKET_MS = 3000;
      const obsBuckets: Array<{ ts: number; entries: ObsEntry[] }> = [];
      obsEntries.forEach((e) => {
        // Known-IOC observables never bulk — they always emit a standalone
        // pill so the bad indicator visibly stands out on the timeline.
        if (e.isIoc) {
          obsBuckets.push({ ts: e.ts, entries: [e] });
          return;
        }
        const last = obsBuckets[obsBuckets.length - 1];
        // Only merge into a bucket whose entries are all non-IOC.
        if (last && !last.entries[0].isIoc && Math.abs(e.ts - last.ts) <= OBS_BUCKET_MS) {
          last.entries.push(e);
          last.ts = Math.max(last.ts, e.ts);
        } else {
          obsBuckets.push({ ts: e.ts, entries: [e] });
        }
      });
      obsBuckets.forEach((b, i) => {
        if (b.entries.length === 1) {
          const e = b.entries[0];
          const corr = obsCorrelations[e.key];
          const corrCount = corr?.data?.length || 0;
          items.push({
            type: 'step',
            kind: 'observable-added',
            timestamp: e.ts,
            id: `step-obs-${e.key}`,
            label: 'Observable',
            obsType: e.type,
            obsValue: e.value,
            corrCount: corrCount > 0 ? corrCount : undefined,
            corrObsKeys: corrCount > 0 ? [e.key] : undefined,
          });
        } else {
          // Bulked → one pill summarising the burst. Detail lists the first
          // few values so the user still has a hint of what was added.
          const sample = b.entries.slice(0, 3).map(e => e.value).join(', ');
          const more = b.entries.length > 3 ? ` +${b.entries.length - 3} more` : '';
          // Aggregate correlation matches across every observable in the bucket
          // so the user can see "N matches" inline without a separate pill.
          let corrCount = 0;
          const corrObsKeys: string[] = [];
          b.entries.forEach((e) => {
            const c = obsCorrelations[e.key]?.data?.length || 0;
            if (c > 0) {
              corrCount += c;
              corrObsKeys.push(e.key);
            }
          });
          items.push({
            type: 'step',
            kind: 'observable-added',
            timestamp: b.ts,
            id: `step-obs-bulk-${i}-${b.ts}`,
            label: `${b.entries.length} observables`,
            detail: `${sample}${more}`,
            corrCount: corrCount > 0 ? corrCount : undefined,
            corrObsKeys: corrObsKeys.length > 0 ? corrObsKeys : undefined,
          });
        }
      });

      // Incident-level correlations stay as their own pill (these are
      // shared-attribute matches across other incidents, not per-observable).
      // Per-observable correlations have moved inline onto the observable pill
      // itself so the user can see the match next to the indicator that
      // triggered it instead of as a separate timeline row.
      if (correlationsDiscoveredAt && correlations.length > 0) {
        items.push({
          type: 'step',
          kind: 'correlation-found',
          timestamp: correlationsDiscoveredAt,
          id: `step-corr-incident`,
          label: 'Correlations found',
          detail: `${correlations.length} shared attribute${correlations.length === 1 ? '' : 's'} across other incidents`,
          count: correlations.length,
        });
      }
    }

    // Newest first. On exact-tie timestamps, force the "Incident created"
    // marker (the oldest revision) to always sort *after* every other item
    // so it stays anchored at the bottom of the feed — even when observables
    // or steps were stamped with the same `createdTs`.
    const oldestRevisionIdx = revisions.length - 1;
    const isCreationItem = (it: TimelineItem) => it.type === 'revision' && it.idx === oldestRevisionIdx;
    items.sort((a, b) => {
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      const aCreate = isCreationItem(a);
      const bCreate = isCreationItem(b);
      if (aCreate && !bCreate) return 1;   // a goes after b
      if (bCreate && !aCreate) return -1;  // b goes after a
      return 0;
    });

    if (items.length === 0) {
      return (
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
      );
    }

    const NOISE_FIELDS = new Set(['activity', 'updated_by', 'edited_time', 'updated_at', 'last_updated', 'comments']);

    const computeDiff = (current: any, previous: any): { added: string[]; removed: string[]; changed: { field: string; from: any; to: any }[] } => {
      const diff: { added: string[]; removed: string[]; changed: { field: string; from: any; to: any }[] } = { added: [], removed: [], changed: [] };
      if (!current || !previous) return diff;
      const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
      for (const key of allKeys) {
        if (NOISE_FIELDS.has(key)) continue;
        const inCurrent = key in current;
        const inPrevious = key in previous;
        if (inCurrent && !inPrevious) diff.added.push(key);
        else if (!inCurrent && inPrevious) diff.removed.push(key);
        else if (inCurrent && inPrevious && JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
          diff.changed.push({ field: key, from: previous[key], to: current[key] });
        }
      }
      return diff;
    };

    const truncateValue = (val: any, maxLen = 60): string => {
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
    };

    // ─── Reply threading helpers ────────────────────────────────────────────
    // Each timeline item gets a stable canonical id; manual comments may carry
    // a `replyToId` pointing at one of those ids. We then group replies under
    // their parent and render them indented so users can pivot between
    // separate threads (one per parent) without losing the chronology.
    const getItemKey = (it: TimelineItem): string => {
      if (it.type === 'revision') {
        const rev = it.data;
        return `rev-${rev.id || rev.key || it.idx}`;
      }
      if (it.type === 'agent') return `agent-${it.data.execution_id}`;
      if (it.type === 'step') return it.id;
      return it.data.id;
    };
    const getItemLabel = (it: TimelineItem): string => {
      if (it.type === 'revision') {
        if (it.idx === revisions.length - 1 && activityFilter !== 'revisions') return 'Incident created';
        return `Revision #${revisions.length - it.idx}`;
      }
      if (it.type === 'agent') return 'Agent run';
      if (it.type === 'step') return it.label;
      return `${it.data.user || 'Comment'}`;
    };
    const getItemPreview = (it: TimelineItem): string => {
      if (it.type === 'revision') {
        const t = it.parsedCurrent?.title || it.parsedCurrent?.finding_info?.title || '';
        return String(t).slice(0, 80);
      }
      if (it.type === 'agent') {
        const r: any = it.data;
        return String(r.run_input || r.summary || r.status || '').slice(0, 80);
      }
      if (it.type === 'step') return (it.detail || '').slice(0, 80);
      const text = it.data.content && /<[a-z][\s\S]*>/i.test(it.data.content)
        ? htmlToPlainText(it.data.content).trim()
        : (it.data.content || '');
      return text.slice(0, 80);
    };

    const startReplyTo = (it: TimelineItem) => {
      setReplyingTo({ id: getItemKey(it), label: getItemLabel(it), preview: getItemPreview(it) });
      // Scroll the input into view + focus it so the user can immediately type.
      setTimeout(() => {
        commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const ta = commentInputRef.current?.querySelector('textarea');
        (ta as HTMLTextAreaElement | null)?.focus();
      }, 50);
    };

    // Build canonical-id set + replies-by-parent map. Only manual items can
    // *be* replies; any timeline item can be a parent.
    const allKeys = new Set(items.map(getItemKey));
    const repliesByParent = new Map<string, TimelineItem[]>();
    for (const it of items) {
      if (it.type !== 'manual') continue;
      const parentId = it.data.replyToId;
      if (!parentId || !allKeys.has(parentId)) continue;
      const arr = repliesByParent.get(parentId) || [];
      arr.push(it);
      repliesByParent.set(parentId, arr);
    }
    // Replies render oldest-first inside their thread so the conversation
    // reads top-to-bottom even though the outer feed is newest-first.
    repliesByParent.forEach((arr) => arr.sort((a, b) => a.timestamp - b.timestamp));

    // Top-level items = anything that isn't a reply with a known parent.
    const topLevel = items.filter((it) => {
      if (it.type !== 'manual') return true;
      const parentId = it.data.replyToId;
      return !parentId || !allKeys.has(parentId);
    });

    const renderItem = (item: TimelineItem, opts: { isReply?: boolean } = {}): React.ReactNode => {
      const { isReply = false } = opts;
      const itemKey = getItemKey(item);

      // Reply button — added to every item so users can start a thread off
      // any timeline event (revision, agent run, or comment).
      const replyButton = (
        <Tooltip title="Reply to this in a new comment" arrow>
          <IconButton
            size="small"
            onClick={() => startReplyTo(item)}
            sx={{
              width: 22,
              height: 22,
              color: 'text.secondary',
              '&:hover': { color: '#ff6600', bgcolor: 'rgba(255, 102, 0, 0.08)' },
            }}
          >
            <ReplyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      );

      if (item.type === 'revision') {
        const rev = item.data;
        const isLatest = item.idx === 0;
        const isFirst = item.idx === revisions.length - 1;
        const diff = item.parsedPrevious ? computeDiff(item.parsedCurrent, item.parsedPrevious) : null;
        const totalChanges = diff ? diff.added.length + diff.removed.length + diff.changed.length : 0;

        if (activityFilter !== 'revisions' && !isFirst && diff && totalChanges === 0) return null;

        const showAsCreation = isFirst && activityFilter !== 'revisions';
        const initialTitle = showAsCreation
          ? (item.parsedCurrent?.title
              || item.parsedCurrent?.finding_info?.title
              || item.parsedCurrent?.message
              || '')
          : '';
        const initialDescription = showAsCreation
          ? (item.parsedCurrent?.desc
              || item.parsedCurrent?.description
              || item.parsedCurrent?.supporting_data
              || '')
          : '';

        return (
          <Box
            key={`rev-${rev.id || rev.key || item.idx}`}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(100, 149, 237, 0.04)',
              border: '1px solid rgba(100, 149, 237, 0.12)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Avatar sx={{ width: 24, height: 24, bgcolor: 'rgba(100, 149, 237, 0.15)' }}>
                <HistoryIcon sx={{ fontSize: 14, color: '#6495ed' }} />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.73rem' }}>
                    {showAsCreation ? 'Incident created' : `Revision #${revisions.length - item.idx}`}
                  </Typography>
                  {isLatest && !showAsCreation && (
                    <Chip label="Latest" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.58rem', bgcolor: 'transparent', borderColor: 'rgba(255, 102, 0, 0.4)', color: '#ff6600', fontWeight: 600 }} />
                  )}
                  {isFirst && !isLatest && !showAsCreation && (
                    <Chip label="Initial" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.58rem', bgcolor: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: 'text.secondary', fontWeight: 600 }} />
                  )}
                  {totalChanges > 0 && !showAsCreation && (
                    <Chip label={`${totalChanges} change${totalChanges !== 1 ? 's' : ''}`} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.58rem', bgcolor: 'transparent', borderColor: 'rgba(255, 102, 0, 0.4)', color: '#ff6600' }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                    {item.timestamp ? formatRelativeTime(item.timestamp) : 'Unknown'}
                  </Typography>
                  {rev.updated_by && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                      by {rev.updated_by}
                    </Typography>
                  )}
                </Box>
              </Box>
              {replyButton}
              {rev.value && (
                <Tooltip title="View revision data">
                  <IconButton
                    size="small"
                    onClick={() => {
                      try {
                        const parsed = typeof rev.value === 'string' ? JSON.parse(rev.value) : rev.value;
                        const changedKeys = new Set<string>();
                        if (diff) {
                          diff.added.forEach(k => changedKeys.add(k));
                          diff.removed.forEach(k => changedKeys.add(k));
                          diff.changed.forEach(c => changedKeys.add(c.field));
                        }
                        setRevisionDialogData({ json: JSON.stringify(parsed, null, 2), changedKeys });
                      } catch {
                        toast.error('Could not parse revision data');
                      }
                    }}
                    sx={{ color: 'text.secondary', width: 24, height: 24, '&:hover': { color: '#ff6600' } }}
                  >
                    <VisibilityIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {showAsCreation && (initialTitle || initialDescription) && (
              <Box sx={{ mt: 0.75, ml: 4, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {initialTitle && (
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.35 }}>
                    {initialTitle}
                  </Typography>
                )}
                {initialDescription && (
                  <Typography sx={{
                    fontSize: '0.72rem',
                    color: 'hsl(var(--muted-foreground))',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    display: '-webkit-box',
                    WebkitLineClamp: 6,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {String(initialDescription).replace(/<[^>]*>/g, '').trim()}
                  </Typography>
                )}
              </Box>
            )}

            {diff && totalChanges > 0 && !showAsCreation && (
              <Box sx={{ mt: 0.75, ml: 4, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {diff.changed.map(({ field, from, to }) => (
                  <Box key={field} sx={{ display: 'flex', flexDirection: 'column', gap: 0.15 }}>
                    <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'hsl(var(--foreground))', fontFamily: 'JetBrains Mono, monospace' }}>
                      {field}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Typography sx={{
                        fontSize: '0.6rem', fontFamily: 'JetBrains Mono, monospace',
                        color: 'hsl(var(--destructive))', bgcolor: 'hsl(var(--destructive) / 0.08)',
                        px: 0.5, py: 0.15, borderRadius: 0.5, lineHeight: 1.4,
                        textDecoration: 'line-through', opacity: 0.8,
                      }}>
                        {truncateValue(from)}
                      </Typography>
                      <Typography sx={{
                        fontSize: '0.6rem', fontFamily: 'JetBrains Mono, monospace',
                        color: 'hsl(var(--status-resolved))', bgcolor: 'hsl(var(--status-resolved) / 0.08)',
                        px: 0.5, py: 0.15, borderRadius: 0.5, lineHeight: 1.4,
                      }}>
                        {truncateValue(to)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                {diff.added.map((field) => (
                  <Typography key={field} sx={{ fontSize: '0.63rem', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'hsl(var(--status-resolved))' }}>
                    + {field}
                  </Typography>
                ))}
                {diff.removed.map((field) => (
                  <Typography key={field} sx={{ fontSize: '0.63rem', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'hsl(var(--destructive))' }}>
                    − {field}
                  </Typography>
                ))}
              </Box>
            )}
            {isFirst && !diff && !showAsCreation && (
              <Typography variant="caption" sx={{ ml: 4, color: 'text.disabled', fontSize: '0.6rem', fontStyle: 'italic' }}>
                Initial revision
              </Typography>
            )}
          </Box>
        );
      }

      if (item.type === 'agent') {
        return (
          <Box key={`agent-${item.data.execution_id}`} sx={{ position: 'relative' }}>
            <AgentActivityFeed runs={[item.data]} />
            <Box sx={{ position: 'absolute', top: 6, right: 6 }}>{replyButton}</Box>
          </Box>
        );
      }

      if (item.type === 'step') {
        // Compact "step" pill — these are derived events (task created /
        // observable added / correlation found) injected on the frontend so
        // the user can see *when* every artefact appeared on the timeline.
        const stepStyle: Record<StepKind, { color: string; icon: React.ReactNode }> = {
          'task-created':         { color: '#a855f7', icon: <TaskAltIcon sx={{ fontSize: 12 }} /> },
          'task-completed':       { color: '#22c55e', icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
          'task-status-changed':  { color: '#3b82f6', icon: <ForwardIcon sx={{ fontSize: 12 }} /> },
          'observable-added':     { color: '#06b6d4', icon: <VisibilityIcon sx={{ fontSize: 12 }} /> },
          'correlation-found':    { color: '#f59e0b', icon: <LinkIcon sx={{ fontSize: 12 }} /> },
          'incident-created':     { color: '#6495ed', icon: <HistoryIcon sx={{ fontSize: 12 }} /> },
        };
        const cfg = stepStyle[item.kind];
        // Highlight observable-added pills when the underlying observable
        // arrived in the most recent background poll. The id format is
        // `step-obs-${type::value}` (lowercase) — matched against
        // newlyArrivedObservables which uses the same key format.
        const isStepHighlighted = item.kind === 'observable-added'
          && item.id.startsWith('step-obs-')
          && newlyArrivedObservables.has(item.id.slice('step-obs-'.length));

        // Decide whether the pill should be clickable and where it jumps to.
        // Observable pills jump to the matching row in the Observables tab;
        // correlation pills jump to the Correlations tab (and to the matching
        // observable row when the correlation was discovered per-observable).
        let pillOnClick: (() => void) | undefined;
        if (item.kind === 'observable-added' && item.id.startsWith('step-obs-') && !item.id.startsWith('step-obs-bulk-')) {
          const obsKey = item.id.slice('step-obs-'.length);
          pillOnClick = () => {
            // Demo mode: notify the tour when the user clicks an IP pill.
            if (obsKey.toLowerCase().startsWith('ip::') || obsKey.toLowerCase().startsWith('ipv4::') || obsKey.toLowerCase().startsWith('ipv6::')) {
              try { window.dispatchEvent(new CustomEvent('demo:timeline-ip-clicked', { detail: { obsKey } })); } catch { /* ignore */ }
            }
            focusObservableFromTimeline(obsKey);
          };
        } else if (item.kind === 'observable-added' && item.id.startsWith('step-obs-bulk-')) {
          // Bulked observable pills jump to the Observables tab generally.
          pillOnClick = () => focusObservableFromTimeline(null);
        } else if (item.kind === 'correlation-found') {
          // Bulked observable correlations (id prefix `step-corr-obs-bulk-`)
          // can't jump to a single observable row — send the user to the
          // Correlations tab instead.
          if (item.id.startsWith('step-corr-obs-bulk-')) {
            pillOnClick = () => focusCorrelationFromTimeline(null);
          } else if (item.id.startsWith('step-corr-obs-')) {
            const obsKey = item.id.slice('step-corr-obs-'.length).toLowerCase();
            pillOnClick = () => focusObservableFromTimeline(obsKey);
          } else {
            pillOnClick = () => focusCorrelationFromTimeline(null);
          }
        }
        const isClickable = !!pillOnClick;
        // Detect whether the pill represents (or correlates to) an observable
        // already known to match an IOC / threat-feed entry. We pull the obs
        // key out of the synthetic `step-obs-` / `step-corr-obs-` id format.
        // Bulked correlations have no single underlying obs — they never
        // light up as IOC pills.
        let pillObsKey: string | null = null;
        if (item.kind === 'observable-added' && item.id.startsWith('step-obs-') && !item.id.startsWith('step-obs-bulk-')) {
          pillObsKey = item.id.slice('step-obs-'.length).toLowerCase();
        } else if (
          item.kind === 'correlation-found'
          && item.id.startsWith('step-corr-obs-')
          && !item.id.startsWith('step-corr-obs-bulk-')
        ) {
          pillObsKey = item.id.slice('step-corr-obs-'.length).toLowerCase();
        }
        const isIocPill = !!pillObsKey && iocObservableKeys.has(pillObsKey);
        // IOC pills override the kind-based color with the destructive token
        // so the user immediately sees that *this* observable is known-bad —
        // not just that an observable was added.
        const pillColor = isIocPill ? 'hsl(var(--destructive))' : cfg.color;
        const pillBg = isIocPill ? 'hsl(var(--destructive) / 0.08)' : `${cfg.color}0F`;
        const pillBorder = isIocPill ? 'hsl(var(--destructive) / 0.5)' : `${cfg.color}33`;
        const pillBgHover = isIocPill ? 'hsl(var(--destructive) / 0.14)' : `${cfg.color}1F`;
        const pillBorderHover = isIocPill ? 'hsl(var(--destructive) / 0.7)' : `${cfg.color}66`;
        return (
          <Box
            key={item.id}
            data-timeline-compact="true"
            className={isStepHighlighted ? 'incident-new-flash' : undefined}
            onClick={pillOnClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.5,
              ml: 0.5,
              borderRadius: 999,
              bgcolor: pillBg,
              border: `1px solid ${pillBorder}`,
              maxWidth: 'fit-content',
              cursor: isClickable ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
              ...(isClickable && {
                '&:hover': {
                  bgcolor: pillBgHover,
                  borderColor: pillBorderHover,
                },
              }),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', color: pillColor }}>
              {isIocPill ? <WarningAmberIcon sx={{ fontSize: 12 }} /> : cfg.icon}
            </Box>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: pillColor }}>
              {item.label}
            </Typography>
            {isIocPill && (
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  px: 0.6,
                  py: 0.05,
                  borderRadius: 999,
                  bgcolor: 'hsl(var(--destructive) / 0.15)',
                  color: 'hsl(var(--destructive))',
                  border: '1px solid hsl(var(--destructive) / 0.4)',
                }}
              >
                Known IOC
              </Typography>
            )}
            {item.detail && (
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: isIocPill ? 'hsl(var(--destructive))' : 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 320,
                }}
                title={item.detail}
              >
                {item.detail}
              </Typography>
            )}
            {item.kind === 'observable-added' && !!item.corrCount && (
              <Typography
                onClick={(ev) => {
                  ev.stopPropagation();
                  // Single observable → flash its row in the Observables tab.
                  // Bulked → just send to the Correlations tab.
                  if (item.corrObsKeys && item.corrObsKeys.length === 1) {
                    focusObservableFromTimeline(item.corrObsKeys[0]);
                  } else {
                    focusCorrelationFromTimeline(null);
                  }
                }}
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  px: 0.6,
                  py: 0.05,
                  borderRadius: 999,
                  bgcolor: 'hsl(var(--warning, 38 92% 50%) / 0.15)',
                  color: 'hsl(38 92% 50%)',
                  border: '1px solid hsl(38 92% 50% / 0.4)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': { bgcolor: 'hsl(38 92% 50% / 0.22)' },
                }}
                title={`${item.corrCount} correlation match${item.corrCount === 1 ? '' : 'es'}`}
              >
                <LinkIcon sx={{ fontSize: 10 }} />
                {item.corrCount} match{item.corrCount === 1 ? '' : 'es'}
              </Typography>
            )}
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', ml: 'auto', pl: 1 }}>
              {item.timestamp ? formatRelativeTime(item.timestamp) : ''}
            </Typography>
          </Box>
        );
      }

      // Manual activity
      const actItem = item.data;
      const isOwnMessage = actItem.user === currentUsername;
      const messageAge = Date.now() - actItem.timestamp;
      const isDeleted = !!actItem.deleted;
      const canDelete = !isDeleted && isOwnMessage && actItem.type === 'comment' && messageAge < 5 * 60 * 1000;
      const timeRemaining = Math.max(0, Math.ceil((5 * 60 * 1000 - messageAge) / 60000));

      const isActHighlighted = !!actItem.id && newlyArrivedActivity.has(actItem.id);
      return (
        <Box
          key={actItem.id}
          className={isActHighlighted ? 'incident-new-flash' : undefined}
          sx={{
            display: 'flex',
            gap: 1.5,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: isDeleted
              ? 'hsl(var(--muted) / 0.3)'
              : actItem.type === 'comment' ? 'rgba(255, 102, 0, 0.05)' : 'hsl(var(--muted) / 0.5)',
            border: '1px solid',
            borderColor: isDeleted
              ? 'hsl(var(--border-subtle))'
              : actItem.type === 'comment' ? 'rgba(255, 102, 0, 0.1)' : 'hsl(var(--border-subtle))',
            position: 'relative',
            opacity: isDeleted ? 0.7 : 1,
            '&:hover .delete-btn': { opacity: 1 },
            '&:hover .reply-btn': { opacity: 1 },
          }}
        >
          <Avatar sx={{
            width: 24,
            height: 24,
            bgcolor: isDeleted
              ? 'hsl(var(--border-subtle))'
              : actItem.type === 'comment' ? 'rgba(255, 102, 0, 0.2)' : 'rgba(255,255,255,0.08)',
          }}>
            {getActivityIcon(actItem.type)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                {actItem.user}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                {formatRelativeTime(actItem.timestamp)}
              </Typography>
              {isReply && actItem.replyToLabel && (
                <Chip
                  icon={<ReplyIcon sx={{ fontSize: 11 }} />}
                  label={actItem.replyToLabel}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    bgcolor: 'transparent',
                    borderColor: 'rgba(255, 102, 0, 0.3)',
                    color: 'text.secondary',
                    '& .MuiChip-icon': { color: '#ff6600', ml: 0.5 },
                  }}
                />
              )}
            </Box>
            {isDeleted ? (
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.8rem',
                  color: 'text.disabled',
                  fontStyle: 'italic',
                }}
              >
                Comment deleted
              </Typography>
            ) : (
              <>
                <MentionText
                  text={actItem.content && /<[a-z][\s\S]*>/i.test(actItem.content) ? htmlToPlainText(actItem.content).trim() : actItem.content}
                  sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'pre-wrap' }}
                />
                {actItem.attachments && actItem.attachments.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {actItem.attachments.map((att, ai) => (
                      <Chip
                        key={ai}
                        label={att.filename}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'transparent', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3b82f6' }}
                      />
                    ))}
                  </Box>
                )}
              </>
            )}
          </Box>
          {!isDeleted && (
            <Box
              className="reply-btn"
              sx={{
                position: 'absolute',
                top: 4,
                right: canDelete ? 28 : 4,
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
            >
              {replyButton}
            </Box>
          )}
          {canDelete && (
            <Tooltip title={`Delete (${timeRemaining}m left)`} arrow>
              <IconButton
                className="delete-btn"
                size="small"
                onClick={() => setCommentToDelete(actItem.id)}
                sx={{
                  position: 'absolute', top: 4, right: 4, width: 20, height: 20,
                  opacity: 0, transition: 'opacity 0.2s',
                  bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                  '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' },
                }}
              >
                <DeleteIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      );
    };

    // Render top-level items, threading replies indented underneath. The
    // indent + left rail visually groups the conversation while keeping the
    // outer chronology intact.
    return topLevel.map((item) => {
      const itemKey = getItemKey(item);
      const replies = repliesByParent.get(itemKey) || [];
      const node = renderItem(item);
      if (!node) return null;
      if (replies.length === 0) return node;
      return (
        <Box key={`thread-${itemKey}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {node}
          <Box
            sx={{
              ml: 4,
              pl: 2,
              borderLeft: '2px solid rgba(255, 102, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {replies.map((reply) => renderItem(reply, { isReply: true }))}
          </Box>
        </Box>
      );
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Read-only banner for shared/public view */}
      {isPublicView && (
        <Box sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <VisibilityIcon sx={{ fontSize: 18, color: '#3b82f6' }} />
          <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 500 }}>
            Shared view — This incident is read-only.
          </Typography>
        </Box>
      )}

      {/* Agent action required banner — shown when navigating from dashboard */}
      {(() => {
        const agentActionId = searchParams.get('agent_action');
        if (!agentActionId || !agentRuns?.length) return null;
        const matchedRun = agentRuns.find((r: any) => r.execution_id === agentActionId);
        if (!matchedRun) return null;

        const status = matchedRun.status?.toUpperCase() || '';
        const isWaiting = status === 'WAITING';
        const isFailed = status === 'FAILED' || status === 'ABORTED';

        // Determine what to show
        let bannerTitle = 'Action Required';
        let bannerDescription = 'The AI agent needs your input on this incident.';
        let bannerColor = '--severity-high';
        let bannerIcon = <AutoFixHighIcon sx={{ fontSize: 20 }} />;
        let actionSteps: string[] = [];

        if (isWaiting) {
          bannerTitle = 'Approval Required';
          bannerDescription = 'The AI agent is waiting for your approval before it can continue processing this incident.';
          bannerColor = '--severity-info';
          actionSteps = [
            'Review the agent\'s proposed action in the Activity feed below.',
            'Verify the action is appropriate for this incident.',
            'Approve or reject the action to let the agent proceed.',
          ];
        } else if (isFailed) {
          bannerTitle = 'Agent Failed — Manual Action Needed';
          bannerDescription = 'The AI agent encountered an error while processing this incident. You need to investigate and take manual action.';
          bannerColor = '--severity-critical';
          actionSteps = [
            'Check the Agent activity in the feed below for error details.',
            'Manually perform the action the agent could not complete.',
            'Update the incident status accordingly.',
          ];
        } else {
          bannerTitle = 'Review Required';
          bannerDescription = 'The AI agent flagged uncertainty in its analysis of this incident. Please review and confirm.';
          bannerColor = '--severity-medium';
          actionSteps = [
            'Review the agent\'s findings in the Activity feed below.',
            'Verify the analysis against the incident data.',
            'Confirm or correct the agent\'s conclusions.',
          ];
        }

        return (
          <Box sx={{
            mb: 2,
            px: 3,
            py: 2.5,
            borderRadius: 2,
            backgroundColor: `hsl(var(${bannerColor}) / 0.06)`,
            border: `1px solid hsl(var(${bannerColor}) / 0.2)`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{ color: `hsl(var(${bannerColor}))`, display: 'flex' }}>
                {bannerIcon}
              </Box>
              <Typography sx={{
                fontWeight: 600,
                fontSize: '0.95rem',
                color: `hsl(var(${bannerColor}))`,
              }}>
                {bannerTitle}
              </Typography>
            </Box>
            <Typography sx={{
              fontSize: '0.84rem',
              color: 'hsl(var(--foreground))',
              mb: 1.5,
              lineHeight: 1.5,
            }}>
              {bannerDescription}
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.5, mb: 1 }}>
              {actionSteps.map((step, i) => (
                <Box component="li" key={i} sx={{ mb: 0.5 }}>
                  <Typography sx={{
                    fontSize: '0.82rem',
                    color: 'hsl(var(--muted-foreground))',
                    lineHeight: 1.5,
                  }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Button
              size="small"
              onClick={() => {
                // Remove the param so banner can be dismissed
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('agent_action');
                const paramStr = newParams.toString();
                window.history.replaceState(null, '', `${window.location.pathname}${paramStr ? '?' + paramStr : ''}`);
              }}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                color: 'hsl(var(--muted-foreground))',
                mt: 0.5,
              }}
            >
              Dismiss
            </Button>
          </Box>
        );
      })()}

      {/* Compact Header */}
      <Box sx={{ mb: 2 }}>
        {/* Back link */}
        <Box 
          component={Link}
          to={entityBasePath}
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
          <Typography variant="body2">Back to {entityPlural}</Typography>
        </Box>

        {/* Multi-org / Cross-org banner */}
        {(isCrossOrg || sharedOrgs.length > 0) && (
          <Box sx={{
            mb: 2,
            px: 2,
            py: 1.5,
            borderRadius: 1.5,
            bgcolor: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
          }}>
            <LanguageIcon sx={{ fontSize: 16, color: '#a78bfa', flexShrink: 0 }} />
            {sharedOrgs.length > 0 ? (
              <>
                <Typography sx={{ fontSize: '0.82rem', color: 'hsl(var(--foreground))' }}>
                  This incident exists in <strong>{sharedOrgs.length + 1} organizations</strong> — changes sync to all:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Show the "viewing" org first */}
                  {(() => {
                    const viewingOrg = isCrossOrg
                      ? { name: crossOrgInfo?.name || crossOrgId, image: crossOrgInfo?.image }
                      : { name: userInfo?.active_org?.name || '', image: userInfo?.active_org?.image };
                    return (
                      <Chip
                        size="small"
                        variant="outlined"
                        avatar={viewingOrg.image ? <img src={viewingOrg.image} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} /> : undefined}
                        label={viewingOrg.name}
                        sx={{ height: 22, fontSize: '0.72rem', bgcolor: 'transparent', borderColor: 'rgba(167, 139, 250, 0.4)', color: '#a78bfa', fontWeight: 600 }}
                      />
                    );
                  })()}
                  {sharedOrgs.map(org => (
                    <Chip
                      key={org.id}
                      size="small"
                      variant="outlined"
                      avatar={org.image ? <img src={org.image} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} /> : undefined}
                      label={org.name}
                      sx={{ height: 22, fontSize: '0.72rem', bgcolor: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: 'text.secondary' }}
                    />
                  ))}
                </Box>
              </>
            ) : isCrossOrg && (
              <>
                {crossOrgInfo?.image ? (
                  <img src={crossOrgInfo.image} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
                ) : null}
                <Typography sx={{ fontSize: '0.82rem', color: 'hsl(var(--foreground))' }}>
                  Viewing incident for organization <strong>{crossOrgInfo?.name || crossOrgId}</strong>
                </Typography>
              </>
            )}
          </Box>
        )}


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
                onChange={(e) => !isPublicView && setEditedTitle(e.target.value)}
                variant="standard"
                placeholder="Enter title..."
                inputProps={{ readOnly: isPublicView }}
                InputProps={{
                  disableUnderline: true,
                  sx: { 
                    fontSize: '1.1rem', 
                    fontWeight: 600,
                    ...(!isPublicView && { '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }),
                    borderRadius: 1,
                    px: 0.5,
                  },
                }}
                sx={{ flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap', ...(isPublicView && { pointerEvents: 'none' }) }}>
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
                    color: statusConfig[editedStatus]?.color || '#f59e0b',
                    '& .MuiSelect-select': { 
                      py: 0.25, px: 1,
                      borderRadius: 3,
                      bgcolor: statusConfig[editedStatus]?.bg || 'rgba(245, 158, 11, 0.15)',
                      border: !statusConfig[editedStatus] ? '1px dashed rgba(245, 158, 11, 0.4)' : 'none',
                    },
                    '& .MuiSelect-icon': { color: statusConfig[editedStatus]?.color || '#f59e0b', fontSize: 16 },
                  }}
                  renderValue={(val) => {
                    if (!statusConfig[val]) return `⚠ ${val.replace(/_/g, ' ')}`;
                    return statusConfig[val].label;
                  }}
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
                onClick={async () => {
                  setIsRefreshing(true);
                  await loadIncident(false);
                  setIsRefreshing(false);
                }}
                disabled={loading || isRefreshing}
                sx={{ 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1,
                  width: 32,
                  height: 32,
                }}
              >
                <RefreshIcon fontSize="small" sx={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
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

            {!isPublicView && (
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
            )}
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
              {/* Simple view (kanban) */}
              <MenuItem
                onClick={() => {
                  setActionsMenuAnchor(null);
                  if (incident?.id) navigate(`/incidents-simple/${incident.id}`);
                }}
              >
                <TaskAltIcon sx={{ fontSize: 16, mr: 1 }} />
                Simple view
              </MenuItem>
              {/* Visit Source */}
              <MenuItem disabled>
                <LinkIcon sx={{ fontSize: 16, mr: 1 }} />
                Visit Source
              </MenuItem>
              <Divider />
              {/* Resync */}
              <MenuItem
                disabled={isSaving || !incident?.source || incident?.source === 'Tenzir' || (() => {
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
                  resyncState.add(incident.id);
                  const label = source ? `Resyncing from ${source}…` : 'Resyncing…';
                  toast.success(label, { duration: 30000 });
                  try {
                    const preResult = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
                    const previousEdited = preResult.item?.edited || 0;

                    const response = await fetch(getApiUrl('/api/v1/apps/categories/run'), {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                        ...crossOrgHeaders,
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
                      resyncState.remove(incident.id);
                      return;
                    }
                    // Poll every 5s for up to 30s checking if the item was updated
                    let pollCount = 0;
                    const pollInterval = setInterval(async () => {
                      pollCount++;
                      const postResult = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
                      const newEdited = postResult.item?.edited || 0;
                        if (newEdited && newEdited !== previousEdited) {
                          clearInterval(pollInterval);
                          await loadIncident(false);
                          setIsResyncing(false);
                          resyncState.remove(incident.id);
                          toast.success('Resync complete — update found');
                        } else if (pollCount >= 6) {
                          clearInterval(pollInterval);
                          await loadIncident(false);
                          setIsResyncing(false);
                          resyncState.remove(incident.id);
                          toast.info('Resync complete — no changes detected');
                        }
                    }, 5000);
                  } catch {
                    toast.error('Resync failed');
                    setIsResyncing(false);
                    resyncState.remove(incident.id);
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
                    headers: { ...getAuthHeader(), ...crossOrgHeaders },
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
              <Divider />
              {/* Merge */}
              <MenuItem
                disabled={isSaving}
                onClick={() => {
                  setActionsMenuAnchor(null);
                  setShowMergeDialog(true);
                }}
              >
                <CallMergeIcon sx={{ fontSize: 16, mr: 1 }} />
                Merge Into…
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
              {incident?.rawOCSF?.shuffle_execution_id && (
                <MenuItem
                  onClick={() => {
                    setActionsMenuAnchor(null);
                    window.open(`https://shuffler.io/workflows/${incident.rawOCSF.shuffle_execution_id}?execution_id=${incident.rawOCSF.shuffle_execution_id}`, '_blank');
                  }}
                >
                  <SettingsIcon sx={{ fontSize: 16, mr: 1 }} />
                  View Automation
                </MenuItem>
              )}
            </Menu>

          </Box>
        </Box>
      </Box>

      {/* Main content with Activity sidebar */}
      {/* LayoutGroup enables shared-element layout animation for the
          Timeline panel — when the active tab changes, the timeline morphs
          between its inline position (Details tab) and the right sidebar
          position (other tabs) instead of unmount/remount jumping. */}
      <LayoutGroup>
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
              bgcolor: 'hsl(var(--card))', 
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}>
              {[
                { label: 'Details', count: null, tour: 'incident-tab-details' },
                { label: 'Tasks', count: visibleTasks.length > 0 ? `${visibleTasks.filter(t => t.completed).length}/${visibleTasks.length}` : null, tour: 'incident-tab-tasks' },
                { label: 'Observables', count: (editedObservables.filter(o => !o.archived).length + enrichments.length) > 0 ? (editedObservables.filter(o => !o.archived).length + enrichments.length) : null, loading: refreshingObservables, tour: 'incident-tab-observables' },
                { label: 'Correlations', count: correlations.length > 0 ? correlations.length : null, loading: correlationsLoading, tour: 'incident-tab-correlations' },
              ].map((tab, index) => (
                <Box
                  key={tab.label}
                  data-tour={tab.tour}
                  data-active={activeTab === index ? 'true' : 'false'}
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
                    bgcolor: activeTab === index ? '#ff6600' : 'transparent',
                    color: activeTab === index ? '#ffffff' : 'text.secondary',
                    fontWeight: activeTab === index ? 600 : 400,
                    fontSize: '0.875rem',
                    '&:hover': {
                      bgcolor: activeTab === index ? '#ff6600' : 'rgba(255,255,255,0.05)',
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
                        bgcolor: activeTab === index ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                        color: activeTab === index ? '#ffffff' : 'text.secondary',
                      }}
                    >
                      {tab.count}
                    </Box>
                  )}
                </Box>
              ))}
              {/* Changes tab removed — revisions now in Activity sidebar */}
            </Box>

            {/* Right tab group island: Automation + Raw */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5, 
              p: 0.5,
              bgcolor: 'hsl(var(--card))',
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              flexShrink: 0,
            }}>
              {/* Original tab - only visible when data exists */}
              {unmappedOriginal && (
                <>
                  <Tooltip title="The raw data before any translation" arrow>
                    <Box
                      onClick={() => setActiveTab(6)}
                      sx={{
                        px: 2,
                        py: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        transition: 'all 0.2s ease',
                        bgcolor: activeTab === 6 ? '#ff6600' : 'transparent',
                        color: activeTab === 6 ? '#ffffff' : 'text.secondary',
                        fontWeight: activeTab === 6 ? 600 : 400,
                        fontSize: '0.875rem',
                        '&:hover': {
                          bgcolor: activeTab === 6 ? '#ff6600' : 'rgba(255,255,255,0.05)',
                        },
                      }}
                    >
                      Original
                    </Box>
                  </Tooltip>

                  {/* Arrow: Original → Translation */}
                  <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled', mx: -0.25 }} />
                </>
              )}

              {/* File tab - only visible when translation file exists */}
              {!!incidentFileRef && (
                <>
                  <Tooltip title="The translation file that maps original data to OCSF" arrow>
                    <Box
                      onClick={() => setActiveTab(5)}
                      sx={{
                        px: 2,
                        py: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        transition: 'all 0.2s ease',
                        bgcolor: activeTab === 5 ? '#ff6600' : 'transparent',
                        color: activeTab === 5 ? '#ffffff' : 'text.secondary',
                        fontWeight: activeTab === 5 ? 600 : 400,
                        fontSize: '0.875rem',
                        '&:hover': {
                          bgcolor: activeTab === 5 ? '#ff6600' : 'rgba(255,255,255,0.05)',
                        },
                      }}
                    >
                      Translation
                    </Box>
                  </Tooltip>

                  {/* Arrow: Translation → OCSF */}
                  <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled', mx: -0.25 }} />
                </>
              )}

              <Tooltip title="The normalized OCSF Incident Finding output" arrow>
                <Box
                  onClick={() => {
                    if (incident?.rawOCSF) {
                      const severityOption = severityOptions.find(s => s.value === editedSeverity);
                      const statusLabel = editedStatus === 'new' ? 'New' : editedStatus === 'in_progress' ? 'In Progress' : editedStatus === 'on_hold' ? 'On Hold' : 'Resolved';
                      const existingFindingInfo = incident.rawOCSF?.finding_info_list?.[0] || (incident.rawOCSF as any)?.finding_info;
                      const liveSnapshot = {
                        ...incident.rawOCSF,
                        desc: editedMessage || editedTitle,
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
                      enrichments: enrichments,
                      };
                      setRawJsonText(JSON.stringify(liveSnapshot, null, 2));
                    }
                    setActiveTab(4);
                  }}
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    transition: 'all 0.2s ease',
                    bgcolor: activeTab === 4 ? '#ff6600' : 'transparent',
                    color: activeTab === 4 ? '#ffffff' : 'text.secondary',
                    fontWeight: activeTab === 4 ? 600 : 400,
                    fontSize: '0.875rem',
                    '&:hover': {
                      bgcolor: activeTab === 4 ? '#ff6600' : 'rgba(255,255,255,0.05)',
                      color: activeTab === 4 ? '#ffffff' : 'text.secondary',
                    },
                  }}
                >
                  OCSF
                </Box>
              </Tooltip>
            </Box>
          </Box>

          {/* Tab Content */}
      <Box sx={isPublicView ? { pointerEvents: 'none', '& input, & textarea, & select, & button:not([data-public-ok])': { opacity: 0.7 } } : {}}>
      {activeTab === 1 && (
        /* Tasks Tab — uses the exact same kanban as the simplified view (/incidents-simple) */
        <TaskKanbanBoard
          tasks={tasks}
          onTasksChange={setTasks}
          incidentId={id || 'new'}
          currentUser={currentUsername || 'You'}
        />
      )}

      {activeTab === 0 && (() => {
        const hasEmail = !!incident && isEmailContent(editedMessage || '', rawDescriptionHtml || '', incident.rawOCSF);
        const descriptionBody = (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(hasHtmlDescription || editedMessage) && !isEditingDescription && (
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    {(['rendered', 'readable', 'raw'] as const).map((view) => (
                      <Chip
                        key={view}
                        label={view === 'readable' ? 'Clean' : view.charAt(0).toUpperCase() + view.slice(1)}
                        size="small"
                        variant="outlined"
                        onClick={() => setDescriptionView(view)}
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          bgcolor: 'transparent',
                          borderColor: descriptionView === view ? 'rgba(255, 102, 0, 0.5)' : 'rgba(255,255,255,0.12)',
                          color: descriptionView === view ? '#ff6600' : 'text.secondary',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
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
            ) : descriptionView === 'rendered' && hasHtmlDescription ? (
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 1)',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  minHeight: 120,
                  maxHeight: 450,
                  overflow: 'auto',
                  color: 'text.primary',
                  '& img': { maxWidth: '100%', height: 'auto' },
                  '& a': { color: 'primary.main', textDecoration: 'underline' },
                  '& table': { borderCollapse: 'collapse', maxWidth: '100%' },
                  '& td, & th': { padding: '4px 8px' },
                  '& *': { maxWidth: '100%', boxSizing: 'border-box' },
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                }}
                dangerouslySetInnerHTML={{ __html: sanitizedDescriptionHtml }}
              />
            ) : descriptionView === 'readable' || (descriptionView === 'rendered' && !hasHtmlDescription) ? (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'hsl(var(--input))',
                  borderRadius: 1,
                  border: '1px solid hsl(var(--border))',
                  minHeight: 120,
                  maxHeight: 450,
                  overflow: 'auto',
                }}
              >
                <Typography variant="body2" sx={{
                  color: 'text.primary',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.85rem',
                  lineHeight: 1.75,
                  letterSpacing: '0.01em',
                }}>
                  {(() => {
                    if (hasHtmlDescription) {
                      const tmp = document.createElement('div');
                      tmp.innerHTML = sanitizedDescriptionHtml;
                      tmp.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
                      tmp.querySelectorAll('p, div, tr, li, h1, h2, h3, h4, h5, h6').forEach(el => {
                        el.prepend(document.createTextNode('\n'));
                        el.append(document.createTextNode('\n'));
                      });
                      const text = (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
                      return text || 'No description.';
                    }
                    return editedMessage || 'No description.';
                  })()}
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'hsl(var(--input))',
                  borderRadius: 1,
                  border: '1px solid hsl(var(--border))',
                  minHeight: 120,
                  maxHeight: 350,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'hsl(var(--muted-foreground) / 0.4)' },
                }}
                onClick={() => setIsEditingDescription(true)}
              >
                {editedMessage ? (
                  <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                    {editedMessage}
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                    No description. Click to add one.
                  </Typography>
                )}
              </Box>
            )}
          </>
        );

        return (
        /* Details Tab */
        <Box sx={{
          display: 'grid',
          // Two columns on desktop: narrative + timeline on the left,
          // metadata on the right. Stacks on smaller viewports.
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          gap: { xs: 2, lg: 3 },
          alignItems: 'start',
        }}>
          {/* ============ LEFT: Description (when no email), Email thread, Timeline ============
              When the incident IS an email thread, we move the Description to
              the right column (collapsed by default) so the parsed thread
              becomes the primary narrative on the left. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {/* Description Section — only render here when there is NO email
              thread. Otherwise it lives on the right column collapsed. */}
          {!hasEmail && (
          <Section title="Description" icon={DescriptionIcon} defaultOpen={false}>
            {descriptionBody}
          </Section>
          )}

          {/* Email Thread Panel — shown below Description when email content is detected */}
          {hasEmail && (
            <EmailThreadPanel
              descriptionHtml={rawDescriptionHtml || ''}
              descriptionText={editedMessage || ''}
              rawOCSF={incident.rawOCSF}
              onReply={(to, subject, body) => {
                // Use the existing forward/send mechanism via Singul
                const sendPayload = {
                  action: 'send_message',
                  category: 'cases',
                  key: incident.id,
                  body: {
                    ...(incident.rawOCSF || {}),
                    reply_to: to,
                    reply_subject: subject,
                    reply_body: body,
                  },
                  fields: {
                    to,
                    subject,
                    body,
                  },
                };
                // Open forward dialog to pick which email tool to send via
                setShowForwardDialog(true);
              }}
              onForward={() => setShowForwardDialog(true)}
            />
          )}

          {/* Inline Timeline — the heart of the Details tab. Renders the same
              comment input + unified feed as the right sidebar, but styled
              with a vertical rail so the chronology reads at a glance. */}
          <motion.div
            layoutId="incident-timeline-panel"
            layout
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            data-tour="incident-activity-feed"
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              overflow: 'hidden',
              ...(isPublicView ? { pointerEvents: 'none' as const } : {}),
            }}
          >
            {renderTimelinePanel('inline')}
          </motion.div>
          </Box>

          {/* ============ RIGHT: Metadata column ============ */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {/* Description on the right — only when an email thread occupies
              the left column. Collapsed by default; users open it for the
              raw / readable / rendered views without losing focus on the
              parsed thread. */}
          {hasEmail && (
            <Section title="Description" icon={DescriptionIcon} defaultOpen={false}>
              {descriptionBody}
            </Section>
          )}



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

          {/* Metadata Section */}
          <Section title="Metadata" icon={DescriptionIcon} defaultOpen={false}>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>{incident.id}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Box>
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
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>TLP</Typography>
                  <FormControl size="small" variant="standard" fullWidth>
                    <Select
                      value={editedTlp}
                      onChange={(e) => setEditedTlp(e.target.value)}
                      disableUnderline
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: tlpLevels.find(t => t.label === editedTlp)?.color || '#f59e0b',
                        '& .MuiSelect-select': { py: 0.25, px: 0.5 },
                        '& .MuiSelect-icon': { fontSize: 16 },
                      }}
                    >
                      {tlpLevels.map((opt) => (
                        <MenuItem key={opt.value} value={opt.label} sx={{ fontSize: '0.8rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color, border: opt.color === '#ffffff' ? '1px solid rgba(255,255,255,0.3)' : 'none' }} />
                            {opt.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Created</Typography>
                  <Typography variant="body2">{incident.created}</Typography>
                </Box>
              </Box>
              {incident.edited && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Last Updated</Typography>
                    <Typography variant="body2">{incident.edited}</Typography>
                  </Box>
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Age</Typography>
                  <Typography variant="body2">{metrics?.age}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Labels */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Labels</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {editedLabels.map((label, idx) => (
                  <Chip
                    key={idx}
                    label={label}
                    size="small"
                    variant="outlined"
                    onDelete={() => {
                      autoProgressStatus();
                      setEditedLabels(editedLabels.filter((_, i) => i !== idx));
                    }}
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      bgcolor: 'transparent',
                      borderColor: 'rgba(6, 182, 212, 0.4)',
                      color: '#06b6d4',
                      '& .MuiChip-deleteIcon': { fontSize: 14, color: '#06b6d4', '&:hover': { color: '#67e8f9' } },
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
                    placeholder="+ Add"
                    variant="outlined"
                    size="small"
                    InputProps={{
                      sx: {
                        fontSize: '0.7rem',
                        height: 24,
                        bgcolor: 'hsl(var(--input))',
                        '& fieldset': { borderColor: 'hsl(var(--border))', borderStyle: 'dashed' },
                        '&:hover fieldset': { borderColor: 'rgba(6, 182, 212, 0.3)' },
                        '&.Mui-focused fieldset': { borderColor: '#06b6d4' },
                      },
                    }}
                    sx={{ width: 80 }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Attachments */}
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

            {/* References */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                References
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  placeholder="https://example.com/reference"
                  fullWidth
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddReference())}
                  sx={inputSx}
                />
                <IconButton onClick={handleAddReference} disabled={!newReference.trim()} sx={{ bgcolor: 'hsl(var(--muted))' }}>
                  <AddIcon />
                </IconButton>
              </Box>
              {editedReferences.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {editedReferences.map((ref, idx) => (
                    <Chip
                      key={idx}
                      label={ref.length > 50 ? ref.substring(0, 50) + '...' : ref}
                      size="small"
                      icon={<LinkIcon sx={{ fontSize: 14 }} />}
                      onDelete={() => handleRemoveReference(idx)}
                      onClick={() => window.open(ref, '_blank')}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Section>

          {/* Metrics Section */}
          <Section title="Metrics" icon={TrendingUpIcon} defaultOpen={false}>
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
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
          </Box>
        </Box>
        );
      })()}

      {activeTab === 2 && (
        /* Observables Tab */
        <Box sx={{ 
          bgcolor: 'hsl(var(--card))', 
          borderRadius: 2, 
          border: '1px solid hsl(var(--border))',
          p: 2.5,
        }}>
          {/* Auto-enrichment status banner */}
          {!enrichmentStatus.isLoading && !enrichmentStatus.active && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.18)' }}>
              <Typography variant="caption" sx={{ color: '#fb923c', fontWeight: 500, flex: 1 }}>
                Automatic observable extraction is not yet fully enabled.
              </Typography>
              <Tooltip
                title={
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
                    {enrichmentStatus.checks.map((c) => (
                      <Box key={c.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <CheckCircleIcon sx={{ fontSize: 13, color: c.active ? 'hsl(var(--severity-low))' : 'hsl(var(--destructive))' }} />
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{c.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                }
                arrow
              >
                <Button
                  size="small"
                  variant="contained"
                  disabled={enrichmentStatus.isEnabling}
                  onClick={enrichmentStatus.enable}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    height: 28,
                    px: 2,
                    bgcolor: '#fb923c',
                    color: '#fff',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#f97316', boxShadow: 'none' },
                    '&.Mui-disabled': { bgcolor: 'rgba(251, 146, 60, 0.4)', color: '#fff' },
                  }}
                >
                  {enrichmentStatus.isEnabling ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : 'Enable'}
                </Button>
              </Tooltip>
            </Box>
          )}

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
                    regexWarning = `Doesn't match pattern for "${newObservableType}" — regex: ${regexPattern}`;
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
          
          {/* Filter & sort bar */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              value={obsFilterText}
              onChange={(e) => setObsFilterText(e.target.value)}
              placeholder="Search observables..."
              sx={{ ...inputSx, minWidth: 160, flex: 1, maxWidth: 280 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ fontSize: 16, color: 'text.disabled', mr: 0.5 }} />,
              }}
            />
            {/* Type multiselect dropdown */}
            {(() => {
              const manualTypes = editedObservables.filter(o => !o.archived).map(o => o.type);
              const enrichTypes = enrichments.map(e => e.type || 'unknown');
              const uniqueTypes = [...new Set([...manualTypes, ...enrichTypes])].sort();
              if (uniqueTypes.length <= 1) return null;
              return (
                <Select
                  multiple
                  displayEmpty
                  value={obsFilterTypes}
                  onChange={(e) => setObsFilterTypes(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                  renderValue={(selected) => selected.length === 0 ? 'All types' : `${selected.length} type${selected.length > 1 ? 's' : ''}`}
                  size="small"
                  sx={{
                    minWidth: 120,
                    fontSize: '0.8rem',
                    bgcolor: 'hsl(var(--input))',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
                    '& .MuiSelect-select': { py: 0.75, px: 1.5 },
                  }}
                  MenuProps={{ PaperProps: { sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' } } }}
                >
                  {uniqueTypes.map(t => (
                    <MenuItem key={t} value={t} sx={{ fontSize: '0.8rem' }}>
                      <Checkbox size="small" checked={obsFilterTypes.includes(t)} sx={{ p: 0.5, mr: 1 }} />
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>{t}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              );
            })()}
            {/* Sort dropdown */}
            <Select
              value={obsSortField}
              onChange={(e) => setObsSortField(e.target.value as any)}
              size="small"
              sx={{
                minWidth: 110,
                fontSize: '0.75rem',
                bgcolor: 'hsl(var(--input))',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
                '& .MuiSelect-select': { py: 0.75, px: 1.5 },
              }}
              MenuProps={{ PaperProps: { sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' } } }}
            >
              <MenuItem value="first_seen" sx={{ fontSize: '0.8rem' }}>First seen</MenuItem>
              <MenuItem value="last_seen" sx={{ fontSize: '0.8rem' }}>Last seen</MenuItem>
              <MenuItem value="type" sx={{ fontSize: '0.8rem' }}>Type</MenuItem>
              <MenuItem value="value" sx={{ fontSize: '0.8rem' }}>Value</MenuItem>
            </Select>
            <IconButton
              size="small"
              onClick={() => setObsSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              sx={{ p: 0.5, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--primary))' } }}
            >
              {obsSortDir === 'desc' ? <ArrowDownwardIcon sx={{ fontSize: 16 }} /> : <ArrowUpwardIcon sx={{ fontSize: 16 }} />}
            </IconButton>
            {/* Clear filters */}
            {(obsFilterTypes.length > 0 || obsFilterText || obsSortField !== 'first_seen' || obsSortDir !== 'desc') && (
              <Chip
                label="Clear filters"
                size="small"
                onDelete={() => { setObsFilterTypes([]); setObsFilterText(''); setObsSortField('first_seen'); setObsSortDir('desc'); }}
                sx={{ fontSize: '0.65rem', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', bgcolor: 'rgba(255,255,255,0.05)' }}
              />
            )}
          </Box>

          {/* Unified observables list (manual + enrichments) */}
          {(() => {
            const manualObs = editedObservables
              .map((obs, idx) => ({ ...obs, _idx: idx, _source: 'manual' as const }))
              .filter(o => !o.archived);
            const enrichObs = enrichments.map((enr, idx) => ({
              type: enr.type || 'unknown',
              value: enr.value || enr.data || '',
              first_seen: enr.first_seen,
              last_seen: enr.last_seen,
              _idx: idx,
              _source: 'enrichment' as const,
            }));
            // Deduplicate by type+value (case-insensitive), prefer enrichment data, merge timestamps
            const deduped = new Map<string, any>();
            for (const obs of [...manualObs, ...enrichObs]) {
              const dedupKey = `${obs.type.toLowerCase()}::${obs.value.toLowerCase()}`;
              const existing = deduped.get(dedupKey);
              if (existing) {
                const eFs = (existing as any).first_seen;
                const oFs = (obs as any).first_seen;
                const eLs = (existing as any).last_seen;
                const oLs = (obs as any).last_seen;
                if (oFs && (!eFs || oFs < eFs)) (existing as any).first_seen = oFs;
                if (oLs && (!eLs || oLs > eLs)) (existing as any).last_seen = oLs;
              } else {
                deduped.set(dedupKey, { ...obs });
              }
            }
            const toTs = (v: any) => !v ? 0 : typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : new Date(v).getTime() || 0;
            const allObsRaw = Array.from(deduped.values()).sort((a, b) => {
              let cmp = 0;
              if (obsSortField === 'first_seen' || obsSortField === 'last_seen') {
                const aTs = toTs(a[obsSortField]);
                const bTs = toTs(b[obsSortField]);
                // Items with timestamps always before items without
                if (aTs && !bTs) return -1;
                if (!aTs && bTs) return 1;
                cmp = aTs - bTs;
              } else if (obsSortField === 'type') {
                cmp = a.type.localeCompare(b.type);
              } else {
                cmp = a.value.localeCompare(b.value);
              }
              return obsSortDir === 'desc' ? -cmp : cmp;
            });

            // Apply filters
            const filterLower = obsFilterText.toLowerCase();
            const allObs = allObsRaw.filter(obs => {
              if (obsFilterTypes.length > 0 && !obsFilterTypes.includes(obs.type)) return false;
              if (filterLower && !obs.value.toLowerCase().includes(filterLower) && !obs.type.toLowerCase().includes(filterLower)) return false;
              return true;
            });

            // While the incident is fresh (created within the last 2 minutes)
            // we render a loading state so users can see automatic enrichments
            // stream in shortly after creation, instead of an empty list.
            const createdTs = incident?.createdTs || 0;
            const isFreshIncident = createdTs > 0 && (nowTick - createdTs) < FRESH_OBS_WINDOW_MS;

            const loadingSkeleton = (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: allObs.length > 0 ? 1 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, mb: 0.5, borderRadius: 1.5, bgcolor: 'rgba(99, 179, 237, 0.08)', border: '1px solid rgba(99, 179, 237, 0.18)' }}>
                  <CircularProgress size={14} sx={{ color: '#63b3ed' }} />
                  <Typography variant="caption" sx={{ color: '#63b3ed', fontWeight: 500 }}>
                    Processing observables in the background…
                  </Typography>
                </Box>
                {[0, 1, 2].map((i) => (
                  <Skeleton
                    key={`obs-skel-${i}`}
                    variant="rounded"
                    height={48}
                    sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1 }}
                  />
                ))}
              </Box>
            );

            if (allObsRaw.length === 0) {
              if (isFreshIncident) return loadingSkeleton;
              return (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 4 }}>
                  No observables added. Add IOCs, IPs, domains, hashes, or other indicators.
                </Typography>
              );
            }

            if (allObs.length === 0) {
              return (
                <>
                  {isFreshIncident && loadingSkeleton}
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 4 }}>
                    No observables match the current filter. {allObsRaw.length} total.
                  </Typography>
                </>
              );
            }

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Only show the "still processing" banner when the list is
                    actually empty. Once observables exist, the user can see
                    them — keeping the banner visible reads as a stuck loader. */}
                {allObs.map((obs) => {
                  const iocDef = iocTypes.find(t => t.name === obs.type);
                  const pattern = iocDef?.regex;
                  let mismatch = false;
                  if (pattern && obs._source === 'manual') {
                    try { mismatch = !new RegExp(pattern).test(obs.value); } catch { /* skip */ }
                  }
                  const suggestedTypes = mismatch
                    ? iocTypes.filter(t => t.name !== obs.type && t.regex).filter(t => {
                        try { return new RegExp(t.regex!).test(obs.value); } catch { return false; }
                      }).slice(0, 3)
                    : [];
                  const actionName = `search_ioc_${obs.type.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                  const obsRowKey = `${obs._source}-${obs._idx}`;
                  const obsHighlightKey = `${(obs.type || '').toLowerCase()}::${(obs.value || '').toLowerCase()}`;
                  const isNewlyArrived = newlyArrivedObservables.has(obsHighlightKey);
                  const isExpanded = expandedObsKey === obsRowKey;
                  const firstSeen = (obs as any).first_seen;
                  const lastSeen = (obs as any).last_seen;
                  const hasTimestamps = firstSeen || lastSeen;
                  const formatObsTime = (ts: string | number | undefined) => {
                    if (!ts) return '—';
                    const d = typeof ts === 'number' ? new Date(ts < 1e12 ? ts * 1000 : ts) : new Date(ts);
                    return isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
                  };
                  return (
                    <Box
                      key={obsRowKey}
                      data-obs-highlight-key={obsHighlightKey}
                      className={(isNewlyArrived || flashedObsKey === obsHighlightKey) ? 'incident-new-flash' : undefined}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: mismatch ? 0.5 : 0,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: 'hsl(var(--input))',
                        border: mismatch ? '1px solid rgba(251, 146, 60, 0.3)' : isExpanded ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--border-subtle))',
                        transition: 'border-color 0.15s ease',
                        '&:hover': { borderColor: 'hsl(var(--primary) / 0.2)' },
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}
                        onClick={() => {
                          // Don't toggle when the user is selecting text inside the row.
                          const sel = typeof window !== 'undefined' ? window.getSelection() : null;
                          if (sel && sel.toString().length > 0) return;
                          setExpandedObsKey(isExpanded ? null : obsRowKey);
                        }}
                      >
                        <Chip
                          label={obs.type}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            bgcolor: 'transparent',
                            borderColor: mismatch ? 'rgba(251, 146, 60, 0.4)' : 'hsl(var(--primary) / 0.4)',
                            color: mismatch ? '#fb923c' : 'hsl(var(--primary))',
                          }}
                        />
                        <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                          {obs.value}
                        </Typography>
                        {firstSeen && (
                          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.55rem', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                            {formatObsTime(firstSeen)}
                          </Typography>
                        )}
                        {/* Correlation badge */}
                        {(() => {
                          const obsKey = `${obs.type}::${obs.value}`;
                          const corr = obsCorrelations[obsKey];
                          if (corr?.loading) return <CircularProgress size={14} sx={{ mx: 0.5 }} />;
                          if (!corr?.data?.length) return null;
                          // Only count correlations with refs OTHER than the current incident.
                          const meaningful = filterMeaningfulCorrelations(corr.data, id);
                          if (meaningful.length === 0) return null;
                          // Highlight the badge in red when ANY correlation
                          // points to a known IOC / threat-feed entry.
                          const iocHit = meaningful.some(hasIocMatch);
                          return (
                            <Tooltip
                              title={
                                iocHit
                                  ? 'This observable matches a known Indicator of Compromise — open to investigate.'
                                  : `${meaningful.length} correlation${meaningful.length !== 1 ? 's' : ''} found`
                              }
                              arrow
                            >
                              <Chip
                                icon={iocHit ? <WarningAmberIcon sx={{ fontSize: 12, color: 'hsl(var(--destructive)) !important' }} /> : undefined}
                                label={iocHit ? `${meaningful.length} IOC` : `${meaningful.length} corr`}
                                size="small"
                                variant="outlined"
                                onClick={(e) => { e.stopPropagation(); setObsCorrelationAnchor({ el: e.currentTarget, obsKey }); }}
                                sx={{
                                  height: 20,
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  bgcolor: iocHit ? 'hsl(var(--destructive) / 0.1)' : 'transparent',
                                  borderColor: iocHit ? 'hsl(var(--destructive) / 0.5)' : 'rgba(59, 130, 246, 0.4)',
                                  color: iocHit ? 'hsl(var(--destructive))' : '#3b82f6',
                                  '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
                                  '&:hover': {
                                    bgcolor: iocHit ? 'hsl(var(--destructive) / 0.16)' : 'rgba(59, 130, 246, 0.08)',
                                  },
                                }}
                              />
                            </Tooltip>
                          );
                        })()}
                        <Tooltip
                          title={`"${actionName}" is not enabled for your organization yet — we will be turning this on in a future update.`}
                          arrow
                        >
                          {/* Span wrapper lets the tooltip still fire on a disabled IconButton. */}
                          <span>
                            <IconButton
                              size="small"
                              disabled
                              onClick={(e) => e.stopPropagation()}
                              sx={{
                                p: 0.5,
                                color: 'hsl(var(--muted-foreground))',
                                '&.Mui-disabled': {
                                  color: 'hsl(var(--muted-foreground) / 0.5)',
                                },
                              }}
                            >
                              <SearchIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        {obs._source === 'manual' && (
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleRemoveObservable(obs._idx); }}
                            sx={{
                              p: 0.5,
                              color: 'text.disabled',
                              '&:hover': { color: '#ef4444' },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Type
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{obs.type}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Source
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{obs._source === 'manual' ? 'Manual' : 'Enrichment'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                First seen
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{formatObsTime(firstSeen)}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Last seen
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{formatObsTime(lastSeen)}</Typography>
                            </Box>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Value
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{obs.value}</Typography>
                          </Box>
                          {/* Inline correlations */}
                          {(() => {
                            const obsKey = `${obs.type}::${obs.value}`;
                            const corr = obsCorrelations[obsKey];
                            // Trigger fetch if not yet loaded
                            if (!corr && obs.value) {
                              const noiseKeys = new Set([
                                'new', 'in_progress', 'resolved', 'escalated', 'closed', 'open', 'pending',
                                'critical', 'high', 'medium', 'low', 'informational', 'info',
                                id?.toLowerCase(),
                              ].filter(Boolean));
                              setObsCorrelations(prev => {
                                if (prev[obsKey]) return prev;
                                // Fire fetch
                                fetch(getApiUrl('/api/v2/correlations'), {
                                  method: 'POST',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...crossOrgHeaders },
                                  body: JSON.stringify({ type: 'value', key: obs.value }),
                                }).then(async r => {
                                  if (r.ok) {
                                    const data = await r.json();
                                    const corrData = Array.isArray(data) ? data : (data.correlations || data.data || []);
                                    const filtered = corrData.filter((c: { key: string }) => !noiseKeys.has(c.key.toLowerCase()));
                                    setObsCorrelations(p => ({ ...p, [obsKey]: { loading: false, data: filtered } }));
                                  } else {
                                    setObsCorrelations(p => ({ ...p, [obsKey]: { loading: false, data: [] } }));
                                  }
                                }).catch(() => {
                                  setObsCorrelations(p => ({ ...p, [obsKey]: { loading: false, data: [] } }));
                                });
                                return { ...prev, [obsKey]: { loading: true, data: [] } };
                              });
                            }
                            if (corr?.loading) {
                              return (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <CircularProgress size={14} />
                                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem' }}>Loading correlations…</Typography>
                                </Box>
                              );
                            }
                            if (!corr?.data?.length) {
                              return (
                                <Box sx={{ mt: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      Correlations
                                    </Typography>
                                    <Tooltip title="Re-run correlation search for this observable" arrow>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); refetchObsCorrelation(obs); }}
                                        sx={{ p: 0.25, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
                                      >
                                        <RefreshIcon sx={{ fontSize: 12 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>No correlations found</Typography>
                                </Box>
                              );
                            }
                            // Drop correlations whose only ref is the current incident itself.
                            const meaningfulCorr = filterMeaningfulCorrelations(corr.data, id);
                            if (meaningfulCorr.length === 0) {
                              return (
                                <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>No correlations found</Typography>
                                  <Tooltip title="Re-run correlation search for this observable" arrow>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); refetchObsCorrelation(obs); }}
                                      sx={{ p: 0.25, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
                                    >
                                      <RefreshIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              );
                            }
                            return (
                              <Box sx={{ mt: 0.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Correlations ({meaningfulCorr.length})
                                  </Typography>
                                  <Tooltip title="Re-run correlation search for this observable" arrow>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); refetchObsCorrelation(obs); }}
                                      sx={{ p: 0.25, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
                                    >
                                      <RefreshIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                  {meaningfulCorr.slice(0, 8).map((c, ci) => (
                                    <CorrelationRow
                                      key={c.key || ci}
                                      correlation={c}
                                      currentIncidentId={id}
                                      compact
                                    />
                                  ))}
                                  {meaningfulCorr.length > 8 && (
                                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem' }}>
                                      +{meaningfulCorr.length - 8} more correlations
                                    </Typography>
                                  )}
                                </Box>
                                {/* Surface STIX IOC context (pattern + sources) when any correlation hits a known IOC. */}
                                <IocDetailsCard correlations={meaningfulCorr} compact />
                              </Box>
                            );
                          })()}
                        </Box>
                      )}
                      {mismatch && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#fb923c', fontSize: '0.65rem' }}>
                            ⚠ Doesn't match pattern for "{obs.type}"
                          </Typography>
                          {suggestedTypes.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem' }}>
                                Matches:
                              </Typography>
                              {suggestedTypes.map(st => (
                                <Chip
                                  key={st.name}
                                  label={`Change to ${st.name}`}
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = [...editedObservables];
                                    updated[obs._idx] = { ...updated[obs._idx], type: st.name };
                                    setEditedObservables(updated);
                                  }}
                                  sx={{
                                    height: 20,
                                    fontSize: '0.6rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    bgcolor: 'transparent',
                                    borderColor: 'rgba(34, 197, 94, 0.4)',
                                    color: '#22c55e',
                                    '&:hover': { bgcolor: 'rgba(34, 197, 94, 0.08)' },
                                  }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            );
          })()}

          {/* Observable correlation popover */}
          <Popover
            open={!!obsCorrelationAnchor}
            anchorEl={obsCorrelationAnchor?.el}
            onClose={() => setObsCorrelationAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{ paper: { sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 2, maxWidth: 460, maxHeight: 460, overflow: 'auto' } } }}
          >
            {obsCorrelationAnchor && (() => {
              const corr = obsCorrelations[obsCorrelationAnchor.obsKey];
              const [type, ...valueParts] = obsCorrelationAnchor.obsKey.split('::');
              const value = valueParts.join('::');
              // Reuse the same filtering logic as the inline view so the popover
              // never shows correlations whose only ref is the current incident.
              const meaningful = filterMeaningfulCorrelations(corr?.data || [], id);
              return (
                <Box sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                    Correlations for {type}: {value}
                  </Typography>
                  <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {meaningful.map((c, i) => (
                      <CorrelationRow
                        key={c.key || i}
                        correlation={c}
                        currentIncidentId={id}
                        compact
                      />
                    ))}
                  </Box>
                  {/* STIX context for any IOC matches in this observable. */}
                  <IocDetailsCard correlations={meaningful} compact />
                </Box>
              );
            })()}
          </Popover>
        </Box>
      )}

      {activeTab === 3 && (
        /* Correlations Tab */
        <Box sx={{
          bgcolor: 'hsl(var(--card))', 
          borderRadius: 2, 
          border: '1px solid hsl(var(--border))',
          p: 2.5,
        }}>
          {correlationsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : correlations.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No correlations found for this incident
              </Typography>
              <Tooltip title="Re-run correlation search" arrow>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => fetchCorrelations()}
                    disabled={correlationsLoading}
                    sx={{
                      p: 0.75,
                      color: 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 1,
                      '&:hover': { color: 'hsl(var(--primary))', bgcolor: 'hsl(var(--accent))' },
                    }}
                  >
                    <RefreshIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Correlation summary — quiet header */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                pb: 1.5,
                borderBottom: '1px solid hsl(var(--border))',
              }}>
                <LinkIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {correlations.length} shared attribute{correlations.length !== 1 ? 's' : ''}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  · linked across other datastore items
                </Typography>
                <Tooltip title="Re-run correlation search" arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => fetchCorrelations()}
                      disabled={correlationsLoading}
                      sx={{
                        ml: 'auto',
                        p: 0.5,
                        color: 'hsl(var(--muted-foreground))',
                        '&:hover': { color: 'hsl(var(--primary))', bgcolor: 'hsl(var(--accent))' },
                      }}
                    >
                      {correlationsLoading
                        ? <CircularProgress size={14} />
                        : <RefreshIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {/* Correlation list */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {correlations.map((corr, idx) => (
                  <CorrelationRow
                    key={corr.key || idx}
                    correlation={corr}
                    currentIncidentId={id}
                    className={flashedCorrelationKey === corr.key ? 'incident-new-flash' : undefined}
                  />
                ))}
              </Box>
              {/* STIX context for any IOC matches at the incident level. */}
              <IocDetailsCard correlations={correlations} />
            </Box>
          )}
        </Box>
       )}

      {activeTab === 4 && (
        /* Raw JSON Tab */
        <Box sx={{
          bgcolor: 'rgba(255,255,255,0.02)',
          borderRadius: 2,
          border: '1px solid hsl(var(--border-subtle))',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, bgcolor: 'hsl(var(--card))', mx: -2, px: 2, py: 1.5, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon sx={{ fontSize: 18, color: '#ff6600' }} />
                Raw OCSF
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                <a href="https://schema.ocsf.io/1.7.0/classes/incident_finding" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
                  Incident Finding 2005
                </a>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  if (incident?.rawOCSF) {
                    const severityOption = severityOptions.find(s => s.value === editedSeverity);
                    const { label: statusLabel, id: statusId } = getOCSFStatus(editedStatus);
                    const existingFindingInfo = incident.rawOCSF?.finding_info_list?.[0] || (incident.rawOCSF as any)?.finding_info;
                    const liveSnapshot = {
                      ...incident.rawOCSF,
                      desc: editedMessage || editedTitle,
                      severity_id: severityOption?.id || 3,
                      severity: severityOption?.label || 'Medium',
                      status_id: statusId,
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
                }}
                sx={{
                  borderColor: 'divider',
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  height: 28,
                  '&:hover': { borderColor: 'text.secondary' },
                }}
              >
                Reload
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  if (!incident?.id) return;
                  if (!rawJsonValid) {
                    toast.error('Cannot save: JSON is invalid');
                    return;
                  }
                  try {
                    const parsed = JSON.parse(rawJsonText);
                    setIsSaving(true);
                    const result = await setDatastoreItem(incident.id, parsed, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined);
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
                disabled={isSaving || !rawJsonValid}
                sx={{
                  borderColor: 'divider',
                  color: 'primary.main',
                  fontSize: '0.75rem',
                  height: 28,
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                Save
              </Button>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.5 }}>
            The normalized <strong>OCSF Incident Finding</strong> output after applying the Translation File to the original ingested data. This is the final {'{ }'} structure stored for this incident and used across the platform for display, automation, and forwarding.
          </Typography>
          <HighlightedFileEditor
            value={rawJsonText}
            onChange={setRawJsonText}
            validateJson={true}
            onValidationChange={setRawJsonValid}
          />
        </Box>
      )}

      {activeTab === 6 && unmappedOriginal && (
        /* Original Data Tab */
        <Box sx={{
          bgcolor: 'action.hover',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}>
          <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'hsl(var(--card))', mx: -2, px: 2, py: 1.5, borderBottom: '1px solid hsl(var(--border))' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              Original Data
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              The raw unmapped data as originally ingested before any translation was applied.
            </Typography>
          </Box>
          <HighlightedFileEditor
            value={typeof unmappedOriginal === 'string' ? unmappedOriginal : JSON.stringify(unmappedOriginal, null, 2)}
            onChange={() => {}}
            validateJson={false}
            editable={false}
          />
        </Box>
      )}

      {activeTab === 5 && (
        /* File Editor Tab */
        <Box sx={{
          bgcolor: 'action.hover',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, bgcolor: 'hsl(var(--card))', mx: -2, px: 2, py: 1.5, borderBottom: '1px solid hsl(var(--border))' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Translation File
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {incidentFileRef}{!fileIdResolved ? ' (resolving…)' : resolvedFileId && resolvedFileId !== incidentFileRef ? ` → ${resolvedFileId}` : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => { setFileLoaded(false); loadFileContent(); }}
                disabled={fileLoading}
                sx={{
                  borderColor: 'divider',
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  height: 28,
                  '&:hover': { borderColor: 'text.secondary' },
                }}
              >
                {fileLoading ? <CircularProgress size={14} /> : 'Reload'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  if (!resolvedFileId) return;
                  if (!fileJsonValid) {
                    toast.error('Cannot save: JSON is invalid');
                    return;
                  }
                  setFileSaving(true);
                  try {
                    const resp = await fetch(getApiUrl(`/api/v1/files/${resolvedFileId}/edit`), {
                      method: 'PUT',
                      credentials: 'include',
                      headers: { ...getAuthHeader(), ...crossOrgHeaders, 'Content-Type': 'application/json' },
                      body: fileContent,
                    });
                    if (!resp.ok) throw new Error(`Save failed (${resp.status})`);
                    toast.success('File saved');
                  } catch (e: any) {
                    toast.error(e.message || 'Failed to save file');
                  } finally {
                    setFileSaving(false);
                  }
                }}
                disabled={fileSaving || fileLoading || !fileJsonValid}
                sx={{
                  borderColor: 'divider',
                  color: 'primary.main',
                  fontSize: '0.75rem',
                  height: 28,
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                {fileSaving ? <CircularProgress size={14} /> : 'Save'}
              </Button>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.5 }}>
            This file maps fields from the <strong>original ingested data</strong> into the <strong>normalized incident format {'{ }'}</strong>. Variables like <code style={{ color: 'hsl(var(--primary))', fontFamily: 'monospace', fontSize: '0.75rem' }}>$field.subfield</code> reference the source data and are resolved when the translation runs.
          </Typography>
          {fileError ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'error.main' }}>{fileError}</Typography>
              <Button size="small" onClick={() => { setFileLoaded(false); loadFileContent(); }} sx={{ mt: 1, color: '#ff6600' }}>
                Retry
              </Button>
            </Box>
          ) : fileLoading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={24} sx={{ color: '#ff6600' }} />
            </Box>
          ) : (
            <HighlightedFileEditor value={fileContent} onChange={setFileContent} validateJson={true} onValidationChange={setFileJsonValid} />
          )}
        </Box>
      )}

      {/* Changes tab content removed — revisions now in Activity sidebar */}
      </Box>{/* End isPublicView pointer-events wrapper */}
        </Box>

        {/* Right Timeline Sidebar — hidden on Details (inlined there) and on Original / Translation / OCSF tabs */}
        {activeTab !== 0 && activeTab !== 4 && activeTab !== 5 && activeTab !== 6 && (
        <Box sx={{ width: { xs: '100%', lg: 380 }, flexShrink: 0, order: { xs: 2, lg: 0 } }}>
          <motion.div
            layoutId="incident-timeline-panel"
            layout
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            data-tour="incident-activity-feed"
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              overflow: 'hidden',
              ...(isPublicView ? { pointerEvents: 'none' as const } : {}),
            }}
          >
            {renderTimelinePanel('sidebar')}
          </motion.div>
        </Box>
        )}
      </Box>
      </LayoutGroup>


      {/* Revision Data Dialog */}
      <Dialog
        open={revisionDialogData !== null}
        onClose={() => setRevisionDialogData(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 2,
            },
          },
        }}
      >
        <DialogTitle sx={{ color: 'hsl(var(--foreground))', fontSize: '0.9rem', fontWeight: 600, pb: 0.5 }}>
          Revision Data
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              bgcolor: 'hsl(var(--muted) / 0.3)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              overflow: 'auto',
              maxHeight: '60vh',
              m: 0,
            }}
          >
            {revisionDialogData && revisionDialogData.json.split('\n').map((line, i) => {
              // Check if this line contains a changed key (top-level "key": pattern)
              const keyMatch = line.match(/^\s{2}"([^"]+)":/);
              const isChanged = keyMatch && revisionDialogData.changedKeys.has(keyMatch[1]);
              return (
                <Box
                  key={i}
                  component="pre"
                  sx={{
                    m: 0,
                    px: 2,
                    py: 0,
                    fontSize: '0.75rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: isChanged ? '#ff6600' : 'hsl(var(--foreground))',
                    bgcolor: isChanged ? 'rgba(255, 102, 0, 0.08)' : 'transparent',
                    borderLeft: isChanged ? '3px solid #ff6600' : '3px solid transparent',
                    whiteSpace: 'pre',
                    lineHeight: 1.6,
                    '&:hover': {
                      bgcolor: isChanged ? 'rgba(255, 102, 0, 0.12)' : 'hsl(var(--muted) / 0.3)',
                    },
                  }}
                >
                  {line}
                </Box>
              );
            })}
          </Box>
        </DialogContent>
      </Dialog>

      <ResolveIncidentDialog
        open={showResolveDialog}
        onClose={() => setShowResolveDialog(false)}
        onResolve={handleResolve}
        incidentTitle={incident?.title || ''}
        isLoading={isSaving}
        incidentCustomFields={
          incident?.customFields
            ? Object.fromEntries(
                Object.entries(incident.customFields).map(([k, v]) => [k, String(v ?? '')])
              )
            : {}
        }
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
            <Box sx={{ textAlign: 'center', py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                You do not have an email tool authenticated yet.
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', maxWidth: 340 }}>
                Connect a tool like Gmail, Outlook or Microsoft Defender 365 to forward this incident as an email.
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  setShowForwardDialog(false);
                  setShowForwardAppsDrawer(true);
                }}
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  bgcolor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
                }}
              >
                Connect an email tool
              </Button>
            </Box>
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
                          ...crossOrgHeaders,
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

      {/* Merge Dialog */}
      <MergeIncidentDialog
        open={showMergeDialog}
        onClose={() => setShowMergeDialog(false)}
        currentIncidentId={incident?.id || ''}
        currentIncidentTitle={incident?.title || ''}
        onMergeComplete={() => {
          loadIncident(false);
        }}
      />

      {/* Threat Intel App Search Drawer */}
      <AppSearchDrawer
        open={showThreatIntelDrawer}
        onClose={() => setShowThreatIntelDrawer(false)}
        initialQuery="threat intel"
        title="Threat Intel Apps"
        subtitle="Enable and authenticate an app to run IOC lookups"
        priorityCategory="Threat Intel"
      />

      {/* Forwarding / Email Tools App Search Drawer */}
      <AppSearchDrawer
        open={showForwardAppsDrawer}
        onClose={() => {
          setShowForwardAppsDrawer(false);
          // Re-open the forward dialog so the user lands back where they started
          // and any newly-authenticated app is picked up on the next fetch.
          setShowForwardDialog(true);
        }}
        initialQuery="email"
        title="Connect an Email Tool"
        subtitle="Authenticate Gmail, Outlook, or another tool to forward incidents"
        priorityCategory="Email"
      />

      {/*
        Soft-delete confirmation for timeline comments. We do NOT remove the
        activity item from the array — instead we flip `deleted: true` on the
        original entity so the timestamp, author and thread anchoring stay
        intact. The renderer shows a muted "Comment deleted" placeholder.
      */}
      <AlertDialog
        open={commentToDelete !== null}
        onOpenChange={(o) => { if (!o) setCommentToDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              The comment text will be removed, but the entry stays in the
              timeline so the original timestamp, author and thread position
              are preserved. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const id = commentToDelete;
                if (!id) return;
                setActivity(prev => prev.map(a =>
                  a.id === id
                    ? {
                        ...a,
                        deleted: true,
                        deletedAt: Date.now(),
                        // Strip body + attachments so the deleted text and
                        // any uploaded files are not still present in the
                        // persisted incident JSON. The shell of the entity
                        // (id, type, user, timestamp, replyTo*) survives.
                        content: '',
                        attachments: [],
                      }
                    : a
                ));
                pendingSaveRef.current = true;
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => { saveToDatastore(); }, 500);
                toast.success('Comment deleted');
                setCommentToDelete(null);
              }}
            >
              Delete comment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default IncidentDetailPage;
