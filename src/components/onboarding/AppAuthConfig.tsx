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
import LockIcon from '@mui/icons-material/Lock';
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
  successMessage?: string;
  workflowId?: string;
  executionId?: string;
}

// Helper to check if auth type is OAuth2 (includes oauth2-app variant)
const isOAuth2Type = (type: string | undefined): boolean => {
  if (!type) return false;
  const lowerType = type.toLowerCase();
  return lowerType === 'oauth2' || lowerType === 'oauth2-app';
};

// URL validation helper
const isValidUrl = (value: string): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
  onTestConnection: (appId: string, authenticationId?: string) => void;
  onSaveAuth: (appId: string, credentials: Record<string, string>) => Promise<boolean>;
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
  onSaveAuth,
  apiAuthEntries,
  onSelectAuth,
}: {
  app: AlgoliaSearchApp;
  authState: AppAuthState;
  isExpanded: boolean;
  onToggle: () => void;
  onAuthChange: (appId: string, credentials: Record<string, string>) => void;
  onTestConnection: (appId: string, authenticationId?: string) => void;
  onSaveAuth: (appId: string, credentials: Record<string, string>) => Promise<boolean>;
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
  
  // Track local test status for the current selection (reset when switching)
  const [localTestStatus, setLocalTestStatus] = useState<'untested' | 'testing' | 'success' | 'error'>('untested');

  // Update selection when apiAuthEntries changes, but only if user didn't explicitly choose "Add new"
  useEffect(() => {
    if (apiAuthEntries.length > 0 && !userSelectedAddNew) {
      setSelectedAuthId(getBestDefaultAuth(apiAuthEntries));
    }
  }, [apiAuthEntries, userSelectedAddNew]);
  
  // Reset local test status when auth selection changes
  useEffect(() => {
    setLocalTestStatus('untested');
  }, [selectedAuthId]);
  
  // Sync local test status with authState
  useEffect(() => {
    if (authState.status === 'testing') {
      setLocalTestStatus('testing');
    } else if (authState.status === 'connected') {
      setLocalTestStatus('success');
    } else if (authState.status === 'error') {
      setLocalTestStatus('error');
    }
  }, [authState.status]);

  const showAddNewForm = selectedAuthId === ADD_NEW_AUTH;
  
  // Get the currently selected auth entry
  const selectedAuth = apiAuthEntries.find(
    auth => (auth.id || auth.label || '') === selectedAuthId
  );

  // Compute configured/tested status from selected auth entry
  const isConfigured = selectedAuth?.active === true || apiAuthEntries.some(a => a.active === true);
  const isTested = selectedAuth?.validation?.valid === true || apiAuthEntries.some(a => a.validation?.valid === true);

  // Local credentials state for the form
  const [localCredentials, setLocalCredentials] = useState<Record<string, string>>(authState.credentials || {});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // App config fetching for dynamic fields
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<DecodedApp | null>(null);

  useEffect(() => {
    const fetchAppConfig = async () => {
      if (!isExpanded || appConfig) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(getApiUrl(`/api/v1/apps/${app.objectID}/config`), {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch app configuration');
        }
        
        const data = await response.json();
        
        if (data.success && data.app) {
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

  const auth = appConfig?.authentication;
  const isOAuth2 = isOAuth2Type(auth?.type);

  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  // Update scopes when auth loads
  useEffect(() => {
    if (auth?.scope) {
      setSelectedScopes(auth.scope);
    }
  }, [auth?.scope]);

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsContent, setDocsContent] = useState<string>('');
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchDocs = async () => {
    setDocsLoading(true);
    try {
      const encodedName = encodeURIComponent(app.name);
      const response = await fetch(getApiUrl(`/api/v1/docs/${encodedName}?location=openapi`), {
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
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

  // Render OAuth2 fields - only for OAuth2 apps
  const renderOAuth2Fields = () => {
    if (!auth || !isOAuth2) return null;

    const availableScopes = auth.scope || [];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Quick Connect Button - OAuth2 only */}
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
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.875rem' }}>OR configure manually</Typography>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
        </Box>

        {/* Manual OAuth2 Fields */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Redirect URL: <Typography component="span" sx={{ color: '#FF6600', fontWeight: 600 }}>
              {auth.redirect_uri || 'https://shuffler.io/set_authentication'}
            </Typography>
          </Typography>

          <TextField
            label="Client ID"
            placeholder="Enter your Client ID"
            value={localCredentials['client_id'] || ''}
            onChange={(e) => handleCredentialChange('client_id', e.target.value)}
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

          <TextField
            label="Client Secret"
            type="password"
            placeholder="Enter your Client Secret"
            value={localCredentials['client_secret'] || ''}
            onChange={(e) => handleCredentialChange('client_secret', e.target.value)}
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

          {/* Scopes */}
          {availableScopes.length > 0 && (
            <FormControl fullWidth size="small">
              <Select
                multiple
                value={selectedScopes}
                onChange={(e) => {
                  const value = e.target.value as string[];
                  setSelectedScopes(value);
                  handleCredentialChange('scopes', value.join(' '));
                }}
                input={<OutlinedInput />}
                renderValue={(selected) => selected.length === 0 ? 'Select Scopes' : `${selected.length} scope(s) selected`}
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
          )}
        </Box>
      </Box>
    );
  };

  // Render parameter fields - for non-OAuth2 apps with parameters
  const renderParameterFields = () => {
    if (isOAuth2) return null;
    if (!auth?.parameters || auth.parameters.length === 0) return null;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {auth.parameters.map((param, index) => {
          // Use param.id if available, otherwise fallback to name or index
          const fieldKey = param.id || param.name || `param_${index}`;
          return (
            <TextField
              key={fieldKey}
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
              value={localCredentials[fieldKey] || ''}
              onChange={(e) => handleCredentialChange(fieldKey, e.target.value)}
              error={!!fieldErrors[fieldKey]}
              helperText={fieldErrors[fieldKey] || param.description}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: fieldErrors[fieldKey] ? '#ef4444' : 'rgba(255, 255, 255, 0.1)' },
                  '&:hover fieldset': { borderColor: fieldErrors[fieldKey] ? '#ef4444' : 'rgba(255, 255, 255, 0.2)' },
                  '&.Mui-focused fieldset': { borderColor: fieldErrors[fieldKey] ? '#ef4444' : '#FF6600' },
                },
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
                '& .MuiFormHelperText-root': { color: fieldErrors[fieldKey] ? '#ef4444' : 'rgba(255, 255, 255, 0.4)' },
              }}
            />
          );
        })}
      </Box>
    );
  };

  // Render generic API key field - for non-OAuth2 apps without parameters
  const renderApiKeyFields = () => {
    if (isOAuth2 || (auth?.parameters && auth.parameters.length > 0)) return null;

    return (
      <TextField
        label="API Key"
        type="password"
        placeholder="Enter your API key"
        value={localCredentials['api_key'] || ''}
        onChange={(e) => handleCredentialChange('api_key', e.target.value)}
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

  // Validate a single field
  const validateField = (key: string, value: string): string | null => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('url') || lowerKey === 'url') {
      if (!value) return 'URL is required';
      if (!isValidUrl(value)) return 'Please enter a valid URL (e.g., https://example.com)';
    }
    return null;
  };

  // Check if all required fields are valid for saving
  const isFormValid = (): boolean => {
    // Must have at least one credential
    if (Object.keys(localCredentials).length === 0) return false;
    
    // Check for any field errors
    if (Object.values(fieldErrors).some(err => err)) return false;
    
    // Validate all current credentials
    for (const [key, value] of Object.entries(localCredentials)) {
      const error = validateField(key, value);
      if (error) return false;
    }
    
    // Check required parameters are filled
    if (auth?.parameters) {
      for (let i = 0; i < auth.parameters.length; i++) {
        const param = auth.parameters[i];
        const fieldKey = param.id || param.name || `param_${i}`;
        if (param.required && !localCredentials[fieldKey]) return false;
      }
    }
    
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(null);
    const success = await onSaveAuth(app.objectID, localCredentials);
    setSaving(false);
    setSaveSuccess(success);
    if (success) {
      setUserSelectedAddNew(false);
      setLocalCredentials({}); // Clear form after success
      setFieldErrors({}); // Clear errors
    }
  };

  // Helper to update local credentials and notify parent
  const handleCredentialChange = (key: string, value: string) => {
    // Ignore empty keys
    if (!key || key.trim() === '') return;
    
    const updated = { ...localCredentials, [key]: value };
    setLocalCredentials(updated);
    onAuthChange(app.objectID, updated);
    
    // Validate the field
    const error = validateField(key, value);
    setFieldErrors(prev => ({
      ...prev,
      [key]: error || '',
    }));
  };

  return (
    <motion.div variants={itemVariants} style={{ width: '100%', maxWidth: '100%' }}>
      <Card
        sx={{
          background: 'rgba(33, 33, 33, 0.6)',
          border: '2px solid',
          borderColor: isTested
            ? 'rgba(34, 197, 94, 0.5)'
            : authState.status === 'error'
            ? 'rgba(239, 68, 68, 0.3)'
            : 'rgba(255, 152, 0, 0.3)',
          borderRadius: 3,
          backdropFilter: 'blur(10px)',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        <CardContent
          onClick={onToggle}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: { xs: 1.5, sm: 2 },
            cursor: 'pointer',
            p: { xs: 2, sm: 3 },
            '&:last-child': { pb: { xs: 2, sm: 3 } },
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            {app.image_url ? (
              <Box
                component="img"
                src={app.image_url}
                alt={app.name}
                sx={{
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  borderRadius: 2,
                  objectFit: 'contain',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  p: 1,
                  flexShrink: 0,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 2,
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                🔗
              </Box>
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography 
                sx={{ 
                  color: 'white', 
                  fontWeight: 600, 
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {app.name.replace(/_/g, ' ')}
              </Typography>
              {app.description && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.4)',
                    display: { xs: 'none', md: 'block' },
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}
                >
                  {app.description}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 1, sm: 1.5 }, 
            flexWrap: 'wrap',
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          }}>
            {/* Configured status chip */}
            <Chip
              label={isConfigured ? 'Configured' : 'Not configured'}
              size="small"
              sx={{
                backgroundColor: isConfigured ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isConfigured ? '#f59e0b' : '#ef4444',
                fontWeight: 500,
                fontSize: { xs: '0.6rem', sm: '0.65rem' },
                height: { xs: 22, sm: 24 },
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
                fontSize: { xs: '0.6rem', sm: '0.65rem' },
                height: { xs: 22, sm: 24 },
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
              px: { xs: 2, sm: 3 },
              pb: { xs: 2, sm: 3 },
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
                    p: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 3,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                  }}>
                    {/* Active authentication header */}
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: { xs: 2, sm: 2.5 },
                      py: 1.5,
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    }}>
                      <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: localTestStatus === 'success' 
                          ? '#22c55e' 
                          : localTestStatus === 'error'
                          ? '#ef4444'
                          : '#9ca3af',
                        boxShadow: localTestStatus === 'success' 
                          ? '0 0 8px rgba(34, 197, 94, 0.6)'
                          : localTestStatus === 'error'
                          ? '0 0 8px rgba(239, 68, 68, 0.6)'
                          : '0 0 8px rgba(156, 163, 175, 0.4)',
                      }} />
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.5)', 
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {localTestStatus === 'success' 
                          ? 'Verified Authentication' 
                          : localTestStatus === 'error'
                          ? 'Test Failed'
                          : 'Pending Verification'}
                      </Typography>
                    </Box>

                    {/* Main content area */}
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'stretch', sm: 'center' }, 
                      justifyContent: 'space-between', 
                      gap: { xs: 2, sm: 3 },
                      p: { xs: 2, sm: 2.5 },
                    }}>
                      {/* Auth name with icon */}
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5, 
                        minWidth: 0,
                        flex: 1,
                      }}>
                        <Box sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: localTestStatus === 'success' 
                            ? 'rgba(34, 197, 94, 0.1)' 
                            : localTestStatus === 'error'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(156, 163, 175, 0.1)',
                          border: `1px solid ${
                            localTestStatus === 'success' 
                              ? 'rgba(34, 197, 94, 0.2)' 
                              : localTestStatus === 'error'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(156, 163, 175, 0.2)'
                          }`,
                          flexShrink: 0,
                        }}>
                          <CheckCircleIcon sx={{ 
                            color: localTestStatus === 'success' 
                              ? '#22c55e' 
                              : localTestStatus === 'error'
                              ? '#ef4444'
                              : '#9ca3af', 
                            fontSize: 20 
                          }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ 
                            color: 'white', 
                            fontWeight: 600, 
                            fontSize: { xs: '0.9rem', sm: '0.95rem' },
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.3,
                          }}>
                            {selectedAuth.label || 'Selected authentication'}
                          </Typography>
                          <Typography sx={{ 
                            color: localTestStatus === 'success' 
                              ? '#22c55e' 
                              : localTestStatus === 'error'
                              ? '#ef4444'
                              : 'rgba(255, 255, 255, 0.4)', 
                            fontSize: '0.75rem',
                            mt: 0.25,
                            fontWeight: localTestStatus !== 'untested' ? 500 : 400,
                          }}>
                            {localTestStatus === 'success' 
                              ? '✓ Connection verified' 
                              : localTestStatus === 'error'
                              ? '✗ Test failed'
                              : localTestStatus === 'testing'
                              ? 'Testing...'
                              : 'Not tested yet'}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Test Connection button */}
                      <Button
                        variant={authState.status === 'testing' ? 'contained' : 'outlined'}
                        size="medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTestConnection(app.objectID, selectedAuthId !== ADD_NEW_AUTH ? selectedAuthId : undefined);
                        }}
                        disabled={authState.status === 'testing'}
                        startIcon={
                          authState.status === 'testing' 
                            ? <CircularProgress size={16} sx={{ color: 'inherit' }} />
                            : <CheckCircleIcon sx={{ fontSize: 18 }} />
                        }
                        sx={{
                          borderColor: authState.status === 'testing' ? 'transparent' : 'rgba(255, 102, 0, 0.5)',
                          color: authState.status === 'testing' ? 'rgba(255, 255, 255, 0.9)' : '#FF6600',
                          background: authState.status === 'testing' 
                            ? 'linear-gradient(90deg, rgba(255, 102, 0, 0.3) 0%, rgba(255, 102, 0, 0.5) 50%, rgba(255, 102, 0, 0.3) 100%)'
                            : 'transparent',
                          backgroundSize: authState.status === 'testing' ? '200% 100%' : 'auto',
                          animation: authState.status === 'testing' ? 'shimmer 1.5s infinite linear' : 'none',
                          fontWeight: 600,
                          textTransform: 'none',
                          px: 3,
                          py: 1,
                          borderRadius: 2,
                          flexShrink: 0,
                          minWidth: 160,
                          width: { xs: '100%', sm: 'auto' },
                          transition: 'all 0.3s ease',
                          '@keyframes shimmer': {
                            '0%': { backgroundPosition: '200% 0' },
                            '100%': { backgroundPosition: '-200% 0' },
                          },
                          '&:hover': {
                            borderColor: '#FF6600',
                            backgroundColor: authState.status === 'testing' ? undefined : 'rgba(255, 102, 0, 0.08)',
                          },
                          '&.Mui-disabled': {
                            color: authState.status === 'testing' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.3)',
                            borderColor: authState.status === 'testing' ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
                          },
                        }}
                      >
                        {authState.status === 'testing' ? 'Testing Connection...' : 'Test Connection'}
                      </Button>
                    </Box>

                    {/* Status messages */}
                    {authState.status === 'error' && authState.errorMessage && (
                      <Box sx={{ 
                        px: { xs: 2, sm: 2.5 }, 
                        pb: { xs: 2, sm: 2.5 },
                      }}>
                        <Alert
                          severity="error"
                          sx={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 2,
                            '& .MuiAlert-icon': { color: '#ef4444' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '100%' }}>
                            <Typography sx={{ fontSize: '0.875rem', flex: 1 }}>
                              {authState.errorMessage}
                            </Typography>
                            {authState.workflowId && authState.executionId && (
                              <Button
                                variant="outlined"
                                size="small"
                                href={`https://shuffler.io/workflows/${authState.workflowId}?execution_id=${authState.executionId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  borderColor: 'rgba(239, 68, 68, 0.5)',
                                  color: '#ef4444',
                                  textTransform: 'none',
                                  fontSize: '0.75rem',
                                  py: 0.5,
                                  px: 1.5,
                                  flexShrink: 0,
                                  '&:hover': {
                                    borderColor: '#ef4444',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  },
                                }}
                              >
                                View Execution
                              </Button>
                            )}
                          </Box>
                        </Alert>
                      </Box>
                    )}
                    {authState.status === 'connected' && (
                      <Box sx={{ 
                        px: { xs: 2, sm: 2.5 }, 
                        pb: { xs: 2, sm: 2.5 },
                      }}>
                        <Alert
                          severity="success"
                          sx={{
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            color: '#22c55e',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: 2,
                            '& .MuiAlert-icon': { color: '#22c55e' },
                          }}
                        >
                          {authState.successMessage || 'Connection verified successfully'}
                        </Alert>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* Show form when no auths exist or "Add new" is selected */}
            {(apiAuthEntries.length === 0 || showAddNewForm) && (
              <Box sx={{ 
                p: 3, 
                backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                <Typography variant="subtitle2" sx={{ color: '#FF6600', fontWeight: 600, mb: 2 }}>
                  {apiAuthEntries.length === 0 ? 'Configure Authentication' : 'Add New Authentication'}
                </Typography>
                
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
                    {/* Render dynamic fields based on auth type */}
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
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '100%' }}>
                          <Typography sx={{ fontSize: '0.875rem', flex: 1 }}>
                            {authState.errorMessage}
                          </Typography>
                          {authState.workflowId && authState.executionId && (
                            <Button
                              variant="outlined"
                              size="small"
                              href={`https://shuffler.io/workflows/${authState.workflowId}?execution_id=${authState.executionId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                borderColor: 'rgba(239, 68, 68, 0.5)',
                                color: '#ef4444',
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                py: 0.5,
                                px: 1.5,
                                flexShrink: 0,
                                '&:hover': {
                                  borderColor: '#ef4444',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                },
                              }}
                            >
                              View Execution
                            </Button>
                          )}
                        </Box>
                      </Alert>
                    )}

                    {saveSuccess === true && (
                      <Alert
                        severity="success"
                        sx={{
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          color: '#22c55e',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          borderRadius: 2,
                        }}
                      >
                        Authentication saved successfully!
                      </Alert>
                    )}

                    {saveSuccess === false && (
                      <Alert
                        severity="error"
                        sx={{
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 2,
                        }}
                      >
                        Failed to save authentication. Please try again.
                      </Alert>
                    )}

                    {/* Save and Test buttons */}
                    {!isOAuth2 && (
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSave();
                          }}
                          disabled={saving || !isFormValid()}
                          sx={{
                            flex: 1,
                            borderColor: 'rgba(255, 102, 0, 0.4)',
                            color: 'white',
                            fontWeight: 600,
                            textTransform: 'none',
                            fontSize: { xs: '0.875rem', sm: '1rem' },
                            py: { xs: 1.25, sm: 1 },
                            '&:hover': {
                              borderColor: '#FF6600',
                              backgroundColor: 'rgba(255, 102, 0, 0.08)',
                            },
                            '&.Mui-disabled': {
                              borderColor: 'rgba(255, 255, 255, 0.1)',
                              color: 'rgba(255, 255, 255, 0.3)',
                            },
                          }}
                        >
                          {saving ? 'Saving...' : 'Save Authentication'}
                        </Button>
                        <Button
                          variant="contained"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTestConnection(app.objectID, selectedAuthId !== ADD_NEW_AUTH ? selectedAuthId : undefined);
                          }}
                          disabled={authState.status === 'testing' || !isConfigured}
                          sx={{
                            flex: 1,
                            background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                            boxShadow: '0 4px 14px rgba(255, 102, 0, 0.25)',
                            fontWeight: 600,
                            textTransform: 'none',
                            fontSize: { xs: '0.875rem', sm: '1rem' },
                            py: { xs: 1.25, sm: 1 },
                            '&:hover': {
                              background: 'linear-gradient(135deg, #FF8533 0%, #FF9955 100%)',
                            },
                            '&.Mui-disabled': {
                              background: 'rgba(255, 255, 255, 0.1)',
                              color: 'rgba(255, 255, 255, 0.3)',
                            },
                          }}
                        >
                          {authState.status === 'testing' ? 'Testing...' : !isConfigured ? 'Save First to Test' : 'Test Connection'}
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
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
  onSaveAuth,
  onSelectAuth,
}: AppAuthConfigProps) => {
  // Helper to find ALL API auth entries for an app
  const getApiAuthEntries = (app: AlgoliaSearchApp): ApiAuthEntry[] => {
    return authenticatedApps.filter(
      auth => auth.app?.name?.toLowerCase() === app.name.toLowerCase()
    );
  };

  // Helper to check if app is validated
  const isAppValidated = (app: AlgoliaSearchApp): boolean => {
    const entries = getApiAuthEntries(app);
    return entries.some(e => e.validation?.valid === true);
  };

  // Sort apps: non-validated first, validated at bottom
  const sortedApps = [...apps].sort((a, b) => {
    const aValidated = isAppValidated(a);
    const bValidated = isAppValidated(b);
    if (aValidated && !bValidated) return 1;
    if (!aValidated && bValidated) return -1;
    return 0;
  });

  // Find first non-validated app for auto-expand
  const firstInvalidApp = sortedApps.find(app => !isAppValidated(app));
  const defaultExpanded = firstInvalidApp?.objectID || sortedApps[0]?.objectID || false;

  const [expanded, setExpanded] = useState<string | false>(defaultExpanded);

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

  // Count validated vs total
  const validatedCount = sortedApps.filter(app => isAppValidated(app)).length;
  const totalCount = sortedApps.length;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <Typography
        variant="h5"
        sx={{
          color: 'white',
          fontWeight: 700,
          mb: 1,
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
        }}
      >
        Configure Authentication
      </Typography>
      <Typography
        variant="body1"
        sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.5)', fontSize: { xs: '0.875rem', sm: '1rem' } }}
      >
        Set up credentials for each integration. Apps with orange borders need configuration.
      </Typography>
      <Chip
        label={`${validatedCount}/${totalCount} validated`}
        size="small"
        sx={{
          mb: 3,
          background: validatedCount === totalCount 
            ? 'rgba(34, 197, 94, 0.15)' 
            : 'rgba(255, 152, 0, 0.15)',
          color: validatedCount === totalCount ? '#22c55e' : '#ff9800',
          fontWeight: 600,
        }}
      />

      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: '100%' }}>
          {sortedApps.map((app) => {
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
                onSaveAuth={onSaveAuth}
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
