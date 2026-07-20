import { readTenantStamp, isTenantGhost, type TenantStamp } from '@/utils/tenantAuthority';
import { useState, useEffect, useMemo, useCallback, useRef, forwardRef } from 'react';
import DOMPurify from 'dompurify';
import AgentIcon from '@/Shuffle-MCPs/components/AgentIcon';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEntityLabel, useTaskStatuses, useEntityText } from '@/hooks/useEntityLabel';
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
  Autocomplete,
} from '@mui/material';
import { motion } from 'framer-motion';
import { createAndUploadFile } from '@/services/files';
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
import { useIgnoredObservables } from '@/hooks/useIgnoredObservables';
import { useAgentReadiness } from '@/hooks/useAgentReadiness';
import { CorrelationRow, getEffectiveCorrelationCount, filterMeaningfulCorrelations, hasIocMatch } from '@/components/incidents/CorrelationRow';
import CorrelationContextStrip from '@/components/incidents/CorrelationContextStrip';
import { IocDetailsCard } from '@/components/incidents/IocDetailsCard';
import { useAuth } from '@/context/AuthContext';
import { useAppDetail } from '@/Shuffle-MCPs/AppDetailContext';
import { useDemo } from '@/context/DemoContext';
import { forceCreateSingleDemoIncidentReturningKey } from '@/services/demoMode';
import { DATASTORE_CATEGORIES, getDatastoreItem, getDatastoreItemPublic, setDatastoreItem, deleteDatastoreItem, getDatastoreByCategory } from '@/Shuffle-MCPs/datastore';
import IncidentReportDialog from '@/components/incidents/IncidentReportDialog';
import type { GenerateReportInput } from '@/services/incidentReports';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { resyncState } from '@/lib/resyncState';
import { useUsers } from '@/hooks/useUsers';
import { useSubOrgs } from '@/hooks/useSubOrgs';
import { useCustomFields, CustomField } from '@/hooks/useCustomFields';
import { useIOCTypes } from '@/hooks/useIOCTypes';
import { ObservableTypeSelector } from '@/components/incidents/ObservableTypeSelector';
import { ObservableLookupMenu } from '@/components/incidents/ObservableLookupMenu';
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
import { MergeCandidatesBanner } from '@/components/incidents/MergeCandidatesBanner';
import { MergedIncidentBanner } from '@/components/incidents/MergedIncidentBanner';
import { RelatedIncidentsBanner } from '@/components/incidents/RelatedIncidentsBanner';
import { useRelatedIncidents } from '@/hooks/useRelatedIncidents';
import { maybeMigrateLegacyMerge, getPrimaryPointer } from '@/lib/incidentRelations';
import { DemoFallbackAuditBanner } from '@/components/incidents/DemoFallbackAuditBanner';
import { useMergeCandidates } from '@/hooks/useMergeCandidates';
import { RoutingRulePreviewBanner } from '@/components/incidents/RoutingRulePreviewBanner';
import {
  ROUTING_DATASTORE_CATEGORY,
  type RoutingRule,
  type RoutingAction,
  ACTION_TYPE_LABELS,
} from '@/components/settings/IncidentRoutingEditor';
import { evaluateRoutingRules, type IncidentEvaluationContext } from '@/utils/routingRuleEvaluator';
import { GitBranch as CallSplitIcon } from 'lucide-react';
import { buildAgentContextBlock, stripAgentContextBlock } from '@/utils/agentContextBlock';
import { MentionText } from '@/components/incidents/MentionText';
import CollapsibleContent from '@/components/incidents/CollapsibleContent';
import { UserHoverCard, resolveUserAvatar } from '@/components/incidents/UserHoverCard';
import { TaskKanbanBoard } from '@/components/incidents/TaskKanbanBoard';
import { MentionInput } from '@/components/incidents/MentionInput';
import { TaskDateTimePicker } from '@/components/incidents/TaskDateTimePicker';
import { FileAttachments } from '@/components/incidents/FileAttachments';
import { toast } from '@/lib/toast';
import { isAIAssignee, deduplicateTasks, htmlToPlainText, decodeHtmlEntities, decodeIfBase64, deepMergeIncidents } from '@/lib/utils';
import { useIncidentAgentRuns } from '@/hooks/useIncidentAgentRuns';
import { useSourceAppImage } from '@/hooks/useSourceAppImage';
import { AgentExecutionDrawer } from '@/Shuffle-MCPs';
import { SegmentedControl } from '@/components/ui/segmented-control';
import AgentRunDiagnosisBanner from '@/components/agent/AgentRunDiagnosisBanner';
import { getRunTitle, getRunIconColor, formatDuration as formatAgentRunDuration, getTimeAgo as getAgentTimeAgo, STATUS_CONFIG as AGENT_STATUS_CONFIG } from '@/components/agent/AgentRunHeader';
import { getFailureInfo as getAgentFailureInfo, hasOutputWarning as hasAgentOutputWarning, diagnoseOutputWarning as diagnoseAgentOutputWarning } from '@/components/agent/AgentRunResultViewer';
import AgentRunStatusBadge from '@/components/agent/AgentRunStatusBadge';
import { AlertTriangle as AlertTriangleIcon, Loader2 as Loader2Icon, ArrowDown as ArrowDownwardIcon, AlertTriangle as WarningAmberIcon, ArrowUp as ArrowUpwardIcon, Fingerprint as FingerprintIcon, ArrowLeft as ArrowBackIcon, CheckCircle2 as CheckCircleIcon, Plus as AddIcon, Send as SendIcon, Reply as ReplyIcon, Paperclip as AttachFileIcon, User as PersonIcon, Pencil as EditIcon, History as HistoryIcon, Clock as AccessTimeIcon, ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Filter as FilterListIcon, Shield as SecurityIcon, Link as LinkIcon, Users as PeopleIcon, Settings as SettingsIcon, FileText as DescriptionIcon, CheckCircle2 as TaskAltIcon, Trash2 as DeleteIcon, GripVertical as DragIndicatorIcon, ListPlus as PlaylistAddIcon, RefreshCw as RefreshIcon, TrendingUp as TrendingUpIcon, Wand2 as AutoFixHighIcon, MoreVertical as MoreVertIcon, Forward as ForwardIcon, GitMerge as CallMergeIcon, X as CloseIcon, Eye as VisibilityIcon, EyeOff as VisibilityOffIcon, ChevronRight as ChevronRightIcon, Globe as LanguageIcon, Search as SearchIcon } from 'lucide-react';
import { Zap as ZapIcon } from 'lucide-react';
import type { AgentRun } from '@/services/agentActivity';
import { getAgentSkipInfo } from '@/lib/agentParsers';
import HighlightedFileEditor from '@/components/incidents/HighlightedFileEditor';
import EmailThreadPanel, { isEmailContent } from '@/components/incidents/EmailThreadPanel';
import { IncidentSection } from '@/components/incidents/IncidentSection';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';
import { useIsSupport } from '@/hooks/useIsSupport';
import { useAssignEscalateStatus } from '@/hooks/useAssignEscalateStatus';
import AppSearchDrawer from '@/Shuffle-MCPs/views/AppSearchDrawer';

// Per-open guarantee: at least ONE of Email Thread or Timeline must be
// expanded, otherwise the page looks empty. We respect whichever the user
// already has open; only when BOTH are collapsed do we force-expand the
// Timeline (the preferred default).
try {
  if (typeof window !== 'undefined') {
    // Email Thread: '1' = open.
    const emailOpen = localStorage.getItem('shuffle-incident-email-thread-open') === '1';
    // Timeline: '1' = collapsed, anything else (including null) = expanded.
    const timelineCollapsed = localStorage.getItem('shuffle-incident-timeline-collapsed') === '1';
    if (!emailOpen && timelineCollapsed) {
      localStorage.setItem('shuffle-incident-timeline-collapsed', '0');
    }
  }
} catch { /* ignore — non-fatal */ }


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
import { usePageMeta } from '@/hooks/usePageMeta';
import { getAgentTools as getAssignedAgentTools } from '@/lib/agentTools';
import { openAgentDrawer } from '@/lib/agentDrawer';
import { useScheduleAgentRun } from '@/hooks/useScheduleAgentRun';

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

const normalizeRoutingSeverityValue = (value?: string): string => {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const match = severityOptions.find((s) =>
    s.value.toLowerCase() === raw ||
    s.label.toLowerCase().replace(/[\s-]+/g, '_') === raw
  );
  return match?.value || raw;
};

const parseRoutingActionValue = (value: string | undefined): string | number | boolean => {
  const trimmed = String(value ?? '').trim();
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
};

const readDeepValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
};

const setDeepValue = (obj: any, path: string, value: string | number | boolean) => {
  if (!obj || !path) return;
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!cur[part] || typeof cur[part] !== 'object' || Array.isArray(cur[part])) cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
};

// Quick OCSF-shape check used by the revision-fallback logic. Mirrors the
// detection inside parseIncidentFromDatastore so we agree on what "valid OCSF"
// means: a finding with finding_uid + title (new format), finding_info(_list)
// (legacy), or a numeric severity_id.
const isOcsfShapedData = (data: unknown): boolean => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const d = data as any;
  const isNewFormat = 'finding_uid' in d && 'title' in d;
  const isLegacyOCSF = !!d.finding_info_list || !!d.finding_info || typeof d.severity_id === 'number';
  return isNewFormat || isLegacyOCSF;
};

// Critical identity fields. If any are missing on a saved OCSF payload, we
// treat the payload as partially corrupted and try to overlay missing pieces
// from the most recent revision that still has them. A bad Raw OCSF save (or
// upstream pipeline drop) often clears title/desc/id while leaving severity_id
// intact, which would silently slip past `isOcsfShapedData`.
const getMissingCriticalFields = (data: unknown): string[] => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['title', 'description', 'id'];
  const d = data as any;
  const fi = d.finding_info_list?.[0] || d.finding_info || {};
  const missing: string[] = [];
  const title = d.title || fi.title;
  if (!title || (typeof title === 'string' && !title.trim())) missing.push('title');
  const desc = d.desc || d.message || d.description || fi.desc;
  if (!desc || (typeof desc === 'string' && !desc.trim())) missing.push('description');
  const id = d.finding_uid || d.id || fi.uid || fi.finding_uid;
  if (!id || (typeof id === 'string' && !id.trim())) missing.push('id');
  return missing;
};


// Best-effort JSON parse for revision values (handles base64-encoded strings).
const parseRevisionValue = (raw: unknown): any | null => {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  const decoded = decodeIfBase64(raw);
  try { return JSON.parse(decoded); } catch {}
  try { return JSON.parse(raw); } catch {}
  return null;
};

const stableRevisionValueString = (raw: unknown): string => {
  const normalize = (value: any): any => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((acc, key) => {
        acc[key] = normalize(value[key]);
        return acc;
      }, {} as Record<string, any>);
    }
    return value;
  };

  const parsed = parseRevisionValue(raw);
  try {
    return JSON.stringify(normalize(parsed ?? raw));
  } catch {
    return String(raw ?? '');
  }
};

const cheapHash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
};


// Strict check: only return string if it has meaningful non-whitespace content
// Also rejects raw JSON objects/arrays that shouldn't be displayed as text
// Normalize equivalent source labels (e.g. "Manual Entry" -> "Manual") so the
// UI does not show two chips for the same logical source.
const normalizeSourceLabel = (val: string | undefined): string | undefined => {
  if (!val) return val;
  if (val.trim().toLowerCase() === 'manual entry') return 'Manual';
  return val;
};

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
        source: normalizeSourceLabel(meaningfulString(ocsf.product?.name) || meaningfulString(ocsf.types?.[0])),
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
        source: normalizeSourceLabel(meaningfulString(legacyData.metadata?.product?.name) || meaningfulString(findingInfo?.types?.[0])),
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
      source: normalizeSourceLabel(meaningfulString(data.source)),
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

// Canonical collapsible panel — see src/components/incidents/IncidentSection.tsx.
// Aliased as `Section` so existing call sites keep working.
const Section = IncidentSection;

