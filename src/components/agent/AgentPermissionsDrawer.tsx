import { useState } from 'react';
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
} from 'lucide-react';
import { useAgentPermissions, RiskLevel, AgentPermissionCategory } from '@/hooks/useAgentPermissions';

// Per-permission icons for a more modern look
const PERMISSION_ICONS: Record<string, React.ReactNode> = {
  monitor_network: <Activity size={18} />,
  scan_vulnerabilities: <Search size={18} />,
  analyze_logs: <FileText size={18} />,
  threat_intel_lookup: <Globe size={18} />,
  block_ips: <Ban size={18} />,
  isolate_systems: <MonitorOff size={18} />,
  disable_accounts: <UserX size={18} />,
  force_password_reset: <KeyRound size={18} />,
  send_alerts: <Megaphone size={18} />,
  escalate_incidents: <AlertTriangle size={18} />,
  email_reports: <Mail size={18} />,
  read_configs: <Settings2 size={18} />,
  modify_firewall: <Flame size={18} />,
  query_security_db: <Database size={18} />,
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
          <ShieldCheck size={22} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', color: 'hsl(var(--foreground))' }}>
            Agent Permissions
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
            Control what actions your agent can perform
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} sx={{ color: 'hsl(var(--primary))' }} />
          </Box>
        ) : (
          <>
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
              }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                  Enabled
                </Typography>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                  {enabledPermissions}/{totalPermissions}
                </Typography>
              </Box>
              <Tooltip title="Reset all to defaults">
                <Button
                  size="small"
                  startIcon={<RestoreIcon sx={{ fontSize: 14 }} />}
                  onClick={resetToDefaults}
                  sx={{
                    color: 'hsl(var(--muted-foreground))',
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    '&:hover': { color: 'hsl(var(--primary))' },
                  }}
                >
                  Reset
                </Button>
              </Tooltip>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>
            )}

            {/* Categories */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleExpand(cat.id)}
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
                        <Tooltip title={stats.allEnabled ? 'Disable all' : 'Enable all'}>
                          <Switch
                            size="small"
                            checked={stats.allEnabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleCategory(cat.id, !stats.allEnabled);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': {
                                color: 'hsl(var(--primary))',
                              },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                bgcolor: 'hsl(var(--primary))',
                              },
                            }}
                          />
                        </Tooltip>
                        <IconButton
                          size="small"
                          sx={{ color: 'hsl(var(--muted-foreground))', width: 24, height: 24 }}
                          onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}
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
                                    '&:hover': {
                                      borderColor: 'hsl(var(--muted-foreground) / 0.3)',
                                      bgcolor: 'hsla(var(--card) / 0.8)',
                                    },
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

                                  {/* Toggle */}
                                  <Switch
                                    size="small"
                                    checked={perm.enabled}
                                    onChange={() => togglePermission(cat.id, perm.id)}
                                    sx={{
                                      flexShrink: 0,
                                      '& .MuiSwitch-switchBase.Mui-checked': {
                                        color: perm.risk === 'high' ? riskCfg.color : 'hsl(var(--primary))',
                                      },
                                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                        bgcolor: perm.risk === 'high' ? riskCfg.color : 'hsl(var(--primary))',
                                      },
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

            {/* Saving indicator */}
            {isSaving && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, justifyContent: 'center' }}>
                <CircularProgress size={14} sx={{ color: 'hsl(var(--primary))' }} />
                <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Saving...</Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default AgentPermissionsDrawer;
