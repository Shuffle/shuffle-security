/**
 * EmailThreadPanel — renders email threads extracted from incident descriptions.
 * Detects email content (From/To/Subject headers, forwarded chains, "On … wrote:" markers)
 * and displays them as a threaded conversation. Stays within OCSF class_uid 2005.
 */
import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Chip,
  Collapse,
  Tooltip,
  TextField,
  Button,
  Divider,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ReplyIcon from '@mui/icons-material/Reply';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SendIcon from '@mui/icons-material/Send';
import ForwardIcon from '@mui/icons-material/Forward';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PersonIcon from '@mui/icons-material/Person';
import DOMPurify from 'dompurify';

export interface EmailMessage {
  id: string;
  from: string;
  fromEmail?: string;
  to?: string;
  cc?: string;
  subject?: string;
  date?: string;
  body: string;
  bodyHtml?: string;
  isLatest?: boolean;
}

interface EmailThreadPanelProps {
  descriptionHtml: string;
  descriptionText: string;
  rawOCSF?: any;
  onReply?: (to: string, subject: string, body: string) => void;
  onForward?: () => void;
}

/** Extract email address from "Name <email>" format */
const extractEmail = (s: string): { name: string; email?: string } => {
  const match = s.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || match[2], email: match[2] };
  if (s.includes('@')) return { name: s.split('@')[0], email: s };
  return { name: s };
};

/** Get initials for avatar */
const getInitials = (name: string): string => {
  const parts = name.replace(/[<>@]/g, '').trim().split(/[\s.]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
};

/** Avatar color from string hash */
const hashColor = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  const colors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01', '#46BDC6', '#7B61FF', '#E8710A'];
  return colors[Math.abs(h) % colors.length];
};

/**
 * Detect whether content is email-like by looking for common patterns.
 */
export const isEmailContent = (text: string, html: string, rawOCSF?: any): boolean => {
  // Check OCSF fields for email indicators
  if (rawOCSF) {
    const src = rawOCSF.metadata?.product?.name?.toLowerCase() || '';
    if (['gmail', 'outlook', 'microsoft 365', 'exchange', 'email', 'imap', 'smtp'].some(k => src.includes(k))) return true;
    // Check if labels/types include email
    const types = rawOCSF.types || rawOCSF.finding_info?.types || [];
    if (types.some((t: string) => /email|mail|phish/i.test(t))) return true;
  }

  const combined = (text + ' ' + html).substring(0, 3000); // only scan first part
  // Header patterns
  const headerPatterns = [
    /^From:\s*.+/mi,
    /^To:\s*.+/mi,
    /^Subject:\s*.+/mi,
    /^Date:\s*.+/mi,
    /^Sent:\s*.+/mi,
  ];
  const headerHits = headerPatterns.filter(p => p.test(combined)).length;
  if (headerHits >= 2) return true;

  // Forwarded / reply markers
  if (/-----\s*Original Message\s*-----/i.test(combined)) return true;
  if (/-----\s*Forwarded message\s*-----/i.test(combined)) return true;
  if (/On\s.+wrote:/i.test(combined)) return true;

  return false;
};

/**
 * Parse email content into individual messages in a thread.
 */
