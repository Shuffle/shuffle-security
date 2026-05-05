/**
 * AppDetailDrawer — Shows app detail content (header, auth, MCP chat, API viewer)
 * inside a drawer. Used from alluvial diagrams and the app search drawer.
 *
 * Accepts either an app name (fetches data) or pre-loaded app info.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Download, Forward } from 'lucide-react';
import { getDatastoreByCategory, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Skeleton,
  Button,
  Divider,
  Drawer,
  Autocomplete,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AppAuthCard } from '@/Shuffle-MCPs/AppAuthConfig';
import AppMcpChat from '@/Shuffle-MCPs/AppMcpChat';
import ApiCallViewer from '@/Shuffle-MCPs/ApiCallViewer';
import type { AlgoliaSearchApp } from './shuffle-mcp.helpers';
import { useAppAuth } from '@/Shuffle-MCPs/useAppAuth';
import { API_CONFIG, getApiUrl, getAuthHeader, getTrackedOrgId } from '@/Shuffle-MCPs/api';
// AuthContext detached — consumers can pass `isAuthenticated` as a prop. Defaults to true.

interface AppInfo {
  name: string;
  description: string;
  large_image?: string;
  categories?: string[];
  authentication?: {
    type?: string;
    parameters?: { id: string; name: string; description: string; example: string; required: boolean }[];
  };
}

/** Collapsible markdown description */
const CollapsibleDescription = ({ description }: { description: string }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box
      onClick={() => setExpanded(prev => !prev)}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        ...(!expanded && {
          maxHeight: '5em',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 32,
            background: 'linear-gradient(transparent, hsl(var(--card)))',
            pointerEvents: 'none',
          },
        }),
        '& p': { fontSize: '0.78rem', lineHeight: 1.5, color: 'hsl(var(--muted-foreground))', m: 0, '&:not(:last-child)': { mb: 1 } },
        '& a': { color: 'hsl(var(--primary))', textDecoration: 'underline' },
        '& code': { fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", bgcolor: 'hsl(var(--muted))', px: 0.5, borderRadius: 0.5 },
        '& ul, & ol': { pl: 2, fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
      {!expanded && (
        <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--primary))', mt: 0.5, fontWeight: 500 }}>Show more…</Typography>
      )}
    </Box>
  );
};

/**
 * Singul standard actions catalog, keyed by lowercase category fragment.
 * Mirrors the canonical action names exposed by https://singul.io —
 * each name becomes the `{action}` segment in `POST /api/{action}`.
 * Fields shown here are starter parameters; the full schema lives on
 * the Singul side and is editable in the curl preview below.
 */
interface SingulAction {
  name: string;
  fields: { name: string; value: string }[];
}

