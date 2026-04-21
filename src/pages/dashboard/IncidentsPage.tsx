import { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEntityLabel, useShowAutomation } from '@/hooks/useEntityLabel';
import AppSearchDrawer from '@/components/shared/AppSearchDrawer';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Tooltip,
  Checkbox,
  Autocomplete,
  Alert,
  Dialog,
  DialogContent,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { motion } from 'framer-motion';
import { normalizeStatus } from '@/config/incidentConfig';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { useDemo, TOUR_STEPS } from '@/context/DemoContext';
import { useSubOrgs } from '@/hooks/useSubOrgs';
import { useUsers } from '@/hooks/useUsers';
import { DATASTORE_CATEGORIES, getDatastoreByCategory, getDatastoreItem, setDatastoreItem, setDatastoreItems, CategoryAutomation, deleteDatastoreItem, deleteDatastoreItems } from '@/services/datastore';
import { CreateIncidentDialog, ActivityItem } from '@/components/incidents/CreateIncidentDialog';
import { OCSFIncidentFinding, Observable, TLP_LABELS, convertLegacyTlp, mapOCSFSeverity, mapOCSFStatus } from '@/config/ocsfIncidentSchema';
import { deduplicateTasks, decodeHtmlEntities } from '@/lib/utils';
import { ResolveIncidentDialog, ResolutionData, RESOLUTION_REASONS } from '@/components/incidents/ResolveIncidentDialog';
import { CategoryAutomationsDialog } from '@/components/incidents/CategoryAutomationsDialog';
import { extractValidatedIngestionApps, ValidatedIngestionApp, findIngestTicketsWorkflow, findForwardTicketsWorkflow, extractWorkflowAppNames, normalizeAppName, isWorkflowScheduleStopped } from '@/lib/ingestionDetection';
import { API_CONFIG, getApiUrl, getAuthHeader, isDevEnvironment } from '@/config/api';
import DownloadIcon from '@mui/icons-material/Download';
import { IncidentCardView } from '@/components/incidents/IncidentCardView';
import { IncidentStatsCards } from '@/components/incidents/IncidentStatsCards';
import { IncidentsEmptyState } from '@/components/incidents/IncidentsEmptyState';
import { IngestionSourceButton } from '@/components/incidents/IngestionSourceButton';
import { WebhookIngestionButton, WebhookIngestionInfo } from '@/components/incidents/WebhookIngestionButton';
import { IncidentTrendChart } from '@/components/incidents/IncidentTrendChart';
import { OrgTrendChart } from '@/components/incidents/OrgTrendChart';
import { SourceTrendChart } from '@/components/incidents/ToolTrendChart';

import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover as RadixPopover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { toast } from 'sonner';
import { resyncState } from '@/lib/resyncState';
import { trackPredefinedEvent, GA_EVENTS } from '@/lib/analytics';
import { ensureDefaultsInitialized } from '@/lib/initDefaults';

// Legacy categories for migration
const LEGACY_ALERTS_CATEGORY = 'shuffle-alerts';
const LEGACY_SECURITY_ALERTS_CATEGORY = 'shuffle-security_alerts';
const MIGRATION_KEY = 'shuffle_incidents_migrated_v1';

const toRawIncidentKey = (key: string): string => {
  if (!key?.includes('::')) return key;
  const parts = key.split('::').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : key;
};

const migrateToIncidents = async (): Promise<number> => {
  if (localStorage.getItem(MIGRATION_KEY)) return 0;

  try {
    let allItems: { key: string; value: string }[] = [];

    const oldAlerts = await getDatastoreByCategory(LEGACY_ALERTS_CATEGORY);
    if (oldAlerts.success && oldAlerts.data?.length) {
      allItems = [...allItems, ...oldAlerts.data.map(item => ({ key: item.key, value: item.value }))];
    }

    const securityAlerts = await getDatastoreByCategory(LEGACY_SECURITY_ALERTS_CATEGORY);
    if (securityAlerts.success && securityAlerts.data?.length) {
      allItems = [...allItems, ...securityAlerts.data.map(item => ({ key: item.key, value: item.value }))];
    }

    if (allItems.length === 0) {
      localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
      return 0;
    }

    const result = await setDatastoreItems(allItems, DATASTORE_CATEGORIES.INCIDENTS);
    if (result.success) {
      localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
      return allItems.length;
    }
    return 0;
  } catch (err) {
    console.error('Migration failed:', err);
    return 0;
  }
};

interface TaskItem {
  id: string;
  assignee?: string;
  completed?: boolean;
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
  originCreatedTs?: number;
  edited?: string;
  editedTs?: number;
  tlp?: string;
  pap?: string;
  references?: string[];
  observables?: Observable[];
  relatedFindings?: string[];
  rawOCSF?: OCSFIncidentFinding;
  taskCount?: number;
  tasks?: TaskItem[];
  labels?: string[];
  orgId?: string;
  orgName?: string;
  orgImage?: string;
  sharedOrgs?: Array<{ orgId: string; orgName: string; orgImage?: string }>;
}

type SortDirection = 'asc' | 'desc';
type SortKey = 'title' | 'severity' | 'status' | 'assignee' | 'created' | 'edited';

// Status and severity colors now imported from shared config
import { statusConfig, severityColors, severityOrder } from '@/config/incidentConfig';

/**
 * Normalize any timestamp (Unix seconds, ms, µs, ns, ISO string, numeric string) to ms epoch.
 */
