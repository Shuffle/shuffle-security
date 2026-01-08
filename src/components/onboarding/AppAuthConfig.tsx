import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Collapse,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Link,
  Divider,
} from '@mui/material';
import { motion } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
import { API_CONFIG, getApiUrl } from '@/config/api';

export type AuthStatus = 'pending' | 'testing' | 'connected' | 'error';

export interface AppAuthState {
  systemId: string;
  status: AuthStatus;
  credentials: Record<string, string>;
  errorMessage?: string;
}

interface AuthParameter {
  description: string;
  example: string;
  id: string;
  name: string;
  required: boolean;
  schema: {
    type: string;
  };
}

interface AppAuthentication {
  type: string;
  description?: string;
  redirect_uri?: string;
  token_uri?: string;
  refresh_uri?: string;
  scope?: string[];
  client_id?: string;
  client_secret?: string;
  parameters?: AuthParameter[];
}

interface DecodedApp {
  name: string;
  description: string;
  authentication: AppAuthentication;
  large_image?: string;
}

interface AppAuthConfigProps {
  apps: AlgoliaSearchApp[];
  authStates: Record<string, AppAuthState>;
  onAuthChange: (appId: string, credentials: Record<string, string>) => void;
  onTestConnection: (appId: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const AppAuthCard = ({
  app,
  authState,
  isExpanded,
  onToggle,
  onAuthChange,
  onTestConnection,
}: {
  app: AlgoliaSearchApp;
  authState: AppAuthState;
  isExpanded: boolean;
  onToggle: () => void;
  onAuthChange: (appId: string, credentials: Record<string, string>) => void;
  onTestConnection: (appId: string) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<DecodedApp | null>(null);

  useEffect(() => {
    const fetchAppConfig = async () => {
      if (!isExpanded || appConfig) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(getApiUrl(`/apps/${app.objectID}/config`), {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch app configuration');
        }
        
        const data = await response.json();
        
        if (data.success && data.app) {
          // Decode base64 app data
          const decodedAppString = atob(data.app);
          const decodedApp = JSON.parse(decodedAppString) as DecodedApp;
          setAppConfig(decodedApp);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAppConfig();
  }, [isExpanded, app.objectID, appConfig]);

  const getStatusConfig = (status: AuthStatus) => {
    switch (status) {
      case 'connected':
        return { color: '#22c55e', label: 'Connected', icon: <CheckCircleIcon fontSize="small" /> };
      case 'error':
        return { color: '#ef4444', label: 'Error', icon: <ErrorIcon fontSize="small" /> };
      case 'testing':
        return { color: '#FF6600', label: 'Testing...', icon: <CircularProgress size={16} sx={{ color: '#FF6600' }} /> };
      default:
        return { color: 'rgba(255, 255, 255, 0.4)', label: 'Not Configured', icon: null };
    }
  };

  const statusConfig = getStatusConfig(authState.status);
  const auth = appConfig?.authentication;

  const renderOAuth2Fields = () => {
    if (!auth || auth.type !== 'oauth2') return null;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* OAuth2 Info Banner */}
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <Typography variant="subtitle2" sx={{ color: '#60a5fa', fontWeight: 600, mb: 1 }}>
            OAuth 2.0 Authentication
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2 }}>
            {auth.description || 'This app uses OAuth 2.0 for secure authentication. Click the button below to authorize.'}
          </Typography>
          
          <Button
            variant="contained"
            startIcon={<OpenInNewIcon />}
            onClick={() => {
              // Build OAuth URL
              const authUrl = `https://shuffler.io/appauth?app_id=${app.objectID}`;
              window.open(authUrl, '_blank', 'width=600,height=700');
            }}
            sx={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              },
            }}
          >
            Authorize with {app.name.replace(/_/g, ' ')}
          </Button>
        </Box>

        {/* Scope Information */}
        {auth.scope && auth.scope.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 1, display: 'block' }}>
              Requested Permissions
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {auth.scope.map((scope, index) => (
                <Chip
                  key={index}
                  label={scope}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.7rem',
                    height: 24,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Technical Details (collapsible) */}
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
            Redirect URI: {auth.redirect_uri || 'Not specified'}
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderParameterFields = () => {
    if (!auth?.parameters || auth.parameters.length === 0) return null;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {auth.parameters.map((param) => (
          <Box key={param.id}>
            <TextField
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {param.name}
                  {param.required && (
                    <Typography component="span" sx={{ color: '#ef4444', fontSize: '0.8rem' }}>*</Typography>
                  )}
                </Box>
              }
              type={param.name.toLowerCase().includes('password') || param.name.toLowerCase().includes('secret') || param.name.toLowerCase().includes('key') ? 'password' : 'text'}
              placeholder={param.example || `Enter ${param.name}`}
              value={authState.credentials[param.id] || ''}
              onChange={(e) =>
                onAuthChange(app.objectID, {
                  ...authState.credentials,
                  [param.id]: e.target.value,
                })
              }
              fullWidth
              size="small"
              helperText={param.description}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                },
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
                '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.4)' },
              }}
            />
          </Box>
        ))}
      </Box>
    );
  };

  const renderApiKeyFields = () => {
    // For non-OAuth apps without parameters, show generic API key field
    if (auth?.type === 'oauth2' || (auth?.parameters && auth.parameters.length > 0)) return null;

    return (
      <TextField
        label="API Key"
        type="password"
        placeholder="Enter your API key"
        value={authState.credentials['api_key'] || ''}
        onChange={(e) =>
          onAuthChange(app.objectID, {
            ...authState.credentials,
            api_key: e.target.value,
          })
        }
        fullWidth
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 2,
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
            '&.Mui-focused fieldset': { borderColor: '#FF6600' },
          },
          '& .MuiInputBase-input': { color: 'white' },
          '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
        }}
      />
    );
  };

  return (
    <motion.div variants={itemVariants}>
      <Card
        sx={{
          background: 'rgba(33, 33, 33, 0.6)',
          border: '1px solid',
          borderColor:
            authState.status === 'connected'
              ? 'rgba(34, 197, 94, 0.3)'
              : authState.status === 'error'
              ? 'rgba(239, 68, 68, 0.3)'
              : 'rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
          backdropFilter: 'blur(10px)',
          overflow: 'hidden',
        }}
      >
        <CardContent
          onClick={onToggle}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'pointer',
            p: 3,
            '&:last-child': { pb: 3 },
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' },
          }}
        >
          {app.image_url ? (
            <Box
              component="img"
              src={app.image_url}
              alt={app.name}
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                objectFit: 'contain',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                p: 1,
              }}
            />
          ) : (
            <Box
              sx={{
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 2,
                fontSize: '1.5rem',
              }}
            >
              🔗
            </Box>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ color: 'white', fontWeight: 600 }}>
              {app.name.replace(/_/g, ' ')}
            </Typography>
            {app.description && (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                {app.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {appConfig?.authentication?.type && (
              <Chip
                label={appConfig.authentication.type.toUpperCase()}
                size="small"
                sx={{
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  color: '#a78bfa',
                  fontWeight: 600,
                  fontSize: '0.65rem',
                }}
              />
            )}
            <Chip
              icon={statusConfig.icon || undefined}
              label={statusConfig.label}
              size="small"
              sx={{
                backgroundColor: `${statusConfig.color}15`,
                color: statusConfig.color,
                fontWeight: 500,
                fontSize: '0.7rem',
                '& .MuiChip-icon': { color: statusConfig.color },
              }}
            />
            <IconButton
              size="small"
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                transform: isExpanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.3s ease',
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>
        </CardContent>

        <Collapse in={isExpanded}>
          <Box
            sx={{
              px: 3,
              pb: 3,
              pt: 1,
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} sx={{ color: '#FF6600' }} />
                <Typography sx={{ ml: 2, color: 'rgba(255, 255, 255, 0.5)' }}>
                  Loading configuration...
                </Typography>
              </Box>
            ) : error ? (
              <Alert
                severity="error"
                sx={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 2,
                }}
              >
                {error}
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {renderOAuth2Fields()}
                {renderParameterFields()}
                {renderApiKeyFields()}

                {authState.status === 'error' && authState.errorMessage && (
                  <Alert
                    severity="error"
                    sx={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    {authState.errorMessage}
                  </Alert>
                )}

                {auth?.type !== 'oauth2' && (
                  <Button
                    variant="contained"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTestConnection(app.objectID);
                    }}
                    disabled={authState.status === 'testing'}
                    sx={{
                      alignSelf: 'flex-start',
                      background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                      boxShadow: '0 4px 14px rgba(255, 102, 0, 0.25)',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #FF8533 0%, #FF9955 100%)',
                      },
                      '&.Mui-disabled': {
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.3)',
                      },
                    }}
                  >
                    {authState.status === 'testing' ? 'Testing...' : 'Test Connection'}
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </Collapse>
      </Card>
    </motion.div>
  );
};

