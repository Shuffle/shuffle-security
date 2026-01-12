import { useState, useEffect, useMemo } from 'react';
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
  Checkbox,
  TablePagination,
  CircularProgress,
  Tooltip,
  Menu,
  MenuItem,
  TableSortLabel,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { DATASTORE_CATEGORIES, getDatastoreByCategory, setDatastoreItems } from '@/services/datastore';
import { CreateIncidentDialog, OCSFIncidentFinding, Observable } from '@/components/incidents/CreateIncidentDialog';
import { IncidentDetailDialog } from '@/components/incidents/IncidentDetailDialog';

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
  { key: 'status', label: 'Status', defaultVisible: true, sortable: true },
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
  assignee: string | null;
  showAll: boolean;
}

const IncidentsPage = () => {
  const { userInfo } = useAuth();
  const currentUsername = userInfo?.username || '';

  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [incidents, setIncidents] = useState<DisplayIncident[]>([]);
  const [filters, setFilters] = useState<Filters>({ severity: null, status: null, tlp: null, assignee: null, showAll: false });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<DisplayIncident | null>(null);
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

  // Determine the active view mode for display
  const activeViewMode = useMemo(() => {
    if (filters.showAll) return 'all';
    if (filters.assignee) return 'assignee';
    
    // Smart default detection
    const userIncidents = incidents.filter(i => i.assignee === currentUsername && i.status !== 'resolved');
    if (userIncidents.length > 0) return 'my_incidents';
    
    const newIncidents = incidents.filter(i => i.status === 'new');
    if (newIncidents.length > 0) return 'new_only';
    
    return 'non_resolved';
  }, [incidents, currentUsername, filters.showAll, filters.assignee]);

  // Smart default filter based on user or explicit filter
  const smartFilteredIncidents = useMemo(() => {
    // If show all, return everything
    if (filters.showAll) {
      return incidents;
    }

    // If explicit assignee filter
    if (filters.assignee !== null) {
      if (filters.assignee === '') {
        return incidents.filter(i => !i.assignee);
      }
      return incidents.filter(i => i.assignee === filters.assignee);
    }

    // Smart defaults
    const userIncidents = incidents.filter(i => i.assignee === currentUsername && i.status !== 'resolved');
    if (userIncidents.length > 0) {
      return userIncidents;
    }

    const newIncidents = incidents.filter(i => i.status === 'new');
    if (newIncidents.length > 0) {
      return newIncidents;
    }

    return incidents.filter(i => i.status !== 'resolved');
  }, [incidents, currentUsername, filters.showAll, filters.assignee]);

  // Apply additional filters and search
  const filteredIncidents = useMemo(() => {
    let result = smartFilteredIncidents;

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
  }, [smartFilteredIncidents, filters, searchQuery]);

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
    setSelectedIncident(incident);
    setDetailDialogOpen(true);
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
    setFilters({ severity: null, status: null, tlp: null, assignee: null, showAll: false });
    setSearchQuery('');
    setPage(0);
  };

  const hasActiveFilters = filters.severity || filters.status || filters.tlp || filters.assignee !== null || filters.showAll || searchQuery.trim();

  // Get unique assignees for filter dropdown
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    incidents.forEach(i => {
      if (i.assignee) assignees.add(i.assignee);
    });
    return Array.from(assignees).sort();
  }, [incidents]);

  const [assigneeMenuAnchor, setAssigneeMenuAnchor] = useState<null | HTMLElement>(null);

  const viewModeLabels: Record<string, string> = {
    all: 'All Incidents',
    assignee: `Assigned to: ${filters.assignee || 'Unassigned'}`,
    my_incidents: `My Incidents (${currentUsername})`,
    new_only: 'New Incidents',
    non_resolved: 'Non-Resolved',
  };

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
        return incident.assignee || (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
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
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchItems()}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Incident
          </Button>
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

            {/* Current view mode indicator */}
            <Chip
              label={viewModeLabels[activeViewMode]}
              size="small"
              sx={{
                backgroundColor: 'rgba(255, 102, 0, 0.15)',
                color: '#ff6600',
                fontWeight: 500,
              }}
            />

            {/* Assignee filter dropdown */}
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => setAssigneeMenuAnchor(e.currentTarget)}
              sx={{ textTransform: 'none' }}
            >
              Assignee
            </Button>
            <Menu
              anchorEl={assigneeMenuAnchor}
              open={Boolean(assigneeMenuAnchor)}
              onClose={() => setAssigneeMenuAnchor(null)}
            >
              <MenuItem 
                onClick={() => { 
                  setFilters(prev => ({ ...prev, assignee: currentUsername, showAll: false })); 
                  setAssigneeMenuAnchor(null); 
                  setPage(0);
                }}
                selected={filters.assignee === currentUsername}
              >
                My Incidents
              </MenuItem>
              <MenuItem 
                onClick={() => { 
                  setFilters(prev => ({ ...prev, assignee: '', showAll: false })); 
                  setAssigneeMenuAnchor(null);
                  setPage(0);
                }}
                selected={filters.assignee === ''}
              >
                Unassigned
              </MenuItem>
              <Divider />
              {uniqueAssignees.map((assignee) => (
                <MenuItem 
                  key={assignee}
                  onClick={() => { 
                    setFilters(prev => ({ ...prev, assignee, showAll: false })); 
                    setAssigneeMenuAnchor(null);
                    setPage(0);
                  }}
                  selected={filters.assignee === assignee}
                >
                  {assignee}
                </MenuItem>
              ))}
            </Menu>

            {/* Show All toggle */}
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={filters.showAll}
                  onChange={(e) => {
                    setFilters(prev => ({ 
                      ...prev, 
                      showAll: e.target.checked, 
                      assignee: e.target.checked ? null : prev.assignee 
                    }));
                    setPage(0);
                  }}
                />
              }
              label={<Typography variant="body2">Show All</Typography>}
              sx={{ ml: 0 }}
            />

            <Tooltip title="Configure columns">
              <IconButton onClick={(e) => setColumnMenuAnchor(e.currentTarget)} size="small">
                <ViewColumnIcon />
              </IconButton>
            </Tooltip>

            {/* Active filters */}
            {(filters.severity || filters.status || filters.tlp) && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {filters.severity && (
                  <Chip
                    label={`Severity: ${filters.severity}`}
                    size="small"
                    onDelete={() => setFilters((prev) => ({ ...prev, severity: null }))}
                    sx={{ textTransform: 'capitalize' }}
                  />
                )}
                {filters.status && (
                  <Chip
                    label={`Status: ${filters.status}`}
                    size="small"
                    onDelete={() => setFilters((prev) => ({ ...prev, status: null }))}
                    sx={{ textTransform: 'capitalize' }}
                  />
                )}
                {filters.tlp && (
                  <Chip label={filters.tlp} size="small" onDelete={() => setFilters((prev) => ({ ...prev, tlp: null }))} />
                )}
              </Box>
            )}

            {hasActiveFilters && (
              <Button size="small" onClick={clearFilters} sx={{ minWidth: 'auto' }}>
                Reset
              </Button>
            )}

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
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleRowClick(incident)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {incident.status !== 'resolved' && (
                          <Tooltip title="Resolve Incident">
                            <IconButton
                              size="small"
                              onClick={() => handleResolveIncident(incident.id)}
                              sx={{ color: 'success.main' }}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
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
        <Divider />
        {COLUMNS.map((col) => (
          <MenuItem key={col.key} onClick={() => toggleColumn(col.key)} dense>
            <FormControlLabel
              control={<Switch size="small" checked={visibleColumns.has(col.key)} />}
              label={col.label}
              sx={{ width: '100%', m: 0 }}
            />
          </MenuItem>
        ))}
      </Menu>

      <CreateIncidentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateIncident}
      />

      <IncidentDetailDialog
        open={detailDialogOpen}
        incident={selectedIncident}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedIncident(null);
        }}
        onResolve={handleResolveIncident}
        onUpdate={handleUpdateIncident}
      />
    </motion.div>
  );
};

export default IncidentsPage;
