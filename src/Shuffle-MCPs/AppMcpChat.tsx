import { useState, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Avatar,
  CircularProgress,
  Chip,
  InputBase,
} from '@mui/material';
import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import {
  THREAT_INTEL_PATTERNS,
  EMAIL_APP_PATTERNS,
  EDR_PATTERNS,
  SIEM_PATTERNS,
  CASES_PATTERNS,
  COMMUNICATION_PATTERNS_NAMES,
} from '@/Shuffle-MCPs/ingestionDetection';

interface AppMcpChatProps {
  appName: string;
  appIcon?: string;
  appId?: string;
  categories?: string[];
}

type RunState = 'idle' | 'running' | 'done';

/** Category-based suggestion prompts — natural, actionable questions.
 *  Keys are lowercase fragments that we match against app category strings. */
const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  'threat': [
    'Is 1.2.3.4 a known bad actor?',
    'Check if this domain is malicious',
    'Look up threat indicators for a hash',
  ],
  'siem': [
    'Show me the latest critical alerts',
    'Any unusual login attempts today?',
    'Summarize recent security events',
  ],
  'email': [
    'Did I get a message from my team yesterday?',
    'Find emails with attachments from last week',
    'Check for any phishing reports',
  ],
  'communication': [
    'Did I get a message from my team yesterday?',
    'Send a status update to the channel',
    'Check for unread notifications',
  ],
  'edr': [
    'Is this endpoint compromised?',
    'Show recent detections on workstations',
    'Isolate a suspicious host',
  ],
  'endpoint': [
    'Is this endpoint compromised?',
    'Show recent detections on workstations',
    'Isolate a suspicious host',
  ],
  'cloud': [
    'List my running instances',
    'Any public S3 buckets detected?',
    'Check IAM policy changes today',
  ],
  'ticket': [
    'What tickets are assigned to me?',
    'Create a new incident ticket',
    'Show open high-priority issues',
  ],
  'itsm': [
    'What tickets are assigned to me?',
    'Create a new incident ticket',
    'Show open high-priority issues',
  ],
  'case': [
    'What cases are assigned to me?',
    'Create a new incident case',
    'Show open high-priority cases',
  ],
  'vulnerab': [
    'Any new critical CVEs this week?',
    'Check vulnerability status for this asset',
    'Show unpatched systems',
  ],
  'network': [
    'Any unusual outbound connections?',
    'Check firewall rule changes',
    'Show top talkers in the last hour',
  ],
  'identity': [
    'Show recent failed login attempts',
    'Is this user account locked out?',
    'List users with admin privileges',
  ],
  'intel': [
    'Is 1.2.3.4 a known bad actor?',
    'Check if this domain is malicious',
    'Look up threat indicators for a hash',
  ],
};

const DEFAULT_SUGGESTIONS = [
  'What can you do?',
  'Show me recent activity',
  'Run a quick check',
];

/** Infer category keys from the app name using known patterns */
function inferCategoryKeysFromName(appName: string): string[] {
  const name = appName.toLowerCase();
  const keys: string[] = [];
  if (THREAT_INTEL_PATTERNS.some(p => name.includes(p))) keys.push('threat', 'intel');
  if (EMAIL_APP_PATTERNS.some(p => name.includes(p))) keys.push('email');
  if (EDR_PATTERNS.some(p => name.includes(p))) keys.push('edr', 'endpoint');
  if (SIEM_PATTERNS.some(p => name.includes(p))) keys.push('siem');
  if (CASES_PATTERNS.some(p => name.includes(p))) keys.push('ticket', 'case');
  if (COMMUNICATION_PATTERNS_NAMES.some(p => name.includes(p))) keys.push('communication');
  return keys;
}

function getSuggestions(appName: string, categories?: string[]): string[] {
  const matched: string[] = [];

  // 1. Match from explicit categories
  if (categories && categories.length > 0) {
    for (const cat of categories) {
      const normalized = cat.toLowerCase();
      for (const [key, prompts] of Object.entries(CATEGORY_SUGGESTIONS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          matched.push(...prompts);
        }
      }
    }
  }

  // 2. Fallback: infer from the app name itself
  if (matched.length === 0) {
    const inferred = inferCategoryKeysFromName(appName);
    for (const inferredKey of inferred) {
      const prompts = CATEGORY_SUGGESTIONS[inferredKey];
      if (prompts) matched.push(...prompts);
    }
  }

  if (matched.length === 0) return DEFAULT_SUGGESTIONS;

  const unique = [...new Set(matched)];
  return unique.slice(0, 4);
}