const SINGUL_ACTIONS: Record<string, SingulAction[]> = {
  'threat': [
    { name: 'get_ioc', fields: [{ name: 'value', value: '1.2.3.4' }] },
    { name: 'search_indicator', fields: [{ name: 'query', value: 'malicious.com' }] },
    { name: 'enrich_hash', fields: [{ name: 'hash', value: 'd41d8cd98f00b204e9800998ecf8427e' }] },
  ],
  'intel': [
    { name: 'get_ioc', fields: [{ name: 'value', value: '1.2.3.4' }] },
    { name: 'search_indicator', fields: [{ name: 'query', value: 'malicious.com' }] },
  ],
  'siem': [
    { name: 'search', fields: [{ name: 'query', value: 'event.type:login' }, { name: 'time_range', value: '24h' }] },
    { name: 'list_alerts', fields: [{ name: 'severity', value: 'high' }] },
    { name: 'close_alert', fields: [{ name: 'alert_id', value: '' }] },
  ],
  'email': [
    { name: 'list_emails', fields: [{ name: 'folder', value: 'INBOX' }, { name: 'limit', value: '10' }] },
    { name: 'send_email', fields: [{ name: 'to', value: 'user@example.com' }, { name: 'subject', value: 'Hello' }, { name: 'body', value: 'Test message' }] },
    { name: 'get_attachments', fields: [{ name: 'message_id', value: '' }] },
  ],
  'communication': [
    { name: 'send_message', fields: [{ name: 'channel', value: '#general' }, { name: 'message', value: 'Hello from Singul' }] },
    { name: 'list_channels', fields: [] },
    { name: 'create_channel', fields: [{ name: 'name', value: 'incident-response' }] },
    { name: 'get_user', fields: [{ name: 'user_id', value: '' }] },
  ],
  'edr': [
    { name: 'list_detections', fields: [{ name: 'severity', value: 'high' }] },
    { name: 'isolate_host', fields: [{ name: 'host_id', value: '' }] },
    { name: 'list_processes', fields: [{ name: 'host_id', value: '' }] },
    { name: 'run_script', fields: [{ name: 'host_id', value: '' }, { name: 'script', value: 'whoami' }] },
  ],
  'endpoint': [
    { name: 'list_detections', fields: [{ name: 'severity', value: 'high' }] },
    { name: 'isolate_host', fields: [{ name: 'host_id', value: '' }] },
  ],
  'cloud': [
    { name: 'list_instances', fields: [{ name: 'region', value: 'us-east-1' }] },
    { name: 'list_buckets', fields: [] },
    { name: 'get_logs', fields: [{ name: 'resource', value: '' }] },
  ],
  'ticket': [
    { name: 'create_ticket', fields: [{ name: 'title', value: 'New incident' }, { name: 'description', value: '' }, { name: 'priority', value: 'medium' }] },
    { name: 'list_tickets', fields: [{ name: 'status', value: 'open' }] },
    { name: 'update_ticket', fields: [{ name: 'ticket_id', value: '' }, { name: 'status', value: 'in_progress' }] },
    { name: 'close_ticket', fields: [{ name: 'ticket_id', value: '' }] },
  ],
  'itsm': [
    { name: 'create_ticket', fields: [{ name: 'title', value: 'New incident' }, { name: 'priority', value: 'medium' }] },
    { name: 'list_tickets', fields: [{ name: 'status', value: 'open' }] },
  ],
  'case': [
    { name: 'create_case', fields: [{ name: 'title', value: 'New case' }, { name: 'severity', value: 'medium' }] },
    { name: 'list_cases', fields: [{ name: 'status', value: 'open' }] },
    { name: 'close_case', fields: [{ name: 'case_id', value: '' }] },
  ],
  'vulnerab': [
    { name: 'list_vulnerabilities', fields: [{ name: 'severity', value: 'critical' }] },
    { name: 'scan_asset', fields: [{ name: 'asset_id', value: '' }] },
    { name: 'get_cve', fields: [{ name: 'cve_id', value: 'CVE-2024-0001' }] },
  ],
  'network': [
    { name: 'list_rules', fields: [] },
    { name: 'block_ip', fields: [{ name: 'ip', value: '1.2.3.4' }] },
    { name: 'create_rule', fields: [{ name: 'name', value: 'block-bad-ip' }, { name: 'action', value: 'deny' }] },
  ],
  'identity': [
    { name: 'list_users', fields: [] },
    { name: 'disable_user', fields: [{ name: 'user_id', value: '' }] },
    { name: 'reset_password', fields: [{ name: 'user_id', value: '' }] },
  ],
};

function getSingulActions(categories?: string[]): SingulAction[] {
  if (!categories || categories.length === 0) return [];
  const matched: SingulAction[] = [];
  const seen = new Set<string>();
  for (const cat of categories) {
    const normalized = cat.toLowerCase();
    for (const [key, actions] of Object.entries(SINGUL_ACTIONS)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        for (const a of actions) {
          if (!seen.has(a.name)) {
            seen.add(a.name);
            matched.push(a);
          }
        }
      }
    }
  }
  return matched.slice(0, 8);
}

function buildSingulCurl(
  appName: string,
  action: SingulAction | null,
  opts?: { apiKey?: string | null; orgId?: string | null },
): string {
  const act = action?.name || '{action}';
  const body = {
    app: appName || '<appname>',
    fields: action?.fields.length ? action.fields : [{ name: 'field1', value: 'value1' }],
  };
  const token = opts?.apiKey || 'YOUR_TOKEN';
  const orgLine = opts?.orgId ? `\n  -H "Org-Id: ${opts.orgId}" \\` : '';
  return `curl -X POST https://singul.io/api/${act} \\
  -H "Authorization: Bearer ${token}" \\${orgLine}
  -d '${JSON.stringify(body, null, 2)}'`;
}

