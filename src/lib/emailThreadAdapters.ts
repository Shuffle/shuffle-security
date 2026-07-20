/**
 * emailThreadAdapters — converts raw provider payloads stored in
 * `rawOCSF.unmapped_original` into the EmailMessage[] shape that
 * EmailThreadPanel renders.
 *
 * Why this exists: the OCSF translation collapses email threads into a
 * single `description` field, which forces fragile RFC 2822 regex parsing
 * (locale-dependent, breaks on mobile clients, loses attachments). The raw
 * provider payload kept in `unmapped_original` has the full structured
 * thread — we should always prefer that.
 *
 * Detection priority (see resolveEmailThread):
 *   1. Gmail   — `messages: [{ payload: { headers, parts } }]`
 *   2. Outlook — `value: [{ from, toRecipients, body, ... }]` (Graph API)
 *   3. IMAP / single-message envelopes
 *   4. null    → caller falls back to regex parser on description text
 */

import type { EmailMessage } from '@/components/incidents/EmailThreadPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect draft state from Gmail labelIds (case-insensitive). */
const gmailIsDraft = (labelIds: unknown): boolean => {
  if (!Array.isArray(labelIds)) return false;
  return labelIds.some(l => typeof l === 'string' && l.toUpperCase() === 'DRAFT');
};

/**
 * Pick the newest non-draft message as `isLatest`. Drafts should never be
 * treated as the source of truth for the thread. If every message is a
 * draft, fall back to the first (newest overall) so the UI still has a
 * message expanded by default.
 */
const assignLatest = (messages: EmailMessage[]): EmailMessage[] => {
  if (messages.length === 0) return messages;
  let latestIdx = messages.findIndex(m => !m.isDraft);
  if (latestIdx === -1) latestIdx = 0;
  return messages.map((m, i) => ({ ...m, isLatest: i === latestIdx }));
};



/** Decode a base64url string (Gmail uses url-safe base64 for body data). */
const decodeBase64Url = (input: string): string => {
  if (!input) return '';
  try {
    // Convert base64url -> base64
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    // Pad
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    if (typeof atob === 'function') {
      // atob returns binary string — decode UTF-8 properly
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }
    return '';
  } catch {
    return '';
  }
};

/** Strip an HTML body to plain text (preserves line breaks). */
const htmlToText = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const getHeader = (headers: Array<{ name?: string; value?: string }> | undefined, name: string): string => {
  if (!Array.isArray(headers)) return '';
  const lower = name.toLowerCase();
  const h = headers.find(x => (x?.name || '').toLowerCase() === lower);
  return h?.value || '';
};

// ---------------------------------------------------------------------------
// Gmail adapter — handles `users/threads/get` and `users/messages/get` shapes
// ---------------------------------------------------------------------------

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
  headers?: Array<{ name?: string; value?: string }>;
}

interface GmailMessage {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
  isDraft?: boolean;
}


/** Walk Gmail MIME tree and collect first text/plain and text/html bodies. */
const extractGmailBodies = (part: GmailPart | undefined): { text: string; html: string } => {
  let text = '';
  let html = '';
  const walk = (p: GmailPart | undefined) => {
    if (!p) return;
    const mime = (p.mimeType || '').toLowerCase();
    const data = p.body?.data;
    if (data) {
      const decoded = decodeBase64Url(data);
      if (mime === 'text/plain' && !text) text = decoded;
      else if (mime === 'text/html' && !html) html = decoded;
    }
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  };
  walk(part);
  if (!text && html) text = htmlToText(html);
  return { text, html };
};

const isGmailPayload = (raw: any): boolean => {
  if (!raw || typeof raw !== 'object') return false;
  // Thread response: { messages: [{ payload: {...} }] }
  if (Array.isArray(raw.messages) && raw.messages.length > 0) {
    const first = raw.messages[0];
    if (first?.payload?.headers || first?.payload?.parts || first?.payload?.body) return true;
  }
  // Single message response: { payload: {...}, threadId, ... }
  if (raw.payload && (raw.payload.headers || raw.payload.parts || raw.payload.body) && raw.id) return true;
  return false;
};

