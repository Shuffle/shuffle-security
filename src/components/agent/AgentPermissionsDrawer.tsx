import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Switch,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Button,
  Collapse,
  Alert,
  Drawer,
  Tab,
  Tabs,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestoreIcon from '@mui/icons-material/Restore';
import CloseIcon from '@mui/icons-material/Close';
import {
  Radar,
  Zap,
  Bell,
  Server,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Activity,
  Search,
  FileText,
  Globe,
  Ban,
  MonitorOff,
  UserX,
  KeyRound,
  Megaphone,
  AlertTriangle,
  Mail,
  Settings2,
  Flame,
  Database,
  Terminal,
  
  Play,
  Lightbulb,
} from 'lucide-react';
import { useAgentPermissions, RiskLevel, AgentPermissionCategory } from '@/hooks/useAgentPermissions';
import AgentActionDrawer from '@/components/agent/AgentActionDrawer';
import AgentIcon from '@/components/agent/AgentIcon';
import { IntegrationStatus } from '@/components/layout/IntegrationStatus';

// Per-permission icons for a more modern look
const PERMISSION_ICONS: Record<string, React.ReactNode> = {
  scan_vulnerabilities: <Search size={18} />,
  analyze_logs: <FileText size={18} />,
  enrich_observables: <Globe size={18} />,
  tune_detection_rules: <Settings2 size={18} />,
  block_ips: <Ban size={18} />,
  isolate_systems: <MonitorOff size={18} />,
  disable_accounts: <UserX size={18} />,
  force_password_reset: <KeyRound size={18} />,
  update_case_status: <FileText size={18} />,
  suggest_remediation: <Lightbulb size={18} />,
  manage_ioc_watchlists: <Database size={18} />,
  send_alerts: <Megaphone size={18} />,
  escalate_incidents: <AlertTriangle size={18} />,
  email_reports: <Mail size={18} />,
  read_configs: <Settings2 size={18} />,
  modify_firewall: <Flame size={18} />,
  endpoint_control: <Terminal size={18} />,
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  low: {
    label: 'LOW',
    color: 'hsl(var(--severity-low))',
    bg: 'hsla(var(--severity-low) / 0.12)',
    icon: <ShieldCheck size={12} />,
  },
  medium: {
    label: 'MEDIUM',
    color: 'hsl(var(--severity-medium))',
    bg: 'hsla(var(--severity-medium) / 0.12)',
    icon: <ShieldAlert size={12} />,
  },
  high: {
    label: 'HIGH',
    color: 'hsl(var(--severity-critical))',
    bg: 'hsla(var(--severity-critical) / 0.12)',
    icon: <ShieldOff size={12} />,
  },
};

const RISK_ICON_BG: Record<RiskLevel, string> = {
  low: 'hsla(var(--severity-low) / 0.15)',
  medium: 'hsla(var(--severity-medium) / 0.15)',
  high: 'hsla(var(--severity-critical) / 0.15)',
};

const RISK_ICON_COLOR: Record<RiskLevel, string> = {
  low: 'hsl(var(--severity-low))',
  medium: 'hsl(var(--severity-medium))',
  high: 'hsl(var(--severity-critical))',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Radar: <Radar size={18} />,
  Zap: <Zap size={18} />,
  Bell: <Bell size={18} />,
  Server: <Server size={18} />,
};

