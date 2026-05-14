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
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  MenuItem,
  Popover,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassDisabledIcon from '@mui/icons-material/HourglassDisabled';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StopCircleIcon from '@mui/icons-material/StopCircle';
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
import AppDetailDrawer from '@/Shuffle-MCPs/AppDetailDrawer';
import LockIcon from '@mui/icons-material/Lock';
import { getApiUrl, getAuthHeader, API_CONFIG } from '@/Shuffle-MCPs/api';
import { fetchApps } from '@/Shuffle-MCPs/appsCache';
import { resolveApps } from '@/Shuffle-MCPs/resolveApp';
import { toast } from '@/Shuffle-MCPs/toast';
import { runAgent } from '@/Shuffle-MCPs/agentRun';
import { parseScheduleHint } from '@/Shuffle-MCPs/scheduleHint';
import AgentRunDiagnosisBanner from '@/Shuffle-MCPs/AgentRunDiagnosisBanner';

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
  /** Disable the "Start" tab in the run switcher (e.g. when viewing a fixed execution). */
  disableStartTab?: boolean;
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
  /**
   * Pre-loaded execution payload. When provided, AgentUI skips the starter
   * and renders Simple/Detailed views immediately — no `/streams/results`
   * fetch, no `authorization` token required. Useful for embedding inside
   * a list/drawer that already has the execution data in hand. If the run
   * is still EXECUTING and an `authorization` is also present, polling
   * continues normally.
   */
  initialExecution?: {
    execution_id?: string;
    authorization?: string;
    status?: string;
    started_at?: number | string;
    completed_at?: number | string;
    results?: any[];
    workflow?: { id?: string; name?: string };
    [k: string]: any;
  };
  /** Called whenever a run finishes (success or failure). */
  onRun?: (info: { input: string; success: boolean; executionId?: string; error?: string }) => void;
  /** Called whenever the active top-level view changes (start / simple / detailed). */
  onViewChange?: (view: 'start' | 'simple' | 'detailed') => void;
  /**
   * Called when the user saves a recurring schedule (cron expression) for the
   * current prompt. When omitted, a toast is shown indicating scheduling is
   * not wired up in this embed.
   */
  onSchedule?: (info: {
    cron: string;
    input: string;
    onStep?: (event: { id: 'name' | 'workflow' | 'schedule'; state: 'active' | 'done' | 'error'; detail?: string }) => void;
  }) => void | Promise<void>;
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
  /** Optional className forwarded to the root container. */
  className?: string;
  /** Style overrides merged into the root container sx. */
  sx?: SxProps<Theme>;
  /** Style overrides for the inner content card (the column under the run-switcher). */
  contentSx?: SxProps<Theme>;
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

/**
 * Detect whether a single decision came back asking for app authentication.
 * Returns the app name (and optional id from `details.tool` when prefixed
 * "app:<id>:<name>") so the caller can render an inline "Authenticate X"
 * banner. Returns null when the decision did not request auth.
 */
const extractAuthRequest = (decision: any): { appName: string; appId: string | null } | null => {
  if (!decision || typeof decision !== 'object') return null;
  const raw = decision?.run_details?.raw_response;
  let parsed: any = null;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  } else if (raw && typeof raw === 'object') {
    parsed = raw;
  }
  const needsAuth = parsed && (parsed.action === 'app_authentication' || parsed.app_authentication === true);
  if (!needsAuth) return null;
  let appName: string | undefined = parsed.app || parsed.app_name || parsed.appname;
  let appId: string | null = null;
  if (!appName && typeof decision?.tool === 'string') {
    const t = decision.tool;
    if (t.startsWith('app:')) {
      const parts = t.split(':');
      appId = parts[1] || null;
      appName = parts[2] || t;
    } else {
      appName = t;
    }
  }
  if (!appName) {
    const f = (decision?.fields || []).find((x: any) => x?.key === 'app' || x?.key === 'app_name');
    if (f?.value) appName = f.value;
  }
  if (!appName) return null;
  return { appName, appId };
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
  let node: React.ReactNode;
  let label: string;
  if (s === 'RUNNING' || s === 'EXECUTING' || s === '') {
    node = <CircularProgress size={18} sx={{ color: STATUS_COLORS.running }} />;
    label = 'Running';
  } else if (s === 'WAITING') {
    node = <PauseIcon sx={{ color: STATUS_COLORS.running, fontSize: 20 }} />;
    label = 'Waiting for input';
  } else if (s === 'FINISHED' || s === 'SUCCESS') {
    node = <CheckCircleIcon sx={{ color: STATUS_COLORS.finished, fontSize: 20 }} />;
    label = 'Finished successfully';
  } else if (s === 'ABORTED' || s === 'FAILURE') {
    node = <ErrorIcon sx={{ color: STATUS_COLORS.error, fontSize: 20 }} />;
    label = s === 'ABORTED' ? 'Aborted' : 'Failed';
  } else if (s === 'IGNORED' || s === 'IGNORE') {
    node = <WarningIcon sx={{ color: STATUS_COLORS.warning, fontSize: 20 }} />;
    label = 'Ignored — skipped after run finished';
  } else {
    node = <HourglassDisabledIcon sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 20 }} />;
    label = 'Pending';
  }
  return (
    <Tooltip title={label} arrow>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {node}
      </Box>
    </Tooltip>
  );
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
  getFormUrl?: (decisionId: string) => string | null;
  runFinished?: boolean;
  onAuthenticateApp?: (appName: string, appId?: string | null) => void;
  isAppAuthenticated?: (appName: string) => boolean;
  /** When true, briefly draw attention to this row + its output. Used after
   *  a "jump to evidence" click from the diagnosis banner. */
  highlight?: boolean;
}

