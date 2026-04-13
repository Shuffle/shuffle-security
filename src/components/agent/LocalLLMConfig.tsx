import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  CircularProgress,
  Collapse,
  Alert,
  Skeleton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { ShieldCheck, Wifi, WifiOff, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl, getAuthHeader } from '@/config/api';

const OPENAI_APP_NAME = 'OpenAI';

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

interface LocalLLMConfigProps {
  /** Compact mode hides the description box */
  compact?: boolean;
  /** Whether an OpenAI app auth was detected in the backend */
  hasOpenAIAuth?: boolean;
  /** Called whenever the config is saved */
  onSave?: (model: AgentLocalModel) => void;
  /** Called when a test completes */
  onTestResult?: (result: LocalLLMTestResult) => void;
}

/** Legacy: Load saved local model config from localStorage (for migration) */
export const getLocalModel = (): AgentLocalModel => {
  try {
    const stored = localStorage.getItem('agent_local_model');
    return stored ? JSON.parse(stored) : { url: '', apikey: '', model: '' };
  } catch {
    return { url: '', apikey: '', model: '' };
  }
};

/** @deprecated Use app auth system instead */
export const saveLocalModelConfig = (_model: AgentLocalModel) => {
  // No-op: saving is now done via the app auth API
};

/** Test by sending a quick AI query via the shared askAI service */
export const testLocalLLM = async (_config: AgentLocalModel): Promise<LocalLLMTestResult> => {
  const start = performance.now();
  try {
    const { askAI } = await import('@/services/ai');
    const response = await askAI({ query: 'Test', outputFormat: 'raw' });
    const latencyMs = Math.round(performance.now() - start);
    if (response.success) {
      return { success: true, message: `AI responded successfully (${latencyMs}ms)`, latencyMs };
    }
    return { success: false, message: response.error || 'AI query failed', latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Connection failed',
      latencyMs,
    };
  }
};

const inputSx = {
  fontSize: '0.82rem',
  color: 'hsl(var(--foreground))',
  px: 1.5,
  py: 1,
  borderRadius: 2,
  border: '1px solid hsl(var(--border))',
  bgcolor: 'hsl(var(--card))',
  fontFamily: "'JetBrains Mono', monospace",
  '& input::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 0.6 },
  '&:focus-within': {
    borderColor: 'hsla(var(--primary) / 0.5)',
    boxShadow: '0 0 0 3px hsla(var(--primary) / 0.08)',
  },
};

const labelSx = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'hsl(var(--muted-foreground))',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  mb: 1,
};

