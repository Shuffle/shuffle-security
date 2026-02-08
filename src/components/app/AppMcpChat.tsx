import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Avatar,
  CircularProgress,
  Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const runAction = async () => {
    const trimmed = input.trim();
    if (!trimmed || runState === 'running' || !API_CONFIG.apiKey) return;

    setQuery(trimmed);
    setInput('');
    setRunState('running');
    setResult('');
    setIsError(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runAction();
    }
  };

  const displayName = appName.replace(/_/g, ' ');

  const suggestions = [
    `Check an IP address`,
    `Run a blacklist lookup`,
    `Report abuse for an IP`,
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--background))',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid hsl(var(--border))',
          backgroundColor: 'hsl(var(--card))',
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 18, color: 'hsl(var(--primary))' }} />
        <Typography
          sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            flex: 1,
          }}
        >
          Run actions with {displayName}
        </Typography>
        <Chip
          label="MCP"
          size="small"
          sx={{
            height: 22,
            fontSize: '0.65rem',
            fontWeight: 600,
            backgroundColor: 'hsl(var(--primary) / 0.12)',
            color: 'hsl(var(--primary))',
            letterSpacing: '0.05em',
          }}
        />
      </Box>

      {/* Content */}
      <AnimatePresence mode="wait">
        {runState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Box sx={{ px: 2.5, py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'hsl(var(--primary) / 0.1)',
                  border: '1px solid hsl(var(--primary) / 0.2)',
                }}
              >
                {appIcon ? (
                  <Avatar
                    src={appIcon}
                    sx={{ width: 28, height: 28, '& img': { objectFit: 'contain' } }}
                  />
                ) : (
                  <SmartToyOutlinedIcon sx={{ fontSize: 24, color: 'hsl(var(--primary))' }} />
                )}
              </Box>
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: 'hsl(var(--muted-foreground))',
                  textAlign: 'center',
                  maxWidth: 280,
                  lineHeight: 1.5,
                }}
              >
                Execute an action, look up data, or automate a task.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
                {suggestions.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    sx={{
                      height: 28,
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: 'hsl(var(--secondary))',
                        color: 'hsl(var(--foreground))',
                        borderColor: 'hsl(var(--primary) / 0.3)',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </motion.div>
        )}

        {runState === 'running' && (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Box sx={{ px: 2.5, py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={28} sx={{ color: 'hsl(var(--primary))' }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, color: 'hsl(var(--foreground))', mb: 0.5 }}>
                  Running action…
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: 'hsl(var(--muted-foreground))',
                    fontStyle: 'italic',
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  "{query}"
                </Typography>
              </Box>
            </Box>
          </motion.div>
        )}

        {runState === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box sx={{ px: 2.5, py: 2 }}>
              {/* Query label */}
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: 'hsl(var(--muted-foreground))',
                  mb: 1,
                  fontStyle: 'italic',
                }}
              >
                "{query}"
              </Typography>

              {/* Result */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: isError ? 'hsl(0 60% 50% / 0.08)' : 'hsl(var(--card))',
                  border: '1px solid',
                  borderColor: isError ? 'hsl(0 60% 50% / 0.2)' : 'hsl(var(--border))',
                  maxHeight: 360,
                  overflowY: 'auto',
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-track': { background: 'transparent' },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'hsl(var(--border))',
                    borderRadius: 2,
                  },
                  '& p': {
                    fontSize: '0.82rem',
                    lineHeight: 1.6,
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
                    fontSize: '0.75rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    my: 1,
                  },
                  '& code': {
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.75rem',
                    backgroundColor: 'hsl(var(--muted))',
                    px: 0.5,
                    borderRadius: 0.5,
                  },
                  '& pre code': {
                    backgroundColor: 'transparent',
                    p: 0,
                  },
                  '& ul, & ol': {
                    pl: 2,
                    fontSize: '0.82rem',
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

              {/* Reset button */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 0.5 }}>
                <Chip
                  icon={<RestartAltIcon sx={{ fontSize: 16 }} />}
                  label="Run another"
                  size="small"
                  onClick={reset}
                  sx={{
                    height: 30,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: 'hsl(var(--muted))',
                    color: 'hsl(var(--muted-foreground))',
                    border: '1px solid hsl(var(--border))',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: 'hsl(var(--secondary))',
                      color: 'hsl(var(--foreground))',
                    },
                  }}
                />
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area — hidden when running or showing result */}
      {runState === 'idle' && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--card))',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 1,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--background))',
              px: 1.5,
              py: 0.5,
              transition: 'border-color 0.15s ease',
              '&:focus-within': {
                borderColor: 'hsl(var(--primary) / 0.5)',
              },
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`What do you want to do with ${displayName}?`}
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'hsl(0, 0%, 100%)',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                padding: '8px 0',
                fontFamily: "'Inter', system-ui, sans-serif",
                maxHeight: 120,
              }}
            />
            <IconButton
              onClick={runAction}
              disabled={!input.trim() || runState !== 'idle'}
              size="small"
              sx={{
                mb: 0.5,
                color: input.trim() ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: 'hsl(var(--primary) / 0.1)',
                },
                '&.Mui-disabled': {
                  color: 'hsl(var(--muted-foreground) / 0.4)',
                },
              }}
            >
              <SendIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          <Typography
            sx={{
              fontSize: '0.65rem',
              color: 'hsl(var(--muted-foreground) / 0.6)',
              mt: 0.75,
              textAlign: 'center',
            }}
          >
            Powered by Shuffle MCP · Press Enter to send
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AppMcpChat;
