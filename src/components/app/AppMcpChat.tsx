import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Avatar,
  CircularProgress,
  Chip,
  InputBase,
} from '@mui/material';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_CONFIG } from '@/config/api';

interface AppMcpChatProps {
  appName: string;
  appIcon?: string;
  appId?: string;
}

type RunState = 'idle' | 'running' | 'done';

const AppMcpChat = ({ appName, appIcon, appId }: AppMcpChatProps) => {
  const [input, setInput] = useState('');
  const [runState, setRunState] = useState<RunState>('idle');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runAction = async () => {
    const trimmed = input.trim();
    if (!trimmed || runState === 'running' || !API_CONFIG.apiKey) return;

    setQuery(trimmed);
    setInput('');
    setRunState('running');
    setResult('');
    setIsError(false);

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/v1/apps/${encodeURIComponent(appName)}/mcp`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${API_CONFIG.apiKey}`,
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

      let content = '';
      if (response.ok) {
        const data = await response.json();
        if (typeof data === 'string') {
          content = data;
        } else if (data?.result) {
          content = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
        } else if (data?.response) {
          content = typeof data.response === 'string' ? data.response : JSON.stringify(data.response, null, 2);
        } else if (data?.message) {
          content = data.message;
        } else {
          content = JSON.stringify(data, null, 2);
        }
      } else {
        const errText = await response.text().catch(() => '');
        content = `Error ${response.status}: ${errText || response.statusText}`;
        setIsError(true);
      }

      setResult(content);
    } catch (err) {
      setResult(`Failed to reach the API. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsError(true);
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

  const suggestions = [
    'Check an IP address',
    'Run a blacklist lookup',
    'Report abuse for an IP',
  ];

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
                    <SmartToyOutlinedIcon sx={{ fontSize: 16, color: 'hsl(var(--primary))' }} />
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Run action
                </Typography>
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
                  placeholder={`What do you want ${displayName} to do?`}
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
