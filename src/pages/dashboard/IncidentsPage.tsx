import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useDatastore } from '@/hooks/useDatastore';
import { useAuth } from '@/context/AuthContext';
import { DATASTORE_CATEGORIES, getDatastoreByCategory, setDatastoreItems, CategoryAutomation } from '@/services/datastore';
import { CreateIncidentDialog, OCSFIncidentFinding, Observable } from '@/components/incidents/CreateIncidentDialog';
import { CategoryAutomationsDialog } from '@/components/incidents/CategoryAutomationsDialog';
import { IncidentCardView } from '@/components/incidents/IncidentCardView';
import { IncidentStatsCards } from '@/components/incidents/IncidentStatsCards';

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

type SortDirection = 'asc' | 'desc';
type SortKey = 'title' | 'severity' | 'status' | 'assignee' | 'created' | 'edited';

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

interface Filters {
  severity: string | null;
  status: string | null;
  tlp: string | null;
  assignee: string | null;
}

const IncidentsPage = () => {
  const navigate = useNavigate();
  const { userInfo } = useAuth();
  const currentUsername = userInfo?.username || '';

  const [incidents, setIncidents] = useState<DisplayIncident[]>([]);
  const [filters, setFilters] = useState<Filters>({ severity: null, status: null, tlp: null, assignee: null });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [automationsDialogOpen, setAutomationsDialogOpen] = useState(false);
  const [categoryAutomations, setCategoryAutomations] = useState<CategoryAutomation[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState<SortKey>('edited');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  // Apply smart defaults on initial load only
  const [smartDefaultApplied, setSmartDefaultApplied] = useState(false);

  useEffect(() => {
    if (!smartDefaultApplied && incidents.length > 0) {
      const userIncidents = incidents.filter(i => i.assignee === currentUsername && i.status !== 'resolved');
      if (userIncidents.length > 0) {
        setFilters(prev => ({ ...prev, assignee: currentUsername }));
      } else {
        const newIncidents = incidents.filter(i => i.status === 'new');
        if (newIncidents.length > 0) {
          setFilters(prev => ({ ...prev, status: 'new' }));
        }
      }
      setSmartDefaultApplied(true);
    }
  }, [incidents, currentUsername, smartDefaultApplied]);

  // Filter incidents
  const filteredByAssignee = useMemo(() => {
    if (filters.assignee === null || filters.assignee === 'all') {
      return incidents;
    }
    if (filters.assignee === 'unassigned') {
      return incidents.filter(i => !i.assignee);
    }
    return incidents.filter(i => i.assignee === filters.assignee);
  }, [incidents, filters.assignee]);

  const filteredIncidents = useMemo(() => {
    let result = filteredByAssignee;

    if (filters.severity) {
      result = result.filter(i => i.severity === filters.severity);
    }
    if (filters.status) {
      result = result.filter(i => i.status === filters.status);
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

  const handleRowClick = (incident: DisplayIncident) => {
    navigate(`/incidents/${incident.id}`);
  };

  const handleCreateIncident = async (ocsf: OCSFIncidentFinding) => {
    const key = ocsf.finding_info.uid;
    await addItem(key, ocsf);
    await fetchItems();
  };

  const clearFilters = () => {
    setFilters({ severity: null, status: null, tlp: null, assignee: null });
    setSearchQuery('');
  };

  const hasActiveFilters = filters.severity || filters.status || filters.tlp || filters.assignee !== null || searchQuery.trim();

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

      {/* Floating Filter Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
              }}
              sx={{ width: 280 }}
            />

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

              {hasActiveFilters && (
                <Button size="small" onClick={clearFilters} sx={{ minWidth: 'auto' }}>
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
        }}
      >
        {/* Card list */}
        <IncidentCardView
          incidents={sortedIncidents}
          onIncidentClick={handleRowClick}
          onFilterChange={(type, value) => {
            setFilters(prev => ({
              ...prev,
              [type]: prev[type] === value ? null : value,
            }));
          }}
        />
        
        {/* Stats sidebar */}
        <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
          <IncidentStatsCards 
            incidents={incidents} 
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
    </motion.div>
  );
};

export default IncidentsPage;