function buildSingulPython(
  appName: string,
  action: SingulAction | null,
): string {
  const act = action?.name || 'send_message';
  const app = appName || '<appname>';
  const fields = action?.fields.length ? action.fields : [];
  const fieldsStr = JSON.stringify(fields);
  return `import shufflepy

response = shufflepy.run("${app}", action="${act}", fields=${fieldsStr})

print(response)`;
}

type SnippetLang = 'curl' | 'python';

const SingulActionsPreview = ({
  appName,
  categories,
  activeOrgId,
}: {
  appName: string;
  categories?: string[];
  activeOrgId?: string | null;
}) => {
  const actions = useMemo(() => getSingulActions(categories), [categories]);
  const isDisabled = actions.length === 0;
  const [selected, setSelected] = useState<SingulAction | null>(null);
  const [lang, setLang] = useState<SnippetLang>('curl');
  const [snippet, setSnippet] = useState<string>('');

  const curlOpts = useMemo(() => {
    const apiKey = API_CONFIG.apiKey;
    const trackedOrg = getTrackedOrgId();
    const orgId = trackedOrg && activeOrgId && trackedOrg !== activeOrgId ? trackedOrg : null;
    return { apiKey, orgId };
  }, [activeOrgId]);

  const buildSnippet = useCallback(
    (action: SingulAction | null, l: SnippetLang) =>
      l === 'python' ? buildSingulPython(appName, action) : buildSingulCurl(appName, action, curlOpts),
    [appName, curlOpts],
  );

  useEffect(() => {
    const initial = actions[0] || null;
    setSelected(initial);
    setSnippet(buildSnippet(initial, lang));
  }, [appName, actions, curlOpts, lang, buildSnippet]);

  const handleSelect = (action: SingulAction | null) => {
    setSelected(action);
    setSnippet(buildSnippet(action, lang));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success('Copied snippet');
    } catch {
      toast.error('Copy failed');
    }
  };

  const [playLoading, setPlayLoading] = useState(false);
  const [playResult, setPlayResult] = useState<string | null>(null);

  const handlePlay = async () => {
    if (!snippet || playLoading) return;
    setPlayLoading(true);
    setPlayResult(null);
    try {
      const body = lang === 'python'
        ? {
            name: 'execute_python',
            app_id: '3e2bdf9d5069fe3f4746c29d68785a6a',
            environment: 'Cloud',
            parameters: [{ name: 'code', value: snippet, schema: { type: 'string' } }],
            app_name: 'Shuffle Tools',
            app_version: '1.2.0',
          }
        : {
            name: 'curl',
            app_id: 'ebfe7d5c80000676588f86731db0a555',
            environment: 'Cloud',
            parameters: [{ name: 'statement', value: snippet, schema: { type: 'string' } }],
            app_name: 'http',
            app_version: '1.4.0',
          };
      const path = lang === 'python' ? '/api/v1/apps/3e2bdf9d5069fe3f4746c29d68785a6a/run' : '/api/v1/apps/http/run';
      const res = await fetch(getApiUrl(path), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      let output = data?.result;
      if (typeof output === 'string') {
        try { output = JSON.stringify(JSON.parse(output), null, 2); } catch {}
      } else if (output != null) {
        output = JSON.stringify(output, null, 2);
      } else {
        output = JSON.stringify(data, null, 2);
      }
      setPlayResult(output);
      const parsed = (() => { try { return JSON.parse(data?.result || '{}'); } catch { return null; } })();
      if (parsed?.success === false) {
        toast.error(parsed.reason || 'Run failed');
      } else {
        toast.success(`Ran ${selected?.name || lang}`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Run failed';
      setPlayResult(msg);
      toast.error(msg);
    } finally {
      setPlayLoading(false);
    }
  };

  const lineCount = useMemo(() => Math.max(snippet.split('\n').length, 1), [snippet]);

  return (
    <Box sx={{ mb: 3, opacity: isDisabled ? 0.55 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '0.95rem' }}>
          Try individual actions
        </Typography>
        <Chip
          label="Preview"
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
        />
      </Box>

      <Box
        sx={{
          position: 'relative',
          p: 2,
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          background: 'linear-gradient(180deg, hsl(var(--muted) / 0.35) 0%, hsl(var(--background) / 0.6) 100%)',
          pointerEvents: isDisabled ? 'none' : 'auto',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: -1,
            borderRadius: 2,
            padding: '1px',
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.35), transparent 40%, hsl(var(--primary) / 0.15))',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
          },
        }}
      >
        {isDisabled ? (
          <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic', textAlign: 'center', py: 1 }}>
            No category detected for this app
          </Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
              <Autocomplete
                size="small"
                disableClearable
                options={actions}
                value={selected ?? actions[0]}
                onChange={(_, v) => v && handleSelect(v as SingulAction)}
                getOptionLabel={(o: SingulAction | null) => o?.name ?? ''}
                isOptionEqualToValue={(a, b) => a?.name === b?.name}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'hsl(var(--card))',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.75rem',
                    color: 'hsl(var(--foreground))',
                    '& fieldset': { borderColor: 'hsl(var(--border))' },
                    '&:hover fieldset': { borderColor: 'hsl(var(--primary))' },
                    '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                  },
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Select action" />
                )}
              />
              <ToggleButtonGroup
                size="small"
                exclusive
                value={lang}
                onChange={(_, v) => v && setLang(v)}
                sx={{
                  '& .MuiToggleButton-root': {
                    height: 36,
                    px: 1.5,
                    fontSize: '0.7rem',
                    textTransform: 'none',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'hsl(var(--muted-foreground))',
                    border: '1px solid hsl(var(--border))',
                    '&.Mui-selected': {
                      backgroundColor: 'hsl(var(--primary) / 0.15)',
                      color: 'hsl(var(--primary))',
                      borderColor: 'hsl(var(--primary))',
                      '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.2)' },
                    },
                  },
                }}
              >
                <ToggleButton value="curl">curl</ToggleButton>
                <ToggleButton value="python">python</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Code card */}
            <Box
              sx={{
                position: 'relative',
                borderRadius: 1.5,
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--background))',
                overflow: 'hidden',
                boxShadow: '0 8px 24px -12px hsl(var(--primary) / 0.25)',
              }}
            >
              {/* Header bar */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.25,
                  py: 0.75,
                  borderBottom: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--muted) / 0.4)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ display: 'flex', gap: 0.4 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'hsl(0 70% 60% / 0.6)' }} />
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'hsl(40 80% 60% / 0.6)' }} />
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'hsl(140 60% 55% / 0.6)' }} />
                  </Box>
                  <Typography
                    sx={{
                      ml: 1,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.65rem',
                      color: 'hsl(var(--muted-foreground))',
                      letterSpacing: 0.4,
                    }}
                  >
                    {lang === 'python' ? 'singul.py' : 'request.sh'}
                    {selected ? ` · ${selected.name}` : ''}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  <Button
                    size="small"
                    onClick={handleCopy}
                    sx={{
                      height: 26,
                      minWidth: 0,
                      px: 1.25,
                      fontSize: '0.65rem',
                      textTransform: 'none',
                      color: 'hsl(var(--muted-foreground))',
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      '&:hover': { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' },
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    size="small"
                    onClick={handlePlay}
                    disabled={playLoading}
                    startIcon={!playLoading && <PlayArrowIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      height: 26,
                      minWidth: 0,
                      px: 1.5,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      color: 'hsl(var(--primary-foreground))',
                      backgroundColor: 'hsl(var(--primary))',
                      border: '1px solid hsl(var(--primary))',
                      boxShadow: '0 0 12px -2px hsl(var(--primary) / 0.6)',
                      '& .MuiButton-startIcon': { mr: 0.5 },
                      '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)', boxShadow: '0 0 16px -2px hsl(var(--primary) / 0.7)' },
                      '&.Mui-disabled': { color: 'hsl(var(--primary-foreground) / 0.7)', backgroundColor: 'hsl(var(--primary) / 0.45)', boxShadow: 'none', borderColor: 'hsl(var(--primary) / 0.45)' },
                    }}
                  >
                    {playLoading ? 'Running…' : 'Play'}
                  </Button>
                </Box>
              </Box>

              {/* Editor area with line numbers */}
              <Box sx={{ display: 'flex', minHeight: 270 }}>
                <Box
                  aria-hidden
                  sx={{
                    userSelect: 'none',
                    py: 1.5,
                    pl: 1.25,
                    pr: 1,
                    textAlign: 'right',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.72rem',
                    lineHeight: 1.5,
                    color: 'hsl(var(--muted-foreground) / 0.6)',
                    borderRight: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--muted) / 0.25)',
                    minWidth: 36,
                  }}
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </Box>
                <Box
                  component="textarea"
                  value={snippet}
                  onChange={(e: any) => setSnippet(e.target.value)}
                  spellCheck={false}
                  sx={{
                    flex: 1,
                    minHeight: 270,
                    resize: 'vertical',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.72rem',
                    lineHeight: 1.5,
                    color: 'hsl(var(--foreground))',
                    backgroundColor: 'transparent',
                    border: 'none',
                    p: 1.5,
                    outline: 'none',
                    caretColor: 'hsl(var(--primary))',
                  }}
                />
              </Box>
            </Box>
          </>
        )}

        {playResult !== null && (
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'hsl(140 60% 55%)' }} />
              <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', letterSpacing: 0.4 }}>
                response
              </Typography>
            </Box>
            <Box
              component="pre"
              sx={{
                p: 1.5,
                maxHeight: 240,
                overflow: 'auto',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.7rem',
                lineHeight: 1.5,
                color: 'hsl(var(--foreground))',
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                m: 0,
              }}
            >
              {playResult}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

