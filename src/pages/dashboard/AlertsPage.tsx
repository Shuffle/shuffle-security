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
  Menu,
  MenuItem,
  Checkbox,
  TablePagination,
  CircularProgress,
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDatastore } from '@/hooks/useDatastore';
import { DATASTORE_CATEGORIES } from '@/services/datastore';
import { CreateAlertDialog, OCSFDetection } from '@/components/alerts/CreateAlertDialog';

interface DisplayAlert {
  id: string;
  title: string;
  source: string;
  severity: string;
  status: string;
  assignee: string | null;
  created: string;
  isDummy?: boolean;
}

// Dummy alerts for demo purposes
const dummyAlerts: DisplayAlert[] = [
  { id: 'DEMO-001', title: 'Suspicious Login Activity', source: 'SIEM', severity: 'critical', status: 'new', assignee: 'John D.', created: '2026-01-07 10:23', isDummy: true },
  { id: 'DEMO-002', title: 'Malware Detection on Endpoint', source: 'EDR', severity: 'high', status: 'in_progress', assignee: 'Sarah M.', created: '2026-01-07 10:15', isDummy: true },
  { id: 'DEMO-003', title: 'Unusual Outbound Traffic', source: 'Firewall', severity: 'medium', status: 'new', assignee: null, created: '2026-01-07 09:45', isDummy: true },
  { id: 'DEMO-004', title: 'Brute Force Attack Detected', source: 'IDS', severity: 'high', status: 'escalated', assignee: 'Mike R.', created: '2026-01-07 09:30', isDummy: true },
  { id: 'DEMO-005', title: 'Policy Violation - USB Device', source: 'DLP', severity: 'low', status: 'resolved', assignee: 'John D.', created: '2026-01-07 09:12', isDummy: true },
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
  in_progress: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  escalated: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  resolved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  suppressed: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
  other: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
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
    case 3: return 'suppressed';
    default: return 'other';
  }
};

// Parse OCSF detection to display alert
const parseOCSFToAlert = (ocsf: OCSFDetection): DisplayAlert => {
  const date = new Date(ocsf.time);
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  
  return {
    id: ocsf.finding_info?.uid || `ALR-${ocsf.time}`,
    title: ocsf.finding_info?.title || ocsf.message,
    source: ocsf.metadata?.product?.name || ocsf.finding_info?.types?.[0] || 'Unknown',
    severity: mapOCSFSeverity(ocsf.severity_id),
    status: mapOCSFStatus(ocsf.status_id),
    assignee: null,
    created: formattedDate,
    isDummy: false,
  };
};

const AlertsPage = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuAlertId, setMenuAlertId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<DisplayAlert[]>(dummyAlerts);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { items: datastoreItems, isLoading, error, fetchItems, addItem } = useDatastore({
    category: DATASTORE_CATEGORIES.ALERTS,
  });

  // Fetch alerts from datastore on mount
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Parse datastore items (OCSF format) and combine with dummy alerts
  useEffect(() => {
    const realAlerts: DisplayAlert[] = datastoreItems.map((item) => {
      try {
        const ocsf = JSON.parse(item.value) as OCSFDetection;
        return parseOCSFToAlert(ocsf);
      } catch {
        return null;
      }
    }).filter((a): a is DisplayAlert => a !== null);

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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    setAnchorEl(event.currentTarget);
    setMenuAlertId(id);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuAlertId(null);
  };

  const handleCreateAlert = async (ocsf: OCSFDetection) => {
    const key = ocsf.finding_info.uid;
    await addItem(key, ocsf);
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
                <Button variant="outlined" color="error">
                  Dismiss ({selected.length})
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
                  >
                    <TableCell padding="checkbox">
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
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, alert.id)}
                      >
                        <MoreVertIcon />
                      </IconButton>
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

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            minWidth: 180,
            backgroundImage: 'linear-gradient(145deg, #1e293b 0%, #162032 100%)',
          },
        }}
      >
        <MenuItem onClick={handleMenuClose}>
          <VisibilityIcon fontSize="small" sx={{ mr: 1.5 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <FolderSpecialIcon fontSize="small" sx={{ mr: 1.5 }} />
          Create Case
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
          Dismiss
        </MenuItem>
      </Menu>

      <CreateAlertDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateAlert}
      />
    </motion.div>
  );
};

export default AlertsPage;
