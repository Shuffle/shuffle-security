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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { motion } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LockIcon from '@mui/icons-material/Lock';
import GroupIcon from '@mui/icons-material/Group';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CloseIcon from '@mui/icons-material/Close';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
import { API_CONFIG, getApiUrl } from '@/config/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type AuthStatus = 'pending' | 'testing' | 'connected' | 'error';

export interface AppAuthState {
  systemId: string;
  status: AuthStatus;
  credentials: Record<string, string>;
  errorMessage?: string;
}

// Helper to check if auth type is OAuth2 (includes oauth2-app variant)
const isOAuth2Type = (type: string | undefined): boolean => {
  if (!type) return false;
  const lowerType = type.toLowerCase();
  return lowerType === 'oauth2' || lowerType === 'oauth2-app';
};

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

// API authentication entry (from /api/v1/apps/authentication)
interface ApiAuthEntry {
  id?: string;
  label?: string;
  app: {
    id: string;
    name: string;
    large_image?: string;
  };
  active?: boolean;
  validation?: {
    valid: boolean;
    error?: string;
  };
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
  authenticatedApps?: ApiAuthEntry[];
  onAuthChange: (appId: string, credentials: Record<string, string>) => void;
  onTestConnection: (appId: string) => void;
  onSelectAuth?: (appId: string, authId: string) => void;
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

const ADD_NEW_AUTH = '__add_new__';

const AppAuthCard = ({
  app,
  authState,
  isExpanded,
  onToggle,
  onAuthChange,
  onTestConnection,
  apiAuthEntries,
  onSelectAuth,
}: {
  app: AlgoliaSearchApp;
  authState: AppAuthState;
  isExpanded: boolean;
  onToggle: () => void;
  onAuthChange: (appId: string, credentials: Record<string, string>) => void;
  onTestConnection: (appId: string) => void;
  apiAuthEntries: ApiAuthEntry[];
  onSelectAuth?: (appId: string, authId: string) => void;
}) => {
  // Helper to get best default auth: prioritize validated, otherwise last entry
  const getBestDefaultAuth = (entries: ApiAuthEntry[]): string => {
    if (entries.length === 0) return ADD_NEW_AUTH;
    
    // First, find a validated entry
    const validatedEntry = entries.find(e => e.validation?.valid === true);
    if (validatedEntry) {
      return validatedEntry.id || validatedEntry.label || '0';
    }
    
    // Otherwise, use the last entry (assuming API returns in chronological order)
    const lastEntry = entries[entries.length - 1];
    return lastEntry.id || lastEntry.label || '0';
  };

  // Track selected auth from dropdown
  const [selectedAuthId, setSelectedAuthId] = useState<string>(() => {
    return getBestDefaultAuth(apiAuthEntries);
  });

  // Track if user explicitly selected "Add new" to prevent override
  const [userSelectedAddNew, setUserSelectedAddNew] = useState(false);

  // Update selection when apiAuthEntries changes, but only if user didn't explicitly choose "Add new"
  useEffect(() => {
    if (apiAuthEntries.length > 0 && !userSelectedAddNew) {
      setSelectedAuthId(getBestDefaultAuth(apiAuthEntries));
    }
  }, [apiAuthEntries, userSelectedAddNew]);

  const showAddNewForm = selectedAuthId === ADD_NEW_AUTH;
  
  // Get the currently selected auth entry
  const selectedAuth = apiAuthEntries.find(
    auth => (auth.id || auth.label || '') === selectedAuthId
  );

  // Compute configured/tested status from selected auth entry
  const isConfigured = selectedAuth?.active === true || apiAuthEntries.some(a => a.active === true);
  const isTested = selectedAuth?.validation?.valid === true || apiAuthEntries.some(a => a.validation?.valid === true);
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
  const isOAuth2 = isOAuth2Type(auth?.type);

  const [selectedScopes, setSelectedScopes] = useState<string[]>(auth?.scope || []);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsContent, setDocsContent] = useState<string>('');
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchDocs = async () => {
    setDocsLoading(true);
    try {
      const encodedName = encodeURIComponent(app.name);
      const response = await fetch(getApiUrl(`/docs/${encodedName}?location=openapi`), {
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Use "reason" field which contains markdown, fallback to other fields
        setDocsContent(data.reason || data.data || data.content || 'No documentation available.');
      } else {
        setDocsContent('Failed to load documentation.');
      }
    } catch (error) {
      setDocsContent('Error loading documentation.');
    } finally {
      setDocsLoading(false);
    }
  };

  const handleOpenDocs = () => {
    setDocsOpen(true);
    fetchDocs();
  };

  const renderOAuth2Fields = () => {
    if (!auth || !isOAuth2) return null;

    const availableScopes = auth.scope || [];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header with description */}
        <Box>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1 }}>
            OAuth2 requires a Client ID and Client Secret to authenticate, defined in your app's remote website.
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Your redirect URL: <Typography component="span" sx={{ color: '#FF6600', fontWeight: 600 }}>
              {auth.redirect_uri || 'https://shuffler.io/set_authentication'}
            </Typography>
          </Typography>
          <Link
            href="https://shuffler.io/docs/extensions#app_authentication"
            target="_blank"
            sx={{ 
              color: '#FF6600', 
              fontSize: '0.875rem',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Learn more about OAuth2 with Shuffle
          </Link>
        </Box>

        {/* Quick Connect Button */}
        <Button
          variant="outlined"
          fullWidth
          startIcon={
            app.image_url ? (
              <Box
                component="img"
                src={app.image_url}
                alt={app.name}
                sx={{ width: 24, height: 24, borderRadius: 1, objectFit: 'contain' }}
              />
            ) : <LockIcon />
          }
          onClick={() => {
            const authUrl = `https://shuffler.io/appauth?app_id=${app.objectID}`;
            window.open(authUrl, '_blank', 'width=600,height=700');
          }}
          sx={{
            py: 1.5,
            borderColor: 'rgba(255, 102, 0, 0.4)',
            color: 'white',
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '1rem',
            '&:hover': {
              borderColor: '#FF6600',
              backgroundColor: 'rgba(255, 102, 0, 0.08)',
            },
          }}
        >
          Quick Connect with {app.name.replace(/_/g, ' ')}
        </Button>

        {/* OR Divider */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.875rem' }}>OR</Typography>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
        </Box>

        {/* Manual Fields */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* URL Field */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LockIcon sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>url</Typography>
            </Box>
            <TextField
              placeholder={auth.token_uri || 'https://api.example.com'}
              value={authState.credentials['url'] || auth.token_uri || ''}
              onChange={(e) =>
                onAuthChange(app.objectID, {
                  ...authState.credentials,
                  url: e.target.value,
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
              }}
            />
          </Box>

          {/* Client ID */}
          <TextField
            label="Client ID"
            placeholder="Enter your Client ID"
            value={authState.credentials['client_id'] || ''}
            onChange={(e) =>
              onAuthChange(app.objectID, {
                ...authState.credentials,
                client_id: e.target.value,
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

          {/* Client Secret */}
          <TextField
            label="Client Secret"
            type="password"
            placeholder="Enter your Client Secret"
            value={authState.credentials['client_secret'] || ''}
            onChange={(e) =>
              onAuthChange(app.objectID, {
                ...authState.credentials,
                client_secret: e.target.value,
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

          {/* Scopes Dropdown */}
          {availableScopes.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 1 }}>
                Scopes (access rights)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl fullWidth size="small">
                  <Select
                    multiple
                    value={selectedScopes}
                    onChange={(e) => {
                      const value = e.target.value as string[];
                      setSelectedScopes(value);
                      onAuthChange(app.objectID, {
                        ...authState.credentials,
                        scopes: value.join(' '),
                      });
                    }}
                    input={<OutlinedInput />}
                    renderValue={(selected) => selected.length === 0 ? 'Search Scopes' : `${selected.length} scope(s) selected`}
                    displayEmpty
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 2,
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#FF6600' },
                      '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.5)' },
                    }}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#1a1a1a',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {availableScopes.map((scope) => (
                      <MenuItem key={scope} value={scope} sx={{ color: 'white' }}>
                        <Checkbox 
                          checked={selectedScopes.indexOf(scope) > -1}
                          sx={{ color: 'rgba(255, 255, 255, 0.5)', '&.Mui-checked': { color: '#FF6600' } }}
                        />
                        <ListItemText primary={scope} sx={{ '& .MuiTypography-root': { color: 'white' } }} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Checkbox
                  checked={selectedScopes.length === availableScopes.length}
                  indeterminate={selectedScopes.length > 0 && selectedScopes.length < availableScopes.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedScopes(availableScopes);
                      onAuthChange(app.objectID, {
                        ...authState.credentials,
                        scopes: availableScopes.join(' '),
                      });
                    } else {
                      setSelectedScopes([]);
                      onAuthChange(app.objectID, {
                        ...authState.credentials,
                        scopes: '',
                      });
                    }
                  }}
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.5)', 
                    '&.Mui-checked': { color: '#FF6600' },
                    '&.MuiCheckbox-indeterminate': { color: '#FF6600' },
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* Authenticate Button */}
        <Button
          variant="contained"
          disabled={!authState.credentials['client_id'] || !authState.credentials['client_secret']}
          onClick={(e) => {
            e.stopPropagation();
            onTestConnection(app.objectID);
          }}
          sx={{
            py: 1.5,
            background: authState.credentials['client_id'] && authState.credentials['client_secret']
              ? 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)'
              : 'rgba(255, 255, 255, 0.1)',
            color: authState.credentials['client_id'] && authState.credentials['client_secret']
              ? 'white'
              : 'rgba(255, 255, 255, 0.3)',
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
          Authenticate
        </Button>
      </Box>
    );
  };

  const renderParameterFields = () => {
    // Don't render parameters for OAuth2 apps - they use the OAuth2 fields
    if (isOAuth2) return null;
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
    if (isOAuth2 || (auth?.parameters && auth.parameters.length > 0)) return null;

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
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
            {/* Configured status chip */}
            <Chip
              label={isConfigured ? 'Configured' : 'Not configured'}
              size="small"
              sx={{
                backgroundColor: isConfigured ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isConfigured ? '#f59e0b' : '#ef4444',
                fontWeight: 500,
                fontSize: '0.65rem',
              }}
            />
            {/* Tested status chip */}
            <Chip
              label={isTested ? 'Tested' : 'Not tested'}
              size="small"
              sx={{
                backgroundColor: isTested ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                color: isTested ? '#22c55e' : '#9ca3af',
                fontWeight: 500,
                fontSize: '0.65rem',
              }}
            />
            <Tooltip title="View documentation">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDocs();
                }}
                sx={{
                  color: 'rgba(255, 255, 255, 0.4)',
                  '&:hover': { 
                    color: '#60a5fa',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  },
                }}
              >
                <MenuBookIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
              pt: 2,
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Auth Selection Dropdown - always at top */}
            {apiAuthEntries.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1 }}>
                  Select authentication
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedAuthId}
                    onChange={(e) => {
                      const value = e.target.value as string;
                      setSelectedAuthId(value);
                      // Track if user explicitly selected "Add new"
                      setUserSelectedAddNew(value === ADD_NEW_AUTH);
                      if (value !== ADD_NEW_AUTH && onSelectAuth) {
                        onSelectAuth(app.objectID, value);
                      }
                    }}
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 2,
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#FF6600' },
                      '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.5)' },
                    }}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#1a1a1a',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        },
                      },
                    }}
                  >
                    {apiAuthEntries.map((authEntry, index) => {
                      const entryId = authEntry.id || authEntry.label || index.toString();
                      const entryLabel = authEntry.label || `Auth ${index + 1}`;
                      const isActive = authEntry.active === true;
                      const isValid = authEntry.validation?.valid === true;
                      return (
                        <MenuItem key={entryId} value={entryId} sx={{ color: 'white', py: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                              <Chip
                                label={isActive ? 'Configured' : 'Not configured'}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.6rem',
                                  backgroundColor: isActive ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: isActive ? '#f59e0b' : '#ef4444',
                                }}
                              />
                              <Chip
                                label={isValid ? 'Tested' : 'Not tested'}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.6rem',
                                  backgroundColor: isValid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                                  color: isValid ? '#22c55e' : '#9ca3af',
                                }}
                              />
                            </Box>
                            <Typography sx={{ 
                              flex: 1, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                            }}>
                              {entryLabel}
                            </Typography>
                          </Box>
                        </MenuItem>
                      );
                    })}
                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: 1 }} />
                    <MenuItem value={ADD_NEW_AUTH} sx={{ color: '#FF6600', fontWeight: 600 }}>
                      + Add new authentication
                    </MenuItem>
                  </Select>
                </FormControl>

                {/* Show selected auth info if not adding new */}
                {!showAddNewForm && selectedAuth && (
                  <Box sx={{ 
                    mt: 2, 
                    p: 2, 
                    backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                    borderRadius: 2,
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 20 }} />
                      <Typography sx={{ color: 'white', fontWeight: 500 }}>
                        Using: {selectedAuth.label || 'Selected authentication'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 1 }}>
                      This authentication is already configured. Select "Add new authentication" to create another one.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Show message when no auths exist or "Add new" is selected */}
            {(apiAuthEntries.length === 0 || showAddNewForm) && (
              <Box sx={{ 
                p: 3, 
                backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
              }}>
                <Typography variant="subtitle2" sx={{ color: '#FF6600', fontWeight: 600, mb: 2 }}>
                  {apiAuthEntries.length === 0 ? 'No Authentication Configured' : 'Add New Authentication'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 3 }}>
                  Use the button below to authenticate with {app.name.replace(/_/g, ' ')} via Shuffle.
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={
                    app.image_url ? (
                      <Box
                        component="img"
                        src={app.image_url}
                        alt={app.name}
                        sx={{ width: 24, height: 24, borderRadius: 1, objectFit: 'contain' }}
                      />
                    ) : <LockIcon />
                  }
                  onClick={() => {
                    const authUrl = `https://shuffler.io/appauth?app_id=${app.objectID}`;
                    window.open(authUrl, '_blank', 'width=600,height=700');
                  }}
                  sx={{
                    py: 1.5,
                    borderColor: 'rgba(255, 102, 0, 0.4)',
                    color: 'white',
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '1rem',
                    '&:hover': {
                      borderColor: '#FF6600',
                      backgroundColor: 'rgba(255, 102, 0, 0.08)',
                    },
                  }}
                >
                  Connect with {app.name.replace(/_/g, ' ')}
                </Button>
              </Box>
            )}
          </Box>
        </Collapse>
      </Card>

      {/* Documentation Modal */}
      <Dialog
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            maxHeight: '80vh',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {app.image_url && (
              <Box
                component="img"
                src={app.image_url}
                alt={app.name}
                sx={{ width: 32, height: 32, borderRadius: 1, objectFit: 'contain' }}
              />
            )}
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {app.name.replace(/_/g, ' ')} Documentation
            </Typography>
          </Box>
          <IconButton onClick={() => setDocsOpen(false)} sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {docsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} sx={{ color: '#FF6600' }} />
              <Typography sx={{ ml: 2, color: 'rgba(255, 255, 255, 0.5)' }}>
                Loading documentation...
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                '& h1, & h2, & h3, & h4': { color: 'white', mt: 3, mb: 2 },
                '& p': { mb: 2, lineHeight: 1.7 },
                '& code': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.875rem',
                },
                '& pre': {
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  p: 2,
                  borderRadius: 2,
                  overflow: 'auto',
                },
                '& a': { color: '#FF6600' },
                '& ul, & ol': { pl: 3, mb: 2 },
                '& li': { mb: 1 },
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{docsContent}</ReactMarkdown>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export const AppAuthConfig = ({
  apps,
  authStates,
  authenticatedApps = [],
  onAuthChange,
  onTestConnection,
  onSelectAuth,
}: AppAuthConfigProps) => {
  const [expanded, setExpanded] = useState<string | false>(apps[0]?.objectID || false);

  // Helper to find ALL API auth entries for an app
  const getApiAuthEntries = (app: AlgoliaSearchApp): ApiAuthEntry[] => {
    return authenticatedApps.filter(
      auth => auth.app?.name?.toLowerCase() === app.name.toLowerCase()
    );
  };

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
            const apiAuthEntries = getApiAuthEntries(app);

            return (
              <AppAuthCard
                key={app.objectID}
                app={app}
                authState={authState}
                isExpanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? false : app.objectID)}
                onAuthChange={onAuthChange}
                onTestConnection={onTestConnection}
                apiAuthEntries={apiAuthEntries}
                onSelectAuth={onSelectAuth}
              />
            );
          })}
        </Box>
      </motion.div>
    </Box>
  );
};
