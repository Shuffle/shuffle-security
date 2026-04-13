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
import LocalLLMConfig from '@/components/agent/LocalLLMConfig';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { runAgent } from '@/services/agentRun';
import { deduplicateAuthApps, backfillAppImages } from '@/lib/utils';
import AppSearchDrawer from '@/components/shared/AppSearchDrawer';
import { InputBase, Avatar } from '@mui/material';
import type { AgentRun } from '@/services/agentActivity';
import AgentRunResultViewer from '@/components/agent/AgentRunResultViewer';

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
  const [actionRun, setActionRun] = useState<AgentRun | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<{ name: string; icon: string; categories: string[] }[]>([]);
  const [appSearchOpen, setAppSearchOpen] = useState(false);
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
  

  // OpenAI auth status for Local LLM tab indicator
  const [hasOpenAIAuth, setHasOpenAIAuth] = useState(false);

  // Fetch authenticated apps for tools list
  const fetchAgentTools = useCallback(async () => {
    
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
        await backfillAppImages(deduped);
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

  // Reset tab every time drawer opens & pre-populate action tab if needed
  const prevOpenRef = useRef(open);
  if (open && !prevOpenRef.current) {
    setActiveTab(initialTab ?? 0);
  }
  const justOpened = open && !prevOpenRef.current;
  prevOpenRef.current = open;

  // Pre-populate selectedApps from enabled tools when switching to Action tab + auto-focus
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    const switchedToAction = activeTab === 0 && prevTabRef.current !== 0;
    const openedOnAction = justOpened && (initialTab ?? 0) === 0;
    if (switchedToAction || openedOnAction) {
      if (agentTools.length > 0) {
        const enabledAppObjects = agentTools
          .filter(t => enabledTools.has(t.name))
          .map(t => ({
            name: t.name,
            icon: t.image,
            categories: [] as string[],
          }));
        setSelectedApps(enabledAppObjects);
      }
      // Auto-focus the input
      setTimeout(() => inputRef.current?.focus(), 150);
    }
    prevTabRef.current = activeTab;
  }, [activeTab, agentTools, enabledTools, open]);

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
    setActionRun(null);
    setRunError(null);

    const result = await runAgent({
      input: agentInput.trim(),
      ...(selectedApps.length === 1 ? {
        toolName: selectedApps[0].name,
      } : {}),
      ...(selectedApps.length > 1 ? {
        toolNames: selectedApps.map(a => a.name),
      } : {}),
    });

    if (result.success) {
      const rawData = result.rawData as Record<string, any> | undefined;
      setActionRun({
        execution_id: rawData?.execution_id || crypto.randomUUID(),
        workflow_id: rawData?.workflow_id || '',
        status: rawData?.status || 'FINISHED',
        started_at: new Date().toISOString(),
        results: [{
          result: typeof result.rawData === 'object' ? JSON.stringify(result.rawData) : result.content,
          action: {},
        }],
      });
    } else {
      setRunError(result.error || 'Agent run failed.');
    }
    setIsRunning(false);
  };

  const resetAction = () => {
    setAgentInput('');
    setActionRun(null);
    setRunError(null);
  };

  return (
    <>
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
          <Tab label="Run Agent" icon={<Play size={14} />} iconPosition="start" sx={{ gap: 0.75 }} />
          <Tab label="Permissions" icon={<ShieldCheck size={14} />} iconPosition="start" sx={{ gap: 0.75 }} />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Local LLM
                {hasOpenAIAuth && (
                  <Tooltip title="OpenAI app authentication detected in your account" arrow>
                    <CheckCircle2 size={13} style={{ color: 'hsl(142, 71%, 45%)', cursor: 'help' }} />
                  </Tooltip>
                )}
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
        {activeTab === 1 && (
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

        {activeTab === 0 && (
          /* ── Action Tab — inline action form ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Agent input (prompt) — prominent at the top */}
            <Box>
              <Box sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                borderRadius: 2.5,
                border: '1.5px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
                px: 2,
                py: 1.5,
                minHeight: 56,
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                '&:focus-within': {
                  borderColor: 'hsl(var(--primary))',
                  boxShadow: '0 0 0 3px hsla(var(--primary) / 0.12)',
                },
              }}>
                <InputBase
                  inputRef={inputRef}
                  autoFocus
                  multiline
                  maxRows={6}
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  placeholder={selectedApps.length > 0 ? `Ask about ${selectedApps.map(a => a.name.replace(/_/g, ' ')).join(', ')}…` : 'What should the agent do?'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleRunAgent();
                    }
                  }}
                  fullWidth
                  sx={{
                    fontSize: '0.9rem',
                    color: 'hsl(var(--foreground))',
                    '& textarea::placeholder': {
                      color: 'hsl(var(--muted-foreground))',
                      opacity: 0.6,
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
                    width: 34,
                    height: 34,
                    borderRadius: '10px',
                    flexShrink: 0,
                    cursor: agentInput.trim() && !isRunning ? 'pointer' : 'default',
                    bgcolor: agentInput.trim() && !isRunning ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    color: agentInput.trim() && !isRunning ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    transition: 'all 0.15s ease',
                    '&:hover': agentInput.trim() && !isRunning ? { filter: 'brightness(1.1)' } : {},
                  }}
                >
                  {isRunning ? (
                    <CircularProgress size={16} sx={{ color: 'inherit' }} />
                  ) : (
                    <PlayArrowRoundedIcon sx={{ fontSize: 20 }} />
                  )}
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', mt: 0.75 }}>
                ⌘+Enter to send
              </Typography>
            </Box>

            {/* Target MCPs (optional) */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                Target MCPs (optional)
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                {selectedApps.map((app) => (
                  <Tooltip key={app.name} title={app.name?.replace(/_/g, ' ')} placement="bottom">
                    <Box
                      sx={{
                        position: 'relative',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: '2px solid hsl(var(--border))',
                        overflow: 'visible',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'hsl(var(--card))',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease',
                        '&:hover': {
                          borderColor: 'hsl(var(--destructive))',
                          '& .remove-badge': { opacity: 1 },
                        },
                      }}
                      onClick={() => setSelectedApps(prev => prev.filter(a => a.name !== app.name))}
                    >
                      <Box
                        component="img"
                        src={app.icon || `https://shuffler.io/images/apps/${app.name}.png`}
                        alt={app.name}
                        sx={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'contain' }}
                      />
                      <Box
                        className="remove-badge"
                        sx={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          bgcolor: 'hsl(var(--destructive))',
                          color: 'hsl(var(--destructive-foreground))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          opacity: 0,
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        ✕
                      </Box>
                    </Box>
                  </Tooltip>
                ))}

                {/* Add button */}
                <Tooltip title="Add app" placement="bottom">
                  <Box
                    onClick={() => setAppSearchOpen(true)}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      border: '2px dashed hsl(var(--border))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'hsl(var(--muted-foreground))',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary))',
                        bgcolor: 'hsla(var(--primary) / 0.06)',
                      },
                    }}
                  >
                    <AddIcon sx={{ fontSize: 18 }} />
                  </Box>
                </Tooltip>
              </Box>
            </Box>

            {runError && (
              <Alert severity="error" sx={{ fontSize: '0.8rem', borderRadius: 2 }}>
                {runError}
              </Alert>
            )}

            {actionRun && (
              <Box sx={{
                borderRadius: 2,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--background))',
                overflow: 'hidden',
              }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', px: 2.5, pt: 2, pb: 0.5 }}>
                  Result
                </Typography>
                <AgentRunResultViewer run={actionRun} />
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
          <LocalLLMConfig hasOpenAIAuth={hasOpenAIAuth} />
        )}
      </Box>

      {/* View-only Action Drawer for viewing run results */}
      <AgentActionDrawer open={viewDrawerOpen} onClose={() => setViewDrawerOpen(false)} run={viewRun} />
    </Drawer>

    {/* App Search Drawer for Action tab */}
    <AppSearchDrawer
      open={appSearchOpen}
      onClose={() => setAppSearchOpen(false)}
      title="Find Apps"
      subtitle="Select apps to target with the agent"
      onQuickSelect={(app) => {
        setSelectedApps(prev =>
          prev.some(a => a.name === app.name)
            ? prev
            : [...prev, app]
        );
      }}
    />
  </>
  );
};

export default AgentPermissionsDrawer;
