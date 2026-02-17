/**
 * AgentActionDrawer — Standalone drawer for running agent actions and viewing execution results.
 *
 * Modes:
 * - "action": Interactive mode — search apps, type a prompt, run agent via JSON-RPC.
 * - "view":   Read-only mode — display an existing AgentRun's results.
 *
 * Designed to be reusable and extensible (e.g. embeddable in Singul frontend API).
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  IconButton,
  Button,
  Alert,
  Drawer,
  InputBase,
  Avatar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { Activity, Bot } from 'lucide-react';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { SingulJS } from '@/lib/singul-local';
import type { AlgoliaSearchApp, SingulJSHandle } from '@/lib/singul-local';
import type { AgentRun } from '@/services/agentActivity';
import AgentRunResultViewer from '@/components/agent/AgentRunResultViewer';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AgentActionDrawerProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the drawer shows this run's results (view mode). */
  run?: AgentRun | null;
  /** Optional initial app to target. */
  initialApp?: AlgoliaSearchApp | null;
}

// ── Component ──────────────────────────────────────────────────────────────────

const AgentActionDrawer = ({ open, onClose, run, initialApp }: AgentActionDrawerProps) => {
  const navigate = useNavigate();

  // Action mode state
  const [agentInput, setAgentInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<AlgoliaSearchApp | null>(initialApp ?? null);
  const singulRef = useRef<SingulJSHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isViewMode = !!run;

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

  const reset = () => {
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
          width: { xs: '100%', sm: 480 },
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: '1px solid hsl(var(--border))',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* ── Header ── */}
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
          <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', color: 'hsl(var(--foreground))' }}>
            {isViewMode ? 'Execution Detail' : 'Agent Action'}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
            {isViewMode
              ? `Run ${run!.execution_id?.slice(0, 12) || '—'}`
              : 'Run an action via JSON-RPC'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        {isViewMode ? (
          /* ── View Mode: show the run result ── */
          <AgentRunResultViewer run={run!} />
        ) : (
          /* ── Action Mode: app selector + prompt ── */
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

export default AgentActionDrawer;
