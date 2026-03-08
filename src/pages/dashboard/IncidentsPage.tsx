import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { DATASTORE_CATEGORIES, getDatastoreByCategory, getDatastoreItem, setDatastoreItems, CategoryAutomation, deleteDatastoreItems } from '@/services/datastore';
import { CreateIncidentDialog, ActivityItem } from '@/components/incidents/CreateIncidentDialog';
import { OCSFIncidentFinding, Observable, TLP_LABELS, convertLegacyTlp, mapOCSFSeverity, mapOCSFStatus } from '@/config/ocsfIncidentSchema';
import { deduplicateTasks, decodeHtmlEntities } from '@/lib/utils';
import { ResolveIncidentDialog, ResolutionData, RESOLUTION_REASONS } from '@/components/incidents/ResolveIncidentDialog';
import { CategoryAutomationsDialog } from '@/components/incidents/CategoryAutomationsDialog';
import { extractValidatedIngestionApps, ValidatedIngestionApp, findIngestTicketsWorkflow, extractWorkflowAppNames, normalizeAppName } from '@/lib/ingestionDetection';
import { getApiUrl, getAuthHeader } from '@/config/api';
import DownloadIcon from '@mui/icons-material/Download';
import { IncidentCardView } from '@/components/incidents/IncidentCardView';
import { IncidentStatsCards } from '@/components/incidents/IncidentStatsCards';
import { IncidentsEmptyState } from '@/components/incidents/IncidentsEmptyState';
import { IngestionSourceButton } from '@/components/incidents/IngestionSourceButton';
import { WebhookIngestionButton, WebhookIngestionInfo } from '@/components/incidents/WebhookIngestionButton';

import { toast } from 'sonner';

// Legacy categories for migration
const LEGACY_ALERTS_CATEGORY = 'shuffle-alerts';
const LEGACY_SECURITY_ALERTS_CATEGORY = 'shuffle-security_alerts';
const MIGRATION_KEY = 'shuffle_incidents_migrated_v1';

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
  return trimmed.length > 0 ? decodeHtmlEntities(trimmed) : undefined;
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

