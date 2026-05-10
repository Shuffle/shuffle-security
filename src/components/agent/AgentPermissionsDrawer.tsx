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
  Zap,
  Server,
  ShieldCheck,
  Activity,
  Globe,
  Ban,
  CheckCircle2,
  Settings2,
  Play,
  Paperclip,
  X,
} from 'lucide-react';

import AgentActionDrawer from '@/components/agent/AgentActionDrawer';
import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import LocalLLMConfig from '@/components/agent/LocalLLMConfig';
import PermissionsPanel from '@/components/agent/PermissionsPanel';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { runAgent } from '@/services/agentRun';
import { deduplicateAuthApps, backfillAppImages } from '@/lib/utils';
import AppSearchDrawer from '@/Shuffle-MCPs/AppSearchDrawer';
import { InputBase, Avatar } from '@mui/material';
import type { AgentRun } from '@/services/agentActivity';
import AgentRunResultViewer from '@/components/agent/AgentRunResultViewer';
import { useAuth } from '@/context/AuthContext';

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
  const { userInfo } = useAuth();
  const isSupport = userInfo?.support === true;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImages, setAttachedImages] = useState<{ dataUrl: string; name: string }[]>([]);

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

  // Pre-populate selectedApps from enabled tools when on Action tab
  const prevTabRef = useRef(activeTab);
  const hasPopulatedRef = useRef(false);

  // Reset populated flag when drawer closes
  useEffect(() => {
    if (!open) hasPopulatedRef.current = false;
  }, [open]);

  useEffect(() => {
    const onActionTab = activeTab === 0;
    const switchedToAction = activeTab === 0 && prevTabRef.current !== 0;
    const openedOnAction = justOpened && (initialTab ?? 0) === 0;

    if (switchedToAction || openedOnAction) {
      hasPopulatedRef.current = false; // allow re-population
    }

    // Populate when on action tab, tools are loaded, and we haven't populated yet
    if (onActionTab && agentTools.length > 0 && !hasPopulatedRef.current) {
      const enabledAppObjects = agentTools
        .filter(t => enabledTools.has(t.name))
        .map(t => ({
          name: t.name,
          icon: t.image,
          categories: [] as string[],
        }));
      setSelectedApps(enabledAppObjects);
      hasPopulatedRef.current = true;
      setTimeout(() => inputRef.current?.focus(), 150);
    }

    // Auto-focus on tab switch even if already populated
    if (switchedToAction || openedOnAction) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }

    prevTabRef.current = activeTab;
  }, [activeTab, agentTools, enabledTools, open]);



  const handleImageSelected = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setRunError('Only image files can be attached.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const result = reader.result;
        setAttachedImages(prev => [...prev, { dataUrl: result, name: file.name || 'Pasted image' }]);
        setRunError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImagesSelected = (files: FileList | File[] | null) => {
    if (!files) return;
    Array.from(files).forEach(handleImageSelected);
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
      ...(attachedImages.length > 0 ? { images: attachedImages.map(img => {
        const m = /^data:([^;]+);base64,(.*)$/.exec(img.dataUrl);
        return m ? { mimeType: m[1], data: m[2], name: img.name } : { mimeType: 'image/png', data: img.dataUrl, name: img.name };
      }) } : {}),
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
    setAttachedImages([]);
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
          <Tab label="Run" icon={<Play size={14} />} iconPosition="start" sx={{ gap: 0.75 }} />
          <Tab
            label={
              <Tooltip title={isSupport ? '' : 'Coming soon'} arrow disableHoverListener={isSupport}>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                  Permissions
                </Box>
              </Tooltip>
            }
            icon={<ShieldCheck size={14} />}
            iconPosition="start"
            disabled={!isSupport}
            sx={{ gap: 0.75 }}
          />
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
          <Box>
            <Alert
              severity="info"
              icon={<ShieldCheck size={16} />}
              sx={{
                mb: 2,
                fontSize: '0.78rem',
                borderRadius: 1.5,
                bgcolor: 'hsla(var(--primary) / 0.08)',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsla(var(--primary) / 0.25)',
                '& .MuiAlert-icon': { color: 'hsl(var(--primary))' },
              }}
            >
              Support-only preview. This tab is not yet available to customers.
            </Alert>
            <PermissionsPanel compact />
          </Box>
        )}

        {activeTab === 0 && (
          /* ── Action Tab — inline action form ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Agent input (prompt) — prominent at the top */}
            <Box>
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
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
                {attachedImages.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignSelf: 'flex-start' }}>
                    {attachedImages.map((img, idx) => (
                      <Box key={`${img.name}-${idx}`} sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 0.5,
                        pr: 1,
                        borderRadius: 1.5,
                        border: '1px solid hsl(var(--border))',
                        bgcolor: 'hsl(var(--background))',
                        maxWidth: '100%',
                      }}>
                        <Box component="img" src={img.dataUrl} alt={img.name} sx={{ width: 32, height: 32, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--foreground))', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {img.name}
                        </Typography>
                        <IconButton size="small" onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))} sx={{ p: 0.25, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--destructive))' } }} aria-label="Remove attached image">
                          <X size={12} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, width: '100%' }}>
                <InputBase
                  inputRef={inputRef}
                  autoFocus
                  multiline
                  minRows={3}
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
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    const files: File[] = [];
                    for (const item of Array.from(items)) {
                      if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) files.push(file);
                      }
                    }
                    if (files.length > 0) {
                      e.preventDefault();
                      handleImagesSelected(files);
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    handleImagesSelected(e.target.files);
                    if (e.target) e.target.value = '';
                  }}
                />
                <Box
                  component="button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRunning}
                  title={attachedImages.length > 0 ? `Add image (${attachedImages.length} attached)` : 'Attach image'}
                  sx={{
                    all: 'unset',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 34,
                    height: 34,
                    borderRadius: '10px',
                    flexShrink: 0,
                    cursor: isRunning ? 'default' : 'pointer',
                    color: attachedImages.length > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    bgcolor: attachedImages.length > 0 ? 'hsla(var(--primary) / 0.1)' : 'transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': isRunning ? {} : {
                      color: 'hsl(var(--foreground))',
                      bgcolor: 'hsl(var(--muted))',
                    },
                  }}
                >
                  <Paperclip size={16} />
                </Box>
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
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', mt: 0.75 }}>
                ⌘+Enter to send · paste or attach an image
              </Typography>
            </Box>

            {/* Target MCPs (optional) */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                Target MCPs (optional)
              </Typography>

              <Box sx={{
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
                {selectedApps.map((app) => (
                  <Tooltip key={app.name} title={app.name?.replace(/_/g, ' ')} placement="bottom">
                    <IconButton
                      onClick={() => setSelectedApps(prev => prev.filter(a => a.name !== app.name))}
                      size="small"
                      sx={{
                        width: 30,
                        height: 30,
                        border: '1px solid rgba(34, 197, 94, 0.20)',
                        bgcolor: 'rgba(34, 197, 94, 0.10)',
                        borderRadius: 1,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: 'hsl(var(--destructive) / 0.15)',
                          borderColor: 'hsl(var(--destructive) / 0.4)',
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={app.icon || `https://shuffler.io/images/apps/${app.name}.png`}
                        alt={app.name}
                        sx={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'contain' }}
                      />
                    </IconButton>
                  </Tooltip>
                ))}

                {/* Add button */}
                <Tooltip title="Add app" placement="bottom">
                  <IconButton
                    onClick={() => setAppSearchOpen(true)}
                    size="small"
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
