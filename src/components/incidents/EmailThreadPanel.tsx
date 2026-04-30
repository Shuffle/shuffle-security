/**
 * EmailThreadPanel — renders email threads extracted from incident descriptions.
 * Detects email content (From/To/Subject headers, forwarded chains, "On … wrote:" markers)
 * and displays them as a threaded conversation. Stays within OCSF class_uid 2005.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDemo, TOUR_STEPS } from '@/context/DemoContext';
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
  Stack,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ReplyIcon from '@mui/icons-material/Reply';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SendIcon from '@mui/icons-material/Send';
import ForwardIcon from '@mui/icons-material/Forward';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PersonIcon from '@mui/icons-material/Person';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DOMPurify from 'dompurify';

// Force every anchor in sanitized HTML to open in a new tab with safe rel.
// This protects middle-click / cmd-click paths that bypass our React
// onClick handler — without it, those would still navigate the current
// tab to whatever the email contained.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node && (node as Element).tagName === 'A') {
    const el = node as HTMLAnchorElement;
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer nofollow');
  }
});
import { resolveEmailThread, type ResolvedEmailThread } from '@/lib/emailThreadAdapters';
import { confirmExternalLinkClick } from '@/utils/safeExternalLinks';

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
  // Strongest signal: rawOCSF.unmapped_original parses cleanly as a known
  // email provider payload (Gmail / Outlook / generic envelope).
  if (rawOCSF && resolveEmailThread(rawOCSF)) return true;

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

/** Inline header-style row for To/Cc/Bcc inputs in the reply box. */
const RecipientRow = ({
  label,
  value,
  onChange,
  placeholder,
  onRemove,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onRemove?: () => void;
  autoFocus?: boolean;
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', px: 1.25, py: 0.25, gap: 1 }}>
    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', minWidth: 32 }}>
      {label}
    </Typography>
    <TextField
      variant="standard"
      fullWidth
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      InputProps={{ disableUnderline: true, sx: { fontSize: '0.78rem', py: 0.25 } }}
    />
    {onRemove && (
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: '#ff6600' } }}
      >
        <ExpandLessIcon sx={{ fontSize: 14, transform: 'rotate(45deg)' }} />
      </IconButton>
    )}
  </Box>
);

