/**
 * AgentUI — Standalone "start + debug agents" surface.
 *
 * TypeScript port and modernization of the legacy Shuffle Core
 * `AgentUI.jsx`. One component, two modes:
 *
 *  1. **Starter** — large hero prompt ("What do you want to do?")
 *     with attached MCP/app chips. Submits to `/api/v1/agent`.
 *  2. **Debugger** — compact header + decision timeline driven by
 *     `/api/v1/streams/results`, with question/continuation forms
 *     and per-decision raw-JSON inspection.
 *
 * Mode switches automatically when an execution is started or when
 * `?execution_id=...&authorization=...` is present in the URL.
 *
 * Self-contained: uses {@link AppSearchDrawer} for app picking,
 * {@link runAgent} for the JSON-RPC call, and the library's
 * {@link toast} facade for notifications.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  // ButtonGroup removed (replaced by chip tabs)
  Chip,
  CircularProgress,
  IconButton,
  InputBase,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassDisabledIcon from '@mui/icons-material/HourglassDisabled';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SendIcon from '@mui/icons-material/Send';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// Normalize agent answer text so react-markdown renders it correctly:
// - Decode literal escape sequences ("\n", "\t", "\r") that come back
//   double-encoded in some JSON payloads.
// - Strip surrounding quotes if the value is itself a JSON-encoded string.
// - Trim leading/trailing whitespace.
const normalizeMarkdown = (raw: unknown): string => {
  if (raw == null) return '';
  let s = typeof raw === 'string' ? raw : (() => {
    try { return JSON.stringify(raw, null, 2); } catch { return String(raw); }
  })();
  // If the whole thing is a JSON-encoded string, decode it once.
  if (s.length > 1 && s.startsWith('"') && s.endsWith('"')) {
    try { s = JSON.parse(s); } catch { /* keep as-is */ }
  }
  // Convert literal "\n" / "\t" / "\r" sequences into real characters.
  s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
  return s.trim();
};
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import 'react18-json-view/src/dark.css';

/** Recursively parse JSON-looking strings into objects/arrays so JsonView can collapse them. */
const deepParseJsonStrings = (obj: any, depth = 0): any => {
  if (depth > 5) return obj;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          return deepParseJsonStrings(parsed, depth + 1);
        }
      } catch { /* ignore */ }
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((item) => deepParseJsonStrings(item, depth + 1));
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepParseJsonStrings(value, depth + 1);
    }
    return result;
  }
  return obj;
};

import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import AppSearchDrawer from '@/Shuffle-MCPs/AppSearchDrawer';
import { getApiUrl, getAuthHeader, API_CONFIG } from '@/Shuffle-MCPs/api';
import { toast } from '@/Shuffle-MCPs/toast';
import { runAgent } from '@/services/agentRun';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AgentUIApp {
  /** App slug, e.g. "http", "shuffle_tools", "gmail". */
  name: string;
  /** Algolia objectID / Shuffle app id (preferred). */
  id?: string;
  /** Optional preview icon URL. */
  icon?: string;
}

export interface AgentUIProps {
  /** Controlled list of apps. When provided, overrides defaultApps and disables auto-load. */
  apps?: AgentUIApp[];
  /** Initial chip set under the prompt. Used only when `apps` is not provided. */
  defaultApps?: AgentUIApp[];
  /**
   * When true (default) and neither `apps` nor `defaultApps` is provided, fetch the
   * caller's authenticated apps via `/api/v1/apps/authentication` (requires an API
   * token to be set on `API_CONFIG`).
   */
  autoLoadApps?: boolean;
  /** Hero title above the prompt. */
  title?: string;
  /** Optional subtitle/description shown under the title. */
  subtitle?: React.ReactNode;
  /** Placeholder shown in the empty prompt. */
  placeholder?: string;
  /** Pre-fill the prompt with this text. */
  defaultInput?: string;
  /** Submit immediately on mount when `defaultInput` is provided. */
  autoSubmit?: boolean;
  /** Hide the centered hero icon (compact mode). */
  hideHeroIcon?: boolean;
  /** Replace the default AgentIcon with a custom node (e.g. brand logo). */
  heroIcon?: React.ReactNode;
  /** Pixel size of the hero icon container. Default 84. */
  heroIconSize?: number;
  /** Maximum width of the centered card. */
  maxWidth?: number;
  /** Compact mode: hides the hero icon, shrinks padding. */
  compact?: boolean;
  /** Hide the "Select Apps / MCPs" chip row entirely. */
  hideAppPicker?: boolean;
  /** Hide the paperclip image-attachment button. */
  hideAttach?: boolean;
  /** Label on the "Select Apps / MCPs" chip. */
  appPickerLabel?: string;
  /** Title on the AppSearchDrawer. */
  appPickerTitle?: string;
  /** Subtitle on the AppSearchDrawer. */
  appPickerSubtitle?: string;
  /** Tooltip on the submit button. Default: "⌘+Enter to send". */
  submitTooltip?: string;
  /** Custom icon for the submit button. */
  submitIcon?: React.ReactNode;
  /** Placeholder for the post-finish continuation field. */
  continuationPlaceholder?: string;
  /** Read `?execution_id` & `?authorization` from window URL on mount. */
  readUrlParams?: boolean;
  /**
   * Optional explicit execution to attach to on mount. Overrides URL params
   * and skips the starter — useful when embedding to monitor a known run.
   */
  executionId?: string;
  /** Authorization token paired with `executionId`. */
  authorization?: string;
  /** Called whenever a run finishes (success or failure). */
  onRun?: (info: { input: string; success: boolean; executionId?: string; error?: string }) => void;
  /**
   * Optional Shuffle API key. When provided, all `/api/v1/*` calls made by
   * this component (agent run, polling, app autoload, icon fallback) use it
   * via `Authorization: Bearer <apiKey>`. When omitted, falls back to the
   * shared `API_CONFIG` (browser session / `localStorage.shuffle_api_key`).
   */
  apiKey?: string;
  /**
   * Optional Shuffle backend base URL (e.g. `https://shuffler.io`). When
   * omitted, falls back to the shared `API_CONFIG.baseUrl`. Useful when
   * embedding `AgentUI` inside another app that targets a different region.
   */
  apiBaseUrl?: string;
  /** Optional Shuffle Org ID — sent as the `Org-Id` header on every call. */
  orgId?: string;
}

interface ExecutionData {
  execution_id?: string;
  authorization?: string;
  status?: string;
  started_at?: number;
  completed_at?: number;
  results?: any[];
  workflow?: { id?: string; name?: string };
  [k: string]: any;
}

interface AgentDecision {
  action?: string;
  category?: string;
  reason?: string;
  fields?: Array<{ key?: string; value?: string }>;
  details?: any;
  run_details?: {
    id?: string;
    status?: string;
    started_at?: number;
    completed_at?: number;
    raw_response?: string;
  };
  [k: string]: any;
}

