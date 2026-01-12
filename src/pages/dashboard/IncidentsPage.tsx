import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useDatastore } from '@/hooks/useDatastore';
import { DATASTORE_CATEGORIES, getDatastoreByCategory, setDatastoreItems } from '@/services/datastore';
import { CreateIncidentDialog, OCSFIncidentFinding, Observable } from '@/components/incidents/CreateIncidentDialog';
import { IncidentDetailDialog } from '@/components/incidents/IncidentDetailDialog';

// Legacy categories for migration
const LEGACY_ALERTS_CATEGORY = 'shuffle-alerts';
const LEGACY_SECURITY_ALERTS_CATEGORY = 'shuffle-security_alerts';

// Check if migration already happened (stored in localStorage)
const MIGRATION_KEY = 'shuffle_incidents_migrated_v1';

// Migrate data from old categories to new INCIDENTS category (one-time only)
const migrateToIncidents = async (): Promise<number> => {
  // Skip if already migrated
  if (localStorage.getItem(MIGRATION_KEY)) {
    return 0;
  }

  try {
    let allItems: { key: string; value: string }[] = [];

    // Fetch from old alert category
    const oldAlerts = await getDatastoreByCategory(LEGACY_ALERTS_CATEGORY);
    if (oldAlerts.success && oldAlerts.data && oldAlerts.data.length > 0) {
      allItems = [...allItems, ...oldAlerts.data.map(item => ({ key: item.key, value: item.value }))];
    }

    // Fetch from security_alerts category
    const securityAlerts = await getDatastoreByCategory(LEGACY_SECURITY_ALERTS_CATEGORY);
    if (securityAlerts.success && securityAlerts.data && securityAlerts.data.length > 0) {
      allItems = [...allItems, ...securityAlerts.data.map(item => ({ key: item.key, value: item.value }))];
    }

    if (allItems.length === 0) {
      // Mark as migrated even if no data (nothing to migrate)
      localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
      return 0;
    }

    // Write to new INCIDENTS category
    const result = await setDatastoreItems(allItems, DATASTORE_CATEGORIES.INCIDENTS);
    if (result.success) {
      console.log(`Migrated ${allItems.length} items to INCIDENTS category`);
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
  edited?: string;
  tlp?: string;
  pap?: string;
  references?: string[];
  observables?: Observable[];
  relatedFindings?: string[];
  rawOCSF?: OCSFIncidentFinding;
}

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  informational: '#3b82f6',
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

// Convert OCSF severity to display severity
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

// Convert OCSF status to display status
const mapOCSFStatus = (statusId: number): string => {
  switch (statusId) {
    case 1: return 'new';
    case 2: return 'in_progress';
    case 3: return 'resolved';
    default: return 'new';
  }
};

// Format timestamp from datastore (Unix seconds to readable date)
const formatTimestamp = (timestamp: number | string | undefined): string => {
  if (!timestamp) return 'Unknown';
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  const ms = ts < 10000000000 ? ts * 1000 : ts;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Parse incident from datastore (handles both OCSF Incident Finding and legacy formats)
const parseIncidentFromDatastore = (item: { key: string; value: string; created?: number; edited?: number }): DisplayIncident | null => {
  try {
    const data = JSON.parse(item.value);
    
    // Check if it's OCSF format (has finding_info or severity_id)
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
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
        tlp: ocsf.tlp,
        pap: ocsf.pap,
        references: ocsf.finding_info?.references,
        observables: ocsf.observables,
        relatedFindings: ocsf.related_findings,
        rawOCSF: ocsf,
      };
    } else {
      // Legacy format - simple object with direct properties
      return {
        id: data.id || item.key,
        title: data.title || 'Untitled',
        source: data.source || 'Unknown',
        severity: (data.severity || 'medium').toLowerCase(),
        status: (data.status || 'new').toLowerCase().replace('_', ''),
        assignee: data.assignee || null,
        created: formatTimestamp(item.created),
        edited: item.edited ? formatTimestamp(item.edited) : undefined,
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
}

const IncidentsPage = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [incidents, setIncidents] = useState<DisplayIncident[]>([]);
  const [filters, setFilters] = useState<Filters>({ severity: null, status: null, tlp: null });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<DisplayIncident | null>(null);

  const { items: datastoreItems, isLoading, error, fetchItems, addItem } = useDatastore({
    category: DATASTORE_CATEGORIES.INCIDENTS,
  });

  // Migrate data from old categories and fetch incidents on mount
  useEffect(() => {
    const init = async () => {
      const migratedCount = await migrateToIncidents();
      if (migratedCount > 0) {
        console.log(`Migration complete: ${migratedCount} items moved to incidents`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      await fetchItems();
    };
    init();
  }, [fetchItems]);

  // Parse datastore items
  useEffect(() => {
    const realIncidents: DisplayIncident[] = datastoreItems
      .map((item) => parseIncidentFromDatastore(item))
      .filter((a): a is DisplayIncident => a !== null);

    setIncidents(realIncidents);
  }, [datastoreItems]);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(incidents.map((i) => i.id));
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

    // Optimistically update local state immediately
    setIncidents(prev => prev.map(i => 
      i.id === incidentId 
        ? { ...i, status: 'resolved' } 
        : i
    ));

    const updatedOCSF: OCSFIncidentFinding = {
      ...incident.rawOCSF,
      status_id: 3, // Resolved
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

  // Filter incidents based on active filters
  const filteredIncidents = incidents.filter((incident) => {
    if (filters.severity && incident.severity !== filters.severity) return false;
    if (filters.status && incident.status !== filters.status) return false;
    if (filters.tlp && incident.tlp !== filters.tlp) return false;
    return true;
  });

  const handleChipFilter = (type: keyof Filters, value: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setFilters((prev) => ({
      ...prev,
      [type]: prev[type] === value ? null : value,
    }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({ severity: null, status: null, tlp: null });
    setPage(0);
  };

  const hasActiveFilters = filters.severity || filters.status || filters.tlp;

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
            <Typography variant="caption" color="error">
              {error}
            </Typography>
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
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <TextField
              size="small"
              placeholder="Search incidents..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
            {hasActiveFilters && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Filters:
                </Typography>
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
                  <Chip
                    label={filters.tlp}
                    size="small"
                    onDelete={() => setFilters((prev) => ({ ...prev, tlp: null }))}
                  />
                )}
                <Button size="small" onClick={clearFilters} sx={{ minWidth: 'auto' }}>
                  Clear all
                </Button>
              </Box>
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
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < filteredIncidents.length}
                      checked={filteredIncidents.length > 0 && selected.length === filteredIncidents.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Incident</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>TLP</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Assignee</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredIncidents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((incident) => (
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
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {incident.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {incident.id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={incident.source}
                        size="small"
                        sx={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                      />
                    </TableCell>
                    <TableCell>
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
                          '&:hover': {
                            backgroundColor: `${severityColors[incident.severity] || '#94a3b8'}35`,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {incident.tlp && (
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
                            '&:hover': {
                              backgroundColor: `${tlpColors[incident.tlp] || '#94a3b8'}35`,
                            },
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
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
                          '&:hover': {
                            opacity: 0.8,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {incident.assignee || (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {incident.created}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleRowClick(incident)}
                          >
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
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredIncidents.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </CardContent>
      </Card>

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
