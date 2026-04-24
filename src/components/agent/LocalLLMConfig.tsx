import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { AppAuthCard } from '@/components/onboarding/AppAuthConfig';
import type { AlgoliaSearchApp } from '@/Singul-Integrations-Library';
import { useAppAuth } from '@/hooks/useAppAuth';
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

  // Find matching auth entries for OpenAI
  const openaiEntries = authenticatedApps.filter(
    (a) => a.app?.name?.toLowerCase() === 'openai' || a.app?.id === OPENAI_APP_ID
  );

  const authState = authStates[OPENAI_APP_ID] || {
    systemId: OPENAI_APP_ID,
    status: 'pending' as const,
    credentials: {},
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
            Configure an OpenAI-compatible endpoint for agent operations. Credentials are saved securely via the app authentication system.
          </Typography>
        </Box>
      )}

      {/* Reuse the standard AppAuthCard */}
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
      />
    </Box>
  );
};

export default LocalLLMConfig;
