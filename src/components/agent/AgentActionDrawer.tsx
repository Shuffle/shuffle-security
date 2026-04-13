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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Activity, CheckCircle2, Circle, AlertCircle, Clock, Wrench, MessageCircleQuestion, Flag, Play, Brain } from 'lucide-react';
import AgentIcon from '@/components/agent/AgentIcon';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { runAgent } from '@/services/agentRun';
import AppSearchDrawer from '@/components/shared/AppSearchDrawer';
import type { AgentRun, AgentDecision } from '@/services/agentActivity';
import AgentRunResultViewer, { parseRunResult } from '@/components/agent/AgentRunResultViewer';
import AgentRunHeader from '@/components/agent/AgentRunHeader';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SelectedApp {
  name: string;
  icon: string;
  categories: string[];
}

export interface AgentActionDrawerProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the drawer shows this run's results (view mode). */
  run?: AgentRun | null;
  /** Optional initial app to target. */
  initialApp?: SelectedApp | null;
}

// ── Decision helpers ──────────────────────────────────────────────────────────

const formatDecisionDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// ── Decision type classification ───────────────────────────────────────────────

type DecisionType = 'action' | 'question' | 'finish';

const classifyDecision = (decision: AgentDecision): DecisionType => {
  const a = (decision.action || decision.title || '').toLowerCase();
  const s = (decision.status || '').toLowerCase();
  if (['finish', 'finalise', 'finalize', 'done', 'complete', 'completed'].some(k => a.includes(k) || s.includes(k))) return 'finish';
  if (['question', 'ask', 'prompt', 'confirm', 'approval', 'input_needed'].some(k => a.includes(k) || s.includes(k))) return 'question';
  return 'action';
};

const DECISION_TYPE_CONFIG: Record<DecisionType, {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
  icon: React.ReactNode;
}> = {
  action: {
    label: 'Action',
    color: 'hsl(var(--primary))',
    bg: 'hsla(var(--primary) / 0.06)',
    borderColor: 'hsla(var(--primary) / 0.25)',
    icon: <Play size={13} />,
  },
  question: {
    label: 'Question',
    color: 'hsl(var(--severity-medium))',
    bg: 'hsla(var(--severity-medium) / 0.06)',
    borderColor: 'hsla(var(--severity-medium) / 0.25)',
    icon: <MessageCircleQuestion size={13} />,
  },
  finish: {
    label: 'Finish',
    color: 'hsl(var(--severity-low))',
    bg: 'hsla(var(--severity-low) / 0.06)',
    borderColor: 'hsla(var(--severity-low) / 0.25)',
    icon: <Flag size={13} />,
  },
};

// ── Decisions Timeline ─────────────────────────────────────────────────────────

