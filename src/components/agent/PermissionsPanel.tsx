import { useState, useEffect, useCallback } from 'react';
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
  Popover,
  Checkbox,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestoreIcon from '@mui/icons-material/Restore';
import {
  Radar,
  Zap,
  Bell,
  Server,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Search,
  FileText,
  Globe,
  Ban,
  MonitorOff,
  UserX,
  KeyRound,
  Lightbulb,
  Database,
  Terminal,
  Settings2,
  Flame,
  Megaphone,
  AlertTriangle,
  Mail,
  Wifi,
  Monitor,
  Play,
  Laptop,
} from 'lucide-react';
import { useAgentPermissions, RiskLevel, AgentPermissionCategory, AgentPermission } from '@/hooks/useAgentPermissions';
import { getApiUrl, getAuthHeader } from '@/config/api';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Radar: <Radar size={20} />,
  Zap: <Zap size={20} />,
  Bell: <Bell size={20} />,
  Server: <Server size={20} />,
};

const CATEGORY_ICONS_COMPACT: Record<string, React.ReactNode> = {
  Radar: <Radar size={18} />,
  Zap: <Zap size={18} />,
  Bell: <Bell size={18} />,
  Server: <Server size={18} />,
};

const PERMISSION_ICONS: Record<string, React.ReactNode> = {
  scan_vulnerabilities: <Search size={18} />,
  analyze_logs: <FileText size={18} />,
  tune_detection_rules: <Settings2 size={18} />,
  block_ips: <Ban size={18} />,
  isolate_systems: <MonitorOff size={18} />,
  disable_accounts: <UserX size={18} />,
  force_password_reset: <KeyRound size={18} />,
  update_case_status: <FileText size={18} />,
  suggest_remediation: <Lightbulb size={18} />,
  manage_ioc_watchlists: <Database size={18} />,
  monitor_network_traffic: <Wifi size={18} />,
  send_alerts: <Megaphone size={18} />,
  escalate_incidents: <AlertTriangle size={18} />,
  email_reports: <Mail size={18} />,
  read_configs: <Settings2 size={18} />,
  modify_firewall: <Flame size={18} />,
  endpoint_control: <Terminal size={18} />,
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  low: {
    label: 'Low Risk',
    color: 'hsl(var(--severity-low))',
    bg: 'hsl(var(--severity-low) / 0.1)',
    icon: <ShieldCheck size={14} />,
  },
  medium: {
    label: 'Medium Risk',
    color: 'hsl(var(--severity-medium))',
    bg: 'hsl(var(--severity-medium) / 0.1)',
    icon: <ShieldAlert size={14} />,
  },
  high: {
    label: 'High Risk',
    color: 'hsl(var(--severity-high))',
    bg: 'hsl(var(--severity-high) / 0.1)',
    icon: <ShieldOff size={14} />,
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

interface MonitoredHost {
  hostname: string;
  os: string;
  uuid: string;
  checkin: number;
}

interface PermissionsPanelProps {
  /** Compact mode for sidebar/drawer usage */
  compact?: boolean;
}

const PermissionsPanel = ({ compact = false }: PermissionsPanelProps) => {
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

  // Host action state
  const [monitoredHosts, setMonitoredHosts] = useState<MonitoredHost[]>([]);
  const [hostsLoaded, setHostsLoaded] = useState(false);
  const [hostPopover, setHostPopover] = useState<{ anchor: HTMLElement; perm: AgentPermission } | null>(null);
  const [selectedHosts, setSelectedHosts] = useState<Set<string>>(new Set());

  // Fetch monitored hosts from environments API
  const fetchHosts = useCallback(async () => {
    if (hostsLoaded) return;
    try {
      const resp = await fetch(getApiUrl('/api/v1/getenvironments'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (resp.ok) {
        const envs = await resp.json();
        const hosts: MonitoredHost[] = [];
        (Array.isArray(envs) ? envs : []).forEach((env: any) => {
          if (env.sensor_group && Array.isArray(env.sensor_hosts)) {
            env.sensor_hosts.forEach((h: any) => {
              if (h.hostname) {
                hosts.push({
                  hostname: h.hostname,
                  os: h.os || '',
                  uuid: h.uuid || h.hostname,
                  checkin: h.checkin || 0,
                });
              }
            });
          }
        });
        setMonitoredHosts(hosts);
      }
    } catch {
      // silent
    }
    setHostsLoaded(true);
  }, [hostsLoaded]);

  const handleHostAction = (e: React.MouseEvent<HTMLElement>, perm: AgentPermission) => {
    e.stopPropagation();
    fetchHosts();
    setSelectedHosts(new Set());
    setHostPopover({ anchor: e.currentTarget as HTMLElement, perm });
  };

  const toggleHostSelection = (uuid: string) => {
    setSelectedHosts(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid); else next.add(uuid);
      return next;
    });
  };

  const getOsIcon = (os: string) => {
    const lower = os.toLowerCase();
    if (lower.includes('mac') || lower.includes('darwin')) return '🍎';
    if (lower.includes('windows')) return '🪟';
    if (lower.includes('linux')) return '🐧';
    return '💻';
  };

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

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: compact ? 8 : 12 }}>
        <CircularProgress sx={{ color: 'hsl(var(--primary))' }} size={compact ? 28 : 40} />
      </Box>
    );
  }

  // Shared host action button renderer
  const renderHostActionButton = (perm: AgentPermission, isDisabled: boolean) => {
    if (!perm.hostActionable || !perm.enabled) return null;
    return (
      <Tooltip title="Run on monitored hosts">
        <IconButton
          size="small"
          disabled={isDisabled}
          onClick={(e) => handleHostAction(e, perm)}
          sx={{
            width: 28,
            height: 28,
            flexShrink: 0,
            border: '1px solid hsl(var(--border))',
            borderRadius: 1,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': {
              bgcolor: 'hsl(var(--primary) / 0.1)',
              borderColor: 'hsl(var(--primary) / 0.4)',
              color: 'hsl(var(--primary))',
            },
          }}
        >
          <Monitor size={14} />
        </IconButton>
      </Tooltip>
    );
  };

  // Shared host popover
  const renderHostPopover = () => (
    <Popover
      open={!!hostPopover}
      anchorEl={hostPopover?.anchor}
      onClose={() => setHostPopover(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            mt: 0.5,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            minWidth: 280,
            maxWidth: 360,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          },
        },
      }}
    >
      {hostPopover && (
        <Box>
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid hsl(var(--border))' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {hostPopover.perm.name}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
              Select hosts to run this action on
            </Typography>
          </Box>

          {!hostsLoaded ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} sx={{ color: 'hsl(var(--primary))' }} />
            </Box>
          ) : monitoredHosts.length === 0 ? (
            <Box sx={{ px: 2.5, py: 3, textAlign: 'center' }}>
              <Laptop size={24} className="mx-auto mb-2 text-muted-foreground/40" />
              <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                No monitored hosts found
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', mt: 0.5, opacity: 0.7 }}>
                Deploy a sensor to start monitoring hosts
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
                {monitoredHosts.map((host) => {
                  const isRecent = host.checkin > 0 && (Date.now() / 1000 - host.checkin) < 300;
                  return (
                    <Box
                      key={host.uuid}
                      onClick={() => toggleHostSelection(host.uuid)}
                      sx={{
                        px: 2.5,
                        py: 1.25,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        cursor: 'pointer',
                        borderBottom: '1px solid hsl(var(--border) / 0.3)',
                        '&:hover': { bgcolor: 'hsl(var(--muted) / 0.3)' },
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={selectedHosts.has(host.uuid)}
                        sx={{
                          p: 0,
                          color: 'hsl(var(--muted-foreground))',
                          '&.Mui-checked': { color: 'hsl(var(--primary))' },
                        }}
                      />
                      <Typography sx={{ fontSize: '0.8rem', flexShrink: 0 }}>
                        {getOsIcon(host.os)}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          color: 'hsl(var(--foreground))',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {host.hostname}
                        </Typography>
                      </Box>
                      {isRecent && (
                        <Box sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: 'hsl(var(--severity-low))',
                          flexShrink: 0,
                        }} />
                      )}
                    </Box>
                  );
                })}
              </Box>

              <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
                  {selectedHosts.size} selected
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  disabled={selectedHosts.size === 0}
                  startIcon={<Play size={12} />}
                  onClick={() => {
                    // TODO: Execute action on selected hosts
                    setHostPopover(null);
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    bgcolor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    borderRadius: 1.5,
                    px: 2,
                    '&:hover': { bgcolor: 'hsl(var(--primary))', filter: 'brightness(1.1)' },
                    '&.Mui-disabled': { bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },
                  }}
                >
                  Run
                </Button>
              </Box>
            </>
          )}
        </Box>
      )}
    </Popover>
  );

  if (compact) {
    return (
      <>
        {error && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>
        )}

        {/* Categories — compact drawer style */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {categories.map((cat) => {
            const stats = getCategoryStats(cat);
            const isExpanded = expandedCategories.includes(cat.id);
            const isCatDisabled = !!cat.disabled;

            return (
              <Box key={cat.id} sx={{ opacity: isCatDisabled ? 0.5 : 1 }}>
                {/* Category header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1.5,
                    cursor: isCatDisabled ? 'default' : 'pointer',
                  }}
                  onClick={() => !isCatDisabled && toggleExpand(cat.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: 'hsl(var(--primary))', display: 'flex' }}>
                      {CATEGORY_ICONS_COMPACT[cat.icon] || <Server size={18} />}
                    </Box>
                    <Typography sx={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'hsl(var(--muted-foreground))',
                    }}>
                      {cat.label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`${stats.enabled}/${stats.total}`}
                      size="small"
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        height: 22,
                        bgcolor: stats.allEnabled
                          ? 'hsl(var(--severity-low) / 0.12)'
                          : stats.noneEnabled
                          ? 'hsl(var(--severity-high) / 0.12)'
                          : 'hsl(var(--primary) / 0.12)',
                        color: stats.allEnabled
                          ? 'hsl(var(--severity-low))'
                          : stats.noneEnabled
                          ? 'hsl(var(--severity-high))'
                          : 'hsl(var(--primary))',
                      }}
                    />
                    <Tooltip title={isCatDisabled ? 'Coming soon' : stats.allEnabled ? 'Disable all' : 'Enable all'}>
                      <span>
                        <Switch
                          size="small"
                          checked={stats.allEnabled}
                          disabled={isCatDisabled}
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
                      </span>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}
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
                        const isPermDisabled = isCatDisabled || !!perm.disabled;
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
                                opacity: perm.enabled && !isPermDisabled ? 1 : 0.55,
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
                                    label={riskCfg.label.split(' ')[0].toUpperCase()}
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

                              {/* Host action button */}
                              {renderHostActionButton(perm, isPermDisabled)}

                              {/* Toggle */}
                              <Switch
                                size="small"
                                checked={perm.enabled}
                                disabled={isPermDisabled}
                                onChange={() => togglePermission(cat.id, perm.id)}
                                sx={{
                                  flexShrink: 0,
                                  '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: perm.risk === 'high'
                                      ? 'hsl(var(--severity-high))'
                                      : 'hsl(var(--primary))',
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    bgcolor: perm.risk === 'high'
                                      ? 'hsl(var(--severity-high))'
                                      : 'hsl(var(--primary))',
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

        {renderHostPopover()}
      </>
    );
  }

  // ── Full page variant ──
  return (
    <>
      {/* Summary bar */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          mb: 3,
          bgcolor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          Enabled
        </Typography>
        <Chip
          label={`${enabledPermissions}/${totalPermissions}`}
          size="small"
          sx={{
            fontWeight: 600,
            bgcolor: enabledPermissions === totalPermissions
              ? 'hsl(var(--severity-low) / 0.15)'
              : 'hsl(var(--primary) / 0.15)',
            color: enabledPermissions === totalPermissions
              ? 'hsl(var(--severity-low))'
              : 'hsl(var(--primary))',
          }}
        />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {(['low', 'medium', 'high'] as RiskLevel[]).map(risk => {
            const cfg = RISK_CONFIG[risk];
            const count = categories.reduce(
              (sum, cat) => sum + cat.permissions.filter(p => p.risk === risk).length,
              0
            );
            return (
              <Chip
                key={risk}
                icon={<span style={{ display: 'flex', color: cfg.color }}>{cfg.icon}</span>}
                label={`${count} ${cfg.label.split(' ')[0]}`}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: cfg.color + '40',
                  color: cfg.color,
                  fontSize: '0.7rem',
                }}
              />
            );
          })}
        </Box>
        <Tooltip title="Reset all permissions to defaults">
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestoreIcon sx={{ fontSize: 16 }} />}
            onClick={resetToDefaults}
            sx={{
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'none',
              '&:hover': {
                borderColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary))',
              },
            }}
          >
            Reset
          </Button>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {/* Category sections */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <AnimatePresence>
          {categories.map((cat) => {
            const stats = getCategoryStats(cat);
            const isExpanded = expandedCategories.includes(cat.id);
            const isCatDisabled = !!cat.disabled;

            return (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Box
                  sx={{
                    bgcolor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 1,
                    overflow: 'hidden',
                    opacity: isCatDisabled ? 0.5 : 1,
                  }}
                >
                  {/* Category header */}
                  <Box
                    sx={{
                      px: 3,
                      py: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'hsl(var(--muted) / 0.3)' },
                    }}
                    onClick={() => toggleExpand(cat.id)}
                  >
                    <Box sx={{ color: 'hsl(var(--primary))', display: 'flex' }}>
                      {CATEGORY_ICONS[cat.icon] || <Server size={20} />}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', flex: 1 }}>
                      {cat.label}
                    </Typography>
                    <Chip
                      label={`${stats.enabled}/${stats.total}`}
                      size="small"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        bgcolor: stats.allEnabled
                          ? 'hsl(var(--severity-low) / 0.12)'
                          : stats.noneEnabled
                          ? 'hsl(var(--severity-high) / 0.12)'
                          : 'hsl(var(--primary) / 0.12)',
                        color: stats.allEnabled
                          ? 'hsl(var(--severity-low))'
                          : stats.noneEnabled
                          ? 'hsl(var(--severity-high))'
                          : 'hsl(var(--primary))',
                      }}
                    />
                    <Tooltip title={isCatDisabled ? 'Coming soon' : stats.allEnabled ? 'Disable all' : 'Enable all'}>
                      <span>
                        <Switch
                          size="small"
                          checked={stats.allEnabled}
                          disabled={isCatDisabled}
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
                      </span>
                    </Tooltip>
                    <IconButton size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  </Box>

                  {/* Permission items */}
                  <Collapse in={isExpanded}>
                    <Box sx={{ borderTop: '1px solid hsl(var(--border))' }}>
                      {cat.permissions.map((perm, idx) => {
                        const riskCfg = RISK_CONFIG[perm.risk];
                        const isPermDisabled = isCatDisabled || !!perm.disabled;
                        return (
                          <Box
                            key={perm.id}
                            sx={{
                              px: 3,
                              py: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              borderBottom: idx < cat.permissions.length - 1
                                ? '1px solid hsl(var(--border) / 0.5)'
                                : 'none',
                              opacity: perm.enabled && !isPermDisabled ? 1 : 0.55,
                              transition: 'opacity 0.2s',
                              '&:hover': {
                                bgcolor: 'hsl(var(--muted) / 0.2)',
                              },
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 500,
                                    color: 'hsl(var(--foreground))',
                                  }}
                                >
                                  {perm.name}
                                </Typography>
                                <Chip
                                  icon={<span style={{ display: 'flex', color: riskCfg.color }}>{riskCfg.icon}</span>}
                                  label={perm.risk}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 500,
                                    bgcolor: riskCfg.bg,
                                    color: riskCfg.color,
                                    textTransform: 'capitalize',
                                    '& .MuiChip-icon': { ml: 0.5 },
                                  }}
                                />
                              </Box>
                              <Typography
                                variant="caption"
                                sx={{ color: 'hsl(var(--muted-foreground))' }}
                              >
                                {perm.description}
                              </Typography>
                            </Box>

                            {/* Host action button */}
                            {renderHostActionButton(perm, isPermDisabled)}

                            <Switch
                              size="small"
                              checked={perm.enabled}
                              disabled={isPermDisabled}
                              onChange={() => togglePermission(cat.id, perm.id)}
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': {
                                  color: perm.risk === 'high'
                                    ? 'hsl(var(--severity-high))'
                                    : 'hsl(var(--primary))',
                                },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                  bgcolor: perm.risk === 'high'
                                    ? 'hsl(var(--severity-high))'
                                    : 'hsl(var(--primary))',
                                },
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </Box>

      {renderHostPopover()}
    </>
  );
};

export default PermissionsPanel;
