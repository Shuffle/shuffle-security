import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  ButtonGroup,
  Checkbox,
  TablePagination,
  CircularProgress,
  Tooltip,
  Menu,
  MenuItem,
  TableSortLabel,
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { DATASTORE_CATEGORIES, getDatastoreByCategory, setDatastoreItems, CategoryAutomation } from '@/services/datastore';
import { CreateIncidentDialog, OCSFIncidentFinding, Observable } from '@/components/incidents/CreateIncidentDialog';
import { CategoryAutomationsDialog } from '@/components/incidents/CategoryAutomationsDialog';

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
  relatedFindings?: string[];
  rawOCSF?: OCSFIncidentFinding;
}

// Column configuration
type ColumnKey = 'title' | 'source' | 'severity' | 'tlp' | 'status' | 'assignee' | 'created' | 'edited';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'title', label: 'Incident', defaultVisible: true, sortable: true },
  { key: 'source', label: 'Source', defaultVisible: false, sortable: true },
  { key: 'severity', label: 'Severity', defaultVisible: true, sortable: true },
  { key: 'tlp', label: 'TLP', defaultVisible: false, sortable: true },
  { key: 'status', label: 'Status', defaultVisible: false, sortable: true },
  { key: 'assignee', label: 'Assignee', defaultVisible: true, sortable: true },
  { key: 'created', label: 'Created', defaultVisible: false, sortable: true },
  { key: 'edited', label: 'Last Updated', defaultVisible: true, sortable: true },
];

const STORAGE_KEY_COLUMNS = 'incidents_visible_columns';

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  informational: '#3b82f6',
};

const severityOrder: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

const statusColors: Record<string, { bg: string; text: string }> = {
  new: { bg: 'rgba(34, 184, 207, 0.15)', text: '#22b8cf' },
  in_progress: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  escalated: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  resolved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
};

const tlpColors: Record<string, string> = {
  'TLP:CLEAR': '#ffffff',
  'TLP:GREEN': '#22c55e',
  'TLP:AMBER': '#f59e0b',
  'TLP:AMBER+STRICT': '#f59e0b',
  'TLP:RED': '#ef4444',
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
        relatedFindings: ocsf.related_findings,
        rawOCSF: ocsf,
      };
    } else {
      return {
        id: data.id || item.key,
        title: data.title || 'Untitled',
        source: data.source || 'Unknown',
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
      };
    }
  } catch {
    return null;
  }
};

type SortDirection = 'asc' | 'desc';

interface Filters {
  severity: string | null;
  status: string | null;
  tlp: string | null;
  assignee: string | null; // null = smart default, 'unassigned' = unassigned, username = specific user
}

