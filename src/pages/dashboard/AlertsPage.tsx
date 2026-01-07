import { useState } from 'react';
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
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import DeleteIcon from '@mui/icons-material/Delete';

const alerts = [
  { id: 'ALR-001', title: 'Suspicious Login Activity', source: 'SIEM', severity: 'critical', status: 'new', assignee: 'John D.', created: '2026-01-07 10:23' },
  { id: 'ALR-002', title: 'Malware Detection on Endpoint', source: 'EDR', severity: 'high', status: 'in_progress', assignee: 'Sarah M.', created: '2026-01-07 10:15' },
  { id: 'ALR-003', title: 'Unusual Outbound Traffic', source: 'Firewall', severity: 'medium', status: 'new', assignee: null, created: '2026-01-07 09:45' },
  { id: 'ALR-004', title: 'Brute Force Attack Detected', source: 'IDS', severity: 'high', status: 'escalated', assignee: 'Mike R.', created: '2026-01-07 09:30' },
  { id: 'ALR-005', title: 'Policy Violation - USB Device', source: 'DLP', severity: 'low', status: 'resolved', assignee: 'John D.', created: '2026-01-07 09:12' },
  { id: 'ALR-006', title: 'Phishing Email Reported', source: 'Email Gateway', severity: 'medium', status: 'new', assignee: null, created: '2026-01-07 08:55' },
  { id: 'ALR-007', title: 'Privilege Escalation Attempt', source: 'SIEM', severity: 'critical', status: 'in_progress', assignee: 'Sarah M.', created: '2026-01-07 08:30' },
  { id: 'ALR-008', title: 'Unauthorized Access Attempt', source: 'IAM', severity: 'high', status: 'new', assignee: null, created: '2026-01-07 08:15' },
];

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  new: { bg: 'rgba(34, 184, 207, 0.15)', text: '#22b8cf' },
  in_progress: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  escalated: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  resolved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
};

const AlertsPage = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuAlertId, setMenuAlertId] = useState<string | null>(null);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Alerts
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: severityColors[alert.severity],
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            color: severityColors[alert.severity],
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
                          backgroundColor: statusColors[alert.status].bg,
                          color: statusColors[alert.status].text,
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
    </motion.div>
  );
};

export default AlertsPage;