const EmailThreadPanel = ({ descriptionHtml, descriptionText, rawOCSF, onReply, onForward }: EmailThreadPanelProps) => {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  // Default the thread to collapsed — the Activity timeline is the primary
  // narrative on the incident page; users can expand the email when they
  // need to read it. This avoids the long forwarded chain pushing the
  // timeline below the fold on first open. Persisted in localStorage so
  // the user's chosen workflow (always-open vs always-collapsed) sticks
  // across navigation between incidents.
  const EMAIL_THREAD_OPEN_KEY = 'shuffle-incident-email-thread-open';
  const [threadCollapsed, setThreadCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(EMAIL_THREAD_OPEN_KEY);
      if (v === '1') return false; // stored "open" -> not collapsed
      if (v === '0') return true;
    } catch { /* ignore */ }
    return true;
  });
  const setThreadCollapsed: typeof setThreadCollapsedState = (value) => {
    setThreadCollapsedState((prev) => {
      const next = typeof value === 'function' ? (value as (p: boolean) => boolean)(prev) : value;
      try { localStorage.setItem(EMAIL_THREAD_OPEN_KEY, next ? '0' : '1'); } catch { /* ignore */ }
      return next;
    });
  };

  // Popout mode — like Gmail's "open in new window" button. When enabled the
  // entire panel is rendered into a draggable floating card via a React
  // portal, so the user can keep reading the email while they navigate
  // around the rest of the incident page.
  const [poppedOut, setPoppedOut] = useState(false);
  const POP_W = 720;
  const POP_H = 600;
  const [popPos, setPopPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(24, window.innerWidth - POP_W - 32) : 80,
    y: 96,
  }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dx: e.clientX - popPos.x, dy: e.clientY - popPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = ev.clientX - dragRef.current.dx;
      const ny = ev.clientY - dragRef.current.dy;
      // Keep within viewport
      const maxX = window.innerWidth - 80;
      const maxY = window.innerHeight - 60;
      setPopPos({
        x: Math.min(Math.max(-POP_W + 80, nx), maxX),
        y: Math.min(Math.max(0, ny), maxY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [popPos.x, popPos.y]);

  // Demo tour: keep the auto-collapse behaviour explicit so the spotlight on
  // step #5 lands on the timeline. Reset the one-shot guard between demo
  // sessions so a re-opened tour can collapse it again if the user expanded.
  const { drawerOpen: demoDrawerOpen, step: demoStep } = useDemo();
  const autoCollapsedRef = useRef(false);
  useEffect(() => {
    if (!demoDrawerOpen) {
      autoCollapsedRef.current = false;
      return;
    }
    const stepId = TOUR_STEPS[demoStep]?.id;
    if (stepId === 'incident-detail' && !autoCollapsedRef.current) {
      autoCollapsedRef.current = true;
      setThreadCollapsed(true);
    }
  }, [demoDrawerOpen, demoStep]);

  // Prefer the structured adapter (Gmail/Outlook/generic) when
  // rawOCSF.unmapped_original is available — it is far more reliable than
  // regex-parsing the description text. Fall back to the legacy parser
  // only when no provider payload is recognised.
  const resolved: ResolvedEmailThread | null = useMemo(
    () => resolveEmailThread(rawOCSF),
    [rawOCSF],
  );

  const messages = useMemo(
    () => resolved?.messages?.length
      ? resolved.messages
      : parseEmailThread(descriptionText, descriptionHtml),
    [resolved, descriptionText, descriptionHtml],
  );

  const sourceLabel = resolved?.source === 'gmail'
    ? 'Gmail'
    : resolved?.source === 'outlook'
      ? 'Outlook'
      : resolved?.source === 'generic'
        ? 'Email'
        : null;

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

  // Prefill To/Cc when the reply box is opened, derived from the latest
  // message: reply goes to the sender, Cc preserves any existing Cc recipients.
  useEffect(() => {
    if (!showReplyBox) return;
    const latest = messages[0];
    if (!latest) return;
    const defaultTo = latest.fromEmail || latest.from || '';
    setReplyTo(prev => prev || defaultTo);
    if (latest.cc && !replyCc) {
      setReplyCc(latest.cc);
      setShowCc(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReplyBox]);

  const handleReply = () => {
    if (!replyText.trim() || !replyTo.trim()) return;
    const subject = threadSubject ? `Re: ${threadSubject}` : '';
    // Encode Cc/Bcc into the body header so downstream consumers that only
    // accept (to, subject, body) still receive the routing info.
    const headerLines: string[] = [];
    if (replyCc.trim()) headerLines.push(`Cc: ${replyCc.trim()}`);
    if (replyBcc.trim()) headerLines.push(`Bcc: ${replyBcc.trim()}`);
    const body = headerLines.length ? `${headerLines.join('\n')}\n\n${replyText}` : replyText;
    onReply?.(replyTo.trim(), subject, body);
    setReplyText('');
    setReplyCc('');
    setReplyBcc('');
    setShowCc(false);
    setShowBcc(false);
    setShowReplyBox(false);
  };

  if (messages.length === 0) return null;

  const panel = (
    <Box
      data-tour="incident-email-thread"
      sx={{
      border: '1px solid hsl(var(--border))',
      borderRadius: 1.5,
      bgcolor: 'hsl(var(--card))',
      overflow: 'hidden',
      // When floating, fill the popout window and let inner regions scroll.
      ...(poppedOut ? { display: 'flex', flexDirection: 'column', height: '100%' } : {}),
    }}>
      {/* Thread header — click to collapse the whole panel */}
      <Box
        onClick={() => setThreadCollapsed(c => {
          const next = !c;
          // When the user expands the email thread (collapsed -> not
          // collapsed), broadcast it so the demo tour can tick off the
          // "open email thread" sub-goal on step #5.
          if (next === false) {
            try { window.dispatchEvent(new CustomEvent('demo:email-thread-opened')); } catch { /* ignore */ }
          }
          return next;
        })}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          borderBottom: threadCollapsed ? 'none' : '1px solid hsl(var(--border))',
          bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon sx={{ fontSize: 18, color: '#ff6600' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
            Email Thread
          </Typography>
          <Chip
            label={`${messages.length} message${messages.length !== 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              bgcolor: 'transparent',
              borderColor: 'rgba(255, 102, 0, 0.4)',
              color: '#ff6600',
            }}
          />
          {sourceLabel && (
            <Tooltip title={`Parsed from structured ${sourceLabel} payload (unmapped_original)`} arrow>
              <Chip
                label={sourceLabel}
                size="small"
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: 'transparent',
                  borderColor: 'hsl(var(--border))',
                  color: 'text.secondary',
                }}
              />
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
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
          <Tooltip title={poppedOut ? 'Dock back inline' : 'Open in popout window'}>
            <IconButton
              size="small"
              onClick={() => {
                setPoppedOut(p => !p);
                // Auto-expand when popping out — a collapsed popout window is useless.
                if (!poppedOut) setThreadCollapsed(false);
              }}
              sx={{
                color: poppedOut ? '#ff6600' : 'text.secondary',
                '&:hover': { color: '#ff6600' },
              }}
            >
              {poppedOut ? <CloseIcon sx={{ fontSize: 18 }} /> : <OpenInNewIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title={threadCollapsed ? 'Expand' : 'Collapse'}>
            <IconButton
              size="small"
              onClick={() => setThreadCollapsed(c => !c)}
              sx={{ color: 'text.secondary', '&:hover': { color: '#ff6600' } }}
            >
              {threadCollapsed ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ExpandLessIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Collapse in={!threadCollapsed}>

      {/* Subject line */}
      {threadSubject && (
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid hsl(var(--border))' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {threadSubject}
          </Typography>
        </Box>
      )}

      {/* Messages */}
      <Box sx={{ maxHeight: poppedOut ? 'none' : 500, flex: poppedOut ? 1 : 'unset', overflow: 'auto' }}>
        {messages.map((msg, idx) => {
          // Latest defaults to expanded but is now collapsible too — toggling
          // collapses it; older messages start collapsed and toggle open.
          const isExpanded = msg.isLatest ? !expandedMessages.has(msg.id) : expandedMessages.has(msg.id);
          const { name, email } = extractEmail(msg.from);
          const avatarColor = hashColor(msg.from);

          return (
            <Box key={msg.id} sx={{
              borderBottom: idx < messages.length - 1 ? '1px solid hsl(var(--border))' : 'none',
            }}>
              {/* Message header - always visible, click to toggle */}
              <Box
                onClick={() => toggleMessage(msg.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  },
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
                  <IconButton size="small" sx={{ color: 'text.secondary' }}>
                    {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
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
                  {/* Body — render sanitized HTML when available, otherwise plain text */}
                  <Box sx={{
                    pl: 5.5, // align with text after avatar
                  }}>
                    {msg.bodyHtml ? (
                      // Render the provider HTML inside its own white "page"
                      // so it looks like a real email client and provider
                      // colors (dark text, brand accents) read correctly.
                      // We do NOT try to recolor the email to match our dark
                      // theme — that turned everything orange/illegible.
                      <Box
                        sx={{
                          backgroundColor: '#ffffff',
                          color: '#1f1f1f',
                          // Always-visible border so the white "page" reads
                          // as a card in BOTH dark and light mode (in light
                          // mode, white-on-white had no edge).
                          border: '1px solid #d0d7de',
                          borderRadius: 1,
                          p: 2,
                          fontSize: '0.82rem',
                          lineHeight: 1.7,
                          wordBreak: 'break-word',
                          boxShadow: (t) => t.palette.mode === 'dark'
                            ? '0 1px 2px rgba(0,0,0,0.4)'
                            : '0 1px 2px rgba(0,0,0,0.06)',
                          '& a': { color: '#1a73e8', cursor: 'pointer' },
                          '& img': { maxWidth: '100%', height: 'auto' },
                          '& blockquote': {
                            borderLeft: '3px solid #e0e0e0',
                            pl: 1.5,
                            ml: 0,
                            color: '#5f6368',
                          },
                        }}
                        // Intercept ALL link clicks inside the foreign HTML:
                        // confirm with the user, then open in a new window
                        // with noopener/noreferrer. Provider HTML often wraps
                        // huge blocks (e.g. a whole notification card) in a
                        // single <a>, so we cannot trust them to navigate.
                        onClick={confirmExternalLinkClick}
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(msg.bodyHtml, {
                            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
                            FORBID_ATTR: ['onerror', 'onload', 'onclick'],
                            // Force every anchor to open in a new tab with
                            // safe rel attributes; our click handler also
                            // enforces this, but belt-and-suspenders for
                            // middle-click / cmd-click which bypass onClick.
                            ADD_ATTR: ['target', 'rel'],
                          }),
                        }}
                      />
                    ) : (
                      <Typography variant="body2" sx={{
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.82rem',
                        lineHeight: 1.7,
                        color: 'text.primary',
                        wordBreak: 'break-word',
                      }}>
                        {msg.body}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
      </Collapse>

      {/* Reply box */}
      <Collapse in={showReplyBox}>
        <Box sx={{
          borderTop: '1px solid hsl(var(--border))',
          p: 2,
          bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReplyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Reply to {messages[0]?.from || 'sender'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {!showCc && (
                <Button
                  size="small"
                  onClick={() => setShowCc(true)}
                  sx={{ fontSize: '0.7rem', textTransform: 'none', minWidth: 0, px: 0.75, py: 0, color: 'text.secondary', '&:hover': { color: '#ff6600', bgcolor: 'transparent' } }}
                >
                  + Cc
                </Button>
              )}
              {!showBcc && (
                <Button
                  size="small"
                  onClick={() => setShowBcc(true)}
                  sx={{ fontSize: '0.7rem', textTransform: 'none', minWidth: 0, px: 0.75, py: 0, color: 'text.secondary', '&:hover': { color: '#ff6600', bgcolor: 'transparent' } }}
                >
                  + Bcc
                </Button>
              )}
            </Box>
          </Box>

          {/* Recipient header rows — make it explicit who the reply is going to */}
          <Stack spacing={0} sx={{
            mb: 1,
            border: '1px solid hsl(var(--border))',
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
          }}>
            <RecipientRow
              label="To"
              value={replyTo}
              onChange={setReplyTo}
              placeholder="recipient@example.com"
              autoFocus
            />
            {showCc && (
              <>
                <Divider sx={{ borderColor: 'hsl(var(--border))' }} />
                <RecipientRow
                  label="Cc"
                  value={replyCc}
                  onChange={setReplyCc}
                  placeholder="cc@example.com"
                  onRemove={() => { setShowCc(false); setReplyCc(''); }}
                />
              </>
            )}
            {showBcc && (
              <>
                <Divider sx={{ borderColor: 'hsl(var(--border))' }} />
                <RecipientRow
                  label="Bcc"
                  value={replyBcc}
                  onChange={setReplyBcc}
                  placeholder="bcc@example.com"
                  onRemove={() => { setShowBcc(false); setReplyBcc(''); }}
                />
              </>
            )}
            <Divider sx={{ borderColor: 'hsl(var(--border))' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.25, py: 0.5, gap: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', minWidth: 32 }}>
                Subject
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {threadSubject ? `Re: ${threadSubject}` : '(no subject)'}
              </Typography>
            </Box>
          </Stack>

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
              onClick={() => {
                setShowReplyBox(false);
                setReplyText('');
                setReplyCc('');
                setReplyBcc('');
                setShowCc(false);
                setShowBcc(false);
              }}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SendIcon sx={{ fontSize: 14 }} />}
              onClick={handleReply}
              disabled={!replyText.trim() || !replyTo.trim()}
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

  if (!poppedOut) return panel;

  // Popped out: render an inline placeholder so the user can see where the
  // thread "lives", and the real panel as a draggable floating window via
  // a portal. The portal target is document.body so the window sits above
  // every other dashboard surface and survives section scroll.
  return (
    <>
      <Box
        sx={{
          border: '1px dashed hsl(var(--border))',
          borderRadius: 1.5,
          bgcolor: 'transparent',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
          <EmailIcon sx={{ fontSize: 16, color: '#ff6600' }} />
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            Email thread opened in popout window
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={() => setPoppedOut(false)}
          sx={{
            fontSize: '0.7rem',
            textTransform: 'none',
            color: '#ff6600',
            '&:hover': { bgcolor: 'transparent', color: '#e55a00' },
          }}
        >
          Dock back inline
        </Button>
      </Box>
      {typeof document !== 'undefined' && createPortal(
        <Box
          sx={{
            position: 'fixed',
            top: popPos.y,
            left: popPos.x,
            width: POP_W,
            height: POP_H,
            zIndex: 1400,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 1.5,
            boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Drag handle bar */}
          <Box
            onMouseDown={onDragStart}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              cursor: 'move',
              userSelect: 'none',
              borderBottom: '1px solid hsl(var(--border))',
              bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', flex: 1 }}>
              {threadSubject || 'Email thread'} — drag to move
            </Typography>
            <Tooltip title="Dock back inline">
              <IconButton size="small" onClick={() => setPoppedOut(false)} sx={{ color: 'text.secondary', '&:hover': { color: '#ff6600' } }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {panel}
          </Box>
        </Box>,
        document.body,
      )}
    </>
  );
};

export default EmailThreadPanel;
