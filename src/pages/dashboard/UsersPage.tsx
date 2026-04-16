import { useState, useEffect, useCallback } from 'react';
import AgentIcon from '@/components/agent/AgentIcon';
import {
  Box,
  Typography,
  Paper,
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
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import TenantManagement from '@/components/tenants/TenantManagement';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Upload as UploadIcon,
  SmartToy as AiIconMui,
  CalendarMonth as CalendarIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { setDatastoreItem, getDatastoreItem, DATASTORE_CATEGORIES } from '@/services/datastore';
import { useEntityPreference } from '@/hooks/useEntityLabel';
import { WeeklyScheduleTimeline, AI_AGENT_SCHEDULE } from '@/components/users/WeeklyScheduleTimeline';
import { ScheduleImportDialog } from '@/components/users/ScheduleImportDialog';

// Escalation levels for assignment priority
type EscalationLevel = 'tier1' | 'tier2' | 'tier3' | 'manager';

const ESCALATION_LABELS: Record<EscalationLevel, string> = {
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
  manager: 'Manager',
};

const ESCALATION_DESCRIPTIONS: Record<EscalationLevel, string> = {
  tier1: 'First Response',
  tier2: 'Specialist',
  tier3: 'Expert',
  manager: 'Escalation',
};

const ESCALATION_COLORS: Record<EscalationLevel, string> = {
  tier1: '#22c55e',
  tier2: '#3b82f6',
  tier3: '#f59e0b',
  manager: '#ef4444',
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

// Motion variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const UsersPage = ({ embedded }: { embedded?: boolean }) => {
  const [activeTab, setActiveTab] = useState(embedded ? 0 : 0);
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
        const response = await fetch(getApiUrl('/api/v1/getusers'), {
          credentials: 'include',
          headers: {
            ...getAuthHeader(),
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
      
      const activeUsers = users.filter(u => u.active !== false);
      if (activeUsers.length === 0) return;
      
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

  const handleImportSchedules = (importedSchedules: UserSchedule[]) => {
    const newUserSchedules = [...config.userSchedules];
    
    for (const imported of importedSchedules) {
      const existingIndex = newUserSchedules.findIndex(s => s.userId === imported.userId);
      if (existingIndex >= 0) {
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

  const allSchedulesForTimeline = [
    AI_AGENT_SCHEDULE,
    ...config.userSchedules,
  ];

  // Stats
  const activeUsers = users.filter(u => u.active !== false).length;
  const configuredUsers = config.userSchedules.filter(s => s.enabled).length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Org Admin Header */}
      <Typography 
        variant="h4" 
        sx={{ 
          fontWeight: 700, 
          color: 'hsl(var(--foreground))',
          letterSpacing: '-0.02em',
          mb: 1,
        }}
      >
        Org Admin
      </Typography>
      <Typography variant="body1" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
        Manage your team members and tenant organizations
      </Typography>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          mb: 4,
          '& .MuiTabs-indicator': { bgcolor: 'hsl(var(--primary))' },
          '& .MuiTab-root': {
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.9rem',
            '&.Mui-selected': { color: 'hsl(var(--foreground))' },
          },
        }}
      >
        <Tab label="User Management" />
        <Tab label="Tenant Management" />
      </Tabs>

      {activeTab === 1 ? (
        <TenantManagement />
      ) : (
      <>
      {/* User Management Content */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700, 
                color: 'hsl(var(--foreground))',
                letterSpacing: '-0.02em',
              }}
            >
              Team Members
            </Typography>
            <Typography variant="body1" sx={{ color: 'hsl(var(--muted-foreground))', mt: 1 }}>
              Configure on-call schedules and auto-assignment for your team
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<CalendarIcon />}
              onClick={() => setTimelineDialogOpen(true)}
              sx={{
                height: 36,
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                '&:hover': {
                  borderColor: 'hsl(var(--primary))',
                  bgcolor: 'hsl(var(--primary) / 0.1)',
                },
              }}
            >
              Schedule View
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Box 
          component={motion.div}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, 
            gap: 2, 
            mt: 4 
          }}
        >
          {[
            { label: 'Total Users', value: users.length, icon: PersonIcon, color: 'hsl(var(--primary))' },
            { label: 'Active', value: activeUsers, icon: CheckCircleIcon, color: '#22c55e' },
            { label: 'On-Call Enabled', value: configuredUsers, icon: ScheduleIcon, color: '#3b82f6' },
          ].map((stat) => (
            <Paper
              key={stat.label}
              sx={{
                p: 2.5,
                bgcolor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  bgcolor: `${stat.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <stat.icon sx={{ color: stat.color, fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                  {stat.label}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>

      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      
      {configError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {configError}
        </Alert>
      )}

      {isSaving && (
        <LinearProgress 
          sx={{ 
            mb: 2, 
            borderRadius: 1,
            bgcolor: 'hsl(var(--muted))',
            '& .MuiLinearProgress-bar': {
              bgcolor: 'hsl(var(--primary))',
            },
          }} 
        />
      )}

      {loading || configLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress sx={{ color: 'hsl(var(--primary))' }} />
        </Box>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* AI Agent Card */}
          <motion.div variants={cardVariants}>
            <Paper 
              sx={{ 
                p: 3, 
                mb: 3,
                bgcolor: 'hsl(var(--card))',
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--accent) / 0.12) 100%)',
                border: '1px solid hsl(var(--border))',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                <AgentIcon size={48} style={{ borderRadius: 8 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    AI Agent
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    24/7 fallback • Handles alerts when no human is available
                  </Typography>
                </Box>
              </Box>
              <Chip 
                label="Always Active" 
                size="small"
                sx={{ 
                  bgcolor: 'hsl(var(--primary) / 0.15)',
                  color: 'hsl(var(--primary))',
                  fontWeight: 600,
                  border: '1px solid hsl(var(--primary) / 0.25)',
                  px: 1,
                }} 
              />
            </Paper>
          </motion.div>

          {/* User Cards */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {users.length === 0 ? (
              <Paper 
                sx={{ 
                  p: 6, 
                  textAlign: 'center',
                  bgcolor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 2,
                }}
              >
                <PersonIcon sx={{ fontSize: 48, color: 'hsl(var(--muted-foreground))', mb: 2 }} />
                <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>
                  No users found
                </Typography>
              </Paper>
            ) : (
              users.map((user) => {
                const schedule = getUserSchedule(user.id);
                const isExpanded = expandedRows.has(user.id);
                
                return (
                  <motion.div key={user.id} variants={cardVariants}>
                    <Paper
                      sx={{
                        bgcolor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 2,
                        overflow: 'hidden',
                        transition: 'border-color 0.2s',
                        '&:hover': {
                          borderColor: 'hsl(var(--border) / 0.8)',
                        },
                      }}
                    >
                      {/* Main Row */}
                      <Box
                        sx={{
                          p: 2.5,
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'auto 1fr auto auto auto auto' },
                          alignItems: 'center',
                          gap: { xs: 2, md: 3 },
                        }}
                      >
                        {/* Avatar & Name */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar 
                            sx={{ 
                              bgcolor: 'hsl(var(--primary))', 
                              width: 44, 
                              height: 44,
                              fontWeight: 600,
                              fontSize: '1.1rem',
                            }}
                          >
                            {user.username?.charAt(0).toUpperCase() || '?'}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                              {user.username}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={user.role || 'user'}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  bgcolor: user.role === 'admin' ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                                  color: user.role === 'admin' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                }}
                              />
                            </Box>
                          </Box>
                        </Box>

                        {/* Spacer for grid */}
                        <Box sx={{ display: { xs: 'none', md: 'block' } }} />

                        {/* Status */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: user.active !== false ? '#22c55e' : 'hsl(var(--muted-foreground))',
                              boxShadow: user.active !== false ? '0 0 8px #22c55e60' : 'none',
                            }}
                          />
                          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                            {user.active !== false ? 'Active' : 'Inactive'}
                          </Typography>
                        </Box>

                        {/* Escalation Level */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {schedule ? (
                            <Box
                              onClick={() => handleEditEscalation(user.id)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                px: 1.5,
                                py: 0.75,
                                borderRadius: 1.5,
                                border: `1px solid ${ESCALATION_COLORS[schedule.escalationLevel]}40`,
                                bgcolor: `${ESCALATION_COLORS[schedule.escalationLevel]}15`,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  bgcolor: `${ESCALATION_COLORS[schedule.escalationLevel]}25`,
                                },
                              }}
                            >
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: ESCALATION_COLORS[schedule.escalationLevel],
                                }}
                              />
                              <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                                {ESCALATION_LABELS[schedule.escalationLevel]}
                              </Typography>
                            </Box>
                          ) : (
                            <Button
                              size="small"
                              onClick={() => handleEditEscalation(user.id)}
                              sx={{ 
                                color: 'hsl(var(--muted-foreground))',
                                textTransform: 'none',
                              }}
                            >
                              Set level
                            </Button>
                          )}
                        </Box>

                        {/* Auto-Assign Toggle */}
                        <Button
                          size="small"
                          variant={schedule?.enabled ? 'contained' : 'outlined'}
                          startIcon={schedule?.enabled ? <CheckCircleIcon /> : <ScheduleIcon />}
                          onClick={() => handleToggleEnabled(user.id)}
                          disabled={isSaving}
                          sx={{
                            minWidth: 110,
                            borderColor: schedule?.enabled ? 'transparent' : 'hsl(var(--border))',
                            bgcolor: schedule?.enabled ? '#22c55e' : 'transparent',
                            color: schedule?.enabled ? 'white' : 'hsl(var(--muted-foreground))',
                            '&:hover': {
                              bgcolor: schedule?.enabled ? '#16a34a' : 'hsl(var(--muted) / 0.5)',
                              borderColor: schedule?.enabled ? 'transparent' : 'hsl(var(--border))',
                            },
                          }}
                        >
                          {schedule?.enabled ? 'On-Call' : 'Off'}
                        </Button>

                        {/* Expand Button */}
                        <IconButton 
                          size="small" 
                          onClick={() => toggleRow(user.id)}
                          sx={{ 
                            color: 'hsl(var(--muted-foreground))',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        >
                          <ExpandMoreIcon />
                        </IconButton>
                      </Box>
                      
                      {/* Expanded Content */}
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box 
                          sx={{ 
                            p: 3, 
                            borderTop: '1px solid hsl(var(--border))',
                            bgcolor: 'hsl(var(--muted) / 0.2)',
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <AccessTimeIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
                              <Typography variant="subtitle2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
                                Availability Windows
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => handleAddScheduleEntry(user.id)}
                              sx={{
                                color: 'hsl(var(--primary))',
                                '&:hover': {
                                  bgcolor: 'hsl(var(--primary) / 0.1)',
                                },
                              }}
                            >
                              Add Window
                            </Button>
                          </Box>
                          
                          {!schedule || schedule.schedules.length === 0 ? (
                            <Paper
                              sx={{
                                p: 3,
                                textAlign: 'center',
                                bgcolor: 'hsl(var(--card))',
                                border: '1px dashed hsl(var(--border))',
                                borderRadius: 2,
                              }}
                            >
                              <ScheduleIcon sx={{ fontSize: 32, color: 'hsl(var(--muted-foreground))', mb: 1 }} />
                              <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                                No availability windows configured
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                                Add windows to enable auto-assignment
                              </Typography>
                            </Paper>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              {schedule.schedules.map((entry) => (
                                <Paper
                                  key={entry.id}
                                  sx={{
                                    p: 2,
                                    bgcolor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: 1.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 2,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    <Box>
                                      <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', mb: 0.5 }}>
                                        Date Range
                                      </Typography>
                                      <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                                        {new Date(entry.startDate).toLocaleDateString()} – {new Date(entry.endDate).toLocaleDateString()}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', mb: 0.5 }}>
                                        Hours
                                      </Typography>
                                      <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                                        {entry.startTime} – {entry.endTime}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', mb: 0.5 }}>
                                        Days
                                      </Typography>
                                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        {DAYS_OF_WEEK.map((day, idx) => (
                                          <Box
                                            key={day}
                                            sx={{
                                              width: 28,
                                              height: 24,
                                              borderRadius: 0.5,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '0.7rem',
                                              fontWeight: 500,
                                              bgcolor: entry.daysOfWeek.includes(idx) ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                                              color: entry.daysOfWeek.includes(idx) ? 'white' : 'hsl(var(--muted-foreground))',
                                            }}
                                          >
                                            {day.charAt(0)}
                                          </Box>
                                        ))}
                                      </Box>
                                    </Box>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleEditScheduleEntry(user.id, entry)}
                                      sx={{ color: 'hsl(var(--muted-foreground))' }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleDeleteScheduleEntry(user.id, entry.id)}
                                      sx={{ 
                                        color: 'hsl(var(--muted-foreground))',
                                        '&:hover': { color: '#ef4444' },
                                      }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Paper>
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </Paper>
                  </motion.div>
                );
              })
            )}
          </Box>
        </motion.div>
      )}

      {/* Dialogs */}
      <Dialog open={escalationDialogOpen} onClose={() => setEscalationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Escalation Level</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {(Object.entries(ESCALATION_LABELS) as [EscalationLevel, string][]).map(([key, label]) => (
              <Paper
                key={key}
                onClick={() => setSelectedLevel(key)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: selectedLevel === key 
                    ? `2px solid ${ESCALATION_COLORS[key]}` 
                    : '2px solid hsl(var(--border))',
                  borderRadius: 2,
                  bgcolor: selectedLevel === key ? `${ESCALATION_COLORS[key]}10` : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: ESCALATION_COLORS[key],
                  },
                }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: ESCALATION_COLORS[key],
                  }}
                />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
                    {label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    {ESCALATION_DESCRIPTIONS[key]}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEscalationDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEscalation} variant="contained" disabled={isSaving}>
            {isSaving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEntry ? 'Edit Availability Window' : 'Add Availability Window'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
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
              <Typography variant="body2" sx={{ mb: 1.5, color: 'hsl(var(--foreground))' }}>Days of Week</Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {DAYS_OF_WEEK.map((day, index) => (
                  <Chip
                    key={day}
                    label={day}
                    onClick={() => toggleDay(index)}
                    sx={{
                      bgcolor: entryDays.includes(index) ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      color: entryDays.includes(index) ? 'white' : 'hsl(var(--muted-foreground))',
                      fontWeight: 500,
                      '&:hover': {
                        bgcolor: entryDays.includes(index) ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      },
                    }}
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

      <Dialog 
        open={timelineDialogOpen} 
        onClose={() => setTimelineDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
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

      <ScheduleImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        existingUsers={users}
        onImport={handleImportSchedules}
      />
      </>
      )}
    </Box>
  );
};

export default UsersPage;