const TimelineRow: React.FC<TimelineRowProps> = ({
  item, index, open, onToggle, appsById, totalDuration, originalStartTime,
  maxWidth, questionAnswers, setQuestionAnswers, onSubmitQuestions,
  onRerunAgent, onRerunDecision, agentRequestLoading, getFormUrl, runFinished,
  onAuthenticateApp, isAppAuthenticated, highlight = false,
}) => {
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const validate = validateJson(item.details);
  const itemStart = item.start_time || 0;
  const itemEnd = item.end_time || itemStart;
  const hasTiming = itemStart > 0 && itemEnd >= itemStart;
  const dur = hasTiming ? Math.max(0, itemEnd - itemStart) : 0;
  const offset = totalDuration > 0 && hasTiming ? ((itemStart - originalStartTime) / totalDuration) * maxWidth : 0;
  const width = totalDuration > 0 && hasTiming ? Math.max(4, (dur / totalDuration) * maxWidth) : 0;

  // Adapt label based on action/category
  let displayType = item.type as string;
  let displayLabel = item.label?.replace(/_/g, ' ') || '';
  const details = item.details as AgentDecision | undefined;
  const isProcessing = item.category === 'processing';
  if (isProcessing) {
    displayType = 'processing';
  } else if (details?.reason) {
    displayLabel = details.reason;
  }
  if (!isProcessing) {
    if (details?.action === 'finish' || item.category === 'finish' || details?.action === 'finalise') {
      displayType = 'finalise';
    } else if (item.category === 'ask' || details?.action === 'ask') {
      displayType = 'question';
    } else if (details?.action === 'add_tool') {
      displayType = 'add tool';
    }
  }

  // Resolve app icon for the tool used. `details.tool` may be a name or an ID.
  // Skip finalise/question/finish actions — they use the agent's "core" tool.
  let toolApp: AgentUIApp | undefined;
  const skipToolIcon =
    item.category === 'finalise' || item.category === 'finish' || item.category === 'ask' ||
    details?.action === 'finalise' || details?.action === 'finish' || details?.action === 'ask';
  if (!skipToolIcon && details?.tool && typeof details.tool === 'string' && details.tool !== 'singul' && details.tool !== 'core') {
    const raw = details.tool;
    let tn = raw.toLowerCase().replace(/[\s-]+/g, '_');
    if (tn.startsWith('app:')) tn = tn.split(':')[2] || tn;
    toolApp = appsById[raw] || appsById[tn];
  }

  // Question fields. A field counts as "answered" when either the upstream
  // payload already carries an `answer` value on the field itself, or the
  // user has typed an answer locally in `questionAnswers`.
  const questions: { question: string; index: number; preAnswer?: string }[] = [];
  if (item.category === 'ask' || details?.action === 'ask') {
    for (const f of details?.fields || []) {
      if (f.key === 'question' && f.value) {
        const preAnswer = typeof (f as any).answer === 'string' ? (f as any).answer.trim() : '';
        questions.push({ question: f.value, index: questions.length + 1, preAnswer: preAnswer || undefined });
      }
    }
  }
  const questionsAnswered = questions.every(
    (q) => q.preAnswer || questionAnswers[q.question]?.value
  );
  const unansweredQuestions = questions.filter(
    (q) => !q.preAnswer && !questionAnswers[q.question]?.value
  );

  // If the run as a whole has finished, treat any still-RUNNING/WAITING rows
  // (typically an unanswered ASK that the agent moved past) as ignored so we
  // don't keep highlighting them with the orange "running" bar.
  const effectiveStatus =
    runFinished && (item.status === 'RUNNING' || item.status === 'WAITING')
      ? 'IGNORED'
      : item.status;
  const barColor = isProcessing ? 'hsl(var(--muted-foreground) / 0.45)' :
    effectiveStatus === 'IGNORED' ? STATUS_COLORS.warning :
    effectiveStatus === 'FINISHED' ? STATUS_COLORS.finished :
    effectiveStatus === 'FAILURE' || effectiveStatus === 'ABORTED' ? STATUS_COLORS.error :
    STATUS_COLORS.running;

  return (
    <Box
      data-timeline-index={index}
      sx={{
        borderTop: index === 0 ? 'none' : '1px solid hsl(var(--border))',
        bgcolor: highlight
          ? 'hsla(var(--severity-medium) / 0.12)'
          : open
            ? 'hsl(var(--muted) / 0.3)'
            : 'transparent',
        transition: 'background 0.6s ease, box-shadow 0.6s ease',
        scrollMarginTop: 96,
        position: 'relative',
        boxShadow: highlight ? 'inset 0 0 0 2px hsla(var(--severity-medium) / 0.55)' : 'none',
      }}
    >
      <Box
        onClick={isProcessing ? undefined : onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          cursor: isProcessing ? 'default' : 'pointer',
          '&:hover': isProcessing ? {} : { bgcolor: 'hsl(var(--muted) / 0.4)' },
        }}
      >
        <Box sx={{ width: 24, display: 'flex', justifyContent: 'center' }}>
          {isProcessing ? (
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'hsl(var(--muted-foreground) / 0.5)' }} />
          ) : (
            <StatusIcon status={effectiveStatus} />
          )}
        </Box>
        <Box sx={{ width: 24, display: 'flex', justifyContent: 'center' }}>
          {isProcessing ? (
            <Box sx={{ width: 22 }} />
          ) : toolApp?.icon ? (
            <Tooltip title={(toolApp.name || '').replace(/_/g, ' ')} arrow>
              <Avatar src={toolApp.icon} sx={{ width: 22, height: 22, bgcolor: 'transparent' }} variant="rounded" />
            </Tooltip>
          ) : item.category === 'finalise' || details?.action === 'finish' ? (
            <Tooltip title="Final answer" arrow>
              <CheckIcon sx={{ color: STATUS_COLORS.finished, fontSize: 18 }} />
            </Tooltip>
          ) : (
            <Box sx={{ width: 22 }} />
          )}
        </Box>

        <Chip
          label={displayType}
          size="small"
          sx={{
            height: 22,
            bgcolor: isProcessing ? 'transparent' : 'hsl(var(--muted))',
            color: isProcessing ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
            border: isProcessing ? '1px dashed hsl(var(--border))' : 'none',
            fontSize: '0.7rem',
            fontWeight: 500,
            textTransform: 'capitalize',
            minWidth: 80,
            fontStyle: isProcessing ? 'italic' : 'normal',
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
          '& a': { color: 'hsl(var(--primary))', textDecoration: 'underline', textUnderlineOffset: '2px' },
          '& a:hover': { opacity: 0.85 },
        }}>
          <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(displayLabel)}</Markdown>
        </Box>
        <Tooltip title={hasTiming ? `Duration: ${dur.toFixed(2)}s · ${new Date(itemStart * 1000).toLocaleString()}` : 'No timing data'}>
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
          {dur > 0 ? `${dur.toFixed(2)}s` : ''}
        </Box>
        {/* Per-row actions: Approve/Deny, Rerun */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 1, minWidth: 96, justifyContent: 'flex-end' }}
          onClick={(e) => {
            // Only swallow the click when it actually lands on a button —
            // otherwise the empty area inside this row-actions box would
            // block the parent's expand/collapse toggle.
            if ((e.target as HTMLElement).closest('button, a')) e.stopPropagation();
          }}
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
          {item.type === 'agent' && null}
          {item.type === 'decision' && (() => {
            const action = details?.action;
            const cat = item.category;
            const isApiAction =
              action !== 'ask' && cat !== 'ask' &&
              action !== 'finish' && action !== 'finalise' && cat !== 'finish' && cat !== 'finalise' &&
              cat !== 'processing' &&
              action !== 'add_tool';
            if (!isApiAction) return null;
            return (
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
            );
          })()}
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
      {questions.length > 0 && !runFinished && (item.status === 'RUNNING' || item.status === 'WAITING') && (
        <Box sx={{ px: 4, pb: 2 }}>
          {(() => {
            const trySubmit = () => {
              if (agentRequestLoading) return;
              if (!questionsAnswered) {
                setSubmitAttempted(true);
                return;
              }
              if (details?.run_details?.id) {
                onSubmitQuestions(details.run_details.id, questionAnswers);
              }
            };
            return (
              <>
                {questions.map((q, qi) => {
                  const value = questionAnswers[q.question]?.value || '';
                  const isMissing = submitAttempted && !value;
                  return (
                    <Box key={qi} sx={{ mt: 2 }}>
                      <Box sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', mb: 1 }}>
                        <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(q.question)}</Markdown>
                      </Box>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        placeholder="Your answer here…"
                        value={value}
                        error={isMissing}
                        helperText={isMissing ? 'Please answer this question' : undefined}
                        onChange={(e) => {
                          const v = e.target.value;
                          setQuestionAnswers((prev) => ({
                            ...prev,
                            [q.question]: { index: qi, value: v },
                          }));
                        }}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            trySubmit();
                          }
                        }}
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--card))' },
                        }}
                      />
                    </Box>
                  );
                })}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                  <Tooltip title={!questionsAnswered ? 'Please answer all questions first' : ''} placement="top" arrow>
                    <span>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={agentRequestLoading || !questionsAnswered}
                        onClick={trySubmit}
                        startIcon={agentRequestLoading ? <CircularProgress size={14} sx={{ color: 'hsl(var(--primary-foreground))' }} /> : undefined}
                      >
                        {agentRequestLoading ? 'Submitting…' : 'Submit'}
                      </Button>
                    </span>
                  </Tooltip>
            {details?.run_details?.id && getFormUrl && getFormUrl(details.run_details.id) && (
              <Tooltip title="Answer in the Form UI" placement="right">
                <IconButton
                  size="small"
                  onClick={() => {
                    const url = getFormUrl(details.run_details!.id!);
                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--primary))' } }}
                >
                  <OpenInNewIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
                  )}
                </Box>
              </>
            );
          })()}
        </Box>
      )}

      {/* Unanswered questions (read-only) when the run finished without an answer */}
      {open && runFinished && unansweredQuestions.length > 0 && (
        <Box sx={{ px: 4, pb: 2 }}>
          <Typography sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'hsl(var(--muted-foreground))', mb: 1 }}>
            {unansweredQuestions.length === 1 ? 'Question (unanswered)' : 'Questions (unanswered)'}
          </Typography>
          <Box sx={{
            p: 2, borderRadius: 1.5,
            border: '1px solid hsl(var(--border))',
            bgcolor: 'hsl(var(--background))',
            display: 'flex', flexDirection: 'column', gap: 1.5,
          }}>
            {unansweredQuestions.map((q, qi) => (
              <Box key={qi} sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', '& p': { my: 0.5 } }}>
                <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(q.question)}</Markdown>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* App authentication required banner — surfaces whenever the upstream
          tool returned `action: "app_authentication"`. Always visible
          (regardless of expand state) so users do not have to click into
          a failed step to discover that auth is missing. */}
      {(() => {
        const req = extractAuthRequest(details);
        if (!req) return null;
        if (isAppAuthenticated?.(req.appName)) return null;
        const pretty = req.appName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const slug = req.appName.toLowerCase().replace(/[\s-]+/g, '_');
        const appId = req.appId || appsById[req.appName]?.id || appsById[slug]?.id || null;
        const icon = appsById[req.appName]?.icon || appsById[slug]?.icon || (appId ? appsById[appId]?.icon : '') || '';
        return (
          <Box sx={{ px: 4, pb: 2 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid hsla(var(--severity-medium) / 0.3)',
              bgcolor: 'hsla(var(--severity-medium) / 0.08)',
            }}>
              <LockIcon sx={{ color: 'hsl(var(--severity-medium))', fontSize: 22 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  {pretty} requires authentication
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  Connect your {pretty} account so the agent can complete this step, then rerun the decision.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  <Avatar
                    src={icon || undefined}
                    alt=""
                    variant="rounded"
                    sx={{
                      width: 18, height: 18, borderRadius: 0.5,
                      bgcolor: 'hsl(var(--background) / 0.4)',
                      color: 'hsl(var(--background))',
                      fontSize: '0.7rem', fontWeight: 700,
                      '& img': { objectFit: 'contain' },
                    }}
                  >
                    {pretty.charAt(0)}
                  </Avatar>
                }
                disabled={!onAuthenticateApp}
                onClick={(e) => {
                  e.stopPropagation();
                  onAuthenticateApp?.(req.appName, appId);
                }}
                sx={{
                  height: 36, textTransform: 'none', fontWeight: 600,
                }}
              >
                Authenticate {pretty}
              </Button>
            </Box>
          </Box>
        );
      })()}

      {/* Raw JSON */}
      {open && (
        <Box sx={{ px: 4, pb: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              border: highlight
                ? '1px solid hsl(var(--severity-medium))'
                : '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--background))',
              boxShadow: highlight
                ? '0 0 0 3px hsla(var(--severity-medium) / 0.25)'
                : 'none',
              transition: 'border-color 0.6s ease, box-shadow 0.6s ease',
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
  disableStartTab = false,
  appPickerLabel = 'Select Apps / MCPs',
  appPickerTitle = 'Select Apps / MCPs',
  appPickerSubtitle = 'Pick the tools the agent is allowed to use for this run',
  submitTooltip = '⌘+Enter to send',
  submitIcon,
  continuationPlaceholder = 'Add more details to continue this task…',
  readUrlParams = true,
  executionId,
  authorization,
  initialExecution,
  onRun,
  onViewChange,
  onSchedule,
  apiKey,
  apiBaseUrl,
  orgId,
  className,
  sx,
  contentSx,
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
  // Apps actually allowed for the current execution, derived from the agent's
  // `allowed_actions` field (format: "app:<id>:<name>"). Falls back to
  // `chosenApps` when the field is missing (legacy runs).
  const [executionApps, setExecutionApps] = useState<AgentUIApp[]>([]);
  // Icons resolved on-demand for tools referenced in the timeline that are
  // NOT in chosenApps/executionApps. Resolution order:
  //   1) /api/v1/apps cache — match by id, then by lowercase+underscore name
  //   2) Algolia — match by objectID, then by name
  const [resolvedToolApps, setResolvedToolApps] = useState<Record<string, AgentUIApp>>({});
  const [appSearchOpen, setAppSearchOpen] = useState(false);
  const [authDrawerApp, setAuthDrawerApp] = useState<{ name: string; id?: string | null } | null>(null);
  const [agentRequestLoading, setAgentRequestLoading] = useState(false);
  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [agentData, setAgentData] = useState<{ decisions?: AgentDecision[]; original_input?: string; status?: string; started_at?: number; completed_at?: number; [k: string]: any }>({});
  const [agentActionResult, setAgentActionResult] = useState<any>(null);
  const [showStarter, setShowStarter] = useState(true);
  const [scheduleAnchor, setScheduleAnchor] = useState<HTMLElement | null>(null);
  const [scheduleCron, setScheduleCron] = useState('0 * * * *');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSteps, setScheduleSteps] = useState<Array<{ id: 'name' | 'workflow' | 'schedule'; state: 'pending' | 'active' | 'done' | 'error'; detail?: string }>>([
    { id: 'name', state: 'pending' },
    { id: 'workflow', state: 'pending' },
    { id: 'schedule', state: 'pending' },
  ]);
  // Structured recurrence controls (Google-Calendar style). These compile
  // down to a 5-field cron expression in `scheduleCron`. The advanced cron
  // text field at the bottom of the popover lets power users override.
  type SchedFreq = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  const [schedFreq, setSchedFreq] = useState<SchedFreq>('hours');
  const [schedInterval, setSchedInterval] = useState<number>(1);
  const [schedHour, setSchedHour] = useState<number>(9);
  const [schedMinute, setSchedMinute] = useState<number>(0);
  // Cron day-of-week: 0=Sun .. 6=Sat
  const [schedWeekdays, setSchedWeekdays] = useState<Set<number>>(() => new Set([1]));
  const [schedDayOfMonth, setSchedDayOfMonth] = useState<number>(1);
  const [schedAdvancedOpen, setSchedAdvancedOpen] = useState<boolean>(false);
  // When the user clicks a preset chip or types a custom cron, we mark the
  // structured controls "dirty" so the auto-compile effect doesn't clobber
  // it on the same render.
  const cronManualOverrideRef = useRef<boolean>(false);
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());
  // Briefly pulses a row + its output box after the diagnosis banner's
  // "Where this was found" jump. Cleared on a timer.
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, { index: number; value: string }>>({});
  const [simpleSubmitAttempted, setSimpleSubmitAttempted] = useState(false);
  const [continuationText, setContinuationText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialViewParam = searchParams.get('agentView');
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>(
    initialViewParam === 'detailed' ? 'detailed' : 'simple'
  );
  const [attachedImages, setAttachedImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [nowTick, setNowTick] = useState(() => Math.floor(Date.now() / 1000));
  // Local fallback start timestamp captured the moment we first see an
  // execution_id, so the "Agent is working… Xs" counter starts ticking
  // immediately — even before the backend echoes `started_at` back to us.
  const [localRunStart, setLocalRunStart] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks the execution_id we currently want to display. Used to discard
  // stale poll responses from a previous run after the user has started a
  // new one (otherwise an in-flight fetch can repaint the old execution).
  const activeExecutionIdRef = useRef<string | null>(null);
  // AbortController for the in-flight POST /api/v1/agent request, plus a
  // generation counter so a slow request that resolves AFTER the user clicks
  // "Cancel and go to Start" cannot repaint the UI or swap tabs back.
  const runAbortRef = useRef<AbortController | null>(null);
  const runGenerationRef = useRef(0);
  // Sticky flag set when the user manually clicks the "Start" tab while a run
  // is loaded. Prevents downstream effects (URL sync, initialExecution attach,
  // etc.) from flipping back to Simple/Detailed when a poll response lands.
  // Cleared the moment the user actually submits a new run.
  const userPickedStartRef = useRef(false);
  // Mirror of state used inside async callbacks (e.g. submitInput) so we can
  // snapshot prior values for rollback without making the callback re-render
  // on every state change.
  const stateRef = useRef({
    execution: null as ExecutionData | null,
    agentData: {} as any,
    agentActionResult: null as any,
    openIndexes: new Set<number>(),
    questionAnswers: {} as Record<string, { index: number; value: string }>,
    continuationText: '',
    localRunStart: null as number | null,
    showStarter: true,
  });

  // Mirror state into stateRef on every render so async callbacks can read the
  // current values without taking them as dependencies.
  stateRef.current.execution = execution;
  stateRef.current.agentData = agentData;
  stateRef.current.agentActionResult = agentActionResult;
  stateRef.current.openIndexes = openIndexes;
  stateRef.current.questionAnswers = questionAnswers;
  stateRef.current.continuationText = continuationText;
  stateRef.current.localRunStart = localRunStart;
  stateRef.current.showStarter = showStarter;

  // Reset / capture the local run start. Seed as soon as the user submits
  // (so the counter ticks from t=0 even before /agent returns), and keep it
  // pinned until the run is cleared. Without this, the "0s/1s" counter
  // freezes because the backend's `started_at` keeps catching up to `now`
  // on every poll.
  useEffect(() => {
    if (execution?.execution_id || agentRequestLoading) {
      setLocalRunStart((prev) => prev ?? Math.floor(Date.now() / 1000));
    } else {
      setLocalRunStart(null);
    }
  }, [execution?.execution_id, agentRequestLoading]);

  // Tick every second while anything run-related is in flight. Deps are
  // intentionally minimal so the interval is NOT torn down and recreated on
  // every poll response — that was making the "Xs" counter look frozen at 1s.
  useEffect(() => {
    const status = (execution?.status || agentData?.status || '').toUpperCase();
    const TERMINAL = ['FINISHED', 'FAILURE', 'ABORTED', 'CANCELLED', 'CANCELED'];
    if (TERMINAL.includes(status)) return;
    const id = setInterval(() => setNowTick(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [execution?.status, agentData?.status]);


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
    const add = (a: AgentUIApp) => {
      if (!a?.name) return;
      const slug = a.name.toLowerCase().replace(/[\s-]+/g, '_');
      if (!m[slug] || (!m[slug].icon && a.icon)) m[slug] = a;
      if (a.id) {
        if (!m[a.id] || (!m[a.id].icon && a.icon)) m[a.id] = a;
      }
    };
    for (const a of chosenApps) add(a);
    for (const a of executionApps) add(a);
    for (const [k, v] of Object.entries(resolvedToolApps)) {
      if (!m[k] || (!m[k].icon && v.icon)) m[k] = v;
      add(v);
    }
    return m;
  }, [chosenApps, executionApps, resolvedToolApps]);

  // Predicate used by the auth banners — an app is considered authenticated
  // when it appears in the caller's `availableApps` list (which is populated
  // from /api/v1/apps/authentication and only includes valid entries).
  const isAppAuthenticated = useCallback((appName: string) => {
    if (!appName) return false;
    const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_');
    const target = norm(appName);
    return availableApps.some((a) => norm(a.name || '') === target);
  }, [availableApps]);

  // Unique apps (across all decisions) that returned `app_authentication`
  // and are not yet authenticated. Powers the Simple-view banners.
  const pendingAuthApps = useMemo(() => {
    const decisions: any[] = (agentData?.decisions as any[]) || [];
    const seen = new Set<string>();
    const out: { appName: string; appId: string | null; icon: string }[] = [];
    for (const d of decisions) {
      const req = extractAuthRequest(d);
      if (!req) continue;
      const slug = req.appName.toLowerCase().replace(/[\s-]+/g, '_');
      if (seen.has(slug)) continue;
      if (isAppAuthenticated(req.appName)) continue;
      seen.add(slug);
      const appId = req.appId || appsById[req.appName]?.id || appsById[slug]?.id || null;
      const icon = appsById[req.appName]?.icon || appsById[slug]?.icon || (appId ? appsById[appId]?.icon : '') || '';
      out.push({ appName: req.appName, appId, icon });
    }
    return out;
  }, [agentData, appsById, isAppAuthenticated]);

  // Sync controlled `apps` prop into local state.
  useEffect(() => {
    if (apps) setChosenApps(apps);
  }, [apps]);

  // Resolve icons for tools referenced in the timeline that aren't already
  // covered by chosenApps/executionApps. Lookup order:
  //   1) /api/v1/apps cache — by id, then by lowercase+underscore name
  //   2) Algolia — by objectID, then by name
  useEffect(() => {
    const decisions = (agentData as any)?.decisions || [];
    if (!Array.isArray(decisions) || decisions.length === 0) return;

    const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_');
    // Collect unique tool tokens (raw + slug variant) that we haven't resolved.
    const wanted: { raw: string; slug: string }[] = [];
    const seen = new Set<string>();
    const consider = (raw: string) => {
      if (!raw || typeof raw !== 'string') return;
      let slug = norm(raw);
      if (slug.startsWith('app:')) slug = slug.split(':')[2] || slug;
      if (appsById[raw]?.icon || appsById[slug]?.icon) return;
      if (resolvedToolApps[raw]?.icon || resolvedToolApps[slug]?.icon) return;
      const key = `${raw}|${slug}`;
      if (seen.has(key)) return;
      seen.add(key);
      wanted.push({ raw, slug });
    };
    for (const dec of decisions) {
      const action = dec?.action || dec?.details?.action;
      const category = dec?.category || dec?.details?.category;
      // Tool tokens — skip terminal/ask steps.
      if (action !== 'finish' && action !== 'finalise' && action !== 'ask' &&
          category !== 'finish' && category !== 'finalise' && category !== 'ask') {
        const tool = dec?.details?.tool ?? dec?.tool;
        if (tool && tool !== 'singul' && tool !== 'core') consider(tool);
      }
      // App auth requests — banner needs the icon too.
      const req = extractAuthRequest(dec);
      if (req?.appName) consider(req.appName);
    }
    if (wanted.length === 0) return;

    let cancelled = false;
    (async () => {
      // Single general-purpose resolver — checks authenticated apps,
      // /api/v1/apps and Algolia in order so we get an icon even when the
      // app isn't activated yet.
      const tokens = Array.from(new Set(wanted.flatMap((w) => [w.raw, w.slug])));
      const resolved = await resolveApps(tokens);
      if (cancelled) return;

      const found: Record<string, AgentUIApp> = {};
      for (const { raw, slug } of wanted) {
        const r = resolved[raw] || resolved[slug];
        if (!r) continue;
        const app: AgentUIApp = { id: r.id, name: r.name || slug, icon: r.image || '' };
        found[raw] = app;
        found[slug] = app;
      }

      if (Object.keys(found).length === 0) return;
      setResolvedToolApps((prev) => ({ ...prev, ...found }));
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify((agentData as any)?.decisions?.map((d: any) => [d?.details?.tool || d?.tool, extractAuthRequest(d)?.appName]) || []), appsById]);

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
          const baseUrl = apiBaseUrl ? apiBaseUrl.replace(/\/+$/, '') : API_CONFIG.baseUrl;
          const apps = await fetchApps({
            baseUrl,
            apiKey: apiKey || API_CONFIG.apiKey,
            orgId: orgId || null,
          });
          if (Array.isArray(apps)) {
            for (const a of stillMissing) {
              const m = apps.find((x: any) => norm(x.name || '') === norm(a.name));
              const img = m?.large_image || m?.image_url || m?.image;
              if (img) resolved[a.name] = img;
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


  // Derive the apps actually allowed for the current execution from the
  // agent's `allowed_actions` field. Format: "app:<id>:<name>". Resolves
  // icons via `availableApps` (in-memory) first, then falls back to the
  // global `/api/v1/apps` cache by id (preferred) or name.
  useEffect(() => {
    const raw = (agentData as any)?.allowed_actions;
    if (!Array.isArray(raw) || raw.length === 0) {
      setExecutionApps([]);
      return;
    }
    const parsed: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const entry of raw) {
      if (typeof entry !== 'string') continue;
      const parts = entry.split(':');
      if (parts.length < 3 || parts[0] !== 'app') continue;
      const id = parts[1] || '';
      const name = parts.slice(2).join(':') || '';
      if (!name && !id) continue;
      const key = `${id}|${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push({ id, name });
    }
    if (parsed.length === 0) {
      setExecutionApps([]);
      return;
    }

    // First pass: resolve from availableApps without any network call.
    const resolveFromAvailable = (id: string, name: string): AgentUIApp => {
      const byId = id ? availableApps.find((a) => a.id === id) : undefined;
      const byName = !byId && name
        ? availableApps.find((a) => (a.name || '').toLowerCase() === name.toLowerCase())
        : undefined;
      const hit = byId || byName;
      return { id: id || hit?.id, name: hit?.name || name, icon: hit?.icon };
    };
    const initial = parsed.map(({ id, name }) => resolveFromAvailable(id, name));
    setExecutionApps(initial);

    // Second pass: fill missing icons from the global apps cache (covers
    // apps that the user has not authenticated yet). Lookup order:
    //   1) /api/v1/apps — by id, then by lowercase+underscore name
    //   2) Algolia      — by objectID, then by name
    if (initial.every((a) => !!a.icon)) return;
    let cancelled = false;
    const norm = (s: string) => (s || '').toLowerCase().replace(/[\s-]+/g, '_');
    (async () => {
      let next = initial;
      // Pass A — /api/v1/apps cache.
      try {
        const all = await fetchApps({
          baseUrl: API_CONFIG.baseUrl,
          apiKey: apiKey || API_CONFIG.apiKey,
          orgId: orgId || null,
        });
        if (!cancelled && Array.isArray(all) && all.length > 0) {
          const byIdMap = new Map<string, any>();
          const byNameMap = new Map<string, any>();
          for (const a of all) {
            if (a?.id) byIdMap.set(String(a.id), a);
            if (a?.name) byNameMap.set(norm(String(a.name)), a);
          }
          next = next.map((a) => {
            if (a.icon) return a;
            const hit = (a.id && byIdMap.get(a.id)) || byNameMap.get(norm(a.name || ''));
            if (!hit) return a;
            return {
              id: a.id || hit.id,
              name: hit.name || a.name,
              icon: hit.large_image || hit.image_url || hit.image || a.icon,
            } as AgentUIApp;
          });
        }
      } catch { /* fall through to Algolia */ }

      // Pass B — Algolia (objectID, then name) for anything still missing.
      const stillMissing = next.filter((a) => !a.icon);
      if (stillMissing.length > 0) {
        try {
          const { algoliasearch } = await import('algoliasearch');
          const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
          const resolved: Record<string, { name: string; icon: string; id: string }> = {};
          await Promise.all(stillMissing.map(async (a) => {
            try {
              if (a.id) {
                try {
                  const obj = await (client as any).getObject({ indexName: 'appsearch', objectID: a.id });
                  if (obj?.image_url) {
                    resolved[a.id || a.name] = { name: obj.name || a.name, icon: obj.image_url, id: obj.objectID || a.id };
                    return;
                  }
                } catch { /* not an objectID — fall through */ }
              }
              const res = await client.searchSingleIndex({
                indexName: 'appsearch',
                searchParams: { query: (a.name || '').replace(/_/g, ' '), hitsPerPage: 3 },
              });
              const hits = (res.hits as any[]) || [];
              const match = hits.find((h) => norm(h.name || '') === norm(a.name || '')) || hits[0];
              if (match?.image_url) {
                resolved[a.id || a.name] = { name: match.name || a.name, icon: match.image_url, id: match.objectID || a.id || '' };
              }
            } catch { /* skip */ }
          }));
          if (Object.keys(resolved).length > 0) {
            next = next.map((a) => {
              if (a.icon) return a;
              const r = resolved[a.id || a.name];
              return r ? { id: r.id || a.id, name: r.name || a.name, icon: r.icon } : a;
            });
          }
        } catch { /* algolia unavailable */ }
      }

      if (!cancelled) setExecutionApps(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify((agentData as any)?.allowed_actions || []), availableApps]);

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
      // Discard stale responses: if the user has since started a different
      // run (or cleared this one), do not write old data back into state.
      // Discard stale responses: only accept when the ref still matches the
      // execution we fetched. (Submitting a new run briefly clears the ref;
      // any in-flight poll from the previous run must be dropped, not written
      // back into state — otherwise the UI snaps to the old execution.)
      if (activeExecutionIdRef.current !== executionId) return;
      if (!resp.ok) {
        setError(`Could not fetch execution (${resp.status}).`);
        return;
      }
      const json = await resp.json();
      if (activeExecutionIdRef.current !== executionId) return;
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
      if (!userPickedStartRef.current) setShowStarter(false);
      activeExecutionIdRef.current = eid;
      setExecution({ execution_id: eid, authorization: auth, status: 'EXECUTING' });
      getExecution(eid, auth);
    }
  }, [readUrlParams, executionId, authorization, getExecution]);

  // Attach to a pre-loaded execution (e.g. embedded inside a list/drawer
  // that already has the run data). Skips the starter and seeds Simple/
  // Detailed views directly — no `/streams/results` fetch, no
  // `authorization` token required.
  useEffect(() => {
    if (!initialExecution || !initialExecution.execution_id) return;
    if (!userPickedStartRef.current) setShowStarter(false);
    activeExecutionIdRef.current = initialExecution.execution_id;
    setExecution(initialExecution as ExecutionData);
    let actionResult: any = null;
    if (Array.isArray(initialExecution.results)) {
      actionResult =
        initialExecution.results.find((r: any) => r?.action?.app_name === 'AI Agent') ||
        initialExecution.results[0];
    } else {
      actionResult = initialExecution;
    }
    setAgentActionResult(actionResult);
    const v = validateJson(actionResult?.result);
    if (v.valid) {
      setAgentData({
        ...v.result,
        started_at: initialExecution.started_at,
        completed_at: initialExecution.completed_at,
        status: initialExecution.status,
      });
    }
    setError(null);

    // Sideloaded executions from the listing endpoint sometimes ship a
    // placeholder result body like `{ success: false, reason: "Result too
    // large to handle ...", extra: "replace" }` instead of the real agent
    // output. Detect that and re-fetch the full payload directly from
    // /api/v1/streams/results so the timeline renders properly.
    const needsReplace = (() => {
      const r = v.valid ? v.result : null;
      if (!r || typeof r !== 'object') return false;
      if (r.success === false && typeof r.reason === 'string' && /too large/i.test(r.reason)) return true;
      if (r.extra === 'replace') return true;
      return false;
    })();
    if (needsReplace && initialExecution.authorization && initialExecution.execution_id) {
      getExecution(initialExecution.execution_id, initialExecution.authorization);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExecution?.execution_id]);

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
    if (text.trim().length < 6) {
      setError('Please enter at least 6 characters before starting the agent.');
      toast({
        title: 'Input too short',
        description: 'The agent needs at least 6 characters to start.',
        variant: 'destructive',
      });
      return;
    }
    setError(null);
    setAgentRequestLoading(true);

    // Mint a generation id for THIS submit. If the user aborts before the
    // request resolves, abortAgent() will bump runGenerationRef so the stale
    // resolution below short-circuits instead of swapping tabs back.
    const myGeneration = ++runGenerationRef.current;
    // Cancel any previous in-flight controller, then install a fresh one so
    // abortAgent() can actually kill the underlying fetch.
    try { runAbortRef.current?.abort(); } catch { /* noop */ }
    const controller = new AbortController();
    runAbortRef.current = controller;

    // Snapshot prior run state so a failed network request does not leave
    // the user staring at an empty page with no way to retry. We only
    // commit the destructive reset once the new run has been accepted.
    const prevExecution = stateRef.current.execution;
    const prevAgentData = stateRef.current.agentData;
    const prevAgentActionResult = stateRef.current.agentActionResult;
    const prevOpenIndexes = stateRef.current.openIndexes;
    const prevQuestionAnswers = stateRef.current.questionAnswers;
    const prevContinuationText = stateRef.current.continuationText;
    const prevLocalRunStart = stateRef.current.localRunStart;
    const prevActiveExecutionId = activeExecutionIdRef.current;
    const prevShowStarter = stateRef.current.showStarter;
    const prevViewMode = viewMode;

    // Hard reset NOW — kill the previous run's poll loop, blank the
    // execution/timeline state, drop the previous execution_id +
    // agentView from the URL, and reset the view to simple. Otherwise
    // the previous run's poll keeps writing into state during the
    // in-flight request and the user sees the old "Detailed" tab flash
    // back in.
    activeExecutionIdRef.current = null;
    setExecution(null);
    setAgentData({ original_input: text.trim() });
    setAgentActionResult(null);
    setExecutionApps([]);
    setResolvedToolApps({});
    setHighlightedIndex(null);
    setOpenIndexes(new Set());
    setQuestionAnswers({});
    setContinuationText('');
    setSimpleSubmitAttempted(false);
    
    setError(null);
    setLocalRunStart(null);
    setViewMode('simple');
    setShowStarter(false);
    // The user is starting a new run — drop any sticky "manual Start" pin so
    // future polls/effects can populate Simple/Detailed normally.
    userPickedStartRef.current = false;
    if (readUrlParams && typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('execution_id');
        url.searchParams.delete('authorization');
        url.searchParams.delete('agentView');
        window.history.replaceState({}, '', url.toString());
      } catch { /* noop */ }
    }

    const result = await runAgent({
      input: text.trim(),
      skipPolling: true,
      signal: controller.signal,
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

    // If the user aborted while we were waiting, drop this result on the floor.
    // Do NOT touch UI state — abortAgent() already reset us to the Start tab.
    if (myGeneration !== runGenerationRef.current || controller.signal.aborted) {
      // Best-effort: if the backend still managed to spawn an execution
      // before our fetch was aborted, ask it to abort that execution too.
      const raw: any = (result as any)?.rawData;
      const eid = raw?.execution_id;
      const auth = raw?.authorization;
      const wfId = raw?.workflow?.id;
      if (eid && wfId) {
        try {
          fetch(
            resolveUrl(`/api/v1/workflows/${wfId}/executions/${eid}/abort`),
            {
              method: 'GET',
              credentials: 'include',
              headers: { ...resolveHeaders(), ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
            },
          ).catch(() => { /* noop */ });
        } catch { /* noop */ }
      }
      return;
    }

    setAgentRequestLoading(false);

    if (!result.success) {
      // Restore the previous run so the user can try Rerun again.
      setError(result.error || 'Agent run failed.');
      activeExecutionIdRef.current = prevActiveExecutionId;
      setExecution(prevExecution);
      setAgentData(prevAgentData);
      setAgentActionResult(prevAgentActionResult);
      setOpenIndexes(prevOpenIndexes);
      setQuestionAnswers(prevQuestionAnswers);
      setContinuationText(prevContinuationText);
      setLocalRunStart(prevLocalRunStart);
      setShowStarter(prevShowStarter);
      setViewMode(prevViewMode);
      onRun?.({ input: text, success: false, error: result.error });
      return;
    }

    // Success — start the live timer for the new run. The destructive
    // reset already happened up-front, so all we need to do here is
    // seed the timer reference for elapsed-time rendering.
    const browserStart = Math.floor(Date.now() / 1000);
    setNowTick(browserStart);
    setLocalRunStart(browserStart);

    const raw = result.rawData as any;
    const eid = raw?.execution_id;
    const auth = raw?.authorization;
    if (eid && auth) {
      // Seed an EXECUTING stub so the poll effect starts immediately,
      // then kick off the first fetch. The poller continues until terminal.
      activeExecutionIdRef.current = eid;
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
  }, [chosenApps, getExecution, onRun, attachedImages, readUrlParams, viewMode]);

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
  // Instead of silently re-submitting (which leaves the user staring at the
  // same screen wondering if anything happened), bounce them back to the
  // Start tab with the prompt + tools pre-filled so they can review and
  // hit Start themselves.
  const rerunAgent = useCallback(() => {
    const input =
      agentData?.original_input ||
      actionInput ||
      (() => {
        const msgs = (agentData as any)?.input?.messages || [];
        const m = msgs.find((m: any) => m?.role === 'user' && !String(m?.role).includes('USER CONTEXT'));
        return m?.content || '';
      })();
    if (input && typeof input === 'string') {
      setActionInput(input);
    }
    if (executionApps.length > 0) {
      setChosenApps(executionApps);
    }
    // When the Start tab is hidden (e.g. embedded in the execution drawer),
    // there is no Start view to bounce to — just resubmit immediately with
    // the previous prompt + tools.
    if (disableStartTab) {
      if (input && typeof input === 'string' && input.trim().length >= 6) {
        submitInput(input);
      }
      return;
    }
    setShowStarter(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('agentView');
      return next;
    }, { replace: true });
  }, [agentData, actionInput, executionApps, setSearchParams, disableStartTab, submitInput]);

  // ── Abort the currently running agent execution ──
  // If the agent has not produced an execution_id yet (i.e. the initial
  // /run request is still in flight or failed silently), we simply discard
  // the in-flight UI state and bounce the user back to the Start tab so
  // they can try again. Once an execution_id exists, we ask the backend to
  // abort the workflow execution; the existing poll loop will then pick up
  // the ABORTED status on its next tick.
  const abortAgent = useCallback(async () => {
    const execId = execution?.execution_id;
    const auth = execution?.authorization;
    const wfId = (execution as any)?.workflow?.id;

    // Bump the run-generation counter and abort any in-flight POST /agent
    // request immediately. This guarantees a slow initial request that
    // resolves AFTER the user clicks "Cancel" cannot repaint the UI or
    // swap tabs back to the run view.
    runGenerationRef.current += 1;
    try { runAbortRef.current?.abort(); } catch { /* noop */ }
    runAbortRef.current = null;

    // Helper: wipe local run state and return to the Start tab.
    const resetToStart = () => {
      activeExecutionIdRef.current = null;
      setExecution(null);
      setAgentData({});
      setAgentRequestLoading(false);
      setShowStarter(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('agentView');
        next.delete('execution_id');
        next.delete('authorization');
        return next;
      }, { replace: true });
    };

    // Agent never produced an execution — nothing to abort server-side.
    if (!execId || !wfId) {
      resetToStart();
      toast({ title: 'Run aborted', description: 'The agent had not started yet — reset to Start.' });
      return;
    }

    try {
      const resp = await fetch(
        resolveUrl(`/api/v1/workflows/${wfId}/executions/${execId}/abort`),
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...resolveHeaders(),
            ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          },
        },
      );
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        toast({ title: 'Abort failed', description: txt || `HTTP ${resp.status}`, variant: 'destructive' });
        return;
      }
      toast({ title: 'Aborting run', description: 'The execution will be set to ABORTED shortly.' });
      // Nudge the poll loop to refresh sooner so the UI reflects the change.
      setTimeout(() => getExecution(execId, auth!), 500);
      setTimeout(() => getExecution(execId, auth!), 2500);
    } catch (err) {
      toast({ title: 'Network error', description: String(err), variant: 'destructive' });
    }
  }, [execution, resolveUrl, resolveHeaders, getExecution, setSearchParams]);


  // Build a popout URL to answer the agent's question in the standalone Form UI.
  // Mirrors the legacy AgentUI behavior so users can hand off to /forms/...
  const getFormUrl = useCallback((decisionId: string): string | null => {
    const wfId = (execution as any)?.workflow?.id;
    const auth = execution?.authorization;
    const execId = execution?.execution_id;
    const sourceNode = agentActionResult?.action?.id;
    if (!wfId || !auth || !execId || !sourceNode || !decisionId) return null;
    const backend = apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const params = new URLSearchParams({
      authorization: auth,
      reference_execution: execId,
      source_node: sourceNode,
      decision_id: decisionId,
      ...(backend ? { backend_url: backend } : {}),
    });
    return `/forms/${wfId}?${params.toString()}`;
  }, [execution, agentActionResult, apiBaseUrl]);

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
      // Preserve sub-second precision so durations < 1s render as e.g. "0.8s"
      // instead of being floored to 0.
      return n > 1e12 ? n / 1000 : n;
    };
    const overallStatus = (execution?.status || agentData?.status || '').toUpperCase();
    const runIsFinished = ['FINISHED', 'FAILURE', 'ABORTED', 'CANCELLED', 'CANCELED'].includes(overallStatus);
    const runEndSec = toSec(agentData?.completed_at || execution?.completed_at);
    // When the whole run has ended, cap any unfinished decisions at the run's
    // end time (or the latest known timestamp) so they stop counting up.
    let fallbackEnd = Date.now() / 1000;
    if (runIsFinished) {
      let maxKnown = runEndSec || 0;
      for (const dec of agentData?.decisions || []) {
        const rd = dec.run_details || {};
        maxKnown = Math.max(maxKnown, toSec(rd.completed_at), toSec(rd.started_at));
      }
      fallbackEnd = maxKnown || fallbackEnd;
    }

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
      const decStartSec = toSec(rd.started_at);
      const decEndSec = toSec(rd.completed_at);
      // Only fall back to "now"/run-end when we actually know when the
      // decision started — otherwise the bar would stretch from epoch 0
      // to now and look like a full-width row.
      const startTime = decStartSec || 0;
      const endTime = decEndSec || (decStartSec ? fallbackEnd : 0);
      items.push({
        label: dec.action,
        type: 'decision',
        category: dec.category,
        status: rd.status,
        start_time: startTime,
        end_time: endTime,
        details: dec,
      });
      if (dec.action === 'finish' || dec.category === 'finish' || dec.details?.action === 'finalise' || dec.action === 'finalise') {
        finishId = rd.id || '';
        const reasonText = (dec.reason || '').trim();
        const fieldText = (Array.isArray(dec.fields) && dec.fields.length > 0 ? (dec.fields[0]?.value || '') : '').trim();
        // Prefer whichever has more substance. Sometimes the field value is a
        // short headline like "Task Failed" while the real explanation lives
        // in `reason` — surface that to the user instead of the headline.
        if (fieldText && reasonText && reasonText.length > fieldText.length * 1.5) {
          finishAns = reasonText;
        } else {
          finishAns = fieldText || reasonText;
        }
      }
    }

    // Sort: Agent row pinned to top, Finalise pinned to bottom, everything
    // else preserves insertion order (the index `i` from the decisions array).
    // Timestamps are intentionally NOT used — they're often missing or 0,
    // which would scatter rows unpredictably.
    const isFinalise = (it: TimelineItem) => {
      const det: any = it.details || {};
      const cat = (it.category || '').toLowerCase();
      const act = (det.action || '').toLowerCase();
      return cat === 'finish' || cat === 'finalise' || act === 'finish' || act === 'finalise';
    };
    const rank = (it: TimelineItem) => {
      if (it.type === 'agent') return 0;
      if (isFinalise(it)) return 2;
      return 1;
    };
    const sortItems = (arr: TimelineItem[]) => {
      const indexed = arr.map((it, i) => ({ it, i }));
      indexed.sort((a, b) => {
        const ra = rank(a.it);
        const rb = rank(b.it);
        if (ra !== rb) return ra - rb;
        return a.i - b.i;
      });
      arr.length = 0;
      arr.push(...indexed.map((x) => x.it));
    };
    sortItems(items);

    // Insert "processing" placeholder rows inline between consecutive decisions
    // when there is meaningful dead time (the agent is thinking / the LLM is
    // generating the next step). Walk the already-sorted items list and splice
    // the Thinking rows in-place so they stay between the two decisions whose
    // gap they represent. Do NOT re-sort afterwards — that would clump them.
    const withProcessing: TimelineItem[] = [];
    const agentItem = items.find((it) => it.type === 'agent');
    const runStart = agentItem?.start_time || 0;
    const runEnd = agentItem?.end_time || 0;
    let prevDecEnd = runStart;
    const pushThinking = (from: number, to: number) => {
      if (from > 0 && to > 0 && to - from >= 0.5) {
        withProcessing.push({
          label: '',
          type: 'decision',
          category: 'processing',
          status: 'FINISHED',
          start_time: from,
          end_time: to,
          details: undefined as any,
        });
      }
    };
    for (const it of items) {
      if (it.type === 'decision') {
        const decStart = it.start_time || 0;
        // Insert Thinking before this decision (works for first decision after
        // run start, gaps between decisions, and the gap before Finalise).
        pushThinking(prevDecEnd, decStart);
        withProcessing.push(it);
        prevDecEnd = it.end_time || decStart || prevDecEnd;
      } else {
        withProcessing.push(it);
      }
    }
    // Tail: if the last decision finished well before the run ended and there
    // was no Finalise, surface that trailing dead time too.
    if (runEnd > 0) pushThinking(prevDecEnd, runEnd);
    items.length = 0;
    items.push(...withProcessing);

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
  useEffect(() => {
    onViewChange?.(activeTab);
  }, [activeTab, onViewChange]);
  const goToTab = (t: TabKey) => {
    if (t === 'start') {
      // Seed the starter form with the current run's prompt + tools so the
      // user can tweak and resubmit instead of starting from a blank slate.
      const runInput =
        agentData?.original_input ||
        (() => {
          const msgs = (agentData as any)?.input?.messages || [];
          const m = msgs.find((m: any) => m?.role === 'user');
          return m?.content || '';
        })();
      if (runInput && typeof runInput === 'string') {
        setActionInput(runInput);
      }
      if (executionApps.length > 0) {
        setChosenApps(executionApps);
      }
      setShowStarter(true);
      // Pin: user manually chose Start. Stay here even when polls land or
      // initialExecution is re-attached, until they explicitly start a new run
      // or click Simple/Detailed themselves.
      userPickedStartRef.current = true;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('agentView');
        return next;
      }, { replace: true });
    } else {
      setShowStarter(false);
      userPickedStartRef.current = false;
      setViewMode(t);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('agentView', t);
        return next;
      }, { replace: true });
    }
  };

  // Schedule guardrails: do not allow scheduling when the run required a
  // continuation (the oneshot prompt did not work) or did not perform any
  // actual app/tool actions (nothing meaningful would run on a schedule).
  const { scheduleDisabledReasons } = useMemo(() => {
    const decisions: any[] = (agentData?.decisions as any[]) || [];
    const runStatus = String(execution?.status || agentData?.status || '').toUpperCase();
    const isNotFinished = runStatus !== '' && !['FINISHED', 'FAILURE', 'ABORTED', 'CANCELLED', 'CANCELED'].includes(runStatus);
    const NON_ACTION_CATS = new Set(['finish', 'finalise', 'ask', 'agent', 'processing']);
    const NON_ACTION_ACTIONS = new Set(['finish', 'finalise', 'ask']);
    const finishCount = decisions.filter(
      (d) => d?.action === 'finish' || d?.action === 'finalise' || d?.category === 'finish' || d?.category === 'finalise',
    ).length;
    const continuedAfterFinish = decisions.some((d) =>
      Array.isArray(d?.fields) && d.fields.some((f: any) => String(f?.key || '').toLowerCase() === 'continue' && f?.value),
    );
    const hadContinuation = finishCount > 1 || continuedAfterFinish;
    const actionCount = decisions.filter((d) => {
      const cat = String(d?.category || '').toLowerCase();
      const act = String(d?.action || '').toLowerCase();
      if (NON_ACTION_CATS.has(cat)) return false;
      if (NON_ACTION_ACTIONS.has(act)) return false;
      return true;
    }).length;
    // A decision failed if its run_details.status is FAILURE/ABORTED, or the
    // parsed raw_response reports success: false. We deliberately ignore
    // ASK/FINISH categories — those are agent-internal control steps.
    const failedDecision = decisions.some((d) => {
      const cat = String(d?.category || '').toLowerCase();
      const act = String(d?.action || '').toLowerCase();
      if (NON_ACTION_CATS.has(cat) || NON_ACTION_ACTIONS.has(act)) return false;
      const status = String(d?.run_details?.status || '').toUpperCase();
      if (status === 'FAILURE' || status === 'ABORTED') return true;
      const raw = d?.run_details?.raw_response;
      let parsed: any = null;
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
      } else if (raw && typeof raw === 'object') {
        parsed = raw;
      }
      if (parsed && parsed.success === false) return true;
      if (parsed && parsed.action === 'app_authentication') return true;
      return false;
    });
    // A question was answered if an ASK decision has an "answer" field, OR if
    // its run finished (the agent submits answers to advance ask runs from
    // WAITING to FINISHED). Either way the prompt cannot run unattended.
    const answeredQuestion = decisions.some((d) => {
      const cat = String(d?.category || '').toLowerCase();
      const act = String(d?.action || '').toLowerCase();
      const isAsk = cat === 'ask' || act === 'ask';
      if (!isAsk) return false;
      const hasAnswerField = Array.isArray(d?.fields)
        && d.fields.some((f: any) => String(f?.key || '').toLowerCase() === 'answer' && f?.value);
      const status = String(d?.run_details?.status || '').toUpperCase();
      return hasAnswerField || status === 'FINISHED';
    });
    const reasons: string[] = [];
    if (isNotFinished) {
      reasons.push('Wait for the agent to finish before scheduling.');
    } else if (showStarter) {
      // On the Start view, a finished + validated run is always considered
      // ready to schedule. Quality gates (continuations, missing actions,
      // failed steps, manual answers) are only surfaced in Simple/Detailed
      // views where the user is actively reviewing the run.
    } else {
      if (hadContinuation) {
        reasons.push('This run needed a follow-up message to continue, so the one-shot prompt did not succeed on its own. Refine the prompt until it finishes in one go before scheduling.');
      }
      if (actionCount === 0) {
        reasons.push('This run did not perform any app or tool actions, so a scheduled run would have nothing meaningful to do.');
      }
      if (failedDecision) {
        reasons.push('A decision in this run failed. Fix the failing step (for example, authenticate the app or correct the input) and rerun successfully before scheduling.');
      }
      if (answeredQuestion) {
        reasons.push('A question in this run was answered manually. Scheduled runs are unattended, so refine the prompt so the agent does not need to ask anything before scheduling.');
      }
    }
    return { scheduleDisabledReasons: reasons };
  }, [agentData, execution?.status, showStarter]);

  // Detect natural-language scheduling intent in the prompt (e.g. "daily at 6 am",
  // "next monday at 2am", "every 15 minutes"). Used to highlight the Schedule
  // button and pre-seed the cron picker.
  const scheduleHint = useMemo(() => parseScheduleHint(actionInput), [actionInput]);
  // Track which hint we last auto-applied so we never overwrite a manual pick.
  const lastAppliedHintRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scheduleHint) return;
    if (scheduleAnchor) return; // never override while popover is open
    if (lastAppliedHintRef.current === scheduleHint.cron) return;
    setScheduleCron(scheduleHint.cron);
    lastAppliedHintRef.current = scheduleHint.cron;
  }, [scheduleHint, scheduleAnchor]);

  // Compile structured recurrence controls into a 5-field cron expression.
  // Skipped if the user has manually overridden via preset chip / advanced
  // cron text field — that override is cleared whenever they touch a
  // structured control again.
  useEffect(() => {
    if (cronManualOverrideRef.current) return;
    const m = Math.max(0, Math.min(59, schedMinute));
    const h = Math.max(0, Math.min(23, schedHour));
    const n = Math.max(1, Math.floor(schedInterval || 1));
    let cron = '';
    if (schedFreq === 'minutes') {
      cron = `*/${n} * * * *`;
    } else if (schedFreq === 'hours') {
      cron = `${m} */${n} * * *`;
    } else if (schedFreq === 'days') {
      cron = n === 1 ? `${m} ${h} * * *` : `${m} ${h} */${n} * *`;
    } else if (schedFreq === 'weeks') {
      // Cron has no native "every N weeks", so we use the weekday set and
      // surface a small note in the UI when interval > 1.
      const days = schedWeekdays.size > 0
        ? [...schedWeekdays].sort((a, b) => a - b).join(',')
        : '*';
      cron = `${m} ${h} * * ${days}`;
    } else if (schedFreq === 'months') {
      const dom = Math.max(1, Math.min(31, schedDayOfMonth));
      cron = n === 1 ? `${m} ${h} ${dom} * *` : `${m} ${h} ${dom} */${n} *`;
    }
    if (cron) setScheduleCron(cron);
  }, [schedFreq, schedInterval, schedHour, schedMinute, schedWeekdays, schedDayOfMonth]);

  const scheduleDisabledReason = scheduleDisabledReasons[0] || '';
  const scheduleDisabledTooltip: React.ReactNode = scheduleDisabledReasons.length > 1 ? (
    <Box>
      <Box sx={{ fontWeight: 600, mb: 0.5 }}>Cannot schedule for {scheduleDisabledReasons.length} reasons:</Box>
      <Box sx={{ m: 0 }}>
        {scheduleDisabledReasons.map((r, i) => (
          <Box key={i} sx={{ mb: 0.5, display: 'flex', gap: 0.75 }}>
            <Box component="span" sx={{ fontWeight: 700, flexShrink: 0 }}>{i + 1}.</Box>
            <Box component="span">{r}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  ) : scheduleDisabledReasons.length === 1 ? `Cannot schedule: ${scheduleDisabledReasons[0]}` : '';

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
      position: 'sticky',
      top: 8,
      zIndex: 5,
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    }}>
      <Box sx={{ display: 'inline-flex', gap: 0.25, p: 0.25, borderRadius: 999, bgcolor: 'hsl(var(--muted) / 0.6)' }}>
        {(['start', 'simple', 'detailed'] as TabKey[]).map((t) => {
          const active = activeTab === t;
          const label = t === 'start' ? 'Start' : t === 'simple' ? 'Simple' : 'Detailed';
          const disabled = (t === 'start' && disableStartTab) || ((t === 'simple' || t === 'detailed') && !hasExecution);
          return (
            <Box
              key={t}
              component="button"
              type="button"
              onClick={() => { if (!disabled) goToTab(t); }}
              disabled={disabled}
              sx={{
                all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer',
                px: 1.75, py: 0.5,
                borderRadius: 999,
                fontSize: '0.8rem',
                fontWeight: 600,
                color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                bgcolor: active ? 'hsl(var(--primary))' : 'transparent',
                opacity: disabled ? 0.4 : 1,
                transition: 'background 0.12s ease, color 0.12s ease',
                '&:hover': (active || disabled) ? {} : { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted))' },
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
      <Box sx={{ width: '1px', height: 20, bgcolor: 'hsl(var(--border))', mx: 0.25 }} />
      <Tooltip title={scheduleDisabledTooltip || 'Schedule this prompt to run repeatedly on a cron schedule'}>
        <span>
          <IconButton
            size="small"
            onClick={(e) => { if (!scheduleDisabledReason) setScheduleAnchor(e.currentTarget); }}
            disabled={Boolean(scheduleDisabledReason)}
            sx={{
              width: 30, height: 30,
              color: 'hsl(var(--muted-foreground))',
              '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted))' },
              '&.Mui-disabled': { opacity: 0.4, color: 'hsl(var(--muted-foreground))' },
            }}
          >
            <ScheduleIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Popover
        open={Boolean(scheduleAnchor)}
        anchorEl={scheduleAnchor}
        onClose={() => setScheduleAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 2,
              width: 360,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              boxShadow: '0 8px 24px hsl(0 0% 0% / 0.35)',
            },
          },
        }}
      >
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 0.5 }}>
          Schedule recurring run
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', mb: 1.5 }}>
          Choose how often this prompt should run. The schedule keeps running until you remove it.
        </Typography>
        {scheduleHint && (
          <Box
            sx={{
              mb: 1.5,
              p: 1,
              borderRadius: 1.5,
              border: '1px solid hsl(var(--primary) / 0.4)',
              bgcolor: 'hsl(var(--primary) / 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ScheduleIcon sx={{ fontSize: 16, color: 'hsl(var(--primary))' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', mb: 0.25 }}>
                Detected from your prompt
              </Box>
              <Box sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {scheduleHint.label}
              </Box>
              <Box sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>
                {scheduleHint.cron}
              </Box>
            </Box>
            {scheduleCron !== scheduleHint.cron && (
              <Button
                size="small"
                onClick={() => { cronManualOverrideRef.current = true; setScheduleCron(scheduleHint.cron); }}
                sx={{
                  height: 28,
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  color: 'hsl(var(--primary))',
                  '&:hover': { bgcolor: 'hsl(var(--primary) / 0.12)' },
                }}
              >
                Use
              </Button>
            )}
          </Box>
        )}
        {/* Structured recurrence builder (Google Calendar style) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
            Repeat every
          </Typography>
          <TextField
            size="small"
            type="number"
            value={schedInterval}
            onChange={(e) => { cronManualOverrideRef.current = false; setSchedInterval(Math.max(1, Number(e.target.value) || 1)); }}
            inputProps={{ min: 1, max: 999, style: { padding: '6px 8px', width: 48, textAlign: 'center', fontSize: '0.8rem' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'hsl(var(--muted))',
                color: 'hsl(var(--foreground))',
                '& fieldset': { borderColor: 'hsl(var(--border))' },
                '&:hover fieldset': { borderColor: 'hsl(var(--border))' },
                '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
              },
            }}
          />
          <Select
            size="small"
            value={schedFreq}
            onChange={(e) => { cronManualOverrideRef.current = false; setSchedFreq(e.target.value as SchedFreq); }}
            sx={{
              flex: 1,
              fontSize: '0.8rem',
              bgcolor: 'hsl(var(--muted))',
              color: 'hsl(var(--foreground))',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--primary))' },
              '& .MuiSelect-icon': { color: 'hsl(var(--muted-foreground))' },
              '& .MuiSelect-select': { py: '6px' },
            }}
            MenuProps={{ PaperProps: { sx: { bgcolor: 'hsl(var(--popover))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' } } }}
          >
            <MenuItem value="minutes" sx={{ fontSize: '0.8rem' }}>{schedInterval === 1 ? 'minute' : 'minutes'}</MenuItem>
            <MenuItem value="hours" sx={{ fontSize: '0.8rem' }}>{schedInterval === 1 ? 'hour' : 'hours'}</MenuItem>
            <MenuItem value="days" sx={{ fontSize: '0.8rem' }}>{schedInterval === 1 ? 'day' : 'days'}</MenuItem>
            <MenuItem value="weeks" sx={{ fontSize: '0.8rem' }}>{schedInterval === 1 ? 'week' : 'weeks'}</MenuItem>
            <MenuItem value="months" sx={{ fontSize: '0.8rem' }}>{schedInterval === 1 ? 'month' : 'months'}</MenuItem>
          </Select>
        </Box>

        {(schedFreq === 'days' || schedFreq === 'weeks' || schedFreq === 'months') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
              At
            </Typography>
            <TextField
              size="small"
              type="time"
              value={`${String(schedHour).padStart(2, '0')}:${String(schedMinute).padStart(2, '0')}`}
              onChange={(e) => {
                cronManualOverrideRef.current = false;
                const [hh, mm] = (e.target.value || '09:00').split(':').map(Number);
                setSchedHour(Number.isFinite(hh) ? hh : 9);
                setSchedMinute(Number.isFinite(mm) ? mm : 0);
              }}
              inputProps={{ style: { padding: '6px 8px', fontSize: '0.8rem' } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'hsl(var(--muted))',
                  color: 'hsl(var(--foreground))',
                  '& fieldset': { borderColor: 'hsl(var(--border))' },
                  '&:hover fieldset': { borderColor: 'hsl(var(--border))' },
                  '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                },
              }}
            />
          </Box>
        )}

        {schedFreq === 'weeks' && (
          <Box sx={{ mb: 1.25 }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', mb: 0.75 }}>
              Repeat on
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {(['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const).map((label, i) => {
                const active = schedWeekdays.has(i);
                return (
                  <Box
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      cronManualOverrideRef.current = false;
                      setSchedWeekdays((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      });
                    }}
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      userSelect: 'none',
                      bgcolor: active ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                      border: '1px solid',
                      borderColor: active ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                      transition: 'background-color 120ms',
                      '&:hover': { bgcolor: active ? 'hsl(var(--primary))' : 'hsl(var(--muted) / 0.7)' },
                    }}
                  >
                    {label}
                  </Box>
                );
              })}
            </Box>
            {schedInterval > 1 && (
              <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))', mt: 0.75 }}>
                Cron does not support every {schedInterval} weeks natively — this will run weekly on the selected days.
              </Typography>
            )}
          </Box>
        )}

        {schedFreq === 'months' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
              On day
            </Typography>
            <TextField
              size="small"
              type="number"
              value={schedDayOfMonth}
              onChange={(e) => { cronManualOverrideRef.current = false; setSchedDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value) || 1))); }}
              inputProps={{ min: 1, max: 31, style: { padding: '6px 8px', width: 56, textAlign: 'center', fontSize: '0.8rem' } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'hsl(var(--muted))',
                  color: 'hsl(var(--foreground))',
                  '& fieldset': { borderColor: 'hsl(var(--border))' },
                  '&:hover fieldset': { borderColor: 'hsl(var(--border))' },
                  '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                },
              }}
            />
            <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>
              of the month
            </Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', mt: 0.5, mb: 0.5 }}>
          Quick presets
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
          {([
            ['Every 15 min', '*/15 * * * *'],
            ['Hourly', '0 * * * *'],
            ['Daily 9am', '0 9 * * *'],
            ['Weekdays 9am', '0 9 * * 1-5'],
            ['Weekly Mon', '0 9 * * 1'],
            ['Monthly 1st', '0 9 1 * *'],
          ] as const).map(([label, expr]) => (
            <Chip
              key={expr}
              label={label}
              size="small"
              onClick={() => { cronManualOverrideRef.current = true; setScheduleCron(expr); }}
              sx={{
                fontSize: '0.7rem',
                bgcolor: scheduleCron === expr ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                color: scheduleCron === expr ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                border: scheduleCron === expr ? '1px solid hsl(var(--primary))' : '1px solid transparent',
                '&:hover': { bgcolor: 'hsl(var(--muted) / 0.8)' },
              }}
            />
          ))}
        </Box>

        <Box sx={{ mt: 1.25 }}>
          <Box
            role="button"
            tabIndex={0}
            onClick={() => setSchedAdvancedOpen((v) => !v)}
            sx={{
              fontSize: '0.7rem',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              userSelect: 'none',
              '&:hover': { color: 'hsl(var(--foreground))' },
            }}
          >
            {schedAdvancedOpen ? '▾' : '▸'} Advanced — edit cron expression
          </Box>
          {schedAdvancedOpen && (
            <TextField
              size="small"
              fullWidth
              value={scheduleCron}
              onChange={(e) => { cronManualOverrideRef.current = true; setScheduleCron(e.target.value); }}
              placeholder="0 9 * * 1-5"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.78rem', padding: '6px 8px' } }}
              sx={{
                mt: 0.75,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'hsl(var(--muted))',
                  color: 'hsl(var(--foreground))',
                  '& fieldset': { borderColor: 'hsl(var(--border))' },
                  '&:hover fieldset': { borderColor: 'hsl(var(--border))' },
                  '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                },
              }}
            />
          )}
          <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', mt: 0.75 }}>
            cron: {scheduleCron || '—'}
          </Typography>
        </Box>
        {scheduleSaving && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.25, borderRadius: 1, bgcolor: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
            {scheduleSteps.map((s) => {
              const label =
                s.id === 'name' ? 'Generating name & description'
                : s.id === 'workflow' ? 'Creating workflow'
                : 'Enabling schedule';
              const color =
                s.state === 'done' ? 'hsl(var(--primary))'
                : s.state === 'error' ? 'hsl(var(--destructive))'
                : s.state === 'active' ? 'hsl(var(--foreground))'
                : 'hsl(var(--muted-foreground))';
              return (
                <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.78rem', color }}>
                  <Box sx={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.state === 'active' && <CircularProgress size={12} sx={{ color: 'hsl(var(--primary))' }} />}
                    {s.state === 'done' && <Box sx={{ fontSize: '0.85rem', lineHeight: 1, color: 'hsl(var(--primary))' }}>✓</Box>}
                    {s.state === 'error' && <Box sx={{ fontSize: '0.85rem', lineHeight: 1, color: 'hsl(var(--destructive))' }}>!</Box>}
                    {s.state === 'pending' && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'hsl(var(--muted-foreground))', opacity: 0.4 }} />}
                  </Box>
                  <Box component="span" sx={{ fontFamily: 'inherit' }}>
                    {label}
                    {s.detail && s.state !== 'pending' && (
                      <Box component="span" sx={{ ml: 0.75, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        — {s.detail}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button
            size="small"
            onClick={() => setScheduleAnchor(null)}
            disabled={scheduleSaving}
            sx={{ height: 36, color: 'hsl(var(--muted-foreground))', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!scheduleCron.trim() || scheduleSaving}
            onClick={async () => {
              const cron = scheduleCron.trim();
              console.log('[AgentUI] Save schedule clicked', { cron, hasOnSchedule: typeof onSchedule === 'function', inputLen: actionInput?.length });
              if (!cron) return;
              setScheduleSteps([
                { id: 'name', state: 'pending' },
                { id: 'workflow', state: 'pending' },
                { id: 'schedule', state: 'pending' },
              ]);
              setScheduleSaving(true);
              try {
                if (onSchedule) {
                  await onSchedule({
                    cron,
                    input: actionInput || '',
                    onStep: (ev) => {
                      setScheduleSteps((prev) => prev.map((p) => p.id === ev.id ? { ...p, state: ev.state, detail: ev.detail } : p));
                    },
                  });
                  toast({ title: 'Schedule saved', description: 'This prompt will now run on the selected schedule.' });
                  setScheduleAnchor(null);
                } else {
                  toast({ title: 'Scheduling not configured', description: 'No handler is wired up for scheduled runs in this view.', variant: 'destructive' });
                  setScheduleAnchor(null);
                }
              } catch (err) {
                console.error('[AgentUI] Schedule failed', err);
                toast({ title: 'Failed to save schedule', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
              } finally {
                setScheduleSaving(false);
              }
            }}
            sx={{
              height: 36, textTransform: 'none',
              bgcolor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
              '&:hover': { bgcolor: 'hsl(var(--primary))', filter: 'brightness(1.1)' },
            }}
          >
            {scheduleSaving ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : 'Save schedule'}
          </Button>
        </Box>
      </Popover>
    </Box>
  );

  // ── Render ──
  return (
    <Box
      className={className}
      sx={[
        { width: '100%', display: 'flex', justifyContent: 'center', pb: 4 },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        sx={[
          { width: '100%', maxWidth, display: 'flex', flexDirection: 'column', gap: 3 },
          ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : []),
        ]}
      >
        {(showRunSwitcher || showStarter) && tabBar}
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
              borderRadius: attachedImages.length > 0 ? 4 : '28px',
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
              {(() => {
                const canSchedule = hasExecution && !scheduleDisabledReason;
                const hintActive = Boolean(scheduleHint) && canSchedule;
                const tip: React.ReactNode = scheduleDisabledReason
                  ? scheduleDisabledTooltip
                  : hintActive
                    ? `Detected schedule: ${scheduleHint!.label}. Click to review and save.`
                    : hasExecution
                      ? 'Schedule this prompt to run repeatedly on a cron schedule'
                      : agentRequestLoading
                        ? 'Scheduling unlocks once this run finishes successfully — you cannot schedule a prompt that has not completed yet.'
                        : 'Scheduling is available after the prompt finishes a successful one-shot run. Submit it first, then come back here to set a cron schedule.';
                return (
                  <Tooltip title={tip} placement="top" arrow>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <IconButton
                        type="button"
                        onClick={(e) => { if (canSchedule) setScheduleAnchor(e.currentTarget); }}
                        disabled={!canSchedule || agentRequestLoading}
                        sx={{
                          height: 36,
                          minWidth: 36,
                          px: hintActive ? 1.25 : 0,
                          width: hintActive ? 'auto' : 36,
                          borderRadius: hintActive ? 999 : '50%',
                          gap: hintActive ? 0.75 : 0,
                          color: hintActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          bgcolor: hintActive ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                          border: hintActive ? '1px solid hsl(var(--primary) / 0.5)' : '1px solid transparent',
                          '&:hover': hintActive
                            ? { bgcolor: 'hsl(var(--primary) / 0.2)', color: 'hsl(var(--primary))' }
                            : { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted))' },
                          '&.Mui-disabled': { opacity: 0.4, color: 'hsl(var(--muted-foreground))' },
                          transition: 'all 160ms ease',
                        }}
                      >
                        <ScheduleIcon sx={{ fontSize: 18 }} />
                        {hintActive && (
                          <Box
                            component="span"
                            sx={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              maxWidth: 180,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {scheduleHint!.label}
                          </Box>
                        )}
                      </IconButton>
                    </Box>
                  </Tooltip>
                );
              })()}
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
                    disabled={actionInput.trim().length < 6 || agentRequestLoading}
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
                <Tooltip title={agentRequestLoading ? 'Locked while the agent is running' : ''}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => { if (!agentRequestLoading) setAppSearchOpen(true); }}
                    disabled={agentRequestLoading}
                    sx={{
                      all: 'unset', cursor: agentRequestLoading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      px: 1.5, py: 0.5,
                      borderRadius: 999,
                      fontSize: '0.8rem', fontWeight: 500,
                      color: 'hsl(var(--muted-foreground))',
                      bgcolor: 'transparent',
                      opacity: agentRequestLoading ? 0.5 : 1,
                      transition: 'color 0.12s ease, background-color 0.12s ease, opacity 0.12s ease',
                      '&:hover': agentRequestLoading ? {} : { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted) / 0.5)' },
                    }}
                  >
                    <AddIcon sx={{ fontSize: 14 }} />
                    {appPickerLabel}
                  </Box>
                </Tooltip>
                {chosenApps.map((app, i) => {
                  const slug = (app.name || '').toLowerCase().replace(/[\s-]+/g, '_');
                  const NO_AUTH = new Set(['http', 'shuffle_tools', 'shuffle-tools', 'tools', 'singul', 'core', 'webhook', 'email']);
                  const needsAuth = !NO_AUTH.has(slug) && !isAppAuthenticated(app.name || '');
                  return (
                  <Tooltip
                    key={`${app.name}-${i}`}
                    title={needsAuth ? `${(app.name || '').replace(/_/g, ' ')} is not authenticated yet — click to set it up` : ''}
                    arrow
                  >
                  <Box
                    onClick={needsAuth && !agentRequestLoading ? () => setAuthDrawerApp({ name: app.name, id: app.id || null }) : undefined}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      pl: 0.5, pr: 0.75, py: 0.25,
                      borderRadius: 999,
                      bgcolor: needsAuth ? 'hsl(var(--severity-medium) / 0.12)' : 'hsl(var(--muted) / 0.6)',
                      border: needsAuth ? '1px solid hsl(var(--severity-medium) / 0.55)' : '1px solid transparent',
                      fontSize: '0.8rem',
                      color: 'hsl(var(--foreground))',
                      cursor: needsAuth && !agentRequestLoading ? 'pointer' : 'default',
                      transition: 'background-color 0.12s ease',
                      '&:hover': needsAuth && !agentRequestLoading ? { bgcolor: 'hsl(var(--severity-medium) / 0.18)' } : {},
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
                    {needsAuth && (
                      <WarningIcon sx={{ fontSize: 14, color: 'hsl(var(--severity-medium))', mr: 0.25 }} />
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); setChosenApps((prev) => prev.filter((_, idx) => idx !== i)); }}
                      disabled={agentRequestLoading}
                      sx={{ p: 0.125, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--destructive))' }, '&.Mui-disabled': { opacity: 0.4 } }}
                    >
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                  </Tooltip>
                  );
                })}
              </Box>
            </Box>
            )}

            {/* Pre-run auth advisory — non-blocking. Lists chosen apps that
                are not yet authenticated and offers a one-click CTA to open
                the app drawer to set them up. The agent can still run
                without these — Shuffle will request auth mid-run if needed. */}
            {!hideAppPicker && (() => {
              const NO_AUTH = new Set(['http', 'shuffle_tools', 'shuffle-tools', 'tools', 'singul', 'core', 'webhook', 'email']);
              const unauthed = chosenApps.filter((a) => {
                const slug = (a.name || '').toLowerCase().replace(/[\s-]+/g, '_');
                return !NO_AUTH.has(slug) && !isAppAuthenticated(a.name || '');
              });
              if (unauthed.length === 0) return null;
              return (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: -0.5 }}>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 1,
                    px: 1.25, py: 0.5,
                    borderRadius: 999,
                    border: '1px solid hsl(var(--severity-medium) / 0.45)',
                    bgcolor: 'hsl(var(--severity-medium) / 0.08)',
                    fontSize: '0.75rem',
                    color: 'hsl(var(--foreground))',
                    maxWidth: '100%',
                  }}>
                    <WarningIcon sx={{ fontSize: 14, color: 'hsl(var(--severity-medium))' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {unauthed.length === 1
                        ? `${unauthed[0].name.replace(/_/g, ' ')} is not authenticated.`
                        : `${unauthed.length} apps are not authenticated.`}
                    </Typography>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setAuthDrawerApp({ name: unauthed[0].name, id: unauthed[0].id || null })}
                      sx={{
                        all: 'unset', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: 600,
                        color: 'hsl(var(--primary))',
                        textTransform: 'capitalize',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      Set up {unauthed[0].name.replace(/_/g, ' ')} →
                    </Box>
                  </Box>
                </Box>
              );
            })()}


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
              <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, borderColor: 'hsl(var(--border))', fontSize: '0.7rem' } }}>
                {(executionApps.length > 0 ? executionApps : chosenApps).map((app, i) => (
                  <Tooltip key={i} title={(app.name || '').replace(/_/g, ' ')}>
                    <Avatar
                      src={app.icon || undefined}
                      alt={app.name}
                      variant="rounded"
                      onClick={() => navigate(`/apps/${encodeURIComponent((app.name || '').toLowerCase().replace(/\s+/g, '_'))}`)}
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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agentData?.original_input || actionInput || 'Agent run'}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
                  Status: {execution?.status || agentData?.status || '—'} · {execution?.execution_id?.slice(0, 8) || ''}
                </Typography>
              </Box>
              {(() => {
                const topStatus = String(execution?.status || agentData?.status || '').toUpperCase();
                const topRunning = !!(execution?.execution_id || agentRequestLoading) && !['FINISHED', 'FAILURE', 'ABORTED', 'CANCELLED', 'CANCELED'].includes(topStatus);
                return topRunning ? (
                  <Tooltip title={execution?.execution_id ? 'Abort this execution' : 'Cancel and return to Start'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={abortAgent}
                        sx={{
                          color: 'hsl(var(--muted-foreground))',
                          '&:hover': { color: 'hsl(var(--destructive))', bgcolor: 'hsl(var(--muted))' },
                        }}
                      >
                        <StopCircleIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null;
              })()}
              <Tooltip title="Rerun with the same prompt and tools">
                <span>
                  <IconButton
                    size="small"
                    disabled={agentRequestLoading}
                    onClick={rerunAgent}
                    sx={{
                      color: 'hsl(var(--muted-foreground))',
                      '&:hover': { color: 'hsl(var(--primary))', bgcolor: 'hsl(var(--muted))' },
                    }}
                  >
                    <RestartAltIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
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

            {/* Shared diagnosis banner — same component used by drawers and
                incident pages, so the user sees identical reasoning here. */}
            <AgentRunDiagnosisBanner
              run={execution}
              sx={{ px: 0, pb: 0, mb: 2 }}
              onJumpToEvidence={(decisionIndex) => {
                // Locate the timeline row for the offending decision and
                // expand + scroll to it on the detailed view, regardless of
                // whether the user is currently on Simple or Detailed.
                const dec = (agentData?.decisions || [])[decisionIndex];
                let rowIndex = -1;
                if (dec) {
                  rowIndex = timeline.findIndex((it) => it.details === dec);
                  if (rowIndex < 0 && dec.run_details?.id) {
                    rowIndex = timeline.findIndex(
                      (it) => (it.details as any)?.run_details?.id === dec.run_details.id
                    );
                  }
                }
                // Fall back to the agent row (0) if we cannot resolve.
                const targetIndex = rowIndex >= 0 ? rowIndex : 0;
                setOpenIndexes((prev) => {
                  const next = new Set(prev);
                  next.add(targetIndex);
                  return next;
                });
                goToTab('detailed');
                // Pulse the row + its output box so the user can see exactly
                // which step the diagnosis was pulled from. Auto-clears after
                // a couple seconds; re-clicking restarts the pulse.
                setHighlightedIndex(targetIndex);
                window.setTimeout(() => {
                  setHighlightedIndex((curr) => (curr === targetIndex ? null : curr));
                }, 2800);
                // Wait for the detailed view to mount, then scroll the row
                // into view. requestAnimationFrame x2 ensures layout has
                // settled after the tab switch.
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    const el = document.querySelector(
                      `[data-timeline-index="${targetIndex}"]`
                    ) as HTMLElement | null;
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  });
                });
              }}
            />

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
                  // Prefer our locally-captured start while the run is in
                  // progress — the backend's `started_at` is sometimes
                  // restamped on every poll, which made the counter look
                  // frozen at "1s". Once finished, prefer the backend value
                  // so the displayed total matches the recorded run.
                  const effectiveStart = isRunning
                    ? (localRunStart || startedAtSec || 0)
                    : (startedAtSec || localRunStart || 0);
                  let durationSec: number | null = null;
                  if (isRunning && effectiveStart) {
                    durationSec = Math.max(0, nowTick - effectiveStart);
                  } else if (totalDuration && totalDuration > 0) {
                    durationSec = totalDuration;
                  }
                  // Detect a pending ASK decision (agent waiting on a user answer)
                  const pendingAsk = (agentData?.decisions || []).slice().reverse().find((d) => {
                    const isAsk = d.category === 'ask' || d.action === 'ask';
                    const st = (d.run_details?.status || '').toUpperCase();
                    return isAsk && (st === 'RUNNING' || st === 'WAITING');
                  });
                  const pendingQuestions: { question: string; index: number }[] = [];
                  if (pendingAsk) {
                    for (const f of pendingAsk.fields || []) {
                      if (f.key === 'question' && f.value) {
                        pendingQuestions.push({ question: f.value, index: pendingQuestions.length + 1 });
                      }
                    }
                  }
                  const pendingAnswered = pendingQuestions.every((q) => questionAnswers[q.question]?.value);

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
                          {durationSec != null ? ` · ${Math.round(durationSec)}s` : ''}
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                      </Box>
                      {pendingAuthApps.map(({ appName, appId, icon }) => {
                        const pretty = appName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                        return (
                          <Box
                            key={`auth-${appName}`}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              p: 1.5,
                              borderRadius: 1.5,
                              border: '1px solid hsla(var(--severity-medium) / 0.3)',
                              bgcolor: 'hsla(var(--severity-medium) / 0.08)',
                            }}
                          >
                            <LockIcon sx={{ color: 'hsl(var(--severity-medium))', fontSize: 22 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                                {pretty} requires authentication
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                Connect your {pretty} account so the agent can complete this step, then rerun.
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={
                                <Avatar
                                  src={icon || undefined}
                                  alt=""
                                  variant="rounded"
                                  sx={{
                                    width: 18, height: 18, borderRadius: 0.5,
                                    bgcolor: 'hsl(var(--background) / 0.4)',
                                    color: 'hsl(var(--background))',
                                    fontSize: '0.7rem', fontWeight: 700,
                                    '& img': { objectFit: 'contain' },
                                  }}
                                >
                                  {pretty.charAt(0)}
                                </Avatar>
                              }
                              onClick={() => setAuthDrawerApp({ name: appName, id: appId })}
                              sx={{
                                height: 36, textTransform: 'none', fontWeight: 600,
                              }}
                            >
                              Authenticate {pretty}
                            </Button>
                          </Box>
                        );
                      })}
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
                      ) : pendingAsk && pendingQuestions.length > 0 ? (
                        (() => {
                          const trySimpleSubmit = () => {
                            if (agentRequestLoading) return;
                            if (!pendingAnswered) {
                              setSimpleSubmitAttempted(true);
                              return;
                            }
                            if (pendingAsk.run_details?.id) {
                              submitQuestions(pendingAsk.run_details.id, questionAnswers);
                            }
                          };
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              {pendingQuestions.map((q, qi) => {
                                const value = questionAnswers[q.question]?.value || '';
                                const isMissing = simpleSubmitAttempted && !value;
                                return (
                                  <Box key={qi}>
                                    <Box sx={{ fontSize: '0.9rem', color: 'hsl(var(--foreground))', mb: 1, '& p': { my: 0.5 } }}>
                                      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(q.question)}</Markdown>
                                    </Box>
                                    <TextField
                                      fullWidth
                                      multiline
                                      minRows={2}
                                      placeholder="Your answer here…"
                                      value={value}
                                      error={isMissing}
                                      helperText={isMissing ? 'Please answer this question' : undefined}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setQuestionAnswers((prev) => ({
                                          ...prev,
                                          [q.question]: { index: qi, value: v },
                                        }));
                                      }}
                                      onKeyDown={(e) => {
                                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                          e.preventDefault();
                                          trySimpleSubmit();
                                        }
                                      }}
                                      size="small"
                                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'hsl(var(--background))' } }}
                                    />
                                  </Box>
                                );
                              })}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Tooltip title={!pendingAnswered ? 'Please answer all questions first' : ''} placement="top" arrow>
                                  <span>
                                    <Button
                                      variant="contained"
                                      size="small"
                                      disabled={agentRequestLoading || !pendingAnswered}
                                      onClick={trySimpleSubmit}
                                      startIcon={agentRequestLoading ? <CircularProgress size={14} sx={{ color: 'hsl(var(--primary-foreground))' }} /> : undefined}
                                    >
                                      {agentRequestLoading ? 'Submitting…' : 'Submit'}
                                    </Button>
                                  </span>
                                </Tooltip>
                                {pendingAsk.run_details?.id && getFormUrl(pendingAsk.run_details.id) && (
                                  <Tooltip title="Answer in the Form UI" placement="right">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        const url = getFormUrl(pendingAsk.run_details!.id!);
                                        if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                      }}
                                      sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--primary))' } }}
                                    >
                                      <OpenInNewIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>
                          );
                        })()
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
            {viewMode === 'detailed' && (() => {
              const detailedStatus = (execution?.status || agentData?.status || 'EXECUTING').toUpperCase();
              const detailedIsRunning = !['FINISHED', 'FAILURE', 'ABORTED', 'CANCELLED', 'CANCELED'].includes(detailedStatus);
              const detailedRunFinished = !detailedIsRunning;
              return (
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
                <>
                  {timeline.map((item, i) => (
                    <TimelineRow
                      key={i}
                      item={item}
                      index={i}
                      open={openIndexes.has(i)}
                      onToggle={() => toggleOpen(i)}
                      appsById={appsById}
                      totalDuration={totalDuration}
                      originalStartTime={originalStartTime}
                      maxWidth={210}
                      questionAnswers={questionAnswers}
                      setQuestionAnswers={setQuestionAnswers}
                      onSubmitQuestions={submitQuestions}
                      onRerunAgent={rerunAgent}
                      onRerunDecision={rerunDecision}
                      agentRequestLoading={agentRequestLoading}
                      getFormUrl={getFormUrl}
                      runFinished={detailedRunFinished}
                      onAuthenticateApp={(name, id) => setAuthDrawerApp({ name, id })}
                      isAppAuthenticated={isAppAuthenticated}
                      highlight={highlightedIndex === i}
                    />
                  ))}
                  {detailedRunFinished && (
                    <Box sx={{
                      borderTop: '1px solid hsl(var(--border))',
                      p: 2.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      bgcolor: 'hsl(var(--muted) / 0.2)',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {detailedStatus === 'FINISHED' ? (
                          <CheckCircleIcon sx={{ fontSize: 18, color: 'hsl(142 70% 45%)' }} />
                        ) : (
                          <ErrorIcon sx={{ fontSize: 18, color: 'hsl(var(--destructive))' }} />
                        )}
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                          {detailedStatus === 'FINISHED' ? 'Run finished' : `Run ${detailedStatus.toLowerCase()}`}
                        </Typography>
                      </Box>
                      {finishAnswer && (
                        <Box sx={{
                          p: 2, borderRadius: 1.5,
                          border: '1px solid hsl(var(--border))',
                          bgcolor: 'hsl(var(--background))',
                          fontSize: '0.9rem',
                          color: 'hsl(var(--foreground))',
                          '& > *:first-of-type': { mt: 0 },
                          '& > *:last-child': { mb: 0 },
                          '& p': { my: 1, lineHeight: 1.55 },
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
                        }}>
                          <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(finishAnswer)}</Markdown>
                        </Box>
                      )}
                    </Box>
                  )}
                </>
              )}
            </Box>
              );
            })()}

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
          multiSelect
          selectedApps={chosenApps.map((a) => ({ name: a.name, id: a.id || null, icon: a.icon }))}
          onSelectionChange={(next) => {
            setChosenApps(
              next.map((app) => {
                const known = availableApps.find(
                  (a) => a.name?.toLowerCase() === app.name?.toLowerCase(),
                );
                return {
                  name: app.name,
                  icon: app.icon || known?.icon,
                  id: app.id || known?.id || undefined,
                };
              }),
            );
          }}
        />

        <AppDetailDrawer
          open={!!authDrawerApp}
          onClose={() => setAuthDrawerApp(null)}
          appName={authDrawerApp?.name || null}
          appId={authDrawerApp?.id || null}
          activeOrgId={orgId || null}
        />
      </Box>
    </Box>
  );
};

export default AgentUI;