const parseIncidentFromDatastore = (item: { key: string; value: string; created?: number; edited?: number }): DisplayIncident | null => {
  try {
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
        title: meaningfulString(ocsf.title),
        source: meaningfulString(ocsf.product?.name) || meaningfulString(ocsf.types?.[0]),
        severity: mapOCSFSeverity(ocsf.severity_id || 3),
        status: mapOCSFStatus(ocsf.status_id || 1),
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
        title: meaningfulString(findingInfo?.title) || meaningfulString(legacyData.message),
        source: meaningfulString(legacyData.metadata?.product?.name) || meaningfulString(findingInfo?.types?.[0]),
        severity: mapOCSFSeverity(legacyData.severity_id),
        status: mapOCSFStatus(legacyData.status_id),
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
        title: meaningfulString(data.title),
        source: meaningfulString(data.source),
        severity: (data.severity || 'medium').toLowerCase(),
        status: (data.status || 'new').toLowerCase().replace('_', ''),
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
}

const IncidentsPage = () => {
  const { userInfo } = useAuth();
  const currentUsername = userInfo?.username || '';
  const { users, loading: usersLoading } = useUsers();

  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({ severity: null, status: null, tlp: null, assignee: null, source: null, tag: null });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [automationsDialogOpen, setAutomationsDialogOpen] = useState(false);
  const [categoryAutomations, setCategoryAutomations] = useState<CategoryAutomation[] | null>(null);
  const [ingestionApps, setIngestionApps] = useState<ValidatedIngestionApp[]>([]);
  const [ingestWorkflowId, setIngestWorkflowId] = useState<string | null>(null);
  const [webhookIngestion, setWebhookIngestion] = useState<WebhookIngestionInfo>({ url: null, exists: false, enabled: false, workflowId: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingApps, setIsUpdatingApps] = useState(false);
  const [ingestionLoading, setIngestionLoading] = useState(true);
  const pendingTogglesRef = useRef<Map<string, boolean>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appSearchOpen, setAppSearchOpen] = useState(false);
  

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResolveDialogOpen, setBulkResolveDialogOpen] = useState(false);
  const [isBulkResolving, setIsBulkResolving] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<SortKey>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { items: datastoreItems, isLoading, hasFetched, error, fetchItems, addItem, hasMore, fetchNextPage, categoryConfig } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });

  // Get valid usernames for assignee validation
  const validUsernames = useMemo(() => {
    return new Set(users.map(u => u.username.toLowerCase()));
  }, [users]);

  useEffect(() => {
    const init = async () => {
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
    setIngestionLoading(true);
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
        if (workflowsResponse.ok) {
          const workflows = await workflowsResponse.json();
          const workflowList = Array.isArray(workflows) ? workflows : (workflows.workflows || []);
          const ingestWorkflow = findIngestTicketsWorkflow(workflowList);
          if (ingestWorkflow) {
            workflowAppNames = extractWorkflowAppNames(ingestWorkflow);
            setIngestWorkflowId(ingestWorkflow.id);
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

        setIngestionApps(extractValidatedIngestionApps(authApps, workflowAppNames));
      }
    } catch (error) {
      console.error('Failed to fetch ingestion apps:', error);
    } finally {
      setIngestionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIngestionApps();
  }, [fetchIngestionApps]);

  // Debounced handler: collects app toggles for 3s then fires one generate call
  const handleToggleApp = useCallback((appName: string, enabled: boolean) => {
    pendingTogglesRef.current.set(appName, enabled);
    setIsUpdatingApps(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const toggles = new Map(pendingTogglesRef.current);
      pendingTogglesRef.current.clear();
      const activeNames = ingestionApps
        .filter(a => toggles.has(a.name) ? toggles.get(a.name) : a.enabled)
        .map(a => a.name);
      try {
        await fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'Ingest Tickets',
            app_name: activeNames.join(','),
            category: 'cases',
          }),
        });
        toast.success('Ingestion sources updated');
        fetchIngestionApps();
      } catch (error) {
        console.error('Failed to update ingestion sources:', error);
        toast.error('Failed to update ingestion sources');
        fetchIngestionApps();
      } finally {
        setIsUpdatingApps(false);
      }
    }, 3000);
  }, [ingestionApps, fetchIngestionApps]);

  // Auto-sync when arriving from onboarding with ?autoSync=1
  const autoSyncTriggered = useCallback(async () => {
    if (!searchParams.has('autoSync') || !ingestWorkflowId || isSyncing) return;
    // Clear the param so it doesn't re-trigger
    setSearchParams((prev) => { prev.delete('autoSync'); return prev; }, { replace: true });
    setIsSyncing(true);
    try {
      const resp = await fetch(getApiUrl(`/api/v1/workflows/${ingestWorkflowId}/execute`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ execution_source: 'manual', start: '' }),
      });
      if (resp.ok) {
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
        setIsSyncing(false);
      }
    } catch {
      setIsSyncing(false);
    }
  }, [searchParams, ingestWorkflowId, isSyncing, setSearchParams, fetchItems]);

  useEffect(() => {
    autoSyncTriggered();
  }, [autoSyncTriggered]);

  // Helper: check if an incident has meaningful content (title or description)
  const hasContent = (incident: DisplayIncident): boolean => {
    const hasTitle = !!incident.title;
    const raw = incident.rawOCSF as any;
    const hasDesc = !!(raw?.desc || raw?.message || raw?.finding_info?.title || raw?.finding_info_list?.[0]?.title);
    return hasTitle || hasDesc;
  };

  // Derive incidents synchronously from datastoreItems to avoid flash of empty state
  // Also validate assignees - only show if they're a valid user or AI Agent
  const incidents = useMemo(() => {
    return datastoreItems
      .map((item) => parseIncidentFromDatastore(item))
      .filter((a): a is DisplayIncident => a !== null)
      .map((incident) => {
        // Validate assignee
        if (incident.assignee) {
          if (isAIAssignee(incident.assignee)) {
            return { ...incident, assignee: 'AI Agent' };
          } else if (!validUsernames.has(incident.assignee.toLowerCase())) {
            return { ...incident, assignee: null };
          }
        }
        return incident;
      });
  }, [datastoreItems, validUsernames]);

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

  // Auto-resync untitled incidents (once per browser session, one at a time)
  useEffect(() => {
    if (!hasFetched || incidents.length === 0) return;
    
    const SESSION_KEY = 'shuffle_auto_resync_done';
    const alreadyResynced: Set<string> = new Set(
      JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]')
    );

    // Find untitled incidents with a source that haven't been resynced this session
    const untitled = incidents.filter(inc => {
      if (hasContent(inc)) return false;
      if (!inc.source) return false;
      if (alreadyResynced.has(inc.id)) return false;
      if (autoResyncQueueRef.current.has(inc.id)) return false;
      return true;
    });

    if (untitled.length === 0 || resyncingId) return;

    // Pick the first one
    const target = untitled[0];
    autoResyncQueueRef.current.add(target.id);
    setResyncingId(target.id);
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
              if (title && title !== 'Untitled Incident') {
                console.log(`[AutoResync] Got content for ${target.id} after ${pollCount} polls`);
                alreadyResynced.add(target.id);
                sessionStorage.setItem(SESSION_KEY, JSON.stringify([...alreadyResynced]));
                await fetchItems();
                setResyncingId(null);
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
      result = result.filter(i => i.severity === filters.severity);
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        result = result.filter(i => filters.status.includes(i.status));
      } else {
        result = result.filter(i => i.status === filters.status);
      }
    }
    if (filters.tlp) {
      result = result.filter(i => i.tlp === filters.tlp);
    }
    if (filters.source) {
      result = result.filter(i => (i.source || '').toLowerCase() === filters.source!.toLowerCase());
    }
    if (filters.tag) {
      result = result.filter(i => i.labels?.some(l => l.toLowerCase() === filters.tag!.toLowerCase()));
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

    return result;
  }, [filteredByAssignee, filters, searchQuery]);

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


  const getIncidentUrl = (incident: DisplayIncident) => {
    return `/incidents/${incident.id}`;
  };

  const handleCreateIncident = async (ocsf: OCSFIncidentFinding) => {
    const key = ocsf.finding_uid;
    await addItem(key, ocsf);
    await fetchItems();
  };

  const resetToDefaults = () => {
    setFilters({ severity: null, status: ['new', 'in_progress'], tlp: null, assignee: null, source: null, tag: null });
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    const result = await deleteDatastoreItems(
      Array.from(selectedIds),
      DATASTORE_CATEGORIES.INCIDENTS
    );
    
    if (result.success) {
      toast.success(`Deleted ${result.deleted} incident${result.deleted !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      await fetchItems();
    } else {
      toast.error(`Deleted ${result.deleted}, but ${result.failed.length} failed`);
      setSelectedIds(new Set(result.failed));
      await fetchItems();
    }
  }, [selectedIds, fetchItems]);

  const handleBulkResolve = useCallback(async (resolutionData: ResolutionData) => {
    if (selectedIds.size === 0) return;
    
    setIsBulkResolving(true);
    
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
        
        const { setDatastoreItem } = await import('@/services/datastore');
        return setDatastoreItem(incident.id, updated, DATASTORE_CATEGORIES.INCIDENTS);
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

  const isDefaultFilter = !filters.severity && 
    !filters.tlp && 
    !filters.source &&
    !filters.tag &&
    filters.assignee === null && 
    !searchQuery.trim() &&
    Array.isArray(filters.status) && 
    filters.status.length === 2 && 
    filters.status.includes('new') && 
    filters.status.includes('in_progress');

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
  if (hasFetched && !isLoading && relevantIncidents.length === 0 && irrelevantCount === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Incidents
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={() => fetchItems()} 
                disabled={isLoading}
                sx={{ 
                  width: 36, height: 36, color: 'text.secondary',
                  border: '1px solid', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 1,
                  '&:hover': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Create Incident">
              <IconButton 
                onClick={() => setCreateDialogOpen(true)}
                sx={{ 
                  width: 36, height: 36, color: 'text.secondary',
                  border: '1px solid', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 1,
                  '&:hover': { borderColor: 'rgba(255,255,255,0.2)' },
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
            <Typography variant="body1" sx={{ color: 'hsl(var(--muted-foreground))', mb: 5, lineHeight: 1.7, maxWidth: 420 }}>
              There was a problem connecting to the server. Check your network connection and try again.
            </Typography>
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
            onSyncNow={ingestWorkflowId ? async () => {
              setIsSyncing(true);
              try {
                const resp = await fetch(getApiUrl(`/api/v1/workflows/${ingestWorkflowId}/execute`), {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                  body: JSON.stringify({ execution_source: 'manual', start: '' }),
                });
                if (resp.ok) {
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
                  toast.error('Failed to trigger sync');
                  setIsSyncing(false);
                }
              } catch {
                toast.error('Failed to trigger sync');
                setIsSyncing(false);
              }
            } : undefined}
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
            Incidents
          </Typography>
          {isLoading && <CircularProgress size={20} />}
          {error && (
            <Typography variant="caption" color="error">{error}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Ingestion Sources - grouped in a subtle container with add button */}
          {(ingestionApps.length > 0 || webhookIngestion.exists || webhookIngestion.enabled) && (
            <Box sx={{ 
              position: 'relative',
              display: { xs: 'none', md: 'flex' }, 
              alignItems: 'center', 
              gap: 0.5,
              bgcolor: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              px: 0.75,
              py: 0.5,
            }}>
              <Typography sx={{
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
                <Tooltip title="Apps with valid authentication appear here as ingestion sources. Toggle them to control which tools automatically pull in incidents." placement="top" arrow>
                  <span style={{ cursor: 'help' }}>Automation</span>
                </Tooltip>
              </Typography>
              <WebhookIngestionButton webhook={webhookIngestion} onToggled={fetchIngestionApps} />
              {ingestionApps.map(app => (
                <IngestionSourceButton key={app.name} app={app} onToggle={handleToggleApp} />
              ))}
              <Tooltip title="Add ingestion source">
                <IconButton
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
                    onClick={async () => {
                      setIsSyncing(true);
                      try {
                        const resp = await fetch(getApiUrl(`/api/v1/workflows/${ingestWorkflowId}/execute`), {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                          body: JSON.stringify({ execution_source: 'manual', start: '' }),
                        });
                        if (resp.ok) {
                          toast.success('Sync started — polling for new incidents…');
                          // Poll every 10s for 60s, keep syncing state active
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
                          toast.error('Failed to trigger sync');
                          setIsSyncing(false);
                        }
                      } catch {
                        toast.error('Failed to trigger sync');
                        setIsSyncing(false);
                      }
                    }}
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

          <Tooltip title="Automation for Incidents">
            <IconButton 
              onClick={() => setAutomationsDialogOpen(true)}
              sx={{ 
                width: 36,
                height: 36,
                color: categoryAutomations?.some(a => a.enabled) ? '#4ade80' : 'text.secondary',
                border: '1px solid',
                borderColor: categoryAutomations?.some(a => a.enabled) ? '#4ade80' : 'rgba(255,255,255,0.1)',
                borderRadius: 1,
                '&:hover': {
                  borderColor: categoryAutomations?.some(a => a.enabled) ? '#4ade80' : 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <RocketLaunchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton 
              onClick={() => fetchItems()} 
              disabled={isLoading}
              sx={{ 
                width: 36,
                height: 36,
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 1,
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Create Incident">
            <IconButton 
              onClick={() => setCreateDialogOpen(true)}
              sx={{ 
                width: 36,
                height: 36,
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 1,
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Floating Filter Bar - sticky */}
      <Card sx={{ mb: 3, position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'hsl(var(--card))' }}>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Select all checkbox - always visible */}
            <Tooltip title={selectedIds.size === sortedIncidents.length ? 'Deselect all' : 'Select all'}>
              <Checkbox
                checked={selectedIds.size === sortedIncidents.length && sortedIncidents.length > 0}
                indeterminate={selectedIds.size > 0 && selectedIds.size < sortedIncidents.length}
                onChange={() => {
                  if (selectedIds.size === sortedIncidents.length) {
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

            <TextField
              size="small"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                sx: { height: 36 },
              }}
              sx={{ width: { xs: 160, sm: 280 }, minWidth: 0, flexShrink: 1 }}
            />

            {/* Selection count and bulk actions */}
            {selectedIds.size > 0 && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 600, 
                    color: 'hsl(var(--primary))',
                  }}
                >
                  {selectedIds.size} selected
                </Typography>
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
                <IconButton
                  size="small"
                  onClick={() => setSelectedIds(new Set())}
                  sx={{
                    color: 'hsl(var(--muted-foreground))',
                    '&:hover': {
                      color: 'hsl(var(--foreground))',
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            )}

            {/* Active filters */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {filters.assignee && filters.assignee !== 'all' && (
                <Chip
                  label={`Assignee: ${filters.assignee === 'unassigned' ? 'Unassigned' : filters.assignee}`}
                  size="small"
                  onDelete={() => setFilters(prev => ({ ...prev, assignee: null }))}
                  sx={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: '#818cf8' },
                  }}
                />
              )}

              {filters.severity && (
                <Chip
                  label={`Severity: ${filters.severity}`}
                  size="small"
                  onDelete={() => setFilters(prev => ({ ...prev, severity: null }))}
                  sx={{ 
                    textTransform: 'capitalize',
                    backgroundColor: `${severityColors[filters.severity] || '#94a3b8'}20`,
                    color: severityColors[filters.severity] || '#94a3b8',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: severityColors[filters.severity] || '#94a3b8' },
                  }}
                />
              )}

              {filters.status && (
                Array.isArray(filters.status) ? (
                  <Chip
                    label={`Status: ${filters.status.map(s => statusConfig[s]?.label || s).join(' / ')}`}
                    size="small"
                    onDelete={() => setFilters(prev => ({ ...prev, status: null }))}
                    sx={{ 
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: '#818cf8',
                      fontWeight: 500,
                      '& .MuiChip-deleteIcon': { color: '#818cf8' },
                    }}
                  />
                ) : (
                  <Chip
                    label={`Status: ${statusConfig[filters.status]?.label || filters.status.replace('_', ' ')}`}
                    size="small"
                    onDelete={() => setFilters(prev => ({ ...prev, status: null }))}
                    sx={{ 
                      backgroundColor: statusConfig[filters.status]?.bg || 'rgba(148, 163, 184, 0.1)',
                      color: statusConfig[filters.status]?.color || '#94a3b8',
                      fontWeight: 500,
                      '& .MuiChip-deleteIcon': { color: statusConfig[filters.status]?.color || '#94a3b8' },
                    }}
                  />
                )
              )}

              {filters.source && (
                <Chip
                  label={`Source: ${filters.source}`}
                  size="small"
                  onDelete={() => setFilters(prev => ({ ...prev, source: null }))}
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
                    textTransform: 'capitalize',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: '#60a5fa' },
                  }}
                />
              )}

              {filters.tag && (
                <Chip
                  label={`Tag: ${filters.tag}`}
                  size="small"
                  onDelete={() => setFilters(prev => ({ ...prev, tag: null }))}
                  sx={{ 
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    color: '#06b6d4',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: '#06b6d4' },
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

            <Typography variant="body2" sx={{ ml: 'auto', color: 'text.secondary' }}>
              {sortedIncidents.length} incident{sortedIncidents.length !== 1 ? 's' : ''}
            </Typography>
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
            incidents={sortedIncidents}
            getIncidentUrl={getIncidentUrl}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            isLoading={isLoading}
            ingestionApps={ingestionApps}
            resyncingId={resyncingId}
            resyncingSource={resyncingSource}
            onFilterChange={(type, value) => {
              setFilters(prev => ({
                ...prev,
                [type]: prev[type] === value ? null : value,
              }));
            }}
          />
          
          {/* Load More button for pagination */}
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={fetchNextPage}
                disabled={isLoading}
                sx={{ 
                  height: 36,
                  minWidth: 140,
                  borderColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                }}
              >
                {isLoading ? <CircularProgress size={20} /> : 'Load More'}
              </Button>
            </Box>
          )}
        </Box>
        
        {/* Stats sidebar - sticky on desktop */}
        <Box sx={{ display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 72, alignSelf: 'start', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto', order: { xs: -1, lg: 0 } }}>
          <IncidentStatsCards 
            incidents={activeIncidents}
            currentUsername={currentUsername}
            isLoading={isLoading || !hasFetched}
            onFilterChange={(type, value) => {
              setFilters(prev => ({
                ...prev,
                [type]: prev[type] === value ? null : value,
              }));
            }}
          />
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
        subtitle="Search and authenticate a tool to ingest incidents from"
      />

    </motion.div>
  );
};

export default IncidentsPage;
