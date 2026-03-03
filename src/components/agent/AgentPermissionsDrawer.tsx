import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Popover,
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
  CheckCircle2,
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
import AddIcon from '@mui/icons-material/Add';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SaveIcon from '@mui/icons-material/Save';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { deduplicateAuthApps } from '@/lib/utils';
import { SingulJS } from '@/lib/singul-local';
import type { AlgoliaSearchApp, SingulJSHandle } from '@/lib/singul-local';
import { InputBase, Avatar } from '@mui/material';
import type { AgentRun } from '@/services/agentActivity';

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

const AGENT_TOOLS_KEY = 'agent_enabled_tools';
const AGENT_LOCAL_MODEL_KEY = 'agent_local_model';

interface AgentLocalModel {
  url: string;
  apikey: string;
  model: string;
}

interface AgentTool {
  id: string;
  name: string;
  image?: string;
}

interface AgentPermissionsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** When true, opens directly to the Action tab */
  initialTab?: number;
}

const AgentPermissionsDrawer = ({ open, onClose, initialTab }: AgentPermissionsDrawerProps) => {
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
  const [viewRun, setViewRun] = useState<AgentRun | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);

  // Action form state (inline)
  const [agentInput, setAgentInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<AlgoliaSearchApp[]>([]);
  const singulRef = useRef<SingulJSHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Agent tools state
  const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
  const [enabledTools, setEnabledTools] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(AGENT_TOOLS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsPopover, setToolsPopover] = useState<{ anchor: HTMLElement; tool: AgentTool } | null>(null);

  // Local model state
  const [localModel, setLocalModel] = useState<AgentLocalModel>(() => {
    try {
      const stored = localStorage.getItem(AGENT_LOCAL_MODEL_KEY);
      return stored ? JSON.parse(stored) : { url: '', apikey: '', model: '' };
    } catch { return { url: '', apikey: '', model: '' }; }
  });
  const [localModelSaved, setLocalModelSaved] = useState(false);
  const [hasOpenAIAuth, setHasOpenAIAuth] = useState(false);

  const handleLocalModelChange = (field: keyof AgentLocalModel, value: string) => {
    setLocalModel(prev => ({ ...prev, [field]: value }));
    setLocalModelSaved(false);
  };

  const saveLocalModel = () => {
    localStorage.setItem(AGENT_LOCAL_MODEL_KEY, JSON.stringify(localModel));
    setLocalModelSaved(true);
    setTimeout(() => setLocalModelSaved(false), 2000);
  };

  // Fetch authenticated apps for tools list
  const fetchAgentTools = useCallback(async () => {
    if (!API_CONFIG.apiKey) return;
    setToolsLoading(true);
    try {
      const resp = await fetch(getApiUrl('/api/v1/apps/authentication'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (resp.ok) {
        const result = await resp.json();
        const authData = Array.isArray(result) ? result : (result.data || []);
        const deduped = deduplicateAuthApps(authData.filter((a: any) => a.active || a.validation?.valid));
        const tools: AgentTool[] = deduped
          .filter(d => d.hasValidAuth && d.app.name?.toLowerCase() !== 'openai')
          .map(({ app, bestImage }) => ({
            id: app.id,
            name: app.name,
            image: bestImage || app.large_image || '',
          }));
        setAgentTools(tools);

        // Check for valid OpenAI authentication
        const openaiAuth = deduped.some(d => d.hasValidAuth && d.app.name?.toLowerCase() === 'openai');
        setHasOpenAIAuth(openaiAuth);

        // Auto-remove OpenAI from enabled tools if present
        setEnabledTools(prev => {
          if (prev.has('openai') || prev.has('OpenAI')) {
            const next = new Set(prev);
            next.delete('openai');
            next.delete('OpenAI');
            localStorage.setItem(AGENT_TOOLS_KEY, JSON.stringify([...next]));
            return next;
          }
          return prev;
        });

        // If nothing stored yet, enable all (non-OpenAI) by default
        const stored = localStorage.getItem(AGENT_TOOLS_KEY);
        if (!stored) {
          const allNames = new Set(tools.map(t => t.name));
          setEnabledTools(allNames);
          localStorage.setItem(AGENT_TOOLS_KEY, JSON.stringify([...allNames]));
        }
      }
    } catch (err) {
      console.error('Failed to fetch agent tools:', err);
    }
    setToolsLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchAgentTools();
  }, [open, fetchAgentTools]);

  const toggleTool = (name: string) => {
    setEnabledTools(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      localStorage.setItem(AGENT_TOOLS_KEY, JSON.stringify([...next]));
      return next;
    });
    setToolsPopover(null);
  };

  // Reset tab every time drawer opens
  const prevOpenRef = useRef(open);
  if (open && !prevOpenRef.current) {
    setActiveTab(initialTab ?? 0);
  }
  prevOpenRef.current = open;

  // Pre-populate selectedApps from enabled tools when switching to Action tab
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (activeTab === 1 && prevTabRef.current !== 1 && agentTools.length > 0) {
      const enabledAppObjects = agentTools
        .filter(t => enabledTools.has(t.name))
        .map(t => ({
          name: t.name,
          objectID: t.id,
          image_url: t.image,
        } as unknown as AlgoliaSearchApp));
      setSelectedApps(enabledAppObjects);
    }
    prevTabRef.current = activeTab;
  }, [activeTab, agentTools, enabledTools]);

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
          ...(selectedApps.length > 0 ? {
            tool_names: selectedApps.map(a => a.name),
            tool_ids: selectedApps.map(a => a.objectID || a.name),
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

  const resetAction = () => {
    setAgentInput('');
    setRunResult(null);
    setRunError(null);
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
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Local LLM
                {hasOpenAIAuth && <CheckCircle2 size={13} style={{ color: 'hsl(142, 71%, 45%)' }} />}
              </Box>
            }
            icon={<Server size={14} />}
            iconPosition="start"
            sx={{ gap: 0.75 }}
          />
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1.5,
                  px: 0.75,
                  py: 0.5,
                  flexWrap: 'wrap',
                }}>
                  {toolsLoading ? (
                    <CircularProgress size={16} sx={{ color: 'hsl(var(--muted-foreground))' }} />
                  ) : (
                    <>
                      {agentTools.map(tool => {
                        const isEnabled = enabledTools.has(tool.name);
                        const displayName = tool.name.replace(/_/g, ' ');
                        return (
                          <Box key={tool.id} sx={{ position: 'relative' }}>
                            <Tooltip title={displayName} placement="bottom">
                              <IconButton
                                onClick={(e) => setToolsPopover({ anchor: e.currentTarget, tool })}
                                size="small"
                                sx={{
                                  width: 30,
                                  height: 30,
                                  border: '1px solid',
                                  borderColor: isEnabled ? 'rgba(34, 197, 94, 0.20)' : 'transparent',
                                  bgcolor: isEnabled ? 'rgba(34, 197, 94, 0.10)' : 'transparent',
                                  borderRadius: 1,
                                  opacity: isEnabled ? 1 : 0.35,
                                  filter: isEnabled ? 'none' : 'grayscale(1)',
                                  transition: 'opacity 0.15s ease, filter 0.15s ease',
                                  '&:hover': {
                                    bgcolor: isEnabled ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255,255,255,0.1)',
                                    opacity: isEnabled ? 1 : 0.7,
                                    filter: 'none',
                                  },
                                }}
                              >
                                {tool.image ? (
                                  <Box
                                    component="img"
                                    src={tool.image}
                                    alt={tool.name}
                                    sx={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'contain' }}
                                  />
                                ) : (
                                  <Box sx={{
                                    width: 18, height: 18, borderRadius: '50%',
                                    bgcolor: 'hsl(var(--muted))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.6rem', fontWeight: 600, color: 'hsl(var(--foreground))',
                                  }}>
                                    {tool.name.charAt(0).toUpperCase()}
                                  </Box>
                                )}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        );
                      })}
                      <Tooltip title="Add Integration" placement="bottom">
                        <IconButton
                          component={Link}
                          to="/onboarding"
                          size="small"
                          onClick={onClose}
                          sx={{
                            width: 28,
                            height: 28,
                            color: 'hsl(var(--muted-foreground))',
                            border: '1px dashed hsl(var(--border))',
                            borderRadius: 1,
                            '&:hover': {
                              bgcolor: 'hsl(var(--muted))',
                              borderStyle: 'solid',
                              color: 'hsl(var(--primary))',
                            },
                          }}
                        >
                          <AddIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>

                {/* Tool toggle popover */}
                {toolsPopover && (
                  <Popover
                    open
                    anchorEl={toolsPopover.anchor}
                    onClose={() => setToolsPopover(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                    slotProps={{
                      paper: {
                        sx: {
                          mt: 0.5,
                          bgcolor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 1.5,
                          p: 1.5,
                          minWidth: 160,
                        },
                      },
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', textTransform: 'capitalize', mb: 1, display: 'block' }}>
                      {toolsPopover.tool.name.replace(/_/g, ' ')}
                      {!enabledTools.has(toolsPopover.tool.name) && (
                        <Chip label="Disabled" size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }} />
                      )}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Button
                        component="a"
                        href={`/apps/${toolsPopover.tool.name.toLowerCase()}`}
                        target="_blank"
                        size="small"
                        startIcon={<Globe size={14} />}
                        onClick={() => setToolsPopover(null)}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          color: 'hsl(var(--foreground))',
                          px: 1, py: 0.5,
                          borderRadius: 1,
                          '&:hover': { bgcolor: 'hsl(var(--muted))' },
                        }}
                      >
                        Visit app
                      </Button>
                      <Button
                        size="small"
                        startIcon={enabledTools.has(toolsPopover.tool.name) ? <Ban size={14} /> : <Zap size={14} />}
                        onClick={() => toggleTool(toolsPopover.tool.name)}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          color: enabledTools.has(toolsPopover.tool.name) ? 'hsl(var(--destructive))' : 'hsl(var(--severity-low))',
                          px: 1, py: 0.5,
                          borderRadius: 1,
                          '&:hover': { bgcolor: enabledTools.has(toolsPopover.tool.name) ? 'hsl(var(--destructive) / 0.1)' : 'hsla(var(--severity-low) / 0.1)' },
                        }}
                      >
                        {enabledTools.has(toolsPopover.tool.name) ? 'Disable for Agent' : 'Enable for Agent'}
                      </Button>
                    </Box>
                  </Popover>
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
          /* ── Action Tab — inline action form ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Agent input (prompt) — at the top */}
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
                  placeholder={selectedApps.length > 0 ? `Ask about ${selectedApps.map(a => a.name.replace(/_/g, ' ')).join(', ')}…` : 'Describe what you want the agent to do…'}
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

            {/* Target MCPs selector — below prompt */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                Target MCPs (optional)
              </Typography>

              {/* Selected apps chips */}
              {selectedApps.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                  {selectedApps.map((app) => (
                    <Chip
                      key={app.objectID || app.name}
                      avatar={
                        <Avatar
                          src={app.image_url || `https://shuffler.io/images/apps/${app.name}.png`}
                          sx={{ width: 20, height: 20, '& img': { objectFit: 'contain' } }}
                        />
                      }
                      label={app.name?.replace(/_/g, ' ')}
                      size="small"
                      onDelete={() => setSelectedApps(prev => prev.filter(a => a.name !== app.name))}
                      sx={{
                        height: 28,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'capitalize',
                        bgcolor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        '& .MuiChip-deleteIcon': {
                          color: 'hsl(var(--muted-foreground))',
                          fontSize: 16,
                          '&:hover': { color: 'hsl(var(--destructive))' },
                        },
                      }}
                    />
                  ))}
                </Box>
              )}

              {/* Always-visible search */}
              <Box sx={{
                borderRadius: 2,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--background))',
                overflow: 'hidden',
                position: 'relative',
                '& .singul-container': { background: 'transparent !important' },
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
                  maxHeight: '180px !important',
                  overflowY: 'auto !important',
                  position: 'relative !important',
                },
                '& .singul-result-item': {
                  color: 'hsl(var(--foreground)) !important',
                  background: 'transparent !important',
                  fontSize: '0.8rem !important',
                  padding: '6px 12px !important',
                  borderRadius: '4px !important',
                  margin: '2px 4px !important',
                },
                '& .singul-result-item:hover': {
                  background: 'hsl(var(--muted)) !important',
                },
                '& .singul-result-item img': {
                  borderRadius: '4px !important',
                },
              }}>
                <SingulJS
                  ref={singulRef}
                  authToken=""
                  placeholder={selectedApps.length > 0 ? 'Add another MCP…' : 'Search integrations…'}
                  layout="list"
                  hitsPerPage={5}
                  inline={true}
                  showDescription={false}
                  showCategories={false}
                  hideAuthStatus={true}
                  preventDefault={true}
                  onAppSelected={(e) => {
                    if (e?.app && !selectedApps.some(a => a.name === e.app.name)) {
                      setSelectedApps(prev => [...prev, e.app]);
                    }
                  }}
                />
              </Box>
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

        {activeTab === 2 && (
          /* ── Local LLM Tab ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{
              px: 2.5,
              py: 2,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsla(var(--muted) / 0.3)',
            }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                Configure a local or self-hosted model endpoint for agent operations.
              </Typography>
            </Box>

            {/* URL */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                URL
              </Typography>
              <InputBase
                value={localModel.url}
                onChange={(e) => handleLocalModelChange('url', e.target.value)}
                placeholder="http://localhost:11434/v1"
                fullWidth
                sx={{
                  fontSize: '0.82rem',
                  color: 'hsl(var(--foreground))',
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--card))',
                  fontFamily: "'JetBrains Mono', monospace",
                  '& input::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 0.6 },
                  '&:focus-within': {
                    borderColor: 'hsla(var(--primary) / 0.5)',
                    boxShadow: '0 0 0 3px hsla(var(--primary) / 0.08)',
                  },
                }}
              />
            </Box>

            {/* API Key */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                API Key
              </Typography>
              <InputBase
                value={localModel.apikey}
                onChange={(e) => handleLocalModelChange('apikey', e.target.value)}
                placeholder="sk-..."
                type="password"
                fullWidth
                sx={{
                  fontSize: '0.82rem',
                  color: 'hsl(var(--foreground))',
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--card))',
                  fontFamily: "'JetBrains Mono', monospace",
                  '& input::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 0.6 },
                  '&:focus-within': {
                    borderColor: 'hsla(var(--primary) / 0.5)',
                    boxShadow: '0 0 0 3px hsla(var(--primary) / 0.08)',
                  },
                }}
              />
            </Box>

            {/* Model */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                Model
              </Typography>
              <InputBase
                value={localModel.model}
                onChange={(e) => handleLocalModelChange('model', e.target.value)}
                placeholder="llama3, mistral, gpt-4o..."
                fullWidth
                sx={{
                  fontSize: '0.82rem',
                  color: 'hsl(var(--foreground))',
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--card))',
                  fontFamily: "'JetBrains Mono', monospace",
                  '& input::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 0.6 },
                  '&:focus-within': {
                    borderColor: 'hsla(var(--primary) / 0.5)',
                    boxShadow: '0 0 0 3px hsla(var(--primary) / 0.08)',
                  },
                }}
              />
            </Box>

            {/* Save button */}
            <Button
              variant="contained"
              startIcon={localModelSaved ? <ShieldCheck size={14} /> : <SaveIcon sx={{ fontSize: 14 }} />}
              onClick={saveLocalModel}
              sx={{
                bgcolor: localModelSaved ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))',
                color: localModelSaved ? '#fff' : 'hsl(var(--primary-foreground))',
                textTransform: 'none',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 2,
                alignSelf: 'flex-start',
                px: 3,
                '&:hover': {
                  bgcolor: localModelSaved ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))',
                  filter: 'brightness(1.1)',
                },
              }}
            >
              {localModelSaved ? 'Saved' : 'Save Configuration'}
            </Button>
          </Box>
        )}
      </Box>

      {/* View-only Action Drawer for viewing run results */}
      <AgentActionDrawer open={viewDrawerOpen} onClose={() => setViewDrawerOpen(false)} run={viewRun} />
    </Drawer>
  );
};

export default AgentPermissionsDrawer;
