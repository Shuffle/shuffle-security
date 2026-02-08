import { useState, useRef, useEffect, useCallback } from 'react';
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
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_CONFIG } from '@/config/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AppMcpChatProps {
  appName: string;
  appIcon?: string;
  appId?: string;
}

const AppMcpChat = ({ appName, appIcon, appId }: AppMcpChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !API_CONFIG.apiKey) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
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
              input: {
                text: trimmed,
              },
            },
          }),
        }
      );

      let content = '';
      if (response.ok) {
        const data = await response.json();
        // Handle different response shapes
        if (typeof data === 'string') {
          content = data;
        } else if (data?.result) {
          content = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
        } else if (data?.response) {
          content = typeof data.response === 'string' ? data.response : JSON.stringify(data.response, null, 2);
        } else if (data?.message) {
          content = data.message;
        } else if (data?.success !== undefined) {
          content = JSON.stringify(data, null, 2);
        } else {
          content = JSON.stringify(data, null, 2);
        }
      } else {
        const errText = await response.text().catch(() => '');
        content = `Error ${response.status}: ${errText || response.statusText}`;
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Failed to reach the API. ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
        height: 520,
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

      {/* Messages area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2.5,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2.5,
              py: 4,
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
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
                  sx={{ width: 32, height: 32, '& img': { objectFit: 'contain' } }}
                />
              ) : (
                <SmartToyOutlinedIcon sx={{ fontSize: 28, color: 'hsl(var(--primary))' }} />
              )}
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                  mb: 0.5,
                }}
              >
                {displayName} Agent
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: 'hsl(var(--muted-foreground))',
                  maxWidth: 280,
                  lineHeight: 1.5,
                }}
              >
                Execute actions, look up data, or automate tasks directly.
              </Typography>
            </Box>

            {/* Suggestions */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center', mt: 0.5 }}>
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
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    mt: 0.25,
                    backgroundColor:
                      msg.role === 'user'
                        ? 'hsl(var(--primary) / 0.15)'
                        : 'hsl(var(--muted))',
                    border: '1px solid',
                    borderColor:
                      msg.role === 'user'
                        ? 'hsl(var(--primary) / 0.3)'
                        : 'hsl(var(--border))',
                  }}
                >
                  {msg.role === 'user' ? (
                    <PersonOutlineIcon sx={{ fontSize: 16, color: 'hsl(var(--primary))' }} />
                  ) : appIcon ? (
                    <Avatar src={appIcon} sx={{ width: 28, height: 28, '& img': { objectFit: 'contain' } }} />
                  ) : (
                    <SmartToyOutlinedIcon sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }} />
                  )}
                </Avatar>

                <Box
                  sx={{
                    maxWidth: '80%',
                    px: 2,
                    py: 1.25,
                    borderRadius: 2,
                    backgroundColor:
                      msg.role === 'user'
                        ? 'hsl(var(--primary) / 0.1)'
                        : 'hsl(var(--card))',
                    border: '1px solid',
                    borderColor:
                      msg.role === 'user'
                        ? 'hsl(var(--primary) / 0.2)'
                        : 'hsl(var(--border))',
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <Box
                      sx={{
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
                        {msg.content}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <Typography
                      sx={{
                        fontSize: '0.82rem',
                        lineHeight: 1.6,
                        color: 'hsl(var(--foreground))',
                      }}
                    >
                      {msg.content}
                    </Typography>
                  )}
                </Box>
              </Box>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  backgroundColor: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                {appIcon ? (
                  <Avatar src={appIcon} sx={{ width: 28, height: 28, '& img': { objectFit: 'contain' } }} />
                ) : (
                  <SmartToyOutlinedIcon sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }} />
                )}
              </Avatar>
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  alignItems: 'center',
                  px: 2,
                  py: 1.25,
                  borderRadius: 2,
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <CircularProgress size={14} sx={{ color: 'hsl(var(--primary))' }} />
                <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', ml: 0.5 }}>
                  Thinking...
                </Typography>
              </Box>
            </Box>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input area */}
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
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
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
    </Box>
  );
};

export default AppMcpChat;
