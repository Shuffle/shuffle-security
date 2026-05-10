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
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  ButtonGroup,
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
import SendIcon from '@mui/icons-material/Send';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import AppSearchDrawer from '@/Shuffle-MCPs/AppSearchDrawer';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
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
  /** Initial chip set under the prompt. Defaults to Http + Shuffle Tools. */
  defaultApps?: AgentUIApp[];
  /** Hero title above the prompt. */
  title?: string;
  /** Placeholder shown in the empty prompt. */
  placeholder?: string;
  /** Hide the centered hero icon (compact mode). */
  hideHeroIcon?: boolean;
  /** Maximum width of the centered card. */
  maxWidth?: number;
  /** Read `?execution_id` & `?authorization` from window URL on mount. */
  readUrlParams?: boolean;
  /** Called whenever a run finishes (success or failure). */
  onRun?: (info: { input: string; success: boolean; executionId?: string; error?: string }) => void;
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
  agentRequestLoading: boolean;
}

const TimelineRow: React.FC<TimelineRowProps> = ({
  item, index, open, onToggle, appsById, totalDuration, originalStartTime,
  maxWidth, questionAnswers, setQuestionAnswers, onSubmitQuestions, agentRequestLoading,
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
          <Markdown remarkPlugins={[remarkGfm]}>{displayLabel || ''}</Markdown>
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
      </Box>

      {/* Question form (for ASK decisions) */}
      {questions.length > 0 && (item.status === 'RUNNING' || item.status === 'WAITING') && (
        <Box sx={{ px: 4, pb: 2 }}>
          {questions.map((q, qi) => (
            <Box key={qi} sx={{ mt: 2 }}>
              <Box sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', mb: 1 }}>
                <Markdown remarkPlugins={[remarkGfm]}>{q.question}</Markdown>
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
            component="pre"
            sx={{
              m: 0,
              p: 2,
              borderRadius: 1.5,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--background))',
              fontSize: '0.72rem',
              lineHeight: 1.55,
              color: 'hsl(var(--foreground))',
              overflowX: 'auto',
              maxHeight: 400,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}
          >
            <code>
              {validate.valid ? JSON.stringify(validate.result, null, 2) : String(item.details ?? '')}
            </code>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_APPS: AgentUIApp[] = [
  { name: 'Http', id: 'ebfe7d5c80000676588f86731db0a555' },
  { name: 'Shuffle_tools', id: '3e2bdf9d5069fe3f4746c29d68785a6a' },
];

const AgentUI: React.FC<AgentUIProps> = ({
  defaultApps = DEFAULT_APPS,
  title = 'What do you want to do?',
  placeholder = 'Describe a task, e.g. "Get my emails for today and summarise them"',
  hideHeroIcon = false,
  maxWidth = 900,
  readUrlParams = true,
  onRun,
}) => {
  const [actionInput, setActionInput] = useState('');
  const [chosenApps, setChosenApps] = useState<AgentUIApp[]>(defaultApps);
  const [appSearchOpen, setAppSearchOpen] = useState(false);
  const [agentRequestLoading, setAgentRequestLoading] = useState(false);
  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [agentData, setAgentData] = useState<{ decisions?: AgentDecision[]; original_input?: string; status?: string; started_at?: number; completed_at?: number; [k: string]: any }>({});
  const [showStarter, setShowStarter] = useState(true);
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, { index: number; value: string }>>({});
  const [continuationText, setContinuationText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple');
  const [attachedImages, setAttachedImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── Fetch execution result (poll-friendly) ──
  const getExecution = useCallback(async (executionId: string, authorization: string) => {
    if (!executionId || !authorization) return;
    try {
      const resp = await fetch(getApiUrl('/api/v1/streams/results'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
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
      const v = validateJson(actionResult?.result);
      if (v.valid) setAgentData({ ...v.result, started_at: json.started_at, completed_at: json.completed_at, status: json.status });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    }
  }, []);

  // Read URL params on mount
  useEffect(() => {
    if (!readUrlParams) return;
    const params = new URLSearchParams(window.location.search);
    const eid = params.get('execution_id');
    const auth = params.get('authorization');
    if (eid && auth) {
      setShowStarter(false);
      getExecution(eid, auth);
    }
  }, [readUrlParams, getExecution]);

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
    setExecution(null);
    setAgentData({ original_input: text.trim() });

    const result = await runAgent({
      input: text.trim(),
      skipPolling: true,
      ...(chosenApps.length === 1 ? { toolName: chosenApps[0].name } : {}),
      ...(chosenApps.length > 1 ? { toolNames: chosenApps.map((a) => a.name) } : {}),
      ...(attachedImages.length > 0 ? { images: attachedImages.map((img) => {
        const m = /^data:([^;]+);base64,(.*)$/.exec(img.dataUrl);
        return m ? { mimeType: m[1], data: m[2], name: img.name } : { mimeType: 'image/png', data: img.dataUrl, name: img.name };
      }) } : {}),
    });

    setAgentRequestLoading(false);

    if (!result.success) {
      setError(result.error || 'Agent run failed.');
      setShowStarter(true);
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
  }, [chosenApps, getExecution, onRun]);

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
      const resp = await fetch(getApiUrl(`/api/v1/workflows/${wfId}/run?${params.toString()}`), {
        method: 'GET',
        credentials: 'include',
        headers: { ...getAuthHeader() },
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

  // ── Build timeline ──
  const { timeline, originalStartTime, totalDuration, finishDecisionId, finishAnswer } = useMemo(() => {
    const items: TimelineItem[] = [
      {
        label: 'AI Agent',
        type: 'agent',
        category: 'agent',
        details: agentData,
        status: execution?.status || agentData?.status,
        start_time: agentData?.started_at || execution?.started_at,
        end_time: agentData?.completed_at || execution?.completed_at,
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
        start_time: rd.started_at || 0,
        end_time: rd.completed_at || Math.floor(Date.now() / 1000),
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

  const restart = () => {
    setShowStarter(true);
    setError(null);
    setQuestionAnswers({});
    setContinuationText('');
    setAttachedImages([]);
  };

  // ── Render ──
  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', pb: 4 }}>
      <Box sx={{ width: '100%', maxWidth, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {showStarter ? (
          <Box
            component="form"
            onSubmit={(e) => { e.preventDefault(); submitInput(actionInput); }}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}
          >
            {!hideHeroIcon && (
              <Box sx={{
                width: 84, height: 84, borderRadius: 3,
                bgcolor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              }}>
                <AgentIcon size={56} />
              </Box>
            )}
            <Typography component="h1" sx={{
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </Typography>

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
              <Tooltip title="⌘+Enter to send" placement="top" arrow>
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
                    {agentRequestLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <PlayArrowRoundedIcon />}
                  </IconButton>
                </span>
              </Tooltip>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
              <Box
                component="button"
                type="button"
                onClick={() => setAppSearchOpen(true)}
                sx={{
                  all: 'unset', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 0.75,
                  px: 1.75, py: 0.75,
                  borderRadius: 999,
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '0.85rem',
                  '&:hover': { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))', bgcolor: 'hsla(var(--primary) / 0.08)' },
                }}
              >
                <AddIcon sx={{ fontSize: 16 }} />
                Select Apps / MCPs
              </Box>
              {chosenApps.map((app, i) => (
                <Box
                  key={`${app.name}-${i}`}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.75,
                    pl: 0.5, pr: 0.75, py: 0.5,
                    borderRadius: 999,
                    border: '1px solid hsl(var(--border))',
                    bgcolor: 'hsl(var(--card))',
                    fontSize: '0.85rem',
                    color: 'hsl(var(--foreground))',
                  }}
                >
                  <Avatar
                    src={app.icon || `https://shuffler.io/api/v1/apps/${app.id}/icon`}
                    alt={app.name}
                    variant="rounded"
                    sx={{ width: 22, height: 22, bgcolor: 'transparent' }}
                  />
                  <Typography sx={{ fontSize: '0.85rem', mx: 0.25, textTransform: 'capitalize' }}>
                    {app.name.replace(/_/g, ' ')}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setChosenApps((prev) => prev.filter((_, idx) => idx !== i))}
                    sx={{ p: 0.25, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--destructive))' } }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>

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
            {/* Debug header */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              p: 2,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              mb: 2,
            }}>
              <ButtonGroup size="small">
                <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={restart}>
                  Restart
                </Button>
                <Tooltip title="Reload execution data">
                  <span>
                    <Button
                      variant="outlined"
                      onClick={() => execution?.execution_id && execution?.authorization && getExecution(execution.execution_id, execution.authorization)}
                      disabled={!execution?.execution_id || !execution?.authorization}
                    >
                      <RefreshIcon fontSize="small" />
                    </Button>
                  </span>
                </Tooltip>
              </ButtonGroup>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', fontWeight: 600 }}>
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
                      src={app.icon || (app.id ? `https://shuffler.io/api/v1/apps/${app.id}/icon` : undefined)}
                      alt={app.name}
                      variant="rounded"
                      sx={{ bgcolor: 'hsl(var(--muted))' }}
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

            {/* Timeline */}
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
                    agentRequestLoading={agentRequestLoading}
                  />
                ))
              )}
            </Box>

            {/* Continuation form (after a finish decision) */}
            {finishDecisionId && (
              <Box sx={{ mt: 3 }}>
                {finishAnswer && (
                  <Box sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid hsl(var(--border))',
                    bgcolor: 'hsl(var(--background))',
                    mb: 2,
                    fontSize: '0.9rem',
                    color: 'hsl(var(--foreground))',
                    '& p': { margin: 0 },
                  }}>
                    <Markdown remarkPlugins={[remarkGfm]}>{finishAnswer}</Markdown>
                  </Box>
                )}
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
                    p: 1.75, borderRadius: 999,
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
                    placeholder="Add more details to continue this task…"
                    value={continuationText}
                    onChange={(e) => setContinuationText(e.target.value)}
                    disabled={agentRequestLoading}
                    sx={{ fontSize: '0.95rem', color: 'hsl(var(--foreground))', px: 2 }}
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
            )}
          </Box>
        )}

        <AppSearchDrawer
          open={appSearchOpen}
          onClose={() => setAppSearchOpen(false)}
          title="Select Apps / MCPs"
          subtitle="Pick the tools the agent is allowed to use for this run"
          onQuickSelect={(app) => {
            setChosenApps((prev) =>
              prev.some((a) => a.name === app.name)
                ? prev
                : [...prev, { name: app.name, icon: app.icon }]
            );
          }}
        />
      </Box>
    </Box>
  );
};

export default AgentUI;