const gmailMessageToEmail = (msg: GmailMessage, idx: number, total: number, forceDraft?: boolean): EmailMessage => {
  const headers = msg.payload?.headers;
  const from = getHeader(headers, 'From');
  const to = getHeader(headers, 'To');
  const cc = getHeader(headers, 'Cc');
  const subject = getHeader(headers, 'Subject');
  const date = getHeader(headers, 'Date');
  const { text, html } = extractGmailBodies(msg.payload);
  const fromMatch = from.match(/^(.*?)\s*<([^>]+)>\s*$/);
  const isDraft = forceDraft || gmailIsDraft(msg.labelIds) || msg.isDraft === true;
  return {
    id: msg.id || `gmail-${idx}`,
    from: fromMatch ? (fromMatch[1].trim() || fromMatch[2]) : (from || `Message ${idx + 1}`),
    fromEmail: fromMatch ? fromMatch[2] : (from.includes('@') ? from : undefined),
    to: to || undefined,
    cc: cc || undefined,
    subject: subject || undefined,
    date: date || (msg.internalDate ? new Date(parseInt(msg.internalDate, 10)).toUTCString() : undefined),
    body: text || msg.snippet || '',
    bodyHtml: html || undefined,
    isDraft,
  };
};

const gmailToEmailThread = (raw: any, forceDraft?: boolean): EmailMessage[] => {
  const rawMessages: GmailMessage[] = Array.isArray(raw?.messages) ? raw.messages : [raw];
  // Gmail returns oldest-first in threads.get — we want newest-first.
  const sorted = [...rawMessages].sort((a, b) => {
    const ta = parseInt(a.internalDate || '0', 10);
    const tb = parseInt(b.internalDate || '0', 10);
    return tb - ta;
  });
  return assignLatest(sorted.map((m, i) => gmailMessageToEmail(m, i, sorted.length, forceDraft)));
};


// ---------------------------------------------------------------------------
// Outlook / Microsoft Graph adapter
// ---------------------------------------------------------------------------

interface OutlookRecipient { emailAddress?: { name?: string; address?: string } }
interface OutlookMessage {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  from?: OutlookRecipient;
  sender?: OutlookRecipient;
  toRecipients?: OutlookRecipient[];
  ccRecipients?: OutlookRecipient[];
  body?: { contentType?: string; content?: string };
  conversationId?: string;
  internetMessageId?: string;
  isDraft?: boolean;
  parentFolderId?: string;
}


const isOutlookPayload = (raw: any): boolean => {
  if (!raw || typeof raw !== 'object') return false;
  // Graph collection: { value: [{ from, toRecipients, body }] }
  if (Array.isArray(raw.value) && raw.value.length > 0) {
    const first = raw.value[0];
    if (first?.from?.emailAddress || first?.toRecipients || first?.body?.content) return true;
  }
  // Single Graph message
  if ((raw.from?.emailAddress || raw.sender?.emailAddress) && raw.body?.content) return true;
  return false;
};

const formatRecipients = (recipients?: OutlookRecipient[]): string => {
  if (!Array.isArray(recipients)) return '';
  return recipients
    .map(r => {
      const name = r.emailAddress?.name;
      const addr = r.emailAddress?.address;
      if (name && addr && name !== addr) return `${name} <${addr}>`;
      return addr || name || '';
    })
    .filter(Boolean)
    .join(', ');
};

const outlookMessageToEmail = (msg: OutlookMessage, idx: number): EmailMessage => {
  const fromAddr = msg.from?.emailAddress || msg.sender?.emailAddress;
  const fromName = fromAddr?.name || fromAddr?.address || `Message ${idx + 1}`;
  const isHtml = (msg.body?.contentType || '').toLowerCase() === 'html';
  const html = isHtml ? (msg.body?.content || '') : '';
  const text = isHtml ? htmlToText(msg.body?.content || '') : (msg.body?.content || '');
  return {
    id: msg.id || msg.internetMessageId || `outlook-${idx}`,
    from: fromName,
    fromEmail: fromAddr?.address,
    to: formatRecipients(msg.toRecipients) || undefined,
    cc: formatRecipients(msg.ccRecipients) || undefined,
    subject: msg.subject || undefined,
    date: msg.receivedDateTime || msg.sentDateTime || undefined,
    body: text || msg.bodyPreview || '',
    bodyHtml: html || undefined,
    isLatest: idx === 0,
  };
};

