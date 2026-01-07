import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Link as MuiLink,
} from '@mui/material';
import { motion } from 'framer-motion';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { getApiUrl, API_ENDPOINTS } from '@/config/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.login), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.reason || data.message || 'Login failed');
      }

      if (data.session_token) {
        localStorage.setItem('session_token', data.session_token);
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: '#1a1a1a',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
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
                Welcome Back!
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.6,
                }}
              >
                Sign in to manage your cases and alerts
              </Typography>
            </Box>

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

            <Box component="form" onSubmit={handleLogin}>
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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#2a2a2a',
                      '& fieldset': {
                        borderColor: '#FF6600',
                        borderWidth: 2,
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
                  }}
                />
              </Box>

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
                  sx={{
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
                  }}
                />
              </Box>

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
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
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
              Don't have an account yet?{' '}
              <MuiLink
                href="https://shuffler.io/register"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: '#FF6600',
                  textDecoration: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                Register here
              </MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
};

export default Login;
