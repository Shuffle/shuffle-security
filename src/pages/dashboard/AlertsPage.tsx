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
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useDatastore } from '@/hooks/useDatastore';
import { DATASTORE_CATEGORIES } from '@/services/datastore';
import { CreateAlertDialog, OCSFDetection, Observable } from '@/components/alerts/CreateAlertDialog';
import { AlertDetailDialog } from '@/components/alerts/AlertDetailDialog';

interface DisplayAlert {
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
  rawOCSF?: OCSFDetection;
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
    case 2: return 'escalated';
    case 3: return 'resolved';
    default: return 'new';
  }
};

// Format timestamp from datastore (Unix seconds to readable date)
const formatTimestamp = (timestamp: number | string | undefined): string => {
  if (!timestamp) return 'Unknown';
  // Convert to number and check if it's Unix seconds (10 digits) vs milliseconds (13 digits)
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  const ms = ts < 10000000000 ? ts * 1000 : ts; // Convert seconds to milliseconds if needed
  const date = new Date(ms);
  if (isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Parse alert from datastore (handles both OCSF and legacy formats)
const parseAlertFromDatastore = (item: { key: string; value: string; created?: number; edited?: number }): DisplayAlert | null => {
  try {
    const data = JSON.parse(item.value);
    
    // Check if it's OCSF format (has finding_info or severity_id)
    const isOCSF = data.finding_info || data.severity_id !== undefined;
    
    if (isOCSF) {
      const ocsf = data as OCSFDetection;
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
        rawOCSF: undefined, // Legacy format doesn't have OCSF data
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

const AlertsPage = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [alerts, setAlerts] = useState<DisplayAlert[]>([]);
  const [filters, setFilters] = useState<Filters>({ severity: null, status: null, tlp: null });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<DisplayAlert | null>(null);

  const { items: datastoreItems, isLoading, error, fetchItems, addItem } = useDatastore({
    category: DATASTORE_CATEGORIES.ALERTS,
  });

  // Fetch alerts from datastore on mount
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Parse datastore items (OCSF format) and combine with dummy alerts
  useEffect(() => {
    const realAlerts: DisplayAlert[] = datastoreItems
      .map((item) => parseAlertFromDatastore(item))
      .filter((a): a is DisplayAlert => a !== null);

    setAlerts(realAlerts);
  }, [datastoreItems]);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(alerts.map((a) => a.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleRowClick = (alert: DisplayAlert) => {
    setSelectedAlert(alert);
    setDetailDialogOpen(true);
  };

  const handleCreateAlert = async (ocsf: OCSFDetection) => {
    const key = ocsf.finding_info.uid;
    await addItem(key, ocsf);
    await fetchItems(); // Refresh list after creating
  };

  const handleResolveAlert = async (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert || !alert.rawOCSF) return;

    const updatedOCSF: OCSFDetection = {
      ...alert.rawOCSF,
      status_id: 3, // Resolved
      status: 'Resolved',
    };

    await addItem(alertId, updatedOCSF);
    await fetchItems();
  };

  const handleUpdateAlert = async (alertId: string, updates: Partial<OCSFDetection>) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert || !alert.rawOCSF) return;

    const updatedOCSF: OCSFDetection = {
      ...alert.rawOCSF,
      ...updates,
      finding_info: {
        ...alert.rawOCSF.finding_info,
        ...(updates.finding_info || {}),
      },
    };

    await addItem(alertId, updatedOCSF);
    await fetchItems();
  };

  // Filter alerts based on active filters
  const filteredAlerts = alerts.filter((alert) => {
    if (filters.severity && alert.severity !== filters.severity) return false;
    if (filters.status && alert.status !== filters.status) return false;
    if (filters.tlp && alert.tlp !== filters.tlp) return false;
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
            Alerts
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
            Create Alert
          </Button>
        </Box>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <TextField
              size="small"
              placeholder="Search alerts..."
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
                  Create Case ({selected.length})
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
                      indeterminate={selected.length > 0 && selected.length < filteredAlerts.length}
                      checked={filteredAlerts.length > 0 && selected.length === filteredAlerts.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Alert</TableCell>
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
                {filteredAlerts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((alert) => (
                  <TableRow
                    key={alert.id}
                    hover
                    selected={selected.includes(alert.id)}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(alert)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(alert.id)}
                        onChange={() => handleSelect(alert.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {alert.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {alert.id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={alert.source}
                        size="small"
                        sx={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={alert.severity}
                        size="small"
                        onClick={handleChipFilter('severity', alert.severity)}
                        sx={{
                          backgroundColor: `${severityColors[alert.severity] || '#94a3b8'}20`,
                          color: severityColors[alert.severity] || '#94a3b8',
                          fontWeight: 500,
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: `${severityColors[alert.severity] || '#94a3b8'}35`,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {alert.tlp && (
                        <Chip
                          label={alert.tlp}
                          size="small"
                          onClick={handleChipFilter('tlp', alert.tlp)}
                          sx={{
                            backgroundColor: `${tlpColors[alert.tlp] || '#94a3b8'}20`,
                            color: tlpColors[alert.tlp] || '#94a3b8',
                            border: tlpColors[alert.tlp] === '#ffffff' ? '1px solid #666' : 'none',
                            fontWeight: 500,
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: `${tlpColors[alert.tlp] || '#94a3b8'}35`,
                            },
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={alert.status.replace('_', ' ')}
                        size="small"
                        onClick={handleChipFilter('status', alert.status)}
                        sx={{
                          backgroundColor: statusColors[alert.status]?.bg || 'rgba(148, 163, 184, 0.1)',
                          color: statusColors[alert.status]?.text || '#94a3b8',
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
                      {alert.assignee || (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {alert.created}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleRowClick(alert)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Create Case">
                          <IconButton size="small">
                            <FolderSpecialIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {alert.status !== 'resolved' && (
                          <Tooltip title="Resolve Alert">
                            <IconButton
                              size="small"
                              onClick={() => handleResolveAlert(alert.id)}
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
            count={filteredAlerts.length}
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

      <CreateAlertDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateAlert}
      />

      <AlertDetailDialog
        open={detailDialogOpen}
        alert={selectedAlert}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedAlert(null);
        }}
        onResolve={handleResolveAlert}
        onUpdate={handleUpdateAlert}
      />
    </motion.div>
  );
};

export default AlertsPage;
