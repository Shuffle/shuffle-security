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
import { Activity, CheckCircle2, Circle, AlertCircle, Clock, Wrench, MessageCircleQuestion, Flag, Play, Brain, ChevronRight, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AgentIcon from '@/components/agent/AgentIcon';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { runAgent } from '@/services/agentRun';
import AppSearchDrawer from '@/components/shared/AppSearchDrawer';
import type { AgentRun, AgentDecision } from '@/services/agentActivity';
import AgentRunResultViewer, { parseRunResult } from '@/components/agent/AgentRunResultViewer';
import AgentRunHeader from '@/components/agent/AgentRunHeader';
import { useExecutionPolling } from '@/hooks/useExecutionPolling';
import { useSourceAppImage } from '@/hooks/useSourceAppImage';

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

// ── Tool Badge ────────────────────────────────────────────────────────────────

/**
 * Renders a decision's `tool` field as a chip with the integration's logo.
 * Looks the logo up via useSourceAppImage (authenticated apps → Algolia
 * fallback). Falls back to the wrench icon when no image resolves.
 */
const ToolBadge = ({ tool }: { tool: string }) => {
  const image = useSourceAppImage(tool);
  return (
    <Box sx={{ px: 1.5, pb: 1 }}>
      <Chip
        icon={
          image ? (
            <Avatar
              src={image}
              alt={tool}
              sx={{
                width: 14,
                height: 14,
                bgcolor: 'transparent',
                '& img': { objectFit: 'contain' },
              }}
            />
          ) : (
            <Wrench size={10} />
          )
        }
        label={tool.replace(/_/g, ' ')}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.65rem',
          bgcolor: 'hsla(var(--primary) / 0.08)',
          color: 'hsl(var(--primary))',
          textTransform: 'capitalize',
          '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
        }}
      />
    </Box>
  );
};

// ── Decision Item (per-card with collapsible Details) ─────────────────────────

/** Fields rendered explicitly on the card — excluded from the Details dump. */
const SURFACED_FIELDS = new Set([
  'title', 'description', 'status', 'timestamp', 'duration',
  'action', 'result', 'tool',
]);

