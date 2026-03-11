import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  CircularProgress,
  Collapse,
  Alert,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { ShieldCheck, Wifi, WifiOff, Zap } from 'lucide-react';
import { getApiUrl, getAuthHeader } from '@/config/api';

const AGENT_LOCAL_MODEL_KEY = 'agent_local_model';

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
  /** Called whenever the config is saved */
  onSave?: (model: AgentLocalModel) => void;
  /** Called when a test completes */
  onTestResult?: (result: LocalLLMTestResult) => void;
}

/** Load saved local model config from localStorage */
export const getLocalModel = (): AgentLocalModel => {
  try {
    const stored = localStorage.getItem(AGENT_LOCAL_MODEL_KEY);
    return stored ? JSON.parse(stored) : { url: '', apikey: '', model: '' };
  } catch {
    return { url: '', apikey: '', model: '' };
  }
};

/** Save local model config to localStorage */
export const saveLocalModelConfig = (model: AgentLocalModel) => {
  localStorage.setItem(AGENT_LOCAL_MODEL_KEY, JSON.stringify(model));
};

/** Test connectivity by sending a simple query through the Shuffle AI conversation endpoint */
export const testLocalLLM = async (_config: AgentLocalModel): Promise<LocalLLMTestResult> => {
  const start = performance.now();
  try {
    const { askAI } = await import('@/services/ai');
    const response = await askAI({ query: 'ping', outputFormat: 'raw' });
    const latencyMs = Math.round(performance.now() - start);
    if (response.success) {
      return { success: true, message: `AI model responding (${latencyMs}ms)`, latencyMs };
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

const LocalLLMConfig = ({ compact, onSave, onTestResult }: LocalLLMConfigProps) => {
  const [localModel, setLocalModel] = useState<AgentLocalModel>(getLocalModel);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LocalLLMTestResult | null>(null);

  const handleChange = (field: keyof AgentLocalModel, value: string) => {
    setLocalModel(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    setTestResult(null);
  };

  const handleSave = () => {
    saveLocalModelConfig(localModel);
    setSaved(true);
    onSave?.(localModel);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testLocalLLM(localModel);
    setTestResult(result);
    onTestResult?.(result);
    setTesting(false);
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
            Configure a local or self-hosted OpenAI-compatible endpoint for agent operations.
          </Typography>
        </Box>
      )}

      {/* URL */}
      <Box>
        <Typography sx={labelSx}>URL</Typography>
        <InputBase
          value={localModel.url}
          onChange={(e) => handleChange('url', e.target.value)}
          placeholder="http://localhost:11434/v1"
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
          placeholder="sk-... (optional for local models)"
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
          placeholder="llama3, mistral, gpt-4o..."
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
          startIcon={saved ? <ShieldCheck size={14} /> : <SaveIcon sx={{ fontSize: 14 }} />}
          onClick={handleSave}
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
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button
          variant="outlined"
          startIcon={testing ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <Zap size={14} />}
          onClick={handleTest}
          disabled={testing}
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