interface AgentPermissionsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const AgentPermissionsDrawer = ({ open, onClose }: AgentPermissionsDrawerProps) => {
  const navigate = useNavigate();
  const {
    categories,
    isLoading,
    isSaving,
    error,
    totalPermissions,
    enabledPermissions,
    togglePermission,
    toggleCategory,
    resetToDefaults,
  } = useAgentPermissions();

  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    () => categories.map(c => c.id)
  );
  const [activeTab, setActiveTab] = useState(0);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);

  // Always reset to Permissions tab when the drawer opens
  useState(() => {
    // This runs on mount only — for re-opens we use the effect below
  });
  // Reset tab to Permissions (0) every time drawer opens
  const prevOpenRef = useRef(open);
  if (open && !prevOpenRef.current) {
    // Drawer just opened
    setActiveTab(0);
  }
  prevOpenRef.current = open;

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getCategoryStats = (cat: AgentPermissionCategory) => {
    const enabled = cat.permissions.filter(p => p.enabled).length;
    const total = cat.permissions.length;
    return { enabled, total, allEnabled: enabled === total, noneEnabled: enabled === 0 };
  };

  const handleOpenAction = () => {
    setActionDrawerOpen(true);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: '1px solid hsl(var(--border))',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ 
        px: 3, 
        py: 2.5, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        borderBottom: '1px solid hsl(var(--border))',
        flexShrink: 0,
      }}>
        <Box sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'hsla(var(--primary) / 0.12)',
          color: 'hsl(var(--primary))',
          flexShrink: 0,
        }}>
          <AgentIcon size={22} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', color: 'hsl(var(--foreground))' }}>
            Agent
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
            Run actions and manage permissions
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid hsl(var(--border))', flexShrink: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            minHeight: 42,
            px: 3,
            '& .MuiTab-root': {
              minHeight: 42,
              textTransform: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'hsl(var(--muted-foreground))',
              '&.Mui-selected': {
                color: 'hsl(var(--primary))',
              },
            },
            '& .MuiTabs-indicator': {
              bgcolor: 'hsl(var(--primary))',
            },
          }}
        >
          <Tab label="Permissions" icon={<ShieldCheck size={14} />} iconPosition="start" sx={{ gap: 0.75 }} />
          <Tab label="Action" icon={<Play size={14} />} iconPosition="start" sx={{ gap: 0.75 }} />
        </Tabs>
      </Box>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        {activeTab === 0 && (
          /* ── Permissions Tab ── */
          <>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={28} sx={{ color: 'hsl(var(--primary))' }} />
              </Box>
            ) : (
              <>
                {/* Coming Soon banner */}
                <Box sx={{
                  mb: 3,
                  px: 2.5,
                  py: 2,
                  borderRadius: 2,
                  border: '1px solid hsla(var(--primary) / 0.3)',
                  bgcolor: 'hsla(var(--primary) / 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}>
                  <Box sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'hsla(var(--primary) / 0.15)',
                    color: 'hsl(var(--primary))',
                    flexShrink: 0,
                  }}>
                    <Settings2 size={16} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                        Coming Soon
                      </Typography>
                      <Chip
                        label="PREVIEW"
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          bgcolor: 'hsla(var(--primary) / 0.15)',
                          color: 'hsl(var(--primary))',
                          borderRadius: 1,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>
                      Granular agent permissions are under development. All controls are currently view-only.
                    </Typography>
                  </Box>
                </Box>

                {/* Summary chip + reset */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    border: '1px solid hsl(var(--border))',
                    bgcolor: 'hsl(var(--background))',
                    opacity: 0.5,
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                      Enabled
                    </Typography>
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                      {enabledPermissions}/{totalPermissions}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Activity size={14} />}
                      onClick={() => { onClose(); navigate('/agent'); }}
                      sx={{
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        borderRadius: 1.5,
                        px: 1.5,
                        '&:hover': { 
                          borderColor: 'hsl(var(--primary))',
                          color: 'hsl(var(--primary))',
                          bgcolor: 'hsla(var(--primary) / 0.08)',
                        },
                      }}
                    >
                      Activity
                    </Button>
                    <Button
                      size="small"
                      startIcon={<RestoreIcon sx={{ fontSize: 14 }} />}
                      disabled
                      sx={{
                        color: 'hsl(var(--muted-foreground))',
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        opacity: 0.5,
                      }}
                    >
                      Reset
                    </Button>
                  </Box>
                </Box>

                {error && (
                  <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>
                )}

                {/* Tools / Integrations the agent can use */}
                <Box sx={{
                  mb: 3,
                  px: 2,
                  py: 2,
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--background))',
                }}>
                  <Typography sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'hsl(var(--muted-foreground))',
                    mb: 1,
                  }}>
                    Tools
                  </Typography>
                  <IntegrationStatus collapsed={false} iconSize={24} />
                </Box>

                {/* Categories — all disabled */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, opacity: 0.5, pointerEvents: 'none' }}>
                  {categories.map((cat) => {
                    const stats = getCategoryStats(cat);
                    const isExpanded = expandedCategories.includes(cat.id);

                    return (
                      <Box key={cat.id}>
                        {/* Category header */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 1.5,
                          }}
                        >
                          <Typography sx={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'hsl(var(--muted-foreground))',
                          }}>
                            {cat.label}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Switch
                              size="small"
                              checked={stats.allEnabled}
                              disabled
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': {
                                  color: 'hsl(var(--primary))',
                                },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                  bgcolor: 'hsl(var(--primary))',
                                },
                              }}
                            />
                            <IconButton
                              size="small"
                              disabled
                              sx={{ color: 'hsl(var(--muted-foreground))', width: 24, height: 24 }}
                            >
                              {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Box>
                        </Box>

                        {/* Permission cards */}
                        <Collapse in={isExpanded}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <AnimatePresence>
                              {cat.permissions.map((perm) => {
                                const riskCfg = RISK_CONFIG[perm.risk];
                                return (
                                  <motion.div
                                    key={perm.id}
                                    layout
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.15 }}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        px: 2,
                                        py: 1.5,
                                        borderRadius: 2,
                                        border: '1px solid',
                                        borderColor: perm.enabled ? 'hsl(var(--border))' : 'hsla(var(--border) / 0.5)',
                                        bgcolor: perm.enabled ? 'hsla(var(--card) / 0.6)' : 'transparent',
                                        opacity: perm.enabled ? 1 : 0.55,
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      {/* Icon */}
                                      <Box sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: RISK_ICON_BG[perm.risk],
                                        color: RISK_ICON_COLOR[perm.risk],
                                        flexShrink: 0,
                                      }}>
                                        {PERMISSION_ICONS[perm.id] || <Server size={18} />}
                                      </Box>

                                      {/* Text */}
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                                          <Typography sx={{
                                            fontSize: '0.85rem',
                                            fontWeight: 500,
                                            color: 'hsl(var(--foreground))',
                                          }}>
                                            {perm.name}
                                          </Typography>
                                          <Chip
                                            label={riskCfg.label}
                                            size="small"
                                            sx={{
                                              height: 18,
                                              fontSize: '0.55rem',
                                              fontWeight: 700,
                                              letterSpacing: '0.04em',
                                              bgcolor: riskCfg.bg,
                                              color: riskCfg.color,
                                              borderRadius: 1,
                                              '& .MuiChip-label': { px: 0.75 },
                                            }}
                                          />
                                        </Box>
                                        <Typography sx={{
                                          fontSize: '0.75rem',
                                          color: 'hsl(var(--muted-foreground))',
                                          lineHeight: 1.3,
                                        }}>
                                          {perm.description}
                                        </Typography>
                                      </Box>

                                      {/* Toggle — disabled */}
                                      <Switch
                                        size="small"
                                        checked={perm.enabled}
                                        disabled
                                        sx={{
                                          flexShrink: 0,
                                        }}
                                      />
                                    </Box>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </Box>
                        </Collapse>
                      </Box>
                    );
                  })}
                </Box>
              </>
            )}
          </>
        )}

        {activeTab === 1 && (
          /* ── Action Tab — opens the standalone AgentActionDrawer ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6 }}>
            <Box sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'hsla(var(--primary) / 0.12)',
              color: 'hsl(var(--primary))',
            }}>
              <Play size={24} />
            </Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Run an Agent Action
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
              Search integrations, describe your task, and let the agent execute it via JSON-RPC.
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Play size={14} />}
              onClick={handleOpenAction}
              sx={{
                mt: 1,
                textTransform: 'none',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 1.5,
                px: 3,
                bgcolor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--primary))', opacity: 0.9 },
              }}
            >
              Open Action Panel
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Activity size={14} />}
              onClick={() => { onClose(); navigate('/agent'); }}
              sx={{
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                textTransform: 'none',
                fontSize: '0.75rem',
                borderRadius: 1.5,
                '&:hover': {
                  borderColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary))',
                  bgcolor: 'hsla(var(--primary) / 0.08)',
                },
              }}
            >
              View all activity
            </Button>
          </Box>
        )}
      </Box>

      {/* Standalone Action Drawer */}
      <AgentActionDrawer open={actionDrawerOpen} onClose={() => setActionDrawerOpen(false)} />
    </Drawer>
  );
};

export default AgentPermissionsDrawer;
