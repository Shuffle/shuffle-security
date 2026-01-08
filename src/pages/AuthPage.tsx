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
} from '@mui/material';
import { motion } from 'framer-motion';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { getApiUrl, API_ENDPOINTS, API_CONFIG } from '@/config/api';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { useAuth } from '@/context/AuthContext';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const AuthPage = ({ mode }: AuthPageProps) => {
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
  const from = location.state?.from?.pathname || '/dashboard/cases';

  // Redirect if already authenticated (e.g., via API key)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <Box 
        sx={{ 
          minHeight: '100vh', 
          bgcolor: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: '#FF6600' }} />
      </Box>
    );
  }

  // Clear form when switching modes
  useEffect(() => {
    setError('');
    setPassword('');
    setConfirmPassword('');
    setMfaRequired(false);
    setMfaCode('');
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

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

      const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // Handle MFA redirect
      if (data.reason === 'MFA_REDIRECT') {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.reason || data.message || `${isLogin ? 'Login' : 'Registration'} failed`);
      }

      // Extract session token from cookies array or direct field
      const sessionToken = data.session_token || 
        data.cookies?.find((c: { key: string; value: string }) => c.key === 'session_token')?.value;

      if (sessionToken) {
        setSuccess(true);
        setLoading(false);
        await login(sessionToken);
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 1500);
        return;
      } else if (!isLogin) {
        // Registration successful, redirect to login
        navigate('/login', { state: { message: 'Registration successful. Please log in.' } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `An error occurred during ${isLogin ? 'login' : 'registration'}`);
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: '#2a2a2a',
      '& fieldset': {
        borderColor: 'rgba(255,255,255,0.1)',
      },
      '&:hover fieldset': {
        borderColor: '#FF6600',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#FF6600',
      },
    },
    '& .MuiInputBase-input': {
      color: '#fff',
      '&::placeholder': {
        color: 'rgba(255,255,255,0.4)',
        opacity: 1,
      },
    },
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#1a1a1a' }}>
      <LandingNavbar />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          pt: 12,
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
              bgcolor: '#212121',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ p: 5 }}>
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
                      fill="#FF6600"
                    />
                  </svg>
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    color: '#fff',
                    mb: 1,
                  }}
                >
                  {isLogin ? 'Welcome Back!' : 'Create Account'}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255,255,255,0.5)',
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
                    bgcolor: 'rgba(76,175,80,0.1)',
                    color: '#4caf50',
                    border: '1px solid rgba(76,175,80,0.3)',
                    '& .MuiAlert-icon': { color: '#4caf50' },
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
                    bgcolor: 'rgba(255,102,0,0.1)',
                    color: '#FF6600',
                    border: '1px solid rgba(255,102,0,0.3)',
                    '& .MuiAlert-icon': { color: '#FF6600' },
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
                    bgcolor: 'rgba(244,67,54,0.1)',
                    color: '#f44336',
                    border: '1px solid rgba(244,67,54,0.3)',
                    '& .MuiAlert-icon': { color: '#f44336' },
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
                      color: '#fff',
                    }}
                  >
                    Email
                  </Typography>
                  <TextField
                    type="text"
                    placeholder="username@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth
                    required
                    disabled={loading}
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
                      color: '#fff',
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
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ color: 'rgba(255,255,255,0.5)' }}
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
                        color: '#fff',
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
                        color: '#fff',
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
                        color: 'rgba(255,255,255,0.5)',
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
                    bgcolor: '#494949',
                    color: '#fff',
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '1rem',
                    '&:hover': {
                      bgcolor: '#5a5a5a',
                    },
                    '&.Mui-disabled': {
                      bgcolor: '#3a3a3a',
                      color: 'rgba(255,255,255,0.3)',
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
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                {isLogin ? "Don't have an account yet? " : 'Already have an account? '}
                <Link
                  to={isLogin ? '/register' : '/login'}
                  style={{
                    color: '#FF6600',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  {isLogin ? 'Register here' : 'Sign in'}
                </Link>
              </Typography>

              {/* Developer API Key Section */}
              {isLogin && (
                <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Typography
                    variant="body2"
                    onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                    sx={{
                      textAlign: 'center',
                      color: 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': { color: 'rgba(255,255,255,0.6)' },
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
                            bgcolor: '#2a2a2a',
                            fontSize: '0.875rem',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                            '&:hover fieldset': { borderColor: '#FF6600' },
                            '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                          },
                          '& .MuiInputBase-input': { color: '#fff' },
                        }}
                      />
                      <Button
                        fullWidth
                        size="small"
                        onClick={async () => {
                          if (apiKey.trim()) {
                            API_CONFIG.setApiKey(apiKey.trim());
                            setSuccess(true);
                            await refreshUserInfo();
                            setTimeout(() => {
                              window.location.reload();
                            }, 500);
                          }
                        }}
                        sx={{
                          bgcolor: 'rgba(255,102,0,0.2)',
                          color: '#FF6600',
                          textTransform: 'none',
                          '&:hover': { bgcolor: 'rgba(255,102,0,0.3)' },
                        }}
                      >
                        Save API Key & Login
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