const DecisionsTimeline = ({ decisions }: { decisions: AgentDecision[] }) => {
  if (!decisions.length) return null;

  const counts = decisions.reduce((acc, d) => {
    const t = classifyDecision(d);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<DecisionType, number>);

  return (
    <Box sx={{ mt: 2 }}>
      {/* Header with type summary */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Decisions · {decisions.length}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(['action', 'question', 'finish'] as DecisionType[]).map(type => {
            const count = counts[type];
            if (!count) return null;
            const cfg = DECISION_TYPE_CONFIG[type];
            return (
              <Chip
                key={type}
                label={`${count} ${cfg.label}`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  bgcolor: cfg.bg,
                  color: cfg.color,
                  border: `1px solid ${cfg.borderColor}`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Timeline */}
      <Box sx={{ position: 'relative', pl: 3 }}>
        {/* Vertical spine */}
        <Box sx={{
          position: 'absolute',
          left: 8,
          top: 0,
          bottom: 0,
          width: '2px',
          background: 'linear-gradient(180deg, hsl(var(--border)) 0%, transparent 100%)',
        }} />

        {decisions.map((decision, idx) => {
          const type = classifyDecision(decision);
          const cfg = DECISION_TYPE_CONFIG[type];
          const isLast = idx === decisions.length - 1;
          const label = decision.title || decision.action?.replace(/_/g, ' ') || cfg.label;

          // Calculate thinking time (gap between previous decision's end and this one's start)
          let thinkingMs = 0;
          if (idx > 0 && decision.timestamp) {
            const prev = decisions[idx - 1];
            const prevEnd = prev.timestamp
              ? (typeof prev.timestamp === 'number' ? prev.timestamp * 1000 : new Date(prev.timestamp).getTime())
                + (typeof prev.duration === 'number' ? prev.duration * 1000 : 0)
              : 0;
            const thisStart = typeof decision.timestamp === 'number'
              ? decision.timestamp * 1000
              : new Date(decision.timestamp).getTime();
            if (prevEnd && thisStart && thisStart > prevEnd) {
              thinkingMs = thisStart - prevEnd;
            }
          }

          // Decision duration
          const durationMs = typeof decision.duration === 'number' ? decision.duration * 1000 : 0;

          return (
            <Box key={idx}>
              {/* Thinking gap indicator */}
              {thinkingMs > 200 && (
                <Box sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  my: 0.75,
                }}>
                  <Box sx={{
                    position: 'absolute',
                    left: -22,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'hsl(var(--background))',
                    color: 'hsl(var(--muted-foreground))',
                    zIndex: 1,
                  }}>
                    <Brain size={10} />
                  </Box>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: 'hsla(var(--muted-foreground) / 0.06)',
                    border: '1px dashed hsla(var(--muted-foreground) / 0.2)',
                  }}>
                    <Brain size={9} style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.5 }} />
                    <Typography sx={{ fontSize: '0.58rem', color: 'hsl(var(--muted-foreground))', opacity: 0.6, fontWeight: 500 }}>
                      Thinking · {formatDecisionDuration(thinkingMs)}
                    </Typography>
                  </Box>
                </Box>
              )}

              <Box sx={{ position: 'relative', mb: isLast ? 0 : 1.5 }}>
                {/* Node dot */}
                <Box sx={{
                  position: 'absolute',
                  left: -24,
                  top: 10,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: cfg.bg,
                  border: `1.5px solid ${cfg.borderColor}`,
                  color: cfg.color,
                  zIndex: 1,
                }}>
                  {cfg.icon}
                </Box>

                {/* Card */}
                <Box sx={{
                  borderRadius: 2,
                  border: `1px solid ${cfg.borderColor}`,
                  borderLeft: `3px solid ${cfg.color}`,
                  bgcolor: cfg.bg,
                  overflow: 'hidden',
                }}>
                  {/* Card header */}
                  <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                      flex: 1,
                      textTransform: 'capitalize',
                    }}>
                      {label}
                    </Typography>
                    {durationMs > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
                        <Clock size={10} />
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 500 }}>
                          {formatDecisionDuration(durationMs)}
                        </Typography>
                      </Box>
                    )}
                    <Chip
                      label={cfg.label}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        bgcolor: 'transparent',
                        color: cfg.color,
                        border: `1px solid ${cfg.borderColor}`,
                        '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                  </Box>

                  {/* Description */}
                  {decision.description && (
                    <Box sx={{ px: 1.5, pb: 1 }}>
                      <Typography sx={{ fontSize: '0.74rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.55 }}>
                        {decision.description}
                      </Typography>
                    </Box>
                  )}

                  {/* Tool badge */}
                  {decision.tool && (
                    <Box sx={{ px: 1.5, pb: 1 }}>
                      <Chip
                        icon={<Wrench size={10} />}
                        label={decision.tool}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          bgcolor: 'hsla(var(--primary) / 0.08)',
                          color: 'hsl(var(--primary))',
                          '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                        }}
                      />
                    </Box>
                  )}

                  {/* Result snippet (actions only) */}
                  {type === 'action' && decision.result && (
                    <Box sx={{
                      mx: 1.5, mb: 1, p: 1,
                      borderRadius: 1,
                      bgcolor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      maxHeight: 72,
                      overflow: 'auto',
                    }}>
                      <Typography sx={{
                        fontSize: '0.68rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'hsl(var(--muted-foreground))',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        m: 0,
                      }}>
                        {decision.result}
                      </Typography>
                    </Box>
                  )}

                  {/* Footer */}
                  {(decision.status || decision.timestamp) && (
                    <Box sx={{
                      px: 1.5, py: 0.75,
                      borderTop: `1px solid ${cfg.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}>
                      {decision.status && (
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: cfg.color, textTransform: 'uppercase' }}>
                          {decision.status}
                        </Typography>
                      )}
                      {decision.timestamp && (
                        <Typography sx={{ fontSize: '0.6rem', color: 'hsl(var(--muted-foreground))', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 0.3, ml: 'auto' }}>
                          <Clock size={9} />
                          {typeof decision.timestamp === 'number'
                            ? new Date(decision.timestamp * 1000).toLocaleTimeString()
                            : decision.timestamp}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────

const AgentActionDrawer = ({ open, onClose, run, initialApp }: AgentActionDrawerProps) => {
  const navigate = useNavigate();

  // Action mode state
  const [agentInput, setAgentInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<SelectedApp[]>(initialApp ? [initialApp] : []);
  const [appSearchOpen, setAppSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isViewMode = !!run;

  const handleRunAgent = async () => {
    if (!agentInput.trim() || isRunning) return;
    setIsRunning(true);
    setRunResult(null);
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
      setRunResult(result.content);
    } else {
      setRunError(result.error || 'Agent run failed.');
    }
    setIsRunning(false);
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
        borderBottom: '1px solid hsl(var(--border))',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
      }}>
        {isViewMode && run ? (
          <Box sx={{ flex: 1 }}>
            <AgentRunHeader run={run} />
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2 }}>
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
              <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', color: 'hsl(var(--foreground))' }}>
                Agent Action
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                Run an action via JSON-RPC
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))', mr: 2 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        {isViewMode ? (
          /* ── View Mode: decisions timeline + result ── */
          (() => {
            const { parsed } = parseRunResult(run!);
            const decisions: AgentDecision[] = Array.isArray(parsed?.decisions) ? parsed.decisions
              : Array.isArray(run!.decisions) ? run!.decisions : [];
            return (
              <Box>
                {decisions.length > 0 && (
                  <DecisionsTimeline decisions={decisions} />
                )}
                <Box sx={{ mt: decisions.length ? 2.5 : 0 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                    Result
                  </Typography>
                  <AgentRunResultViewer run={run!} />
                </Box>
              </Box>
            );
          })()
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
