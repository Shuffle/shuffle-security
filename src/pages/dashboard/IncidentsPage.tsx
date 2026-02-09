import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { DATASTORE_CATEGORIES, getDatastoreByCategory, setDatastoreItems, CategoryAutomation, deleteDatastoreItems } from '@/services/datastore';
import { CreateIncidentDialog, ActivityItem } from '@/components/incidents/CreateIncidentDialog';
import { OCSFIncidentFinding, Observable, TLP_LABELS, convertLegacyTlp, mapOCSFSeverity, mapOCSFStatus } from '@/config/ocsfIncidentSchema';
import { deduplicateTasks } from '@/lib/utils';
import { ResolveIncidentDialog, ResolutionData, RESOLUTION_REASONS } from '@/components/incidents/ResolveIncidentDialog';
import { CategoryAutomationsDialog } from '@/components/incidents/CategoryAutomationsDialog';
import { IncidentCardView } from '@/components/incidents/IncidentCardView';
import { IncidentStatsCards } from '@/components/incidents/IncidentStatsCards';

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
}

type SortDirection = 'asc' | 'desc';
type SortKey = 'title' | 'severity' | 'status' | 'assignee' | 'created' | 'edited';

// Status and severity colors now imported from shared config
import { statusConfig, severityColors, severityOrder } from '@/config/incidentConfig';

const formatTimestamp = (timestamp: number | string | undefined): string => {
  if (!timestamp) return 'Unknown';
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  const ms = ts < 10000000000 ? ts * 1000 : ts;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const parseTimestamp = (timestamp: number | string | undefined): number => {
  if (!timestamp) return 0;
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  return ts < 10000000000 ? ts * 1000 : ts;
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
  return trimmed.length > 0 ? trimmed : undefined;
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
        created: formatTimestamp(item.created),
        createdTs: parseTimestamp(item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        editedTs: item.edited ? parseTimestamp(item.edited) : undefined,
        tlp: tlpLabel,
        references: ocsf.references,
        observables: customAttrs?.observables,
        relatedFindings: ocsf.related_events,
        rawOCSF: ocsf,
        taskCount: deduplicateTasks(tasks).length,
        tasks,
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
        created: formatTimestamp(item.created),
        createdTs: parseTimestamp(item.created),
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
        created: formatTimestamp(item.created),
        createdTs: parseTimestamp(item.created),
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
  status: string | string[] | null;  // Can be single value or array for multi-status filter
  tlp: string | null;
  assignee: string | null;
}

const IncidentsPage = () => {
  const { userInfo } = useAuth();
  const currentUsername = userInfo?.username || '';
  const { users, loading: usersLoading } = useUsers();

  const [filters, setFilters] = useState<Filters>({ severity: null, status: null, tlp: null, assignee: null });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [automationsDialogOpen, setAutomationsDialogOpen] = useState(false);
  const [categoryAutomations, setCategoryAutomations] = useState<CategoryAutomation[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResolveDialogOpen, setBulkResolveDialogOpen] = useState(false);
  const [isBulkResolving, setIsBulkResolving] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<SortKey>('edited');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { items: datastoreItems, isLoading, error, fetchItems, addItem, hasMore, fetchNextPage, categoryConfig } = useDatastore({
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
            // Normalize AI Agent
            return { ...incident, assignee: 'AI Agent' };
          } else if (!validUsernames.has(incident.assignee.toLowerCase())) {
            // Invalid assignee - hide it
            return { ...incident, assignee: null };
          }
        }
        return incident;
      });
  }, [datastoreItems, validUsernames]);

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
      return incidents;
    }
    if (filters.assignee === 'unassigned') {
      return incidents.filter(i => !i.assignee);
    }
    // For specific user filter (e.g., "Yours"), also include incidents where a task is assigned to them
    return incidents.filter(i => {
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
  }, [incidents, filters.assignee]);

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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => 
        i.title.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.source.toLowerCase().includes(q) ||
        (i.assignee && i.assignee.toLowerCase().includes(q))
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
          comparison = a.title.localeCompare(b.title);
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
    setFilters({ severity: null, status: ['new', 'in_progress'], tlp: null, assignee: null });
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
    filters.assignee === null && 
    !searchQuery.trim() &&
    Array.isArray(filters.status) && 
    filters.status.length === 2 && 
    filters.status.includes('new') && 
    filters.status.includes('in_progress');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Incidents
          </Typography>
          {isLoading && <CircularProgress size={20} />}
          {error && (
            <Typography variant="caption" color="error">{error}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
              sx={{ width: 280 }}
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
        <Box>
          <IncidentCardView
            incidents={sortedIncidents}
            getIncidentUrl={getIncidentUrl}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            isLoading={isLoading}
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
        <Box sx={{ display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 72, alignSelf: 'start', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto' }}>
          <IncidentStatsCards 
            incidents={incidents}
            currentUsername={currentUsername}
            onFilterChange={(type, value) => {
              setFilters(prev => ({
                ...prev,
                [type]: prev[type] === value ? null : value,
              }));
            }}
          />
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
      />

      <ResolveIncidentDialog
        open={bulkResolveDialogOpen}
        onClose={() => setBulkResolveDialogOpen(false)}
        onResolve={handleBulkResolve}
        incidentTitle={`${selectedIds.size} selected incident${selectedIds.size !== 1 ? 's' : ''}`}
        isLoading={isBulkResolving}
      />

    </motion.div>
  );
};

export default IncidentsPage;