const outlookToEmailThread = (raw: any): EmailMessage[] => {
  const rawMessages: OutlookMessage[] = Array.isArray(raw?.value) ? raw.value : [raw];
  // Sort newest first by receivedDateTime
  const sorted = [...rawMessages].sort((a, b) => {
    const ta = new Date(a.receivedDateTime || a.sentDateTime || 0).getTime();
    const tb = new Date(b.receivedDateTime || b.sentDateTime || 0).getTime();
    return tb - ta;
  });
  return sorted.map((m, i) => outlookMessageToEmail(m, i));
};

// ---------------------------------------------------------------------------
// Generic single-message envelope (covers IMAP/SMTP forwarders that just
// dump one structured email object into unmapped_original).
// Recognised shape (lenient): { from, to, subject, body|text|html }
// ---------------------------------------------------------------------------

const isGenericEmailEnvelope = (raw: any): boolean => {
  if (!raw || typeof raw !== 'object') return false;
  const hasFrom = !!(raw.from || raw.sender || raw.From);
  const hasBody = !!(raw.body || raw.text || raw.html || raw.Body || raw.HtmlBody || raw.TextBody);
  const hasSubjectish = !!(raw.subject || raw.Subject);
  return hasFrom && hasBody && hasSubjectish;
};

const genericToEmailThread = (raw: any): EmailMessage[] => {
  const fromRaw = raw.from || raw.sender || raw.From || '';
  const fromStr = typeof fromRaw === 'string' ? fromRaw : (fromRaw?.address || fromRaw?.email || JSON.stringify(fromRaw));
  const fromMatch = fromStr.match(/^(.*?)\s*<([^>]+)>\s*$/);
  const html = raw.html || raw.HtmlBody || (raw.body?.html) || '';
  const text = raw.text || raw.TextBody || raw.body || (typeof raw.Body === 'string' ? raw.Body : '') || htmlToText(html);
  return [{
    id: raw.id || raw.messageId || raw['Message-ID'] || 'generic-0',
    from: fromMatch ? (fromMatch[1].trim() || fromMatch[2]) : (fromStr || 'Sender'),
    fromEmail: fromMatch ? fromMatch[2] : (fromStr.includes('@') ? fromStr : undefined),
    to: raw.to || raw.To || undefined,
    cc: raw.cc || raw.Cc || undefined,
    subject: raw.subject || raw.Subject || undefined,
    date: raw.date || raw.Date || raw.receivedDateTime || undefined,
    body: typeof text === 'string' ? text : '',
    bodyHtml: typeof html === 'string' && html ? html : undefined,
    isLatest: true,
  }];
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ResolvedEmailThread {
  messages: EmailMessage[];
  /** Which adapter produced the messages — useful for source chips / debugging. */
  source: 'gmail' | 'outlook' | 'generic';
}

/**
 * Try to resolve a structured email thread from rawOCSF.unmapped_original.
 * Returns null when no adapter matches — caller should then fall back to the
 * legacy description-text regex parser inside EmailThreadPanel.
 */
export const resolveEmailThread = (rawOCSF: any): ResolvedEmailThread | null => {
  const unmapped = rawOCSF?.unmapped_original;
  if (!unmapped || typeof unmapped !== 'object') return null;

  // Some pipelines wrap the provider payload one level deeper.
  const candidates = [unmapped, unmapped.message, unmapped.email, unmapped.data, unmapped.payload].filter(Boolean);

  for (const candidate of candidates) {
    if (isGmailPayload(candidate)) {
      const msgs = gmailToEmailThread(candidate);
      if (msgs.length > 0) return { messages: msgs, source: 'gmail' };
    }
    if (isOutlookPayload(candidate)) {
      const msgs = outlookToEmailThread(candidate);
      if (msgs.length > 0) return { messages: msgs, source: 'outlook' };
    }
    if (isGenericEmailEnvelope(candidate)) {
      const msgs = genericToEmailThread(candidate);
      if (msgs.length > 0) return { messages: msgs, source: 'generic' };
    }
  }
  return null;
};