const parseEmailThread = (text: string, html: string): EmailMessage[] => {
  const messages: EmailMessage[] = [];

  // Try to split by common thread delimiters
  const delimiters = [
    /(?=-----\s*Original Message\s*-----)/gi,
    /(?=-----\s*Forwarded message\s*-----)/gi,
    /(?=On\s[^\n]{10,80}\swrote:\s*\n)/gi,
    /(?=From:\s[^\n]+\nSent:\s)/gi,
    /(?=From:\s[^\n]+\nDate:\s)/gi,
  ];

  let parts: string[] = [text];
  for (const delim of delimiters) {
    const newParts: string[] = [];
    for (const part of parts) {
      const splits = part.split(delim).filter(s => s.trim());
      newParts.push(...splits);
    }
    if (newParts.length > parts.length) {
      parts = newParts;
      break; // use first delimiter that produces splits
    }
  }

  // If no splits found, treat the whole thing as a single message
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    // Extract headers from this part
    const fromMatch = part.match(/^From:\s*(.+)/mi);
    const toMatch = part.match(/^To:\s*(.+)/mi);
    const ccMatch = part.match(/^Cc:\s*(.+)/mi);
    const subjectMatch = part.match(/^Subject:\s*(.+)/mi);
    const dateMatch = part.match(/^(?:Date|Sent):\s*(.+)/mi);
    const wroteMatch = part.match(/^On\s(.+?)\swrote:\s*$/mi);

    const from = fromMatch?.[1]?.trim() || (wroteMatch ? wroteMatch[1].replace(/,?\s*<[^>]+>$/, '').trim() : '');
    const date = dateMatch?.[1]?.trim() || '';

    // Extract body: remove the header block
    let body = part;
    // Remove header lines from top
    body = body.replace(/^(From|To|Cc|Bcc|Subject|Date|Sent|Reply-To):\s*.+\n?/gmi, '');
    body = body.replace(/^-----\s*(Original Message|Forwarded message)\s*-----\n?/gmi, '');
    body = body.replace(/^On\s.+wrote:\s*\n?/gmi, '');
    body = body.trim();

    messages.push({
      id: `email-${i}`,
      from: from || (i === 0 ? 'Sender' : `Message ${i + 1}`),
      fromEmail: fromMatch ? extractEmail(fromMatch[1].trim()).email : undefined,
      to: toMatch?.[1]?.trim(),
      cc: ccMatch?.[1]?.trim(),
      subject: subjectMatch?.[1]?.trim(),
      date,
      body,
      isLatest: i === 0,
    });
  }

  // If we got nothing, create a single message
  if (messages.length === 0) {
    messages.push({
      id: 'email-0',
      from: 'Sender',
      body: text,
      isLatest: true,
    });
  }

  return messages;
};