interface TimelineItem {
  label?: string;
  type: 'agent' | 'decision' | 'processing';
  category?: string;
  status?: string;
  start_time?: number;
  end_time?: number;
  details?: any;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const validateJson = (raw: unknown): { valid: boolean; result: any } => {
  if (raw == null) return { valid: false, result: null };
  if (typeof raw === 'object') return { valid: true, result: raw };
  if (typeof raw !== 'string') return { valid: false, result: raw };
  try {
    return { valid: true, result: JSON.parse(raw) };
  } catch {
    return { valid: false, result: raw };
  }
};

const STATUS_COLORS = {
  finished: 'hsl(142, 71%, 45%)',
  warning: 'hsl(38, 92%, 50%)',
  error: 'hsl(0, 72%, 55%)',
  running: 'hsl(var(--primary))',
};

const buildToolName = (apps: AgentUIApp[]): string => {
  if (!apps.length) return 'API';
  return apps
    .map((a) => {
      const slug = a.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
      return a.id ? `app:${a.id}:${slug}` : slug;
    })
    .join(',');
};

// ── Inner: timeline item ──────────────────────────────────────────────────────

const StatusIcon: React.FC<{ status?: string }> = ({ status }) => {
  const s = (status || '').toUpperCase();
  if (s === 'RUNNING' || s === 'EXECUTING' || s === '') {
    return <CircularProgress size={18} sx={{ color: STATUS_COLORS.running }} />;
  }
  if (s === 'WAITING') {
    return (
      <Tooltip title="Waiting for input">
        <PauseIcon sx={{ color: STATUS_COLORS.running, fontSize: 20 }} />
      </Tooltip>
    );
  }
  if (s === 'FINISHED' || s === 'SUCCESS') {
    return <CheckCircleIcon sx={{ color: STATUS_COLORS.finished, fontSize: 20 }} />;
  }
  if (s === 'ABORTED' || s === 'FAILURE') {
    return <ErrorIcon sx={{ color: STATUS_COLORS.error, fontSize: 20 }} />;
  }
  if (s === 'IGNORED' || s === 'IGNORE') {
    return <WarningIcon sx={{ color: STATUS_COLORS.warning, fontSize: 20 }} />;
  }
  return <HourglassDisabledIcon sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 20 }} />;
};

interface TimelineRowProps {
  item: TimelineItem;
  index: number;
  open: boolean;
  onToggle: () => void;
  appsById: Record<string, AgentUIApp>;
  totalDuration: number;
  originalStartTime: number;
  maxWidth: number;
  questionAnswers: Record<string, { index: number; value: string }>;
  setQuestionAnswers: React.Dispatch<React.SetStateAction<Record<string, { index: number; value: string }>>>;
  onSubmitQuestions: (decisionId: string, answers: Record<string, any>, isContinuation?: boolean) => void;
  onRerunAgent: () => void;
  onRerunDecision: (decision: any) => void;
  agentRequestLoading: boolean;
}

