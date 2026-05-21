import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { AppAuthCard } from '@/Shuffle-MCPs/components/AppAuthConfig';
import type { AlgoliaSearchApp } from '@/Shuffle-MCPs/shuffle-mcp.helpers';
import { useAppAuth } from '@/Shuffle-MCPs/useAppAuth';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { refreshAllIntegrationStatus } from '@/Shuffle-MCPs/components/IntegrationStatus';
import { UsageBar } from '@/Shuffle-MCPs/components/UsageBar';
import { useSyncHostBaseUrl } from '@/Shuffle-MCPs/useSyncHostBaseUrl';
import type { ShuffleHostProps } from '@/Shuffle-MCPs/host-props';

const OPENAI_APP_NAME = 'OpenAI';
const OPENAI_APP_ID = '5d19dd82517870c68d40cacad9b5ca91';
const SHUFFLE_AI_PRESET = 'Shuffle AI';
const CUSTOM_PRESET = 'Custom / self-hosted';

const OPENAI_ALGOLIA_APP: AlgoliaSearchApp = {
  name: OPENAI_APP_NAME,
  description: 'OpenAI-compatible LLM endpoint for agent operations',
  objectID: OPENAI_APP_ID,
  creator: '',
  app_version: '1.0.0',
  image_url: '',
  time_edited: 0,
  generated: false,
  invalid: false,
  priority: 0,
  actions: 0,
  tags: [],
  accessible_by: [],
  categories: [],
  action_labels: [],
  triggers: [],
  verified: true,
};

