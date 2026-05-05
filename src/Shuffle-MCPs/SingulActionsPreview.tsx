/**
 * SingulActionsPreview — Standalone "Try individual actions" block.
 *
 * Renders the action picker (grouped by category), curl/python toggle,
 * editable snippet, Play button (calls Shuffle Tools `execute_python` or
 * the http app `curl` action) and a response area that streams in.
 *
 * Self-contained — pass in the app name + categories. Optionally pass
 * `activeOrgId` so multi-org curl previews include the right Org-Id header.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Box,
  Typography,
  Chip,
  Button,
  Autocomplete,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { API_CONFIG, getApiUrl, getAuthHeader, getTrackedOrgId } from '@/Shuffle-MCPs/api';

interface SingulAction {
  name: string;
  label: string;
  category: string;
  fields: { name: string; value: string }[];
}

/** Default starter fields per canonical action (lowercased snake_case key). */
const ACTION_DEFAULT_FIELDS: Record<string, { name: string; value: string }[]> = {
  list_messages: [{ name: 'channel', value: '#general' }, { name: 'limit', value: '10' }],
  send_message: [{ name: 'channel', value: '#general' }, { name: 'message', value: 'Hello from Shuffle' }],
  get_message: [{ name: 'message_id', value: '' }],
  search_messages: [{ name: 'query', value: 'incident' }],
  list_attachments: [{ name: 'message_id', value: '' }],
  get_attachment: [{ name: 'attachment_id', value: '' }],
  get_contact: [{ name: 'email', value: 'user@example.com' }],

  search: [{ name: 'query', value: 'event.type:login' }, { name: 'time_range', value: '24h' }],
  list_alerts: [{ name: 'severity', value: 'high' }],
  close_alert: [{ name: 'alert_id', value: '' }],
  get_alert: [{ name: 'alert_id', value: '' }],
  create_detection: [{ name: 'name', value: 'My detection' }, { name: 'query', value: 'event.type:login AND result:failure' }],
  add_to_lookup_list: [{ name: 'list_name', value: 'blocked_ips' }, { name: 'value', value: '1.2.3.4' }],
  isolate_endpoint: [{ name: 'host_id', value: '' }],

  block_hash: [{ name: 'hash', value: 'd41d8cd98f00b204e9800998ecf8427e' }],
  search_hosts: [{ name: 'query', value: 'hostname:laptop-*' }],
  isolate_host: [{ name: 'host_id', value: '' }],
  unisolate_host: [{ name: 'host_id', value: '' }],
  trigger_host_scan: [{ name: 'host_id', value: '' }],

  list_tickets: [{ name: 'status', value: 'open' }],
  get_ticket: [{ name: 'ticket_id', value: '' }],
  create_ticket: [{ name: 'title', value: 'New incident' }, { name: 'description', value: '' }, { name: 'priority', value: 'medium' }],
  close_ticket: [{ name: 'ticket_id', value: '' }],
  add_comment: [{ name: 'ticket_id', value: '' }, { name: 'comment', value: 'Investigation update' }],
  update_ticket: [{ name: 'ticket_id', value: '' }, { name: 'status', value: 'in_progress' }],
  search_tickets: [{ name: 'query', value: 'status:open' }],

  list_assets: [{ name: 'limit', value: '50' }],
  get_asset: [{ name: 'asset_id', value: '' }],
  search_assets: [{ name: 'query', value: 'os:windows' }],
  search_users: [{ name: 'query', value: 'department:finance' }],
  search_endpoints: [{ name: 'query', value: 'os:windows' }],
  search_vulnerabilities: [{ name: 'severity', value: 'critical' }],

  get_ioc: [{ name: 'value', value: '1.2.3.4' }],
  search_ioc: [{ name: 'query', value: 'malicious.com' }],
  create_ioc: [{ name: 'type', value: 'ipv4' }, { name: 'value', value: '1.2.3.4' }],
  update_ioc: [{ name: 'ioc_id', value: '' }, { name: 'value', value: '1.2.3.4' }],
  delete_ioc: [{ name: 'ioc_id', value: '' }],

  reset_password: [{ name: 'user_id', value: '' }],
  enable_user: [{ name: 'user_id', value: '' }],
  disable_user: [{ name: 'user_id', value: '' }],
  get_identity: [{ name: 'user_id', value: '' }],
  search_identity: [{ name: 'query', value: 'department:finance' }],
  get_kms_key: [{ name: 'key_id', value: '' }],

  get_rules: [],
  allow_ip: [{ name: 'ip', value: '1.2.3.4' }],
  block_ip: [{ name: 'ip', value: '1.2.3.4' }],

  answer_question: [{ name: 'question', value: 'What is this alert about?' }],
  run_action: [{ name: 'app', value: 'jira' }, { name: 'action', value: 'create_ticket' }],
  run_llm: [{ name: 'prompt', value: 'Summarize this incident' }, { name: 'model', value: 'gpt-4o-mini' }],

  update_info: [{ name: 'key', value: '' }, { name: 'value', value: '' }],
  get_info: [{ name: 'key', value: '' }],
  get_status: [],
  get_version: [],
  get_health: [],
  get_config: [{ name: 'key', value: '' }],
  get_configs: [],
  get_configs_by_type: [{ name: 'type', value: '' }],
  get_configs_by_name: [{ name: 'name', value: '' }],
  run_script: [{ name: 'script', value: 'whoami' }],
};