const EmailThreadPanel = ({ descriptionHtml, descriptionText, rawOCSF, onReply, onForward }: EmailThreadPanelProps) => {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');

  const messages = useMemo(
    () => parseEmailThread(descriptionText, descriptionHtml),
    [descriptionText, descriptionHtml],
  );

  // Thread subject from first message
  const threadSubject = useMemo(() => {
    for (const m of messages) {
      if (m.subject) return m.subject.replace(/^(Re|Fwd|Fw):\s*/gi, '').trim();
    }
    return rawOCSF?.title || '';
  }, [messages, rawOCSF]);

  // Latest message is always expanded, toggle older ones
  const toggleMessage = (id: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    const latestFrom = messages[0]?.fromEmail || messages[0]?.from || '';
    const subject = threadSubject ? `Re: ${threadSubject}` : '';
    onReply?.(latestFrom, subject, replyText);
    setReplyText('');
    setShowReplyBox(false);
  };

  if (messages.length === 0) return null;

  return (
    <Box sx={{
      border: '1px solid hsl(var(--border))',
      borderRadius: 1.5,
      bgcolor: 'hsl(var(--card))',
      overflow: 'hidden',
    }}>
      {/* Thread header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.25,
        borderBottom: '1px solid hsl(var(--border))',
        bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon sx={{ fontSize: 18, color: '#ff6600' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
            Email Thread
          </Typography>
          <Chip
            label={`${messages.length} message${messages.length !== 1 ? 's' : ''}`}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              bgcolor: '#ff6600',
              color: '#ffffff',
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {onReply && (
            <Tooltip title="Reply">
              <IconButton size="small" onClick={() => setShowReplyBox(!showReplyBox)} sx={{
                color: showReplyBox ? '#ff6600' : 'text.secondary',
                '&:hover': { color: '#ff6600' },
              }}>
                <ReplyIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {onForward && (
            <Tooltip title="Forward">
              <IconButton size="small" onClick={onForward} sx={{
                color: 'text.secondary',
                '&:hover': { color: '#ff6600' },
              }}>
                <ForwardIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Subject line */}
      {threadSubject && (
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid hsl(var(--border))' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {threadSubject}
          </Typography>
        </Box>
      )}

      {/* Messages */}
      <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
        {messages.map((msg, idx) => {
          const isExpanded = msg.isLatest || expandedMessages.has(msg.id);
          const { name, email } = extractEmail(msg.from);
          const avatarColor = hashColor(msg.from);

          return (
            <Box key={msg.id} sx={{
              borderBottom: idx < messages.length - 1 ? '1px solid hsl(var(--border))' : 'none',
            }}>
              {/* Message header - always visible */}
              <Box
                onClick={() => !msg.isLatest && toggleMessage(msg.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1,
                  cursor: msg.isLatest ? 'default' : 'pointer',
                  '&:hover': !msg.isLatest ? {
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  } : {},
                  transition: 'background-color 0.15s',
                }}
              >
                <Avatar sx={{
                  width: 32,
                  height: 32,
                  bgcolor: avatarColor,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  {getInitials(name)}
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="body2" sx={{
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {name}
                    </Typography>
                    {email && (
                      <Typography variant="caption" sx={{
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        &lt;{email}&gt;
                      </Typography>
                    )}
                    {msg.isLatest && (
                      <Chip label="Latest" size="small" sx={{
                        height: 16,
                        fontSize: '0.6rem',
                        bgcolor: 'rgba(34, 197, 94, 0.15)',
                        color: '#22c55e',
                        ml: 0.5,
                      }} />
                    )}
                  </Box>
                  {!isExpanded && (
                    <Typography variant="caption" sx={{
                      color: 'text.disabled',
                      fontSize: '0.7rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                      maxWidth: 400,
                    }}>
                      {msg.body.substring(0, 120)}…
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  {msg.date && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                      {msg.date}
                    </Typography>
                  )}
                  {!msg.isLatest && (
                    <IconButton size="small" sx={{ color: 'text.secondary' }}>
                      {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  )}
                </Box>
              </Box>

              {/* Message body - collapsible for older messages */}
              <Collapse in={isExpanded}>
                <Box sx={{ px: 2, pb: 1.5 }}>
                  {/* To / CC row */}
                  {(msg.to || msg.cc) && (
                    <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                      {msg.to && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          <strong>To:</strong> {msg.to}
                        </Typography>
                      )}
                      {msg.cc && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          <strong>Cc:</strong> {msg.cc}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {/* Body */}
                  <Box sx={{
                    pl: 5.5, // align with text after avatar
                  }}>
                    <Typography variant="body2" sx={{
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.82rem',
                      lineHeight: 1.7,
                      color: 'text.primary',
                      wordBreak: 'break-word',
                    }}>
                      {msg.body}
                    </Typography>
                  </Box>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* Reply box */}
      <Collapse in={showReplyBox}>
        <Box sx={{
          borderTop: '1px solid hsl(var(--border))',
          p: 2,
          bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ReplyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Reply to {messages[0]?.from || 'sender'}
            </Typography>
          </Box>
          <TextField
            multiline
            minRows={3}
            maxRows={8}
            fullWidth
            placeholder="Type your reply…"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            size="small"
            sx={{
              mb: 1,
              '& .MuiOutlinedInput-root': {
                fontSize: '0.82rem',
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => { setShowReplyBox(false); setReplyText(''); }}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SendIcon sx={{ fontSize: 14 }} />}
              onClick={handleReply}
              disabled={!replyText.trim()}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                bgcolor: '#ff6600',
                '&:hover': { bgcolor: '#e55a00' },
              }}
            >
              Send Reply
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default EmailThreadPanel;