const IncidentDetailPage = () => {

  usePageMeta({
    title: 'Incident',
    description: 'Incident details, observables, correlations, timeline, and AI agent triage.',
  });
  const { id: rawId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { plural: entityPlural, singular: entitySingular, basePath: entityBasePath } = useEntityLabel();
  const t = useEntityText();
  const taskStatuses = useTaskStatuses();
  const { userInfo } = useAuth();
  const { openApp } = useAppDetail();
  const currentUsername = userInfo?.username || '';
  const scheduleAgentRun = useScheduleAgentRun();

  const handleScheduleAgentRun = useCallback(
    async (info: Parameters<ReturnType<typeof useScheduleAgentRun>>[0]) => {
      await scheduleAgentRun(info);
    },
    [scheduleAgentRun],
  );

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

  // When a demo incident was seeded with static fallback IOCs (because the
  // live `ioc_*` datastore categories were empty at seed time), the seeder
  // sets `metadata.extensions.custom_attributes.demoFallback = true` on the
  // incident. Surface that fact in the URL as `?demo-fallback=true` so it is
  // obvious from the address bar that the visible IOCs are static fallbacks
  // rather than live indicators.
  useEffect(() => {
    if (!incident) return;
    const usedFallback = !!incident.rawOCSF?.metadata?.extensions?.custom_attributes?.demoFallback;
    const alreadyTagged = searchParams.get('demo-fallback') === 'true';
    if (usedFallback && !alreadyTagged) {
      const next = new URLSearchParams(searchParams);
      next.set('demo-fallback', 'true');
      setSearchParams(next, { replace: true });
    }
  }, [incident, searchParams, setSearchParams]);

  // Support-only debug capture for failed loads. Populated whenever loadIncident
  // ends without producing an incident, so support users can see why.
  const [loadDebug, setLoadDebug] = useState<{
    stage: 'fetch-error' | 'no-success' | 'no-item' | 'parse-failed' | 'no-id';
    message?: string;
    rawId?: string;
    id?: string;
    crossOrgId?: string | null;
    activeOrgId?: string;
    isPublicView?: boolean;
    httpSuccess?: boolean;
    reason?: string;
    itemKey?: string;
    valueLength?: number;
    valuePreview?: string;
    error?: string;
    timestamp?: string;
  } | null>(null);
  // Demo-mode self-heal: when the user lands on a demo focus incident URL
  // that no longer exists in the datastore (e.g. it was force-regenerated
  // with a fresh timestamp suffix while the list was cached), we recreate
  // the focus incident and redirect to the new key — no "Incident not found"
  // dead-end during the tour. See "Incidents arriving" step 4.
  const { active: demoActive } = useDemo();
  const [demoRecovering, setDemoRecovering] = useState(false);
  const demoRecoveryTriedRef = useRef(false);
  
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
  // Baseline observable+enrichment count captured when a comment is sent.
  // Used to early-clear the "Running indicator check" loader as soon as
  // new enrichments/observables show up — even if the scheduled 7s refresh
  // has not fired yet.
  const obsRefreshBaselineRef = useRef<number | null>(null);
  const obsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Early-clear the comment loader as soon as the visible observable/
  // enrichment count grows past the baseline captured at send time. The
  // 7s scheduled refresh is still useful as a safety net, but we should
  // not keep the spinner visible after enrichments have already landed.
  const _obsCount = editedObservables.filter(o => !o.archived).length + enrichments.length;
  useEffect(() => {
    if (!refreshingObservables) return;
    const baseline = obsRefreshBaselineRef.current;
    if (baseline === null) return;
    if (_obsCount > baseline) {
      setRefreshingObservables(false);
      obsRefreshBaselineRef.current = null;
    }
  }, [_obsCount, refreshingObservables]);
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
  const [newObservableType, setNewObservableType] = useState('ipv4');
  const [newObservableValue, setNewObservableValue] = useState('');
  const [obsFilterTypes, setObsFilterTypes] = useState<string[]>([]);
  const [obsFilterText, setObsFilterText] = useState('');
  const [obsSortField, setObsSortField] = useState<'first_seen' | 'last_seen' | 'type' | 'value'>('first_seen');
  const [obsSortDir, setObsSortDir] = useState<'asc' | 'desc'>('desc');
  // Frozen sort-rank cache for the Observables tab. Captures (ioc, corr)
  // values the FIRST time we see a given observable key, so when correlation
  // lookups stream in later they don't yank rows around the list while the
  // user is mid-click. Cleared explicitly when the user changes sort/filter
  // or hits the manual refresh.
  const obsSortRankRef = useRef<Map<string, { ioc: number; corr: number }>>(new Map());
  // Bumped to force a fresh capture of the sort rank cache (used by the
  // sort/filter controls and the explicit "Re-run correlations" button).
  const [obsSortRankEpoch, setObsSortRankEpoch] = useState(0);
  // Ignored observables (per-org) — uninteresting indicators the user has
  // chosen to hide from the default Observables view. Toggle reveals them.
  const ignoredObs = useIgnoredObservables();
  const [showIgnoredObs, setShowIgnoredObs] = useState(false);
  // Wipe the frozen rank cache whenever the user touches sort/filter — that
  // is the right moment to honour newly-arrived correlations in the order.
  useEffect(() => {
    obsSortRankRef.current = new Map();
    setObsSortRankEpoch((n) => n + 1);
  }, [obsSortField, obsSortDir, obsFilterText, obsFilterTypes, showIgnoredObs]);

  // Single source of truth for "is this observable hidden?" — used by the
  // Observables list filter, the Observables tab badge, and the Timeline
  // observables filter so the counts always agree.
  const isObservableIgnored = useCallback(
    (type?: string, value?: string) => ignoredObs.isIgnored(type || '', value || ''),
    [ignoredObs],
  );
  const visibleObservablesCount = useMemo(() => {
    const manual = editedObservables.filter(o => !o.archived && !isObservableIgnored(o.type, o.value)).length;
    const enr = enrichments.filter(e => !isObservableIgnored(e.type, e.value || (e as any).data)).length;
    return manual + enr;
  }, [editedObservables, enrichments, isObservableIgnored]);

  const [editedCustomFields, setEditedCustomFields] = useState<Record<string, string | number | boolean>>({});
  const [editedLabels, setEditedLabels] = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState('');
  
  // Activity/comments
  // Draft comments are persisted to localStorage per-incident so an accidental
  // refresh doesn't lose what the user was typing. Key is scoped by incident id.
  const commentDraftKey = rawId ? `incident-comment-draft::${rawId}` : '';
  const [newComment, setNewComment] = useState<string>(() => {
    if (typeof window === 'undefined' || !commentDraftKey) return '';
    try { return window.localStorage.getItem(commentDraftKey) || ''; } catch { return ''; }
  });
  const [commentAttachments, setCommentAttachments] = useState<FileAttachment[]>([]);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  // "Ask the agent" popover state — quick way to send an @AIAgent question
  // from the incident header without scrolling down to the comment box.
  const [askAgentAnchor, setAskAgentAnchor] = useState<HTMLElement | null>(null);
  const [askAgentText, setAskAgentText] = useState('');
  const [askAgentSending, setAskAgentSending] = useState(false);
  const agentReadiness = useAgentReadiness();

  // Builds the auto-attached context block sent with @AIAgent questions.
  // Lives as a closure so it always reads the latest scoped state.
  const buildAskAgentContext = (): string => {
    try {
      return buildAgentContextBlock({
        incident: incident ? {
          id: incident.id,
          title: incident.title,
          severity: (incident as any).severity,
          status: (incident as any).status,
          type: (incident as any).type,
          source: (incident as any).source,
          created: (incident as any).created,
          assignee: (incident as any).assignee,
        } : null,
        observables: editedObservables || [],
        enrichments: enrichments || [],
        iocObservableKeys: iocObservableKeys instanceof Set ? iocObservableKeys : new Set<string>(),
        correlationKeys: (visibleCorrelations || []).map((c: any) => String(c?.label || c?.key || '')).filter(Boolean),
        stakeholders: (editedStakeholders || []) as any,
        recentTimeline: (activity || [])
          .filter((a: any) => a && a.type !== 'comment')
          .slice(-12)
          .map((a: any) => ({ type: a.type, user: a.user, content: a.content || a.details?.summary, timestamp: a.timestamp })),
        mergeCandidates: mergeCandidates?.candidates || [],
      });
    } catch (e) {
      console.warn('[AskAgent] Failed to build context block', e);
      return '';
    }
  };


  // Persist the draft on every change. Empty string clears the saved draft so
  // we don't leak stale content between sessions.
  useEffect(() => {
    if (!commentDraftKey || typeof window === 'undefined') return;
    try {
      if (newComment) {
        window.localStorage.setItem(commentDraftKey, newComment);
      } else {
        window.localStorage.removeItem(commentDraftKey);
      }
    } catch { /* ignore quota / privacy mode errors */ }
  }, [commentDraftKey, newComment]);
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
  // Tick used to re-render the timeline so the AI processing placeholder can
  // flip into a "timed out" state once 2 minutes have elapsed without an
  // agent reply, even when no other state changes.
  const [, setAiPlaceholderTick] = useState(0);
  useEffect(() => {
    const hasPendingAgentResponse = activity.some((a: any) => {
      if (a?.ai_handled !== true) return false;
      const text = String(a?.content || '');
      // Only items that explicitly @-mention the AI Agent show a placeholder.
      if (!/@\s*ai[\s_-]*agent\b/i.test(text)) return false;
      const replied = activity.some((r: any) => {
        if (r?.replyToId !== a.id) return false;
        const u = r?.user || '';
        return /agent|ai\s*agent|aiagent/i.test(u);
      });
      return !replied;
    });
    if (!hasPendingAgentResponse) return;
    const i = setInterval(() => setAiPlaceholderTick((t) => t + 1), 15_000);
    return () => clearInterval(i);
  }, [activity]);
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
  const [mergePreselectedId, setMergePreselectedId] = useState<string | undefined>(undefined);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetOrgId, setMoveTargetOrgId] = useState<string>('');
  const [moveSelectedOrgIds, setMoveSelectedOrgIds] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [publicAuthorization, setPublicAuthorization] = useState<string>('');
  const TAB_NAMES = ['details', 'tasks', 'observables', 'correlations', 'raw', 'file', 'original'] as const;
  // Timeline filter — multi-select. Each key can be toggled independently.
  // Defaults: everything EXCEPT "Changes" (revisions). Revisions are noisy
  // diffs that most users don't want to see by default — the synthetic
  // "Incident created" step below is rendered unconditionally so the
  // creation marker is never hidden by this default. Persisted to
  // localStorage so the same set is restored across page loads. Substep
  // filters (`tasks`, `observables`, `correlations`) split the legacy
  // "steps" bucket so each artefact type can be hidden individually.
  type TimelineFilterKey = 'revisions' | 'agent' | 'manual' | 'tasks' | 'observables' | 'correlations';
  const ALL_TIMELINE_FILTERS: TimelineFilterKey[] = ['revisions', 'agent', 'manual', 'tasks', 'observables', 'correlations'];
  const DEFAULT_TIMELINE_FILTERS: TimelineFilterKey[] = ['agent', 'manual', 'tasks', 'observables', 'correlations'];
  // Bumped when the default set changes so existing localStorage entries
  // re-default rather than persist the old "all on" baseline.
  const TIMELINE_FILTER_STORAGE_KEY = 'shuffle-incident-timeline-filters-v2';
  const [activeTimelineFilters, setActiveTimelineFilters] = useState<Set<TimelineFilterKey>>(() => {
    if (typeof window === 'undefined') return new Set(DEFAULT_TIMELINE_FILTERS);
    try {
      const raw = localStorage.getItem(TIMELINE_FILTER_STORAGE_KEY);
      if (!raw) return new Set(DEFAULT_TIMELINE_FILTERS);
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set(DEFAULT_TIMELINE_FILTERS);
      const valid = arr.filter((k): k is TimelineFilterKey => ALL_TIMELINE_FILTERS.includes(k));
      // Empty set is allowed — user explicitly hid everything.
      return new Set(valid);
    } catch {
      return new Set(DEFAULT_TIMELINE_FILTERS);
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(TIMELINE_FILTER_STORAGE_KEY, JSON.stringify(Array.from(activeTimelineFilters)));
    } catch { /* ignore quota */ }
  }, [activeTimelineFilters]);
  const toggleTimelineFilter = (key: TimelineFilterKey) => {
    setActiveTimelineFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const isFilterActive = (key: TimelineFilterKey) => activeTimelineFilters.has(key);
  // Legacy compatibility shim — a few render branches used to special-case
  // the single-select "revisions" tab to relabel the oldest revision as
  // "Incident created". The equivalent in the new multi-select model is
  // "only the Changes filter is enabled".
  const isOnlyRevisionsFilter = activeTimelineFilters.size === 1 && activeTimelineFilters.has('revisions');
  // Timeline expand/collapse — same UX as Email Thread / Description sections.
  // Persisted per-browser so the choice survives navigation.
  const TIMELINE_COLLAPSED_STORAGE_KEY = 'shuffle-incident-timeline-collapsed';
  const [timelineCollapsed, setTimelineCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(TIMELINE_COLLAPSED_STORAGE_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(TIMELINE_COLLAPSED_STORAGE_KEY, timelineCollapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [timelineCollapsed]);

  // Per-open guarantee: every time an incident detail page opens (or the
  // user navigates to a different incident), make sure AT LEAST one of
  // Email Thread or Timeline is expanded. If both are currently collapsed
  // we force-open the Timeline so the page never looks empty.
  useEffect(() => {
    if (!id) return;
    try {
      const emailOpen = localStorage.getItem('shuffle-incident-email-thread-open') === '1';
      const tlCollapsed = localStorage.getItem(TIMELINE_COLLAPSED_STORAGE_KEY) === '1';
      if (!emailOpen && tlCollapsed) {
        localStorage.setItem(TIMELINE_COLLAPSED_STORAGE_KEY, '0');
        setTimelineCollapsed(false);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // Anchor for the unified Timeline filters dropdown.
  const [timelineFilterAnchor, setTimelineFilterAnchor] = useState<HTMLElement | null>(null);
  const [revisionDialogData, setRevisionDialogData] = useState<{ json: string; changedKeys: Set<string> } | null>(null);
  const initialTab = (() => {
    const t = searchParams.get('tab');
    if (t) { const idx = TAB_NAMES.indexOf(t as any); return idx >= 0 ? idx : 0; }
    return 0;
  })();
   const [activeTab, setActiveTabState] = useState(initialTab);
   const setActiveTab = (tab: number) => {
     // Leaving the Raw OCSF tab (index 4) while previewing an older revision:
     // revert the editor back to the live incident OCSF so unsaved revision
     // previews do not persist across tab switches.
     setActiveTabState((prev) => {
       if (prev === 4 && tab !== 4 && selectedRevisionIdx !== null) {
         setRawJsonText(JSON.stringify((incident as any)?.rawOCSF || {}, null, 2));
         setSelectedRevisionIdx(null);
       }
       return tab;
     });
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

    /**
     * Demo-style "Ask the agent" affordance: when the user clicks a Known IOC
     * pill on the Timeline, prefill the comment input with an @agent question
     * about that observable, switch to the Details/Timeline tab so the input
     * is visible, then focus and scroll to it. The user just hits Enter to
     * actually send — they're never tricked into sending something they didn't
     * see. This makes it obvious the AI agent is real and reachable from any
     * observable, not just a label in the sidebar.
     */
    const askAgentAboutObservable = (obsKey: string) => {
      const sepIdx = obsKey.indexOf('::');
      const type = sepIdx > -1 ? obsKey.slice(0, sepIdx) : '';
      const value = sepIdx > -1 ? obsKey.slice(sepIdx + 2) : obsKey;
      const labelType = type ? type.toUpperCase() : 'observable';
      const prompt = `@agent This ${labelType} \`${value}\` is flagged as a Known IOC on the timeline. What do we know about it (threat-feed sources, related campaigns), and what should we do next — block, isolate, or investigate further?`;
      setActiveTab(0);
      setNewComment((cur) => (cur && cur.trim() ? cur : prompt));
      setTimeout(() => {
        const wrapper = document.querySelector('[data-tour="incident-comment-input"]') as HTMLElement | null;
        if (!wrapper) return;
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = wrapper.querySelector('textarea, input') as HTMLTextAreaElement | HTMLInputElement | null;
        if (input) {
          input.focus();
          try {
            const len = (input.value || '').length;
            (input as HTMLTextAreaElement).setSelectionRange(len, len);
          } catch { /* ignore */ }
        }
      }, 120);
      try {
        // toast suppressed during demo (distracting)
      } catch { /* ignore */ }
    };

    /**
     * Demo tour hook: when the user clicks the "Ask the agent a question"
     * sub-goal pill in the DemoTourDrawer, prefill the comment input with a
     * sample @AIAgent message so they only have to hit Enter to send. Same
     * UX pattern as askAgentAboutObservable but triggered from the drawer.
     */
    useEffect(() => {
      const onInject = () => {
        const sample = '@AIAgent What should I do next with this incident? Are there other indicators I should look at?';
        setActiveTab(0);
        setNewComment((cur) => (cur && cur.trim() ? cur : sample));
        setTimeout(() => {
          const wrapper = document.querySelector('[data-tour="incident-comment-input"]') as HTMLElement | null;
          if (!wrapper) return;
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const input = wrapper.querySelector('textarea, input') as HTMLTextAreaElement | HTMLInputElement | null;
          if (input) {
            input.focus();
            try {
              const len = (input.value || '').length;
              (input as HTMLTextAreaElement).setSelectionRange(len, len);
            } catch { /* ignore */ }
          }
        }, 120);
        try {
          // toast suppressed during demo (distracting)
        } catch { /* ignore */ }
      };
      window.addEventListener('demo:inject-agent-mention', onInject);
      return () => window.removeEventListener('demo:inject-agent-mention', onInject);
    }, []);

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
  const [selectedRevisionIdx, setSelectedRevisionIdx] = useState<number | null>(null);

  // Tracks an OCSF-recovery fallback: when the live incident is not OCSF-shaped,
  // we look back through revisions for the most recent valid OCSF snapshot and
  // overlay any new top-level fields from the latest (non-OCSF but valid JSON)
  // revision on top of it. The banner explains this to the user.
  const [ocsfFallbackInfo, setOcsfFallbackInfo] = useState<{
    revisionTimestamp?: number;
    overlaidFieldCount: number;
  } | null>(null);
  const ocsfFallbackAttemptedRef = useRef(false);
  const ocsfFallbackDismissKey = id ? `ocsf-fallback-dismissed:${id}` : '';
  const [ocsfFallbackDismissed, setOcsfFallbackDismissed] = useState<boolean>(() => {
    if (!ocsfFallbackDismissKey || typeof window === 'undefined') return false;
    try { return localStorage.getItem(ocsfFallbackDismissKey) === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (!ocsfFallbackDismissKey || typeof window === 'undefined') return;
    try { setOcsfFallbackDismissed(localStorage.getItem(ocsfFallbackDismissKey) === '1'); } catch { /* ignore */ }
  }, [ocsfFallbackDismissKey]);
  const dismissOcsfFallback = () => {
    setOcsfFallbackDismissed(true);
    if (ocsfFallbackDismissKey) {
      try { localStorage.setItem(ocsfFallbackDismissKey, '1'); } catch { /* ignore */ }
    }
  };

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

        // Always sort revisions by normalized timestamp (newest first)
        const sorted = [...rawRevisions].sort((a: any, b: any) =>
          normalizeToMs(b.edited ?? b.created) - normalizeToMs(a.edited ?? a.created)
        );

        // Deduplicate by the canonical revision payload. The API can return
        // the same snapshot more than once with different revision ids or
        // timestamps, while every revision also shares the same datastore key.
        // Keep the newest copy of each unique snapshot and show it once.
        const fingerprintFor = (rev: any): string => {
          return `payload:${cheapHash(stableRevisionValueString(rev?.value))}`;
        };

        const seenFingerprints = new Set<string>();
        const seenRevisionIds = new Set<string>();
        const deduped: any[] = [];
        for (const rev of sorted) {
          const explicitId = rev?.revision_id || rev?.revisionId || rev?.id;
          if (explicitId && seenRevisionIds.has(String(explicitId))) continue;
          const fp = fingerprintFor(rev);
          if (seenFingerprints.has(fp)) continue;
          if (explicitId) seenRevisionIds.add(String(explicitId));
          seenFingerprints.add(fp);
          deduped.push(rev);
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

  // Hoisted here so automation-status hooks below can scope to every tenant
  // this incident lives in (primary + shared). Populated by the effect further
  // down that probes for shared copies across sub-tenants.
  const [sharedOrgs, setSharedOrgs] = useState<Array<{ id: string; name: string; image?: string }>>([]);

  // Validate automation status against every tenant this incident lives in
  // (primary + shared), so a copy in tenant A that lacks enrichment still
  // surfaces the CTA even when the active session is on tenant B. `enable()`
  // will run against every tenant currently missing the automation.
  const incidentOrgIds = useMemo(() => {
    const ids: string[] = [];
    const primary = crossOrgId || userInfo?.active_org?.id;
    if (primary) ids.push(primary);
    for (const so of sharedOrgs) {
      if (so?.id && !ids.includes(so.id)) ids.push(so.id);
    }
    return ids;
  }, [crossOrgId, userInfo?.active_org?.id, sharedOrgs]);
  const enrichmentStatus = useEnrichmentStatus(undefined, { orgIds: incidentOrgIds });
  const assignEscalateStatus = useAssignEscalateStatus({ orgIds: incidentOrgIds });
  const isSupportUser = useIsSupport();

  // ── Inline enrichment CTA visibility ───────────────────────────────────
  // Surface the same "Automatic observable extraction is not yet fully
  // enabled" CTA used on the Observables tab inside the Timeline / chat
  // area whenever the user is most likely to notice things being "missing":
  //   1. The incident is fresh (created within the last 3 minutes), so the
  //      first wave of observables / correlations would normally still be
  //      streaming in.
  //   2. A comment was posted in the last 30 seconds — fresh chat = fresh
  //      expectations of automated follow-up.
  //   3. The user is currently typing in the comment input — they should
  //      always be able to enable enrichment without leaving the incident.
  const FRESH_INCIDENT_CTA_MS = 3 * 60 * 1000;
  const FRESH_COMMENT_CTA_MS = 30 * 1000;
  const lastManualCommentTs = useMemo(() => {
    let max = 0;
    for (const item of activity || []) {
      const ts = normalizeToMs((item as { timestamp?: number | string }).timestamp);
      if (ts > max) max = ts;
    }
    return max;
  }, [activity]);
  const incidentAgeMs = incident?.createdTs ? nowTick - normalizeToMs(incident.createdTs) : Infinity;
  const lastCommentAgeMs = lastManualCommentTs ? nowTick - lastManualCommentTs : Infinity;
  const isTypingComment = newComment.trim().length > 0;
  const showEnrichmentInlineCTA =
    !enrichmentStatus.isLoading
    && !enrichmentStatus.active
    && (
      isTypingComment
      || incidentAgeMs < FRESH_INCIDENT_CTA_MS
      || lastCommentAgeMs < FRESH_COMMENT_CTA_MS
    );
  // Keep nowTick advancing while a time-based window is in play so the
  // banner auto-hides without requiring a re-render from elsewhere.
  useEffect(() => {
    if (enrichmentStatus.active || enrichmentStatus.isLoading) return;
    const incidentWindowOpen = incidentAgeMs < FRESH_INCIDENT_CTA_MS;
    const commentWindowOpen = lastCommentAgeMs < FRESH_COMMENT_CTA_MS;
    if (!incidentWindowOpen && !commentWindowOpen) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [enrichmentStatus.active, enrichmentStatus.isLoading, incidentAgeMs, lastCommentAgeMs, FRESH_INCIDENT_CTA_MS, FRESH_COMMENT_CTA_MS]);

  const renderEnrichmentInlineCTA = () => (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      mx: 2,
      mt: 2,
      px: 1.5,
      py: 1,
      borderRadius: 1.5,
      bgcolor: 'rgba(251, 146, 60, 0.08)',
      border: '1px solid rgba(251, 146, 60, 0.18)',
    }}>
      <Typography variant="caption" sx={{ color: '#fb923c', fontWeight: 500, flex: 1, lineHeight: 1.3 }}>
        Automatic observable extraction is not yet fully enabled — observables and correlations may be missing from this incident.
      </Typography>
      <Tooltip
        title={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5, maxWidth: 360 }}>
            {enrichmentStatus.checks.map((c) => (
              <Box key={c.label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <CheckCircleIcon size={13} style={{ color: c.active ? 'hsl(var(--severity-low))' : 'hsl(var(--destructive))' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{c.label}</Typography>
                </Box>
                {isSupportUser && (
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', pl: 2.5, lineHeight: 1.3 }}>
                    {c.detail}
                  </Typography>
                )}
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
            fontSize: '0.72rem',
            fontWeight: 600,
            height: 26,
            minWidth: 70,
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
  );


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
  // Live ref to the latest incident snapshot — used by fetchCorrelations to
  // persist correlation_first_seen without taking `incident` as a dep
  // (which would cause refetch loops every time the incident state changes).
  const incidentRef = useRef<{ rawOCSF?: Record<string, unknown> } | null>(null);
  const [correlationsLoading, setCorrelationsLoading] = useState(false);
  // Per-correlation "first seen" timestamps (epoch ms), keyed by correlation
  // key. Persisted under metadata.extensions.custom_attributes.correlation_first_seen
  // so the timeline stays stable across reloads / sessions without storing
  // the full correlation payload (which is fetched live from /api/v2/correlations).
  const [correlationFirstSeen, setCorrelationFirstSeen] = useState<Record<string, number>>({});
  // Discovery time used to anchor the aggregated "N Correlations" pill on the
  // timeline. Derived from the earliest persisted first-seen stamp; falls
  // back to Date.now() the very first time we see correlations and haven't
  // persisted anything yet.
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
  // Filtered view of correlations that drops any whose key matches an
  // ignored observable value. Used by every "Correlations (N)" badge and the
  // timeline so the count agrees with what the user actually sees.
  // Unify the two correlation sources we have on the page so the
  // Correlations tab — and every count/badge derived from it — sees the
  // SAME set the per-observable inline lookups already see:
  //
  //  1. `correlations` — incident-level buckets returned by the backend
  //     for `{ type: 'datastore', key: incident.id }`. Authoritative when
  //     present, but can lag because the backend hasn't yet linked a
  //     freshly-seen value back to this incident's record.
  //  2. `obsCorrelations` — live per-value lookups (`{ type: 'value', key }`)
  //     that drive the "1 corr" badge on each observable row. These can
  //     surface matches before #1 catches up.
  //
  // Merge by correlation key, unioning `ref` lists and taking the max
  // `amount` so a value-hit never reduces a richer datastore-hit. Filter
  // out entries the user has chosen to ignore.
  const correlationVisibilityOptions = useMemo(() => ({
    currentIncidentId: id,
    isValueIgnored: ignoredObs.isValueIgnored,
  }), [id, ignoredObs.isValueIgnored]);

  const visibleCorrelations = useMemo(() => {
    const merged = new Map<string, { key: string; amount: number; ref: string[] }>();
    const add = (c: { key: string; amount: number; ref: string[] }) => {
      if (!c?.key) return;
      const k = String(c.key).toLowerCase();
      const existing = merged.get(k);
      if (!existing) {
        merged.set(k, { key: c.key, amount: c.amount || (c.ref?.length ?? 0), ref: [...(c.ref || [])] });
        return;
      }
      const refSet = new Set(existing.ref);
      (c.ref || []).forEach(r => refSet.add(r));
      existing.ref = Array.from(refSet);
      existing.amount = Math.max(existing.amount || 0, c.amount || 0, existing.ref.length);
    };
    correlations.forEach(add);
    Object.values(obsCorrelations).forEach(entry => (entry?.data || []).forEach(add));
    return filterMeaningfulCorrelations(Array.from(merged.values()), correlationVisibilityOptions);
  }, [correlations, obsCorrelations, correlationVisibilityOptions]);

  // ---------------------------------------------------------------------
  // Merge candidate suggestions
  //
  // Build the input signal sets — observable keys, correlation keys, and
  // the subset that we already know matches a known IOC. Each is wrapped
  // in `useMemo` so identity only changes when the underlying data does;
  // that keeps the candidate scoring inside `useMergeCandidates` stable
  // while correlations stream in over time.
  // ---------------------------------------------------------------------
  const currentObservableKeys = useMemo(() => {
    const set = new Set<string>();
    (incident?.observables || []).forEach((o: any) => {
      if (!o?.value || !o?.type) return;
      set.add(`${String(o.type).toLowerCase()}::${String(o.value).toLowerCase()}`);
    });
    return set;
  }, [incident?.observables]);

  const currentCorrelationKeys = useMemo(() => {
    const set = new Set<string>();
    visibleCorrelations.forEach(c => set.add(String(c.key).toLowerCase()));
    return set;
  }, [visibleCorrelations]);

  const mergeCandidates = useMergeCandidates({
    currentIncidentId: incident?.id,
    currentTitle: incident?.title || '',
    currentObservableKeys,
    currentCorrelationKeys,
    currentIocKeys: iocObservableKeys,
    enabled: !!incident?.id && !isPublicView,
  });

  // Cross-referenced merges: fetch the primary (if this incident is merged
  // into another) and the incidents that were merged INTO this one.
  const relatedIncidents = useRelatedIncidents(incident?.id, incident?.rawOCSF);
  const primaryPointer = useMemo(() => getPrimaryPointer(incident?.rawOCSF), [incident?.rawOCSF]);

  // Legacy migration: pre-cross-reference merges wrote status_id 99 +
  // `merged_into` on the source only. On first view, upgrade the record
  // to the symmetric pointer model so the banners can render.
  useEffect(() => {
    if (!incident?.id || !incident.rawOCSF) return;
    maybeMigrateLegacyMerge(incident.id, incident.rawOCSF).then(migrated => {
      if (migrated) { void loadIncident?.(false); }
    }).catch(() => {/* non-fatal */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id]);
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

  const { subOrgs, parentOrg, isParentOrg } = useSubOrgs(userInfo?.active_org?.id);
  const crossOrgInfo = useMemo(() => {
    if (!crossOrgId) return null;
    if (parentOrg && parentOrg.id === crossOrgId) return { name: parentOrg.name, image: parentOrg.image };
    const found = subOrgs.find(o => o.id === crossOrgId);
    return found ? { name: found.name, image: found.image } : null;
  }, [crossOrgId, subOrgs, parentOrg]);

  // ── Routing rule matches (powers both the preview banner AND timeline pills) ──
  // Rules live on the PARENT org's `shuffle-security_routing` datastore; on a
  // parent we fall back to the active org id. The result is also injected as
  // synthetic "routing-matched" steps in the unified timeline so users can see
  // at a glance which rules would fire — without scrolling up to the banner.
  const routingRulesOrgId = parentOrg?.id || userInfo?.active_org?.id;
  const { items: routingRuleItems, fetchItems: fetchRoutingRules } = useDatastore({
    category: ROUTING_DATASTORE_CATEGORY,
    orgId: routingRulesOrgId,
  });
  useEffect(() => {
    if (routingRulesOrgId) fetchRoutingRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routingRulesOrgId]);
  const routingRules: RoutingRule[] = useMemo(() => {
    const out: RoutingRule[] = [];
    for (const it of routingRuleItems) {
      try {
        const v = typeof it.value === 'string' ? JSON.parse(it.value) : it.value;
        if (v && typeof v === 'object') {
          const actions = Array.isArray(v.actions) ? v.actions : (v.action ? [v.action] : []);
          out.push({
            id: v.id || it.key,
            name: v.name || 'Untitled rule',
            enabled: v.enabled !== false,
            priority: Number.isFinite(v.priority) ? v.priority : 100,
            matchMode: v.matchMode === 'any' ? 'any' : 'all',
            conditions: Array.isArray(v.conditions) ? v.conditions : [],
            actions,
          });
        }
      } catch { /* skip malformed */ }
    }
    return out;
  }, [routingRuleItems]);
  const routingContext: IncidentEvaluationContext = useMemo(() => ({
    title: editedTitle || incident?.title,
    description: editedMessage,
    source: incident?.source,
    severity: editedSeverity,
    status: editedStatus,
    labels: editedLabels,
    observables: editedObservables,
    stakeholders: editedStakeholders,
    rawOCSF: incident?.rawOCSF,
  }), [editedTitle, editedMessage, editedSeverity, editedStatus, editedLabels, editedObservables, editedStakeholders, incident]);
  const routingMatches = useMemo(
    () => evaluateRoutingRules(routingContext, routingRules),
    [routingContext, routingRules]
  );


  // Detect which other orgs share the same incident key
  // Primary source: shared_orgs query param from the list page (most reliable)
  // Fallback: probe each org via get_cache
  // (see hoisted declaration above)
  
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
      // Collect every copy along with its raw value so we can compute the
      // authoritative tenant stamp before deciding which tenants are real.
      const raw: Array<{ id: string; name: string; image?: string; value: string | null }> = [];

      const results = await Promise.allSettled(
        orgsToProbe.map(async (org) => {
          try {
            const result = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS, org.id);
            if (result.success && result.item?.value && result.item.value.length > 2) {
              return { id: org.id, name: org.name, image: org.image, value: result.item.value };
            }
          } catch {
            // Ignore probe failures
          }
          return null;
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          raw.push(r.value);
        }
      }

      // Also include the currently-viewed tenant when computing the stamp so
      // its `_tenants` list wins if it's the newest. This is critical when
      // the ONLY other copy is an auto-recovered ghost in a tenant we just
      // removed from — without this read, `authStamp` would be null and the
      // ghost would count as a real shared copy.
      const viewingOrgId = crossOrgId || userInfo.active_org?.id || '';
      let authStamp: TenantStamp | null = null;
      const consider = (value: string | null) => {
        if (!value) return;
        try {
          const parsed = JSON.parse(value);
          const s = readTenantStamp(parsed);
          if (s && (!authStamp || s.updatedAt > authStamp.updatedAt)) authStamp = s;
        } catch { /* ignore parse errors */ }
      };
      for (const c of raw) consider(c.value);
      try {
        const selfRead = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS, viewingOrgId || undefined);
        if (selfRead?.success && selfRead.item?.value) {
          consider(typeof selfRead.item.value === 'string' ? selfRead.item.value : JSON.stringify(selfRead.item.value));
        }
      } catch { /* ignore */ }

      // A copy is a ghost when the authoritative stamp explicitly excludes
      // its tenant (i.e. it was removed but auto-recovered from history).
      const ghostIds = raw.filter(c => isTenantGhost(c.id, authStamp)).map(c => c.id);
      const filtered = raw.filter(c => !ghostIds.includes(c.id));
      // If the viewing tenant is a ghost per the stamp, the user is looking
      // at a stale copy — leave that decision to the load logic. Just make
      // sure we don't count ghost tenants as "shared".
      if (isTenantGhost(viewingOrgId, authStamp)) {
        console.warn(`[CrossOrg] viewing tenant ${viewingOrgId} is flagged as a ghost by authoritative stamp`);
      }

      const found = filtered.map(({ id: oid, name, image }) => ({ id: oid, name, image }));
      console.log(`[CrossOrg] Probed ${orgsToProbe.length} orgs for key "${id}", found in ${found.length} additional orgs${authStamp ? ' (stamp-filtered)' : ''}:`, found.map(o => o.name));
      setSharedOrgs(found);
    };
    probeOrgs();
  }, [id, subOrgs, parentOrg, userInfo?.active_org?.id, crossOrgId, searchParams]);

  // Fetch agent runs for this incident — deferred until incident loaded.
  // While an @AIAgent comment is awaiting a reply, poll fast (5s); otherwise
  // we fall back to a 60s cadence inside the hook.
  const hasPendingAgentMention = useMemo(() => {
    return activity.some((a: any) => {
      if (a?.ai_handled !== true) return false;
      const text = String(a?.content || '');
      if (!/@\s*ai[\s_-]*agent\b/i.test(text)) return false;
      const replied = activity.some((r: any) => {
        if (r?.replyToId !== a.id) return false;
        const u = r?.user || '';
        return /agent|ai\s*agent|aiagent/i.test(u);
      });
      return !replied;
    });
  }, [activity]);
  const { runsForIncident: agentRuns, isLoading: agentRunsLoading, refetch: refetchAgentRuns } = useIncidentAgentRuns(!loading ? id : undefined, hasPendingAgentMention);
  const [selectedAgentRun, setSelectedAgentRun] = useState<AgentRun | null>(null);

  // Load incident function (reusable for refresh)
  const loadIncident = useCallback(async (showLoading = true) => {
    if (!id) {
      setLoadDebug({
        stage: 'no-id',
        message: 'No incident id present in URL',
        rawId,
        timestamp: new Date().toISOString(),
      });
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
      setLoadDebug({
        stage: 'fetch-error',
        message: 'Network/transport failure while fetching incident',
        rawId,
        id,
        crossOrgId,
        activeOrgId: userInfo?.active_org?.id,
        isPublicView,
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        timestamp: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }
    const fetchTime = performance.now() - loadStart;
    console.log(`[Perf] Incident fetch: ${fetchTime.toFixed(1)}ms, size: ${((result.item?.value?.length || 0) / 1024).toFixed(1)}KB`);
    
    // Some API responses come back as success=true with an empty stub item
    // (no key, empty value) when the requested key does not actually exist
    // in the datastore. Treat that as "no item found" instead of letting it
    // fall through to the parser and trip a misleading "parse-failed" error.
    const itemValueLen = result.item?.value?.length || 0;
    const itemKeyEmpty = !result.item?.key;
    const isEmptyStub = !!(result.success && result.item) && itemKeyEmpty && itemValueLen <= 2;

    if (result.success && result.item && !isEmptyStub) {
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
        setLoadDebug(null);
        console.log(`[Perf] Total loadIncident: ${(performance.now() - loadStart).toFixed(1)}ms`);
        return;
      }
      // result.success && result.item, but parse returned null
      setLoadDebug({
        stage: 'parse-failed',
        message: 'Datastore item was returned but parseIncidentFromDatastore() returned null (likely invalid/empty JSON in value)',
        rawId,
        id,
        crossOrgId,
        activeOrgId: userInfo?.active_org?.id,
        isPublicView,
        httpSuccess: true,
        itemKey: result.item.key,
        valueLength: result.item.value?.length || 0,
        valuePreview: (result.item.value || '').slice(0, 500),
        timestamp: new Date().toISOString(),
      });
    } else {
      // Primary tenant lookup returned nothing. Before giving up, probe the
      // other tenants this user can see — the incident may have been moved
      // (or the URL was seeded before the source tenant existed) and only
      // lives elsewhere now. If found, redirect to the correct key so a
      // page refresh always lands on a real copy.
      if (!isPublicView && id) {
        const activeId = userInfo?.active_org?.id;
        const probeTargets: string[] = [];
        const seenProbe = new Set<string>();
        const addProbe = (oid?: string | null) => {
          if (!oid || seenProbe.has(oid)) return;
          if (oid === (crossOrgId || activeId)) return; // already checked
          seenProbe.add(oid);
          probeTargets.push(oid);
        };
        if (crossOrgId) addProbe(activeId); // if URL had crossOrg, also try active
        if (parentOrg) addProbe(parentOrg.id);
        for (const so of subOrgs) addProbe(so.id);

        if (probeTargets.length > 0) {
          try {
            const probeResults = await Promise.all(
              probeTargets.map(async (oid) => {
                try {
                  const r = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS, oid);
                  const valLen = r.item?.value?.length || 0;
                  const stub = !!(r.success && r.item) && !r.item.key && valLen <= 2;
                  if (!(r.success && r.item && !stub)) return null;
                  let parsedValue: unknown = null;
                  try { parsedValue = r.item.value ? JSON.parse(r.item.value) : null; } catch { /* ignore */ }
                  return { orgId: oid, value: parsedValue };
                } catch {
                  return null;
                }
              }),
            );
            const hits = probeResults.filter((r): r is { orgId: string; value: unknown } => !!r);
            // Pick authoritative stamp so we don't chase a ghost.
            let authStamp: TenantStamp | null = null;
            for (const h of hits) {
              const s = readTenantStamp(h.value);
              if (s && (!authStamp || s.updatedAt > authStamp.updatedAt)) authStamp = s;
            }
            const liveHits = hits.filter(h => !isTenantGhost(h.orgId, authStamp));
            // Prefer a hit that matches the authoritative tenants list;
            // otherwise fall back to any live hit.
            const preferred = authStamp
              ? liveHits.find(h => authStamp!.tenants.includes(h.orgId)) || liveHits[0]
              : liveHits[0];
            const foundOrgId = preferred?.orgId;
            if (foundOrgId) {
              const newKey = foundOrgId === activeId ? id : `${foundOrgId}::${id}`;
              console.log(`[IncidentDetail] primary lookup empty; found copy in tenant ${foundOrgId} — redirecting`);
              navigate(`${entityBasePath}/${newKey}`, { replace: true });
              return;
            }
          } catch (err) {
            console.warn('[IncidentDetail] cross-tenant fallback probe failed:', err);
          }
        }
      }

      const stage = isEmptyStub ? 'no-item' : (result.success ? 'no-item' : 'no-success');
      setLoadDebug({
        stage,
        message: isEmptyStub
          ? 'API responded success=true but the item is an empty stub — no incident exists for this key in the active org'
          : result.success
            ? 'API responded success=true but no item was returned'
            : 'API responded success=false (no item present in datastore for this key)',
        rawId,
        id,
        crossOrgId,
        activeOrgId: userInfo?.active_org?.id,
        isPublicView,
        httpSuccess: !!result.success,
        reason: (result as { reason?: string }).reason,
        valueLength: result.item?.value?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }
    
    setLoading(false);
  }, [id, rawId, isPublicView, publicOrg, publicAuth, crossOrgId, userInfo?.active_org?.id, parentOrg, subOrgs, navigate, entityBasePath]);

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

  // Show toast for invalid data incidents (no title + no source). We wait for
  // revisions to finish loading and for the OCSF-recovery fallback to attempt
  // a merge — if recovery succeeds, the inline banner replaces the toast.
  const invalidDataToastShown = useRef(false);
  useEffect(() => {
    if (invalidDataToastShown.current || loading || !incident) return;
    if (!revisionsLoaded || !ocsfFallbackAttemptedRef.current) return;
    if (ocsfFallbackInfo) return; // Recovery succeeded — banner explains it
    const hasTitle = !!incident.title;
    const hasSource = !!incident.source;
    if (!hasTitle && !hasSource) {
      invalidDataToastShown.current = true;
      toast.error(t('This incident is not in a valid OCSF format. Validate your ingest pipeline or contact support@shuffler.io'), { duration: 8000 });
    }
  }, [loading, incident, revisionsLoaded, ocsfFallbackInfo, t]);

  // OCSF-recovery fallback. Triggered once revisions have loaded for an incident
  // whose live payload is NOT OCSF-shaped. Strategy:
  //   1. Walk revisions newest → oldest, find the most recent OCSF-valid one.
  //   2. If the newest revision (or live payload) is also valid JSON, overlay
  //      its top-level fields onto the OCSF base so newer edits aren't lost.
  //   3. Re-parse and apply the merged data into the page state.
  // This is purely a display fallback — the underlying datastore item is not
  // modified.
  useEffect(() => {
    if (loading || !incident || !revisionsLoaded) return;
    if (ocsfFallbackAttemptedRef.current) return;

    const liveIsOcsf = isOcsfShapedData(incident.rawOCSF);
    const missingFields = liveIsOcsf ? getMissingCriticalFields(incident.rawOCSF) : [];
    const needsRecovery = !liveIsOcsf || missingFields.length > 0;

    if (!needsRecovery) {
      ocsfFallbackAttemptedRef.current = true;
      return;
    }

    ocsfFallbackAttemptedRef.current = true;

    // Walk ALL revisions oldest → newest and fold every OCSF-shaped one into
    // an accumulator. A single bad revision can drop a field that an earlier
    // (and a later) revision still has — folding the whole chain lets us
    // recover from any of them instead of stopping at the first hit.
    // `revisions` is sorted newest-first, so iterate in reverse.
    const ocsfRevisions: Array<{ data: any; ts: number; index: number }> = [];
    for (let i = revisions.length - 1; i >= 0; i--) {
      const rev = revisions[i];
      const parsed = parseRevisionValue(rev?.value);
      if (!parsed || !isOcsfShapedData(parsed)) continue;
      ocsfRevisions.push({
        data: parsed,
        ts: normalizeToMs(rev?.edited ?? rev?.created),
        index: i,
      });
    }
    if (ocsfRevisions.length === 0) return; // Nothing to recover from

    let ocsfBase: any = ocsfRevisions[0].data;
    let ocsfBaseTs = ocsfRevisions[0].ts;
    for (let i = 1; i < ocsfRevisions.length; i++) {
      const next = ocsfRevisions[i];
      try {
        ocsfBase = deepMergeIncidents(ocsfBase, next.data, ocsfBaseTs, next.ts);
        ocsfBaseTs = next.ts || ocsfBaseTs;
      } catch (err) {
        console.warn('[OCSF Fallback] Skipping revision merge at index', next.index, err);
      }
    }
    const recoveredRevisionCount = ocsfRevisions.length;
    const newestRevisionTs = ocsfRevisions[ocsfRevisions.length - 1].ts || ocsfBaseTs;

    // Overlay the live payload last so the freshest edits win on conflicts,
    // while any field still missing from live gets backfilled from the merged
    // revision history.
    const liveData = incident.rawOCSF || {};
    const liveTs = incident.editedTs || incident.createdTs || 0;
    let merged: any;
    let overlaidFieldCount = 0;
    if (liveData && typeof liveData === 'object' && !Array.isArray(liveData)) {
      try {
        merged = deepMergeIncidents(ocsfBase, liveData, ocsfBaseTs, liveTs);
        overlaidFieldCount = liveIsOcsf
          ? missingFields.length
          : Object.keys(liveData).filter(k => !(k in ocsfBase)).length;
      } catch (err) {
        console.warn('[OCSF Fallback] deepMergeIncidents failed, using base only:', err);
        merged = ocsfBase;
      }
    } else {
      merged = ocsfBase;
    }

    const reParsed = parseIncidentFromDatastore({
      key: incident.id,
      value: JSON.stringify(merged),
      created: incident.createdTs ? Math.floor(incident.createdTs / 1000) : undefined,
      edited: incident.editedTs ? Math.floor(incident.editedTs / 1000) : undefined,
    });
    if (!reParsed) return;

    console.log('[OCSF Fallback] Recovered by folding', recoveredRevisionCount,
      'OCSF revision(s); newest at', new Date(newestRevisionTs).toISOString(),
      `— ${overlaidFieldCount} field(s) overlaid from live`);

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

    setOcsfFallbackInfo({ revisionTimestamp: newestRevisionTs, overlaidFieldCount });
  }, [loading, incident, revisionsLoaded, revisions]);


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

  // Refresh when the tab becomes visible again so the user always sees the
  // latest content after switching away and back.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (pendingSaveRef.current || isSaving) return;
      loadIncident(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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

        // Stamp NEW correlation keys with a first-seen timestamp and persist
        // a tiny `{ key: epochMs }` map under metadata.extensions.custom_attributes.
        // We deliberately store ONLY the timestamp (not the full correlation
        // payload) — the live data is always re-fetched from the API.
        if (filteredCorr.length > 0) {
          setCorrelationFirstSeen((prev) => {
            const now = Date.now();
            const next = { ...prev };
            let added = 0;
            for (const c of filteredCorr) {
              if (!c?.key) continue;
              if (next[c.key] === undefined) {
                next[c.key] = now;
                added += 1;
              }
            }
            if (added === 0) return prev;
            // Fire-and-forget persist of the tiny first-seen map. We update
            // ONLY the correlation_first_seen field — everything else is
            // copied through verbatim so we don't clobber concurrent edits.
            const snap = incidentRef.current?.rawOCSF as Record<string, unknown> | undefined;
            if (snap && id) {
              const meta = (snap.metadata as Record<string, unknown> | undefined) || {};
              const exts = (meta.extensions as Record<string, unknown> | undefined) || {};
              const custom = (exts.custom_attributes as Record<string, unknown> | undefined) || {};
              const updated = {
                ...snap,
                metadata: {
                  ...meta,
                  extensions: {
                    ...exts,
                    custom_attributes: {
                      ...custom,
                      correlation_first_seen: next,
                    },
                  },
                },
              };
              setDatastoreItem(id, updated, DATASTORE_CATEGORIES.INCIDENTS, crossOrgId || undefined)
                .catch((err) => console.warn('[Correlations] persist first-seen failed', err));
            }
            // Anchor the timeline pill at the earliest stamp we know about.
            const earliest = Math.min(...Object.values(next));
            setCorrelationsDiscoveredAt(earliest);
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch correlations:', error);
    } finally {
      setCorrelationsLoading(false);
    }
  }, [id, crossOrgHeaders, crossOrgId]);

  useEffect(() => {
    if (loading) return;
    fetchCorrelations();
  }, [fetchCorrelations, loading]);

  // Hydrate correlation_first_seen from the persisted incident payload so the
  // timeline shows the original discovery time across reloads, and keep the
  // incidentRef pointed at the latest snapshot for the persist path inside
  // fetchCorrelations.
  useEffect(() => {
    incidentRef.current = incident as { rawOCSF?: Record<string, unknown> } | null;
    const raw = incident?.rawOCSF as Record<string, unknown> | undefined;
    const persisted = (((raw?.metadata as Record<string, unknown> | undefined)
      ?.extensions as Record<string, unknown> | undefined)
      ?.custom_attributes as Record<string, unknown> | undefined)
      ?.correlation_first_seen as Record<string, number> | undefined;
    if (persisted && typeof persisted === 'object') {
      setCorrelationFirstSeen((prev) => {
        // Only seed missing keys — don't overwrite stamps we set this session.
        let changed = false;
        const next = { ...prev };
        for (const [k, v] of Object.entries(persisted)) {
          if (typeof v === 'number' && next[k] === undefined) {
            next[k] = v;
            changed = true;
          }
        }
        if (!changed) return prev;
        const earliest = Math.min(...Object.values(next));
        setCorrelationsDiscoveredAt((d) => d ?? earliest);
        return next;
      });
    }
  }, [incident]);

  // ── Pivot landing: when arriving via ?correlation=…&focus=… (clicked a
  // chip on another incident's Correlations tab), flash the matching row and
  // scroll to it once the correlations have loaded. The `focus` param is
  // surfaced separately so the originating-incident chip pulses inside the
  // row, making the bidirectional link obvious.
  const focusedReferrerIncidentKey = searchParams.get('focus') || undefined;
  useEffect(() => {
    const targetCorrKey = searchParams.get('correlation');
    if (!targetCorrKey) return;
    if (correlationsLoading) return;
    if (!correlations.some((c) => c.key === targetCorrKey)) return;
    focusCorrelationFromTimeline(targetCorrKey);
    // Run only when the resolved correlations array changes, not on every
    // searchParams tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correlations, correlationsLoading]);



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


  // Fetch per-observable correlations as soon as the incident is loaded.
  // Previously this was gated behind `activeTab === 2` (Observables tab), but
  // the timeline / chat needs these lookups too — without them the IOC red
  // highlight never appears unless the user manually opens Observables. Run
  // eagerly so the timeline lights up correlations on first paint.
  useEffect(() => {
    if (loading) return;
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
      // Normalize to lowercase so case-only duplicates (e.g. an email-body
      // URL with capital letters vs. the backend-lowercased enrichment of
      // the same URL) share a single correlations entry, and so the lookup
      // hits IOC datastore keys which are stored lowercased.
      const lowerValue = String(obs.value || '').toLowerCase();
      const obsKey = `${String(obs.type || '').toLowerCase()}::${lowerValue}`;
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
            key: lowerValue,
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
  }, [loading, editedObservables, enrichments, id]);

  // Re-run correlation lookup for a single observable on demand. Used by the
  // small refresh button next to each observable's "Correlations" header so
  // the user can poke at it without leaving the row.
  const refetchObsCorrelation = useCallback(async (obs: { type: string; value: string }) => {
    if (!obs?.value) return;
    const lowerValue = String(obs.value || '').toLowerCase();
    const obsKey = `${String(obs.type || '').toLowerCase()}::${lowerValue}`;
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
        body: JSON.stringify({ type: 'value', key: lowerValue }),
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
      // Keep top-level title in sync with finding_info_list[0].title so
      // re-fetches (which read ocsf.title first) reflect the edit.
      title: editedTitle,
      desc: editedMessage || editedTitle,
      severity_id: severityOption?.id || 3,
      severity: severityOption?.label || 'Medium',
      status_id: statusId,
      status: statusLabel,
      assignee: editedAssignee.trim() || '',
      types: editedLabels, // OCSF types[] field for labels
      observables: editedObservables,
      stakeholders: editedStakeholders,
      // Mirror references at the top level so the loader's primary path
      // (ocsf.references) reflects edits — finding_info_list[0].references
      // is only the secondary store.
      references: editedReferences,
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
            // Mirror observables here — the loader prefers this path first,
            // so a stale legacy value would otherwise win over the
            // top-level edit.
            observables: editedObservables,
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
            // Suppressed user-facing toast — rapid sequential updates often
            // cause the verify snapshot to lag behind the latest in-memory
            // state, producing false-positive mismatches. Keep the console
            // warning for debugging but do not alarm the user.
            console.warn('[SaveVerify] Mismatch detected in:', issues);
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

  // Load known stakeholders from the users datastore for autocomplete.
  // Uses the real list_cache endpoint via getDatastoreByCategory — the
  // earlier /api/v1/datastores/<category> path was fictional.
  useEffect(() => {
    const loadKnownStakeholders = async () => {
      try {
        const res = await getDatastoreByCategory(DATASTORE_CATEGORIES.USERS);
        if (!res.success || !Array.isArray(res.data)) return;
        const all: Stakeholder[] = [];
        for (const item of res.data) {
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

  const handleAddComment = async (overrideText?: string) => {
    const effectiveText = typeof overrideText === 'string' ? overrideText : newComment;
    if ((!effectiveText.trim() && commentAttachments.length === 0) || !incident?.rawOCSF) return;
    
    autoProgressStatus();
    
    const commentActivity: ActivityItem = {
      id: `comment-${Date.now()}`,
      type: 'comment',
      user: currentUsername,
      timestamp: Date.now(),
      content: effectiveText.trim() || (commentAttachments.length > 0 ? `Attached ${commentAttachments.length} file(s)` : ''),
      details: {},
      attachments: commentAttachments.length > 0 ? [...commentAttachments] : [],
      // Default to unprocessed so AI agents pick up new human comments
      // exactly once. Agents flip this to true after acting on the comment.
      ai_handled: false,
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

    // Move focus to the newly created message instead of leaving it on the comment field.
    const newCommentId = commentActivity.id;
    setTimeout(() => {
      const el = document.getElementById(`activity-item-${newCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Make it focusable then focus, so screen readers/keyboard users land on the new message.
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        try { (el as HTMLElement).focus({ preventScroll: true }); } catch { /* no-op */ }
      }
    }, 50);
    
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
    // No success toast — the new comment renders immediately in the timeline.
    // Demo Mode signal — lets the tour mark "ask the agent" as complete.
    try { window.dispatchEvent(new CustomEvent('demo:incident-comment-sent')); } catch { /* no-op */ }

    // Schedule observable/enrichment refresh ~7s after comment save
    // Backend may extract IOCs from comment text and create enrichments
    if (obsRefreshTimerRef.current) clearTimeout(obsRefreshTimerRef.current);
    setRefreshingObservables(true);
    obsRefreshBaselineRef.current =
      editedObservables.filter(o => !o.archived).length + enrichments.length;
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

  const moveIncidentToTenant = async (targetOrgId: string, updatedValue?: any) => {
    if (!incident?.id) throw new Error('No incident loaded');
    const sourceOrgId = crossOrgId || userInfo?.active_org?.id;
    if (!sourceOrgId) throw new Error('Could not determine source tenant');
    const targetName = subOrgs.find((o) => o.id === targetOrgId)?.name
      || (parentOrg?.id === targetOrgId ? parentOrg.name : undefined)
      || (userInfo?.active_org?.id === targetOrgId ? userInfo.active_org.name : undefined)
      || targetOrgId.slice(0, 8);

    const presentOrgIds = new Set<string>([sourceOrgId, ...sharedOrgs.map((o) => o.id)]);
    let value = updatedValue || incident.rawOCSF || incident;
    if (!value) {
      const fresh = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, sourceOrgId);
      if (fresh?.success && fresh.item?.value) {
        value = typeof fresh.item.value === 'string' ? JSON.parse(fresh.item.value) : fresh.item.value;
      }
    }

    if (targetOrgId !== sourceOrgId) {
      const write = await setDatastoreItem(incident.id, value as object, DATASTORE_CATEGORIES.INCIDENTS, targetOrgId);
      if (!write.success) throw new Error(`Could not write incident to ${targetName}`);
      const check = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, targetOrgId);
      if (!(check?.success && check.item?.value)) throw new Error(`Could not verify incident in ${targetName}`);
    }

    const deleteFailures: string[] = [];
    for (const oldOrgId of presentOrgIds) {
      if (oldOrgId === targetOrgId) continue;
      const deleted = await deleteDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, oldOrgId);
      if (!deleted.success) deleteFailures.push(oldOrgId);
    }
    if (deleteFailures.length > 0) {
      throw new Error(`Incident moved, but ${deleteFailures.length} old tenant copy could not be removed`);
    }

    setSharedOrgs([]);
    if (searchParams.get('shared_orgs')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('shared_orgs');
      setSearchParams(nextParams, { replace: true });
    }
    if (targetOrgId !== sourceOrgId) {
      const activeId = userInfo?.active_org?.id;
      const newKey = targetOrgId === activeId ? incident.id : `${targetOrgId}::${incident.id}`;
      navigate(`${entityBasePath}/${newKey}`, { replace: true });
    }
  };

  const applyRoutingActions = async (actions: RoutingAction[]) => {
    if (!incident?.id || !incident.rawOCSF) return;

    const actionable = actions.filter((a) => a && a.type);
    if (actionable.length === 0) return;

    let nextTitle = editedTitle;
    let nextMessage = editedMessage;
    let nextSeverity = editedSeverity;
    let nextStatus = editedStatus;
    let nextAssignee = editedAssignee;
    let nextLabels = [...editedLabels];
    let nextCustomFields = { ...editedCustomFields };
    let nextActivity = [...activity];
    let nextRaw: any = structuredClone(incident.rawOCSF);
    const moveActions: RoutingAction[] = [];
    let changed = false;

    for (const action of actionable) {
      switch (action.type) {
        case 'suggest_move':
          if (action.targetOrgId) moveActions.push(action);
          break;
        case 'set_severity': {
          const next = normalizeRoutingSeverityValue(action.value);
          if (next && nextSeverity !== next) {
            nextSeverity = next;
            changed = true;
          }
          break;
        }
        case 'set_status': {
          const next = normalizeStatus(action.value);
          if (next && nextStatus !== next) {
            nextStatus = next;
            changed = true;
          }
          break;
        }
        case 'set_priority': {
          const priority = String(action.value || '').trim();
          if (priority) {
            nextRaw.priority = priority;
            changed = true;
          }
          break;
        }
        case 'add_label': {
          const label = String(action.value || '').trim();
          if (label && !nextLabels.includes(label)) {
            nextLabels = [...nextLabels, label];
            changed = true;
          }
          break;
        }
        case 'assign_to': {
          const assignee = String(action.value || '').trim();
          if (assignee && nextAssignee !== assignee) {
            nextAssignee = assignee;
            changed = true;
          }
          break;
        }
        case 'add_comment': {
          const text = String(action.value || '').trim();
          const alreadyPosted = nextActivity.some((it: any) => it?.type === 'comment' && typeof it?.content === 'string' && it.content.trim() === text);
          if (text && !alreadyPosted) {
            nextActivity = [
              ...nextActivity,
              {
                id: `routing-comment-${Date.now()}-${nextActivity.length}`,
                type: 'comment',
                user: 'Incident Routing Rules',
                timestamp: Date.now(),
                content: text,
                details: { source: 'incident_routing_rule' },
                attachments: [],
                ai_handled: true,
              } as ActivityItem,
            ];
            changed = true;
          }
          break;
        }
        case 'set_field': {
          const field = String(action.field || '').trim();
          if (!field) break;
          const value = parseRoutingActionValue(action.value);
          const canonicalField = field.startsWith('rawOCSF.') ? field.slice('rawOCSF.'.length) : field;
          if (canonicalField === 'title') nextTitle = String(value);
          else if (canonicalField === 'description' || canonicalField === 'desc') nextMessage = String(value);
          else if (canonicalField === 'severity') nextSeverity = normalizeRoutingSeverityValue(String(value));
          else if (canonicalField === 'status') nextStatus = normalizeStatus(String(value));
          else if (canonicalField === 'assignee') nextAssignee = String(value);
          else if (canonicalField === 'priority') nextRaw.priority = String(value);
          else if (canonicalField === 'labels' || canonicalField === 'types') {
            const label = String(value).trim();
            if (label && !nextLabels.includes(label)) nextLabels = [...nextLabels, label];
          }
          else if (field.startsWith('rawOCSF.')) setDeepValue(nextRaw, field.slice('rawOCSF.'.length), value);
          else {
            const key = field.replace(/^customFields\./, '').replace(/^custom_fields\./, '');
            nextCustomFields = { ...nextCustomFields, [key]: value };
          }
          changed = true;
          break;
        }
      }
    }

    const severityOption = severityOptions.find((s) => s.value === nextSeverity);
    const { label: statusLabel, id: statusId } = getOCSFStatus(nextStatus);
    const existingFindingInfo = nextRaw?.finding_info_list?.[0] || nextRaw?.finding_info;
    const customAttrs = nextRaw?.metadata?.extensions?.custom_attributes || {};
    const updatedData = {
      ...nextRaw,
      title: nextTitle,
      desc: nextMessage || nextTitle,
      severity_id: severityOption?.id || nextRaw.severity_id || 3,
      severity: severityOption?.label || nextRaw.severity || 'Medium',
      status_id: statusId,
      status: statusLabel,
      assignee: nextAssignee.trim() || '',
      types: nextLabels,
      observables: editedObservables,
      stakeholders: editedStakeholders,
      references: editedReferences,
      tasks,
      activity: nextActivity,
      finding_info_list: [{
        ...existingFindingInfo,
        title: nextTitle,
        types: nextLabels,
        references: editedReferences,
        src_url: editedReferences[0] || '',
      }],
      metadata: {
        ...nextRaw.metadata,
        extensions: {
          ...nextRaw.metadata?.extensions,
          custom_attributes: {
            ...customAttrs,
            tlp: editedTlp,
            assignee: nextAssignee.trim() || '',
            customFields: nextCustomFields,
            stakeholders: editedStakeholders,
            observables: editedObservables,
            priority: nextRaw.priority ?? customAttrs.priority,
          },
        },
      },
    };

    if (changed) {
      const ok = await addItem(incident.id, updatedData);
      if (!ok) throw new Error('Failed to apply routing rule actions');
      if (sharedOrgs.length > 0) {
        await Promise.allSettled(sharedOrgs.map((org) =>
          setDatastoreItem(incident.id, updatedData, DATASTORE_CATEGORIES.INCIDENTS, org.id)
        ));
      }
      setEditedTitle(nextTitle);
      setEditedMessage(nextMessage);
      setEditedSeverity(nextSeverity);
      setEditedStatus(nextStatus);
      setEditedAssignee(nextAssignee);
      setEditedLabels(nextLabels);
      setEditedCustomFields(nextCustomFields);
      setActivity(nextActivity);
      setIncident((prev) => prev ? { ...prev, title: nextTitle, severity: nextSeverity, status: nextStatus, assignee: nextAssignee, labels: nextLabels, customFields: nextCustomFields, activity: nextActivity, rawOCSF: updatedData } : prev);
      setRawJsonText(JSON.stringify(updatedData, null, 2));
      initialValuesRef.current = {
        title: nextTitle,
        message: nextMessage,
        severity: nextSeverity,
        assignee: nextAssignee,
        status: nextStatus,
        tlp: editedTlp,
        references: JSON.stringify(editedReferences),
        observables: JSON.stringify(editedObservables),
        customFields: JSON.stringify(nextCustomFields),
        tasks: JSON.stringify(tasks),
        stakeholders: JSON.stringify(editedStakeholders),
        labels: JSON.stringify(nextLabels),
      };
    }

    for (const action of moveActions) {
      if (action.targetOrgId) {
        await moveIncidentToTenant(action.targetOrgId, updatedData);
      }
    }
    toast.success(`Applied ${actionable.length} routing action${actionable.length === 1 ? '' : 's'}`);
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
    toast.success(t('Incident resolved'));
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
      '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
    },
  };

  const transparentInputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'transparent',
      backgroundImage: 'none',
      '& fieldset': { borderColor: 'hsl(var(--border))' },
      '&:hover fieldset': { borderColor: 'hsl(var(--muted-foreground) / 0.4)' },
      '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
    },
  };

  const renderCustomField = (field: CustomField) => {
    const value = editedCustomFields[field.key];

    const FieldLabel = (
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.75 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'hsl(var(--foreground))',
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: 0.2,
          }}
        >
          {field.name}
        </Typography>
        {field.required && (
          <Typography variant="caption" sx={{ color: 'hsl(var(--destructive))', fontSize: '0.75rem' }}>
            *
          </Typography>
        )}
        <Typography
          variant="caption"
          sx={{ color: 'text.disabled', fontSize: '0.7rem', ml: 'auto' }}
        >
          {field.type}
        </Typography>
      </Box>
    );

    const placeholder = field.description || `Enter ${field.name.toLowerCase()}`;

    const wrap = (input: React.ReactNode) => (
      <Box key={field.key}>
        {FieldLabel}
        {input}
        {field.description && (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.5, color: 'text.secondary', fontSize: '0.7rem' }}
          >
            {field.description}
          </Typography>
        )}
      </Box>
    );

    switch (field.type) {
      case 'text':
        return wrap(
          <TextField
            value={value || ''}
            onChange={(e) => handleCustomFieldChange(field, e.target.value)}
            placeholder={placeholder}
            fullWidth
            size="small"
            sx={inputSx}
          />
        );
      case 'number':
        return wrap(
          <TextField
            type="number"
            value={value ?? ''}
            onChange={(e) => handleCustomFieldChange(field, Number(e.target.value))}
            placeholder={placeholder}
            fullWidth
            size="small"
            sx={inputSx}
          />
        );
      case 'select':
        return wrap(
          <FormControl fullWidth size="small">
            <Select
              value={value || ''}
              displayEmpty
              onChange={(e) => handleCustomFieldChange(field, e.target.value)}
              sx={inputSx['& .MuiOutlinedInput-root']}
              renderValue={(selected) =>
                selected ? (
                  String(selected)
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    Select {field.name.toLowerCase()}
                  </Typography>
                )
              }
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {field.options?.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'date':
        return wrap(
          <TextField
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
          <Box key={field.key}>
            {FieldLabel}
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(value)}
                  onChange={(e) => handleCustomFieldChange(field, e.target.checked)}
                />
              }
              label={
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {value ? 'Enabled' : 'Disabled'}
                </Typography>
              }
              sx={{ color: 'hsl(var(--foreground))', ml: 0 }}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment': return <PersonIcon size={20} />;
      case 'change': return <EditIcon size={20} />;
      case 'status': return <CheckCircleIcon size={20} />;
      case 'assignment': return <PersonIcon size={20} />;
      case 'created': return <AddIcon size={20} />;
      case 'agent': return <AutoFixHighIcon size={20} />;
      default: return <HistoryIcon size={20} />;
    }
  };

  // Agent runs are rendered separately using AgentActivityFeed component

  // Demo-aware self-heal: if loading finished without an incident, the URL
  // looks like a demo focus key, and demo mode is active, recreate the focus
  // incident under a fresh key and navigate the user to it. This avoids the
  // dead-end "Incident not found" screen on tour step 4 when the user clicks
  // a row whose datastore entry was rotated out underneath them.
  useEffect(() => {
    if (loading || incident || demoRecoveryTriedRef.current) return;
    if (!demoActive || isPublicView || !id) return;
    const isDemoFocusKey = /^demo-inc-phish-.*-focus$/.test(id);
    if (!isDemoFocusKey) return;
    demoRecoveryTriedRef.current = true;
    setDemoRecovering(true);
    (async () => {
      try {
        const newKey = await forceCreateSingleDemoIncidentReturningKey();
        if (newKey) {
          // Replace the URL so the back button does not bounce the user back
          // to the dead key.
          navigate(`${entityBasePath}/${newKey}`, { replace: true });
        } else {
          setDemoRecovering(false);
        }
      } catch {
        setDemoRecovering(false);
      }
    })();
  }, [loading, incident, demoActive, isPublicView, id, navigate, entityBasePath]);

  if (loading || demoRecovering) {
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
    const isSupport = userInfo?.support === true;
    return (
      <Box sx={{ p: 4, textAlign: 'center', maxWidth: 900, mx: 'auto' }}>
        <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
          {entitySingular} not found
        </Typography>
        <Button 
          component={Link} 
          to={entityBasePath} 
          variant="outlined" 
          startIcon={<ArrowBackIcon />}
        >
          Back to {entityPlural}
        </Button>
        {isSupport && loadDebug && (
          <Box
            sx={{
              mt: 4,
              textAlign: 'left',
              p: 2,
              border: '1px solid hsl(var(--border))',
              borderRadius: 1,
              bgcolor: 'hsl(var(--muted) / 0.4)',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 1,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontWeight: 600,
              }}
            >
              Support debug — load failure ({loadDebug.stage})
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'hsl(var(--foreground))',
                bgcolor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 1,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(loadDebug, null, 2)}
            </Box>
          </Box>
        )}
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
  // Filter chip rendered in the IncidentSection `actions` slot. Extracted so
  // both call sites (inline + sidebar) get the exact same control.
  const renderTimelineActionsChip = () => {
    if (timelineCollapsed) return null;
    const filterDefs = [
      { key: 'revisions' as const, label: 'Changes', count: revisions.length },
      { key: 'agent' as const, label: 'Agent', count: agentRuns.length },
      { key: 'manual' as const, label: 'Comments', count: activity.length },
      { key: 'tasks' as const, label: 'Tasks', count: visibleTasks.length },
      { key: 'observables' as const, label: 'Observables', count: visibleObservablesCount },
      { key: 'correlations' as const, label: 'Correlations', count: visibleCorrelations.length },
    ];
    const activeCount = filterDefs.filter(f => isFilterActive(f.key)).length;
    const allActive = activeCount === filterDefs.length;
    return (
      <Tooltip title="Filter timeline" arrow>
        <Chip
          icon={<FilterListIcon size={14} style={{ color: 'inherit !important' }} />}
          label={
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <span>Filters</span>
              <Box
                component="span"
                sx={{
                  fontSize: '0.65rem',
                  opacity: 0.8,
                  fontVariantNumeric: 'tabular-nums',
                  px: 0.5,
                  borderRadius: '4px',
                  bgcolor: allActive ? 'transparent' : 'rgba(255, 102, 0, 0.18)',
                  border: allActive ? 'none' : '1px solid rgba(255, 102, 0, 0.35)',
                }}
              >
                {allActive ? 'All' : `${activeCount}/${filterDefs.length}`}
              </Box>
            </Box>
          }
          size="small"
          onClick={(e) => setTimelineFilterAnchor(e.currentTarget)}
          sx={{
            height: 24,
            fontSize: '0.7rem',
            borderRadius: '6px',
            cursor: 'pointer',
            border: '1px solid hsl(var(--border))',
            bgcolor: 'transparent',
            color: 'text.secondary',
            '& .MuiChip-label': { px: 0.875 },
            '&:hover': { bgcolor: 'hsl(var(--muted))' },
          }}
        />
      </Tooltip>
    );
  };

  // Loading spinner shown next to the "Timeline" title in the IncidentSection
  // `badge` slot. Used to indicate revisions are still being fetched.
  const renderTimelineBadge = () =>
    revisionsLoading ? <CircularProgress size={14} sx={{ color: 'hsl(var(--primary))' }} /> : null;

  // Body of the Timeline panel (everything below the header). The header,
  // chevron and collapse behaviour are owned by the surrounding
  // <IncidentSection> at each call site so it stays visually identical to
  // Description / Email Thread / Metadata.
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

      {/* Timeline filters dropdown — single menu replacing the chip row. */}
      <Menu
        anchorEl={timelineFilterAnchor}
        open={Boolean(timelineFilterAnchor)}
        onClose={() => setTimelineFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            minWidth: 220,
          },
        }}
      >
        {([
          { key: 'revisions' as const, label: 'Changes', count: revisions.length },
          { key: 'agent' as const, label: 'Agent', count: agentRuns.length },
          { key: 'manual' as const, label: 'Comments', count: activity.length },
          { key: 'tasks' as const, label: 'Tasks', count: visibleTasks.length },
          { key: 'observables' as const, label: 'Observables', count: visibleObservablesCount },
          { key: 'correlations' as const, label: 'Correlations', count: visibleCorrelations.length },
        ]).map(({ key, label, count }) => {
          const active = isFilterActive(key);
          return (
            <MenuItem
              key={key}
              dense
              onClick={() => toggleTimelineFilter(key)}
              sx={{ fontSize: '0.8rem', gap: 1, py: 0.5 }}
            >
              <Checkbox
                checked={active}
                size="small"
                sx={{
                  p: 0.25,
                  color: 'hsl(var(--border))',
                  '&.Mui-checked': { color: 'hsl(var(--primary))' },
                }}
              />
              <Box sx={{ flex: 1 }}>{label}</Box>
              <Box
                component="span"
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                  ml: 1,
                }}
              >
                {count}
              </Box>
            </MenuItem>
          );
        })}
      </Menu>

      {/* Body content. Collapse is handled by the surrounding IncidentSection. */}
      {/* Bad-data warning — surfaced inside the Timeline so users notice the
          drift right where they would inspect / roll back changes. Triggered
          by the same OCSF-recovery fallback that powers the top-of-page banner. */}
      {ocsfFallbackInfo && !ocsfFallbackDismissed && (() => {
        // Suppress for freshly manually-created incidents — the minimal initial
        // payload often trips the OCSF-missing-fields check, but there is nothing
        // to "roll back" to. If the incident was created within the last 10 min,
        // hide the banner.
        const createdMs = incident?.createdTs || 0;
        if (createdMs && Date.now() - createdMs < 10 * 60 * 1000) return null;
        return true;
      })() && (
        <Box sx={{
          mx: 2,
          mt: 2,
          p: 1.25,
          borderRadius: 2,
          bgcolor: 'hsl(38 92% 50% / 0.10)',
          border: '1px solid hsl(38 92% 50% / 0.40)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
        }}>
          <HistoryIcon size={18} style={{ color: 'hsl(38 92% 50%)', marginTop: '0px' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'hsl(38 92% 50%)', fontWeight: 600, fontSize: '0.78rem' }}>
              Incident data looks broken — consider rolling back
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block', mt: 0.25 }}>
              The latest payload is not valid OCSF. This often happens after a manual edit to the underlying datastore item. The last known-good change
              {ocsfFallbackInfo.revisionTimestamp ? ` is from ${new Date(ocsfFallbackInfo.revisionTimestamp).toLocaleString()}` : ''} — find it under the Changes filter below and restore it.
            </Typography>
            {!isFilterActive('revisions') && (
              <Button
                size="small"
                onClick={() => setActiveTimelineFilters(new Set(['revisions']))}
                sx={{
                  mt: 0.75,
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  color: 'hsl(38 92% 50%)',
                  px: 1,
                  py: 0.25,
                  minHeight: 0,
                  '&:hover': { bgcolor: 'hsl(38 92% 50% / 0.15)' },
                }}
              >
                Show changes
              </Button>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={dismissOcsfFallback}
            aria-label="Dismiss"
            sx={{ color: 'hsl(38 92% 50%)', p: 0.5, '&:hover': { bgcolor: 'hsl(38 92% 50% / 0.15)' } }}
          >
            <CloseIcon size={14} />
          </IconButton>
        </Box>
      )}
      {/* Inline enrichment CTA — mirrors the Observables-tab banner so users
          can enable automatic extraction without leaving the timeline. Shown
          while the incident is fresh, just after a comment, or while the
          user is typing a new comment. */}
      {showEnrichmentInlineCTA && renderEnrichmentInlineCTA()}
      {/* Comment Input */}
      <Box sx={{ p: 2, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: 'hsl(var(--primary) / 0.2)' }}>
            <PersonIcon size={16} style={{ color: 'hsl(var(--primary))' }} />
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
                  bgcolor: 'hsl(var(--primary) / 0.08)',
                  border: '1px solid hsl(var(--primary) / 0.25)',
                }}
              >
                <ReplyIcon size={14} style={{ color: 'hsl(var(--primary))' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--primary))', lineHeight: 1.2 }}>
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
                  <DeleteIcon size={12} />
                </IconButton>
              </Box>
            )}
            {/* Inline help: typing @AIAgent without the "Assign & Escalate"
                background workflow means the agent will never pick up the
                comment. Mirror the enrichment-banner pattern and let users
                enable it inline without leaving the incident. */}
            {!agentReadiness.isLoading
              && !agentReadiness.active
              && /@\s*ai[\s_-]*agent\b/i.test(newComment) && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 1,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                bgcolor: 'rgba(251, 146, 60, 0.08)',
                border: '1px solid rgba(251, 146, 60, 0.18)',
              }}>
                <Typography variant="caption" sx={{ color: '#fb923c', fontWeight: 500, flex: 1, lineHeight: 1.3 }}>
                  AI Agent automation is not active. The "Assign & Escalate" workflow needs to be enabled for the agent to respond to mentions.
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  disabled={agentReadiness.isEnabling}
                  onClick={agentReadiness.enable}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    height: 26,
                    minWidth: 70,
                    bgcolor: '#fb923c',
                    color: '#fff',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#f97316', boxShadow: 'none' },
                  }}
                >
                  {agentReadiness.isEnabling ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : 'Enable'}
                </Button>
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
                minRows={2}
                maxRows={15}
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
                    <AttachFileIcon size={16} />
                  )}
                </IconButton>
              </Tooltip>
              <IconButton
                size="small"
                onClick={() => handleAddComment()}
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
                <SendIcon size={16} />
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
              top: 21,
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
              top: 9,
            },
          },
        }),
      }}>
        {/* Indicator-check loader is now rendered inline under the comment that
            triggered it — see renderIndicatorCheckPlaceholder() inside renderThread().
            Standardised to match the "AI Agent processing" pill so loaders attach
            to the message they relate to instead of floating at the top. */}
        {renderTimelineFeedItems(variant)}
      </Box>
      
    </>
  );

  // Builder for the unified timeline items (revisions + agent runs + comments).
  // Returns an array of JSX nodes (or a single empty-state node).
  const renderTimelineFeedItems = (variant: 'sidebar' | 'inline' = 'sidebar') => {
    type StepKind = 'task-created' | 'task-completed' | 'task-status-changed' | 'observable-added' | 'correlation-found' | 'incident-created' | 'routing-matched';
    type TimelineItem =
      | { type: 'revision'; timestamp: number; data: any; idx: number; parsedCurrent: any; parsedPrevious: any | null }
      | { type: 'agent'; timestamp: number; data: typeof agentRuns[number] }
      | { type: 'manual'; timestamp: number; data: ActivityItem }
      | { type: 'step'; timestamp: number; kind: StepKind; id: string; label: string; detail?: string; count?: number; corrCount?: number; corrObsKeys?: string[]; obsKeys?: string[]; obsType?: string; obsValue?: string };

    const items: TimelineItem[] = [];

    const parsedRevisions = revisions.map((rev) => {
      try {
        return typeof rev.value === 'string' ? JSON.parse(rev.value) : rev.value;
      } catch { return null; }
    });

    // Revisions: when the Changes filter is on, render all revisions.
    // When it's off, we still always render the OLDEST revision as the
    // "Incident created" full-height card so users get the full creation
    // context (title, source, click-to-open email/description) regardless
    // of filter state.
    const revisionsFilterOn = isFilterActive('revisions');
    revisions.forEach((rev, idx) => {
      const isOldest = idx === revisions.length - 1;
      if (!revisionsFilterOn && !isOldest) return;
      // For the "Incident created" item (the oldest revision), prefer the
      // incident's true creation timestamp instead of the revision's `edited`
      // field (see note above about comment ordering).
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

    // Synthetic "Incident created" step — fallback only when there are NO
    // revisions to render the full creation card from.
    if (revisions.length === 0 && incident?.createdTs) {
      const createdTs = normalizeToMs(incident.createdTs);
      if (createdTs > 0) {
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


    if (isFilterActive('agent')) {
      // Skipped runs (workflow-level decision_string.success === false) are
      // hidden from the unified timeline by default because the agent itself
      // never ran — only the routing check did. They become visible when the
      // user has narrowed the timeline to *only* the Agent filter so
      // debugging skipped runs is still possible.
      const onlyAgent = activeTimelineFilters.size === 1 && activeTimelineFilters.has('agent');
      agentRuns.forEach((run) => {
        const skip = getAgentSkipInfo(run);
        if (skip.skipped && !onlyAgent) return;
        const ts = normalizeToMs(run.started_at);
        items.push({ type: 'agent', timestamp: ts, data: run });
      });
    }

    // Routing rule matches — synthetic step pills anchored to incident creation
    // so they appear at the bottom of the (newest-first) timeline. Rides along
    // with the Agent filter since routing decisions are automation events.
    if (isFilterActive('agent') && routingMatches.length > 0) {
      const ts = incident?.createdTs ? normalizeToMs(incident.createdTs) : Date.now();
      routingMatches.forEach((m, i) => {
        const firstAction = m.rule.actions[0];
        const actionLabel = firstAction
          ? `${ACTION_TYPE_LABELS[firstAction.type] || firstAction.type}${firstAction.value ? `: ${firstAction.value}` : ''}`
          : 'no action';
        const more = m.rule.actions.length > 1 ? ` (+${m.rule.actions.length - 1} more)` : '';
        items.push({
          type: 'step',
          kind: 'routing-matched',
          // Stagger by 1ms so multiple matches keep a stable order.
          timestamp: ts + i,
          id: `step-routing-${m.rule.id}`,
          label: `Routing rule matched: ${m.rule.name}`,
          detail: `${actionLabel}${more}`,
        });
      });
    }



    if (isFilterActive('manual')) {
      activity.forEach((item) => {
        items.push({ type: 'manual', timestamp: normalizeToMs(item.timestamp), data: item });
      });
    }

    // ── Step injection ─────────────────────────────────────────────────────
    // Render Tasks, Observables and Correlations as small "step" markers in
    // the timeline so users can see *when* each artefact appeared. These are
    // injected purely on the frontend — no persistence needed. Each artefact
    // type gates on its own filter so the user can hide e.g. observables
    // without also hiding tasks.
    if (isFilterActive('tasks') || isFilterActive('observables') || isFilterActive('correlations')) {
      const fallbackTs = incident?.createdTs ? normalizeToMs(incident.createdTs) : 0;

      // Tasks — creation, status transitions, and completion each produce
      // a step so the user can see exactly when state changed and by whom.
      const laneLabel = (key: string): string =>
        taskStatuses.find((s) => s.key === key)?.label
        || (key === 'done' ? 'Done' : key.replace(/[_-]+/g, ' '));

      if (isFilterActive('tasks')) visibleTasks.forEach((t) => {
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

      if (isFilterActive('observables')) {
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
        // Hide ignored observables from the timeline as well — same source of
        // truth as the Observables tab badge so the counts agree.
        if (isObservableIgnored(o.type, o.value)) return;
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
            // Carry every observable key in the bulk so clicking the pill can
            // scroll the Observables tab to the first row from this burst,
            // not just swap tabs.
            obsKeys: b.entries.map((e) => e.key),
          });
        }
      });
      } // end isFilterActive('observables')

      // Incident-level correlations stay as their own pill (these are
      // shared-attribute matches across other incidents, not per-observable).
      // Per-observable correlations have moved inline onto the observable pill
      // itself so the user can see the match next to the indicator that
      // triggered it instead of as a separate timeline row.
      if (isFilterActive('correlations') && correlationsDiscoveredAt && visibleCorrelations.length > 0) {
        items.push({
          type: 'step',
          kind: 'correlation-found',
          timestamp: correlationsDiscoveredAt,
          id: `step-corr-incident`,
          label: `${visibleCorrelations.length} Correlation${visibleCorrelations.length === 1 ? '' : 's'}`,
          detail: `shared attribute${visibleCorrelations.length === 1 ? '' : 's'} across other incidents`,
          count: visibleCorrelations.length,
        });
      }
    }

    // Newest first. The "Incident created" marker is ALWAYS forced to the
    // bottom of the feed regardless of timestamp — creation is conceptually
    // the first event, even if upstream clock skew or trigger-vs-write gaps
    // make an agent run's `started_at` appear slightly earlier.
    const oldestRevisionIdx = revisions.length - 1;
    const isCreationItem = (it: TimelineItem) =>
      (it.type === 'revision' && it.idx === oldestRevisionIdx) ||
      (it.type === 'step' && it.id === 'step-incident-created');
    items.sort((a, b) => {
      const aCreate = isCreationItem(a);
      const bCreate = isCreationItem(b);
      if (aCreate && !bCreate) return 1;   // creation always goes last
      if (bCreate && !aCreate) return -1;
      return b.timestamp - a.timestamp;     // otherwise newest first
    });

    if (items.length === 0) {
      const allHidden = activeTimelineFilters.size === 0;
      return (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
          gap: 1,
          color: 'text.secondary',
        }}>
          <HistoryIcon size={32} style={{ opacity: 0.5 }} />
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            {allHidden ? 'All timeline filters are turned off' : 'No activity yet'}
          </Typography>
          {allHidden && (
            <Chip
              label="Show all"
              size="small"
              variant="outlined"
              onClick={() => setActiveTimelineFilters(new Set(ALL_TIMELINE_FILTERS))}
              sx={{ height: 22, fontSize: '0.7rem', borderColor: 'rgba(255, 102, 0, 0.5)', color: '#ff6600' }}
            />
          )}
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
        const explicitId = rev?.revision_id || rev?.revisionId || rev?.id;
        const ts = normalizeToMs(rev?.edited ?? rev?.created) || 0;
        const valueHash = cheapHash(stableRevisionValueString(rev?.value));
        return `rev-${explicitId || `${ts}-${valueHash}`}-${it.idx}`;
      }
      if (it.type === 'agent') return `agent-${it.data.execution_id}`;
      if (it.type === 'step') return it.id;
      return it.data.id;
    };
    const getItemLabel = (it: TimelineItem): string => {
      if (it.type === 'revision') {
        if (it.idx === revisions.length - 1 && !isOnlyRevisionsFilter) return 'Incident created';
        return `Change #${revisions.length - it.idx}`;
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
            <ReplyIcon size={14} />
          </IconButton>
        </Tooltip>
      );

      if (item.type === 'revision') {
        const rev = item.data;
        const isLatest = item.idx === 0;
        const isFirst = item.idx === revisions.length - 1;
        const diff = item.parsedPrevious ? computeDiff(item.parsedCurrent, item.parsedPrevious) : null;
        const totalChanges = diff ? diff.added.length + diff.removed.length + diff.changed.length : 0;

        if (!isOnlyRevisionsFilter && !isFirst && diff && totalChanges === 0) return null;

        const showAsCreation = isFirst && !isOnlyRevisionsFilter;
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
            key={itemKey}
            onClick={showAsCreation ? () => {
              // The "Incident created" entry opens the source evidence:
              // Email Thread for email-sourced incidents, otherwise the
              // Description. Always expand the section if it's currently
              // collapsed, then scroll it into view.
              const emailEl = document.querySelector('[data-tour="incident-email-thread"]') as HTMLElement | null;
              const descEl = document.querySelector('[data-tour="incident-description"]') as HTMLElement | null;
              const target = emailEl
                ? { el: emailEl, key: 'shuffle-incident-email-thread-open' }
                : descEl
                  ? { el: descEl, key: 'shuffle-incident-description-open' }
                  : null;
              if (!target) return;
              try {
                const isOpen = localStorage.getItem(target.key) === '1';
                if (!isOpen) {
                  const header = target.el.querySelector(':scope > div') as HTMLElement | null;
                  header?.click();
                }
              } catch { /* ignore */ }
              setTimeout(() => {
                target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 80);
            } : undefined}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'transparent',
              border: '1px solid hsl(var(--border-subtle))',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
              '&:hover': {
                bgcolor: 'hsl(var(--muted) / 0.4)',
                borderColor: 'hsl(var(--border))',
              },
              ...(showAsCreation && { cursor: 'pointer' }),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Avatar sx={{ width: 24, height: 24, bgcolor: 'hsl(var(--muted) / 0.6)' }}>
                <HistoryIcon size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.73rem' }}>
                    {showAsCreation ? 'Incident created' : `Change #${revisions.length - item.idx}`}
                  </Typography>
                  {isLatest && !showAsCreation && (
                    <Chip label="Latest" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.58rem', bgcolor: 'transparent', borderColor: 'hsl(var(--border))', color: 'text.secondary', fontWeight: 600 }} />
                  )}
                  {isFirst && !isLatest && !showAsCreation && (
                    <Chip label="Initial" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.58rem', bgcolor: 'transparent', borderColor: 'hsl(var(--border-subtle))', color: 'text.secondary', fontWeight: 600 }} />
                  )}
                  {totalChanges > 0 && !showAsCreation && (
                    <Chip label={`${totalChanges} change${totalChanges !== 1 ? 's' : ''}`} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.58rem', bgcolor: 'transparent', borderColor: 'hsl(var(--border))', color: 'text.secondary' }} />
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
                    <VisibilityIcon size={14} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {showAsCreation && (initialTitle || initialDescription) && (
              <Box sx={{ mt: 0.75, ml: 4, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {initialTitle && (
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.35 }}>
                    {decodeHtmlEntities(String(initialTitle))}
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
                    {decodeHtmlEntities(String(initialDescription).replace(/<[^>]*>/g, '').trim())}
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
        const run = item.data;
        const status = run.status?.toUpperCase() || '';
        const statusCfg = AGENT_STATUS_CONFIG[status];
        const skip = getAgentSkipInfo(run);
        const accent = skip.skipped ? 'hsl(var(--muted-foreground))' : getRunIconColor(run);
        const title = getRunTitle(run);
        const duration = formatAgentRunDuration(run);
        const timeAgo = run.started_at ? getAgentTimeAgo(run.started_at) : '';
        const exactTs = run.started_at
          ? new Date(normalizeToMs(run.started_at)).toLocaleString()
          : '';
        // Status pill (Skipped / Running / Failed-needs-attention / Needs-attention / clean)
        // is rendered by the shared <AgentRunStatusBadge /> component so the
        // timeline, agent activity list, and drawer all show the same thing.
        return (
          <Box
            key={`agent-${run.execution_id}`}
            data-timeline-compact="true"
            onClick={() => setSelectedAgentRun(run)}
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: 1.5,
              border: skip.skipped
                ? '1px dashed hsl(var(--border))'
                : '1px solid hsl(var(--border))',
              bgcolor: skip.skipped
                ? 'hsl(var(--muted) / 0.2)'
                : 'hsl(var(--card))',
              opacity: skip.skipped ? 0.85 : 1,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
              '&:hover': {
                borderColor: 'hsl(var(--muted-foreground) / 0.4)',
                bgcolor: 'hsl(var(--muted) / 0.3)',
              },
            }}
          >
            {/* Invisible hover target over the rail dot — provides exact timestamp tooltip */}
            {exactTs && (
              <Tooltip title={exactTs} arrow placement="left">
                <Box
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    position: 'absolute',
                    left: -28,
                    top: 0,
                    width: 24,
                    height: 24,
                    cursor: 'help',
                    zIndex: 2,
                  }}
                />
              </Tooltip>
            )}
            <Box sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, opacity: skip.skipped ? 0.6 : 1 }}>
              <AgentIcon size={14} />
            </Box>
            <Typography
              sx={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: skip.skipped ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {title}
            </Typography>
            <AgentRunStatusBadge run={run} skip={skip} statusCfg={statusCfg} compact maxWidth={160} />
            {duration && (
              <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
                · {duration}
              </Typography>
            )}
            {timeAgo && (
              <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', ml: 'auto', flexShrink: 0 }}>
                {timeAgo}
              </Typography>
            )}
            
          </Box>
        );
      }

      if (item.type === 'step') {
        // Compact "step" pill — these are derived events (task created /
        // observable added / correlation found) injected on the frontend so
        // the user can see *when* every artefact appeared on the timeline.
        // Step pills use a single neutral scheme so the timeline reads
        // "here's the sequence of what happened" rather than a colour
        // parade. The icon shape still tells you WHAT happened; only IOC /
        // error pills escape into red below.
        const stepStyle: Record<StepKind, { icon: React.ReactNode }> = {
          'task-created':         { icon: <TaskAltIcon size={12} /> },
          'task-completed':       { icon: <CheckCircleIcon size={12} /> },
          'task-status-changed':  { icon: <ForwardIcon size={12} /> },
          'observable-added':     { icon: <VisibilityIcon size={12} /> },
          'correlation-found':    { icon: <LinkIcon size={12} /> },
          'incident-created':     { icon: <HistoryIcon size={12} /> },
          'routing-matched':      { icon: <CallSplitIcon size={12} /> },
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
            const lower = obsKey.toLowerCase();
            const isIp = lower.startsWith('ip::') || lower.startsWith('ipv4::') || lower.startsWith('ipv6::');
            const isIoc = iocObservableKeys.has(lower);
            // Demo mode: notify the tour when the user clicks an IP pill OR
            // any pill flagged as a Known IOC (the demo guarantees a Known
            // IOC will be present, so we make that the primary click target).
            if (isIp || isIoc) {
              try { window.dispatchEvent(new CustomEvent('demo:timeline-ip-clicked', { detail: { obsKey, isIoc } })); } catch { /* ignore */ }
            }
            // Known IOC pills route the user to the AI agent: prefill an
            // @agent question about the observable instead of just jumping to
            // the Observables tab. Plain (non-IOC) observable pills keep the
            // original "show me where this observable lives" behaviour.
            if (isIoc) {
              askAgentAboutObservable(obsKey);
            } else {
              focusObservableFromTimeline(obsKey);
            }
          };
        } else if (item.kind === 'observable-added' && item.id.startsWith('step-obs-bulk-')) {
          // Bulked observable pills: jump to the Observables tab and scroll
          // to the first observable from this burst so the user lands at the
          // actual content the pill is summarising — not the top of the tab.
          const firstKey = item.obsKeys && item.obsKeys.length > 0 ? item.obsKeys[0] : null;
          pillOnClick = () => focusObservableFromTimeline(firstKey);
        } else if (item.kind === 'correlation-found') {
          // Bulked observable correlations (id prefix `step-corr-obs-bulk-`)
          // can't jump to a single observable row — send the user to the
          // Correlations tab instead.
          if (item.id.startsWith('step-corr-obs-bulk-')) {
            pillOnClick = () => focusCorrelationFromTimeline(null);
          } else if (item.id.startsWith('step-corr-obs-')) {
            const obsKey = item.id.slice('step-corr-obs-'.length).toLowerCase();
            pillOnClick = () => {
              const isIoc = iocObservableKeys.has(obsKey);
              if (isIoc) {
                try { window.dispatchEvent(new CustomEvent('demo:timeline-ip-clicked', { detail: { obsKey, isIoc: true } })); } catch { /* ignore */ }
                askAgentAboutObservable(obsKey);
              } else {
                focusObservableFromTimeline(obsKey);
              }
            };
          } else {
            pillOnClick = () => focusCorrelationFromTimeline(null);
          }
        } else if (item.kind === 'routing-matched') {
          // Scroll to the RoutingRulePreviewBanner so the user can act on the
          // matched rule (apply severity/status, suggest move, etc.).
          pillOnClick = () => {
            const el = document.getElementById('routing-rule-preview-banner');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
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
        // IOC pills override the neutral scheme with the destructive token
        // so the user immediately sees that *this* observable is known-bad.
        const pillColor = isIocPill ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
        const pillBg = isIocPill ? 'hsl(var(--destructive) / 0.08)' : 'transparent';
        const pillBorder = isIocPill ? 'hsl(var(--destructive) / 0.5)' : 'hsl(var(--border-subtle))';
        const pillBgHover = isIocPill ? 'hsl(var(--destructive) / 0.14)' : 'hsl(var(--muted) / 0.5)';
        const pillBorderHover = isIocPill ? 'hsl(var(--destructive) / 0.7)' : 'hsl(var(--border))';

        // Sparse-correlation context strip: when this pill represents a
        // correlation (or an observable that has correlations) and the set
        // of *other* referenced incidents is small (≤2), surface the same
        // recency + severity strip we render on the Correlations tab so the
        // timeline is not just a "something happened" feed but a triage
        // surface — relevance depends on more than just IOC flagging.
        let sparseIncidentRefs: string[] = [];
        if (item.kind === 'correlation-found' && pillObsKey) {
          const corrEntry = obsCorrelations[pillObsKey];
          if (corrEntry?.data?.length) {
            const idsSet = new Set<string>();
            corrEntry.data.forEach((c) => {
              c.ref.forEach((r) => {
                const [cat, key] = r.split('|');
                if (cat !== 'shuffle-security_incidents' || !key) return;
                if (id && key.toLowerCase() === id.toLowerCase()) return;
                idsSet.add(key);
              });
            });
            const ids = Array.from(idsSet);
            if (ids.length > 0 && ids.length < 3) sparseIncidentRefs = ids;
          }
        } else if (item.kind === 'observable-added' && pillObsKey) {
          const corrEntry = obsCorrelations[pillObsKey];
          if (corrEntry?.data?.length) {
            const idsSet = new Set<string>();
            corrEntry.data.forEach((c) => {
              c.ref.forEach((r) => {
                const [cat, key] = r.split('|');
                if (cat !== 'shuffle-security_incidents' || !key) return;
                if (id && key.toLowerCase() === id.toLowerCase()) return;
                idsSet.add(key);
              });
            });
            const ids = Array.from(idsSet);
            if (ids.length > 0 && ids.length < 3) sparseIncidentRefs = ids;
          }
        }

        const pill = (
          <Box
            key={item.id}
            data-timeline-compact="true"
            data-tour={isIocPill ? 'timeline-ioc-pill' : undefined}
            data-ioc-pill={isIocPill ? 'true' : undefined}
            className={isStepHighlighted ? 'incident-new-flash' : undefined}
            onClick={pillOnClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: 1,
              px: 1.25,
              py: 0.5,
              ml: 0.5,
              borderRadius: 999,
              bgcolor: pillBg,
              border: `1px solid ${pillBorder}`,
              maxWidth: '100%',
              minWidth: 0,
              overflow: 'hidden',
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
            <Box sx={{ display: 'flex', alignItems: 'center', color: pillColor, flexShrink: 0 }}>
              {isIocPill ? <WarningAmberIcon size={12} /> : cfg.icon}
            </Box>
            {/* The "Observable" word is redundant — the type chip (URL/IP/…)
                and the IOC badge already convey what this row is. Only render
                the label for non-observable steps that still benefit from a
                short text marker. */}
            {item.label && item.kind !== 'observable-added' && (
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: pillColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {item.label}
              </Typography>
            )}
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
                IOC
              </Typography>
            )}
            {/* "Ask agent →" is only useful when there is room for it. The
                sidebar timeline is too narrow and the affordance overflows
                onto the type chip — only show it in the wide inline view. */}
            {isIocPill && isClickable && variant === 'inline' && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.4,
                  ml: 'auto',
                  pl: 0.5,
                  flexShrink: 0,
                }}
              >
                <AgentIcon size={12} />
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    color: 'hsl(var(--destructive))',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ask agent →
                </Typography>
              </Box>
            )}
            {item.kind === 'observable-added' && item.obsType && item.obsValue ? (
              <>
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    px: 0.6,
                    py: 0.05,
                    borderRadius: 999,
                    bgcolor: 'hsl(var(--muted) / 0.6)',
                    color: 'text.secondary',
                    border: '1px solid hsl(var(--border-subtle))',
                    flexShrink: 0,
                    minWidth: 44,
                    textAlign: 'center',
                  }}
                >
                  {item.obsType}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    color: isIocPill ? 'hsl(var(--destructive))' : 'text.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: '1 1 auto',
                  }}
                  title={item.obsValue}
                >
                  {item.obsValue}
                </Typography>
              </>
            ) : item.detail && (
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: isIocPill ? 'hsl(var(--destructive))' : 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: '1 1 auto',
                }}
                title={item.detail}
              >
                {item.detail}
              </Typography>
            )}
            {item.kind === 'observable-added' && !!item.corrCount && (
              <Tooltip
                title={`${item.corrCount} correlation match${item.corrCount === 1 ? '' : 'es'} — click to view`}
                arrow
              >
                <Typography
                  component="span"
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
                    gap: 0.35,
                    '&:hover': { bgcolor: 'hsl(38 92% 50% / 0.22)' },
                  }}
                >
                  <LinkIcon size={10} />
                  {item.corrCount}
                </Typography>
              </Tooltip>
            )}
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', ml: 'auto', pl: 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {item.timestamp ? formatRelativeTime(item.timestamp) : ''}
            </Typography>
          </Box>
        );

        if (sparseIncidentRefs.length === 0) return pill;
        return (
          <Box key={item.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
            {pill}
            <Box
              sx={{
                ml: 3,
                mr: 0.5,
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                border: `1px dashed ${pillBorder}`,
                bgcolor: 'transparent',
              }}
            >
              <CorrelationContextStrip incidentKeys={sparseIncidentRefs} compact />
            </Box>
          </Box>
        );
      }

      // Manual activity
      const actItem = item.data;
      const isOwnMessage = actItem.user === currentUsername;
      const messageAge = Date.now() - actItem.timestamp;
      const isDeleted = !!actItem.deleted;
      const isStatusActivity = actItem.type === 'status';
      const canDelete = !isDeleted && isOwnMessage && actItem.type === 'comment' && messageAge < 5 * 60 * 1000;
      const timeRemaining = Math.max(0, Math.ceil((5 * 60 * 1000 - messageAge) / 60000));

      // Status activities are system-generated resolution events.
      // They cannot be modified or replied to — render a distinct,
      // resolution-themed badge instead of the comment-style card.
      if (isStatusActivity) {
        return (
          <Box
            key={actItem.id}
            id={actItem.id ? `activity-item-${actItem.id}` : undefined}
            className={!!actItem.id && newlyArrivedActivity.has(actItem.id) ? 'incident-new-flash' : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              bgcolor: 'transparent',
              border: '1px solid hsl(var(--border-subtle))',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
              '&:hover': {
                bgcolor: 'hsl(var(--muted) / 0.4)',
                borderColor: 'hsl(var(--border))',
              },
            }}
          >
            <Avatar sx={{ width: 22, height: 22, bgcolor: 'hsl(var(--muted) / 0.6)', color: 'hsl(var(--muted-foreground))' }}>
              <CheckCircleIcon size={14} />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.73rem', fontWeight: 600, color: 'hsl(var(--foreground))', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Incident resolution
                </Typography>
                <Chip
                  label="System event"
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.58rem',
                    fontWeight: 600,
                    bgcolor: 'transparent',
                    border: '1px solid hsl(var(--border-subtle))',
                    color: 'text.secondary',
                    '& .MuiChip-label': { px: 0.6 },
                  }}
                />
                <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', ml: 'auto' }}>
                  {actItem.user ? `by ${actItem.user} · ` : ''}{formatRelativeTime(actItem.timestamp)}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--foreground))', mt: 0.25, whiteSpace: 'pre-wrap' }}>
                {decodeHtmlEntities(actItem.content || '')}
              </Typography>
            </Box>
          </Box>
        );
      }

      const isActHighlighted = !!actItem.id && newlyArrivedActivity.has(actItem.id);
      return (
        <Box
          key={actItem.id}
          id={actItem.id ? `activity-item-${actItem.id}` : undefined}
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
          {(() => {
            const avatarInfo = resolveUserAvatar(actItem.user, users, (actItem as any).is_agent === true);
            return (
              <Avatar
                src={!isDeleted && avatarInfo.src ? avatarInfo.src : undefined}
                sx={{
                  width: 24,
                  height: 24,
                  bgcolor: isDeleted
                    ? 'hsl(var(--border-subtle))'
                    : avatarInfo.isAgent
                      ? 'hsl(var(--primary) / 0.18)'
                      : actItem.type === 'comment' ? 'rgba(255, 102, 0, 0.2)' : 'rgba(255,255,255,0.08)',
                }}
              >
                {getActivityIcon(actItem.type)}
              </Avatar>
            );
          })()}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
              <UserHoverCard
                username={actItem.user}
                isAgent={(actItem as any).is_agent === true}
              />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                {formatRelativeTime(actItem.timestamp)}
              </Typography>
              {isReply && actItem.replyToLabel && (
                <Chip
                  icon={<ReplyIcon size={11} />}
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
                <CollapsibleContent maxHeight={240} storageKey={`incident-comment-expand::${rawId || ''}::${actItem.id || ''}`}>
                  <MentionText
                    text={(() => {
                      const raw = actItem.content || '';
                      const decoded = /<[a-z][\s\S]*>/i.test(raw) ? htmlToPlainText(raw).trim() : decodeHtmlEntities(raw);
                      // Hide the auto-attached agent context block from the user.
                      // The block is still in the persisted message for the agent.
                      return stripAgentContextBlock(decoded);
                    })()}
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
                </CollapsibleContent>
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
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {actItem.ai_handled === true && userInfo?.support === true && (
                <Tooltip
                  title="Support: ai_handled=true on this comment (the workflow has finished processing it)"
                  arrow
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: 'rgba(156, 90, 242, 0.12)',
                    }}
                  >
                    <AgentIcon size={12} />
                  </Box>
                </Tooltip>
              )}
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
                <DeleteIcon size={12} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      );
    };

    // Render top-level items, threading replies indented underneath. The
    // indent + left rail visually groups the conversation while keeping the
    // outer chronology intact. Threads are recursive — replies-to-replies
    // nest at deeper indent levels.

    // Window during which we keep showing the "AI Agent is responding…" card
    // for an unanswered ai_handled comment. After this we swap to a timed-out
    // indicator so users know the agent didn't get back to them.
    const AI_RESPONSE_TIMEOUT_MS = 2 * 60 * 1000;

    // Reruns the AI Agent for a comment that previously timed out.
    // We keep ai_handled=true (so the agent placeholder stays visible) and
    // append a fresh entry to `rerun_timestamps`. The age used by the
    // loader/timeout logic is derived from the latest rerun timestamp, so
    // the spinner immediately resumes for another full timeout window.
    // Background automation watches `rerun_timestamps` to pick the comment
    // back up — see the assign_escalate workflow.
    const handleRerunAgent = async (commentId: string) => {
      if (!incident?.id || !incident.rawOCSF) return;
      const now = Date.now();

      // Set `ai_handled: false` and append a fresh entry to `rerun_timestamps`.
      // The backend automation ("Assign & Escalate") watches for this and is
      // responsible for flipping `ai_handled` back to `true` once it picks the
      // comment up — we MUST NOT do that flip from the client.
      // The placeholder/timeout logic uses the latest rerun timestamp as the
      // "age" basis, so the spinner immediately resumes for another full
      // timeout window.
      const updatedActivity = activity.map((a) => {
        if (a.id !== commentId) return a;
        const existing = Array.isArray((a as any).rerun_timestamps)
          ? ((a as any).rerun_timestamps as number[])
          : [];
        return {
          ...a,
          ai_handled: false,
          rerun_timestamps: [...existing, now],
        } as ActivityItem;
      });
      setActivity(updatedActivity);
      setAiPlaceholderTick((t) => t + 1);

      try {
        pendingSaveRef.current = true;
        await addItem(incident.id, { ...incident.rawOCSF, activity: updatedActivity });
        toast.success('Re-running AI Agent');
      } catch (err) {
        console.error('[Rerun] Failed to persist rerun:', err);
        toast.error('Failed to re-run AI Agent');
      } finally {
        pendingSaveRef.current = false;
      }
    };

    // Renders a compact inline indicator beneath any activity item that
    // explicitly @-mentions the AI Agent and is still flagged ai_handled.
    // While waiting we show a small spinning loader; once the 2-minute
    // timeout has elapsed we show a muted "timed out" pill instead.
    // Read the agent's currently-enabled tools (set on the Agent Permissions
    // drawer). We surface up to 3 names inline so users can see exactly what
    // capabilities the agent has access to while it's responding. We
    // intentionally DO NOT fall back to a hardcoded demo list — surfacing
    // tool names that were never configured is misleading. If nothing is
    // assigned, we render the indicator without a tools summary.
    const enabledAgentTools: string[] = (() => {
      try {
        return getAssignedAgentTools().map((t) => t.name);
      } catch {
        return [];
      }
    })();
    const formatToolName = (name: string): string =>
      name
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    const buildToolsSummary = (): string => {
      if (enabledAgentTools.length === 0) return '';
      const display = enabledAgentTools.slice(0, 3).map(formatToolName);
      const remaining = enabledAgentTools.length - display.length;
      const list = display.join(', ');
      if (remaining > 0) return `${list} +${remaining} more`;
      return list;
    };
    const toolsSummary = buildToolsSummary();

    const formatRelativeShort = (ms: number): string => {
      if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
      if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
      if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
      return `${Math.floor(ms / 86_400_000)}d ago`;
    };

    const renderAgentProcessingPlaceholder = (
      key: string,
      timedOut: boolean,
      commentId?: string,
      rerunCount: number = 0,
      lastActionTs: number = 0,
    ) => (
      <Box
        key={`ai-processing-${key}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          alignSelf: 'flex-start',
          pl: 0.4,
          pr: 1,
          py: 0.4,
          borderRadius: 999,
          fontSize: '0.7rem',
          background: timedOut ? 'hsl(var(--muted) / 0.4)' : 'var(--agent-gradient-subtle)',
          border: '1px solid',
          borderColor: timedOut ? 'hsl(var(--border))' : 'rgba(156, 90, 242, 0.35)',
          color: timedOut ? 'text.secondary' : 'text.primary',
          maxWidth: '100%',
        }}
      >
        {/* Left-side AI Agent badge — clickable, links to /agents. */}
        <Tooltip title="Open Agent activity" arrow disableInteractive>
          <Box
            component={Link}
            to="/agents"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open Agent activity"
            sx={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'rgba(0, 0, 0, 0.25)',
              color: 'inherit',
              textDecoration: 'none',
              transition: 'background 0.15s ease, transform 0.15s ease',
              '&:hover': {
                background: 'rgba(0, 0, 0, 0.4)',
                transform: 'scale(1.05)',
              },
            }}
          >
            <AgentIcon size={11} style={{ opacity: timedOut ? 0.7 : 1 }} />
          </Box>
        </Tooltip>
        {!timedOut && agentReadiness.active && (
          <CircularProgress
            size={10}
            thickness={6}
            sx={{ color: 'rgba(156, 90, 242, 0.9)', flexShrink: 0 }}
          />
        )}
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.7rem',
            fontWeight: 500,
            color: 'inherit',
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            minWidth: 0,
          }}
        >
          {timedOut ? (
            <>
              <span>AI Agent timed out</span>
              {(rerunCount > 0 || lastActionTs > 0) && (
                <Box
                  component="span"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 400,
                    fontSize: '0.65rem',
                  }}
                >
                  {rerunCount > 0 && `· ${rerunCount} rerun${rerunCount === 1 ? '' : 's'}`}
                  {lastActionTs > 0 && ` · ${formatRelativeShort(Date.now() - lastActionTs)} ago`}
                </Box>
              )}
            </>
          ) : !agentReadiness.active && !agentReadiness.isLoading ? (
            <>
              <span>AI Agent automation is off —</span>
              <Box
                component="button"
                type="button"
                disabled={agentReadiness.isEnabling}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await agentReadiness.enable();
                    toast.success('AI Agent automation enabled');
                    // The original @AIAgent comment was posted while the
                    // automation was off, so the backend never picked it up.
                    // Nudge the activity item (append a rerun_timestamp) so
                    // the now-active "Run workflow" automation fires for it.
                    if (commentId) {
                      try {
                        await handleRerunAgent(commentId);
                      } catch (rerr) {
                        console.warn('[AskAgent] Auto-rerun after enable failed:', rerr);
                      }
                    }
                  } catch {
                    toast.error('Failed to enable AI Agent automation');
                  }
                }}
                sx={{
                  fontWeight: 600,
                  color: 'rgba(236, 81, 124, 0.95)',
                  background: 'transparent',
                  border: 'none',
                  p: 0,
                  cursor: agentReadiness.isEnabling ? 'default' : 'pointer',
                  borderBottom: '1px dashed rgba(236, 81, 124, 0.5)',
                  '&:hover': {
                    color: 'rgba(236, 81, 124, 1)',
                    borderBottomColor: 'rgba(236, 81, 124, 0.9)',
                  },
                }}
              >
                {agentReadiness.isEnabling ? 'Enabling…' : 'Enable now'}
              </Box>
            </>
          ) : toolsSummary ? (
            <>
              <span>Processing using the tools</span>
              <Tooltip
                title={`${enabledAgentTools.map(formatToolName).join(', ')} — click to manage`}
                arrow
                disableInteractive
              >
                <Box
                  component="button"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openAgentDrawer('permissions'); }}
                  sx={{
                    fontWeight: 600,
                    color: 'rgba(236, 81, 124, 0.95)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 220,
                    background: 'transparent',
                    border: 'none',
                    p: 0,
                    borderBottom: '1px dashed rgba(236, 81, 124, 0.5)',
                    cursor: 'pointer',
                    '&:hover': {
                      color: 'rgba(236, 81, 124, 1)',
                      borderBottomColor: 'rgba(236, 81, 124, 0.9)',
                    },
                  }}
                >
                  {toolsSummary}
                </Box>
              </Tooltip>
            </>
          ) : (
            <>
              <span>Answering without tools — limited capability.</span>
              <span style={{ marginLeft: 4 }} />
              <Box
                component="button"
                type="button"
                onClick={(e) => { e.stopPropagation(); openAgentDrawer('permissions'); }}
                sx={{
                  fontWeight: 600,
                  color: 'rgba(236, 81, 124, 0.95)',
                  background: 'transparent',
                  border: 'none',
                  p: 0,
                  borderBottom: '1px dashed rgba(236, 81, 124, 0.5)',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'rgba(236, 81, 124, 1)',
                    borderBottomColor: 'rgba(236, 81, 124, 0.9)',
                  },
                }}
              >
                Assign tools
              </Box>
            </>
          )}
        </Typography>
        {timedOut && commentId && (
          <Box
            component="button"
            onClick={(e) => { e.stopPropagation(); handleRerunAgent(commentId); }}
            sx={{
              ml: 0.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              px: 0.75,
              py: 0.2,
              borderRadius: 999,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--background))',
              color: 'text.primary',
              fontSize: '0.68rem',
              fontWeight: 500,
              cursor: 'pointer',
              lineHeight: 1,
              transition: 'background 0.15s ease, border-color 0.15s ease',
              '&:hover': {
                background: 'hsl(var(--muted) / 0.6)',
                borderColor: 'rgba(156, 90, 242, 0.5)',
              },
            }}
            aria-label="Rerun AI Agent"
          >
            <RefreshIcon size={11} />
            Rerun
          </Box>
        )}
      </Box>
    );

    // Standardised "indicator check running" pill — same shape/placement as the
    // AI Agent processing pill so all in-flight loaders attach BELOW the
    // message that triggered them instead of floating at the top of the feed.
    const renderIndicatorCheckPlaceholder = (key: string) => (
      <Box
        key={`indicator-check-${key}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          alignSelf: 'flex-start',
          pl: 0.4,
          pr: 1,
          py: 0.4,
          borderRadius: 999,
          fontSize: '0.7rem',
          background: 'rgba(255, 102, 0, 0.08)',
          border: '1px solid rgba(255, 102, 0, 0.35)',
          color: 'text.primary',
          maxWidth: '100%',
        }}
      >
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'rgba(0, 0, 0, 0.25)',
            position: 'relative',
          }}
        >
          <FingerprintIcon size={11} style={{ color: 'hsl(var(--muted-foreground))' }} />
        </Box>
        <CircularProgress size={10} thickness={6} sx={{ color: '#ff6600', flexShrink: 0 }} />
        <Typography
          variant="caption"
          sx={{ fontSize: '0.7rem', fontWeight: 500, color: 'inherit', lineHeight: 1 }}
        >
          Checking your message for observables…
        </Typography>
      </Box>
    );

    // Identify the most recent top-level manual comment so the indicator-check
    // pill attaches under the latest user message (which triggered the check).
    const latestManualKey: string | null = (() => {
      const manuals = topLevel.filter((it) => it.type === 'manual');
      if (manuals.length === 0) return null;
      const newest = manuals.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b));
      return getItemKey(newest);
    })();


    // Depth controls the indent rail color/spacing — we cap visual indent at 4
    // levels so deeply-nested threads don't run off the side.
    const renderThread = (
      item: TimelineItem,
      depth: number,
      isReply: boolean,
    ): React.ReactNode => {
      const itemKey = getItemKey(item);
      const replies = repliesByParent.get(itemKey) || [];
      const node = renderItem(item, { isReply });
      if (!node) return null;

      // Show processing/timeout placeholder ONLY when this comment explicitly
      // @-mentions the AI Agent (e.g. @AIAgent / @aiagent / @ai_agent) and is
      // still flagged ai_handled with no agent reply landed yet. Without an
      // explicit mention we render nothing — silence is the right default.
      const isManualActivity = item.type === 'manual';
      const aiHandled = isManualActivity && (item.data as any)?.ai_handled === true;
      const commentText = isManualActivity ? String((item.data as any)?.content || '') : '';
      const mentionsAgent = /@\s*ai[\s_-]*agent\b/i.test(commentText);
      const hasAgentReply = replies.some((r) => {
        if (r.type !== 'manual') return false;
        const u = (r.data as any)?.user || '';
        return /agent|ai\s*agent|aiagent/i.test(u);
      });
      // For age, prefer the most recent rerun timestamp so a "Rerun" click
      // resets the loader window. Falls back to the original comment time.
      const reruns = isManualActivity && Array.isArray((item.data as any)?.rerun_timestamps)
        ? ((item.data as any).rerun_timestamps as number[])
        : [];
      const lastRerun = reruns.length > 0 ? Math.max(...reruns) : 0;
      const ageBasis = lastRerun
        || (isManualActivity ? (item.data as any)?.timestamp : 0)
        || item.timestamp
        || 0;
      const ageMs = isManualActivity ? Date.now() - ageBasis : 0;
      // Show placeholder when the agent is actively handling OR when the user
      // has clicked Rerun (which sets ai_handled=false and adds a timestamp;
      // the backend automation will flip ai_handled back to true shortly).
      const hasPendingRerun = reruns.length > 0;
      // Show processing as soon as a comment that mentions the agent is posted,
      // regardless of whether the backend has flipped ai_handled yet. The backend
      // workflow needs a few seconds to ingest the comment and set ai_handled=true,
      // and we don't want the user staring at silence in the meantime. Once the
      // age exceeds the timeout window we still flip to the timed-out state, and
      // an actual agent reply removes the placeholder entirely.
      const showAgentProcessing = (aiHandled || hasPendingRerun || isManualActivity) && mentionsAgent && !hasAgentReply;
      const isTimedOut = showAgentProcessing && ageMs > AI_RESPONSE_TIMEOUT_MS;

      // Indicator-check pill: attaches under the most recent top-level manual
      // comment whenever a backend indicator scan is running.
      const showIndicatorCheck =
        !isReply
        && isManualActivity
        && itemKey === latestManualKey
        && refreshingObservables
        && enrichmentStatus.active;

      if (replies.length === 0 && !showAgentProcessing && !showIndicatorCheck) return node;

      const cappedDepth = Math.min(depth, 4);
      return (
        <Box key={`thread-${itemKey}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {node}
          <Box
            sx={{
              ml: cappedDepth === 0 ? 4 : 3,
              pl: 2,
              borderLeft: '2px solid rgba(255, 102, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {showIndicatorCheck && renderIndicatorCheckPlaceholder(itemKey)}
            {showAgentProcessing && renderAgentProcessingPlaceholder(
              itemKey,
              isTimedOut,
              (item as any).data?.id,
              reruns.length,
              lastRerun || (isManualActivity ? (item as any).data?.timestamp : 0) || item.timestamp || 0,
            )}
            {replies.map((reply) => renderThread(reply, depth + 1, true))}
          </Box>
        </Box>
      );
    };

    return topLevel.map((item) => renderThread(item, 0, false));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ maxWidth: 1400, width: '100%', marginLeft: 'auto', marginRight: 'auto' }}
    >
      {/* OCSF recovery fallback banner moved into the Timeline section
          (and is dismissible there). Intentionally not shown at the top. */}


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
          <VisibilityIcon size={18} style={{ color: '#3b82f6' }} />
          <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 500 }}>
            Shared view — This incident is read-only.
          </Typography>
        </Box>
      )}

      {/* Support-only audit explaining why a fallback IOC was used. */}
      <DemoFallbackAuditBanner
        visible={
          !isPublicView
          && (userInfo?.support === true || searchParams.get('support') === '1')
          && (
            searchParams.get('demo-fallback') === 'true'
            || !!incident?.rawOCSF?.metadata?.extensions?.custom_attributes?.demoFallback
          )
        }
      />

      {/* If this incident was merged into another one, surface a jump link
          at the top so the analyst is not stuck reading a "dead" case. */}
      {!isPublicView && incident?.id && primaryPointer && (
        <MergedIncidentBanner
          currentIncidentId={incident.id}
          primary={relatedIncidents.primary}
          primaryPointerId={primaryPointer.id}
          loading={relatedIncidents.loading}
          onUnlinked={() => loadIncident(false)}
        />
      )}

      {/* If other incidents were merged INTO this one, list them so the
          analyst can jump back or unmerge from the primary side. */}
      {!isPublicView && incident?.id && (relatedIncidents.linked.length > 0 || relatedIncidents.invisibleCount > 0) && (
        <RelatedIncidentsBanner
          currentIncidentId={incident.id}
          linked={relatedIncidents.linked}
          invisibleCount={relatedIncidents.invisibleCount}
          loading={relatedIncidents.loading}
          onUnlinked={() => loadIncident(false)}
        />
      )}

      {/* Possible duplicates / merge suggestions banner — surfaces past
          incidents that share observables, correlations, or known IOCs with
          the one being viewed. Hidden in the public/read-only view. */}
      {!isPublicView && (
        <MergeCandidatesBanner
          candidates={mergeCandidates.candidates}
          loading={mergeCandidates.loading}
          storageKey={incident?.id ? `merge-candidates::${incident.id}` : undefined}
          onMergeWith={(id) => {
            setMergePreselectedId(id);
            setShowMergeDialog(true);
          }}
        />
      )}

      {/* Routing rule preview — client-side dry-run of `shuffle-security_routing`
          rules against the current incident state. Suggests applying matched
          actions without waiting for the workflow to write back results. */}
      {!isPublicView && incident && (
        <div id="routing-rule-preview-banner">
        <RoutingRulePreviewBanner
          incidentId={incident.id}
          context={{
            title: editedTitle || incident.title,
            description: editedMessage,
            source: incident.source,
            severity: editedSeverity,
            status: editedStatus,
            labels: editedLabels,
            observables: editedObservables,
            stakeholders: editedStakeholders,
            rawOCSF: incident.rawOCSF,
          }}
          onApplyActions={applyRoutingActions}
          onApply={async (patch) => {
            if (patch.severity) {
              setEditedSeverity(patch.severity);
              toast.success(`Severity set to ${patch.severity}`);
            }
            if (patch.status) {
              setEditedStatus(patch.status);
              toast.success(`Status set to ${patch.status}`);
            }
            if (patch.priority) {
              await applyRoutingActions([{ type: 'set_priority', value: patch.priority }]);
            }
            if (patch.assignee) {
              setEditedAssignee(patch.assignee);
              toast.success(`Assigned to ${patch.assignee}`);
            }
            if (patch.addLabel) {
              setEditedLabels((prev) => prev.includes(patch.addLabel!) ? prev : [...prev, patch.addLabel!]);
              toast.success(`Added label "${patch.addLabel}"`);
            }
            if (patch.addComment) {
              // Actually post the comment via the real pipeline instead of
              // showing a toast. This writes to the activity feed and
              // persists to the incident's OCSF record.
              await handleAddComment(patch.addComment);
            }
            if (patch.setField) {
              await applyRoutingActions([{ type: 'set_field', field: patch.setField.field, value: patch.setField.value }]);
            }
          }}
          isActionApplied={(a) => {
            const currentOrgIds = new Set<string>([
              crossOrgId || userInfo?.active_org?.id || '',
              ...sharedOrgs.map((org) => org.id),
            ].filter(Boolean));
            const rawCustomAttrs = incident?.rawOCSF?.metadata?.extensions?.custom_attributes || {};
            switch (a.type) {
              case 'set_severity': return !!a.value && editedSeverity === normalizeRoutingSeverityValue(a.value);
              case 'set_status':   return !!a.value && editedStatus === normalizeStatus(a.value);
              case 'set_priority': return !!a.value && String((incident?.rawOCSF as any)?.priority ?? (rawCustomAttrs as any)?.priority ?? '') === String(a.value);
              case 'add_label':    return !!a.value && editedLabels.includes(a.value);
              case 'assign_to':    return !!a.value && editedAssignee === a.value;
              case 'add_comment': {
                if (!a.value) return false;
                const needle = a.value.trim();
                if (!needle) return false;
                return activity.some((it: any) =>
                  it?.type === 'comment' &&
                  typeof it?.content === 'string' &&
                  it.content.trim() === needle
                );
              }
              case 'suggest_move': return !!a.targetOrgId && currentOrgIds.size === 1 && currentOrgIds.has(a.targetOrgId);
              case 'set_field': {
                if (!a.field) return false;
                const expected = parseRoutingActionValue(a.value);
                const canonicalField = a.field.startsWith('rawOCSF.') ? a.field.slice('rawOCSF.'.length) : a.field;
                if (canonicalField === 'severity') return editedSeverity === normalizeRoutingSeverityValue(String(expected));
                if (canonicalField === 'status') return editedStatus === normalizeStatus(String(expected));
                const actual = canonicalField === 'title' ? editedTitle
                  : canonicalField === 'description' || canonicalField === 'desc' ? editedMessage
                  : canonicalField === 'assignee' ? editedAssignee
                  : canonicalField === 'priority' ? ((incident?.rawOCSF as any)?.priority ?? (rawCustomAttrs as any)?.priority)
                  : canonicalField === 'labels' || canonicalField === 'types' ? editedLabels.includes(String(expected)) ? expected : undefined
                  : a.field.startsWith('rawOCSF.')
                    ? readDeepValue(incident?.rawOCSF, a.field.slice('rawOCSF.'.length))
                    : editedCustomFields[a.field.replace(/^customFields\./, '').replace(/^custom_fields\./, '')];
                return String(actual ?? '') === String(expected ?? '');
              }
              default: return false;
            }
          }}
          onMove={async (targetOrgId) => {
            await moveIncidentToTenant(targetOrgId);
          }}
        />
        </div>
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
        let bannerIcon = <AutoFixHighIcon size={20} />;
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
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
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
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <ArrowBackIcon size={18} />
            <Typography variant="body2">Back to {entityPlural}</Typography>
          </Box>

          {/* Tenant indicator — only shown in multi-tenant environments */}
          {(() => {
            const isMultiTenant = isParentOrg || isCrossOrg;
            if (!isMultiTenant) return null;
            const viewingOrgId = isCrossOrg ? (crossOrgId || '') : (userInfo?.active_org?.id || '');
            if (!viewingOrgId && sharedOrgs.length === 0) return null;
            const seenIds = new Set<string>([viewingOrgId]);
            const uniqueShared = sharedOrgs.filter(o => {
              if (!o?.id || seenIds.has(o.id)) return false;
              seenIds.add(o.id);
              return true;
            });
            const viewingOrg = isCrossOrg
              ? { name: crossOrgInfo?.name || crossOrgId, image: crossOrgInfo?.image as string | undefined }
              : { name: userInfo?.active_org?.name || '', image: userInfo?.active_org?.image };
            const allTenants = [{ id: viewingOrgId, name: viewingOrg.name, image: viewingOrg.image }, ...uniqueShared];
            const total = allTenants.length;
            const openMoveDialog = () => {
              setMoveTargetOrgId('');
              const sourceOrgId = crossOrgId || userInfo?.active_org?.id || '';
              const initial = new Set<string>();
              if (sourceOrgId) initial.add(sourceOrgId);
              for (const so of sharedOrgs) initial.add(so.id);
              setMoveSelectedOrgIds(initial);
              setShowMoveDialog(true);
            };
            const commonChipSx = {
              height: 24,
              fontSize: '0.72rem',
              bgcolor: 'transparent',
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'hsl(var(--muted))' },
            } as const;
            return (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {total > 1 ? (
                  <Tooltip
                    title={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
                        {allTenants.map(t => (
                          <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            {t.image ? <img src={t.image} alt="" style={{ width: 14, height: 14, borderRadius: 3 }} /> : null}
                            <span>{t.name}</span>
                          </Box>
                        ))}
                      </Box>
                    }
                    placement="bottom-end"
                    arrow
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${total} tenants`}
                      onClick={openMoveDialog}
                      sx={commonChipSx}
                    />
                  </Tooltip>
                ) : (
                  <Chip
                    size="small"
                    variant="outlined"
                    avatar={viewingOrg.image ? <img src={viewingOrg.image} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} /> : undefined}
                    label={viewingOrg.name}
                    onClick={openMoveDialog}
                    sx={commonChipSx}
                  />
                )}
              </Box>
            );
          })()}
        </Box>



        <Box sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: 'transparent',
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
              <TaskAltIcon size={28} style={{ color: severityColors[editedSeverity] }} />
            )}
          </Box>

          {/* Title and meta */}
          <Box sx={{ flex: 1, minWidth: 0 }} data-tour="incident-title">
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
                <AccessTimeIcon size={12} />
                {incident.editedTs ? formatTimestamp(incident.editedTs) : formatTimestamp(incident.createdTs)}
              </Typography>

            </Box>
            </Box>
          </Box>

          {/* Right side actions — split into two rows so the title gets more
              breathing room. Top row: Refresh + actions menu. Bottom row:
              loaders + Ask agent. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.75, flexShrink: 0 }}>
            {/* Bottom row group (loaders + Ask agent) — `order: 2` pushes it
                below the top row even though it appears first in the DOM. */}
            <Box sx={{ order: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isSaving && <CircularProgress size={18} />}
            {isResyncing && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, borderRadius: 1, backgroundColor: 'rgba(255, 102, 0, 0.08)', border: '1px solid rgba(255, 102, 0, 0.2)' }}>
                <CircularProgress size={14} sx={{ color: '#ff6600' }} />
                <Typography variant="caption" sx={{ color: '#ff6600', fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1, fontSize: '0.75rem' }}>
                  {incident?.source ? `Resyncing from ${incident.source}…` : 'Resyncing…'}
                </Typography>
              </Box>
            )}
            
            {/* Ask the AI agent — quick popover that posts an @AIAgent comment
                into the Timeline. The existing agent handler picks it up. */}
            <Tooltip title={
              agentReadiness.isLoading
                ? 'Checking AI agent status…'
                : agentReadiness.active
                  ? 'Ask the AI agent'
                  : 'AI agent is not enabled — click to set it up'
            }>
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => setAskAgentAnchor(e.currentTarget)}
                startIcon={<AgentIcon size={14} />}
                endIcon={
                  !agentReadiness.isLoading ? (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: agentReadiness.active
                          ? 'hsl(var(--severity-low))'
                          : 'hsl(var(--severity-medium))',
                        boxShadow: agentReadiness.active
                          ? '0 0 6px hsl(var(--severity-low) / 0.6)'
                          : 'none',
                      }}
                    />
                  ) : undefined
                }
                sx={{
                  height: 32,
                  textTransform: 'none',
                  borderRadius: 1,
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  px: 1.25,
                  background: 'linear-gradient(135deg, rgba(255,133,68,0.08), rgba(236,81,124,0.08), rgba(156,90,242,0.08))',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    background: 'linear-gradient(135deg, rgba(255,133,68,0.16), rgba(236,81,124,0.16), rgba(156,90,242,0.16))',
                  },
                }}
              >
                Ask agent
              </Button>
            </Tooltip>
            <Popover
              open={Boolean(askAgentAnchor)}
              anchorEl={askAgentAnchor}
              onClose={() => { setAskAgentAnchor(null); }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                sx: {
                  mt: 1,
                  width: 380,
                  bgcolor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 2,
                  p: 2,
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AgentIcon size={16} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Ask the AI agent
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', mb: 1.5 }}>
                Your question is posted to the Timeline as @AIAgent and the agent will reply there. Observables, IOC matches, correlations, stakeholders and the top related incidents are auto-attached as context.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => openAgentDrawer('permissions')}
                  sx={{
                    flex: 1,
                    height: 32,
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.06)' },
                  }}
                >
                  Assign tools
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => openAgentDrawer('localLLM')}
                  sx={{
                    flex: 1,
                    height: 32,
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.06)' },
                  }}
                >
                  Choose LLM
                </Button>
              </Box>
              {!agentReadiness.isLoading && !agentReadiness.active && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    p: 1.25,
                    mb: 1.5,
                    borderRadius: 1,
                    border: '1px solid hsl(var(--severity-medium) / 0.4)',
                    bgcolor: 'hsl(var(--severity-medium) / 0.08)',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.25 }}>
                      AI Agent is not enabled
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem', lineHeight: 1.4 }}>
                      {!agentReadiness.hasWorkflow && !agentReadiness.hasCategoryAutomation && !agentReadiness.hasAiAgentAutomation
                        ? 'Neither the "Run AI Agent" automation nor the "Assign & Escalate" workflow is wired up on Incidents.'
                        : !agentReadiness.hasWorkflow
                          ? 'The "Assign & Escalate" workflow is missing.'
                          : 'The incident "Run workflow" automation is not pointing at the agent workflow.'}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={agentReadiness.isEnabling}
                    onClick={async () => {
                      try {
                        await agentReadiness.enable();
                        toast.success('AI Agent enabled');
                      } catch (err: any) {
                        toast.error(err?.message || 'Failed to enable AI Agent');
                      }
                    }}
                    startIcon={agentReadiness.isEnabling ? <CircularProgress size={10} sx={{ color: 'inherit' }} /> : undefined}
                    sx={{
                      height: 28,
                      textTransform: 'none',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      bgcolor: '#ff6600',
                      '&:hover': { bgcolor: '#e65c00' },
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {agentReadiness.isEnabling ? 'Enabling…' : 'Enable'}
                  </Button>
                </Box>
              )}
              {agentReadiness.active ? (
                <>
                  <TextField
                    autoFocus
                    multiline
                    minRows={3}
                    maxRows={8}
                    fullWidth
                    placeholder="What would you like the agent to do? e.g. Summarize this incident, look up the indicators, suggest next steps…"
                    value={askAgentText}
                    onChange={(e) => setAskAgentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && askAgentText.trim() && !askAgentSending && agentReadiness.active) {
                        e.preventDefault();
                        (async () => {
                          setAskAgentSending(true);
                          try {
                            await handleAddComment(`@AIAgent ${askAgentText.trim()}${buildAskAgentContext()}`);
                            setAskAgentText('');
                            setAskAgentAnchor(null);
                            toast.success('Sent to the AI agent');
                          } finally {
                            setAskAgentSending(false);
                          }
                        })();
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.85rem',
                        bgcolor: 'hsl(var(--background))',
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {[
                      { label: 'Summarize', prompt: 'Summarize this incident in a few short bullet points: what happened, who/what is involved, and the current status.' },
                      { label: 'Investigate indicators', prompt: 'Investigate every observable on this incident. Look up reputation, related incidents, and flag anything suspicious.' },
                      { label: 'Suggest next steps', prompt: 'Based on the current state of this incident, suggest the next concrete response steps in priority order.' },
                      { label: 'Draft a response', prompt: 'Draft a response message I can send to the reporter or affected user. Keep it clear, professional, and reassuring.' },
                      { label: 'Assess severity', prompt: 'Assess the severity and potential impact of this incident, and explain the reasoning behind the rating.' },
                      { label: 'Find related incidents', prompt: 'Look for past incidents that share observables, indicators, or patterns with this one and summarize the matches.' },
                    ].map(({ label, prompt }) => (
                      <Chip
                        key={label}
                        label={label}
                        size="small"
                        onClick={() => setAskAgentText(prompt)}
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          bgcolor: 'hsl(var(--muted) / 0.4)',
                          border: '1px solid hsl(var(--border))',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'hsl(var(--muted) / 0.7)' },
                        }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>
                      ⌘/Ctrl + Enter to send
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => { setAskAgentAnchor(null); }}
                        sx={{ height: 32, textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!askAgentText.trim() || askAgentSending || !agentReadiness.active}
                        onClick={async () => {
                          setAskAgentSending(true);
                          try {
                            await handleAddComment(`@AIAgent ${askAgentText.trim()}${buildAskAgentContext()}`);
                            setAskAgentText('');
                            setAskAgentAnchor(null);
                            toast.success('Sent to the AI agent');
                          } finally {
                            setAskAgentSending(false);
                          }
                        }}
                        startIcon={askAgentSending ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <SendIcon size={14} />}
                        sx={{
                          height: 32,
                          textTransform: 'none',
                          fontWeight: 600,
                          bgcolor: '#ff6600',
                          '&:hover': { bgcolor: '#e65c00' },
                        }}
                      >
                        Send
                      </Button>
                    </Box>
                  </Box>
                </>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                  <Button
                    size="small"
                    onClick={() => { setAskAgentAnchor(null); }}
                    sx={{ height: 32, textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
            </Popover>
            </Box>
            {/* Top row group (Refresh + Actions menu). */}
            <Box sx={{ order: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>

            <Tooltip title="Refresh">
              <IconButton 
                size="small"
                onClick={async () => {
                  setIsRefreshing(true);
                  await Promise.all([
                    loadIncident(false),
                    refetchAgentRuns(),
                  ]);
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
                <RefreshIcon size={20} className={isRefreshing ? 'animate-spin' : ''} />
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
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('Share Incident')}</Typography>
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                  {t('Anyone with this link can view the incident without logging in.')}
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
                <MoreVertIcon size={20} />
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
                <LinkIcon size={16} style={{ marginRight: '8px' }} />
                Share
              </MenuItem>
              {/* Generate Report */}
              <MenuItem
                onClick={() => {
                  setActionsMenuAnchor(null);
                  setShowReportDialog(true);
                }}
              >
                <DescriptionIcon size={16} style={{ marginRight: '8px' }} />
                Generate Report
              </MenuItem>
              {/* Visit Source */}
              <Tooltip
                title="No source URL recorded for this incident"
                placement="left"
              >
                <span>
                  <MenuItem disabled sx={{ width: '100%' }}>
                    <LinkIcon size={16} style={{ marginRight: '8px' }} />
                    Visit Source
                  </MenuItem>
                </span>
              </Tooltip>
              <Divider />
              {/* Resync */}
              {(() => {
                const product = incident?.rawOCSF?.product || incident?.rawOCSF?.metadata?.product;
                const productName = product?.name;
                const productId = product?.id;
                const productUid = product?.uid;
                const placeholderProduct = !!(productName && (productName === productId || productName === productUid));
                let resyncReason = '';
                if (isSaving) resyncReason = 'Saving in progress — please wait';
                else if (!incident?.source) resyncReason = 'No source app recorded — cannot resync';
                else if (incident?.source === 'Tenzir') resyncReason = 'Tenzir-ingested incidents cannot be resynced';
                else if (placeholderProduct) resyncReason = 'Source product metadata is incomplete — cannot resync';
                const resyncDisabled = !!resyncReason;
                const resyncItem = (
                  <MenuItem
                    disabled={resyncDisabled}
                    sx={{ width: '100%' }}
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
                    <RefreshIcon size={16} style={{ marginRight: '8px' }} />
                    Resync
                  </MenuItem>
                );
                return resyncDisabled ? (
                  <Tooltip title={resyncReason} placement="left">
                    <span>{resyncItem}</span>
                  </Tooltip>
                ) : resyncItem;
              })()}
              {/* Forward */}
              <Tooltip title="Forwarding is not yet available" placement="left">
                <span>
                  <MenuItem
                    disabled
                    sx={{ width: '100%' }}
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
                    <ForwardIcon size={16} style={{ marginRight: '8px' }} />
                    Forward
                  </MenuItem>
                </span>
              </Tooltip>
              <Divider />
              {/* Merge */}
              <Tooltip title={isSaving ? 'Saving in progress — please wait' : ''} placement="left" disableHoverListener={!isSaving}>
                <span>
                  <MenuItem
                    disabled={isSaving}
                    sx={{ width: '100%' }}
                    onClick={() => {
                      setActionsMenuAnchor(null);
                      setShowMergeDialog(true);
                    }}
                  >
                    <CallMergeIcon size={16} style={{ marginRight: '8px' }} />
                    Merge Into…
                  </MenuItem>
                </span>
              </Tooltip>
              {/* Move to Tenant */}
              <Tooltip title={isSaving ? 'Saving in progress — please wait' : ''} placement="left" disableHoverListener={!isSaving}>
                <span>
                  <MenuItem
                    disabled={isSaving}
                    sx={{ width: '100%' }}
                    onClick={() => {
                      setActionsMenuAnchor(null);
                      setMoveTargetOrgId('');
                      const sourceOrgId = crossOrgId || userInfo?.active_org?.id || '';
                      const initial = new Set<string>();
                      if (sourceOrgId) initial.add(sourceOrgId);
                      for (const so of sharedOrgs) initial.add(so.id);
                      setMoveSelectedOrgIds(initial);
                      setShowMoveDialog(true);
                    }}
                  >
                    <ForwardIcon size={16} style={{ marginRight: '8px' }} />
                    Move to Tenant…
                  </MenuItem>
                </span>
              </Tooltip>
              {!isResolved && <Divider />}
              {!isResolved && (
                <Tooltip title={isSaving ? 'Saving in progress — please wait' : ''} placement="left" disableHoverListener={!isSaving}>
                  <span>
                    <MenuItem
                      disabled={isSaving}
                      sx={{ width: '100%' }}
                      onClick={() => {
                        setActionsMenuAnchor(null);
                        setShowResolveDialog(true);
                      }}
                    >
                      <CheckCircleIcon size={16} style={{ marginRight: '8px', color: '#22c55e' }} />
                      <Box component="span" sx={{ color: '#22c55e' }}>Resolve</Box>
                    </MenuItem>
                  </span>
                </Tooltip>
              )}
            </Menu>

            <IncidentReportDialog
              open={showReportDialog}
              onClose={() => setShowReportDialog(false)}
              overrideOrgId={crossOrgId || undefined}
              generatedBy={currentUsername}
              buildInput={(): GenerateReportInput => ({
                incidentId: incident?.id || id || '',
                title: editedTitle || incident?.title || 'Untitled incident',
                description: editedMessage || '',
                source: incident?.source,
                severity: editedSeverity || incident?.severity,
                status: editedStatus || incident?.status,
                assignee: editedAssignee || incident?.assignee || null,
                created: incident?.created,
                edited: incident?.edited,
                tlp: editedTlp || incident?.tlp,
                pap: incident?.pap,
                labels: editedLabels,
                references: editedReferences,
                customFields: editedCustomFields,
                observables: editedObservables,
                enrichments,
                tasks: visibleTasks,
                activity: activity as any,
                agentRuns: (agentRuns || []) as any,
                rawOCSF: incident?.rawOCSF,
              })}
            />
            </Box>

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
            <SegmentedControl
              layoutId="incident-detail-tabs"
              ariaLabel="Incident sections"
              value={String(activeTab)}
              onChange={(v) => setActiveTab(Number(v))}
              options={[
                { value: '0', label: 'Details', dataTour: 'incident-tab-details' },
                { value: '1', label: 'Tasks', dataTour: 'incident-tab-tasks', count: visibleTasks.length > 0 ? visibleTasks.length : undefined, title: visibleTasks.length > 0 ? `${visibleTasks.filter(t => t.completed).length}/${visibleTasks.length} completed` : undefined },
                { value: '2', label: 'Observables', dataTour: 'incident-tab-observables', count: visibleObservablesCount > 0 ? visibleObservablesCount : undefined },
                { value: '3', label: 'Correlations', dataTour: 'incident-tab-correlations', count: visibleCorrelations.length > 0 ? visibleCorrelations.length : undefined },
              ]}
            />

            {/* Right tab group island: Source → Translation → OCSF */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
              <SegmentedControl
                layoutId="incident-source-tabs"
                ariaLabel="Source data"
                value={String(activeTab === 6 ? 6 : activeTab === 5 ? 5 : activeTab === 4 ? 4 : -1)}
                onChange={(v) => {
                  const next = Number(v);
                  if (next === 4) {
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
                  }
                  setActiveTab(next);
                }}
                options={[
                  ...(unmappedOriginal ? [{ value: '6', label: 'Original', title: 'The raw data before any translation' }] : []),
                  ...(incidentFileRef ? [{ value: '5', label: 'Translation', title: 'The translation file that maps original data to OCSF' }] : []),
                  { value: '4', label: 'OCSF', title: 'The normalized OCSF Incident Finding output' },
                ]}
              />
            </Box>
          </Box>


          {/* Tab Content */}
      <Box sx={isPublicView ? { pointerEvents: 'none', '& input, & textarea, & select, & button:not([data-public-ok])': { opacity: 0.7 } } : {}}>
      {activeTab === 1 && (
        /* Tasks Tab — uses the exact same kanban as the simplified view (/incidents-simple) */
        <TaskKanbanBoard
          tasks={visibleTasks}
          onTasksChange={setTasks}
          incidentId={id || 'new'}
          currentUser={currentUsername || 'You'}
        />
      )}

      {/* Details Tab — kept mounted (just hidden) when other tabs are active
          so local UI state inside it (e.g. EmailThreadPanel collapsed/expanded,
          description view mode) survives a tab switch. */}
      <Box sx={{ display: activeTab === 0 ? 'block' : 'none' }}>
      {(() => {
        const hasEmail = !!incident && isEmailContent(editedMessage || '', rawDescriptionHtml || '', incident.rawOCSF);
        const descriptionBody = (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {hasHtmlDescription && !isEditingDescription && (
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    {(['readable', 'raw'] as const).map((view) => (
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
                {isEditingDescription ? <CheckCircleIcon size={16} /> : <EditIcon size={16} />}
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
          <Box data-tour="incident-description">
            <Section title="Description" icon={DescriptionIcon} defaultOpen={false} storageKey="shuffle-incident-description-open">
              {descriptionBody}
            </Section>
          </Box>
          )}

          {/* Email Thread Panel — shown below Description when email content is detected */}
          {hasEmail && (
            <Box data-tour="incident-description">
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
            </Box>
          )}

          {/* Inline Timeline — the heart of the Details tab. Renders the same
              comment input + unified feed as the right sidebar, but styled
              with a vertical rail so the chronology reads at a glance. */}
          <Box sx={isPublicView ? { pointerEvents: 'none' } : undefined}>
            <IncidentSection
              title="Timeline"
              icon={HistoryIcon}
              
              open={!timelineCollapsed}
              onOpenChange={(o) => setTimelineCollapsed(!o)}
              badge={renderTimelineBadge()}
              actions={renderTimelineActionsChip()}
              bodyPadded={false}
              dataTour="incident-activity-feed"
            >
              {renderTimelinePanel('inline')}
            </IncidentSection>
          </Box>
          </Box>

          {/* ============ RIGHT: Metadata column ============ */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {/* Description on the right — only when an email thread occupies
              the left column. Collapsed by default; users open it for the
              raw / readable / rendered views without losing focus on the
              parsed thread. */}
          {/* Description hidden entirely when an Email Thread is present. */}



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
              {incident?.rawOCSF?.shuffle_execution_id && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Original ingestion execution</Typography>
                    <Typography
                      variant="body2"
                      onClick={() => window.open(`https://shuffler.io/workflows/${incident.rawOCSF.shuffle_execution_id}?execution_id=${incident.rawOCSF.shuffle_execution_id}`, '_blank')}
                      sx={{ color: '#06b6d4', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {String(incident.rawOCSF.shuffle_execution_id)}
                    </Typography>
                  </Box>
                </Box>
              )}
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
                      icon={<LinkIcon size={14} />}
                      onDelete={() => handleRemoveReference(idx)}
                      onClick={() => window.open(ref, '_blank')}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Section>

          {/* Custom Fields — sits directly below Metadata so editable
              org-defined attributes flow naturally after the read-only
              system metadata block. */}
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
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, columnGap: 2.5, rowGap: 2.5, pt: 1, pb: 0.5 }}>
                  {allFields.map((field) => renderCustomField(field))}
                </Box>
              </Section>
            ) : null;
          })()}

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
                    <AccessTimeIcon size={16} style={{ color: metrics?.mttdColor || 'text.secondary' }} />
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
                    <CheckCircleIcon size={16} style={{ color: metrics?.isResolved ? '#22c55e' : (metrics?.mttrColor || 'text.secondary') }} />
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
      </Box>

      {activeTab === 2 && (
        /* Observables Tab */
          <Box sx={{ 
          bgcolor: 'transparent', 
          backgroundImage: 'none',
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5, maxWidth: 360 }}>
                    {enrichmentStatus.checks.map((c) => (
                      <Box key={c.label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <CheckCircleIcon size={13} style={{ color: c.active ? 'hsl(var(--severity-low))' : 'hsl(var(--destructive))' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{c.label}</Typography>
                        </Box>
                        {isSupportUser && (
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', pl: 2.5, lineHeight: 1.3 }}>
                            {c.detail}
                          </Typography>
                        )}
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
                    sx={{ ...transparentInputSx, '& .MuiOutlinedInput-root': { ...(transparentInputSx as any)['& .MuiOutlinedInput-root'], height: 36 } }}
                    error={!!regexWarning}
                    helperText={regexWarning || undefined}
                  />
                  <IconButton onClick={handleAddObservable} disabled={!newObservableValue.trim()} sx={{ width: 36, height: 36, bgcolor: 'transparent', border: '1px solid hsl(var(--border))', alignSelf: regexWarning ? 'flex-start' : 'center', mt: regexWarning ? '4px' : 0, '&:hover': { bgcolor: 'hsl(var(--muted) / 0.35)' } }}>
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
              sx={{ ...transparentInputSx, minWidth: 160, flex: 1, maxWidth: 280, '& .MuiOutlinedInput-root': { ...(transparentInputSx as any)['& .MuiOutlinedInput-root'], height: 36 } }}
              InputProps={{
                startAdornment: <SearchIcon size={16} style={{ color: 'text.disabled', marginRight: '4px' }} />,
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
                    height: 36,
                    fontSize: '0.8rem',
                    bgcolor: 'transparent',
                    backgroundImage: 'none',
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
                height: 36,
                fontSize: '0.75rem',
                bgcolor: 'transparent',
                backgroundImage: 'none',
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
              {obsSortDir === 'desc' ? <ArrowDownwardIcon size={16} /> : <ArrowUpwardIcon size={16} />}
            </IconButton>
            {/* Clear filters */}
            {(obsFilterTypes.length > 0 || obsFilterText || obsSortField !== 'first_seen' || obsSortDir !== 'desc') && (
              <Chip
                label="Clear filters"
                size="small"
                onDelete={() => { setObsFilterTypes([]); setObsFilterText(''); setObsSortField('first_seen'); setObsSortDir('desc'); }}
                sx={{ fontSize: '0.65rem', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', bgcolor: 'transparent', border: '1px solid hsl(var(--border))', '&:hover': { bgcolor: 'hsl(var(--muted) / 0.25)' } }}
              />
            )}
            {/* Show / hide ignored observables — per-org list of indicators
                the user has marked as uninteresting. Hidden by default. */}
            {ignoredObs.ignoredKeys.size > 0 && (
              <Tooltip
                title={showIgnoredObs
                  ? 'Hide observables you have marked as ignored'
                  : 'Reveal observables you have marked as ignored'}
                arrow
              >
                <Chip
                  icon={showIgnoredObs
                    ? <VisibilityIcon size={12} />
                    : <VisibilityOffIcon size={12} />}
                  label={showIgnoredObs
                    ? `Hide ignored (${ignoredObs.ignoredKeys.size})`
                    : `Show ignored (${ignoredObs.ignoredKeys.size})`}
                  size="small"
                  onClick={() => setShowIgnoredObs(s => !s)}
                  sx={{
                    fontSize: '0.65rem',
                    height: 22,
                    cursor: 'pointer',
                    color: showIgnoredObs ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    bgcolor: showIgnoredObs ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                    border: '1px solid',
                    borderColor: showIgnoredObs ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))',
                    '& .MuiChip-icon': { ml: 0.75, mr: -0.25, color: 'inherit' },
                    '&:hover': { bgcolor: showIgnoredObs ? 'hsl(var(--primary) / 0.18)' : 'hsl(var(--muted) / 0.25)' },
                  }}
                />
              </Tooltip>
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
            // Default sort prioritizes: (1) observables flagged as known
            // IOCs, (2) total correlation refs (more matches = more
            // important), (3) the user-selected field/direction (defaults to
            // first_seen desc). This keeps the most actionable rows always
            // at the top regardless of recency.
            const isDefaultSort = obsSortField === 'first_seen' && obsSortDir === 'desc';
            const corrCountFor = (o: any): number => {
              const k = `${o.type}::${o.value}`;
              const c = obsCorrelations[k];
              if (!c?.data?.length) return 0;
              const meaningful = filterMeaningfulCorrelations(c.data, correlationVisibilityOptions);
              return meaningful.reduce(
                (sum, x) => sum + getEffectiveCorrelationCount(x, correlationVisibilityOptions),
                0,
              );
            };
            // Read the cached IOC/correlation rank for this observable, or
            // capture and freeze it on first sight. This is what stops a row
            // from leaping to the top of the list mid-click when its
            // correlation lookup finishes — the rank only updates on an
            // explicit user action that bumps `obsSortRankEpoch`.
            const rankFor = (o: any): { ioc: number; corr: number } => {
              const k = `${o.type}::${o.value}`.toLowerCase();
              const cache = obsSortRankRef.current;
              const cached = cache.get(k);
              if (cached) return cached;
              const fresh = {
                ioc: iocObservableKeys.has(k) ? 1 : 0,
                corr: corrCountFor(o),
              };
              cache.set(k, fresh);
              return fresh;
            };
            // void-read so the linter / reader knows this memo intentionally
            // depends on the epoch counter (the ref itself is mutable).
            void obsSortRankEpoch;
            const allObsRaw = Array.from(deduped.values()).sort((a, b) => {
              if (isDefaultSort) {
                const ar = rankFor(a);
                const br = rankFor(b);
                if (ar.ioc !== br.ioc) return br.ioc - ar.ioc;
                if (ar.corr !== br.corr) return br.corr - ar.corr;
              }
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
              if (!showIgnoredObs && ignoredObs.isIgnored(obs.type, obs.value)) return false;
              return true;
            });

            // Note: we used to render a "Processing observables in the
            // background…" skeleton for any incident created in the last 2
            // minutes. That banner was misleading — no actual background
            // fetch was tied to it, so users (rightly) read it as a stuck
            // loader. Show the real empty state immediately instead.

            if (allObsRaw.length === 0) {
              return (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 4 }}>
                  No observables added. Add IOCs, IPs, domains, hashes, or other indicators.
                </Typography>
              );
            }

            if (allObs.length === 0) {
              return (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 4 }}>
                  No observables match the current filter. {allObsRaw.length} total.
                </Typography>
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
                  const isThisIgnored = ignoredObs.isIgnored(obs.type, obs.value);
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
                        bgcolor: 'transparent',
                        backgroundImage: 'none',
                        border: mismatch ? '1px solid hsl(var(--warning, 38 92% 50%) / 0.35)' : isExpanded ? '1px solid hsl(var(--primary) / 0.35)' : '1px solid hsl(var(--border))',
                        opacity: isThisIgnored ? 0.55 : 1,
                        transition: 'border-color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease',
                        '&:hover': { bgcolor: 'hsl(var(--muted) / 0.25)', borderColor: 'hsl(var(--primary) / 0.25)', opacity: isThisIgnored ? 0.85 : 1 },
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
                            borderColor: mismatch ? 'hsl(var(--warning, 38 92% 50%) / 0.45)' : 'hsl(var(--primary) / 0.4)',
                            color: mismatch ? 'hsl(var(--warning, 38 92% 50%))' : 'hsl(var(--primary))',
                          }}
                        />
                        <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                          {obs.value}
                        </Typography>
                        {/* Correlation badge */}
                        {(() => {
                           const obsKey = `${String(obs.type || '').toLowerCase()}::${String(obs.value || '').toLowerCase()}`;
                           const corr = obsCorrelations[obsKey];
                          if (corr?.loading) return <CircularProgress size={14} sx={{ mx: 0.5 }} />;
                          if (!corr?.data?.length) return null;
                          // Only count correlations with refs OTHER than the current incident.
                          const meaningful = filterMeaningfulCorrelations(corr.data, correlationVisibilityOptions);
                          if (meaningful.length === 0) return null;
                          // Total number of OTHER references across all meaningful
                          // correlations — this is the count the user actually
                          // cares about (e.g. "5 other incidents share this
                          // observable"), not the number of distinct keys.
                          const totalRefs = meaningful.reduce(
                            (sum, c) => sum + getEffectiveCorrelationCount(c, correlationVisibilityOptions),
                            0,
                          );
                          // Highlight the badge in red when ANY correlation
                          // points to a known IOC / threat-feed entry.
                          const iocHit = meaningful.some(hasIocMatch);
                          return (
                            <Tooltip
                              title={
                                iocHit
                                  ? 'This observable matches a known Indicator of Compromise — open to investigate.'
                                  : `${totalRefs} correlation${totalRefs !== 1 ? 's' : ''} found`
                              }
                              arrow
                            >
                              <Chip
                                icon={iocHit ? <WarningAmberIcon size={12} style={{ color: 'hsl(var(--destructive)) !important' }} /> : undefined}
                                label={iocHit ? `${totalRefs} IOC` : `${totalRefs} corr`}
                                size="small"
                                variant="outlined"
                                onClick={(e) => { e.stopPropagation(); setObsCorrelationAnchor({ el: e.currentTarget, obsKey }); }}
                                sx={{
                                  height: 20,
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  bgcolor: iocHit ? 'hsl(var(--destructive) / 0.1)' : 'transparent',
                                  borderColor: iocHit ? 'hsl(var(--destructive) / 0.5)' : 'hsl(var(--primary) / 0.4)',
                                  color: iocHit ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                                  '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
                                  '&:hover': {
                                     bgcolor: iocHit ? 'hsl(var(--destructive) / 0.16)' : 'hsl(var(--primary) / 0.08)',
                                  },
                                }}
                              />
                            </Tooltip>
                          );
                        })()}
                        {firstSeen && (
                          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.55rem', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                            {formatObsTime(firstSeen)}
                          </Typography>
                        )}
                        {/* Ignore / unignore — per-org list of uninteresting
                            observables, persisted in the `ignored-observables`
                            datastore category. Hidden by default in the list. */}
                        {(() => {
                          const isIgn = ignoredObs.isIgnored(obs.type, obs.value);
                          return (
                            <Tooltip title={isIgn ? 'Stop ignoring this observable' : 'Hide this observable from the default view'} arrow>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isIgn) ignoredObs.unignore(obs.type, obs.value);
                                  else ignoredObs.ignore(obs.type, obs.value);
                                }}
                                sx={{
                                  p: 0.5,
                                  color: isIgn ? 'hsl(var(--primary))' : 'text.disabled',
                                  '&:hover': { color: 'hsl(var(--primary))' },
                                }}
                              >
                                {isIgn
                                  ? <VisibilityIcon size={16} />
                                  : <VisibilityOffIcon size={16} />}
                              </IconButton>
                            </Tooltip>
                          );
                        })()}
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
                            <DeleteIcon size={20} />
                          </IconButton>
                        )}
                        {/* Lookup dropdown — pinned to the far right so it
                            always sits at the trailing edge of the row,
                            regardless of which other actions are available. */}
                        <ObservableLookupMenu type={obs.type} value={obs.value} />
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
                            const lowerValue = String(obs.value || '').toLowerCase();
                            const obsKey = `${String(obs.type || '').toLowerCase()}::${lowerValue}`;
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
                                  body: JSON.stringify({ type: 'value', key: lowerValue }),
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
                                        <RefreshIcon size={12} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>No correlations found</Typography>
                                </Box>
                              );
                            }
                            // Drop correlations whose only ref is the current incident itself.
                            const meaningfulCorr = filterMeaningfulCorrelations(corr.data, correlationVisibilityOptions);
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
                                      <RefreshIcon size={12} />
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
                                      <RefreshIcon size={12} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                  {meaningfulCorr.slice(0, 8).map((c, ci) => (
                                    <CorrelationRow
                                      key={c.key || ci}
                                      correlation={c}
                                      currentIncidentId={id}
                                      ignoredObservables={ignoredObs}
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
              const meaningful = filterMeaningfulCorrelations(corr?.data || [], correlationVisibilityOptions);
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
                        ignoredObservables={ignoredObs}
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
          bgcolor: 'transparent', 
          borderRadius: 2, 
          border: '1px solid hsl(var(--border))',
          p: 2.5,
        }}>
          {correlationsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : visibleCorrelations.length === 0 ? (
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
                      '&:hover': { color: 'hsl(var(--primary))', bgcolor: 'hsl(var(--muted))' },
                    }}
                  >
                    <RefreshIcon size={16} />
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
                <LinkIcon size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {visibleCorrelations.length} shared attribute{visibleCorrelations.length !== 1 ? 's' : ''}
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
                        '&:hover': { color: 'hsl(var(--primary))', bgcolor: 'hsl(var(--muted))' },
                      }}
                    >
                      {correlationsLoading
                        ? <CircularProgress size={14} />
                        : <RefreshIcon size={16} />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {/* Correlation list */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...visibleCorrelations]
                  .map((corr, idx) => ({ corr, idx }))
                  .sort((a, b) => {
                    // Rank: known IOC / threat-feed first, then by match count.
                    // Stable on ties via original index.
                    const aIoc = hasIocMatch(a.corr) ? 1 : 0;
                    const bIoc = hasIocMatch(b.corr) ? 1 : 0;
                    if (aIoc !== bIoc) return bIoc - aIoc;
                    const aCount = getEffectiveCorrelationCount(a.corr, correlationVisibilityOptions);
                    const bCount = getEffectiveCorrelationCount(b.corr, correlationVisibilityOptions);
                    if (aCount !== bCount) return bCount - aCount;
                    return a.idx - b.idx;
                  })
                  .map(({ corr, idx }) => (
                  <CorrelationRow
                    key={corr.key || idx}
                    correlation={corr}
                    currentIncidentId={id}
                    ignoredObservables={ignoredObs}
                    focusedIncidentKey={focusedReferrerIncidentKey}
                    className={flashedCorrelationKey === corr.key ? 'incident-new-flash' : undefined}
                  />
                ))}
              </Box>
              {/* The page-level "Known IOC details" card was removed — the
                  Known-IOC URL and its source already render inside the
                  matching CorrelationRow above, so repeating it here was
                  pure duplication. The compact variant inside the per-
                  observable popover (above) still surfaces STIX context
                  on demand. */}
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
                <DescriptionIcon size={18} style={{ color: '#ff6600' }} />
                Raw OCSF
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                <a href="https://schema.ocsf.io/1.7.0/classes/incident_finding" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
                  Incident Finding 2005
                </a>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {revisions.length > 0 && (
                <Select
                  size="small"
                  value={selectedRevisionIdx ?? ''}
                  displayEmpty
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    const rev = revisions[idx];
                    if (rev?.value !== undefined) {
                      try {
                        const payload = typeof rev.value === 'string' ? JSON.parse(rev.value) : rev.value;
                        setRawJsonText(JSON.stringify(payload, null, 2));
                        setSelectedRevisionIdx(idx);
                        toast.success('Change loaded — hit Save to persist');
                      } catch {
                        setRawJsonText(typeof rev.value === 'string' ? rev.value : JSON.stringify(rev.value, null, 2));
                        setSelectedRevisionIdx(idx);
                      }
                    }
                  }}
                  renderValue={() => (
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {revisionsLoading
                        ? 'Loading changes…'
                        : selectedRevisionIdx !== null
                          ? `Viewing change #${revisions.length - selectedRevisionIdx}`
                          : `Load change (${revisions.length})`}
                    </Typography>
                  )}
                  sx={{
                    height: 28,
                    fontSize: '0.75rem',
                    minWidth: 180,
                    '& .MuiSelect-select': { py: 0.5 },
                  }}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
                >
                  {(() => {
                    const parseVal = (v: any) => {
                      if (v === undefined || v === null) return null;
                      if (typeof v === 'string') {
                        try { return JSON.parse(v); } catch { return v; }
                      }
                      return v;
                    };
                    const flatten = (obj: any, prefix = '', out: Record<string, string> = {}) => {
                      if (obj === null || obj === undefined) {
                        out[prefix || '$'] = JSON.stringify(obj);
                        return out;
                      }
                      if (typeof obj !== 'object') {
                        out[prefix || '$'] = JSON.stringify(obj);
                        return out;
                      }
                      if (Array.isArray(obj)) {
                        if (obj.length === 0) out[prefix || '$'] = '[]';
                        obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
                        return out;
                      }
                      const keys = Object.keys(obj);
                      if (keys.length === 0) out[prefix || '$'] = '{}';
                      keys.forEach((k) => flatten(obj[k], prefix ? `${prefix}.${k}` : k, out));
                      return out;
                    };
                    const diffCount = (a: any, b: any) => {
                      const fa = flatten(parseVal(a));
                      const fb = flatten(parseVal(b));
                      const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
                      let added = 0, removed = 0, changed = 0;
                      keys.forEach((k) => {
                        const inA = k in fa, inB = k in fb;
                        if (inA && !inB) removed++;
                        else if (!inA && inB) added++;
                        else if (fa[k] !== fb[k]) changed++;
                      });
                      return { added, removed, changed, total: added + removed + changed };
                    };
                    return revisions.map((rev: any, i: number) => {
                      const ts = normalizeToMs(rev?.edited ?? rev?.created);
                      const label = ts ? new Date(ts).toLocaleString() : `Change ${i + 1}`;
                      // Compare against the previous (older) revision: index i+1
                      const prev = revisions[i + 1];
                      const counts = prev ? diffCount(prev?.value, rev?.value) : null;
                      const isSelected = selectedRevisionIdx === i;
                      return (
                        <MenuItem key={i} value={i} sx={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center', color: 'hsl(var(--primary))' }}>
                              {isSelected ? '✓' : ''}
                            </span>
                            <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                              {i === 0 ? `${label} · latest` : label}
                              {isSelected ? ' · current' : ''}
                            </span>
                          </span>
                          {counts && counts.total > 0 ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
                              {counts.added > 0 && <span style={{ color: 'hsl(142 70% 45%)' }}>+{counts.added} </span>}
                              {counts.removed > 0 && <span style={{ color: 'hsl(0 70% 55%)' }}>-{counts.removed} </span>}
                              {counts.changed > 0 && <span style={{ color: 'hsl(var(--primary))' }}>~{counts.changed}</span>}
                            </span>
                          ) : prev ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>no changes</span>
                          ) : (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>initial</span>
                          )}
                        </MenuItem>
                      );
                    });
                  })()}
                </Select>
              )}
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
                      setSelectedRevisionIdx(null);
                      setRawJsonText(JSON.stringify(parsed, null, 2));
                      loadIncident(false);
                      loadRevisions();
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
          bgcolor: 'rgba(255,255,255,0.02)',
          borderRadius: 2,
          border: '1px solid hsl(var(--border-subtle))',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}>
          <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'hsl(var(--card))', mx: -2, px: 2, py: 1.5, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon size={18} style={{ color: 'primary.main' }} />
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
                <DescriptionIcon size={18} style={{ color: 'primary.main' }} />
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
          <Box sx={{ width: '100%', ...(isPublicView ? { pointerEvents: 'none' } : {}) }}>
            <IncidentSection
              title="Timeline"
              icon={HistoryIcon}
              open={!timelineCollapsed}
              onOpenChange={(o) => setTimelineCollapsed(!o)}
              badge={renderTimelineBadge()}
              actions={renderTimelineActionsChip()}
              bodyPadded={false}
              dataTour="incident-activity-feed"
            >
              {renderTimelinePanel('sidebar')}
            </IncidentSection>
          </Box>
        </Box>
        )}
            </Box>


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
          Change Data
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
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>{t('Forward Incident')}</Typography>
          <IconButton size="small" onClick={() => setShowForwardDialog(false)}>
            <CloseIcon size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {t('Choose a tool to forward this incident to.')}
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
        onClose={() => {
          setShowMergeDialog(false);
          setMergePreselectedId(undefined);
        }}
        currentIncidentId={incident?.id || ''}
        currentIncidentTitle={incident?.title || ''}
        preselectedTargetId={mergePreselectedId}
        onMergeComplete={() => {
          loadIncident(false);
        }}
      />

      {/* Move to Tenant Dialog — copies the incident into the chosen tenant
          then deletes it from the current one, and navigates to the new one. */}
      {/* Manage tenants dialog — writes the incident into every selected
          tenant (verifying each write) then removes it from any tenants that
          were unchecked. Deletions only happen after all adds are verified. */}
      <Dialog
        open={showMoveDialog}
        onClose={() => { if (!isMoving) setShowMoveDialog(false); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' } }}
      >
        <DialogTitle sx={{ color: 'hsl(var(--foreground))' }}>Move to Tenant</DialogTitle>
        <DialogContent>
          {(() => {
            const sourceOrgId = crossOrgId || userInfo?.active_org?.id || '';
            const activeId = userInfo?.active_org?.id || '';
            // Build the full candidate list — every tenant the user could
            // place this incident in. Preserve current presence (source +
            // sharedOrgs) so a partial catalog never hides an existing copy.
            // Build a name lookup from every known tenant source first so
            // even the currently-viewed tenant (which may only be present as
            // a raw id from the URL) resolves to a friendly name.
            const nameLookup = new Map<string, string>();
            if (userInfo?.active_org?.id) nameLookup.set(userInfo.active_org.id, userInfo.active_org.name || userInfo.active_org.id);
            if (parentOrg) nameLookup.set(parentOrg.id, parentOrg.name || parentOrg.id);
            for (const so of subOrgs) nameLookup.set(so.id, so.name || so.id);
            for (const so of sharedOrgs) nameLookup.set(so.id, so.name || so.id);
            if (crossOrgId && crossOrgInfo?.name) nameLookup.set(crossOrgId, crossOrgInfo.name);

            const seen = new Set<string>();
            const candidates: { id: string; name: string }[] = [];
            const addCandidate = (id: string, fallback?: string) => {
              if (!id || seen.has(id)) return;
              seen.add(id);
              candidates.push({ id, name: nameLookup.get(id) || fallback || id });
            };
            if (sourceOrgId) addCandidate(sourceOrgId);
            for (const so of sharedOrgs) addCandidate(so.id, so.name);
            if (activeId) addCandidate(activeId, userInfo?.active_org?.name);
            if (parentOrg) addCandidate(parentOrg.id, parentOrg.name);
            for (const so of subOrgs) addCandidate(so.id, so.name);

            const presentSet = new Set<string>();
            if (sourceOrgId) presentSet.add(sourceOrgId);
            for (const so of sharedOrgs) presentSet.add(so.id);

            const selectedCount = moveSelectedOrgIds.size;
            const noneSelected = selectedCount === 0;

            return (
              <>
                <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 2 }}>
                  {presentSet.size > 1
                    ? `This incident exists in ${presentSet.size} tenants. Check every tenant it should live in — additions are written and verified first, and unchecked tenants are only removed afterwards.`
                    : 'Select every tenant this incident should live in. New tenants are written and verified first; unchecked tenants are only removed afterwards.'}
                </Typography>
                {candidates.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    No other tenants available.
                  </Typography>
                ) : (
                  <Autocomplete
                    multiple
                    size="small"
                    disableCloseOnSelect
                    disabled={isMoving}
                    options={candidates}
                    value={candidates.filter(c => moveSelectedOrgIds.has(c.id))}
                    getOptionLabel={(opt) => opt.name}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_e, next) => {
                      setMoveSelectedOrgIds(new Set(next.map(n => n.id)));
                    }}
                    renderOption={(props, opt, { selected }) => (
                      <li {...props} key={opt.id}>
                        <Checkbox size="small" checked={selected} sx={{ p: 0.5, mr: 1 }} />
                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {opt.name}
                          </Typography>
                          {presentSet.has(opt.id) && (
                            <Chip size="small" label="Currently here" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }} />
                          )}
                        </Box>
                      </li>
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((opt, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return (
                          <Chip
                            key={key}
                            {...tagProps}
                            size="small"
                            label={opt.name}
                            sx={{
                              height: 22,
                              fontSize: '0.72rem',
                              bgcolor: presentSet.has(opt.id) ? 'hsl(var(--muted))' : 'hsl(var(--primary) / 0.15)',
                              color: 'hsl(var(--foreground))',
                            }}
                          />
                        );
                      })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tenants"
                        placeholder={moveSelectedOrgIds.size === 0 ? 'Search tenants…' : ''}
                      />
                    )}
                    slotProps={{ popper: { sx: { zIndex: 9999 } } }}
                  />
                )}
                {noneSelected && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'hsl(var(--destructive))' }}>
                    Select at least one tenant — an incident must live somewhere.
                  </Typography>
                )}
              </>
            );
          })()}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button
              onClick={() => setShowMoveDialog(false)}
              disabled={isMoving}
              sx={{ textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={isMoving || !incident?.id || moveSelectedOrgIds.size === 0}
              onClick={async () => {
                if (!incident?.id) return;
                const sourceOrgId = crossOrgId || userInfo?.active_org?.id;
                if (!sourceOrgId) { toast.error('Could not determine source tenant'); return; }

                const presentSet = new Set<string>();
                presentSet.add(sourceOrgId);
                for (const so of sharedOrgs) presentSet.add(so.id);

                const selected = moveSelectedOrgIds;
                const toAdd: string[] = [];
                const toRemove: string[] = [];
                for (const id of selected) if (!presentSet.has(id)) toAdd.push(id);
                for (const id of presentSet) if (!selected.has(id)) toRemove.push(id);

                if (toAdd.length === 0 && toRemove.length === 0) {
                  toast.info('No changes to apply');
                  setShowMoveDialog(false);
                  return;
                }

                setIsMoving(true);
                try {
                  const selectedList = Array.from(selected);
                  const selectedSet = new Set(selectedList);
                  const removeSet = new Set(toRemove);
                  const activeId = userInfo?.active_org?.id;

                  // Safety: never issue a request against an org that isn't
                  // explicitly in toAdd or toRemove. In particular, never
                  // touch the current active org unless it's one of those.
                  const overlap = [...selectedSet].filter(o => removeSet.has(o));
                  if (overlap.length > 0) {
                    throw new Error('Internal conflict in tenant selection — aborted');
                  }
                  console.log('[MoveTenant] intent', {
                    incidentId: incident.id,
                    sourceOrgId,
                    activeOrgId: activeId,
                    toAdd,
                    toRemove,
                  });

                  // Grab the payload we'll write to new tenants. Prefer the
                  // already-loaded incident so we do NOT fire an extra read
                  // just to move it.
                  let value: any = incident.rawOCSF || incident;
                  if (toAdd.length > 0 && !value) {
                    const fresh = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, sourceOrgId);
                    if (fresh?.success && fresh.item?.value) {
                      try {
                        value = typeof fresh.item.value === 'string' ? JSON.parse(fresh.item.value) : fresh.item.value;
                      } catch { value = fresh.item.value; }
                    }
                  }

                  // 1) Add to new tenants FIRST (safer: if writes fail we
                  //    haven't destroyed the source copy yet).
                  const addedOk: string[] = [];
                  const addFailures: string[] = [];
                  for (const targetOrgId of toAdd) {
                    if (removeSet.has(targetOrgId)) {
                      throw new Error(`[MoveTenant] refused add to removed tenant ${targetOrgId}`);
                    }
                    console.log(`[MoveTenant] add -> ${targetOrgId}`);
                    let written = false;
                    try {
                      const wr = await setDatastoreItem(incident.id, value as object, DATASTORE_CATEGORIES.INCIDENTS, targetOrgId);
                      written = !!wr.success;
                    } catch { written = false; }
                    if (written) addedOk.push(targetOrgId); else addFailures.push(targetOrgId);
                  }

                  // 2) Verify each addition (one read per added tenant).
                  const missingTargets: string[] = [];
                  for (const targetOrgId of toAdd) {
                    try {
                      const check = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, targetOrgId);
                      if (!(check?.success && check.item?.value)) missingTargets.push(targetOrgId);
                    } catch { missingTargets.push(targetOrgId); }
                  }

                  // If any add failed OR verification came up empty, ABORT
                  // before deleting anything. This preserves the source copy
                  // so the user can retry / roll back manually.
                  if (addFailures.length > 0 || missingTargets.length > 0) {
                    console.error('[MoveTenant] add phase failed — skipping deletes', { addFailures, missingTargets });
                    toast.error(
                      `Add failed for ${(addFailures.length || missingTargets.length)} target tenant(s) — old copies were NOT deleted so you can retry`
                    );
                    setIsMoving(false);
                    return;
                  }

                  // 3) Now delete from old tenants (only reached if all adds
                  //    landed and verified).
                  const removedOk: string[] = [];
                  const removeFailures: string[] = [];
                  for (const oldOrgId of toRemove) {
                    if (selectedSet.has(oldOrgId)) {
                      throw new Error(`[MoveTenant] refused delete on selected tenant ${oldOrgId}`);
                    }
                    console.log(`[MoveTenant] delete -> ${oldOrgId}`);
                    let deleted = false;
                    try {
                      const dr = await deleteDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, oldOrgId);
                      deleted = !!dr.success;
                    } catch { deleted = false; }
                    if (deleted) removedOk.push(oldOrgId); else removeFailures.push(oldOrgId);
                  }

                  // 4) Verify each deletion (one read per removed tenant).
                  const stillPresent: string[] = [];
                  for (const oldOrgId of toRemove) {
                    try {
                      const check = await getDatastoreItem(incident.id, DATASTORE_CATEGORIES.INCIDENTS, oldOrgId);
                      if (check?.success && check.item?.value) stillPresent.push(oldOrgId);
                    } catch { /* ignore */ }
                  }
                  if (stillPresent.length > 0) {
                    console.error('[MoveTenant] delete not honored by backend', stillPresent);
                    toast.error(`Incident still present in ${stillPresent.length} old tenant(s) — backend did not delete (new copies are live, safe to retry delete)`);
                  }







                  if (removeFailures.length > 0) {
                    toast.error(`Removed from ${removedOk.length}/${toRemove.length} tenants — could not delete from ${removeFailures.length}`);
                  } else if (toAdd.length > 0 && toRemove.length > 0) {
                    toast.success(`Incident moved — added to ${toAdd.length}, removed from ${toRemove.length}`);
                  } else if (toAdd.length > 0) {
                    toast.success(`Incident added to ${toAdd.length} tenant${toAdd.length === 1 ? '' : 's'}`);
                  } else {
                    toast.success(`Incident removed from ${toRemove.length} tenant${toRemove.length === 1 ? '' : 's'}`);
                  }

                  setShowMoveDialog(false);

                  // Refresh local presence state so the header banner and
                  // the next open of this dialog reflect the new tenant set
                  // without needing a page reload.
                  // `activeId` was already computed above for validation.
                  const stayingOrgId = toRemove.includes(sourceOrgId)
                    ? ((activeId && selected.has(activeId)) ? activeId : Array.from(selected)[0])
                    : sourceOrgId;
                  const knownOrgLookup = new Map<string, { id: string; name: string; image?: string }>();
                  if (userInfo?.active_org) knownOrgLookup.set(userInfo.active_org.id, { id: userInfo.active_org.id, name: userInfo.active_org.name || userInfo.active_org.id, image: userInfo.active_org.image });
                  if (parentOrg) knownOrgLookup.set(parentOrg.id, { id: parentOrg.id, name: parentOrg.name || parentOrg.id, image: (parentOrg as any).image });
                  for (const so of subOrgs) knownOrgLookup.set(so.id, { id: so.id, name: so.name || so.id, image: (so as any).image });
                  for (const so of sharedOrgs) knownOrgLookup.set(so.id, { id: so.id, name: so.name || so.id, image: so.image });
                  const nextSharedOrgs = Array.from(selected)
                    .filter(oid => oid !== stayingOrgId)
                    .map(oid => knownOrgLookup.get(oid) || { id: oid, name: oid.slice(0, 8) + '…' });
                  setSharedOrgs(nextSharedOrgs);

                  // Strip the stale shared_orgs URL param so a later reload
                  // doesn't seed the old presence set back into state.
                  if (searchParams.get('shared_orgs')) {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete('shared_orgs');
                    setSearchParams(nextParams, { replace: true });
                  }

                  // Navigate away if the current tenant is no longer in the
                  // selection. Prefer active tenant if it still holds a copy,
                  // otherwise the first selected tenant.
                  if (toRemove.includes(sourceOrgId)) {
                    if (stayingOrgId) {
                      const newKey = stayingOrgId === activeId ? incident.id : `${stayingOrgId}::${incident.id}`;
                      navigate(`${entityBasePath}/${newKey}`, { replace: true });
                    } else {
                      navigate(entityBasePath, { replace: true });
                    }
                  }
                } catch (err: any) {
                  console.error('[MoveTenant] failed', err);
                  toast.error(err?.message || 'Move failed');
                } finally {
                  setIsMoving(false);
                }
              }}
              sx={{
                textTransform: 'none',
                bgcolor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
              }}
            >
              {isMoving ? 'Applying…' : 'Apply'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

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

      {/* Agent execution drawer — opened when clicking an agent row in the timeline */}
      <AgentExecutionDrawer
        open={!!selectedAgentRun}
        onClose={() => setSelectedAgentRun(null)}
        run={selectedAgentRun}
        onSchedule={handleScheduleAgentRun}
      />
    </motion.div>
  );
};

export default IncidentDetailPage;