export const AppAuthConfig = ({
  apps,
  authStates,
  onAuthChange,
  onTestConnection,
}: AppAuthConfigProps) => {
  const [expanded, setExpanded] = useState<string | false>(apps[0]?.objectID || false);

  if (apps.length === 0) {
    return (
      <Alert
        severity="info"
        sx={{
          backgroundColor: 'rgba(255, 102, 0, 0.1)',
          color: '#FF6600',
          border: '1px solid rgba(255, 102, 0, 0.3)',
          borderRadius: 2,
        }}
      >
        No integrations selected. Go back and select at least one integration.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          color: 'white',
          fontWeight: 700,
          mb: 1,
        }}
      >
        Dynamic Authentication (New)
      </Typography>
      <Typography
        variant="body1"
        sx={{ mb: 4, color: 'rgba(255, 255, 255, 0.5)' }}
      >
        Authentication fields are loaded dynamically from the app configuration.
      </Typography>

      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {apps.map((app) => {
            const authState = authStates[app.objectID] || { systemId: app.objectID, status: 'pending' as const, credentials: {} };
            const isExpanded = expanded === app.objectID;

            return (
              <AppAuthCard
                key={app.objectID}
                app={app}
                authState={authState}
                isExpanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? false : app.objectID)}
                onAuthChange={onAuthChange}
                onTestConnection={onTestConnection}
              />
            );
          })}
        </Box>
      </motion.div>
    </Box>
  );
};
