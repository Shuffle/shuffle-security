/**
 * Shared LLM-provider detection. Given a base URL (typically the `url`
 * credential on a saved OpenAI-compatible authentication), figure out which
 * provider preset it belongs to so the UI can show the right logo and
 * auto-select the right entry in selectors.
 *
 * Used by:
 *  - `LocalLLMConfig` sidebar (auto-select the provider matching the saved
 *    OpenAI auth URL)
 *  - `AgentUI` "Choose LLM" chip (show provider logo next to the label)
 */

export interface LLMProviderPreset {
  label: string;
  url: string;
  apiKeyUrl?: string;
  apiKeyHint?: string;
}

export const SHUFFLE_AI_PRESET = 'Shuffle AI';
export const CUSTOM_PRESET = 'Custom / self-hosted';

export const ENDPOINT_PRESETS: LLMProviderPreset[] = [
  { label: SHUFFLE_AI_PRESET, url: '' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1', apiKeyUrl: 'https://platform.openai.com/api-keys', apiKeyHint: 'Create a key under API keys in the OpenAI platform dashboard.' },
  { label: 'Anthropic', url: 'https://api.anthropic.com/v1/', apiKeyUrl: 'https://console.anthropic.com/settings/keys', apiKeyHint: 'Generate a key under Settings → API Keys in the Anthropic Console.' },
  { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/', apiKeyUrl: 'https://aistudio.google.com/app/apikey', apiKeyHint: 'Create a key in Google AI Studio under Get API key.' },
  { label: 'Mistral', url: 'https://api.mistral.ai/v1', apiKeyUrl: 'https://console.mistral.ai/api-keys/', apiKeyHint: 'Create a key under API Keys in the Mistral Console.' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1', apiKeyUrl: 'https://console.groq.com/keys', apiKeyHint: 'Create a key under API Keys in the Groq Console.' },
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', apiKeyUrl: 'https://platform.deepseek.com/api_keys', apiKeyHint: 'Create a key under API Keys in the DeepSeek platform.' },
  { label: 'Together AI', url: 'https://api.together.xyz/v1', apiKeyUrl: 'https://api.together.ai/settings/api-keys', apiKeyHint: 'Create a key under Settings → API Keys in Together AI.' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', apiKeyUrl: 'https://openrouter.ai/keys', apiKeyHint: 'Create a key under Keys in your OpenRouter dashboard.' },
  { label: 'Ollama (localhost)', url: 'http://localhost:11434/v1', apiKeyHint: 'Local Ollama does not require an API key — any non-empty value works.' },
  { label: 'LM Studio (localhost)', url: 'http://localhost:1234/v1', apiKeyHint: 'Local LM Studio does not require an API key — any non-empty value works.' },
  { label: CUSTOM_PRESET, url: '' },
];

export const PROVIDER_DOMAINS: Record<string, string> = {
  'Shuffle AI': 'shuffler.io',
  OpenAI: 'openai.com',
  Anthropic: 'anthropic.com',
  'Google Gemini': 'gemini.google.com',
  Mistral: 'mistral.ai',
  Groq: 'groq.com',
  DeepSeek: 'deepseek.com',
  'Together AI': 'together.ai',
  OpenRouter: 'openrouter.ai',
  'Ollama (localhost)': 'ollama.com',
  'LM Studio (localhost)': 'lmstudio.ai',
};

const hostnameOf = (url: string): string | null => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
};

/**
 * Detect which preset a saved endpoint URL belongs to. Returns the matched
 * preset, or null when the URL is empty / unrecognisable. Falls back to
 * `Custom / self-hosted` for non-empty URLs that don't match any known
 * provider so callers can render a sensible label.
 */
export const detectLLMProvider = (url: string | undefined | null): LLMProviderPreset | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1) Exact match (cheap, handles canonical presets).
  const exact = ENDPOINT_PRESETS.find((p) => p.url && p.url === trimmed);
  if (exact) return exact;

  // 2) Hostname match — tolerates trailing slashes, path differences,
  //    `/v1` vs `/openai/v1`, custom ports on localhost, etc.
  const host = hostnameOf(trimmed);
  if (host) {
    const byHost = ENDPOINT_PRESETS.find((p) => {
      const presetHost = hostnameOf(p.url);
      return presetHost && presetHost === host;
    });
    if (byHost) return byHost;

    // localhost ports we recognise.
    if (host === 'localhost' || host === '127.0.0.1') {
      if (trimmed.includes(':11434')) return ENDPOINT_PRESETS.find((p) => p.label === 'Ollama (localhost)') || null;
      if (trimmed.includes(':1234')) return ENDPOINT_PRESETS.find((p) => p.label === 'LM Studio (localhost)') || null;
    }
  }

  return ENDPOINT_PRESETS.find((p) => p.label === CUSTOM_PRESET) || null;
};

/**
 * Resolve a logo URL for a provider preset. Uses Google's favicon service
 * against the known domain (or the URL hostname) so we don't have to bundle
 * brand assets.
 */
export const getProviderLogoUrl = (label: string | undefined, url?: string): string => {
  if (!label && !url) return '';
  let domain = label ? PROVIDER_DOMAINS[label] : undefined;
  if (!domain && url) {
    const host = hostnameOf(url);
    if (host) domain = host;
  }
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';
};
