import { Eye as VisibilityIcon, EyeOff as VisibilityOffIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import { getApiUrl, API_ENDPOINTS, API_CONFIG, isDevEnvironment } from '@/Shuffle-MCPs/api';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { useAuth } from '@/context/AuthContext';
import { trackPredefinedEvent, GA_EVENTS } from '@/lib/analytics';
import { usePageMeta } from '@/hooks/usePageMeta';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const AuthPage = ({ mode }: AuthPageProps) => {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;

  usePageMeta({
    title: mode === 'register' ? 'Create your account' : 'Sign in',
    description: mode === 'register'
      ? 'Create your Shuffle Security account and start automating incident response across 3,000+ integrations.'
      : 'Sign in to Shuffle Security to manage incidents, alerts, and security automation.',
    url: mode === 'register' ? '/register' : '/login',
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [success, setSuccess] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: authLoading, refreshUserInfo } = useAuth();

  const isLogin = mode === 'login';
  
  // Get return URL from state (set by ProtectedRoute) or from URL param (persists on refresh).
  // Prefer `view` (current canonical param); fall back to legacy `returnUrl` for backwards compatibility.
  const searchParams = new URLSearchParams(location.search);
  const returnUrl = searchParams.get('view') || searchParams.get('returnUrl');
  // First login detection: if no explicit returnUrl and user has never logged in, go to onboarding
  const hasLoggedInBefore = localStorage.getItem('shuffle_has_logged_in') === 'true';
  const defaultDestination = hasLoggedInBefore ? '/dashboard' : '/onboarding';
  const from = location.state?.from?.pathname || returnUrl || defaultDestination;

  // Redirect if already authenticated (e.g., via API key)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  // Clear form when switching modes
  useEffect(() => {
    setError('');
    setPassword('');
    setConfirmPassword('');
    setMfaRequired(false);
    setMfaCode('');
  }, [mode]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <Box 
        sx={{ 
          minHeight: '100vh', 
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Track auth attempt
    trackPredefinedEvent(isLogin ? GA_EVENTS.LOGIN_START : GA_EVENTS.REGISTER_START);

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isLogin && password.length < 10) {
      setError('Password must be at least 10 characters');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? API_ENDPOINTS.login : '/users/register';
      const body: Record<string, string> = { username, password };
      
      if (mfaRequired && mfaCode) {
        body.mfa_code = mfaCode;
      }

      let response: Response;
      const apiUrl = getApiUrl(`/api/v1${endpoint}`);
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      } catch (fetchError) {
        // fetch() throws TypeError on network/CORS errors — distinguish them
        const backendOrigin = new URL(apiUrl).origin;
        const isCrossOrigin = backendOrigin !== window.location.origin;
        if (isCrossOrigin) {
          throw new Error(
            `CORS error: The browser blocked the request to ${backendOrigin}. ` +
            `The backend must allow requests from ${window.location.origin}. ` +
            `Check that the server's CORS configuration includes this origin.`
          );
        }
        throw new Error(
          'Network error: Unable to reach the server. Please check your connection and that the backend is running.'
        );
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Server returned invalid response (status: ${response.status})`);
      }

      // Handle MFA redirect
      if (data.reason === 'MFA_REDIRECT') {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.reason || data.message || `${isLogin ? 'Login' : 'Registration'} failed (status: ${response.status})`);
      }

      // Extract session token from cookies array or direct field
      const sessionToken = data.session_token || 
        data.cookies?.find((c: { key: string; value: string }) => c.key === 'session_token')?.value;

      if (sessionToken) {
        // Verify the token works before showing success
        try {
          const verifyResponse = await fetch(getApiUrl('/api/v1/getinfo'), {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (!verifyResponse.ok) {
            // Login API returned a token but the session cookie wasn't set
            const backendOrigin = new URL(getApiUrl('')).origin;
            const isCrossOrigin = backendOrigin !== window.location.origin;
            if (isCrossOrigin) {
              throw new Error(
                `Login succeeded but the session cookie was not set. ` +
                `This usually means the backend at ${backendOrigin} is not configured to set cookies for ${window.location.origin}. ` +
                `Check the backend's cookie domain and SameSite settings.`
              );
            }
            throw new Error('Login succeeded but session verification failed. Please try again.');
          }
        } catch (verifyError) {
          if (verifyError instanceof Error && verifyError.message.includes('cookie')) {
            throw verifyError; // Re-throw our specific cookie error
          }
          // getinfo fetch itself failed (network/CORS)
          const backendOrigin = new URL(getApiUrl('')).origin;
          const isCrossOrigin = backendOrigin !== window.location.origin;
          if (isCrossOrigin) {
            throw new Error(
              `Login succeeded but session verification failed due to a cross-origin issue. ` +
              `The backend at ${backendOrigin} must allow credentials from ${window.location.origin}.`
            );
          }
          throw new Error('Login succeeded but failed to verify session. Please try again.');
        }
        
        setSuccess(true);
        setLoading(false);
        trackPredefinedEvent(GA_EVENTS.LOGIN_SUCCESS);
        const wasFirstLogin = !hasLoggedInBefore;
        localStorage.setItem('shuffle_has_logged_in', 'true');
        await login(sessionToken);

        // Determine post-login destination: honor explicit returnUrl if set.
        // Otherwise, if no incidents exist for this org, send to /dashboard.
        let destination = from;
        const hasExplicitReturn = Boolean(location.state?.from?.pathname || returnUrl);
        if (!hasExplicitReturn && !wasFirstLogin) {
          try {
            const infoRes = await fetch(getApiUrl('/api/v1/getinfo'), {
              method: 'GET',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            });
            const infoData = await infoRes.json();
            const orgId = infoData?.active_org?.id;
            if (orgId) {
              const incRes = await fetch(
                getApiUrl(`/api/v1/orgs/${orgId}/list_cache?category=shuffle-security_incidents&top=1`),
                { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } },
              );
              if (incRes.ok) {
                const incData = await incRes.json();
                const items = incData?.keys || incData?.list || incData?.items || [];
                if (!Array.isArray(items) || items.length === 0) {
                  destination = '/dashboard';
                }
              }
            }
          } catch (err) {
            console.warn('Post-login incident check failed, using default destination', err);
          }
        }

        setTimeout(() => {
          navigate(destination, { replace: true });
        }, 1500);
        return;
      } else if (!isLogin) {
        // Registration successful, redirect to login (preserve returnUrl so post-login lands the user back)
        trackPredefinedEvent(GA_EVENTS.REGISTER_SUCCESS);
        const loginPath = returnUrl
          ? `/login?view=${encodeURIComponent(returnUrl)}`
          : '/login';
        navigate(loginPath, { state: { message: 'Registration successful. Please log in.' } });
      } else {
        throw new Error('Login failed: No session token received');
      }
    } catch (err) {
      trackPredefinedEvent(isLogin ? GA_EVENTS.LOGIN_FAILURE : GA_EVENTS.LOGIN_FAILURE, 
        err instanceof Error ? err.message : 'unknown_error');
      setError(err instanceof Error ? err.message : `An error occurred during ${isLogin ? 'login' : 'registration'}`);
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'background.paper',
      '& fieldset': {
        borderColor: 'divider',
      },
      '&:hover fieldset': {
        borderColor: 'primary.main',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'primary.main',
      },
    },
    '& .MuiInputBase-input': {
      color: 'text.primary',
      '&::placeholder': {
        color: 'text.disabled',
        opacity: 1,
      },
    },
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <LandingNavbar />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'center',
          p: { xs: 2, sm: 3 },
          pt: { xs: 10, sm: 3 },
          mt: { xs: 0, sm: -6 },
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          key={mode}
          style={{ width: '100%', maxWidth: 440 }}
        >
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
              {/* Logo */}
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    mx: 'auto',
                    mb: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <path
                      d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z"
                      fill={primaryColor}
                    />
                  </svg>
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 1,
                  }}
                >
                  {isLogin ? 'Welcome Back!' : 'Create Account'}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.6,
                  }}
                >
                  {isLogin 
                    ? 'Sign in to manage your cases and alerts' 
                    : 'Get started with your security operations'
                  }
                </Typography>
              </Box>

              {success && (
                <Alert
                  severity="success"
                  sx={{
                    mb: 3,
                    bgcolor: 'success.main',
                    color: 'success.contrastText',
                    opacity: 0.9,
                    '& .MuiAlert-icon': { color: 'inherit' },
                  }}
                >
                  Login successful! Redirecting...
                </Alert>
              )}

              {mfaRequired && !success && (
                <Alert
                  severity="info"
                  sx={{
                    mb: 3,
                    bgcolor: (t) => `${t.palette.primary.main}14`,
                    color: 'primary.main',
                    border: '1px solid',
                    borderColor: (t) => `${t.palette.primary.main}4D`,
                    '& .MuiAlert-icon': { color: 'primary.main' },
                  }}
                >
                  Two-factor authentication required
                </Alert>
              )}

              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    bgcolor: (t) => `${t.palette.error.main}14`,
                    color: 'error.main',
                    border: '1px solid',
                    borderColor: (t) => `${t.palette.error.main}4D`,
                    '& .MuiAlert-icon': { color: 'error.main' },
                  }}
                >
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <Box sx={{ mb: 2.5 }}>
                  <Typography
                    component="label"
                    sx={{
                      display: 'block',
                      mb: 1,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'text.primary',
                    }}
                  >
                    Email
                  </Typography>
                  <TextField
                    type="email"
                    placeholder="username@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth
                    required
                    disabled={loading}
                    autoComplete="email"
                    inputProps={{ inputMode: 'email', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }}
                    sx={inputSx}
                  />
                </Box>

                <Box sx={{ mb: isLogin ? 4 : 2.5 }}>
                  <Typography
                    component="label"
                    sx={{
                      display: 'block',
                      mb: 1,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'text.primary',
                    }}
                  >
                    Password
                  </Typography>
                  <TextField
                    type={showPassword ? 'text' : 'password'}
                    placeholder="at least 10 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    required
                    disabled={loading}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            sx={{ color: 'text.secondary' }}
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={inputSx}
                  />
                </Box>

                {!isLogin && (
                  <Box sx={{ mb: 4 }}>
                    <Typography
                      component="label"
                      sx={{
                        display: 'block',
                        mb: 1,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: 'text.primary',
                      }}
                    >
                      Confirm Password
                    </Typography>
                    <TextField
                      type={showPassword ? 'text' : 'password'}
                      placeholder="re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      fullWidth
                      required
                      disabled={loading}
                      autoComplete="new-password"
                      sx={inputSx}
                    />
                  </Box>
                )}

                {mfaRequired && (
                  <Box sx={{ mb: 4 }}>
                    <Typography
                      component="label"
                      sx={{
                        display: 'block',
                        mb: 1,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: 'text.primary',
                      }}
                    >
                      MFA Code
                    </Typography>
                    <TextField
                      type="text"
                      placeholder="Enter your MFA code"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      fullWidth
                      required
                      autoFocus
                      disabled={loading}
                      inputProps={{ 
                        maxLength: 6,
                        inputMode: 'numeric',
                        pattern: '[0-9]*'
                      }}
                      sx={inputSx}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 1,
                        color: 'text.secondary',
                      }}
                    >
                      Enter the code from your authenticator app
                    </Typography>
                  </Box>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '1rem',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'action.disabledBackground',
                      color: 'text.disabled',
                    },
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : isLogin ? (
                    'Continue'
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  mt: 4,
                  color: 'text.secondary',
                }}
              >
                {isLogin ? 'Do not have an account yet? ' : 'Already have an account? '}
                <Link
                  to={isLogin ? '/register' : '/login'}
                  style={{
                    color: 'hsl(var(--primary))',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  {isLogin ? 'Register here' : 'Sign in'}
                </Link>
              </Typography>

              {/* Developer API Key Section - only in Lovable preview */}
              {isLogin && isDevEnvironment() && (
                <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography
                    variant="body2"
                    onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                    sx={{
                      textAlign: 'center',
                      color: 'text.disabled',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': { color: 'text.secondary' },
                    }}
                  >
                    {showApiKeyInput ? '▼ Hide API Key Login' : '▶ Developer: Use API Key'}
                  </Typography>
                  
                  {showApiKeyInput && (
                    <Box sx={{ mt: 2 }}>
                      <TextField
                        type="password"
                        placeholder="Enter your Shuffle API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        fullWidth
                        size="small"
                        sx={{
                          mb: 1.5,
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'background.paper',
                            fontSize: '0.875rem',
                            '& fieldset': { borderColor: 'divider' },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                          },
                          '& .MuiInputBase-input': { color: 'text.primary' },
                        }}
                      />
                      <Button
                        fullWidth
                        size="small"
                        disabled={loading}
                        onClick={async () => {
                          if (!apiKey.trim()) return;
                          
                          setLoading(true);
                          setError('');
                          
                          try {
                            // Store API key temporarily to test it
                            API_CONFIG.setApiKey(apiKey.trim());
                            
                            // Verify the API key works by calling getinfo
                            let response: Response;
                            try {
                              response = await fetch(getApiUrl('/api/v1/getinfo'), {
                                method: 'GET',
                                credentials: 'include',
                                headers: {
                                  'Authorization': `Bearer ${apiKey.trim()}`,
                                  'Content-Type': 'application/json',
                                },
                              });
                            } catch (fetchError) {
                              // Network error, CORS error, or connection refused
                              API_CONFIG.setApiKey(null); // Remove invalid key
                              throw new Error('Network error: Unable to connect to server. Please check your connection.');
                            }
                            
                            let data: any;
                            try {
                              data = await response.json();
                            } catch (parseError) {
                              API_CONFIG.setApiKey(null);
                              throw new Error(`Server returned invalid response (status: ${response.status})`);
                            }
                            
                            if (!response.ok || data.success !== true) {
                              API_CONFIG.setApiKey(null);
                              throw new Error(data.reason || 'Invalid API key');
                            }
                            
                            // API key is valid
                            setSuccess(true);
                            localStorage.setItem('shuffle_has_logged_in', 'true');
                            await refreshUserInfo();
                            setTimeout(() => {
                              window.location.reload();
                            }, 500);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to authenticate with API key');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        sx={{
                          bgcolor: (t) => `${t.palette.primary.main}33`,
                          color: 'primary.main',
                          textTransform: 'none',
                          '&:hover': { bgcolor: (t) => `${t.palette.primary.main}4D` },
                        }}
                      >
                        {loading ? <CircularProgress size={18} color="inherit" /> : 'Save API Key & Login'}
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </Box>
  );
};

export default AuthPage;