const IncidentsPage = () => {
  const navigate = useNavigate();
  const { userInfo } = useAuth();
  const currentUsername = userInfo?.username || '';

  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [incidents, setIncidents] = useState<DisplayIncident[]>([]);
  const [filters, setFilters] = useState<Filters>({ severity: null, status: null, tlp: null, assignee: null });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [automationsDialogOpen, setAutomationsDialogOpen] = useState(false);
  const [categoryAutomations, setCategoryAutomations] = useState<CategoryAutomation[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState<ColumnKey>('edited');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_COLUMNS);
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as ColumnKey[]);
      } catch {
        // Fall through to defaults
      }
    }
    return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);

  const { items: datastoreItems, isLoading, error, fetchItems, addItem } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });

  useEffect(() => {
    const init = async () => {
      const migratedCount = await migrateToIncidents();
      if (migratedCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      const result = await getDatastoreByCategory(DATASTORE_CATEGORIES.INCIDENTS);
      if (result.success && result.categoryConfig?.automations) {
        setCategoryAutomations(result.categoryConfig.automations);
      }
      await fetchItems();
    };
    init();
  }, [fetchItems]);

  useEffect(() => {
    const realIncidents: DisplayIncident[] = datastoreItems
      .map((item) => parseIncidentFromDatastore(item))
      .filter((a): a is DisplayIncident => a !== null);
    setIncidents(realIncidents);
  }, [datastoreItems]);

  // Save column visibility
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify([...visibleColumns]));
  }, [visibleColumns]);

  // Apply smart defaults on initial load only
  const [smartDefaultApplied, setSmartDefaultApplied] = useState(false);

  // Apply smart default filters on initial load
  useEffect(() => {
    if (!smartDefaultApplied && incidents.length > 0) {
      // Check for user's incidents first
      const userIncidents = incidents.filter(i => i.assignee === currentUsername && i.status !== 'resolved');
      if (userIncidents.length > 0) {
        setFilters(prev => ({ ...prev, assignee: currentUsername }));
      } else {
        // Check for new incidents
        const newIncidents = incidents.filter(i => i.status === 'new');
        if (newIncidents.length > 0) {
          setFilters(prev => ({ ...prev, status: 'new' }));
        }
        // Otherwise show all non-resolved (no filter needed, handled in filteredIncidents)
      }
      setSmartDefaultApplied(true);
    }
  }, [incidents, currentUsername, smartDefaultApplied]);

  // Filter incidents based on explicit filters
  const filteredByAssignee = useMemo(() => {
    if (filters.assignee === null) {
      return incidents; // No assignee filter
    }
    if (filters.assignee === 'all') {
      return incidents; // Show everything
    }
    if (filters.assignee === 'unassigned') {
      return incidents.filter(i => !i.assignee);
    }
    return incidents.filter(i => i.assignee === filters.assignee);
  }, [incidents, filters.assignee]);

  // Apply additional filters and search
  const filteredIncidents = useMemo(() => {
    let result = filteredByAssignee;

    // Apply chip filters
    if (filters.severity) {
      result = result.filter(i => i.severity === filters.severity);
    }
    if (filters.status) {
      result = result.filter(i => i.status === filters.status);
    }
    if (filters.tlp) {
      result = result.filter(i => i.tlp === filters.tlp);
    }

    // Apply search
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
        case 'source':
          comparison = a.source.localeCompare(b.source);
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
        case 'tlp':
          comparison = (a.tlp || '').localeCompare(b.tlp || '');
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredIncidents, sortBy, sortDirection]);

  const handleSort = (column: ColumnKey) => {
    if (sortBy === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(sortedIncidents.map((i) => i.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleRowClick = (incident: DisplayIncident) => {
    navigate(`/incidents/${incident.id}`);
  };

  const handleCreateIncident = async (ocsf: OCSFIncidentFinding) => {
    const key = ocsf.finding_info.uid;
    await addItem(key, ocsf);
    await fetchItems();
  };

  const handleResolveIncident = async (incidentId: string) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident || !incident.rawOCSF) return;

    setIncidents(prev => prev.map(i => 
      i.id === incidentId ? { ...i, status: 'resolved' } : i
    ));

    const updatedOCSF: OCSFIncidentFinding = {
      ...incident.rawOCSF,
      status_id: 3,
      status: 'Resolved',
    };

    await addItem(incidentId, updatedOCSF);
  };

  const handleUpdateIncident = async (incidentId: string, updates: Partial<OCSFIncidentFinding>) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident || !incident.rawOCSF) return;

    const updatedOCSF: OCSFIncidentFinding = {
      ...incident.rawOCSF,
      ...updates,
      finding_info: {
        ...incident.rawOCSF.finding_info,
        ...(updates.finding_info || {}),
      },
    };

    await addItem(incidentId, updatedOCSF);
    await fetchItems();
  };

  const handleChipFilter = (type: keyof Filters, value: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setFilters((prev) => ({
      ...prev,
      [type]: prev[type] === value ? null : value,
    }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({ severity: null, status: null, tlp: null, assignee: null });
    setSearchQuery('');
    setPage(0);
  };

  const hasActiveFilters = filters.severity || filters.status || filters.tlp || filters.assignee !== null || searchQuery.trim();

  const renderCellContent = (incident: DisplayIncident, column: ColumnKey) => {
    switch (column) {
      case 'title':
        return (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {incident.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {incident.id}
            </Typography>
          </Box>
        );
      case 'source':
        return (
          <Chip
            label={incident.source}
            size="small"
            sx={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
          />
        );
      case 'severity':
        return (
          <Chip
            label={incident.severity}
            size="small"
            onClick={handleChipFilter('severity', incident.severity)}
            sx={{
              backgroundColor: `${severityColors[incident.severity] || '#94a3b8'}20`,
              color: severityColors[incident.severity] || '#94a3b8',
              fontWeight: 500,
              textTransform: 'capitalize',
              cursor: 'pointer',
              '&:hover': { backgroundColor: `${severityColors[incident.severity] || '#94a3b8'}35` },
            }}
          />
        );
      case 'tlp':
        return incident.tlp ? (
          <Chip
            label={incident.tlp}
            size="small"
            onClick={handleChipFilter('tlp', incident.tlp)}
            sx={{
              backgroundColor: `${tlpColors[incident.tlp] || '#94a3b8'}20`,
              color: tlpColors[incident.tlp] || '#94a3b8',
              border: tlpColors[incident.tlp] === '#ffffff' ? '1px solid #666' : 'none',
              fontWeight: 500,
              fontSize: '0.7rem',
              cursor: 'pointer',
              '&:hover': { backgroundColor: `${tlpColors[incident.tlp] || '#94a3b8'}35` },
            }}
          />
        ) : null;
      case 'status':
        return (
          <Chip
            label={incident.status.replace('_', ' ')}
            size="small"
            onClick={handleChipFilter('status', incident.status)}
            sx={{
              backgroundColor: statusColors[incident.status]?.bg || 'rgba(148, 163, 184, 0.1)',
              color: statusColors[incident.status]?.text || '#94a3b8',
              fontWeight: 500,
              textTransform: 'capitalize',
              cursor: 'pointer',
              '&:hover': { opacity: 0.8 },
            }}
          />
        );
      case 'assignee':
        const assigneeValue = incident.assignee || 'unassigned';
        return (
          <Chip
            label={incident.assignee || 'Unassigned'}
            size="small"
            onClick={handleChipFilter('assignee', assigneeValue)}
            sx={{
              backgroundColor: incident.assignee ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148, 163, 184, 0.1)',
              color: incident.assignee ? '#818cf8' : '#94a3b8',
              fontWeight: 500,
              cursor: 'pointer',
              '&:hover': { opacity: 0.8 },
            }}
          />
        );
      case 'created':
        return (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {incident.created}
          </Typography>
        );
      case 'edited':
        return (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {incident.edited || incident.created}
          </Typography>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
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

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <TextField
              size="small"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 280 }}
            />

            <Tooltip title="Configure columns">
              <IconButton onClick={(e) => setColumnMenuAnchor(e.currentTarget)} size="small">
                <ViewColumnIcon />
              </IconButton>
            </Tooltip>

            {/* Active filters */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Assignee filter */}
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

              {/* Severity filter - uses severity color */}
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

              {/* Status filter - uses status color */}
              {filters.status && (
                <Chip
                  label={`Status: ${filters.status.replace('_', ' ')}`}
                  size="small"
                  onDelete={() => setFilters(prev => ({ ...prev, status: null }))}
                  sx={{ 
                    textTransform: 'capitalize',
                    backgroundColor: statusColors[filters.status]?.bg || 'rgba(148, 163, 184, 0.1)',
                    color: statusColors[filters.status]?.text || '#94a3b8',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: statusColors[filters.status]?.text || '#94a3b8' },
                  }}
                />
              )}

              {/* TLP filter - uses TLP color */}
              {filters.tlp && (
                <Chip
                  label={filters.tlp}
                  size="small"
                  onDelete={() => setFilters(prev => ({ ...prev, tlp: null }))}
                  sx={{
                    backgroundColor: `${tlpColors[filters.tlp] || '#94a3b8'}20`,
                    color: tlpColors[filters.tlp] || '#94a3b8',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': { color: tlpColors[filters.tlp] || '#94a3b8' },
                  }}
                />
              )}

              {hasActiveFilters && (
                <Button size="small" onClick={clearFilters} sx={{ minWidth: 'auto' }}>
                  Reset
                </Button>
              )}
            </Box>

            {selected.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                <Button variant="outlined" color="primary">
                  Merge Selected ({selected.length})
                </Button>
              </Box>
            )}
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < sortedIncidents.length}
                      checked={sortedIncidents.length > 0 && selected.length === sortedIncidents.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  {COLUMNS.filter(c => visibleColumns.has(c.key)).map((col) => (
                    <TableCell key={col.key}>
                      {col.sortable ? (
                        <TableSortLabel
                          active={sortBy === col.key}
                          direction={sortBy === col.key ? sortDirection : 'asc'}
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}
                        </TableSortLabel>
                      ) : (
                        col.label
                      )}
                    </TableCell>
                  ))}
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedIncidents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((incident) => (
                  <TableRow
                    key={incident.id}
                    hover
                    selected={selected.includes(incident.id)}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(incident)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(incident.id)}
                        onChange={() => handleSelect(incident.id)}
                      />
                    </TableCell>
                    {COLUMNS.filter(c => visibleColumns.has(c.key)).map((col) => (
                      <TableCell key={col.key}>
                        {renderCellContent(incident, col.key)}
                      </TableCell>
                    ))}
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Open">
                        <IconButton size="small" onClick={() => handleRowClick(incident)}>
                          <AddIcon fontSize="small" sx={{ transform: 'rotate(45deg)' }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedIncidents.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.filter(c => visibleColumns.has(c.key)).length + 2} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No incidents found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={sortedIncidents.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[25, 50, 100]}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </CardContent>
      </Card>

      {/* Column visibility menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
        PaperProps={{
          sx: { bgcolor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', minWidth: 200 },
        }}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
          Visible Columns
        </Typography>
        {COLUMNS.map((col) => (
          <MenuItem key={col.key} onClick={() => toggleColumn(col.key)} dense>
            <Checkbox size="small" checked={visibleColumns.has(col.key)} sx={{ p: 0.5, mr: 1 }} />
            {col.label}
          </MenuItem>
        ))}
      </Menu>

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
    </motion.div>
  );
};

export default IncidentsPage;