const TimelineRow: React.FC<TimelineRowProps> = ({
  item, index, open, onToggle, appsById, totalDuration, originalStartTime,
  maxWidth, questionAnswers, setQuestionAnswers, onSubmitQuestions,
  onRerunAgent, onRerunDecision, agentRequestLoading,
}) => {
  const validate = validateJson(item.details);
  const itemStart = item.start_time || 0;
  const itemEnd = item.end_time || itemStart;
  const dur = Math.max(0, itemEnd - itemStart);
  const offset = totalDuration > 0 ? ((itemStart - originalStartTime) / totalDuration) * maxWidth : 0;
  const width = totalDuration > 0 ? Math.max(4, (dur / totalDuration) * maxWidth) : 0;

  // Adapt label based on action/category
  let displayType = item.type as string;
  let displayLabel = item.label?.replace(/_/g, ' ') || '';
  const details = item.details as AgentDecision | undefined;
  if (details?.reason) displayLabel = details.reason;
  if (details?.action === 'finish' || item.category === 'finish' || details?.action === 'finalise') {
    displayType = 'finalise';
  } else if (item.category === 'ask' || details?.action === 'ask') {
    displayType = 'question';
  } else if (details?.action === 'add_tool') {
    displayType = 'add tool';
  }

  // Resolve app icon for the tool used
  let toolApp: AgentUIApp | undefined;
  if (details?.tool && typeof details.tool === 'string' && details.tool !== 'singul') {
    let tn = details.tool.toLowerCase().replace(/[\s-]+/g, '_');
    if (tn.startsWith('app:')) tn = tn.split(':')[2] || tn;
    toolApp = appsById[tn];
  }

  // Question fields
  const questions: { question: string; index: number }[] = [];
  if (item.category === 'ask' || details?.action === 'ask') {
    for (const f of details?.fields || []) {
      if (f.key === 'question' && f.value) {
        questions.push({ question: f.value, index: questions.length + 1 });
      }
    }
  }
  const questionsAnswered = questions.every(
    (q) => questionAnswers[q.question]?.value
  );

  const barColor =
    item.status === 'IGNORED' ? STATUS_COLORS.warning :
    item.status === 'FINISHED' ? STATUS_COLORS.finished :
    item.status === 'FAILURE' || item.status === 'ABORTED' ? STATUS_COLORS.error :
    STATUS_COLORS.running;

  return (
    <Box sx={{
      borderTop: index === 0 ? 'none' : '1px solid hsl(var(--border))',
      bgcolor: open ? 'hsl(var(--muted) / 0.3)' : 'transparent',
      transition: 'background 0.15s ease',
    }}>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'hsl(var(--muted) / 0.4)' },
        }}
      >
        <Box sx={{ width: 24, display: 'flex', justifyContent: 'center' }}>
          <StatusIcon status={item.status} />
        </Box>
        <Box sx={{ width: 24, display: 'flex', justifyContent: 'center' }}>
          {toolApp?.icon ? (
            <Avatar src={toolApp.icon} sx={{ width: 22, height: 22, bgcolor: 'transparent' }} variant="rounded" />
          ) : item.category === 'finalise' || details?.action === 'finish' ? (
            <CheckIcon sx={{ color: STATUS_COLORS.finished, fontSize: 18 }} />
          ) : (
            <Box sx={{ width: 22 }} />
          )}
        </Box>
        <Chip
          label={displayType}
          size="small"
          sx={{
            height: 22,
            bgcolor: 'hsl(var(--muted))',
            color: 'hsl(var(--foreground))',
            fontSize: '0.7rem',
            fontWeight: 500,
            textTransform: 'capitalize',
            minWidth: 80,
          }}
        />
        <Box sx={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.85rem',
          color: 'hsl(var(--foreground))',
          maxHeight: 60,
          overflow: 'hidden',
          '& p': { margin: 0 },
          '& pre, & code': { fontSize: '0.78rem' },
        }}>
          <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(displayLabel)}</Markdown>
        </Box>
        <Tooltip title={`Duration: ${dur.toFixed(1)}s · ${itemStart ? new Date(itemStart * 1000).toLocaleString() : ''}`}>
          <Box sx={{ width: maxWidth, position: 'relative', height: 10, flexShrink: 0 }}>
            {dur > 0 && (
              <Box sx={{
                position: 'absolute',
                left: Math.max(0, offset),
                width,
                height: 8,
                top: 1,
                bgcolor: barColor,
                borderRadius: 1,
                transition: 'all 0.2s ease',
              }} />
            )}
          </Box>
        </Tooltip>
        <Box sx={{ width: 60, fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', textAlign: 'right' }}>
          {dur > 0 ? `${dur.toFixed(1)}s` : ''}
        </Box>
        {/* Per-row actions: Approve/Deny, Rerun */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 1, minWidth: 96, justifyContent: 'flex-end' }}
          onClick={(e) => e.stopPropagation()}
        >
          {item.type === 'decision'
            && details?.run_details?.status === 'WAITING'
            && (item.category === 'ask' || details?.action === 'ask')
            && questions.length === 0 && (
            <>
              <Tooltip title="Approve this step">
                <span>
                  <IconButton
                    size="small"
                    disabled={agentRequestLoading}
                    onClick={() => {
                      if (details?.run_details?.id) onSubmitQuestions(details.run_details.id, { approve: 'true' });
                    }}
                    sx={{ color: STATUS_COLORS.finished }}
                  >
                    <ThumbUpIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Deny this step">
                <span>
                  <IconButton
                    size="small"
                    disabled={agentRequestLoading}
                    onClick={() => {
                      if (details?.run_details?.id) onSubmitQuestions(details.run_details.id, { approve: 'false' });
                    }}
                    sx={{ color: STATUS_COLORS.error }}
                  >
                    <ThumbDownIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          {item.type === 'agent' && (
            <Tooltip title="Rerun the agent with the same input">
              <span>
                <IconButton
                  size="small"
                  disabled={agentRequestLoading}
                  onClick={onRerunAgent}
                  sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--primary))' } }}
                >
                  <RestartAltIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {item.type === 'decision' && (
            <Tooltip title="Rerun from this decision (clears all decisions after it)">
              <span>
                <IconButton
                  size="small"
                  disabled={agentRequestLoading || !details?.run_details?.id}
                  onClick={() => details && onRerunDecision(details)}
                  sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--primary))' } }}
                >
                  <RestartAltIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {item.type === 'decision' && (details?.run_details as any)?.debug_url && (
            <Tooltip title="Open debug URL">
              <span>
                <IconButton
                  size="small"
                  onClick={() => window.open((details!.run_details as any).debug_url, '_blank', 'noopener,noreferrer')}
                  sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--primary))' } }}
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Question form (for ASK decisions) */}
      {questions.length > 0 && (item.status === 'RUNNING' || item.status === 'WAITING') && (
        <Box sx={{ px: 4, pb: 2 }}>
          {questions.map((q, qi) => (
            <Box key={qi} sx={{ mt: 2 }}>
              <Box sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', mb: 1 }}>
                <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(q.question)}</Markdown>
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={2}
                placeholder="Your answer here…"
                defaultValue={questionAnswers[q.question]?.value || ''}
                onBlur={(e) => {
                  setQuestionAnswers((prev) => ({
                    ...prev,
                    [q.question]: { index: qi, value: e.target.value },
                  }));
                }}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--card))' },
                }}
              />
            </Box>
          ))}
          <Button
            variant="contained"
            size="small"
            sx={{ mt: 2 }}
            disabled={!questionsAnswered || agentRequestLoading}
            onClick={() => {
              if (details?.run_details?.id) {
                onSubmitQuestions(details.run_details.id, questionAnswers);
              }
            }}
          >
            {agentRequestLoading ? <CircularProgress size={16} /> : 'Submit'}
          </Button>
        </Box>
      )}

      {/* Raw JSON */}
      {open && (
        <Box sx={{ px: 4, pb: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--background))',
              overflow: 'auto',
              maxHeight: 400,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              '& .json-view': {
                fontSize: '0.72rem !important',
                fontFamily: 'inherit !important',
                bgcolor: 'transparent !important',
              },
            }}
          >
            {validate.valid && validate.result && typeof validate.result === 'object' ? (
              <JsonView
                src={deepParseJsonStrings(validate.result)}
                dark
                collapsed={2}
                collapseStringMode="word"
                collapseStringsAfterLength={120}
                enableClipboard
                displaySize
              />
            ) : (
              <Box component="pre" sx={{ m: 0, fontSize: '0.72rem', color: 'hsl(var(--foreground))' }}>
                <code>{String(item.details ?? '')}</code>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ── Main component ────────────────────────────────────────────────────────────


const AgentUI: React.FC<AgentUIProps> = ({
  apps,
  defaultApps,
  autoLoadApps = true,
  title = 'What do you want to do?',
  subtitle,
  placeholder = 'Describe a task, e.g. "Get my emails for today and summarise them"',
  defaultInput = '',
  autoSubmit = false,
  hideHeroIcon = false,
  heroIcon,
  heroIconSize = 84,
  maxWidth = 900,
  compact = false,
  hideAppPicker = false,
  hideAttach = false,
  appPickerLabel = 'Select Apps / MCPs',
  appPickerTitle = 'Select Apps / MCPs',
  appPickerSubtitle = 'Pick the tools the agent is allowed to use for this run',
  submitTooltip = '⌘+Enter to send',
  submitIcon,
  continuationPlaceholder = 'Add more details to continue this task…',
  readUrlParams = true,
  executionId,
  authorization,
  onRun,
  apiKey,
  apiBaseUrl,
  orgId,
}) => {
  // Per-instance API target. Props win over the shared API_CONFIG so the
  // component can be embedded against a different Shuffle backend without
  // mutating global state.
  const resolveUrl = useCallback(
    (path: string) => (apiBaseUrl ? `${apiBaseUrl.replace(/\/+$/, '')}${path}` : getApiUrl(path)),
    [apiBaseUrl],
  );
  const resolveHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = apiKey
      ? { Authorization: `Bearer ${apiKey}` }
      : { ...getAuthHeader() };
    if (orgId) h['Org-Id'] = orgId;
    return h;
  }, [apiKey, orgId]);
  const hasApiKey = !!apiKey || !!API_CONFIG.apiKey;
  const navigate = useNavigate();
  const [actionInput, setActionInput] = useState(defaultInput);
  const BUILTIN_DEFAULT_APPS: AgentUIApp[] = [
    { name: 'http' },
    { name: 'shuffle_tools' },
  ];
  const [chosenApps, setChosenApps] = useState<AgentUIApp[]>(apps ?? defaultApps ?? BUILTIN_DEFAULT_APPS);
  // Apps the caller has authenticated — used to resolve icons by name and as
  // suggestions in the picker. NOT auto-selected as `chosenApps`.
  const [availableApps, setAvailableApps] = useState<AgentUIApp[]>([]);
  const [appSearchOpen, setAppSearchOpen] = useState(false);
  const [agentRequestLoading, setAgentRequestLoading] = useState(false);
  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [agentData, setAgentData] = useState<{ decisions?: AgentDecision[]; original_input?: string; status?: string; started_at?: number; completed_at?: number; [k: string]: any }>({});
  const [agentActionResult, setAgentActionResult] = useState<any>(null);
  const [showStarter, setShowStarter] = useState(true);
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, { index: number; value: string }>>({});
  const [continuationText, setContinuationText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple');
  const [attachedImages, setAttachedImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [nowTick, setNowTick] = useState(() => Math.floor(Date.now() / 1000));
  // Local fallback start timestamp captured the moment we first see an
  // execution_id, so the "Agent is working… Xs" counter starts ticking
  // immediately — even before the backend echoes `started_at` back to us.
  const [localRunStart, setLocalRunStart] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset / capture the local run start whenever a new execution begins.
  useEffect(() => {
    if (execution?.execution_id) {
      setLocalRunStart((prev) => prev ?? Math.floor(Date.now() / 1000));
    } else if (!agentRequestLoading) {
      setLocalRunStart(null);
    }
  }, [execution?.execution_id, agentRequestLoading]);

  // Tick every second while a run is in progress so the Simple view duration
  // counts up live instead of being frozen at "1s".
  useEffect(() => {
    const status = (execution?.status || agentData?.status || '').toUpperCase();
    const TERMINAL = ['FINISHED', 'FAILURE', 'ABORTED', 'CANCELLED', 'CANCELED'];
    if (TERMINAL.includes(status)) return;
    if (!execution?.execution_id && !agentRequestLoading && !localRunStart) return;
    const id = setInterval(() => setNowTick(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [execution?.execution_id, execution?.status, agentData?.status, agentRequestLoading, localRunStart]);

  const readImageAsDataUrl = (file: File): Promise<{ dataUrl: string; name: string } | null> =>
    new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        resolve(typeof result === 'string' ? { dataUrl: result, name: file.name || 'Pasted image' } : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  const handleImagesSelected = async (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const nonImages = arr.some((f) => !f.type.startsWith('image/'));
    if (nonImages) setError('Only image files can be attached.');
    const results = await Promise.all(arr.map(readImageAsDataUrl));
    const valid = results.filter((r): r is { dataUrl: string; name: string } => r !== null);
    if (valid.length > 0) {
      setAttachedImages((prev) => [...prev, ...valid]);
      setError(null);
    }
  };

  const appsById = useMemo(() => {
    const m: Record<string, AgentUIApp> = {};
    for (const a of chosenApps) {
      const slug = a.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
      m[slug] = a;
    }
    return m;
  }, [chosenApps]);

  // Sync controlled `apps` prop into local state.
  useEffect(() => {
    if (apps) setChosenApps(apps);
  }, [apps]);

  // Sideload missing app icons via Algolia (same source as the picker), so
  // built-in/default chips like "http" and "shuffle_tools" show their logo
  // even when the caller didn't pass one in.
  useEffect(() => {
    const missing = chosenApps.filter((a) => !a.icon && a.name);
    if (missing.length === 0) return;
    let cancelled = false;
    const norm = (n: string) => n.toLowerCase().replace(/[\s_\-]+/g, '_');

    (async () => {
      // Pass 1 — try Algolia (public, works without an API key).
      const resolved: Record<string, string> = {};
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        await Promise.all(missing.map(async (a) => {
          const known = availableApps.find((x) => norm(x.name) === norm(a.name));
          if (known?.icon) { resolved[a.name] = known.icon; return; }
          try {
            const res = await client.searchSingleIndex({
              indexName: 'appsearch',
              searchParams: { query: a.name.replace(/_/g, ' '), hitsPerPage: 3 },
            });
            const match = (res.hits as any[]).find((h) => norm(h.name || '') === norm(a.name))
              || (res.hits as any[])[0];
            if (match?.image_url) resolved[a.name] = match.image_url;
          } catch { /* fall through to /api/v1/apps */ }
        }));
      } catch { /* fall through to /api/v1/apps */ }

      // Pass 2 — for anything Algolia didn't resolve, fall back to /api/v1/apps
      // so built-in chips (http, shuffle_tools) still get their logo even when
      // Algolia is blocked or offline.
      const stillMissing = missing.filter((a) => !resolved[a.name]);
      if (stillMissing.length > 0) {
        try {
          const res = await fetch(resolveUrl('/api/v1/apps'), {
            credentials: 'include',
            headers: { ...resolveHeaders() },
          });
          if (res.ok) {
            const apps = await res.json();
            if (Array.isArray(apps)) {
              for (const a of stillMissing) {
                const m = apps.find((x: any) => norm(x.name || '') === norm(a.name));
                const img = m?.large_image || m?.image_url || m?.image;
                if (img) resolved[a.name] = img;
              }
            }
          }
        } catch { /* chips will just show initials */ }
      }

      if (cancelled) return;
      setChosenApps((prev) => prev.map((a) => {
        if (a.icon) return a;
        const icon = resolved[a.name];
        return icon ? { ...a, icon } : a;
      }));
    })();
    return () => { cancelled = true; };
  }, [chosenApps, availableApps, resolveUrl, resolveHeaders]);

  // Auto-load the caller's authenticated apps when nothing was passed in
  // and an API token is configured. Skipped when controlled or `defaultApps`
  // were provided explicitly.
  useEffect(() => {
    if (!autoLoadApps) return;
    if (apps || defaultApps) return;
    if (!hasApiKey) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(resolveUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...resolveHeaders() },
        });
        if (!resp.ok) return;
        const result = await resp.json();
        const list = Array.isArray(result) ? result : (result?.data || []);
        const seen = new Set<string>();
        const loaded: AgentUIApp[] = [];
        for (const entry of list) {
          const app = entry?.app || entry;
          const name: string | undefined = app?.name;
          if (!name) continue;
          const valid = entry?.active || entry?.validation?.valid || entry?.hasValidAuth;
          if (valid === false) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          loaded.push({
            name,
            id: app?.id || entry?.id,
            icon: app?.large_image || app?.image_url || app?.image || entry?.bestImage || '',
          });
        }
        if (!cancelled && loaded.length) setAvailableApps(loaded);
      } catch {
        // silent — caller can still pick apps manually
      }
    })();
    return () => { cancelled = true; };
  }, [autoLoadApps, apps, defaultApps, hasApiKey, resolveUrl, resolveHeaders]);


  // ── Fetch execution result (poll-friendly) ──
  const getExecution = useCallback(async (executionId: string, authorization: string) => {
    if (!executionId || !authorization) return;
    try {
      const resp = await fetch(resolveUrl('/api/v1/streams/results'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...resolveHeaders() },
        body: JSON.stringify({ execution_id: executionId, authorization }),
      });
      if (!resp.ok) {
        setError(`Could not fetch execution (${resp.status}).`);
        return;
      }
      const json = await resp.json();
      if (json?.success === false) {
        setError(json.reason || 'Failed to load agent data.');
        return;
      }
      setExecution({ ...json, execution_id: executionId, authorization });

      // Find AI Agent result for the timeline
      let actionResult: any = null;
      if (Array.isArray(json?.results)) {
        actionResult =
          json.results.find((r: any) => r?.action?.app_name === 'AI Agent') || json.results[0];
      } else {
        actionResult = json;
      }
      setAgentActionResult(actionResult);
      const v = validateJson(actionResult?.result);
      if (v.valid) setAgentData({ ...v.result, started_at: json.started_at, completed_at: json.completed_at, status: json.status });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    }
  }, []);

  // Attach to an explicit execution (props) or one passed via URL params.
  // Props take precedence over URL params.
  useEffect(() => {
    let eid: string | null = null;
    let auth: string | null = null;
    if (executionId && authorization) {
      eid = executionId;
      auth = authorization;
    } else if (readUrlParams) {
      const params = new URLSearchParams(window.location.search);
      eid = params.get('execution_id');
      auth = params.get('authorization');
    }
    if (eid && auth) {
      setShowStarter(false);
      setExecution({ execution_id: eid, authorization: auth, status: 'EXECUTING' });
      getExecution(eid, auth);
    }
  }, [readUrlParams, executionId, authorization, getExecution]);

  // Poll while running. Continue indefinitely until we see a terminal status
  // (FINISHED / FAILURE / ABORTED). We never give up on our own — long
  // executions just keep streaming results back.
  useEffect(() => {
    if (!execution?.execution_id || !execution?.authorization) return;
    const status = (execution.status || '').toUpperCase();
    const TERMINAL = ['FINISHED', 'FAILURE', 'ABORTED', 'CANCELLED', 'CANCELED'];
    if (TERMINAL.includes(status)) return;
    const id = setInterval(() => {
      getExecution(execution.execution_id!, execution.authorization!);
    }, 3000);
    return () => clearInterval(id);
  }, [execution?.execution_id, execution?.authorization, execution?.status, getExecution]);

  // ── Submit input ──
  const submitInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setError(null);
    setAgentRequestLoading(true);
    setShowStarter(false);
    // Hard reset any prior run state so the new run starts from a clean slate.
    const browserStart = Math.floor(Date.now() / 1000);
    setExecution(null);
    setAgentActionResult(null);
    setOpenIndexes(new Set());
    setQuestionAnswers({});
    setContinuationText('');
    setNowTick(browserStart);
    setLocalRunStart(browserStart);
    setAgentData({ original_input: text.trim() });

    const result = await runAgent({
      input: text.trim(),
      skipPolling: true,
      ...(apiKey ? { apiKey } : {}),
      ...(apiBaseUrl ? { apiBaseUrl } : {}),
      ...(orgId ? { orgId } : {}),
      // Send a single comma-separated `tool_name` in the format
      // `app:<objectID>:<slug>,app:<objectID>:<slug>` so the backend resolves
      // the exact app versions instead of guessing by slug.
      ...(chosenApps.length > 0 ? { toolName: buildToolName(chosenApps) } : {}),
      ...(attachedImages.length > 0 ? { images: attachedImages.map((img) => {
        const m = /^data:([^;]+);base64,(.*)$/.exec(img.dataUrl);
        return m ? { mimeType: m[1], data: m[2], name: img.name } : { mimeType: 'image/png', data: img.dataUrl, name: img.name };
      }) } : {}),
    });

    setAgentRequestLoading(false);

    if (!result.success) {
      setError(result.error || 'Agent run failed.');
      setShowStarter(true);
      setLocalRunStart(null);
      onRun?.({ input: text, success: false, error: result.error });
      return;
    }

    const raw = result.rawData as any;
    const eid = raw?.execution_id;
    const auth = raw?.authorization;
    if (eid && auth) {
      // Seed an EXECUTING stub so the poll effect starts immediately,
      // then kick off the first fetch. The poller continues until terminal.
      setExecution({ execution_id: eid, authorization: auth, status: 'EXECUTING' });
      // Reflect the new execution in the URL so the run is shareable/refreshable.
      if (readUrlParams && typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('execution_id', eid);
          url.searchParams.set('authorization', auth);
          window.history.replaceState({}, '', url.toString());
        } catch { /* noop */ }
      }
      getExecution(eid, auth);
      onRun?.({ input: text, success: true, executionId: eid });
    } else {
      // Direct response (no async execution): synthesize a single-step view
      setExecution({
        execution_id: eid || crypto.randomUUID(),
        authorization: auth,
        status: 'FINISHED',
        results: [{ action: { app_name: 'AI Agent' }, result: raw }],
      });
      const v = validateJson(raw);
      if (v.valid) {
        setAgentData({ ...v.result, status: 'FINISHED', original_input: text });
      } else {
        setAgentData({ original_input: text, status: 'FINISHED', message: result.content });
      }
      onRun?.({ input: text, success: true, executionId: eid });
    }
  }, [chosenApps, getExecution, onRun, attachedImages, readUrlParams]);

  // Auto-submit on mount when caller provides a defaultInput + autoSubmit.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (autoSubmit && defaultInput && !autoSubmittedRef.current && !executionId) {
      autoSubmittedRef.current = true;
      submitInput(defaultInput);
    }
  }, [autoSubmit, defaultInput, executionId, submitInput]);

  // ── Submit answers / continuation ──
  const submitQuestions = useCallback(async (
    decisionId: string,
    answers: Record<string, any>,
    isContinuation?: boolean,
  ) => {
    if (!execution?.execution_id || !execution?.authorization) return;

    let newArgument: Record<string, string> = {};
    if (isContinuation) {
      newArgument = { ...answers };
    } else {
      for (const k in answers) {
        if (k === 'approve') {
          newArgument[k] = answers[k];
          break;
        }
        const a = answers[k];
        newArgument[`question_${a.index}`] = a.value;
      }
    }

    setAgentRequestLoading(true);
    const wfId = execution.workflow?.id || execution.execution_id;
    const params = new URLSearchParams({
      reference_execution: execution.execution_id,
      authorization: execution.authorization,
      answer: 'true',
      note: JSON.stringify(newArgument),
      agentic: 'true',
      decision_id: decisionId,
    });
    try {
      const resp = await fetch(resolveUrl(`/api/v1/workflows/${wfId}/run?${params.toString()}`), {
        method: 'GET',
        credentials: 'include',
        headers: { ...resolveHeaders() },
      });
      const json = await resp.json();
      if (json.success === false) {
        toast({ title: 'Failed to submit', description: json.reason || 'Try again later.', variant: 'destructive' });
      } else {
        toast({ title: 'Submitted', description: 'Agent will continue shortly.' });
        setQuestionAnswers({});
        setContinuationText('');
        setTimeout(() => {
          getExecution(execution.execution_id!, execution.authorization!);
        }, 600);
      }
    } catch (err) {
      toast({ title: 'Network error', description: String(err), variant: 'destructive' });
    } finally {
      setAgentRequestLoading(false);
    }
  }, [execution, getExecution]);

  // ── Rerun the whole agent with the original input ──
  const rerunAgent = useCallback(() => {
    const input =
      agentData?.original_input ||
      actionInput ||
      (() => {
        const msgs = (agentData as any)?.input?.messages || [];
        const m = msgs.find((m: any) => m?.role === 'user' && !String(m?.role).includes('USER CONTEXT'));
        return m?.content || '';
      })();
    if (!input) {
      toast({ title: 'Nothing to rerun', description: 'No original input found for this execution.', variant: 'destructive' });
      return;
    }
    setActionInput(input);
    submitInput(input);
  }, [agentData, actionInput, submitInput]);

  // ── Rerun a single decision (clears decisions after it on the backend) ──
  const rerunDecision = useCallback(async (decision: any) => {
    if (!execution?.execution_id) {
      toast({ title: 'No execution loaded', description: 'Cannot rerun this decision.', variant: 'destructive' });
      return;
    }
    if (!agentActionResult?.action) {
      toast({ title: 'Missing action context', description: 'Could not locate the agent action node.', variant: 'destructive' });
      return;
    }
    const decisionId = decision?.run_details?.id;
    if (!decisionId) {
      toast({ title: 'Missing decision id', description: 'This decision cannot be rerun.', variant: 'destructive' });
      return;
    }
    const body: any = { ...agentActionResult.action };
    body.source_execution = execution.execution_id;
    body.source_workflow = execution.workflow?.id;
    setAgentRequestLoading(true);
    try {
      const resp = await fetch(resolveUrl(`/api/v1/apps/agent/run?rerun=true&decision_id=${encodeURIComponent(decisionId)}`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...resolveHeaders() },
        body: JSON.stringify(body),
      });
      const json = await resp.json().catch(() => ({}));
      if (json?.success === false) {
        toast({ title: 'Rerun failed', description: json.reason || 'Try again later.', variant: 'destructive' });
      } else {
        toast({ title: 'Rerunning decision', description: 'The agent will continue from this step.' });
        setTimeout(() => getExecution(execution.execution_id!, execution.authorization!), 800);
        setTimeout(() => getExecution(execution.execution_id!, execution.authorization!), 5000);
      }
    } catch (err) {
      toast({ title: 'Network error', description: String(err), variant: 'destructive' });
    } finally {
      setAgentRequestLoading(false);
    }
  }, [execution, agentActionResult, getExecution]);

  // ── Build timeline ──
  const { timeline, originalStartTime, totalDuration, finishDecisionId, finishAnswer } = useMemo(() => {
    // Backend may return Unix milliseconds (UnixMillis) or seconds. Normalize to seconds.
    const toSec = (t: any): number => {
      const n = Number(t) || 0;
      return n > 1e12 ? Math.floor(n / 1000) : n;
    };
    const items: TimelineItem[] = [
      {
        label: 'AI Agent',
        type: 'agent',
        category: 'agent',
        details: agentData,
        status: execution?.status || agentData?.status,
        start_time: toSec(agentData?.started_at || execution?.started_at),
        end_time: toSec(agentData?.completed_at || execution?.completed_at),
      },
    ];

    let finishId = '';
    let finishAns = '';
    for (const dec of agentData?.decisions || []) {
      const rd = dec.run_details || {};
      items.push({
        label: dec.action,
        type: 'decision',
        category: dec.category,
        status: rd.status,
        start_time: toSec(rd.started_at) || 0,
        end_time: toSec(rd.completed_at) || Math.floor(Date.now() / 1000),
        details: dec,
      });
      if (dec.action === 'finish' || dec.category === 'finish' || dec.details?.action === 'finalise' || dec.action === 'finalise') {
        finishId = rd.id || '';
        finishAns = dec.reason || '';
        if (Array.isArray(dec.fields) && dec.fields.length > 0) {
          finishAns = dec.fields[0]?.value || finishAns;
        }
      }
    }

    items.sort((a, b) => (a.start_time || 0) - (b.start_time || 0));
    const start = items.reduce((acc, it) => Math.min(acc, it.start_time || acc), Infinity);
    const end = items.reduce((acc, it) => Math.max(acc, it.end_time || acc), 0);
    const startSafe = start === Infinity ? 0 : start;
    const total = Math.max(1, end - startSafe);
    return { timeline: items, originalStartTime: startSafe, totalDuration: total, finishDecisionId: finishId, finishAnswer: finishAns };
  }, [agentData, execution?.status, execution?.started_at, execution?.completed_at]);


  const toggleOpen = (i: number) =>
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submitInput(actionInput);
    }
  };

  // restart() removed — Start tab now toggles via goToTab() while preserving the execution.


  // The three top-level "tabs": Start (the prompt form), Simple summary,
  // and Detailed timeline. They're all available once an execution exists,
  // so the user can flip back and forth without losing the run.
  type TabKey = 'start' | 'simple' | 'detailed';
  const activeTab: TabKey = showStarter ? 'start' : viewMode;
  const hasExecution = !!execution?.execution_id;
  const showRunSwitcher = hasExecution || agentRequestLoading;
  const goToTab = (t: TabKey) => {
    if (t === 'start') {
      setShowStarter(true);
    } else {
      setShowStarter(false);
      setViewMode(t);
    }
  };

  // Rendered inline (not a nested component) so it isn't remounted on every
  // parent re-render — the live duration ticker would otherwise reset hover
  // state every second and swallow clicks.
  const tabBar = (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      p: 1,
      borderRadius: 999,
      border: '1px solid hsl(var(--border))',
      bgcolor: 'hsl(var(--card))',
      width: 'fit-content',
      alignSelf: 'center',
    }}>
      <Box sx={{ display: 'inline-flex', gap: 0.25, p: 0.25, borderRadius: 999, bgcolor: 'hsl(var(--muted) / 0.6)' }}>
        {(['start', 'simple', 'detailed'] as TabKey[]).map((t) => {
          const active = activeTab === t;
          const label = t === 'start' ? 'Start' : t === 'simple' ? 'Simple' : 'Detailed';
          return (
            <Box
              key={t}
              component="button"
              type="button"
              onClick={() => goToTab(t)}
              sx={{
                all: 'unset', cursor: 'pointer',
                px: 1.75, py: 0.5,
                borderRadius: 999,
                fontSize: '0.8rem',
                fontWeight: 600,
                color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                bgcolor: active ? 'hsl(var(--primary))' : 'transparent',
                transition: 'background 0.12s ease, color 0.12s ease',
                '&:hover': active ? {} : { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted))' },
              }}
            >
              {label}
            </Box>
          );
        })}
      </Box>
      <Tooltip title="Reload execution data">
        <span>
          <IconButton
            size="small"
            onClick={() => execution?.execution_id && execution?.authorization && getExecution(execution.execution_id, execution.authorization)}
            disabled={!hasExecution}
            sx={{
              width: 30, height: 30,
              color: 'hsl(var(--muted-foreground))',
              '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted))' },
            }}
          >
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  // ── Render ──
  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', pb: 4 }}>
      <Box sx={{ width: '100%', maxWidth, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {showRunSwitcher && tabBar}
        {showStarter ? (
          <Box
            component="form"
            onSubmit={(e) => { e.preventDefault(); submitInput(actionInput); }}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 2 : 3, py: compact ? 2 : 4 }}
          >
            {!hideHeroIcon && !compact && (
              <Box sx={{
                width: heroIconSize, height: heroIconSize, borderRadius: 3,
                bgcolor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              }}>
                {heroIcon ?? <AgentIcon size={Math.round(heroIconSize * 0.67)} />}
              </Box>
            )}
            <Typography component="h1" sx={{
              fontSize: compact ? { xs: '1.25rem', md: '1.5rem' } : { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{
                fontSize: '0.95rem',
                color: 'hsl(var(--muted-foreground))',
                textAlign: 'center',
                mt: -1,
                maxWidth: 600,
              }}>
                {subtitle}
              </Typography>
            )}

            <Box sx={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              borderRadius: attachedImages.length > 0 ? 4 : 999,
              border: '1.5px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              px: 3,
              py: 1.75,
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease, border-radius 0.15s ease',
              '&:focus-within': {
                borderColor: 'hsl(var(--primary))',
                boxShadow: '0 0 0 3px hsla(var(--primary) / 0.12)',
              },
            }}>
              {attachedImages.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {attachedImages.map((img, idx) => (
                    <Box key={`${img.name}-${idx}`} sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 1,
                      p: 0.5, pr: 1, borderRadius: 1.5,
                      border: '1px solid hsl(var(--border))',
                      bgcolor: 'hsl(var(--background))',
                      maxWidth: '100%',
                    }}>
                      <Box component="img" src={img.dataUrl} alt={img.name} sx={{ width: 32, height: 32, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--foreground))', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.name}
                      </Typography>
                      <IconButton size="small" onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))} sx={{ p: 0.25, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--destructive))' } }} aria-label="Remove attached image">
                        <CloseIcon sx={{ fontSize: 12 }} />
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
                minRows={1}
                maxRows={6}
                fullWidth
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                placeholder={placeholder}
                onKeyDown={onKeyDown}
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
                disabled={agentRequestLoading}
                sx={{
                  fontSize: '1rem',
                  color: 'hsl(var(--foreground))',
                  '& textarea::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 0.7 },
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
              {!hideAttach && (
              <IconButton
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={agentRequestLoading}
                title={attachedImages.length > 0 ? `Add image (${attachedImages.length} attached)` : 'Attach image'}
                sx={{
                  width: 36, height: 36,
                  color: attachedImages.length > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  bgcolor: attachedImages.length > 0 ? 'hsla(var(--primary) / 0.1)' : 'transparent',
                  '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted))' },
                }}
              >
                <AttachFileIcon sx={{ fontSize: 18 }} />
              </IconButton>
              )}
              <Tooltip title={submitTooltip} placement="top" arrow>
                <span>
                  <IconButton
                    type="submit"
                    disabled={actionInput.trim().length < 3 || agentRequestLoading}
                    sx={{
                      width: 36, height: 36,
                      bgcolor: actionInput.trim().length >= 3 ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      color: actionInput.trim().length >= 3 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                      '&:hover': actionInput.trim().length >= 3 ? { filter: 'brightness(1.1)', bgcolor: 'hsl(var(--primary))' } : {},
                      '&.Mui-disabled': { bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },
                    }}
                  >
                    {agentRequestLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : (submitIcon ?? <PlayArrowRoundedIcon />)}
                  </IconButton>
                </span>
              </Tooltip>
              </Box>
            </Box>

            {!hideAppPicker && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{
                display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5,
                p: 0.5,
                borderRadius: 999,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
                maxWidth: '100%',
              }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setAppSearchOpen(true)}
                  sx={{
                    all: 'unset', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    px: 1.5, py: 0.5,
                    borderRadius: 999,
                    fontSize: '0.8rem', fontWeight: 500,
                    color: 'hsl(var(--muted-foreground))',
                    bgcolor: 'transparent',
                    transition: 'color 0.12s ease, background-color 0.12s ease',
                    '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted) / 0.5)' },
                  }}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                  {appPickerLabel}
                </Box>
                {chosenApps.map((app, i) => (
                  <Box
                    key={`${app.name}-${i}`}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      pl: 0.5, pr: 0.75, py: 0.25,
                      borderRadius: 999,
                      bgcolor: 'hsl(var(--muted) / 0.6)',
                      fontSize: '0.8rem',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    <Avatar
                      src={app.icon || undefined}
                      alt={app.name}
                      variant="rounded"
                      sx={{ width: 18, height: 18, bgcolor: 'transparent' }}
                    />
                    <Typography sx={{ fontSize: '0.8rem', mx: 0.25, textTransform: 'capitalize' }}>
                      {app.name.replace(/_/g, ' ')}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setChosenApps((prev) => prev.filter((_, idx) => idx !== i))}
                      sx={{ p: 0.125, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--destructive))' } }}
                    >
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
            )}

            {error && (
              <Box sx={{
                width: '100%', p: 1.5, borderRadius: 1.5,
                border: '1px solid hsl(var(--destructive) / 0.4)',
                bgcolor: 'hsl(var(--destructive) / 0.08)',
                color: 'hsl(var(--destructive))',
                fontSize: '0.85rem',
              }}>{error}</Box>
            )}
          </Box>
        ) : (
          <Box>
            {/* Status row */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              p: 2,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              mb: 2,
            }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agentData?.original_input || actionInput || 'Agent run'}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
                  Status: {execution?.status || agentData?.status || '—'} · {execution?.execution_id?.slice(0, 8) || ''}
                </Typography>
              </Box>
              <AvatarGroup max={6} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, borderColor: 'hsl(var(--border))' } }}>
                {chosenApps.map((app, i) => (
                  <Tooltip key={i} title={app.name.replace(/_/g, ' ')}>
                    <Avatar
                      src={app.icon || undefined}
                      alt={app.name}
                      variant="rounded"
                      onClick={() => navigate(`/apps/${encodeURIComponent(app.name.toLowerCase().replace(/\s+/g, '_'))}`)}
                      sx={{
                        bgcolor: 'hsl(var(--muted))',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                        '&:hover': { transform: 'scale(1.08)', borderColor: 'hsl(var(--primary)) !important' },
                      }}
                    />
                  </Tooltip>
                ))}
              </AvatarGroup>
            </Box>

            {error && (
              <Box sx={{
                p: 1.5, borderRadius: 1.5, mb: 2,
                border: '1px solid hsl(var(--destructive) / 0.4)',
                bgcolor: 'hsl(var(--destructive) / 0.08)',
                color: 'hsl(var(--destructive))',
                fontSize: '0.85rem',
              }}>{error}</Box>
            )}

            {/* Simple summary view */}
            {viewMode === 'simple' && (
              <Box sx={{
                borderRadius: 2,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}>
                {(() => {
                  const status = (execution?.status || agentData?.status || 'EXECUTING').toUpperCase();
                  const decisionCount = (agentData?.decisions || []).length;
                  const isRunning = !['FINISHED', 'FAILURE', 'ABORTED', 'CANCELLED', 'CANCELED'].includes(status);
                  const rawStartedAt = agentData?.started_at || execution?.started_at || 0;
                  // Normalize: backend may return Unix milliseconds (UnixMillis) or seconds.
                  const startedAtSec = rawStartedAt > 1e12 ? Math.floor(rawStartedAt / 1000) : rawStartedAt;
                  // Prefer the backend's started_at, but fall back to our local
                  // capture so the counter always ticks from t=0 instead of
                  // freezing at "1s" while we wait for the first poll response.
                  const effectiveStart = startedAtSec || localRunStart || 0;
                  let durationSec: number | null = null;
                  if (isRunning && effectiveStart) {
                    durationSec = Math.max(0, nowTick - effectiveStart);
                  } else if (totalDuration && totalDuration > 0) {
                    durationSec = Math.round(totalDuration);
                  }
                  return (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {isRunning ? (
                          <CircularProgress size={16} sx={{ color: 'hsl(var(--primary))' }} />
                        ) : status === 'FINISHED' ? (
                          <CheckCircleIcon sx={{ fontSize: 18, color: 'hsl(142 70% 45%)' }} />
                        ) : (
                          <ErrorIcon sx={{ fontSize: 18, color: 'hsl(var(--destructive))' }} />
                        )}
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                          {isRunning ? 'Agent is working…' : status === 'FINISHED' ? 'Run finished' : `Run ${status.toLowerCase()}`}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                          {decisionCount} step{decisionCount === 1 ? '' : 's'}
                          {durationSec != null ? ` · ${durationSec}s` : ''}
                        </Typography>
                      </Box>
                      {finishAnswer ? (
                        <Box sx={{
                          p: 2, borderRadius: 1.5,
                          border: '1px solid hsl(var(--border))',
                          bgcolor: 'hsl(var(--background))',
                          fontSize: '0.9rem',
                          color: 'hsl(var(--foreground))',
                          '& > *:first-of-type': { mt: 0 },
                          '& > *:last-child': { mb: 0 },
                          '& p': { my: 1, lineHeight: 1.55 },
                          '& h1, & h2, & h3, & h4': { mt: 2, mb: 1, fontWeight: 600, lineHeight: 1.3 },
                          '& h1': { fontSize: '1.15rem' },
                          '& h2': { fontSize: '1.05rem' },
                          '& h3, & h4': { fontSize: '0.95rem' },
                          '& ul': { my: 1, pl: 3, listStyleType: 'disc', listStylePosition: 'outside' },
                          '& ol': { my: 1, pl: 3, listStyleType: 'decimal', listStylePosition: 'outside' },
                          '& ul ul': { listStyleType: 'circle' },
                          '& ul ul ul': { listStyleType: 'square' },
                          '& li': { my: 0.25, display: 'list-item' },
                          '& li::marker': { color: 'hsl(var(--muted-foreground))' },
                          '& a': { color: 'hsl(var(--primary))', textDecoration: 'underline' },
                          '& code': {
                            px: 0.5, py: 0.125, borderRadius: 0.5,
                            bgcolor: 'hsl(var(--muted))',
                            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                            fontSize: '0.82em',
                          },
                          '& pre': {
                            p: 1.5, my: 1, borderRadius: 1,
                            bgcolor: 'hsl(var(--muted))',
                            overflowX: 'auto',
                            fontSize: '0.82rem',
                          },
                          '& pre code': { p: 0, bgcolor: 'transparent' },
                          '& blockquote': {
                            borderLeft: '3px solid hsl(var(--border))',
                            pl: 1.5, my: 1, color: 'hsl(var(--muted-foreground))',
                          },
                          '& table': { borderCollapse: 'collapse', my: 1, fontSize: '0.85rem' },
                          '& th, & td': { border: '1px solid hsl(var(--border))', px: 1, py: 0.5 },
                          '& hr': { border: 0, borderTop: '1px solid hsl(var(--border))', my: 1.5 },
                        }}>
                          <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(finishAnswer)}</Markdown>
                        </Box>
                      ) : isRunning ? (
                        <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
                          Waiting for the agent to produce the first step.
                        </Typography>
                      ) : (
                        <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
                          No final answer was returned. Open Detailed to inspect each step.
                        </Typography>
                      )}
                      {!isRunning && (
                        <Box>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setViewMode('detailed')}
                            sx={{ color: 'hsl(var(--primary))', textTransform: 'none', px: 0 }}
                          >
                            View detailed timeline →
                          </Button>
                        </Box>
                      )}
                    </>
                  );
                })()}
              </Box>
            )}

            {/* Detailed timeline view */}
            {viewMode === 'detailed' && (
            <Box sx={{
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              overflow: 'hidden',
            }}>
              {timeline.length === 0 || (timeline.length === 1 && agentRequestLoading) ? (
                <Box sx={{ p: 4, textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
                  <CircularProgress size={20} sx={{ mb: 1 }} />
                  <Typography sx={{ fontSize: '0.85rem' }}>Waiting for agent response…</Typography>
                </Box>
              ) : (
                timeline.map((item, i) => (
                  <TimelineRow
                    key={i}
                    item={item}
                    index={i}
                    open={openIndexes.has(i)}
                    onToggle={() => toggleOpen(i)}
                    appsById={appsById}
                    totalDuration={totalDuration}
                    originalStartTime={originalStartTime}
                    maxWidth={260}
                    questionAnswers={questionAnswers}
                    setQuestionAnswers={setQuestionAnswers}
                    onSubmitQuestions={submitQuestions}
                    onRerunAgent={rerunAgent}
                    onRerunDecision={rerunDecision}
                    agentRequestLoading={agentRequestLoading}
                  />
                ))
              )}
            </Box>
            )}

            {/* Continuation form (after a finish decision) */}
            {finishDecisionId && (
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ width: '100%', maxWidth: 640 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', mb: 0.75, textAlign: 'center' }}>
                    Continue this agent run with more details
                  </Typography>
                <Box
                  component="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (continuationText.trim()) {
                      submitQuestions(finishDecisionId, { continue: continuationText }, true);
                    }
                  }}
                  sx={{
                    display: 'flex', alignItems: 'flex-end', gap: 1,
                    p: 1.25, borderRadius: 999,
                    border: '1.5px solid hsl(var(--border))',
                    bgcolor: 'hsl(var(--card))',
                    '&:focus-within': {
                      borderColor: 'hsl(var(--primary))',
                      boxShadow: '0 0 0 3px hsla(var(--primary) / 0.12)',
                    },
                  }}
                >
                  <InputBase
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={4}
                    placeholder={continuationPlaceholder}
                    value={continuationText}
                    onChange={(e) => setContinuationText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        if (continuationText.trim() && !agentRequestLoading) {
                          submitQuestions(finishDecisionId, { continue: continuationText }, true);
                        }
                      }
                    }}
                    disabled={agentRequestLoading}
                    sx={{ fontSize: '0.9rem', color: 'hsl(var(--foreground))', px: 2 }}
                  />
                  <IconButton
                    type="submit"
                    disabled={!continuationText.trim() || agentRequestLoading}
                    sx={{
                      width: 36, height: 36,
                      bgcolor: continuationText.trim() && !agentRequestLoading ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      color: continuationText.trim() && !agentRequestLoading ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                      '&:hover': continuationText.trim() && !agentRequestLoading ? { filter: 'brightness(1.1)', bgcolor: 'hsl(var(--primary))' } : {},
                    }}
                  >
                    {agentRequestLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                </Box>
                </Box>
              </Box>
            )}
          </Box>
        )}

        <AppSearchDrawer
          open={appSearchOpen}
          onClose={() => setAppSearchOpen(false)}
          title={appPickerTitle}
          subtitle={appPickerSubtitle}
          onQuickSelect={(app) => {
            const known = availableApps.find((a) => a.name?.toLowerCase() === app.name?.toLowerCase());
            setChosenApps((prev) =>
              prev.some((a) => a.name === app.name)
                ? prev
                : [...prev, { name: app.name, icon: app.icon || known?.icon, id: app.id || known?.id || undefined }]
            );
          }}
        />
      </Box>
    </Box>
  );
};

export default AgentUI;