const LocalLLMConfig = ({ compact, hasOpenAIAuth, onSave, onTestResult }: LocalLLMConfigProps) => {
  const [localModel, setLocalModel] = useState<AgentLocalModel>({ url: '', apikey: '', model: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LocalLLMTestResult | null>(null);
  const [existingAuthId, setExistingAuthId] = useState<string | null>(null);

  // Load existing OpenAI auth from the app auth API
  const loadExistingAuth = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(getApiUrl('/api/v1/apps/authentication'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (resp.ok) {
        const result = await resp.json();
        const authData = Array.isArray(result) ? result : (result.data || []);
        const openaiEntry = authData.find(
          (a: any) => a.app?.name?.toLowerCase() === 'openai' && a.active
        );
        if (openaiEntry) {
          setExistingAuthId(openaiEntry.id);
          // Extract fields into our model
          const fields = openaiEntry.fields || [];
          const urlField = fields.find((f: any) => f.key === 'url');
          const apikeyField = fields.find((f: any) => f.key === 'apikey' || f.key === 'api_key');
          const modelField = fields.find((f: any) => f.key === 'model');
          setLocalModel({
            url: urlField?.value || '',
            apikey: apikeyField?.value || '',
            model: modelField?.value || '',
          });
        }
      }
    } catch (err) {
      console.warn('[LocalLLMConfig] Failed to load existing auth:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExistingAuth();
  }, [loadExistingAuth]);

  const handleChange = (field: keyof AgentLocalModel, value: string) => {
    setLocalModel(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fields = [
        { key: 'url', value: localModel.url },
        { key: 'apikey', value: localModel.apikey },
        { key: 'model', value: localModel.model },
      ].filter(f => f.value.trim());

      const payload: Record<string, any> = {
        label: 'Auth for OpenAI',
        app: {
          name: OPENAI_APP_NAME,
          id: OPENAI_APP_NAME.toLowerCase(),
          app_version: '1.0.0',
        },
        fields,
        active: true,
      };

      // If we have an existing auth ID, include it so it updates rather than creating a duplicate
      if (existingAuthId) {
        payload.id = existingAuthId;
      }

      const resp = await fetch(getApiUrl('/api/v1/apps/authentication'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const result = await resp.json();
        if (result.id) setExistingAuthId(result.id);
        setSaved(true);
        onSave?.(localModel);
        toast.success('OpenAI authentication saved');
        setTimeout(() => setSaved(false), 2000);
      } else {
        const errData = await resp.json().catch(() => null);
        toast.error(errData?.reason || 'Failed to save authentication');
      }
    } catch (err) {
      console.error('[LocalLLMConfig] Save failed:', err);
      toast.error('Failed to save authentication');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testLocalLLM(localModel);
    setTestResult(result);
    onTestResult?.(result);
    setTesting(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Skeleton variant="rounded" height={60} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={44} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={44} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={44} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

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
            Configure an OpenAI-compatible endpoint for agent operations. Credentials are saved securely via the app authentication system.
          </Typography>
        </Box>
      )}

      {/* OpenAI auth status banner */}
      {hasOpenAIAuth && (
        <Alert
          severity="success"
          variant="outlined"
          sx={{
            borderColor: 'hsl(142, 71%, 45%, 0.3)',
            bgcolor: 'hsl(142, 71%, 45%, 0.06)',
            '& .MuiAlert-icon': { color: 'hsl(142, 71%, 45%)' },
            '& .MuiAlert-message': { fontSize: '0.78rem', color: 'hsl(var(--foreground))' },
            borderRadius: 2,
          }}
        >
          An authenticated OpenAI app was detected in your account. The agent can use it as an LLM provider.
        </Alert>
      )}

      {/* URL */}
      <Box>
        <Typography sx={labelSx}>URL</Typography>
        <InputBase
          value={localModel.url}
          onChange={(e) => handleChange('url', e.target.value)}
          placeholder="https://api.openai.com/v1"
          fullWidth
          sx={inputSx}
        />
      </Box>

      {/* API Key */}
      <Box>
        <Typography sx={labelSx}>API Key</Typography>
        <InputBase
          value={localModel.apikey}
          onChange={(e) => handleChange('apikey', e.target.value)}
          placeholder="sk-..."
          type="password"
          fullWidth
          sx={inputSx}
        />
      </Box>

      {/* Model */}
      <Box>
        <Typography sx={labelSx}>Model</Typography>
        <InputBase
          value={localModel.model}
          onChange={(e) => handleChange('model', e.target.value)}
          placeholder="gpt-4o, llama3, mistral..."
          fullWidth
          sx={inputSx}
        />
      </Box>

      {/* Test result */}
      <Collapse in={!!testResult}>
        {testResult && (
          <Alert
            severity={testResult.success ? 'success' : 'error'}
            icon={testResult.success ? <Wifi size={16} /> : <WifiOff size={16} />}
            sx={{
              bgcolor: testResult.success
                ? 'hsla(var(--severity-low) / 0.1)'
                : 'hsla(var(--destructive) / 0.1)',
              color: 'hsl(var(--foreground))',
              border: `1px solid ${testResult.success ? 'hsl(var(--severity-low))' : 'hsl(var(--destructive))'}`,
              borderRadius: 2,
              '& .MuiAlert-icon': {
                color: testResult.success ? 'hsl(var(--severity-low))' : 'hsl(var(--destructive))',
              },
              fontSize: '0.8rem',
            }}
          >
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
              {testResult.message}
            </Typography>
          </Alert>
        )}
      </Collapse>

      {/* Buttons */}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : saved ? <ShieldCheck size={14} /> : <SaveIcon sx={{ fontSize: 14 }} />}
          onClick={handleSave}
          disabled={saving || (!localModel.url.trim() && !localModel.apikey.trim())}
          sx={{
            bgcolor: saved ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))',
            color: saved ? '#fff' : 'hsl(var(--primary-foreground))',
            textTransform: 'none',
            fontSize: '0.82rem',
            fontWeight: 600,
            borderRadius: 2,
            px: 3,
            '&:hover': {
              bgcolor: saved ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))',
              filter: 'brightness(1.1)',
            },
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </Button>
        <Button
          variant="outlined"
          startIcon={testing ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <Zap size={14} />}
          onClick={handleTest}
          disabled={testing || !localModel.url.trim()}
          sx={{
            textTransform: 'none',
            fontSize: '0.82rem',
            fontWeight: 600,
            borderRadius: 2,
            px: 3,
            color: 'hsl(var(--foreground))',
            borderColor: 'hsl(var(--border))',
            '&:hover': {
              borderColor: 'hsl(var(--primary))',
              bgcolor: 'hsla(var(--primary) / 0.06)',
            },
            '&.Mui-disabled': {
              color: 'hsl(var(--muted-foreground))',
              borderColor: 'hsl(var(--border))',
              opacity: 0.5,
            },
          }}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </Button>
      </Box>
    </Box>
  );
};

export default LocalLLMConfig;