const DecisionItem = ({
  decision,
  prev,
  isLast,
}: {
  decision: AgentDecision;
  prev?: AgentDecision;
  isLast: boolean;
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const type = classifyDecision(decision);
  const cfg = DECISION_TYPE_CONFIG[type];
  const label = decision.title || decision.action?.replace(/_/g, ' ') || cfg.label;

  // Thinking gap
  let thinkingMs = 0;
  if (prev && decision.timestamp) {
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

  const durationMs = typeof decision.duration === 'number' ? decision.duration * 1000 : 0;

  const hasReason = typeof decision.reason === 'string' && decision.reason.trim().length > 0;

  return (
    <Box>
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

          {/* Tool badge — shows the integration logo when we can resolve one
              from the authenticated apps list or the public Algolia catalog. */}
          {decision.tool && <ToolBadge tool={decision.tool} />}

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

          {/* Details (collapsible) — reason (markdown) + extra fields + nested Debug */}
          <Box sx={{ px: 1.5, pb: 1 }}>
            <Box
              onClick={() => setDetailsOpen((v) => !v)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                userSelect: 'none',
                color: 'hsl(var(--muted-foreground))',
                '&:hover': { color: 'hsl(var(--foreground))' },
              }}
            >
              {detailsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <Typography sx={{
                fontSize: '0.6rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Details
              </Typography>
            </Box>
            {detailsOpen && (
              <Box sx={{ mt: 0.75 }}>
                {/* Reason — rendered as Markdown at the top of details */}
                {hasReason && (
                  <Box sx={{
                    mb: 1,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    '& p': {
                      fontSize: '0.76rem',
                      color: 'hsl(var(--foreground))',
                      lineHeight: 1.6,
                      m: 0,
                      mb: 0.5,
                    },
                    '& p:last-child': { mb: 0 },
                    '& strong': { color: 'hsl(var(--foreground))', fontWeight: 700 },
                    '& code': {
                      fontSize: '0.7rem',
                      bgcolor: 'hsl(var(--muted))',
                      px: 0.5,
                      py: 0.15,
                      borderRadius: 0.5,
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                    },
                    '& ul, & ol': { fontSize: '0.76rem', pl: 2.25, m: 0, mb: 0.5 },
                    '& a': { color: 'hsl(var(--primary))', textDecoration: 'none' },
                  }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {decision.reason as string}
                    </ReactMarkdown>
                  </Box>
                )}

                {/* Debug — raw decision JSON */}
                <Box
                  onClick={() => setDebugOpen((v) => !v)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: 'hsl(var(--muted-foreground))',
                    opacity: 0.7,
                    '&:hover': { color: 'hsl(var(--foreground))', opacity: 1 },
                  }}
                >
                  {debugOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <Typography sx={{
                    fontSize: '0.58rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    Debug
                  </Typography>
                </Box>
                {debugOpen && (
                  <Box sx={{
                    mt: 0.5,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'hsl(var(--muted))',
                    border: '1px solid hsl(var(--border))',
                    overflow: 'auto',
                    maxHeight: 320,
                  }}>
                    <pre style={{
                      margin: 0,
                      fontSize: '0.68rem',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                      color: 'hsl(var(--foreground))',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.5,
                    }}>
                      {JSON.stringify(decision, null, 2)}
                    </pre>
                  </Box>
                )}
              </Box>
            )}
          </Box>

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
          const prev = idx > 0 ? decisions[idx - 1] : undefined;
          return (
            <DecisionItem
              key={idx}
              decision={decision}
              prev={prev}
              isLast={idx === decisions.length - 1}
            />
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
  const [actionRun, setActionRun] = useState<AgentRun | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<SelectedApp[]>(initialApp ? [initialApp] : []);
  const [appSearchOpen, setAppSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live-poll the run while it is in-progress. Returns the same reference
  // when nothing changed, so the view does not re-render on every tick.
  const liveRun = useExecutionPolling(run, { enabled: open && !!run });

  const isViewMode = !!liveRun;

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
      // Build a minimal AgentRun so we can use AgentRunResultViewer
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

  const reset = () => {
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
        {isViewMode && liveRun ? (
          <Box sx={{ flex: 1 }}>
            <AgentRunHeader run={liveRun} />
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
            const { parsed } = parseRunResult(liveRun!);
            const decisions: AgentDecision[] = Array.isArray(parsed?.decisions) ? parsed.decisions
              : Array.isArray(liveRun!.decisions) ? liveRun!.decisions : [];
            return (
              <Box>
                {decisions.length > 0 && (
                  <DecisionsTimeline decisions={decisions} />
                )}
                <Box sx={{ mt: decisions.length ? 2.5 : 0 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                    Result
                  </Typography>
                  <AgentRunResultViewer run={liveRun!} />
                </Box>
              </Box>
            );
          })()
        ) : (
          /* ── Action Mode: app selector + prompt ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Target MCPs (optional) */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                Target MCPs (optional)
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                {selectedApps.map((app) => (
                  <Box
                    key={app.name}
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
                    title={`Remove ${app.name.replace(/_/g, ' ')}`}
                  >
                    <Avatar
                      src={app.icon || `https://shuffler.io/images/apps/${app.name}.png`}
                      sx={{ width: 26, height: 26, '& img': { objectFit: 'contain' } }}
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
                ))}

                {/* Add button */}
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
                  <AddRoundedIcon sx={{ fontSize: 18 }} />
                </Box>
              </Box>
            </Box>

            {/* Agent input */}
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
                  placeholder={selectedApps.length === 1 ? `Ask ${selectedApps[0].name.replace(/_/g, ' ')} something…` : selectedApps.length > 1 ? `Ask ${selectedApps.length} apps something…` : 'What should the agent do?'}
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
                ⌘+Enter to send · JSON-RPC
              </Typography>
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
      </Box>
    </Drawer>

    {/* App Search Drawer */}
    <AppSearchDrawer
      open={appSearchOpen}
      onClose={() => setAppSearchOpen(false)}
      title="Find Apps"
      subtitle="Select apps to target with the agent"
      onQuickSelect={(app) => {
        // Prevent duplicates
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

export default AgentActionDrawer;