const ENDPOINT_PRESETS: Array<{ label: string; url: string }> = [
  { label: SHUFFLE_AI_PRESET, url: '' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1' },
  { label: 'Anthropic', url: 'https://api.anthropic.com/v1/' },
  { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
  { label: 'Mistral', url: 'https://api.mistral.ai/v1' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
  { label: 'Together AI', url: 'https://api.together.xyz/v1' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  { label: 'Ollama (localhost)', url: 'http://localhost:11434/v1' },
  { label: 'LM Studio (localhost)', url: 'http://localhost:1234/v1' },
  { label: CUSTOM_PRESET, url: '' },
];

export interface AgentLocalModel {
  url: string;
  apikey: string;
  model: string;
}

export interface LocalLLMTestResult {
  success: boolean;
  message: string;
  models?: string[];
  latencyMs?: number;
}

export const getLocalModel = (): AgentLocalModel => ({ url: '', apikey: '', model: '' });
export const saveLocalModelConfig = (_model: AgentLocalModel) => {};
export const testLocalLLM = async (_config: AgentLocalModel): Promise<LocalLLMTestResult> => ({
  success: false,
  message: 'Use the app authentication system test instead',
});

export interface LocalLLMConfigProps extends ShuffleHostProps {
  compact?: boolean;
  hasOpenAIAuth?: boolean;
  onSave?: (model: AgentLocalModel) => void;
  onTestResult?: (result: LocalLLMTestResult) => void;
}

const LocalLLMConfig = ({ compact, globalUrl, userdata, isLoaded, isLoggedIn, serverside, theme, colorMode }: LocalLLMConfigProps) => {
  useSyncHostBaseUrl(globalUrl);
  const { authStates, authenticatedApps, handleAuthChange, handleTestConnection, handleSaveAuth, refreshAuth } = useAppAuth();
  const [expanded, setExpanded] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [confirmShuffleAIOpen, setConfirmShuffleAIOpen] = useState(false);

  const openaiEntries = authenticatedApps.filter(
    (a) => a.app?.name?.toLowerCase() === 'openai' || a.app?.id === OPENAI_APP_ID,
  );

  const authState = authStates[OPENAI_APP_ID] || {
    systemId: OPENAI_APP_ID,
    status: 'pending' as const,
    credentials: {},
  };

  const currentUrl = (authState.credentials?.url as string) || '';
  const attemptedDeletionRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (authState.status === 'testing') return;
    const failedEntries = openaiEntries.filter((e) => e.validation && e.validation.valid === false && e.id);
    if (failedEntries.length === 0) return;
    let cancelled = false;
    (async () => {
      let deletedAny = false;
      for (const entry of failedEntries) {
        const id = entry.id as string;
        if (attemptedDeletionRef.current.has(id)) continue;
        attemptedDeletionRef.current.add(id);
        try {
          const resp = await fetch(getApiUrl(`/api/v1/apps/authentication/${id}`), {
            method: 'DELETE',
            credentials: 'include',
            headers: { ...getAuthHeader() },
          });
          if (resp.ok) deletedAny = true;
        } catch (err) {
          console.error('[LocalLLMConfig] Failed to auto-delete failed OpenAI auth:', err);
        }
      }
      if (!cancelled && deletedAny) {
        await refreshAuth();
        refreshAllIntegrationStatus();
      }
    })();
    return () => { cancelled = true; };
  }, [openaiEntries, authState.status, refreshAuth]);

  const hasOpenAIEntries = openaiEntries.length > 0;
  const effectivePreset = useMemo(() => {
    if (selectedPreset) return selectedPreset;
    if (!currentUrl && !hasOpenAIEntries) return SHUFFLE_AI_PRESET;
    if (!currentUrl) return '';
    const match = ENDPOINT_PRESETS.find((p) => p.url && p.url === currentUrl);
    return match ? match.label : CUSTOM_PRESET;
  }, [selectedPreset, currentUrl, hasOpenAIEntries]);

  const applyShuffleAI = async () => {
    let deletedAny = false;
    for (const entry of openaiEntries) {
      if (!entry.id) continue;
      try {
        const resp = await fetch(getApiUrl(`/api/v1/apps/authentication/${entry.id}`), {
          method: 'DELETE',
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (resp.ok) deletedAny = true;
      } catch (err) {
        console.error('[LocalLLMConfig] Failed to delete OpenAI auth when switching to Shuffle AI:', err);
      }
    }
    handleAuthChange(OPENAI_APP_ID, {});
    setSelectedPreset(SHUFFLE_AI_PRESET);
    setCustomUrl('');
    if (deletedAny) {
      await refreshAuth();
      refreshAllIntegrationStatus();
    }
  };

  const handlePresetChange = (label: string) => {
    if (label === SHUFFLE_AI_PRESET) {
      if (hasOpenAIEntries) {
        setConfirmShuffleAIOpen(true);
        return;
      }
      void applyShuffleAI();
      return;
    }
    setSelectedPreset(label);
    const preset = ENDPOINT_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    handleAuthChange(OPENAI_APP_ID, { ...authState.credentials, url: preset.label === CUSTOM_PRESET ? customUrl : preset.url });
  };

  const handleCustomUrlChange = (value: string) => {
    setCustomUrl(value);
    handleAuthChange(OPENAI_APP_ID, { ...authState.credentials, url: value });
  };

  const isShuffleAI = effectivePreset === SHUFFLE_AI_PRESET;
  const orgId = userdata?.active_org?.id;
  const [orgData, setOrgData] = useState<{
    sync_features?: Record<string, { usage?: number; limit?: number }>;
  } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl(`/api/v1/orgs/${orgId}`), {
          method: 'GET',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setOrgData(data);
      } catch (err) {
        console.error('[LocalLLMConfig] Failed to fetch org info:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  // Quotas live under sync_features in the org payload. App runs are at
  // sync_features.app_executions, tokens at sync_features.agent_tokens.
  // The root-level app_execution_* fields are unreliable / empty.
  const sync = orgData?.sync_features ?? (userdata as any)?.sync_features ?? {};
  const appExec = sync.app_executions ?? {};
  const appRunLimit = Number(appExec.limit) || 0;
  const appRunUsage = Number(appExec.usage) || 0;
  const agentTokens = sync.agent_tokens ?? {};
  const agentTokenLimit = Number(agentTokens.limit) || 0;
  const agentTokenUsage = Number(agentTokens.usage) || 0;


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          AI Provider
        </Typography>
        <Autocomplete
          size="small"
          fullWidth
          disableClearable
          options={ENDPOINT_PRESETS.map((p) => p.label)}
          value={effectivePreset || null}
          onChange={(_e, val) => val && handlePresetChange(val)}
          isOptionEqualToValue={(opt, val) => opt === val}
          renderOption={(props, option) => {
            const preset = ENDPOINT_PRESETS.find((p) => p.label === option);
            return (
              <li {...props} key={option}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--popover-foreground))' }}>{option}</Typography>
                  {preset?.url && (
                    <Typography component="span" sx={{ ml: 'auto', color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {preset.url}
                    </Typography>
                  )}
                </Box>
              </li>
            );
          }}
          renderInput={(params) => <TextField {...params} placeholder="Search a provider…" />}
          slotProps={{
            paper: { sx: { bgcolor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))' } },
            popper: { sx: { zIndex: 9999 } },
          }}
        />
      </Box>

      {!compact && (
        <Box sx={{ px: 2.5, py: 2, borderRadius: 2, border: '1px solid hsl(var(--border))', bgcolor: 'hsl(var(--muted) / 0.3)' }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
            {isShuffleAI
              ? 'Using Shuffle AI. No configuration is required. Pick another provider above to use your own endpoint.'
              : 'Configure an OpenAI-compatible endpoint for agent operations. Credentials are saved through the app authentication system.'}{' '}
            <Box component="a" href="https://shuffler.io/docs/AI#using-self-hosted-ai-models" target="_blank" rel="noopener noreferrer" sx={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
              Read the docs
            </Box>
            .
          </Typography>
        </Box>
      )}

      {isShuffleAI && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5, width: '100%' }}>
          <UsageBar label="App runs" usage={appRunUsage} limit={appRunLimit} unit="runs" actionLabel="Upgrade" actionHref="https://shuffler.io/pricing" />
          <UsageBar label="Agent tokens" usage={agentTokenUsage} limit={agentTokenLimit} unit="tokens" actionLabel="Upgrade" actionHref="https://shuffler.io/pricing" />
        </Box>
      )}

      {effectivePreset === CUSTOM_PRESET && (
        <TextField
          size="small"
          fullWidth
          placeholder="https://your-self-hosted-endpoint.example.com"
          value={customUrl || currentUrl}
          onChange={(e) => handleCustomUrlChange(e.target.value)}
          helperText="Enter the base URL of your OpenAI-compatible endpoint"
          sx={{ '& .MuiFormHelperText-root': { color: 'hsl(var(--muted-foreground))' } }}
        />
      )}

      {!isShuffleAI && (
        <AppAuthCard
          app={OPENAI_ALGOLIA_APP}
          authState={authState}
          isExpanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
          onAuthChange={handleAuthChange}
          onTestConnection={(appId, authId) => handleTestConnection(appId, authId)}
          onSaveAuth={(appId, creds) => handleSaveAuth(appId, creds, OPENAI_APP_NAME)}
          apiAuthEntries={openaiEntries}
          onRefreshAuth={refreshAuth}
          disableUrlPrefill
          hideHeader
          hideStatusChips
          hideDocsLink
          hideUrlFields
          borderless
          globalUrl={globalUrl}
          userdata={userdata}
          isLoaded={isLoaded}
          isLoggedIn={isLoggedIn}
          serverside={serverside}
          theme={theme}
          colorMode={colorMode}
        />
      )}

      <Dialog open={confirmShuffleAIOpen} onClose={() => setConfirmShuffleAIOpen(false)} slotProps={{ paper: { sx: { bgcolor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))' } } }}>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Switch to Shuffle AI?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
            Switching to Shuffle AI will remove your existing OpenAI app authentication. Any other workflow or app using this OpenAI authentication will lose access. Do you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmShuffleAIOpen(false)} sx={{ color: 'hsl(var(--muted-foreground))', textTransform: 'none', height: 36 }}>Cancel</Button>
          <Button onClick={async () => { setConfirmShuffleAIOpen(false); await applyShuffleAI(); }} sx={{ bgcolor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', textTransform: 'none', height: 36, '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' } }}>
            Remove and use Shuffle AI
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LocalLLMConfig;