/** Pick a short display label from categories, or infer from app name */
function getPrimaryCategory(appName: string, categories?: string[]): string | null {
  if (categories && categories.length > 0) {
    const skip = ['other', 'general', 'integration'];
    const filtered = categories.filter(c => !skip.includes(c.toLowerCase()));
    if (filtered.length > 0) return filtered[0];
    return categories[0];
  }
  // Infer from name
  const name = appName.toLowerCase();
  if (THREAT_INTEL_PATTERNS.some(p => name.includes(p))) return 'Threat Intel';
  if (EMAIL_APP_PATTERNS.some(p => name.includes(p))) return 'Email';
  if (EDR_PATTERNS.some(p => name.includes(p))) return 'EDR';
  if (SIEM_PATTERNS.some(p => name.includes(p))) return 'SIEM';
  if (CASES_PATTERNS.some(p => name.includes(p))) return 'Ticketing';
  if (COMMUNICATION_PATTERNS_NAMES.some(p => name.includes(p))) return 'Communication';
  return null;
}

const AppMcpChat = ({ appName, appIcon, appId, categories }: AppMcpChatProps) => {
  const [input, setInput] = useState('');
  const [runState, setRunState] = useState<RunState>('idle');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => getSuggestions(appName, categories), [appName, categories]);
  const primaryCategory = useMemo(() => getPrimaryCategory(appName, categories), [appName, categories]);
  const runAction = async () => {
    const trimmed = input.trim();
    if (!trimmed || runState === 'running') return;

    setQuery(trimmed);
    setInput('');
    setRunState('running');
    setResult('');
    setIsError(false);

    try {
      const response = await fetch(
        getApiUrl(`/api/v1/apps/${encodeURIComponent(appName)}/mcp`),
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: crypto.randomUUID(),
            method: 'tools/call',
            params: {
              tool_name: appName,
              tool_id: appId || appName,
              input: { text: trimmed },
            },
          }),
        }
      );

      // Read raw text first to handle non-JSON responses safely
      const rawText = await response.text();
      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        setIsError(true);
        setResult(`Error ${response.status}: ${rawText || response.statusText}`);
      } else if (!contentType?.includes('application/json')) {
        // Got HTML or other non-JSON back
        if (rawText.trim().startsWith('<!') || rawText.includes('<html')) {
          setIsError(true);
          setResult(`Received an unexpected HTML response (status ${response.status}). This may indicate an auth redirect or server issue.`);
        } else {
          setResult(rawText);
        }
      } else {
        const data = JSON.parse(rawText);
        let content = '';

        if (typeof data === 'string') {
          content = data;
        } else if (data?.result) {
          // Extract message if result is an object with a message field
          if (typeof data.result === 'object' && data.result !== null) {
            if (data.result.message) {
              content = data.result.message;
            }
            // Append remaining fields as context if there's more than just message
            const rest = { ...data.result };
            delete rest.message;
            if (Object.keys(rest).length > 0) {
              const extra = JSON.stringify(rest, null, 2);
              content = content
                ? `${content}\n\n\`\`\`json\n${extra}\n\`\`\``
                : `\`\`\`json\n${extra}\n\`\`\``;
            }
          } else {
            content = String(data.result);
          }
        } else if (data?.response) {
          content = typeof data.response === 'string' ? data.response : JSON.stringify(data.response, null, 2);
        } else if (data?.message) {
          content = data.message;
        } else {
          content = `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
        }

        if (content) {
          setResult(content);
        } else {
          setResult('No output returned.');
        }
      }
    } catch (err) {
      setIsError(true);
      setResult(`Could not connect. ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRunState('done');
    }
  };

  const reset = () => {
    setRunState('idle');
    setQuery('');
    setResult('');
    setIsError(false);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runAction();
    }
  };

  const displayName = appName.replace(/_/g, ' ');

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--background))',
        overflow: 'hidden',
      }}
    >
      <AnimatePresence mode="wait">
        {/* ── IDLE ── */}
        {runState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Label */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'hsl(var(--primary) / 0.1)',
                    border: '1px solid hsl(var(--primary) / 0.2)',
                    flexShrink: 0,
                  }}
                >
                  {appIcon ? (
                    <Avatar
                      src={appIcon}
                      sx={{ width: 18, height: 18, '& img': { objectFit: 'contain' } }}
                    />
                  ) : (
                    <AgentIcon size={16} />
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Try it out
                </Typography>
                {primaryCategory && (
                  <Chip
                    label={primaryCategory}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--muted-foreground))',
                      textTransform: 'capitalize',
                    }}
                  />
                )}
                <Chip
                  label="MCP"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    backgroundColor: 'hsl(var(--primary) / 0.12)',
                    color: 'hsl(var(--primary))',
                    letterSpacing: '0.06em',
                    ml: 'auto',
                  }}
                />
              </Box>

              {/* Command input */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--card))',
                  px: 1.5,
                  py: 0.75,
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  '&:focus-within': {
                    borderColor: 'hsl(var(--primary) / 0.5)',
                    boxShadow: '0 0 0 3px hsl(var(--primary) / 0.08)',
                  },
                }}
              >
                <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--primary))', fontWeight: 600, userSelect: 'none', fontFamily: "'JetBrains Mono', monospace" }}>
                  ›
                </Typography>
                <InputBase
                  inputRef={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask ${displayName} something…`}
                  fullWidth
                  sx={{
                    fontSize: '0.82rem',
                    color: 'hsl(var(--foreground))',
                    '& input::placeholder': {
                      color: 'hsl(var(--muted-foreground))',
                      opacity: 0.7,
                    },
                  }}
                />
                <Box
                  component="button"
                  onClick={runAction}
                  disabled={!input.trim()}
                  sx={{
                    all: 'unset',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: '8px',
                    flexShrink: 0,
                    cursor: input.trim() ? 'pointer' : 'default',
                    backgroundColor: input.trim() ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    color: input.trim() ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    transition: 'all 0.15s ease',
                    '&:hover': input.trim() ? {
                      filter: 'brightness(1.1)',
                    } : {},
                  }}
                >
                  <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />
                </Box>
              </Box>

              {/* Quick actions */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {suggestions.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    onClick={() => {
                      setInput(s);
                      inputRef.current?.focus();
                    }}
                    sx={{
                      height: 26,
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      backgroundColor: 'transparent',
                      color: 'hsl(var(--muted-foreground))',
                      border: '1px dashed hsl(var(--border))',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: 'hsl(var(--muted))',
                        color: 'hsl(var(--foreground))',
                        borderStyle: 'solid',
                        borderColor: 'hsl(var(--primary) / 0.3)',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </motion.div>
        )}

        {/* ── RUNNING ── */}
        {runState === 'running' && (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} thickness={5} sx={{ color: 'hsl(var(--primary))' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Executing…
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: 'hsl(var(--muted-foreground))',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  › {query}
                </Typography>
              </Box>
            </Box>
          </motion.div>
        )}

        {/* ── DONE ── */}
        {runState === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Status bar */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isError ? (
                    <ErrorOutlineIcon sx={{ fontSize: 18, color: 'hsl(0 70% 55%)' }} />
                  ) : (
                    <CheckCircleOutlineIcon sx={{ fontSize: 18, color: 'hsl(145 60% 45%)' }} />
                  )}
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    {isError ? 'Failed' : 'Completed'}
                  </Typography>
                </Box>
                <Chip
                  icon={<RestartAltIcon sx={{ fontSize: 14 }} />}
                  label="Run again"
                  size="small"
                  onClick={reset}
                  sx={{
                    height: 26,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    color: 'hsl(var(--muted-foreground))',
                    border: '1px solid hsl(var(--border))',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))',
                    },
                  }}
                />
              </Box>

              {/* Query echo */}
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: 'hsl(var(--muted-foreground))',
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                › {query}
              </Typography>

              {/* Output */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid',
                  borderColor: isError ? 'hsl(0 60% 50% / 0.25)' : 'hsl(var(--border))',
                  maxHeight: 340,
                  overflowY: 'auto',
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-track': { background: 'transparent' },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'hsl(var(--border))',
                    borderRadius: 2,
                  },
                  '& p': {
                    fontSize: '0.8rem',
                    lineHeight: 1.65,
                    color: 'hsl(var(--foreground))',
                    m: 0,
                    '&:not(:last-child)': { mb: 1 },
                  },
                  '& pre': {
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 1,
                    p: 1.5,
                    overflow: 'auto',
                    fontSize: '0.72rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    my: 1,
                  },
                  '& code': {
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.72rem',
                    backgroundColor: 'hsl(var(--muted))',
                    px: 0.5,
                    borderRadius: 0.5,
                  },
                  '& pre code': { backgroundColor: 'transparent', p: 0 },
                  '& ul, & ol': {
                    pl: 2,
                    fontSize: '0.8rem',
                    color: 'hsl(var(--foreground))',
                  },
                  '& a': {
                    color: 'hsl(var(--primary))',
                    textDecoration: 'underline',
                  },
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result}
                </ReactMarkdown>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default AppMcpChat;
