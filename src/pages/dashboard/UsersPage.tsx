import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  CircularProgress,
  Alert,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Upload as UploadIcon,
  SmartToy as AiIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { setDatastoreItem, getDatastoreItem, DATASTORE_CATEGORIES } from '@/services/datastore';
import { WeeklyScheduleTimeline, AI_AGENT_SCHEDULE } from '@/components/users/WeeklyScheduleTimeline';
import { ScheduleImportDialog } from '@/components/users/ScheduleImportDialog';

// Escalation levels for assignment priority
type EscalationLevel = 'tier1' | 'tier2' | 'tier3' | 'manager';

const ESCALATION_LABELS: Record<EscalationLevel, string> = {
  tier1: 'Tier 1 - First Response',
  tier2: 'Tier 2 - Specialist',
  tier3: 'Tier 3 - Expert',
  manager: 'Manager - Escalation',
};

const ESCALATION_COLORS: Record<EscalationLevel, string> = {
  tier1: '#4caf50',
  tier2: '#2196f3',
  tier3: '#ff9800',
  manager: '#f44336',
};

interface ScheduleEntry {
  id: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  daysOfWeek: number[];
}

interface UserSchedule {
  userId: string;
  userName: string;
  userEmail: string;
  escalationLevel: EscalationLevel;
  schedules: ScheduleEntry[];
  enabled: boolean;
}

interface AssignmentConfig {
  userSchedules: UserSchedule[];
  updatedAt: string;
  autoInitialized?: boolean;
}

interface User {
  id: string;
  username: string;
  role: string;
  active: boolean;
  orgs?: string[];
  created_at?: number;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const generateId = () => Math.random().toString(36).substring(2, 12);

// Generate a default schedule (Mon-Fri 9-17, for the next year)
const createDefaultSchedule = (): ScheduleEntry => ({
  id: generateId(),
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '17:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  daysOfWeek: [1, 2, 3, 4, 5],
});

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { sessionToken } = useAuth();
  
