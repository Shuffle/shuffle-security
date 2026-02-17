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
  TextField,
  InputBase,
  Avatar,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestoreIcon from '@mui/icons-material/Restore';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
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
  Bot,
  Play,
} from 'lucide-react';
import { useAgentPermissions, RiskLevel, AgentPermissionCategory } from '@/hooks/useAgentPermissions';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { SingulJS } from '@/lib/singul-local';
import type { AlgoliaSearchApp, SingulJSHandle } from '@/lib/singul-local';

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
  const [agentInput, setAgentInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<AlgoliaSearchApp | null>(null);
  const singulRef = useRef<SingulJSHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleRunAgent = async () => {
    if (!agentInput.trim() || isRunning) return;
    setIsRunning(true);
    setRunResult(null);
    setRunError(null);

    try {
      const payload: Record<string, unknown> = {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: {
          input: { text: agentInput.trim() },
          ...(selectedApp ? {
            tool_name: selectedApp.name,
            tool_id: selectedApp.objectID || selectedApp.name,
          } : {}),
        },
      };

      const response = await fetch(getApiUrl('/api/v1/agent'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        setRunError(`Error ${response.status}: ${rawText || response.statusText}`);
      } else if (!contentType?.includes('application/json')) {
        if (rawText.trim().startsWith('<!') || rawText.includes('<html')) {
          setRunError('Received an unexpected HTML response. This may indicate an auth redirect or server issue.');
        } else {
          setRunResult(rawText);
        }
      } else {
        const data = JSON.parse(rawText);
        let content = '';

        if (typeof data === 'string') {
          content = data;
        } else if (data?.result) {
          if (typeof data.result === 'object' && data.result !== null) {
            if (data.result.message) content = data.result.message;
            const rest = { ...data.result };
            delete rest.message;
            if (Object.keys(rest).length > 0) {
              const extra = JSON.stringify(rest, null, 2);
              content = content ? `${content}\n\n${extra}` : extra;
            }
          } else {
            content = String(data.result);
          }
        } else if (data?.message) {
          content = data.message;
        } else {
          content = JSON.stringify(data, null, 2);
        }

        setRunResult(content || 'No output returned.');
      }
    } catch (err) {
      setRunError(`Network error — could not reach the agent. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setIsRunning(false);
    }
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
          <Bot size={22} />
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
          /* ── Action Tab ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* App selector */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                Target App (optional)
              </Typography>

              {selectedApp ? (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--card))',
                }}>
                  <Avatar
                    src={selectedApp.image_url || `https://shuffler.io/images/apps/${selectedApp.name}.png`}
                    sx={{ width: 28, height: 28, '& img': { objectFit: 'contain' } }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--foreground))', textTransform: 'capitalize' }}>
                      {selectedApp.name?.replace(/_/g, ' ')}
                    </Typography>
                    {selectedApp.categories && selectedApp.categories.length > 0 && (
                      <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>
                        {selectedApp.categories.slice(0, 2).join(' · ')}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => setSelectedApp(null)}
                    sx={{ color: 'hsl(var(--muted-foreground))', width: 24, height: 24 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ) : (
                <Box sx={{
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--background))',
                  overflow: 'hidden',
                  '& .singul-container': {
                    background: 'transparent !important',
                  },
                  '& .singul-input': {
                    background: 'transparent !important',
                    color: 'hsl(var(--foreground)) !important',
                    fontSize: '0.82rem !important',
                    border: 'none !important',
                    padding: '8px 12px !important',
                  },
                  '& .singul-results': {
                    background: 'hsl(var(--card)) !important',
                    border: '1px solid hsl(var(--border)) !important',
                    maxHeight: '200px !important',
                  },
                  '& .singul-result-item': {
                    color: 'hsl(var(--foreground)) !important',
                    fontSize: '0.8rem !important',
                  },
                  '& .singul-result-item:hover': {
                    background: 'hsla(var(--primary) / 0.08) !important',
                  },
                }}>
                  <SingulJS
                    ref={singulRef}
                    authToken=""
                    placeholder="Search integrations…"
                    layout="list"
                    hitsPerPage={8}
                    inline={true}
                    showDescription={false}
                    showCategories={false}
                    hideAuthStatus={true}
                    preventDefault={true}
                    onAppSelected={(e) => {
                      if (e?.app) {
                        setSelectedApp(e.app);
                      }
                    }}
                  />
                </Box>
              )}
            </Box>

            {/* Agent input */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                Prompt
              </Typography>
              <Box sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                borderRadius: 2,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
                px: 1.5,
                py: 1,
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                '&:focus-within': {
                  borderColor: 'hsla(var(--primary) / 0.5)',
                  boxShadow: '0 0 0 3px hsla(var(--primary) / 0.08)',
                },
              }}>
                <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--primary))', fontWeight: 600, userSelect: 'none', fontFamily: "'JetBrains Mono', monospace", lineHeight: '24px' }}>
                  ›
                </Typography>
                <InputBase
                  inputRef={inputRef}
                  multiline
                  maxRows={6}
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  placeholder={selectedApp ? `Ask ${selectedApp.name.replace(/_/g, ' ')} something…` : 'Describe what you want the agent to do…'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleRunAgent();
                    }
                  }}
                  fullWidth
                  sx={{
                    fontSize: '0.82rem',
                    color: 'hsl(var(--foreground))',
                    '& textarea::placeholder': {
                      color: 'hsl(var(--muted-foreground))',
                      opacity: 0.7,
                    },
                  }}
                />
                <Box
                  component="button"
                  onClick={handleRunAgent}
                  disabled={!agentInput.trim() || isRunning}
                  sx={{
                    all: 'unset',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: '8px',
                    flexShrink: 0,
                    cursor: agentInput.trim() && !isRunning ? 'pointer' : 'default',
                    bgcolor: agentInput.trim() && !isRunning ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    color: agentInput.trim() && !isRunning ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    transition: 'all 0.15s ease',
                    '&:hover': agentInput.trim() && !isRunning ? { filter: 'brightness(1.1)' } : {},
                  }}
                >
                  {isRunning ? (
                    <CircularProgress size={14} sx={{ color: 'inherit' }} />
                  ) : (
                    <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />
                  )}
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', mt: 0.75 }}>
                ⌘+Enter to send · JSON-RPC
              </Typography>
            </Box>

            {runError && (
              <Alert severity="error" sx={{ fontSize: '0.8rem', borderRadius: 2 }}>
                {runError}
              </Alert>
            )}

            {runResult && (
              <Box sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--background))',
              }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                  Result
                </Typography>
                <Typography
                  component="pre"
                  sx={{
                    fontSize: '0.78rem',
                    color: 'hsl(var(--foreground))',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: "'JetBrains Mono', monospace",
                    m: 0,
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}
                >
                  {runResult}
                </Typography>
              </Box>
            )}

            {/* Link to full activity page */}
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
                alignSelf: 'flex-start',
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
    </Drawer>
  );
};

export default AgentPermissionsDrawer;
