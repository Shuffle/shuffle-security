import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { AppAuthCard } from '@/components/onboarding/AppAuthConfig';
import type { AlgoliaSearchApp } from '@/Shuffle-MCPs';
import { useAppAuth } from '@/hooks/useAppAuth';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { refreshAllIntegrationStatus } from '@/components/layout/IntegrationStatus';
import singulAgentIcon from '@/assets/singul-agent-icon.png';

const OPENAI_APP_NAME = 'OpenAI';
const OPENAI_APP_ID = '5d19dd82517870c68d40cacad9b5ca91';

// Construct a minimal AlgoliaSearchApp for OpenAI
const OPENAI_ALGOLIA_APP: AlgoliaSearchApp = {
  name: OPENAI_APP_NAME,
  description: 'OpenAI-compatible LLM endpoint for agent operations',
  objectID: OPENAI_APP_ID,
  creator: '',
  app_version: '1.0.0',
  image_url: singulAgentIcon,
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

/** Common OpenAI-compatible LLM endpoints. Last entry is custom/self-hosted. */
const ENDPOINT_PRESETS: Array<{ label: string; url: string }> = [
  { label: 'OpenAI', url: 'https://api.openai.com' },
  { label: 'Anthropic', url: 'https://api.anthropic.com' },
  { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com' },
  { label: 'Mistral', url: 'https://api.mistral.ai' },
  { label: 'Groq', url: 'https://api.groq.com/openai' },
  { label: 'Together AI', url: 'https://api.together.xyz' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api' },
  { label: 'Ollama (localhost)', url: 'http://localhost:11434' },
  { label: 'LM Studio (localhost)', url: 'http://localhost:1234' },
  { label: 'Custom / self-hosted', url: '' },
];

const CUSTOM_PRESET = 'Custom / self-hosted';

/** Legacy exports kept for backward compatibility */
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

/** @deprecated Use app auth system instead */
export const getLocalModel = (): AgentLocalModel => ({ url: '', apikey: '', model: '' });

/** @deprecated Use app auth system instead */
export const saveLocalModelConfig = (_model: AgentLocalModel) => {};

/** @deprecated Use app auth system via AppAuthCard instead */
export const testLocalLLM = async (_config: AgentLocalModel): Promise<LocalLLMTestResult> => ({
  success: false,
  message: 'Use the app auth system test instead',
});

interface LocalLLMConfigProps {
  compact?: boolean;
  hasOpenAIAuth?: boolean;
  onSave?: (model: AgentLocalModel) => void;
  onTestResult?: (result: LocalLLMTestResult) => void;
}

const LocalLLMConfig = ({ compact, hasOpenAIAuth }: LocalLLMConfigProps) => {
  const {
    authStates,
    authenticatedApps,
    handleAuthChange,
    handleTestConnection,
    handleSaveAuth,
    refreshAuth,
  } = useAppAuth();

  const [expanded, setExpanded] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');

  // Find matching auth entries for OpenAI
  const openaiEntries = authenticatedApps.filter(
    (a) => a.app?.name?.toLowerCase() === 'openai' || a.app?.id === OPENAI_APP_ID
  );

  const authState = authStates[OPENAI_APP_ID] || {
    systemId: OPENAI_APP_ID,
    status: 'pending' as const,
    credentials: {},
  };

  const currentUrl = (authState.credentials?.url as string) || '';

  // Auto-delete OpenAI auth entries whose connection test failed and was
  // never fixed. validation.valid === false means a test was actually run
  // and rejected — undefined means "never tested", so we leave those alone.
  // Track which IDs we already attempted to delete to avoid retrying every render.
  const attemptedDeletionRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Don't auto-delete while a test is mid-flight.
    if (authState.status === 'testing') return;

    const failedEntries = openaiEntries.filter(
      (e) => e.validation && e.validation.valid === false && e.id,
    );
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

    return () => {
      cancelled = true;
    };
  }, [openaiEntries, authState.status, refreshAuth]);

  // Detect which preset matches the currently entered URL (so the dropdown
  // reflects an existing saved value).
  const effectivePreset = useMemo(() => {
    if (selectedPreset) return selectedPreset;
    if (!currentUrl) return '';
    const match = ENDPOINT_PRESETS.find((p) => p.url && p.url === currentUrl);
    return match ? match.label : CUSTOM_PRESET;
  }, [selectedPreset, currentUrl]);

  const handlePresetChange = (label: string) => {
    setSelectedPreset(label);
    const preset = ENDPOINT_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    if (preset.label === CUSTOM_PRESET) {
      // Clear URL so user can type their own
      handleAuthChange(OPENAI_APP_ID, { ...authState.credentials, url: customUrl });
    } else {
      handleAuthChange(OPENAI_APP_ID, { ...authState.credentials, url: preset.url });
    }
  };

  const handleCustomUrlChange = (value: string) => {
    setCustomUrl(value);
    handleAuthChange(OPENAI_APP_ID, { ...authState.credentials, url: value });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Description */}
      {!compact && (
        <Box sx={{
          px: 2.5,
          py: 2,
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsla(var(--muted) / 0.3)',
        }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
            Configure an OpenAI-compatible endpoint for agent operations. Pick a common provider below, or choose "Custom / self-hosted" to enter your own URL. Credentials are saved securely via the app authentication system.
          </Typography>
        </Box>
      )}

      {/* Endpoint preset selector */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel
            sx={{
              color: 'hsl(var(--muted-foreground))',
              '&.Mui-focused': { color: 'hsl(var(--primary))' },
            }}
          >
            Endpoint preset
          </InputLabel>
          <Select
            value={effectivePreset}
            label="Endpoint preset"
            onChange={(e) => handlePresetChange(e.target.value as string)}
            displayEmpty
            sx={{
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--muted-foreground) / 0.4)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--primary))' },
              '& .MuiSvgIcon-root': { color: 'hsl(var(--muted-foreground))' },
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: 'hsl(var(--popover))',
                  color: 'hsl(var(--popover-foreground))',
                  border: '1px solid hsl(var(--border))',
                },
              },
            }}
          >
            <MenuItem value="" disabled>
              <em>Select a provider…</em>
            </MenuItem>
            {ENDPOINT_PRESETS.map((p) => (
              <MenuItem key={p.label} value={p.label}>
                {p.label}
                {p.url && (
                  <Typography
                    component="span"
                    sx={{ ml: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}
                  >
                    {p.url}
                  </Typography>
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {effectivePreset === CUSTOM_PRESET && (
          <TextField
            size="small"
            fullWidth
            placeholder="https://your-self-hosted-endpoint.example.com"
            value={customUrl || currentUrl}
            onChange={(e) => handleCustomUrlChange(e.target.value)}
            helperText="Enter the base URL of your OpenAI-compatible endpoint"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                '& fieldset': { borderColor: 'hsl(var(--border))' },
                '&:hover fieldset': { borderColor: 'hsl(var(--muted-foreground) / 0.4)' },
                '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
              },
              '& .MuiFormHelperText-root': { color: 'hsl(var(--muted-foreground))' },
            }}
          />
        )}
      </Box>

      {/* Reuse the standard AppAuthCard — URL prefill disabled so OpenAI's
          default URL doesn't get auto-filled when nothing is configured. */}
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
      />
    </Box>
  );
};

export default LocalLLMConfig;