interface AppDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  /** App name to load */
  appName: string | null;
  /** Anchor side */
  anchor?: 'left' | 'right';
  /** Width in px */
  width?: number;
  /** Called when drawer closes so parent can refresh data */
  onRefresh?: () => void;
  /** When set, replaces the Activate button with "+ Add" and calls this on click */
  onAddToCanvas?: (appInfo: { name: string; icon: string; algoliaId: string | null }) => void;
  /** Whether the current user is authenticated. Defaults to true. */
  isAuthenticated?: boolean;
  /** Host app's currently active org id. If different from the library's tracked org,
   *  an `Org-Id` header is injected into the Singul curl preview. */
  activeOrgId?: string | null;
}

export default function AppDetailDrawer({
  open,
  onClose,
  appName,
  anchor = 'right',
  width = 520,
  onRefresh,
  onAddToCanvas,
  isAuthenticated = true,
  activeOrgId,
}: AppDetailDrawerProps) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appLoading, setAppLoading] = useState(false);
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [activatedAppId, setActivatedAppId] = useState<string | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);
  const [resolvedAlgoliaId, setResolvedAlgoliaId] = useState<string | null>(null);
  const [authExpanded, setAuthExpanded] = useState(true);
  // Auto-collapse Authentication section when a valid auth exists; expand otherwise.
  // Only fires when validity flips, so user manual toggles are preserved.
  const lastValidAuthRef = useRef<boolean | null>(null);
  const [incidentStats, setIncidentStats] = useState<{ ingested: number; forwarded: number } | null>(null);

  const {
    authStates,
    authenticatedApps,
    loading: appAuthLoading,
    handleAuthChange,
    handleTestConnection,
    handleSaveAuth,
    refreshAuth,
  } = useAppAuth();

  // Fetch app info and refresh auth when opened with a new app
  useEffect(() => {
    if (!open || !appName) return;
    setAppLoading(true);
    setAppInfo(null);
    setIsActivated(null);
    setResolvedAlgoliaId(null);
    // Always refresh auth when opening a different app
    refreshAuth();

    const normalizedName = appName.toLowerCase().replace(/[\s_\-]+/g, '_');
    const searchName = appName.replace(/_/g, ' ');

    (async () => {
      // Algolia lookup (best-effort — may fail with 429 or be unavailable)
      let algoliaId: string | null = null;
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        const res = await client.search({
          requests: [{ indexName: 'appsearch', query: searchName, hitsPerPage: 10 }],
        });
        const hits = (res as any)?.results?.[0]?.hits || [];
        const match = hits.find((h: any) =>
          h.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName
        ) || (hits.length > 0 ? hits[0] : null);

        if (match) {
          algoliaId = match.objectID;
          setResolvedAlgoliaId(algoliaId);
          setAppInfo({
            name: match.name || searchName,
            description: match.description || '',
            large_image: match.image_url || '',
            categories: match.categories || [],
          });
        }
      } catch {}

      // Fallback: if Algolia didn't resolve an id, look it up via /api/v1/apps
      // This also doubles as our activation check below.
      let appsList: any[] | null = null;
      if (API_CONFIG.apiKey) {
        try {
          const res = await fetch(getApiUrl('/api/v1/apps'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          });
          if (res.ok) {
            const apps = await res.json();
            if (Array.isArray(apps)) appsList = apps;
          }
        } catch {}
      }

      if (!algoliaId && appsList) {
        const localMatch = appsList.find((a: any) =>
          (a.name || '').toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName
        );
        if (localMatch?.id) {
          algoliaId = localMatch.id;
          setResolvedAlgoliaId(localMatch.id);
          setAppInfo(prev => prev ?? {
            name: localMatch.name || searchName,
            description: localMatch.description || '',
            large_image: localMatch.large_image || '',
            categories: localMatch.categories || [],
            authentication: localMatch.authentication,
          });
        }
      }

      // Config API — only available when we have an id
      if (API_CONFIG.apiKey && algoliaId) {
        try {
          const response = await fetch(
            getApiUrl(`/api/v1/apps/${encodeURIComponent(algoliaId)}/config`),
            { credentials: 'include', headers: { ...getAuthHeader() } }
          );
          if (response.ok) {
            const data = await response.json();
            if (data?.name) {
              setAppInfo(prev => ({ ...prev, ...data, large_image: data.large_image || prev?.large_image || '' }));
            }
          }
        } catch {}
      }

      // Activation status from the same /api/v1/apps response
      if (appsList) {
        const activeMatch = appsList.find((a: any) =>
          (a.name || '').toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName && a.activated
        );
        setIsActivated(!!activeMatch);
        setActivatedAppId(activeMatch?.id || null);
      } else {
        setIsActivated(false);
      }

      // Last-resort: if we still have no appInfo, seed from the name so the drawer renders
      setAppInfo(prev => prev ?? {
        name: searchName,
        description: '',
        large_image: '',
        categories: [],
      });

      setAppLoading(false);
    })();
  }, [open, appName]);

  // Fetch incident stats for this app
  useEffect(() => {
    if (!open || !appName || !isAuthenticated) {
      setIncidentStats(null);
      return;
    }

    (async () => {
      try {
        const result = await getDatastoreByCategory(DATASTORE_CATEGORIES.INCIDENTS);
        if (!result.success || !result.data) {
          setIncidentStats({ ingested: 0, forwarded: 0 });
          return;
        }

        const normalizedAppName = appName.toLowerCase().replace(/[\s_\-]+/g, '');
        let ingested = 0;
        let forwarded = 0;

        for (const item of result.data) {
          try {
            const parsed = JSON.parse(item.value);
            const productName = (parsed.metadata?.product?.name || '').toLowerCase().replace(/[\s_\-]+/g, '');
            if (productName && productName === normalizedAppName) {
              ingested++;
            }
            // Check if forwarded to this app (via finding_info dest or similar)
            const forwardDest = (parsed.metadata?.product?.forward_name || parsed.forward_target || '').toLowerCase().replace(/[\s_\-]+/g, '');
            if (forwardDest && forwardDest === normalizedAppName) {
              forwarded++;
            }
          } catch {}
        }

        setIncidentStats({ ingested, forwarded });
      } catch {
        setIncidentStats({ ingested: 0, forwarded: 0 });
      }
    })();
  }, [open, appName, isAuthenticated]);

  const handleClose = () => {
    onRefresh?.();
    onClose();
  };

  // Matching auth entries
  const matchingEntries = useMemo(() => {
    if (!appName || !isAuthenticated) return [];
    return authenticatedApps.filter(
      auth => auth.app?.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === appName.toLowerCase().replace(/[\s_\-]+/g, '_')
    );
  }, [appName, authenticatedApps, isAuthenticated]);

  const resolvedImage = useMemo(() => {
    if (appInfo?.large_image) return appInfo.large_image;
    for (const entry of matchingEntries) {
      const img = (entry as any).app?.large_image || (entry as any).large_image;
      if (img) return img;
    }
    return '';
  }, [appInfo, matchingEntries]);

  const algoliaApp: AlgoliaSearchApp | null = useMemo(() => {
    if (!appName) return null;
    return {
      objectID: resolvedAlgoliaId || appName,
      name: appName,
      image_url: resolvedImage,
      description: appInfo?.description || '',
      categories: appInfo?.categories || [],
    } as AlgoliaSearchApp;
  }, [appName, appInfo, resolvedImage, resolvedAlgoliaId]);

  const authState = authStates[appName || ''] || { systemId: appName || '', status: 'pending' as const, credentials: {} };
  const hasValidAuth = matchingEntries.some(e => e.validation?.valid === true);
  const hasAnyAuth = matchingEntries.length > 0;
  const authCount = matchingEntries.length;
  const displayName = (appInfo?.name || appName || '').replace(/_/g, ' ');

  // Auto-collapse when valid auth appears, auto-expand when it disappears.
  useEffect(() => {
    if (lastValidAuthRef.current === hasValidAuth) return;
    lastValidAuthRef.current = hasValidAuth;
    setAuthExpanded(!hasValidAuth);
  }, [hasValidAuth]);

  // Reset tracker when switching apps so the new app starts from current state.
  useEffect(() => {
    lastValidAuthRef.current = null;
  }, [appName]);

  const handleActivateToggle = async () => {
    if (!appName || activateLoading) return;
    const wasActivated = isActivated;
    const prevAppId = activatedAppId;
    setIsActivated(!wasActivated);
    setActivateLoading(true);
    try {
      if (wasActivated && prevAppId) {
        const res = await fetch(getApiUrl(`/api/v1/apps/${prevAppId}/deactivate`), {
          method: 'POST', credentials: 'include', headers: { ...getAuthHeader() },
        });
        if (!res.ok) throw new Error('Deactivate failed');
        setActivatedAppId(null);
        toast.success(`${displayName} deactivated`);
      } else {
        const appId = resolvedAlgoliaId;
        if (!appId) throw new Error('App ID not resolved yet');
        const activateRes = await fetch(getApiUrl(`/api/v1/apps/${appId}/activate`), {
          method: 'GET', credentials: 'include', headers: { ...getAuthHeader() },
        });
        if (!activateRes.ok) throw new Error(`Activate failed (${activateRes.status})`);
        setActivatedAppId(appId);
        toast.success(`${displayName} activated`);
      }
    } catch (err: any) {
      console.error('[Activate] Error:', err);
      toast.error(err?.message || 'Activation failed');
      setIsActivated(wasActivated);
      setActivatedAppId(prevAppId);
    } finally {
      setActivateLoading(false);
    }
  };

  const isLoadingAll = appLoading || (isAuthenticated && appAuthLoading);

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width,
          maxWidth: '100vw',
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: anchor === 'right' ? '1px solid hsl(var(--border))' : 'none',
          borderRight: anchor === 'left' ? '1px solid hsl(var(--border))' : 'none',
        },
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid hsl(var(--border))',
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, textTransform: 'capitalize' }}>
            {isLoadingAll ? <Skeleton width={140} /> : displayName}
          </Typography>
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
            App configuration
          </Typography>
        </Box>
        <IconButton
          component={Link}
          to={`/apps/${encodeURIComponent(appName || '')}`}
          size="small"
          sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {isLoadingAll ? (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Skeleton variant="circular" width={56} height={56} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width={180} height={28} />
                <Skeleton width={260} height={18} sx={{ mt: 0.5 }} />
              </Box>
            </Box>
            <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
          </Box>
        ) : (
          <>
            {/* App header */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 3,
                  p: 2.5,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <Avatar
                  src={resolvedImage}
                  alt={displayName}
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '14px',
                    backgroundColor: 'hsl(var(--muted))',
                    border: '2px solid',
                    borderColor: hasValidAuth
                      ? 'hsl(var(--severity-low))'
                      : hasAnyAuth
                        ? 'hsl(142 76% 36% / 0.3)'
                        : 'hsl(var(--border))',
                    p: 0.5,
                    '& img': { objectFit: 'contain', borderRadius: '10px' },
                  }}
                >
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>{displayName.charAt(0).toUpperCase()}</Typography>
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: '1rem', textTransform: 'capitalize' }}>
                      {displayName}
                    </Typography>
                    {isAuthenticated && hasValidAuth && (
                      <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label="Verified" size="small"
                        sx={{ height: 22, backgroundColor: 'hsla(142, 76%, 36%, 0.15)', color: 'hsl(var(--severity-low))', fontWeight: 600, fontSize: '0.7rem', '& .MuiChip-icon': { color: 'hsl(var(--severity-low))' } }} />
                    )}
                    {isAuthenticated && !hasValidAuth && hasAnyAuth && (
                      <Chip icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />} label="Pending" size="small"
                        sx={{ height: 22, backgroundColor: 'hsla(38, 92%, 50%, 0.15)', color: 'hsl(var(--severity-medium))', fontWeight: 600, fontSize: '0.7rem', '& .MuiChip-icon': { color: 'hsl(var(--severity-medium))' } }} />
                    )}
                  </Box>

                  {appInfo?.categories && appInfo.categories.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {appInfo.categories.slice(0, 3).map(cat => (
                        <Chip key={cat} label={cat} size="small"
                          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }} />
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Add to canvas button (usecase page) */}
                {onAddToCanvas && appName && (
                  <Button
                    onClick={() => {
                      onAddToCanvas({ name: appName, icon: resolvedImage || '', algoliaId: resolvedAlgoliaId });
                      onClose();
                    }}
                    variant="contained"
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 2, px: 1.5, py: 0.5, minHeight: 0, flexShrink: 0,
                      bgcolor: '#FF6600', '&:hover': { bgcolor: '#e55c00' },
                    }}
                  >
                    + Add
                  </Button>
                )}

                {/* Activate toggle (non-usecase contexts) */}
                {!onAddToCanvas && isAuthenticated && isActivated !== null && (
                  <Button
                    onClick={handleActivateToggle}
                    disabled={activateLoading}
                    variant={isActivated ? 'outlined' : 'contained'}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 2, px: 1.5, py: 0.5, minHeight: 0, flexShrink: 0,
                      ...(isActivated
                        ? { color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))', '&:hover': { borderColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive))', bgcolor: 'hsla(var(--destructive) / 0.08)' } }
                        : { bgcolor: '#FF6600', '&:hover': { bgcolor: '#e55c00' } }),
                    }}
                  >
                    {activateLoading ? '…' : isActivated ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </Box>
            </motion.div>


            {/* Incident stats */}
            {isAuthenticated && incidentStats && incidentStats.ingested > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
                <Box sx={{
                  display: 'flex',
                  gap: 2,
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--muted) / 0.3)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Download size={14} style={{ color: 'hsl(var(--primary))' }} />
                    <Box>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1 }}>
                        {incidentStats.ingested}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
                        Incidents ingested
                      </Typography>
                    </Box>
                  </Box>
                  {incidentStats.forwarded > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, pl: 2, borderLeft: '1px solid hsl(var(--border))' }}>
                      <Forward size={14} style={{ color: 'hsl(var(--severity-low))' }} />
                      <Box>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1 }}>
                          {incidentStats.forwarded}
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
                          Forwarded
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </motion.div>
            )}

            {/* Authentication section */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>
                  Authentication
                </Typography>
                <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 1.5 }}>
                  {isAuthenticated
                    ? authCount > 0
                      ? `${authCount} configuration${authCount > 1 ? 's' : ''} found`
                      : 'No authentication configured yet'
                    : `Connect your ${displayName} account`}
                </Typography>
                {isAuthenticated && algoliaApp && resolvedAlgoliaId && (
                  <AppAuthCard
                    app={algoliaApp}
                    authState={authState}
                    isExpanded={authExpanded}
                    onToggle={() => setAuthExpanded(prev => !prev)}
                    onAuthChange={handleAuthChange}
                    onTestConnection={(appId, authId) => handleTestConnection(appName || appId, authId)}
                    onSaveAuth={(appId, creds) => handleSaveAuth(appId, creds, appName || undefined)}
                    apiAuthEntries={matchingEntries}
                    onRefreshAuth={refreshAuth}
                  />
                )}
              </Box>
            </motion.div>

            {/* MCP Chat */}
            {isAuthenticated && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '0.95rem', mb: 1.5 }}>
                    Try MCP
                  </Typography>
                  <AppMcpChat
                    appName={appName || ''}
                    appIcon={resolvedImage}
                    appId={matchingEntries[0]?.app?.id || matchingEntries[0]?.id || appName || ''}
                    categories={appInfo?.categories}
                  />
                </Box>

                {/* Try Singul actions — disabled-look catalog */}
                <SingulActionsPreview appName={appName || ''} categories={appInfo?.categories} activeOrgId={activeOrgId} />
              </motion.div>
            )}


          </>
        )}
      </Box>
    </Drawer>
  );
}