  // Assignment config state
  const [config, setConfig] = useState<AssignmentConfig>({ userSchedules: [], updatedAt: '' });
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  
  // Escalation dialog
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [escalationUserId, setEscalationUserId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<EscalationLevel>('tier1');
  
  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Schedule timeline dialog
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  
  // Schedule entry form
  const [entryStartDate, setEntryStartDate] = useState('');
  const [entryEndDate, setEntryEndDate] = useState('');
  const [entryStartTime, setEntryStartTime] = useState('09:00');
  const [entryEndTime, setEntryEndTime] = useState('17:00');
  const [entryDays, setEntryDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(getApiUrl('/getusers'), {
          credentials: 'include',
          headers: {
            ...getAuthHeader(sessionToken),
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.reason || 'Failed to fetch users');
        }

        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [sessionToken]);

  // Load assignment config
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const response = await getDatastoreItem('assignment_schedules', DATASTORE_CATEGORIES.CONFIGURATION);
      if (response.success && response.item?.value) {
        const data = typeof response.item.value === 'string' 
          ? JSON.parse(response.item.value) 
          : response.item.value;
        setConfig(data);
      }
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Auto-initialize rotation when users are loaded and config has no schedules
  useEffect(() => {
    const autoInitialize = async () => {
      if (loading || configLoading || users.length === 0 || config.autoInitialized) return;
      if (config.userSchedules.length > 0) return;
      
      // Create a default rotation with all active users
      const activeUsers = users.filter(u => u.active !== false);
      if (activeUsers.length === 0) return;
      
      // Distribute users across escalation levels
      const newSchedules: UserSchedule[] = activeUsers.map((user, index) => {
        let escalationLevel: EscalationLevel = 'tier1';
        if (user.role === 'admin') {
          escalationLevel = 'manager';
        } else if (index % 3 === 1) {
          escalationLevel = 'tier2';
        } else if (index % 3 === 2) {
          escalationLevel = 'tier3';
        }
        
        return {
          userId: user.id,
          userName: user.username,
          userEmail: user.username,
          escalationLevel,
          schedules: [createDefaultSchedule()],
          enabled: true,
        };
      });
      
      const newConfig: AssignmentConfig = {
        userSchedules: newSchedules,
        updatedAt: new Date().toISOString(),
        autoInitialized: true,
      };
      
      await saveConfig(newConfig, true);
    };
    
    autoInitialize();
  }, [loading, configLoading, users, config]);

  const saveConfig = async (newConfig: AssignmentConfig, silent = false) => {
    setIsSaving(true);
    setConfigError(null);
    try {
      const configToSave = {
        ...newConfig,
        updatedAt: new Date().toISOString(),
      };
      const response = await setDatastoreItem('assignment_schedules', configToSave, DATASTORE_CATEGORIES.CONFIGURATION);
      if (response.success) {
        setConfig(configToSave);
        if (!silent) {
          toast.success('Schedule saved successfully');
        }
      } else {
        throw new Error(response.error || 'Failed to save configuration');
      }
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRow = (userId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const getUserSchedule = (userId: string): UserSchedule | undefined => {
    return config.userSchedules.find(s => s.userId === userId);
  };

  const handleToggleEnabled = (userId: string) => {
    const schedule = getUserSchedule(userId);
    if (schedule) {
      const newUserSchedules = config.userSchedules.map(s =>
        s.userId === userId ? { ...s, enabled: !s.enabled } : s
      );
      saveConfig({ ...config, userSchedules: newUserSchedules });
    } else {
      // Create new schedule for user
      const user = users.find(u => u.id === userId);
      if (user) {
        const newSchedule: UserSchedule = {
          userId: user.id,
          userName: user.username,
          userEmail: user.username,
          escalationLevel: 'tier1',
          schedules: [createDefaultSchedule()],
          enabled: true,
        };
        saveConfig({ ...config, userSchedules: [...config.userSchedules, newSchedule] });
      }
    }
  };

  const handleEditEscalation = (userId: string) => {
    const schedule = getUserSchedule(userId);
    setEscalationUserId(userId);
    setSelectedLevel(schedule?.escalationLevel || 'tier1');
    setEscalationDialogOpen(true);
  };

  const handleSaveEscalation = () => {
    if (!escalationUserId) return;
    
    const schedule = getUserSchedule(escalationUserId);
    if (schedule) {
      const newUserSchedules = config.userSchedules.map(s =>
        s.userId === escalationUserId ? { ...s, escalationLevel: selectedLevel } : s
      );
      saveConfig({ ...config, userSchedules: newUserSchedules });
    } else {
      const user = users.find(u => u.id === escalationUserId);
      if (user) {
        const newSchedule: UserSchedule = {
          userId: user.id,
          userName: user.username,
          userEmail: user.username,
          escalationLevel: selectedLevel,
          schedules: [createDefaultSchedule()],
          enabled: true,
        };
        saveConfig({ ...config, userSchedules: [...config.userSchedules, newSchedule] });
      }
    }
    setEscalationDialogOpen(false);
  };

  const handleAddScheduleEntry = (userId: string) => {
    setEditingUserId(userId);
    setEditingEntry(null);
    setEntryStartDate(new Date().toISOString().split('T')[0]);
    setEntryEndDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setEntryStartTime('09:00');
    setEntryEndTime('17:00');
    setEntryDays([1, 2, 3, 4, 5]);
    setScheduleDialogOpen(true);
  };

  const handleEditScheduleEntry = (userId: string, entry: ScheduleEntry) => {
    setEditingUserId(userId);
    setEditingEntry(entry);
    setEntryStartDate(entry.startDate);
    setEntryEndDate(entry.endDate);
    setEntryStartTime(entry.startTime);
    setEntryEndTime(entry.endTime);
    setEntryDays(entry.daysOfWeek);
    setScheduleDialogOpen(true);
  };

  const handleSaveScheduleEntry = () => {
    if (!editingUserId) return;
    
    const newEntry: ScheduleEntry = {
      id: editingEntry?.id || generateId(),
      startDate: entryStartDate,
      endDate: entryEndDate,
      startTime: entryStartTime,
      endTime: entryEndTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      daysOfWeek: entryDays,
    };

    const schedule = getUserSchedule(editingUserId);
    if (schedule) {
      let newSchedules: ScheduleEntry[];
      if (editingEntry) {
        newSchedules = schedule.schedules.map(e => e.id === editingEntry.id ? newEntry : e);
      } else {
        newSchedules = [...schedule.schedules, newEntry];
      }
      
      const newUserSchedules = config.userSchedules.map(s =>
        s.userId === editingUserId ? { ...s, schedules: newSchedules } : s
      );
      saveConfig({ ...config, userSchedules: newUserSchedules });
    } else {
      const user = users.find(u => u.id === editingUserId);
      if (user) {
        const newSchedule: UserSchedule = {
          userId: user.id,
          userName: user.username,
          userEmail: user.username,
          escalationLevel: 'tier1',
          schedules: [newEntry],
          enabled: true,
        };
        saveConfig({ ...config, userSchedules: [...config.userSchedules, newSchedule] });
      }
    }
    setScheduleDialogOpen(false);
  };

  const handleDeleteScheduleEntry = (userId: string, entryId: string) => {
    const newUserSchedules = config.userSchedules.map(s => {
      if (s.userId !== userId) return s;
      return { ...s, schedules: s.schedules.filter(e => e.id !== entryId) };
    });
    saveConfig({ ...config, userSchedules: newUserSchedules });
  };

  const toggleDay = (day: number) => {
    setEntryDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  // Handle imported schedules
  const handleImportSchedules = (importedSchedules: UserSchedule[]) => {
    // Merge with existing schedules
    const newUserSchedules = [...config.userSchedules];
    
    for (const imported of importedSchedules) {
      const existingIndex = newUserSchedules.findIndex(s => s.userId === imported.userId);
      if (existingIndex >= 0) {
        // Merge schedules
        newUserSchedules[existingIndex] = {
          ...newUserSchedules[existingIndex],
          schedules: [...newUserSchedules[existingIndex].schedules, ...imported.schedules],
        };
      } else {
        newUserSchedules.push(imported);
      }
    }
    
    saveConfig({ ...config, userSchedules: newUserSchedules });
  };

  // Get all schedules including AI Agent for timeline
  const allSchedulesForTimeline = [
    AI_AGENT_SCHEDULE,
    ...config.userSchedules,
  ];

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Users
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mt: 0.5 }}>
            Manage users and their auto-assignment schedules
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<CalendarIcon />}
            onClick={() => setTimelineDialogOpen(true)}
            sx={{
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
            }}
          >
            View Scheduling
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            disabled
            sx={{
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--muted-foreground))',
              '&.Mui-disabled': {
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--muted-foreground))',
                opacity: 0.5,
              },
            }}
          >
            Import Schedule
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {configError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {configError}
        </Alert>
      )}

      {loading || configLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'hsl(var(--primary))' }} />
        </Box>
      ) : (
        <>

          {/* AI Agent Row */}
          <Paper 
            sx={{ 
              p: 2, 
              mb: 3,
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: '#9c27b0', width: 40, height: 40 }}>
                <AiIcon />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  AI Agent
                </Typography>
                <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                  24/7 fallback coverage • Handles alerts when no human is available
                </Typography>
              </Box>
            </Box>
            <Chip 
              label="Always Active" 
              size="small"
              sx={{ 
                bgcolor: '#9c27b040',
                color: '#9c27b0',
                fontWeight: 500,
              }} 
            />
          </Paper>

          <TableContainer 
            component={Paper} 
            sx={{ 
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            }}
          >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))', width: 48 }} />
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>User</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Role</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Status</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Escalation Level</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Auto-Assign</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>
                      No users found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const schedule = getUserSchedule(user.id);
                  const isExpanded = expandedRows.has(user.id);
                  
                  return (
                    <>
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <IconButton 
                            size="small" 
                            onClick={() => toggleRow(user.id)}
                            sx={{ color: 'hsl(var(--muted-foreground))' }}
                          >
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'hsl(var(--primary))', width: 32, height: 32 }}>
                              {user.username?.charAt(0).toUpperCase() || '?'}
                            </Avatar>
                            <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))' }}>
                              {user.username}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.role || 'user'}
                            size="small"
                            sx={{
                              bgcolor: user.role === 'admin' ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                              color: user.role === 'admin' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.active !== false ? 'Active' : 'Inactive'}
                            size="small"
                            sx={{
                              bgcolor: user.active !== false ? 'hsla(142, 76%, 36%, 0.2)' : 'hsl(var(--muted))',
                              color: user.active !== false ? 'hsl(142, 76%, 36%)' : 'hsl(var(--muted-foreground))',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {schedule ? (
                              <Chip
                                label={ESCALATION_LABELS[schedule.escalationLevel]}
                                size="small"
                                sx={{ 
                                  bgcolor: ESCALATION_COLORS[schedule.escalationLevel],
                                  color: 'white',
                                }}
                              />
                            ) : (
                              <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                                Not configured
                              </Typography>
                            )}
                            <IconButton size="small" onClick={() => handleEditEscalation(user.id)}>
                              <EditIcon fontSize="small" sx={{ color: 'hsl(var(--muted-foreground))' }} />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant={schedule?.enabled ? 'contained' : 'outlined'}
                            startIcon={schedule?.enabled ? <CheckCircleIcon /> : <ScheduleIcon />}
                            onClick={() => handleToggleEnabled(user.id)}
                            disabled={isSaving}
                            sx={{
                              bgcolor: schedule?.enabled ? 'hsl(var(--primary))' : 'transparent',
                              color: schedule?.enabled ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                              borderColor: 'hsl(var(--border))',
                            }}
                          >
                            {schedule?.enabled ? 'Enabled' : 'Disabled'}
                          </Button>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded row for schedule details */}
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 0, px: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 3, bgcolor: 'hsl(var(--muted) / 0.3)' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ color: 'hsl(var(--foreground))' }}>
                                  Availability Windows
                                </Typography>
                                <Button
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => handleAddScheduleEntry(user.id)}
                                >
                                  Add Window
                                </Button>
                              </Box>
                              
                              {!schedule || schedule.schedules.length === 0 ? (
                                <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
                                  No availability windows configured - user will not be auto-assigned
                                </Typography>
                              ) : (
                                <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'hsl(var(--card))' }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Date Range</TableCell>
                                        <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Hours</TableCell>
                                        <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Days</TableCell>
                                        <TableCell sx={{ color: 'hsl(var(--muted-foreground))', width: 80 }}>Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {schedule.schedules.map((entry) => (
                                        <TableRow key={entry.id}>
                                          <TableCell sx={{ color: 'hsl(var(--foreground))' }}>
                                            {new Date(entry.startDate).toLocaleDateString()} - {new Date(entry.endDate).toLocaleDateString()}
                                          </TableCell>
                                          <TableCell sx={{ color: 'hsl(var(--foreground))' }}>
                                            {entry.startTime} - {entry.endTime}
                                          </TableCell>
                                          <TableCell sx={{ color: 'hsl(var(--foreground))' }}>
                                            {entry.daysOfWeek.map(d => DAYS_OF_WEEK[d]).join(', ')}
                                          </TableCell>
                                          <TableCell>
                                            <IconButton size="small" onClick={() => handleEditScheduleEntry(user.id, entry)}>
                                              <EditIcon fontSize="small" sx={{ color: 'hsl(var(--muted-foreground))' }} />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDeleteScheduleEntry(user.id, entry.id)}>
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        </>
      )}

      {/* Escalation Level Dialog */}
      <Dialog open={escalationDialogOpen} onClose={() => setEscalationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Escalation Level</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Escalation Level</InputLabel>
            <Select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as EscalationLevel)}
              label="Escalation Level"
            >
              {Object.entries(ESCALATION_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box 
                      sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        bgcolor: ESCALATION_COLORS[key as EscalationLevel] 
                      }} 
                    />
                    {label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEscalationDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEscalation} variant="contained" disabled={isSaving}>
            {isSaving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Entry Dialog */}
      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEntry ? 'Edit Availability Window' : 'Add Availability Window'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box display="flex" gap={2}>
              <TextField
                label="Start Date"
                type="date"
                value={entryStartDate}
                onChange={(e) => setEntryStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Date"
                type="date"
                value={entryEndDate}
                onChange={(e) => setEntryEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>

            <Box display="flex" gap={2}>
              <TextField
                label="Start Time"
                type="time"
                value={entryStartTime}
                onChange={(e) => setEntryStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Time"
                type="time"
                value={entryEndTime}
                onChange={(e) => setEntryEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>

            <Box>
              <Typography variant="body2" mb={1}>Days of Week</Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {DAYS_OF_WEEK.map((day, index) => (
                  <Chip
                    key={day}
                    label={day}
                    onClick={() => toggleDay(index)}
                    color={entryDays.includes(index) ? 'primary' : 'default'}
                    variant={entryDays.includes(index) ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveScheduleEntry} 
            variant="contained" 
            disabled={!entryStartDate || !entryEndDate || entryDays.length === 0 || isSaving}
          >
            {isSaving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Timeline Dialog */}
      <Dialog 
        open={timelineDialogOpen} 
        onClose={() => setTimelineDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(180deg, #262626 0%, #1f1f1f 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        <DialogTitle sx={{ color: 'hsl(var(--foreground))' }}>
          On-Call Schedule
        </DialogTitle>
        <DialogContent>
          <WeeklyScheduleTimeline userSchedules={allSchedulesForTimeline} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimelineDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Import Dialog */}
      <ScheduleImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        existingUsers={users}
        onImport={handleImportSchedules}
      />
    </Box>
  );
};

export default UsersPage;