const normalizeToMs = (timestamp: number | string | undefined): number => {
  if (!timestamp) return 0;

  // ISO / date string (contains non-digit chars like '-', 'T', ':')
  if (typeof timestamp === 'string' && /[^0-9.]/.test(timestamp)) {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  // Numeric (or numeric string)
  const ts = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  if (isNaN(ts) || ts <= 0) return 0;

  // Distinguish by magnitude:
  //   seconds:      < 1e12   (up to ~33658 AD)
  //   milliseconds: < 1e15   (up to ~33658 AD)
  //   microseconds: < 1e18
  //   nanoseconds:  >= 1e18
  if (ts < 1e12) return ts * 1000;       // seconds → ms
  if (ts < 1e15) return ts;              // already ms
  if (ts < 1e18) return ts / 1000;       // microseconds → ms
  return ts / 1e6;                        // nanoseconds → ms
};

const formatTimestamp = (timestamp: number | string | undefined): string => {
  const ms = normalizeToMs(timestamp);
  if (!ms) return 'Unknown';
  const date = new Date(ms);
  if (isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const parseTimestamp = (timestamp: number | string | undefined): number => {
  return normalizeToMs(timestamp);
};

// Helper to check if an assignee is the AI Agent
const isAIAssignee = (assignee: string | null | undefined): boolean => {
  if (!assignee) return false;
  const lower = assignee.toLowerCase();
  return lower.includes('agent') || lower === 'ai' || lower === 'ai agent';
};

// Strict check: only return string if it has meaningful non-whitespace content
const meaningfulString = (val: unknown): string | undefined => {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (trimmed.length === 0 || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return decodeHtmlEntities(trimmed);
};

/**
 * Resolve the "created" timestamp for an incident.
 * Priority: value.created_time → item.created (datastore envelope).
 */
const resolveCreatedTs = (data: any, itemCreated?: number): number => {
  // Prefer created_time from the incident value (OCSF field)
  if (data?.created_time) {
    const ct = typeof data.created_time === 'string' && /^\d+$/.test(data.created_time)
      ? Number(data.created_time) : data.created_time;
    const ms = normalizeToMs(ct);
    if (ms > 0) return ms;
  }
  // Fallback to datastore envelope created
  return normalizeToMs(itemCreated);
};

const MAX_INCIDENT_VALUE_LENGTH = 5_000_000; // 5MB safety limit per item

const parseIncidentFromDatastore = (item: { key: string; value: string; created?: number; edited?: number }): DisplayIncident | null => {
  try {
    // Skip items with excessively large values to prevent JSON parse hangs/crashes
    if (item.value && item.value.length > MAX_INCIDENT_VALUE_LENGTH) {
      console.warn(`[Incidents] Skipping oversized incident ${item.key} (${(item.value.length / 1024 / 1024).toFixed(1)}MB)`);
      // Return a minimal stub so the incident is still visible in the list
      return {
        id: item.key,
        title: `[Large incident – ${(item.value.length / 1024 / 1024).toFixed(1)}MB]`,
        source: 'unknown',
        severity: 'medium',
        status: 'new',
        assignee: null,
        created: item.created ? formatTimestamp(item.created) : 'Unknown',
        createdTs: item.created ? parseTimestamp(item.created) : 0,
        originCreatedTs: item.created ? parseTimestamp(item.created) : 0,
        taskCount: 0,
        tasks: [],
        labels: [],
      };
    }

    const data = JSON.parse(item.value);
    
    // Check if this is new OCSF format (has finding_uid at root)
    const isNewFormat = 'finding_uid' in data && 'title' in data;
    // Check if legacy OCSF format (has finding_info_list or finding_info)
    const isLegacyOCSF = data.finding_info_list || data.finding_info || data.severity_id !== undefined;
    
    // Extract tasks from various possible locations
    const getTasks = (ocsf: any): TaskItem[] => {
      const tasks = ocsf?.tasks || 
        ocsf?.metadata?.extensions?.custom_attributes?.tasks ||
        [];
      return Array.isArray(tasks) ? tasks : [];
    };
    
    if (isNewFormat) {
      // New OCSF format
      const ocsf = data as OCSFIncidentFinding;
      const customAttrs = ocsf.metadata?.extensions?.custom_attributes;
      const tlpValue = customAttrs?.tlp;
      const tlpLabel = typeof tlpValue === 'number' ? TLP_LABELS[tlpValue]?.label : undefined;
      const tasks = getTasks(data);
      
      // Get raw assignee
      const rawAssignee = customAttrs?.assignee || null;
      
      return {
        id: item.key, // Always use datastore key as the canonical ID
        title: meaningfulString(ocsf.title) || meaningfulString(ocsf.supporting_data) || meaningfulString(ocsf.desc),
        source: meaningfulString(ocsf.product?.name) || meaningfulString(ocsf.types?.[0]),
        severity: mapOCSFSeverity(ocsf.severity_id || 3),
        status: normalizeStatus(ocsf.status || mapOCSFStatus(ocsf.status_id || 1)),
        assignee: rawAssignee,
        created: formatTimestamp(resolveCreatedTs(data, item.created)),
        createdTs: resolveCreatedTs(data, item.created),
        originCreatedTs: resolveCreatedTs(data, item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: tlpLabel,
        references: ocsf.references,
        observables: customAttrs?.observables,
        relatedFindings: ocsf.related_events,
        rawOCSF: ocsf,
        taskCount: deduplicateTasks(tasks).length,
        tasks,
        labels: Array.isArray(ocsf.types) ? ocsf.types : [],
      };
    } else if (isLegacyOCSF) {
      // Legacy OCSF format with finding_info_list
      const legacyData = data as any;
      const findingInfo = legacyData.finding_info_list?.[0] || legacyData.finding_info;
      const customAttrs = legacyData.metadata?.extensions?.custom_attributes;
      const tlp = customAttrs?.tlp || legacyData.tlp;
      const pap = customAttrs?.pap || legacyData.pap;
      const tasks = getTasks(legacyData);
      
      return {
        id: item.key, // Always use datastore key as the canonical ID
        title: meaningfulString(findingInfo?.title) || meaningfulString(legacyData.supporting_data) || meaningfulString(legacyData.desc) || meaningfulString(legacyData.message),
        source: meaningfulString(legacyData.metadata?.product?.name) || meaningfulString(findingInfo?.types?.[0]),
        severity: mapOCSFSeverity(legacyData.severity_id),
        status: normalizeStatus(legacyData.status || mapOCSFStatus(legacyData.status_id)),
        assignee: legacyData.assignee || null,
        created: formatTimestamp(resolveCreatedTs(legacyData, item.created)),
        createdTs: resolveCreatedTs(legacyData, item.created),
        originCreatedTs: resolveCreatedTs(legacyData, item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: typeof tlp === 'string' ? tlp : (tlp ? TLP_LABELS[tlp]?.label : undefined),
        pap,
        references: findingInfo?.references,
        observables: legacyData.observables,
        relatedFindings: legacyData.related_findings,
        rawOCSF: legacyData,
        taskCount: deduplicateTasks(tasks).length,
        tasks,
      };
    } else {
      // Non-OCSF format
      const tasks = data.tasks || [];
      return {
        id: item.key, // Always use datastore key as the canonical ID
        title: meaningfulString(data.title) || meaningfulString(data.supporting_data) || meaningfulString(data.desc) || meaningfulString(data.message),
        source: meaningfulString(data.source),
        severity: (data.severity || 'medium').toLowerCase(),
        status: normalizeStatus(data.status),
        assignee: data.assignee || null,
        created: formatTimestamp(resolveCreatedTs(data, item.created)),
        createdTs: resolveCreatedTs(data, item.created),
        originCreatedTs: resolveCreatedTs(data, item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: data.tlp,
        pap: data.pap,
        references: data.references,
        observables: data.observables,
        rawOCSF: undefined,
        taskCount: Array.isArray(tasks) ? deduplicateTasks(tasks).length : 0,
        tasks: Array.isArray(tasks) ? tasks : [],
      };
    }
  } catch {
    return null;
  }
};

interface Filters {
  severity: string | null;
  status: string | string[] | null;
  tlp: string | null;
  assignee: string | null;
  source: string | null;
  tag: string | null;
  org: string[] | null;
}

const IncidentsPage = () => {
  const { plural: entityPlural, singular: entitySingular, basePath: entityBasePath } = useEntityLabel();
  const showAutomation = useShowAutomation();
  const { userInfo } = useAuth();
  const currentUsername = userInfo?.username || '';
  const isSupport = userInfo?.support === true;
  const { users, loading: usersLoading } = useUsers();
  const currentOrgId = userInfo?.active_org?.id;
  const currentOrgName = userInfo?.active_org?.name || 'Current';
  const isChildOrg = !!userInfo?.active_org?.creator_org;
  const { subOrgs, parentOrg, isParentOrg: hasRelatedOrgs } = useSubOrgs(currentOrgId);
  // Only show multi-tenant view when we have sub-orgs to show (not just a parent)
  const isParentOrg = subOrgs.length > 0;

  const [searchParams, setSearchParams] = useSearchParams();
  // Default child orgs to showing only their own incidents immediately
  const [filters, setFilters] = useState<Filters>(() => ({
    severity: null, status: null, tlp: null, assignee: null, source: null, tag: null,
    org: isChildOrg && currentOrgId ? [currentOrgId] : null,
  }));
  const [negatedFilters, setNegatedFilters] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [automationsDialogOpen, setAutomationsDialogOpen] = useState(false);
  const [categoryAutomations, setCategoryAutomations] = useState<CategoryAutomation[]>([]);
  // Ref mirror so callbacks can read the latest value without being recreated
  const categoryAutomationsRef = useRef<CategoryAutomation[]>([]);
  useEffect(() => { categoryAutomationsRef.current = categoryAutomations; }, [categoryAutomations]);
  const [ingestionApps, setIngestionApps] = useState<ValidatedIngestionApp[]>([]);
  const [forwardApps, setForwardApps] = useState<ValidatedIngestionApp[]>([]);
  const [ingestWorkflowId, setIngestWorkflowId] = useState<string | null>(null);
  const [forwardWorkflowId, setForwardWorkflowId] = useState<string | null>(null);
  const [ingestScheduleStopped, setIngestScheduleStopped] = useState(false);
  const [webhookIngestion, setWebhookIngestion] = useState<WebhookIngestionInfo>({ url: null, exists: false, enabled: false, workflowId: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingApps, setIsUpdatingApps] = useState(false);
  const [isUpdatingForwardApps, setIsUpdatingForwardApps] = useState(false);
  const [ingestionLoading, setIngestionLoading] = useState(true);
  const ingestionLoadedOnceRef = useRef(false);
  const pendingTogglesRef = useRef<Map<string, boolean>>(new Map());
  const pendingForwardTogglesRef = useRef<Map<string, boolean>>(new Map());
   const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const forwardDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const [appSearchOpen, setAppSearchOpen] = useState(false);
   const [forwardAppSearchOpen, setForwardAppSearchOpen] = useState(false);
   // Fake auth experience for the demo "add-outlook" step. Holds the app
   // metadata while we show a brief "Connecting…" dialog before injecting
   // the app into the Ingest row.
   const [fakeAuth, setFakeAuth] = useState<{ name: string; image: string } | null>(null);
   // Optimistically-injected ingestion apps from the demo flow (e.g. Outlook
   // Office365 after fake auth). Merged with the real list for rendering.
   const [demoInjectedApps, setDemoInjectedApps] = useState<ValidatedIngestionApp[]>([]);

   // ─── Demo tour gating ─────────────────────────────────────────────────────
   // While the demo tour is open and on the "add-outlook" step, we strip the
   // automation row down to the bare minimum: webhook + the highlighted "+"
   // button. Existing ingest icons, the arrow, and the entire Forward section
   // are hidden so the user can't be distracted from the one click we want.
   const { active: demoActive, drawerOpen: demoDrawerOpen, step: demoStep, markStepCompleted } = useDemo();
   const demoStepId = TOUR_STEPS[demoStep]?.id;
   const isAddOutlookStep = demoActive && demoDrawerOpen && demoStepId === 'add-outlook';
   // Whenever the demo tour drawer is open, hide the arrow and the entire
   // Forward section so users stay focused on the ingestion flow.
   const isDemoTourActive = demoActive && demoDrawerOpen;

   // Hover state for automation sections (state-based to survive popover portals)
   const [ingestHovered, setIngestHovered] = useState(false);
   const [forwardHovered, setForwardHovered] = useState(false);
   const ingestHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const forwardHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

   const handleIngestEnter = useCallback(() => {
     if (ingestHoverTimer.current) clearTimeout(ingestHoverTimer.current);
     setIngestHovered(true);
   }, []);
   const handleIngestLeave = useCallback(() => {
     ingestHoverTimer.current = setTimeout(() => setIngestHovered(false), 300);
   }, []);
   const handleForwardEnter = useCallback(() => {
     if (forwardHoverTimer.current) clearTimeout(forwardHoverTimer.current);
     setForwardHovered(true);
   }, []);
   const handleForwardLeave = useCallback(() => {
     forwardHoverTimer.current = setTimeout(() => setForwardHovered(false), 300);
   }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResolveDialogOpen, setBulkResolveDialogOpen] = useState(false);
  const [isBulkResolving, setIsBulkResolving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Sorting
  const [sortBy, setSortBy] = useState<SortKey>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { items: datastoreItems, isLoading, isRefreshing, hasFetched, error, lastDiagnostics, fetchItems, addItem, hasMore, fetchNextPage, categoryConfig, totalAmount } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });

  const supportIncidentDebugRows = useMemo<Array<[string, string]>>(() => {
    if (!isSupport || !error) return [];

    const fallbackRequestUrl = currentOrgId
      ? getApiUrl(`/api/v1/orgs/${currentOrgId}/list_cache?category=${encodeURIComponent(DATASTORE_CATEGORIES.INCIDENTS)}&top=100`)
      : 'Unknown';

    return [
      ['Hook error', error],
      ['Org', currentOrgId ? `${currentOrgName} (${currentOrgId})` : currentOrgName],
      ['API base', API_CONFIG.baseUrl],
      ['Request URL', lastDiagnostics?.url || fallbackRequestUrl],
      ['HTTP', lastDiagnostics?.status != null ? `${lastDiagnostics.status}${lastDiagnostics.statusText ? ` ${lastDiagnostics.statusText}` : ''}` : 'No status captured'],
      ['Failure stage', lastDiagnostics?.errorStage || 'unknown'],
      ['Content-Type', lastDiagnostics?.contentType || 'unknown'],
      ['Response shape', lastDiagnostics?.responseShape || 'unknown'],
      ['Items parsed', lastDiagnostics?.itemCount != null ? String(lastDiagnostics.itemCount) : 'n/a'],
      ['Page state', `hasFetched=${hasFetched}, loading=${isLoading}, refreshing=${isRefreshing}, cachedItems=${datastoreItems.length}`],
    ];
  }, [isSupport, error, currentOrgId, currentOrgName, lastDiagnostics, hasFetched, isLoading, isRefreshing, datastoreItems.length]);

  useEffect(() => {
    if (!isSupport || !error) return;

    console.error('[IncidentsPage] Failed to load incidents', {
      error,
      orgId: currentOrgId ?? null,
      orgName: currentOrgName,
      apiBaseUrl: API_CONFIG.baseUrl,
      diagnostics: lastDiagnostics,
      pageState: {
        hasFetched,
        isLoading,
        isRefreshing,
        cachedItems: datastoreItems.length,
      },
    });
  }, [isSupport, error, currentOrgId, currentOrgName, lastDiagnostics, hasFetched, isLoading, isRefreshing, datastoreItems.length]);

  // Sub-org incident fetching for multi-tenant view
  const [subOrgItems, setSubOrgItems] = useState<Map<string, { orgName: string; orgImage?: string; items: typeof datastoreItems }>>(new Map());
  const [subOrgLoading, setSubOrgLoading] = useState<Set<string>>(new Set());
  const [subOrgFailed, setSubOrgFailed] = useState<Set<string>>(new Set());

  // Fetch incidents from all sub-orgs in parallel
  // Only fetch child orgs when we ARE a parent. Don't fetch parent org incidents
  // when we're in a child org — the parent API returns child incidents too, causing duplicates.
  const fetchSubOrgIncidents = useCallback(async () => {
    // Only fetch sub-orgs (children), never the parent org
    const orgsToFetch = subOrgs.filter(o => o.id !== currentOrgId);
    if (orgsToFetch.length === 0) return;

    const loadingIds = new Set(orgsToFetch.map(o => o.id));
    setSubOrgLoading(loadingIds);
    setSubOrgFailed(new Set());

    // Fetch each org independently so results stream in as they complete
    orgsToFetch.forEach(async (org) => {
      try {
        const useRegionUrl = org.region_url && !isDevEnvironment();
        const baseUrl = useRegionUrl ? org.region_url!.replace(/\/+$/, '') : '';
        const url = baseUrl
          ? `${baseUrl}/api/v1/orgs/${org.id}/list_cache?category=${encodeURIComponent(DATASTORE_CATEGORIES.INCIDENTS)}&top=100`
          : getApiUrl(`/api/v1/orgs/${org.id}/list_cache?category=${encodeURIComponent(DATASTORE_CATEGORIES.INCIDENTS)}&top=100`);
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
            'Org-Id': org.id,
          },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.keys || data.data || []);
        setSubOrgItems(prev => {
          const next = new Map(prev);
          next.set(org.id, { orgName: org.name, orgImage: org.image, items });
          return next;
        });
      } catch {
        setSubOrgFailed(prev => new Set(prev).add(org.id));
        setSubOrgItems(prev => {
          const next = new Map(prev);
          next.set(org.id, { orgName: org.name, orgImage: org.image, items: [] });
          return next;
        });
      } finally {
        setSubOrgLoading(prev => {
          const next = new Set(prev);
          next.delete(org.id);
          return next;
        });
      }
    });
  }, [subOrgs, parentOrg, currentOrgId]);

  // Fetch other org incidents when multi-tenant view is available
  useEffect(() => {
    if (isParentOrg) {
      fetchSubOrgIncidents();
    }
  }, [isParentOrg, fetchSubOrgIncidents]);

  // Auto-select all orgs when filter is empty and multi-tenant view is available
  useEffect(() => {
    if (isParentOrg && (!filters.org || (Array.isArray(filters.org) && filters.org.length === 0))) {
      const allIds = [
        currentOrgId || '',
        ...subOrgs.filter(o => o.id !== currentOrgId).map(o => o.id),
      ];
      setFilters(prev => ({ ...prev, org: allIds }));
    }
  }, [isParentOrg, filters.org, currentOrgId, subOrgs]);


  const validUsernames = useMemo(() => {
    return new Set(users.map(u => u.username.toLowerCase()));
  }, [users]);

  useEffect(() => {
    const init = async () => {
      // Ensure default Threat Feeds & IOC Types exist for this org
      ensureDefaultsInitialized();
      const migratedCount = await migrateToIncidents();
      if (migratedCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      await fetchItems();
    };
    init();
  }, [fetchItems]);

  // Update category automations when categoryConfig changes
  useEffect(() => {
    if (categoryConfig?.automations) {
      setCategoryAutomations(categoryConfig.automations);
    }
  }, [categoryConfig]);

  // Fetch ingestion apps — workflows are the source of truth for enabled state
  const fetchIngestionApps = useCallback(async () => {
    if (!ingestionLoadedOnceRef.current) {
      setIngestionLoading(true);
    }
    try {
      const [authResponse, workflowsResponse] = await Promise.all([
        fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
        fetch(getApiUrl('/api/v1/workflows'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
      ]);

      if (authResponse.ok) {
        const result = await authResponse.json();
        const authApps = Array.isArray(result) ? result : (result.data || []);

        // Derive enabled apps from the Ingest Tickets workflow actions
        let workflowAppNames: Set<string> | undefined;
        let forwardAppNames: Set<string> | undefined;
        if (workflowsResponse.ok) {
          const workflows = await workflowsResponse.json();
          const workflowList = Array.isArray(workflows) ? workflows : (workflows.workflows || []);
          const ingestWorkflow = findIngestTicketsWorkflow(workflowList);
          if (ingestWorkflow) {
            const scheduleStopped = isWorkflowScheduleStopped(ingestWorkflow);
            setIngestScheduleStopped(scheduleStopped);
            // If schedule is stopped, treat as no enabled sources
            if (!scheduleStopped) {
              workflowAppNames = extractWorkflowAppNames(ingestWorkflow);
            }
            setIngestWorkflowId(ingestWorkflow.id);
          } else {
            setIngestScheduleStopped(false);
          }

          // Detect "Forward Tickets" workflow
          const forwardWorkflow = findForwardTicketsWorkflow(workflowList);
          if (forwardWorkflow) {
            // Also check if the Forward Tickets workflow is referenced in category automations' "Run workflow"
            const workflowAuto = categoryAutomationsRef.current?.find(a => (a.type === 'workflow' || a.name === 'Run workflow') && a.enabled);
            const automationWorkflowIds = workflowAuto?.options?.find(o => o.key === 'workflow_id')?.value?.split(',').map(id => id.trim()).filter(Boolean) || [];
            const isReferencedInAutomations = automationWorkflowIds.includes(forwardWorkflow.id);

            if (isReferencedInAutomations) {
              forwardAppNames = extractWorkflowAppNames(forwardWorkflow);
              setForwardWorkflowId(forwardWorkflow.id);
            } else {
              // Workflow exists but not referenced in automations — treat as disabled
              setForwardWorkflowId(null);
            }
          } else {
            setForwardWorkflowId(null);
          }

          // Detect "Ingestion Webhook" workflow and extract webhook URL + status
          const webhookWorkflow = workflowList.find((w: any) => w.name === 'Ingestion Webhook');
          if (webhookWorkflow) {
            const webhookTrigger = (webhookWorkflow.triggers || []).find(
              (t: any) => t.trigger_type === 'WEBHOOK' || t.app_name === 'Webhook'
            );
            let webhookUrl: string | null = null;
            if (webhookTrigger) {
              const webhookId = webhookTrigger.id || webhookTrigger.trigger_id;
              if (webhookId) {
                webhookUrl = getApiUrl(`/api/v1/hooks/webhook_${webhookId}`);
              }
            }
            // Enabled only if the trigger itself is not stopped
            const triggerStopped = !webhookTrigger || (webhookTrigger.status || '').toLowerCase() === 'stopped';
            const webhookEnabled = !triggerStopped;
            setWebhookIngestion({
              url: webhookUrl,
              exists: true,
              enabled: webhookEnabled,
              workflowId: webhookWorkflow.id,
            });
          } else {
            setWebhookIngestion({ url: null, exists: false, enabled: false, workflowId: null });
          }
        }

        const ingestionResults = extractValidatedIngestionApps(authApps, workflowAppNames);
        // Backfill missing images from Algolia
        const { backfillAppImages, deduplicateAuthApps } = await import('@/lib/utils');
        const deduped = deduplicateAuthApps(authApps.filter((a: any) => a.active || a.validation?.valid));
        await backfillAppImages(deduped);
        const imgMap = new Map<string, string>();
        deduped.forEach(d => { if (d.bestImage) imgMap.set(normalizeAppName(d.app.name), d.bestImage); });
        ingestionResults.forEach(app => {
          if (!app.image) app.image = imgMap.get(normalizeAppName(app.name)) || '';
        });
        setIngestionApps(ingestionResults);

        // Extract forward apps using same auth data but Forward Tickets workflow
        const forwardResults = extractValidatedIngestionApps(authApps, forwardAppNames);
        forwardResults.forEach(app => {
          if (!app.image) app.image = imgMap.get(normalizeAppName(app.name)) || '';
        });
        setForwardApps(forwardResults);
      }
    } catch (error) {
      console.error('Failed to fetch ingestion apps:', error);
    } finally {
      setIngestionLoading(false);
      ingestionLoadedOnceRef.current = true;
    }
  }, []);

  useEffect(() => {
    fetchIngestionApps();
    // Run only once on mount; fetchIngestionApps is now stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced handler: collects app toggles for 3s then fires one generate call
  const handleToggleApp = useCallback((appName: string, enabled: boolean) => {
    pendingTogglesRef.current.set(appName, enabled);
    trackPredefinedEvent(GA_EVENTS.INCIDENT_INGESTION_TOGGLE, appName, enabled ? 1 : 0);
    setIsUpdatingApps(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const toggles = new Map(pendingTogglesRef.current);
      pendingTogglesRef.current.clear();
      const activeNames = ingestionApps
        .filter(a => toggles.has(a.name) ? toggles.get(a.name) : a.enabled)
        .map(a => a.name);
      try {
        const body: Record<string, string> = {
          label: 'Ingest Tickets',
          category: 'cases',
        };
        if (activeNames.length > 0) {
          body.app_name = activeNames.join(',');
        } else {
          body.action_name = 'remove';
        }
        await fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Ingestion sources updated');
        await fetchIngestionApps();
        // Only trigger sync if we still have active sources (remove means nothing to execute)
        if (activeNames.length > 0) {
          // Fetch workflows to get the current Ingest Tickets workflow ID, then execute
          try {
            const wfResp = await fetch(getApiUrl('/api/v1/workflows'), {
              credentials: 'include',
              headers: getAuthHeader(),
            });
            const wfs = await wfResp.json();
            const ingestWf = Array.isArray(wfs) && wfs.find((w: any) => w.name === 'Ingest Tickets');
            if (ingestWf?.id) {
              triggerSync(ingestWf.id);
            }
          } catch { /* ignore */ }
        }
      } catch (error) {
        console.error('Failed to update ingestion sources:', error);
        toast.error('Failed to update ingestion sources');
        fetchIngestionApps();
      } finally {
        setIsUpdatingApps(false);
      }
    }, 3000);
  }, [ingestionApps, fetchIngestionApps]);

  // Debounced handler for forward app toggles
  const handleToggleForwardApp = useCallback((appName: string, enabled: boolean) => {
    pendingForwardTogglesRef.current.set(appName, enabled);
    setIsUpdatingForwardApps(true);
    if (forwardDebounceTimerRef.current) clearTimeout(forwardDebounceTimerRef.current);
    forwardDebounceTimerRef.current = setTimeout(async () => {
      const toggles = new Map(pendingForwardTogglesRef.current);
      pendingForwardTogglesRef.current.clear();
      const activeNames = forwardApps
        .filter(a => toggles.has(a.name) ? toggles.get(a.name) : a.enabled)
        .map(a => a.name);
      try {
        const body: Record<string, string> = {
          label: 'Forward Tickets',
          category: 'cases',
        };
        if (activeNames.length > 0) {
          body.app_name = activeNames.join(',');
        } else {
          body.action_name = 'remove';
        }
        await fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Forward destinations updated');
        // Re-fetch category config (which includes automations) so forward detection picks up the updated workflow reference
        await fetchItems();
        await fetchIngestionApps();
      } catch (error) {
        console.error('Failed to update forward destinations:', error);
        toast.error('Failed to update forward destinations');
        fetchIngestionApps();
      } finally {
        setIsUpdatingForwardApps(false);
      }
    }, 3000);
  }, [forwardApps, fetchIngestionApps, fetchItems]);

  const triggerSync = useCallback(async (overrideWorkflowId?: string) => {
    const wfId = overrideWorkflowId || ingestWorkflowId;
    if (!wfId || isSyncing) return;
    setIsSyncing(true);
    try {
      const resp = await fetch(getApiUrl(`/api/v1/workflows/${wfId}/execute`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ execution_source: 'manual', start: '' }),
      });
      if (resp.ok) {
        trackPredefinedEvent(GA_EVENTS.INCIDENT_SYNC);
        toast.success('Sync started — polling for new incidents…');
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
          pollCount++;
          await fetchItems();
          if (pollCount >= 6) {
            clearInterval(pollInterval);
            setIsSyncing(false);
          }
        }, 10000);
      } else {
        let errorMsg = 'Failed to trigger sync';
        try {
          const errorData = await resp.json();
          if (errorData?.reason) errorMsg = errorData.reason;
        } catch { /* ignore parse errors */ }
        toast.error(errorMsg);
        setIsSyncing(false);
      }
    } catch {
      toast.error('Failed to trigger sync');
      setIsSyncing(false);
    }
  }, [ingestWorkflowId, isSyncing, fetchItems]);

  // Auto-sync when arriving from onboarding with ?autoSync=1
  const autoSyncTriggered = useCallback(async () => {
    if (!searchParams.has('autoSync') || !ingestWorkflowId || isSyncing) return;
    setSearchParams((prev) => { prev.delete('autoSync'); return prev; }, { replace: true });
    await triggerSync();
  }, [searchParams, ingestWorkflowId, isSyncing, setSearchParams, triggerSync]);

  useEffect(() => {
    autoSyncTriggered();
  }, [autoSyncTriggered]);

  // Helper: check if an incident has meaningful content (title or description)
  const hasContent = (incident: DisplayIncident): boolean => {
    // If rawOCSF only has 'unmapped' as a meaningful top-level field, treat as irrelevant
    const raw = incident.rawOCSF as any;
    if (raw && typeof raw === 'object') {
      const keys = Object.keys(raw).filter(k => k !== 'class_uid' && k !== 'class_name');
      if (keys.length === 1 && keys[0] === 'unmapped') return false;
    }
    const hasTitle = !!incident.title;
    const hasDesc = !!(raw?.desc || raw?.message || raw?.finding_info?.title || raw?.finding_info_list?.[0]?.title);
    return hasTitle || hasDesc;
  };

  // Derive incidents synchronously from datastoreItems to avoid flash of empty state
  // Also validate assignees - only show if they're a valid user or AI Agent
  // Merge in sub-org incidents when available
  const incidents = useMemo(() => {
    // Parse current org incidents
    const currentOrgIncidents = datastoreItems
      .map((item) => parseIncidentFromDatastore(item))
      .filter((a): a is DisplayIncident => a !== null)
      .map((incident) => {
        let updated = incident;
        if (updated.assignee) {
          if (isAIAssignee(updated.assignee)) {
            updated = { ...updated, assignee: 'AI Agent' };
          } else if (!validUsernames.has(updated.assignee.toLowerCase())) {
            updated = { ...updated, assignee: null };
          }
        }
        return { ...updated, orgId: currentOrgId || '', orgName: currentOrgName, orgImage: userInfo?.active_org?.image };
      });

    // Parse sub-org incidents and tag with org info
    const subOrgIncidents: DisplayIncident[] = [];
    subOrgItems.forEach(({ orgName, orgImage, items }, orgId) => {
      items.forEach((item: any) => {
        const parsed = parseIncidentFromDatastore(item);
        if (parsed) {
          const rawParsedId = toRawIncidentKey(parsed.id);
          subOrgIncidents.push({
            ...parsed,
            id: `${orgId}::${rawParsedId}`,
            orgId,
            orgName,
            orgImage,
          });
        }
      });
    });

    const allIncidents = [...currentOrgIncidents, ...subOrgIncidents];

    // Deduplicate cross-org incidents with the same key — keep the most recently edited
    const deduped: DisplayIncident[] = [];
    const keyMap = new Map<string, { best: DisplayIncident; allOrgs: Array<{ orgId: string; orgName: string; orgImage?: string }> }>();
    
    for (const inc of allIncidents) {
      // Extract raw key (strip orgId:: prefix)
      const rawKey = toRawIncidentKey(inc.id);
      const existing = keyMap.get(rawKey);
      const incOrgInfo = { orgId: inc.orgId || '', orgName: inc.orgName || '', orgImage: inc.orgImage };
      
      if (!existing) {
        keyMap.set(rawKey, { best: inc, allOrgs: [incOrgInfo] });
      } else {
        // Only add if this orgId isn't already tracked
        if (!existing.allOrgs.some(o => o.orgId === incOrgInfo.orgId)) {
          existing.allOrgs.push(incOrgInfo);
        }
        // Keep the one with the latest edit timestamp
        const existingTs = existing.best.editedTs || existing.best.createdTs || 0;
        const newTs = inc.editedTs || inc.createdTs || 0;
        if (newTs > existingTs) {
          existing.best = inc;
        }
      }
    }
    
    for (const { best, allOrgs } of keyMap.values()) {
      deduped.push({
        ...best,
        // Attach shared org info for downstream use
        sharedOrgs: allOrgs.length > 1 ? allOrgs : undefined,
      });
    }

    return deduped;
  }, [datastoreItems, validUsernames, subOrgItems]);

  // Count incidents per source for current org only (used by ingestion source buttons)
  const incidentCountsBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of datastoreItems) {
      const parsed = parseIncidentFromDatastore(item);
      if (parsed?.source) {
        const normalizedSource = parsed.source.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
        counts.set(normalizedSource, (counts.get(normalizedSource) || 0) + 1);
      }
    }
    return counts;
  }, [datastoreItems]);

  // Split into relevant and irrelevant
  const [relevantIncidents, irrelevantCount] = useMemo(() => {
    const relevant: DisplayIncident[] = [];
    let irrelevant = 0;
    for (const inc of incidents) {
      if (hasContent(inc)) {
        relevant.push(inc);
      } else {
        irrelevant++;
      }
    }
    return [relevant, irrelevant] as const;
  }, [incidents]);

  const [showIrrelevant, setShowIrrelevant] = useState(true);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [resyncingSource, setResyncingSource] = useState<string>('');
  const autoResyncQueueRef = useRef<Set<string>>(new Set());

  // Subscribe to shared resync state (from detail page navigations)
  const sharedResyncIds = useSyncExternalStore(
    resyncState.subscribe,
    resyncState.getAll,
  );
  const allResyncingIds = useMemo(() => {
    const ids = new Set(sharedResyncIds);
    if (resyncingId) ids.add(resyncingId);
    return ids;
  }, [sharedResyncIds, resyncingId]);

  // Auto-resync untitled incidents (once per browser session, one at a time)
  useEffect(() => {
    console.log('[AutoResync] Effect running. hasFetched:', hasFetched, 'incidents.length:', incidents.length, 'resyncingId:', resyncingId, 'queueSize:', autoResyncQueueRef.current.size, 'queue:', [...autoResyncQueueRef.current]);
    if (!hasFetched || incidents.length === 0) {
      console.log('[AutoResync] Bailing: hasFetched=', hasFetched, 'incidents.length=', incidents.length);
      return;
    }
    
    const SESSION_KEY = 'shuffle_auto_resync_done';
    const alreadyResynced: Set<string> = new Set(
      JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]')
    );

    // Find incidents without a title that have a source and haven't been resynced this session
    const needsSync = (t?: string, id?: string) => !t || t === 'Untitled Incident' || t === 'Requires sync' || t === 'undefined' || (id && t === id);
    const untitled = incidents.filter(inc => {
      const sync = needsSync(inc.title, inc.id);
      console.log(`[AutoResync] Checking ${inc.id}: title="${inc.title}" needsSync=${sync} source="${inc.source}" alreadyResynced=${alreadyResynced.has(inc.id)} inQueue=${autoResyncQueueRef.current.has(inc.id)}`);
      if (!sync) return false;
      if (!inc.source) return false;
      if (alreadyResynced.has(inc.id)) return false;
      if (autoResyncQueueRef.current.has(inc.id)) return false;
      return true;
    });

    console.log('[AutoResync] Candidates:', untitled.length, 'resyncingId:', resyncingId);
    if (untitled.length === 0 || resyncingId) return;

    // Pick the first one
    const target = untitled[0];
    autoResyncQueueRef.current.add(target.id);
    setResyncingId(target.id);
    resyncState.add(target.id);
    setResyncingSource(target.source || '');

    const doResync = async () => {
      try {
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
            fields: [{ key: 'id', value: target.id }],
            app_name: target.source,
          }),
        });

        if (!response.ok) {
          console.warn(`[AutoResync] Failed for ${target.id}`);
        }

        // Poll the specific incident every 5s for up to 60s
        const POLL_INTERVAL = 5000;
        const MAX_POLLS = 12;
        let pollCount = 0;

        const poll = async () => {
          pollCount++;
          try {
            const item = await getDatastoreItem(target.id, DATASTORE_CATEGORIES.INCIDENTS);
            if (item.success && item.item) {
              // Check if it now has real content
              let parsed: any = null;
              try {
                parsed = typeof item.item.value === 'string' ? JSON.parse(item.item.value) : item.item.value;
              } catch { /* ignore */ }

              const title = parsed?.finding_info?.title || parsed?.title || '';
              if (title && title !== 'Untitled Incident' && title !== 'Requires sync' && title !== target.id) {
                console.log(`[AutoResync] Got content for ${target.id} after ${pollCount} polls`);
                alreadyResynced.add(target.id);
                sessionStorage.setItem(SESSION_KEY, JSON.stringify([...alreadyResynced]));
                await fetchItems();
                setResyncingId(null);
                resyncState.remove(target.id);
                setResyncingSource('');
                return;
              }
            }
          } catch { /* ignore poll errors */ }

          if (pollCount < MAX_POLLS) {
            setTimeout(poll, POLL_INTERVAL);
          } else {
            // Give up after max polls
            console.warn(`[AutoResync] Timed out for ${target.id}`);
            alreadyResynced.add(target.id);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify([...alreadyResynced]));
            await fetchItems();
            setResyncingId(null);
            resyncState.remove(target.id);
            setResyncingSource('');
          }
        };

        // Start first poll after 5s
        setTimeout(poll, POLL_INTERVAL);
      } catch (err) {
        console.warn('[AutoResync] Error:', err);
        alreadyResynced.add(target.id);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify([...alreadyResynced]));
        setResyncingId(null);
        resyncState.remove(target.id);
        setResyncingSource('');
      }
    };

    doResync();
  }, [hasFetched, incidents, resyncingId, fetchItems]);

  // Active incident list based on irrelevant toggle
  const activeIncidents = useMemo(() => {
    if (showIrrelevant) return incidents;
    return relevantIncidents;
  }, [showIrrelevant, incidents, relevantIncidents]);

  // Apply smart defaults on initial load only - default to "New" OR "In Progress" status
  const [smartDefaultApplied, setSmartDefaultApplied] = useState(false);

  useEffect(() => {
    if (!smartDefaultApplied && incidents.length > 0) {
      // Default to "New" OR "In Progress" status filter
      setFilters(prev => ({ ...prev, status: ['new', 'in_progress'] }));
      setSmartDefaultApplied(true);
    }
  }, [incidents, smartDefaultApplied]);

  // Filter incidents
  const filteredByAssignee = useMemo(() => {
    if (filters.assignee === null || filters.assignee === 'all') {
      return activeIncidents;
    }
    if (filters.assignee === 'unassigned') {
      return activeIncidents.filter(i => !i.assignee);
    }
    // For specific user filter (e.g., "Yours"), also include incidents where a task is assigned to them
    return activeIncidents.filter(i => {
      // Check incident assignee
      if (i.assignee === filters.assignee) return true;
      // Check if any task is assigned to this user
      if (i.tasks && i.tasks.length > 0) {
        return i.tasks.some(task => 
          task.assignee?.toLowerCase() === filters.assignee?.toLowerCase()
        );
      }
      return false;
    });
  }, [activeIncidents, filters.assignee]);

  const filteredIncidents = useMemo(() => {
    let result = filteredByAssignee;

    if (filters.severity) {
      const neg = negatedFilters.has('severity');
      result = result.filter(i => neg ? i.severity !== filters.severity : i.severity === filters.severity);
    }
    if (filters.status) {
      const neg = negatedFilters.has('status');
      const knownStatuses = Object.keys(statusConfig);
      if (Array.isArray(filters.status)) {
        result = result.filter(i => {
          const isKnown = knownStatuses.includes(i.status);
          const matches = filters.status!.includes(i.status) || !isKnown;
          return neg ? !matches : matches;
        });
      } else {
        result = result.filter(i => {
          const isKnown = knownStatuses.includes(i.status);
          const matches = i.status === filters.status || !isKnown;
          return neg ? !matches : matches;
        });
      }
    }
    if (filters.tlp) {
      const neg = negatedFilters.has('tlp');
      result = result.filter(i => neg ? i.tlp !== filters.tlp : i.tlp === filters.tlp);
    }
    if (filters.source) {
      const neg = negatedFilters.has('source');
      result = result.filter(i => {
        const match = (i.source || '').toLowerCase() === filters.source!.toLowerCase();
        return neg ? !match : match;
      });
    }
    if (filters.tag) {
      const neg = negatedFilters.has('tag');
      result = result.filter(i => {
        const match = i.labels?.some(l => l.toLowerCase() === filters.tag!.toLowerCase());
        return neg ? !match : match;
      });
    }
    const orgFilter = Array.isArray(filters.org) ? filters.org : filters.org ? [filters.org] : [];
    if (orgFilter.length > 0) {
      result = result.filter(i => orgFilter.includes(i.orgId || ''));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => 
        (i.title || '').toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        (i.source || '').toLowerCase().includes(q) ||
        (i.assignee && i.assignee.toLowerCase().includes(q)) ||
        (i.labels && i.labels.some(l => l.toLowerCase().includes(q)))
      );
    }

    // Date range filter
    if (dateFrom) {
      const fromMs = dateFrom.getTime();
      result = result.filter(i => (i.createdTs || 0) >= fromMs);
    }
    if (dateTo) {
      // Include the entire "to" day
      const toMs = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999).getTime();
      result = result.filter(i => (i.createdTs || 0) <= toMs);
    }

    return result;
  }, [filteredByAssignee, filters, negatedFilters, searchQuery, dateFrom, dateTo]);

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, negatedFilters, searchQuery, showIrrelevant, dateFrom, dateTo]);

  // Sort incidents
  const sortedIncidents = useMemo(() => {
    const sorted = [...filteredIncidents];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'severity':
          comparison = (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'assignee':
          comparison = (a.assignee || '').localeCompare(b.assignee || '');
          break;
        case 'created':
          comparison = a.createdTs - b.createdTs;
          break;
        case 'edited':
          comparison = (a.editedTs || a.createdTs) - (b.editedTs || b.createdTs);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredIncidents, sortBy, sortDirection]);

  // Determine if all selected incidents are already resolved
  const selectedIncidentsList = useMemo(() => incidents.filter(i => selectedIds.has(i.id)), [incidents, selectedIds]);
  const allSelectedResolved = selectedIds.size > 0 && selectedIncidentsList.every(i => i.status.toLowerCase() === 'resolved');
  const someSelectedResolved = selectedIds.size > 0 && selectedIncidentsList.some(i => i.status.toLowerCase() === 'resolved');

  const handleBulkReopen = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkResolving(true);

    const updates = selectedIncidentsList
      .filter(i => i.status.toLowerCase() === 'resolved')
      .map(async (incident) => {
        const reopenActivity: ActivityItem = {
          id: `status-${Date.now()}-${incident.id}`,
          type: 'status',
          user: currentUsername,
          timestamp: Date.now(),
          content: 'Reopened incident',
          details: {},
          attachments: [],
        };

        const rawOCSF = incident.rawOCSF || {} as OCSFIncidentFinding;
        const existingActivity = (rawOCSF as any).activity || [];

        const updated = {
          ...rawOCSF,
          class_uid: 2005 as const,
          class_name: 'Incident Finding' as const,
          finding_uid: rawOCSF.finding_uid || incident.id,
          title: rawOCSF.title || incident.title,
          status_id: 1,
          status: 'New',
          status_detail: '',
          activity: [...existingActivity, reopenActivity],
        };

        const rawKey = toRawIncidentKey(incident.id);
        const primaryResult = await setDatastoreItem(rawKey, updated, DATASTORE_CATEGORIES.INCIDENTS);

        if (incident.sharedOrgs && incident.sharedOrgs.length > 0) {
          Promise.allSettled(
            incident.sharedOrgs.map(org =>
              setDatastoreItem(rawKey, updated, DATASTORE_CATEGORIES.INCIDENTS, org.orgId)
            )
          );
        }

        return primaryResult;
      });

    const results = await Promise.all(updates);
    const successCount = results.filter(r => r.success).length;

    setIsBulkResolving(false);

    if (successCount > 0) {
      toast.success(`Reopened ${successCount} incident${successCount !== 1 ? 's' : ''}`);
    } else {
      toast.warning('Failed to reopen incidents');
    }

    setSelectedIds(new Set());
    await fetchItems();
  }, [selectedIds, selectedIncidentsList, currentUsername, fetchItems]);

  const getIncidentUrl = (incident: DisplayIncident) => {
    const isInvalidData = (!incident.title || incident.title === 'Untitled Incident' || incident.title === 'Requires sync' || incident.title === incident.id) && !incident.source;
    const params = new URLSearchParams();
    if (isInvalidData) params.set('tab', 'raw');
    if (incident.sharedOrgs && incident.sharedOrgs.length > 1) {
      params.set('shared_orgs', incident.sharedOrgs.map(o => o.orgId).join(','));
    }
    const rawKey = toRawIncidentKey(incident.id);
    const routeId = incident.orgId && currentOrgId && incident.orgId !== currentOrgId
      ? `${incident.orgId}::${rawKey}`
      : rawKey;
    const paramStr = params.toString();
    return `${entityBasePath}/${routeId}${paramStr ? '?' + paramStr : ''}`;
  };

  const handleCreateIncident = async (ocsf: OCSFIncidentFinding) => {
    const key = ocsf.finding_uid;
    await addItem(key, ocsf);
    await fetchItems();
    trackPredefinedEvent(GA_EVENTS.INCIDENT_CREATE);
  };

  const resetToDefaults = () => {
    // Build the same org list that the auto-select effect uses on load
    let defaultOrg: string[] | null = null;
    if (isParentOrg) {
      const allIds = [currentOrgId || '', ...subOrgs.filter(o => o.id !== currentOrgId).map(o => o.id)];
      if (parentOrg && parentOrg.id !== currentOrgId && !allIds.includes(parentOrg.id)) {
        allIds.unshift(parentOrg.id);
      }
      defaultOrg = allIds;
    } else if (isChildOrg && currentOrgId) {
      defaultOrg = [currentOrgId];
    }
    setFilters({ severity: null, status: ['new', 'in_progress'], tlp: null, assignee: null, source: null, tag: null, org: defaultOrg });
    setNegatedFilters(new Set());
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    // Collect all cross-org delete promises for shared incidents
    const crossOrgDeletes: Promise<any>[] = [];
    const selectedIncidents = incidents.filter(i => selectedIds.has(i.id));
    for (const inc of selectedIncidents) {
      if (inc.sharedOrgs && inc.sharedOrgs.length > 0) {
        const rawKey = toRawIncidentKey(inc.id);
        for (const org of inc.sharedOrgs) {
          crossOrgDeletes.push(deleteDatastoreItem(rawKey, DATASTORE_CATEGORIES.INCIDENTS, org.orgId));
        }
      }
    }

    const result = await deleteDatastoreItems(
      Array.from(selectedIds),
      DATASTORE_CATEGORIES.INCIDENTS
    );
    
    // Fire cross-org deletes in parallel (best effort)
    if (crossOrgDeletes.length > 0) {
      Promise.allSettled(crossOrgDeletes);
    }

    if (result.success) {
      toast.success(`Deleted ${result.deleted} incident${result.deleted !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      await fetchItems();
    } else {
      toast.error(`Deleted ${result.deleted}, but ${result.failed.length} failed`);
      setSelectedIds(new Set(result.failed));
      await fetchItems();
    }
  }, [selectedIds, incidents, fetchItems]);

  const handleBulkResolve = useCallback(async (resolutionData: ResolutionData) => {
    if (selectedIds.size === 0) return;
    
    setIsBulkResolving(true);
    trackPredefinedEvent(GA_EVENTS.INCIDENT_BULK_RESOLVE, resolutionData.reason, selectedIds.size);
    
    const reasonLabel = RESOLUTION_REASONS.find(r => r.value === resolutionData.reason)?.label || resolutionData.reason;
    
    // Update each selected incident to resolved status with proper resolution data
    const updates = incidents
      .filter(i => selectedIds.has(i.id))
      .map(async (incident) => {
        const resolveActivity: ActivityItem = {
          id: `status-${Date.now()}-${incident.id}`,
          type: 'status',
          user: currentUsername,
          timestamp: Date.now(),
          content: `Resolved: ${reasonLabel}${resolutionData.notes ? ` - ${resolutionData.notes}` : ''}`,
          details: {},
          attachments: [],
        };
        
        // Get existing data or initialize empty structure
        const rawOCSF = incident.rawOCSF || {} as OCSFIncidentFinding;
        const existingMetadata = rawOCSF.metadata || {};
        const existingExtensions = existingMetadata.extensions || {};
        const existingCustomAttrs = (existingExtensions.custom_attributes || {}) as Record<string, unknown>;
        // Get existing activity from top level first, then metadata fallback
        const existingActivity = (rawOCSF as any).activity || 
          ((existingCustomAttrs.activity as ActivityItem[] | undefined) || []);
        
        const updated = {
          // Ensure required OCSF fields exist
          class_uid: 2005 as const,
          class_name: 'Incident Finding' as const,
          finding_uid: rawOCSF.finding_uid || incident.id,
          title: rawOCSF.title || incident.title,
          ...rawOCSF,
          // Set resolved status
          status_id: 3,
          status: 'Resolved',
          status_detail: `${resolutionData.reason}${resolutionData.notes ? `: ${resolutionData.notes}` : ''}`,
          // Store activity at top level (primary location)
          activity: [...existingActivity, resolveActivity],
          // Ensure metadata structure exists
          metadata: {
            ...existingMetadata,
            extensions: {
              ...existingExtensions,
              custom_attributes: {
                ...existingCustomAttrs,
                // Remove activity from metadata (migrated to top level)
              },
            },
          },
        };
        
        // Remove the old activity key from custom_attributes if it exists
        if ((updated.metadata.extensions.custom_attributes as Record<string, unknown>).activity) {
          delete (updated.metadata.extensions.custom_attributes as Record<string, unknown>).activity;
        }
        
        const rawKey = toRawIncidentKey(incident.id);
        const primaryResult = await setDatastoreItem(rawKey, updated, DATASTORE_CATEGORIES.INCIDENTS);
        
        // Sync to shared orgs (fire-and-forget)
        if (incident.sharedOrgs && incident.sharedOrgs.length > 0) {
          Promise.allSettled(
            incident.sharedOrgs.map(org =>
              setDatastoreItem(rawKey, updated, DATASTORE_CATEGORIES.INCIDENTS, org.orgId)
            )
          );
        }
        
        return primaryResult;
      });
    
    const results = await Promise.all(updates);
    const successCount = results.filter(r => r.success).length;
    
    setIsBulkResolving(false);
    setBulkResolveDialogOpen(false);
    
    if (successCount === selectedIds.size) {
      toast.success(`Resolved ${successCount} incident${successCount !== 1 ? 's' : ''}`);
    } else {
      toast.warning(`Resolved ${successCount} of ${selectedIds.size} incidents`);
    }
    
    setSelectedIds(new Set());
    // Refetch to get updated data
    await fetchItems();
  }, [selectedIds, incidents, currentUsername, fetchItems]);

  const isDefaultFilter = useMemo(() => {
    if (filters.severity || filters.tlp || filters.source || filters.tag) return false;
    if (negatedFilters.size > 0 || dateFrom || dateTo) return false;
    if (filters.assignee !== null || searchQuery.trim()) return false;
    if (!Array.isArray(filters.status) || filters.status.length !== 2 || !filters.status.includes('new') || !filters.status.includes('in_progress')) return false;

    // Org filter check
    if (isParentOrg) {
      // Default = all orgs selected
      const allIds = new Set([
        currentOrgId || '',
        ...subOrgs.filter(o => o.id !== currentOrgId).map(o => o.id),
      ]);
      
      const currentOrgs = new Set(filters.org || []);
      if (currentOrgs.size !== allIds.size) return false;
      for (const id of allIds) { if (!currentOrgs.has(id)) return false; }
    } else if (isChildOrg) {
      if (!filters.org || filters.org.length !== 1 || filters.org[0] !== currentOrgId) return false;
    } else {
      if (filters.org && filters.org.length > 0) return false;
    }

    return true;
  }, [filters, negatedFilters, dateFrom, dateTo, searchQuery, isParentOrg, isChildOrg, currentOrgId, subOrgs, parentOrg]);

  // Collect unique tags across all active incidents for the filter UI
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    activeIncidents.forEach(inc => {
      inc.labels?.forEach(l => { if (l.trim()) tagSet.add(l); });
    });
    return Array.from(tagSet).sort();
  }, [activeIncidents]);

  // Show empty state when no relevant incidents exist (after loading completes)
  // But NOT when there was a load error — show error state instead
  // Also suppress during refreshes to prevent flash between skeleton and empty state
  // If the primary org fetch failed but sub-org data loaded, skip the error screen
  const hasAnyIncidents = relevantIncidents.length > 0 || irrelevantCount > 0;
  const primaryFetchFailed = !!error;
  const subOrgDataAvailable = subOrgItems.size > 0 && Array.from(subOrgItems.values()).some(v => v.items.length > 0);

  if (hasFetched && !isLoading && !isRefreshing && !hasAnyIncidents && !(primaryFetchFailed && subOrgDataAvailable)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {entityPlural}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={() => { sessionStorage.removeItem('shuffle_auto_resync_done'); autoResyncQueueRef.current.clear(); fetchItems(); fetchSubOrgIncidents(); }} 
                disabled={isLoading}
                sx={{ 
                  width: 36, height: 36, color: 'text.secondary',
                  border: '1px solid', borderColor: 'divider', borderRadius: 1,
                  '&:hover': { borderColor: 'text.secondary' },
                }}
              >
                <RefreshIcon fontSize="small" sx={isRefreshing ? { animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } } : undefined} />
              </IconButton>
            </Tooltip>
            <Tooltip title={`Create ${entitySingular}`}>
              <IconButton 
                onClick={() => setCreateDialogOpen(true)}
                sx={{ 
                  width: 36, height: 36, color: 'text.secondary',
                  border: '1px solid', borderColor: 'divider', borderRadius: 1,
                  '&:hover': { borderColor: 'text.secondary' },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 12,
              px: 4,
              textAlign: 'center',
              maxWidth: 520,
              mx: 'auto',
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '20px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 4,
              }}
            >
              <RefreshIcon sx={{ fontSize: 36, color: '#ef4444', opacity: 0.8 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 1.5 }}>
              Failed to load incidents
            </Typography>
            <Typography variant="body1" sx={{ color: 'hsl(var(--muted-foreground))', mb: isSupport ? 3 : 5, lineHeight: 1.7, maxWidth: 420 }}>
              There was a problem connecting to the server. Check your network connection and try again.
            </Typography>
            {isSupport && error && (
              <Alert severity="info" sx={{ width: '100%', mb: 4, borderRadius: 2, textAlign: 'left', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))', mb: 1.5 }}>
                  Support debug output
                </Typography>
                <Box sx={{ display: 'grid', gap: 1, width: '100%' }}>
                  {supportIncidentDebugRows.map(([label, value]) => (
                    <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: 1.5, alignItems: 'start' }}>
                      <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {label}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', wordBreak: 'break-word' }}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {lastDiagnostics?.bodyPreview && (
                  <Box sx={{ mt: 2, width: '100%' }}>
                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Response preview
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        mt: 0.75,
                        mb: 0,
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: 'hsl(var(--muted))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '0.75rem',
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowX: 'auto',
                      }}
                    >
                      {lastDiagnostics.bodyPreview}
                    </Box>
                  </Box>
                )}
              </Alert>
            )}
            <Button
              variant="contained"
              size="large"
              startIcon={<RefreshIcon />}
              onClick={() => fetchItems()}
              sx={{
                px: 4, py: 1.5, borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.95rem',
                backgroundColor: '#FF6600',
                '&:hover': { backgroundColor: '#e55c00' },
              }}
            >
              Retry
            </Button>
          </Box>
        ) : (
          <IncidentsEmptyState 
            ingestionApps={ingestionApps} 
            onIngestionToggled={fetchIngestionApps}
            onToggleApp={handleToggleApp}
            webhook={webhookIngestion}
            isSyncing={isSyncing}
            isUpdatingApps={isUpdatingApps}
            isLoading={ingestionLoading}
            onSyncNow={ingestWorkflowId ? triggerSync : undefined}
            onCreateIncident={() => setCreateDialogOpen(true)}
          />
        )}

        <CreateIncidentDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSubmit={handleCreateIncident}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            {entityPlural}
          </Typography>
          {isLoading && <CircularProgress size={20} />}
          {subOrgLoading.size > 0 && (() => {
            const totalOrgs = subOrgs.filter(o => o.id !== currentOrgId).length;
            const loaded = totalOrgs - subOrgLoading.size;
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 500 }}>
                  Loading orgs {loaded}/{totalOrgs}
                </Typography>
              </Box>
            );
          })()}
          {error && (
            <Typography variant="caption" color="error">{error}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Ingestion + Forward pipeline container */}
          {showAutomation && (
          <Box
            className="automation-pipeline"
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 0,
              position: 'relative',
              // Default state
              '& .automation-section-ingest, & .automation-section-forward': {
                transition: 'border-color 0.3s ease, background-color 0.3s ease',
                overflow: 'visible',
                clipPath: 'inset(-24px -20px -20px -20px)',
                position: 'relative',
              },
              '& .automation-section-title': {
                transition: 'opacity 0.25s ease',
              },
              '& .automation-arrow': {
                transition: 'max-width 0.4s cubic-bezier(0.4,0,0.2,1) 0.15s, opacity 0.3s ease 0.15s',
                overflow: 'hidden',
              },
              // Hovering either section: boost z-index and make bg opaque, hide other title
              '&:has(.automation-section-ingest:hover), &:has(.automation-section-ingest.is-hovered)': {
                '& .automation-section-ingest': {
                  zIndex: 10,
                  bgcolor: 'hsl(var(--muted))',
                  clipPath: 'inset(-20px -500px -20px 0px)',
                },
                '& .automation-section-forward .automation-section-title': {
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                },
              },
              '&:has(.automation-section-forward:hover), &:has(.automation-section-forward.is-hovered)': {
                '& .automation-section-forward': {
                  zIndex: 10,
                  bgcolor: 'hsl(var(--muted))',
                  clipPath: 'inset(-20px 0px -20px -500px)',
                },
                '& .automation-section-ingest .automation-section-title': {
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                },
              },
            }}
          >
          {/* Ingestion Sources - grouped in a subtle container with add button */}
          {!ingestionLoading && (
            <Box className={`automation-section-ingest${ingestHovered ? ' is-hovered' : ''}`}
              onMouseEnter={handleIngestEnter}
              onMouseLeave={handleIngestLeave}
              sx={{ 
              position: 'relative',
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5,
              bgcolor: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              px: 0.75,
              py: 0.5,
              '& .automation-overflow': {
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                position: 'absolute',
                left: 'calc(100% - 6px)',
                top: -1,
                bottom: -1,
                opacity: 0,
                pl: 1.5,
                pr: 0.75,
                bgcolor: 'hsl(var(--muted))',
                borderRadius: '0 6px 6px 0',
                border: '1px solid hsl(var(--border))',
                borderLeft: 'none',
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
              },
              '& .automation-overflow-count': {
                maxWidth: 36,
                opacity: 1,
                overflow: 'hidden',
                transition: 'max-width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
              },
              '&:hover .automation-overflow, &.is-hovered .automation-overflow': {
                opacity: 1,
                pointerEvents: 'auto',
                transitionDelay: '0.25s',
              },
              '&:hover, &.is-hovered': {
                borderRadius: '6px 0 0 6px',
              },
              '&:hover .automation-overflow-count, &.is-hovered .automation-overflow-count': {
                maxWidth: 0,
                opacity: 0,
              },
            }}>
              <Typography className="automation-section-title" sx={{
                position: 'absolute',
                top: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.55rem',
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
                bgcolor: 'hsl(var(--muted))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 10,
                px: 1,
                py: 0.15,
                lineHeight: 1.3,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                <Tooltip title="Apps with authentication appear here. Verified apps show in green, unverified in yellow. Toggle them to control which tools automatically pull in incidents." placement="top" arrow>
                  <span style={{ cursor: 'help' }}>Ingest</span>
                </Tooltip>
              </Typography>
              {/* Webhook counts as 1 of the 5 visible slots */}
              <WebhookIngestionButton webhook={webhookIngestion} onToggled={fetchIngestionApps} />
              {/* Demo-injected apps (e.g. Outlook after fake auth) always render
                  so the user sees the result of step 2 even while the tour is open. */}
              {demoInjectedApps.map(app => (
                <IngestionSourceButton key={`demo-${app.name}`} app={app} onToggle={() => { /* no-op for demo apps */ }} incidentCount={0} />
              ))}
              {!isDemoTourActive && ingestionApps.slice(0, 3).map(app => (
                <IngestionSourceButton key={app.name} app={app} onToggle={handleToggleApp} incidentCount={incidentCountsBySource.get(normalizeAppName(app.name)) || 0} />
              ))}
              {!isDemoTourActive && ingestionApps.length > 3 && (
                <>
                  <Typography className="automation-overflow-count" sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 600, px: 0.25 }}>
                    +{ingestionApps.length - 3}
                  </Typography>
                  <Box className="automation-overflow" sx={{ px: 0.75, py: 0.5 }}>
                    {ingestionApps.slice(3).map(app => (
                      <IngestionSourceButton key={app.name} app={app} onToggle={handleToggleApp} incidentCount={incidentCountsBySource.get(normalizeAppName(app.name)) || 0} />
                    ))}
                  </Box>
                </>
              )}
              <Tooltip title="Add ingestion source">
                <IconButton
                  data-tour="add-ingestion-source-button"
                  onClick={() => setAppSearchOpen(true)}
                  size="small"
                  sx={{
                    width: 28,
                    height: 28,
                    color: 'hsl(var(--muted-foreground))',
                    border: '1px dashed hsl(var(--border))',
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: 'hsl(var(--muted))',
                      borderStyle: 'solid',
                      color: 'hsl(var(--primary))',
                    },
                  }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              {ingestWorkflowId && (
              <Tooltip title={isUpdatingApps ? "Updating sources…" : isSyncing ? "Syncing…" : "Sync now"}>
                  <span>
                  <IconButton
                    size="small"
                    disabled={isSyncing || isUpdatingApps}
                    onClick={() => triggerSync()}
                    sx={{
                      width: 28,
                      height: 28,
                      color: isSyncing ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'hsl(var(--muted))',
                        color: 'hsl(var(--primary))',
                      },
                    }}
                  >
                    {(isSyncing || isUpdatingApps) ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          )}

          {/* Arrow between Ingest and Forward - hidden until workflows loaded.
              Also hidden whenever the demo tour drawer is open. */}
          {!ingestionLoading && !isDemoTourActive && (
          <Box className="automation-arrow" sx={{ display: 'flex', alignItems: 'center', color: 'hsl(var(--muted-foreground))', mx: -0.25, maxWidth: 30, opacity: 1 }}>
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </Box>
          )}

          {/* Forward Destinations - visible after workflows loaded.
              Hidden entirely whenever the demo tour drawer is open. */}
          {!ingestionLoading && !isDemoTourActive && (
            <Box className={`automation-section-forward${forwardHovered ? ' is-hovered' : ''}`}
              onMouseEnter={handleForwardEnter}
              onMouseLeave={handleForwardLeave}
              sx={{ 
              position: 'relative',
              overflow: 'visible',
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5,
              bgcolor: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              px: 0.75,
              py: 0.5,
              '& .automation-overflow': {
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                position: 'absolute',
                right: 'calc(100% - 6px)',
                top: -1,
                bottom: -1,
                opacity: 0,
                pr: 1.5,
                pl: 0.75,
                bgcolor: 'hsl(var(--muted))',
                borderRadius: '6px 0 0 6px',
                border: '1px solid hsl(var(--border))',
                borderRight: 'none',
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
              },
              '& .automation-overflow-count': {
                maxWidth: 36,
                opacity: 1,
                overflow: 'hidden',
                transition: 'max-width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
              },
              '&:hover .automation-overflow, &.is-hovered .automation-overflow': {
                opacity: 1,
                pointerEvents: 'auto',
                transitionDelay: '0.25s',
              },
              '&:hover, &.is-hovered': {
                borderRadius: '0 6px 6px 0',
              },
              '&:hover .automation-overflow-count, &.is-hovered .automation-overflow-count': {
                maxWidth: 0,
                opacity: 0,
              },
            }}>
              <Typography className="automation-section-title" sx={{
                position: 'absolute',
                top: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.55rem',
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
                bgcolor: 'hsl(var(--muted))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 10,
                px: 1,
                py: 0.15,
                lineHeight: 1.3,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                <Tooltip title="Apps configured to receive forwarded incidents. Toggle to control which tools incidents are sent to." placement="top" arrow>
                  <span style={{ cursor: 'help' }}>Forward</span>
                </Tooltip>
              </Typography>
              {forwardApps.slice(0, 4).map(app => (
                <IngestionSourceButton key={app.name} app={app} onToggle={handleToggleForwardApp} variant="forward" />
              ))}
              {forwardApps.length > 4 && (
                <>
                  <Typography className="automation-overflow-count" sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 600, px: 0.25 }}>
                    +{forwardApps.length - 4}
                  </Typography>
                  <Box className="automation-overflow" sx={{ px: 0.75, py: 0.5 }}>
                    {forwardApps.slice(4).map(app => (
                      <IngestionSourceButton key={app.name} app={app} onToggle={handleToggleForwardApp} variant="forward" />
                    ))}
                  </Box>
                </>
              )}
              <Tooltip title="Add forward destination">
                <IconButton
                  onClick={() => setForwardAppSearchOpen(true)}
                  size="small"
                  sx={{
                    width: 28,
                    height: 28,
                    color: 'hsl(var(--muted-foreground))',
                    border: '1px dashed hsl(var(--border))',
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: 'hsl(var(--muted))',
                      borderStyle: 'solid',
                      color: 'hsl(var(--primary))',
                    },
                  }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              {forwardWorkflowId && (
                <Tooltip title={isUpdatingForwardApps ? "Updating destinations…" : "Open workflow"}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => window.open(`https://shuffler.io/workflows/${forwardWorkflowId}`, '_blank')}
                      sx={{
                        width: 28,
                        height: 28,
                        color: 'hsl(var(--muted-foreground))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 1,
                        '&:hover': {
                          bgcolor: 'hsl(var(--muted))',
                          color: 'hsl(var(--primary))',
                        },
                      }}
                    >
                      {isUpdatingForwardApps ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          )}
          </Box>
          )}

          {showAutomation && (
          <Tooltip title={(() => {
            const workflowAuto = categoryAutomations?.find(a => a.type === 'workflow' && a.enabled);
            const wfId = workflowAuto?.options?.find(o => o.key === 'workflow_id')?.value?.split(',')[0]?.trim();
            return wfId ? "Click to open automation workflow" : "Automation for Incidents";
          })()}>
            <IconButton 
              onClick={() => {
                const workflowAuto = categoryAutomations?.find(a => a.type === 'workflow' && a.enabled);
                const wfId = workflowAuto?.options?.find(o => o.key === 'workflow_id')?.value?.split(',')[0]?.trim();
                if (wfId) {
                  window.open(`https://shuffler.io/workflows/${wfId}`, '_blank');
                } else {
                  trackPredefinedEvent(GA_EVENTS.INCIDENT_AUTOMATION_CHANGE, 'open_dialog');
                  setAutomationsDialogOpen(true);
                }
              }}
              sx={{ 
                width: 36,
                height: 36,
                color: categoryAutomations?.some(a => a.enabled) ? '#4ade80' : 'text.secondary',
                border: '1px solid',
                borderColor: categoryAutomations?.some(a => a.enabled) ? 'success.main' : 'divider',
                borderRadius: 1,
                '&:hover': {
                  borderColor: categoryAutomations?.some(a => a.enabled) ? 'success.main' : 'text.secondary',
                },
              }}
            >
              <RocketLaunchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          )}
          <Tooltip title="Refresh">
            <IconButton 
              onClick={() => { sessionStorage.removeItem('shuffle_auto_resync_done'); autoResyncQueueRef.current.clear(); fetchItems(); fetchSubOrgIncidents(); }} 
              disabled={isLoading}
              sx={{ 
                width: 36,
                height: 36,
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                '&:hover': {
                  borderColor: 'text.secondary',
                },
              }}
            >
              <RefreshIcon fontSize="small" sx={isRefreshing ? { animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } } : undefined} />
            </IconButton>
          </Tooltip>
          <Tooltip title={`Create ${entitySingular}`}>
            <IconButton 
              onClick={() => setCreateDialogOpen(true)}
              sx={{ 
                width: 36,
                height: 36,
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                '&:hover': {
                  borderColor: 'text.secondary',
                },
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Warning banner when Ingest Tickets schedule is stopped */}
      {ingestScheduleStopped && ingestWorkflowId && (
        <Box sx={{
          mb: 2,
          px: 2,
          py: 1.5,
          borderRadius: 1.5,
          bgcolor: 'hsla(var(--severity-medium) / 0.08)',
          border: '1px solid hsla(var(--severity-medium) / 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <Box sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'hsl(var(--severity-medium))',
            flexShrink: 0,
          }} />
          <Typography sx={{ fontSize: '0.82rem', color: 'hsl(var(--foreground))', flex: 1 }}>
            <strong>Automatic ingestion is paused</strong> — the "Ingest Tickets" workflow schedule has been stopped. Sources are shown as disabled until the schedule is re-enabled.
          </Typography>
        </Box>
      )}


      {/* Floating Filter Bar - sticky */}
      <Card sx={{ mb: 3, position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'hsl(var(--card))' }}>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
            {/* Select all checkbox - always visible */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title={selectedIds.size > 0 ? 'Deselect all' : 'Select all'}>
                <Checkbox
                  checked={selectedIds.size === sortedIncidents.length && sortedIncidents.length > 0}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < sortedIncidents.length}
                  onChange={() => {
                    if (selectedIds.size > 0) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(sortedIncidents.map(i => i.id)));
                    }
                  }}
                  size="small"
                  sx={{
                    color: 'hsl(var(--muted-foreground))',
                    '&.Mui-checked, &.MuiCheckbox-indeterminate': {
                      color: 'hsl(var(--primary))',
                    },
                  }}
                />
              </Tooltip>
              {selectedIds.size > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: 'hsl(var(--primary))',
                    fontSize: '0.7rem',
                    ml: -0.5,
                    minWidth: 12,
                  }}
                >
                  {selectedIds.size}
                </Typography>
              )}
            </Box>

            <TextField
              size="small"
              placeholder="Filter"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: '1rem' }} />
                  </InputAdornment>
                ),
                sx: { height: 36 },
              }}
              sx={{ width: { xs: 100, sm: 140 }, minWidth: 0, flexShrink: 1 }}
      />

      <AppSearchDrawer
        open={forwardAppSearchOpen}
        onClose={() => {
          setForwardAppSearchOpen(false);
          fetchIngestionApps();
        }}
        title="Add Forward Destination"
        subtitle="Search and authenticate a tool to forward incidents to"
      />

            {/* Bulk actions */}
            {selectedIds.size > 0 && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {allSelectedResolved ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleBulkReopen}
                    disabled={isBulkResolving}
                    sx={{
                      height: 36,
                      borderColor: 'hsl(var(--border))',
                      color: '#f59e0b',
                      '&:hover': {
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      },
                    }}
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setBulkResolveDialogOpen(true)}
                    sx={{
                      height: 36,
                      borderColor: 'hsl(var(--border))',
                      color: '#22c55e',
                      '&:hover': {
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      },
                    }}
                  >
                    Resolve
                  </Button>
                )}
              </Box>
            )}

            {/* Active filters */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {filters.assignee && filters.assignee !== 'all' && (
                <Chip
                  label={`${negatedFilters.has('assignee') ? 'NOT ' : ''}${filters.assignee === 'unassigned' ? 'Unassigned' : filters.assignee}`}
                  size="small"
                  onClick={() => setNegatedFilters(prev => { const next = new Set(prev); next.has('assignee') ? next.delete('assignee') : next.add('assignee'); return next; })}
                  onDelete={() => { setFilters(prev => ({ ...prev, assignee: null })); setNegatedFilters(prev => { const next = new Set(prev); next.delete('assignee'); return next; }); }}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: negatedFilters.has('assignee') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: negatedFilters.has('assignee') ? '#f87171' : '#818cf8',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: negatedFilters.has('assignee') ? '#f87171' : '#818cf8' },
                  }}
                />
              )}

              {filters.severity && (
                <Chip
                  label={`${negatedFilters.has('severity') ? 'NOT ' : ''}${filters.severity}`}
                  size="small"
                  onClick={() => setNegatedFilters(prev => { const next = new Set(prev); next.has('severity') ? next.delete('severity') : next.add('severity'); return next; })}
                  onDelete={() => { setFilters(prev => ({ ...prev, severity: null })); setNegatedFilters(prev => { const next = new Set(prev); next.delete('severity'); return next; }); }}
                  sx={{ 
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    backgroundColor: negatedFilters.has('severity') ? 'rgba(239, 68, 68, 0.15)' : `${severityColors[filters.severity] || '#94a3b8'}20`,
                    color: negatedFilters.has('severity') ? '#f87171' : (severityColors[filters.severity] || '#94a3b8'),
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: negatedFilters.has('severity') ? '#f87171' : (severityColors[filters.severity] || '#94a3b8') },
                  }}
                />
              )}

              {filters.status && (
                Array.isArray(filters.status) ? (
                  <Chip
                    label={`${negatedFilters.has('status') ? 'NOT ' : ''}${filters.status.map(s => statusConfig[s]?.label || s).join(' / ')}`}
                    size="small"
                    onClick={() => setNegatedFilters(prev => { const next = new Set(prev); next.has('status') ? next.delete('status') : next.add('status'); return next; })}
                    onDelete={() => { setFilters(prev => ({ ...prev, status: null })); setNegatedFilters(prev => { const next = new Set(prev); next.delete('status'); return next; }); }}
                    sx={{ 
                      cursor: 'pointer',
                      backgroundColor: negatedFilters.has('status') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                      color: negatedFilters.has('status') ? '#f87171' : '#818cf8',
                      fontWeight: 500,
                      '& .MuiChip-deleteIcon': { color: negatedFilters.has('status') ? '#f87171' : '#818cf8' },
                    }}
                  />
                ) : (
                  <Chip
                    label={`${negatedFilters.has('status') ? 'NOT ' : ''}${statusConfig[filters.status]?.label || filters.status.replace('_', ' ')}`}
                    size="small"
                    onClick={() => setNegatedFilters(prev => { const next = new Set(prev); next.has('status') ? next.delete('status') : next.add('status'); return next; })}
                    onDelete={() => { setFilters(prev => ({ ...prev, status: null })); setNegatedFilters(prev => { const next = new Set(prev); next.delete('status'); return next; }); }}
                    sx={{ 
                      cursor: 'pointer',
                      backgroundColor: negatedFilters.has('status') ? 'rgba(239, 68, 68, 0.15)' : (statusConfig[filters.status]?.bg || 'rgba(148, 163, 184, 0.1)'),
                      color: negatedFilters.has('status') ? '#f87171' : (statusConfig[filters.status]?.color || '#94a3b8'),
                      fontWeight: 500,
                      '& .MuiChip-deleteIcon': { color: negatedFilters.has('status') ? '#f87171' : (statusConfig[filters.status]?.color || '#94a3b8') },
                    }}
                  />
                )
              )}

              {filters.source && (
                <Chip
                  label={`${negatedFilters.has('source') ? 'NOT ' : ''}${filters.source}`}
                  size="small"
                  onClick={() => setNegatedFilters(prev => { const next = new Set(prev); next.has('source') ? next.delete('source') : next.add('source'); return next; })}
                  onDelete={() => { setFilters(prev => ({ ...prev, source: null })); setNegatedFilters(prev => { const next = new Set(prev); next.delete('source'); return next; }); }}
                  avatar={
                    (() => {
                      const app = ingestionApps.find(a => 
                        a.name.toLowerCase().replace(/[\s_-]/g, '') === filters.source!.toLowerCase().replace(/[\s_-]/g, '')
                      );
                      return app?.image ? (
                        <img src={app.image} alt="" style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: 2 }} />
                      ) : undefined;
                    })()
                  }
                  sx={{ 
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    backgroundColor: negatedFilters.has('source') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: negatedFilters.has('source') ? '#f87171' : '#60a5fa',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: negatedFilters.has('source') ? '#f87171' : '#60a5fa' },
                  }}
                />
              )}

              {filters.tag && (
                <Chip
                  label={`${negatedFilters.has('tag') ? 'NOT ' : ''}${filters.tag}`}
                  size="small"
                  onClick={() => setNegatedFilters(prev => { const next = new Set(prev); next.has('tag') ? next.delete('tag') : next.add('tag'); return next; })}
                  onDelete={() => { setFilters(prev => ({ ...prev, tag: null })); setNegatedFilters(prev => { const next = new Set(prev); next.delete('tag'); return next; }); }}
                  sx={{ 
                    cursor: 'pointer',
                    backgroundColor: negatedFilters.has('tag') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                    color: negatedFilters.has('tag') ? '#f87171' : '#06b6d4',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: negatedFilters.has('tag') ? '#f87171' : '#06b6d4' },
                  }}
                />
              )}



              {/* Tag quick-filter chips removed — use tag chips on incident cards instead */}

              {!isDefaultFilter && (
                <Button size="small" onClick={resetToDefaults} sx={{ minWidth: 'auto', height: 36 }}>
                  Reset
                </Button>
              )}
            </Box>

            <Typography variant="body2" sx={{ ml: 'auto', color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {(() => {
                const displayTotal = totalAmount && totalAmount > 1000 ? totalAmount : sortedIncidents.length;
                const totalPages = Math.ceil(displayTotal / ITEMS_PER_PAGE);
                return `${displayTotal} incident${displayTotal !== 1 ? 's' : ''}${totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ''}`;
              })()}
            </Typography>

            {/* Organization multi-select dropdown */}
            {isParentOrg && (
              <Autocomplete
                multiple
                disableCloseOnSelect
                size="small"
                options={(() => {
                  const currentOrgImage = userInfo?.active_org?.image;
                  const realOrgs: { id: string; name: string; image?: string }[] = [
                    { id: currentOrgId || '', name: currentOrgName, image: currentOrgImage },
                    ...subOrgs.filter(org => org.id !== currentOrgId).map(o => ({ id: o.id, name: o.name, image: o.image })),
                  ];
                  // Don't add parent org — we only fetch downward (children)
                  return [
                    { id: '__all__', name: 'All tenants' },
                    { id: '__none__', name: 'Current Tenant' },
                    ...realOrgs,
                  ];
                })()}
                getOptionLabel={(option) => option.name}
                value={
                  (Array.isArray(filters.org) ? filters.org : filters.org ? [filters.org] : []).map(id => {
                    if (id === currentOrgId) return { id: currentOrgId || '', name: currentOrgName };
                    if (parentOrg && id === parentOrg.id) return { id: parentOrg.id, name: parentOrg.name };
                    const found = subOrgs.find(o => o.id === id);
                    return found || { id, name: id };
                  })
                }
                onChange={(_, newValue) => {
                  // Check if special options were selected
                  const hasAll = newValue.some(v => v.id === '__all__');
                  const hasNone = newValue.some(v => v.id === '__none__');
                  if (hasNone) {
                    setFilters(prev => ({ ...prev, org: [currentOrgId || ''] }));
                    return;
                  }
                  if (hasAll) {
                    // Select all real orgs
                    const allIds = [
                      currentOrgId || '',
                      ...subOrgs.filter(o => o.id !== currentOrgId).map(o => o.id),
                    ];
                    setFilters(prev => ({ ...prev, org: allIds }));
                    return;
                  }
                  setFilters(prev => ({
                    ...prev,
                    org: newValue.length > 0 ? newValue.map(v => v.id) : null,
                  }));
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options, params) => {
                  const filtered = options.filter(o => {
                    if (o.id === '__all__' || o.id === '__none__') return true;
                    return o.name.toLowerCase().includes(params.inputValue.toLowerCase());
                  });
                  return filtered;
                }}
                renderOption={(props, option) => {
                  if (option.id === '__all__' || option.id === '__none__') {
                    return (
                      <li {...props} key={option.id} style={{ borderBottom: option.id === '__none__' ? '1px solid hsla(var(--border))' : undefined }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                          {option.name}
                        </Typography>
                      </li>
                    );
                  }
                  const count = option.id === currentOrgId
                    ? datastoreItems.length
                    : subOrgItems.get(option.id)?.items.length || 0;
                  const isOrgLoading = subOrgLoading.has(option.id);
                  const isOrgFailed = subOrgFailed.has(option.id);
                  // Indent orgs that are children of another org in the list
                  const orgData = subOrgs.find(o => o.id === option.id);
                  const isSubOrg = orgData?.creator_org && orgData.creator_org !== option.id;
                  return (
                    <li {...props} key={option.id} style={{ paddingLeft: isSubOrg ? 48 : 16 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {option.image ? (
                            <img src={option.image} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
                          ) : (
                            <Box sx={{ width: 20, height: 20, borderRadius: '4px', bgcolor: 'hsl(var(--muted) / 0.5)', flexShrink: 0 }} />
                          )}
                          <Typography sx={{ fontSize: '0.82rem' }}>{option.name}</Typography>
                          {isOrgFailed && (
                            <Tooltip title="Failed to load incidents from this tenant" placement="right">
                              <WarningAmberIcon sx={{ fontSize: 14, color: 'hsl(var(--severity-medium))' }} />
                            </Tooltip>
                          )}
                        </Box>
                        {isOrgLoading ? (
                          <CircularProgress size={12} sx={{ color: '#a78bfa', ml: 1 }} />
                        ) : (
                          <Typography sx={{ fontSize: '0.7rem', color: isOrgFailed ? 'hsl(var(--severity-medium))' : 'hsl(var(--muted-foreground))', ml: 1 }}>
                            {isOrgFailed ? '!' : count}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={(() => {
                      const orgFilter = Array.isArray(filters.org) ? filters.org : filters.org ? [filters.org] : [];
                      return orgFilter.length > 0 ? `${orgFilter.length} Tenant${orgFilter.length > 1 ? 's' : ''}` : 'Tenants';
                    })()}
                    sx={{ minWidth: 150, width: 150 }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: null,
                    }}
                  />
                )}
                renderTags={() => null}
                sx={{
                  minWidth: 150,
                  width: 150,
                  '& .MuiOutlinedInput-root': {
                    minHeight: 36,
                    py: '2px',
                  },
                }}
                slotProps={{
                  popper: {
                    sx: {
                      width: '280px !important',
                    },
                    placement: 'bottom-start',
                  },
                  paper: {
                    sx: {
                      bgcolor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      '& .MuiAutocomplete-option': {
                        fontSize: '0.82rem',
                        py: 0.75,
                      },
                    },
                  },
                }}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Card View with Stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 320px' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* Card list */}
        <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
          <IncidentCardView
            incidents={sortedIncidents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
            getIncidentUrl={getIncidentUrl}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            isLoading={isLoading}
            ingestionApps={ingestionApps}
            resyncingIds={allResyncingIds}
            resyncingSource={resyncingSource}
            orgFilterNames={(() => {
              const orgFilter = Array.isArray(filters.org) ? filters.org : filters.org ? [filters.org] : [];
              // Build a lookup of all known orgs
              const allKnownOrgs: { id: string; name: string }[] = [
                { id: currentOrgId || '', name: currentOrgName },
                ...subOrgs.map(o => ({ id: o.id, name: o.name })),
              ];
              if (parentOrg && !allKnownOrgs.some(o => o.id === parentOrg.id)) {
                allKnownOrgs.push({ id: parentOrg.id, name: parentOrg.name });
              }
              return orgFilter.map(id => {
                const found = allKnownOrgs.find(o => o.id === id);
                return found?.name || id;
              });
            })()}
            totalOrgCount={(() => {
              const allIds = new Set([currentOrgId || '', ...subOrgs.map(o => o.id)]);
              if (parentOrg) allIds.add(parentOrg.id);
              return allIds.size;
            })()}
            onResetOrgFilter={resetToDefaults}
            onFilterChange={(type, value) => {
              setFilters(prev => {
                if (type === 'org') {
                  const currentOrgs = Array.isArray(prev.org) ? prev.org : prev.org ? [prev.org] : [];
                  const valStr = String(value);
                  if (currentOrgs.includes(valStr)) {
                    const next = currentOrgs.filter(o => o !== valStr);
                    return { ...prev, org: next.length > 0 ? next : null };
                  }
                  return { ...prev, org: [...currentOrgs, valStr] };
                }
                return { ...prev, [type]: prev[type] === value ? null : value };
              });
            }}
          />
          
          {/* Load more from server when on last page - only if client-side filters aren't already hiding loaded items */}
          {hasMore && currentPage >= Math.ceil(sortedIncidents.length / ITEMS_PER_PAGE) && sortedIncidents.length >= datastoreItems.length && (!filters.org || filters.org.length === 0 || filters.org.includes(currentOrgId || '')) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={fetchNextPage}
                disabled={isLoading}
                sx={{ 
                  height: 36, minWidth: 140,
                  borderColor: 'hsl(var(--border))',
                  '&:hover': { borderColor: 'hsl(var(--primary))' },
                }}
              >
                {isLoading ? <CircularProgress size={20} /> : 'Load More'}
              </Button>
            </Box>
          )}
        </Box>
        
        {/* Stats sidebar - sticky on desktop */}
        <Box sx={{ display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 72, alignSelf: 'start', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto', order: { xs: -1, lg: 0 } }}>
          {/* Date range filter */}
          {/* Date range filter */}
          <Box sx={{ 
            mb: 2, 
            px: 1.5, 
            py: 1, 
            borderRadius: 2, 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid', 
            borderColor: (dateFrom || dateTo) ? 'rgba(99, 102, 241, 0.4)' : 'hsl(var(--border))',
            transition: 'border-color 0.2s ease',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <CalendarTodayIcon sx={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }} />
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Date Range
              </Typography>
              {(dateFrom || dateTo) && (
                <Typography 
                  variant="caption" 
                  onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
                  sx={{ ml: 'auto', color: '#818cf8', fontSize: '0.65rem', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                >
                  Clear
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <RadixPopover>
                <PopoverTrigger asChild>
                  <button
                    className={`flex-1 text-left text-xs px-2 py-1.5 rounded-md border-2 transition-all ${dateFrom ? 'border-blue-500/60 bg-blue-500/10 text-foreground ring-1 ring-blue-500/20' : 'border-blue-500/20 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/5'} bg-background`}
                  >
                    {dateFrom ? format(dateFrom, dateFrom.getHours() || dateFrom.getMinutes() || dateFrom.getSeconds() ? 'MMM d, yyyy HH:mm:ss' : 'MMM d, yyyy') : 'From'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-blue-500/30" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => {
                      if (d && dateFrom) {
                        d.setHours(dateFrom.getHours(), dateFrom.getMinutes(), dateFrom.getSeconds());
                      }
                      setDateFrom(d);
                    }}
                    disabled={(date) => dateTo ? date > dateTo : false}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    classNames={{
                      day_selected: 'bg-blue-500 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-500 focus:text-white',
                      day_today: 'bg-blue-500/15 text-blue-400',
                    }}
                  />
                  <div className="border-t border-blue-500/20 px-3 py-2">
                    <label className="text-[0.65rem] text-blue-400 font-medium uppercase tracking-wider">Time</label>
                    <input
                      type="time"
                      step="1"
                      value={dateFrom ? format(dateFrom, 'HH:mm:ss') : '00:00:00'}
                      onChange={(e) => {
                        const [h, m, s] = e.target.value.split(':').map(Number);
                        const d = dateFrom ? new Date(dateFrom) : new Date();
                        d.setHours(h || 0, m || 0, s || 0);
                        setDateFrom(d);
                      }}
                      className="w-full mt-1 text-xs px-2 py-1 rounded-md border border-blue-500/30 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                    />
                  </div>
                </PopoverContent>
              </RadixPopover>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>→</Typography>
              <RadixPopover>
                <PopoverTrigger asChild>
                  <button
                    className={`flex-1 text-left text-xs px-2 py-1.5 rounded-md border-2 transition-all ${dateTo ? 'border-emerald-500/60 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/20' : 'border-emerald-500/20 text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/5'} bg-background`}
                  >
                    {dateTo ? format(dateTo, dateTo.getHours() || dateTo.getMinutes() || dateTo.getSeconds() ? 'MMM d, yyyy HH:mm:ss' : 'MMM d, yyyy') : 'To'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-emerald-500/30" align="end">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => {
                      if (d && dateTo) {
                        d.setHours(dateTo.getHours(), dateTo.getMinutes(), dateTo.getSeconds());
                      }
                      setDateTo(d);
                    }}
                    disabled={(date) => dateFrom ? date < dateFrom : false}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    classNames={{
                      day_selected: 'bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white focus:bg-emerald-500 focus:text-white',
                      day_today: 'bg-emerald-500/15 text-emerald-400',
                    }}
                  />
                  <div className="border-t border-emerald-500/20 px-3 py-2">
                    <label className="text-[0.65rem] text-emerald-400 font-medium uppercase tracking-wider">Time</label>
                    <input
                      type="time"
                      step="1"
                      value={dateTo ? format(dateTo, 'HH:mm:ss') : '23:59:59'}
                      onChange={(e) => {
                        const [h, m, s] = e.target.value.split(':').map(Number);
                        const d = dateTo ? new Date(dateTo) : new Date();
                        d.setHours(h || 0, m || 0, s || 0);
                        setDateTo(d);
                      }}
                      className="w-full mt-1 text-xs px-2 py-1 rounded-md border border-emerald-500/30 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    />
                  </div>
                </PopoverContent>
              </RadixPopover>
            </Box>
          </Box>
          <IncidentStatsCards 
            incidents={filteredIncidents}
            currentUsername={currentUsername}
            isLoading={isLoading || !hasFetched}
            onFilterChange={(type, value) => {
              setFilters(prev => ({
                ...prev,
                [type]: prev[type] === value ? null : value,
              }));
            }}
          />
          {/* Incident trend charts */}
          <IncidentTrendChart incidents={filteredIncidents} dateFrom={dateFrom} dateTo={dateTo} onDateRangeSelect={(from, to) => { setDateFrom(from); setDateTo(to); }} />
          <SourceTrendChart incidents={filteredIncidents} dateFrom={dateFrom} dateTo={dateTo} onDateRangeSelect={(from, to) => { setDateFrom(from); setDateTo(to); }} />
          {/* Org trend chart - only when multiple orgs selected */}
          {Array.isArray(filters.org) && filters.org.length > 1 && (
            <OrgTrendChart incidents={filteredIncidents} dateFrom={dateFrom} dateTo={dateTo} />
          )}
          {/* Irrelevant incidents bar */}
          {irrelevantCount > 0 && (
            <Box
              onClick={() => setShowIrrelevant(prev => !prev)}
              sx={{
                mt: 2,
                px: 2,
                py: 1.5,
                borderRadius: 2,
                backgroundColor: showIrrelevant ? 'rgba(107, 114, 128, 0.15)' : 'hsl(var(--card))',
                border: '1px solid',
                borderColor: showIrrelevant ? 'rgba(107, 114, 128, 0.4)' : 'hsl(var(--border))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(107, 114, 128, 0.5)',
                  bgcolor: 'rgba(107, 114, 128, 0.1)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VisibilityOffIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
                  {irrelevantCount} irrelevant
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', opacity: 0.7, fontSize: '0.7rem' }}>
                {showIrrelevant ? 'Click to hide' : 'Hidden'}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <CreateIncidentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateIncident}
      />

      <CategoryAutomationsDialog
        open={automationsDialogOpen}
        onClose={() => setAutomationsDialogOpen(false)}
        category={DATASTORE_CATEGORIES.INCIDENTS}
        automations={categoryAutomations}
        onAutomationsChange={setCategoryAutomations}
        initialSettings={categoryConfig?.settings}
        onSaved={() => {
          // Re-fetch ingestion apps & workflows, then auto-sync
          fetchIngestionApps();
          triggerSync();
        }}
      />

      <ResolveIncidentDialog
        open={bulkResolveDialogOpen}
        onClose={() => setBulkResolveDialogOpen(false)}
        onResolve={handleBulkResolve}
        incidentTitle={`${selectedIds.size} selected incident${selectedIds.size !== 1 ? 's' : ''}`}
        isLoading={isBulkResolving}
      />

      <AppSearchDrawer
        open={appSearchOpen}
        onClose={() => {
          setAppSearchOpen(false);
          fetchIngestionApps();
        }}
        title="Add Ingestion Source"
        subtitle={isAddOutlookStep ? 'Add "Outlook Office365" and "Microsoft Defender 365" — we\'ll pretend-authenticate them for the demo' : 'Search and authenticate a tool to ingest incidents from'}
        initialQuery={isAddOutlookStep ? (demoInjectedApps.some(a => /outlook|office365/i.test(a.name)) ? 'Microsoft Defender 365' : 'Outlook Office365') : undefined}
        onSelectOverride={isAddOutlookStep ? (app) => {
          // Pretend-authenticate flow: only Outlook Office365 or Microsoft
          // Defender 365 advance the tour. Anything else falls through to the
          // normal detail drawer so the user isn't trapped if they explore.
          const norm = app.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const isOutlook = norm.includes('outlook') || norm.includes('office365');
          const isDefender = norm.includes('defender');
          if (isOutlook || isDefender) {
            // Close the search drawer and run the fake auth experience.
            setAppSearchOpen(false);
            setFakeAuth({ name: app.name, image: app.icon || '' });
            // After ~1.6s, finish "auth": inject the app into Ingest. Mark
            // the step done only when BOTH apps have been added.
            setTimeout(() => {
              setDemoInjectedApps(prev => {
                if (prev.some(a => a.name.toLowerCase() === app.name.toLowerCase())) return prev;
                const next = [
                  ...prev,
                  {
                    id: `demo-${app.name}`,
                    name: app.name,
                    image: app.icon || '',
                    validated: true,
                    enabled: true,
                    category: 'email',
                  },
                ];
                const hasOutlook = next.some(a => /outlook|office365/i.test(a.name));
                const hasDefender = next.some(a => /defender/i.test(a.name));
                if (hasOutlook && hasDefender) {
                  markStepCompleted('add-outlook');
                }
                return next;
              });
              setFakeAuth(null);
              const friendly = app.name.replace(/_/g, ' ');
              const remainingPrompt = isOutlook
                ? 'Now click "+" again and add Microsoft Defender 365.'
                : 'Both sources connected. Moving on…';
              toast.success(`${friendly} authenticated (demo)`, {
                description: remainingPrompt,
                duration: 2400,
              });
            }, 1600);
            return true; // prevent the detail drawer from opening
          }
          return false;
        } : undefined}
      />

      {/* Fake "Connecting to Microsoft" dialog used during the demo's
          add-outlook step so users get a tangible auth moment. */}
      <Dialog
        open={!!fakeAuth}
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            minWidth: 360,
          },
        }}
      >
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
          {fakeAuth?.image && (
            <Box
              component="img"
              src={fakeAuth.image}
              alt={fakeAuth.name}
              sx={{ width: 56, height: 56, borderRadius: 1.5, p: 0.75, bgcolor: 'hsl(var(--muted))', objectFit: 'contain' }}
            />
          )}
          <CircularProgress size={28} sx={{ color: 'hsl(var(--primary))' }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Connecting to {fakeAuth?.name?.replace(/_/g, ' ') || 'Microsoft'}…
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
              Demo mode — no real OAuth roundtrip.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
      {/* Fixed bottom pagination */}
      {sortedIncidents.length > ITEMS_PER_PAGE && (
        <Box sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1,
          py: 1,
          px: 2.5,
          bgcolor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 20,
        }}>
          <IconButton
            size="small"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            sx={{
              width: 36, height: 36,
              border: '1px solid hsl(var(--border))',
              borderRadius: 1,
              color: 'hsl(var(--muted-foreground))',
              '&:hover': { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' },
              '&.Mui-disabled': { opacity: 0.3 },
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>

          {Array.from({ length: Math.ceil(sortedIncidents.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
            .filter(page => {
              const totalPages = Math.ceil(sortedIncidents.length / ITEMS_PER_PAGE);
              if (totalPages <= 7) return true;
              if (page === 1 || page === totalPages) return true;
              if (Math.abs(page - currentPage) <= 1) return true;
              return false;
            })
            .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
              if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
              acc.push(page);
              return acc;
            }, [])
            .map((item, idx) =>
              item === 'ellipsis' ? (
                <Typography key={`e-${idx}`} sx={{ px: 0.5, color: 'hsl(var(--muted-foreground))' }}>…</Typography>
              ) : (
                <Button
                  key={item}
                  size="small"
                  onClick={() => setCurrentPage(item as number)}
                  sx={{
                    minWidth: 36, height: 36, px: 0,
                    borderRadius: 1,
                    fontWeight: currentPage === item ? 700 : 400,
                    color: currentPage === item ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    bgcolor: currentPage === item ? 'hsl(var(--primary))' : 'transparent',
                    border: currentPage === item ? 'none' : '1px solid hsl(var(--border))',
                    '&:hover': {
                      bgcolor: currentPage === item ? 'hsl(var(--primary))' : 'hsl(var(--muted) / 0.5)',
                    },
                  }}
                >
                  {item}
                </Button>
              )
            )}

          <IconButton
            size="small"
            disabled={currentPage >= Math.ceil(sortedIncidents.length / ITEMS_PER_PAGE)}
            onClick={() => setCurrentPage(p => p + 1)}
            sx={{
              width: 36, height: 36,
              border: '1px solid hsl(var(--border))',
              borderRadius: 1,
              color: 'hsl(var(--muted-foreground))',
              '&:hover': { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' },
              '&.Mui-disabled': { opacity: 0.3 },
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

    </motion.div>
  );
};

export default IncidentsPage;
