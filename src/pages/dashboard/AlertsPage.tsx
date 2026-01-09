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
  isDummy?: boolean;
  rawOCSF?: OCSFDetection;
}

// Dummy alerts for demo purposes
const dummyAlerts: DisplayAlert[] = [
  { id: 'DEMO-001', title: 'Suspicious Login Activity', source: 'SIEM', severity: 'critical', status: 'new', assignee: 'John D.', created: '2026-01-07 10:23', tlp: 'TLP:RED', pap: 'PAP:RED', isDummy: true },
  { id: 'DEMO-002', title: 'Malware Detection on Endpoint', source: 'EDR', severity: 'high', status: 'escalated', assignee: 'Sarah M.', created: '2026-01-07 10:15', tlp: 'TLP:AMBER', pap: 'PAP:AMBER', isDummy: true },
  { id: 'DEMO-003', title: 'Unusual Outbound Traffic', source: 'Firewall', severity: 'medium', status: 'new', assignee: null, created: '2026-01-07 09:45', tlp: 'TLP:GREEN', pap: 'PAP:GREEN', isDummy: true },
  { id: 'DEMO-004', title: 'Brute Force Attack Detected', source: 'IDS', severity: 'high', status: 'escalated', assignee: 'Mike R.', created: '2026-01-07 09:30', tlp: 'TLP:AMBER', pap: 'PAP:AMBER', isDummy: true },
  { id: 'DEMO-005', title: 'Policy Violation - USB Device', source: 'DLP', severity: 'low', status: 'resolved', assignee: 'John D.', created: '2026-01-07 09:12', tlp: 'TLP:CLEAR', pap: 'PAP:CLEAR', isDummy: true },
];

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

// Format timestamp from datastore
const formatTimestamp = (timestamp: number | string | undefined): string => {
  if (!timestamp) return 'Unknown';
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp, 10) * 1000 : timestamp);
  if (isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Parse OCSF detection to display alert
const parseOCSFToAlert = (item: { key: string; value: string; created?: number; edited?: number }): DisplayAlert | null => {
  try {
    const ocsf = JSON.parse(item.value) as OCSFDetection;
    
    return {
      id: ocsf.finding_info?.uid || item.key,
      title: ocsf.finding_info?.title || ocsf.message,
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
      isDummy: false,
      rawOCSF: ocsf,
    };
  } catch {
    return null;
  }
};

const AlertsPage = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [alerts, setAlerts] = useState<DisplayAlert[]>(dummyAlerts);
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
      .map((item) => parseOCSFToAlert(item))
      .filter((a): a is DisplayAlert => a !== null);

    // Real alerts first, then dummy alerts
    setAlerts([...realAlerts, ...dummyAlerts]);
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
    if (!alert || alert.isDummy || !alert.rawOCSF) return;

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
    if (!alert || alert.isDummy || !alert.rawOCSF) return;

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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Alert
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, display: 'flex', gap: 2, borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
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
            <Button variant="outlined" startIcon={<FilterListIcon />}>
              Filters
            </Button>
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
                      indeterminate={selected.length > 0 && selected.length < alerts.length}
                      checked={selected.length === alerts.length}
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
                {alerts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((alert) => (
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {alert.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {alert.id}
                            </Typography>
                            {alert.isDummy && (
                              <Chip
                                label="Demo"
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.65rem',
                                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                  color: '#a78bfa',
                                }}
                              />
                            )}
                          </Box>
                        </Box>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: severityColors[alert.severity] || '#94a3b8',
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            color: severityColors[alert.severity] || '#94a3b8',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          {alert.severity}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {alert.tlp && (
                        <Chip
                          label={alert.tlp}
                          size="small"
                          sx={{
                            backgroundColor: `${tlpColors[alert.tlp] || '#94a3b8'}20`,
                            color: tlpColors[alert.tlp] || '#94a3b8',
                            border: tlpColors[alert.tlp] === '#ffffff' ? '1px solid #666' : 'none',
                            fontWeight: 500,
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={alert.status.replace('_', ' ')}
                        size="small"
                        sx={{
                          backgroundColor: statusColors[alert.status]?.bg || 'rgba(148, 163, 184, 0.1)',
                          color: statusColors[alert.status]?.text || '#94a3b8',
                          fontWeight: 500,
                          textTransform: 'capitalize',
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
                        {!alert.isDummy && alert.status !== 'resolved' && (
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
            count={alerts.length}
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