/** Default categories + their action labels (canonical order). */
const ACTION_CATEGORIES: { name: string; action_labels: string[] }[] = [
  { name: 'Communication', action_labels: ['List Messages', 'Send Message', 'Get Message', 'Search messages', 'List Attachments', 'Get Attachment', 'Get Contact'] },
  { name: 'SIEM', action_labels: ['Search', 'List Alerts', 'Close Alert', 'Get Alert', 'Create detection', 'Add to lookup list', 'Isolate endpoint'] },
  { name: 'Eradication', action_labels: ['List Alerts', 'Close Alert', 'Get Alert', 'Create detection', 'Block hash', 'Search Hosts', 'Isolate host', 'Unisolate host', 'Trigger host scan'] },
  { name: 'Cases', action_labels: ['List tickets', 'Get ticket', 'Create ticket', 'Close ticket', 'Add comment', 'Update ticket', 'Search tickets'] },
  { name: 'Assets', action_labels: ['List Assets', 'Get Asset', 'Search Assets', 'Search Users', 'Search endpoints', 'Search vulnerabilities'] },
  { name: 'Intel', action_labels: ['Get IOC', 'Search IOC', 'Create IOC', 'Update IOC', 'Delete IOC'] },
  { name: 'IAM', action_labels: ['Reset Password', 'Enable user', 'Disable user', 'Get Identity', 'Get Asset', 'Search Identity', 'Get KMS Key'] },
  { name: 'Network', action_labels: ['Get Rules', 'Allow IP', 'Block IP'] },
  { name: 'AI', action_labels: ['Answer Question', 'Run Action', 'Run LLM'] },
  { name: 'Internal', action_labels: ['Answer Question', 'Run Action', 'Run LLM'] },
  { name: 'Other', action_labels: ['Update Info', 'Get Info', 'Get Status', 'Get Version', 'Get Health', 'Get Config', 'Get Configs', 'Get Configs by type', 'Get Configs by name', 'Run script'] },
];

const labelToName = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Flat list of ALL actions across every category, preserving order. */
const ALL_ACTIONS: SingulAction[] = ACTION_CATEGORIES.flatMap((cat) =>
  cat.action_labels.map((label) => {
    const name = labelToName(label);
    return {
      name,
      label,
      category: cat.name,
      fields: ACTION_DEFAULT_FIELDS[name] ?? [],
    };
  }),
);

/** Pick the best matching default category for an app, given its raw categories. */
function pickDefaultCategory(categories?: string[]): string {
  if (!categories || categories.length === 0) return 'Other';
  const known = ACTION_CATEGORIES.map((c) => c.name.toLowerCase());
  for (const cat of categories) {
    const n = cat.toLowerCase();
    const direct = known.find((k) => k === n);
    if (direct) return ACTION_CATEGORIES.find((c) => c.name.toLowerCase() === direct)!.name;
    const partial = known.find((k) => n.includes(k) || k.includes(n));
    if (partial) return ACTION_CATEGORIES.find((c) => c.name.toLowerCase() === partial)!.name;
  }
  return 'Other';
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
  const defaultCategory = useMemo(() => pickDefaultCategory(categories), [categories]);
  const actions = ALL_ACTIONS;
  // Sort so that the app's default category appears first, rest follow original order.
  const sortedActions = useMemo(() => {
    const inCat = actions.filter((a) => a.category === defaultCategory);
    const rest = actions.filter((a) => a.category !== defaultCategory);
    return [...inCat, ...rest];
  }, [actions, defaultCategory]);
  const isDisabled = false;
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
    const initial = sortedActions[0] || null;
    setSelected(initial);
    setSnippet(buildSnippet(initial, lang));
  }, [appName, sortedActions, curlOpts, lang, buildSnippet]);

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
  const responseRef = useRef<HTMLDivElement | null>(null);

  const scrollToResponse = () => {
    requestAnimationFrame(() => {
      responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handlePlay = async () => {
    if (!snippet || playLoading) return;
    setPlayLoading(true);
    setPlayResult('');
    scrollToResponse();
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
      scrollToResponse();
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
                options={sortedActions}
                value={selected ?? sortedActions[0]}
                onChange={(_, v) => v && handleSelect(v as SingulAction)}
                groupBy={(o: SingulAction) => o.category}
                getOptionLabel={(o: SingulAction | null) => o?.label ?? ''}
                isOptionEqualToValue={(a, b) => a?.name === b?.name && a?.category === b?.category}
                renderOption={(props, option) => (
                  <li {...props} key={`${option.category}-${option.name}`}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--foreground))' }}>{option.label}</Typography>
                      <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>
                        {option.name}
                      </Typography>
                    </Box>
                  </li>
                )}
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
                componentsProps={{
                  paper: {
                    sx: {
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      border: '1px solid hsl(var(--border))',
                      '& .MuiAutocomplete-groupLabel': {
                        backgroundColor: 'hsl(var(--muted) / 0.6)',
                        color: 'hsl(var(--muted-foreground))',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        lineHeight: '24px',
                      },
                    },
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

        {(playLoading || playResult !== null) && (
          <Box ref={responseRef} sx={{ mt: 1.5 }}>
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
              {playLoading && !playResult ? 'Running…' : playResult}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SingulActionsPreview;
