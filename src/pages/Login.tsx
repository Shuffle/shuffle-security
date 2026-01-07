import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  Checkbox,
  FormControlLabel,
  Link as MuiLink,
} from '@mui/material';
import { motion } from 'framer-motion';
import SecurityIcon from '@mui/icons-material/Security';
import GoogleIcon from '@mui/icons-material/Google';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        position: 'relative',
      }}
    >
      {/* Background effects */}
      <Box
        sx={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          height: '60%',
          background: 'radial-gradient(ellipse at center, rgba(34, 184, 207, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card sx={{ maxWidth: 440, width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                <SecurityIcon sx={{ color: 'primary.main', fontSize: 36 }} />
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #22b8cf 0%, #0ea5e9 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  SecureOps
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Welcome back
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Sign in to continue to your dashboard
              </Typography>
            </Box>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleIcon />}
              sx={{ mb: 3, py: 1.5 }}
            >
              Continue with Google
            </Button>

            <Divider sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', px: 2 }}>
                or sign in with email
              </Typography>
            </Divider>

            <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <FormControlLabel
                  control={<Checkbox size="small" />}
                  label={<Typography variant="body2">Remember me</Typography>}
                />
                <MuiLink
                  component={Link}
                  to="#"
                  sx={{ fontSize: '0.875rem', color: 'primary.main', textDecoration: 'none' }}
                >
                  Forgot password?
                </MuiLink>
              </Box>

              <Button
                component={Link}
                to="/dashboard"
                variant="contained"
                size="large"
                fullWidth
                sx={{ py: 1.5, mt: 1 }}
              >
                Sign In
              </Button>
            </Box>

            <Typography variant="body2" sx={{ textAlign: 'center', mt: 3, color: 'text.secondary' }}>
              Don't have an account?{' '}
              <MuiLink
                component={Link}
                to="#"
                sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 600 }}
              >
                Sign up
              </MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
};

export default Login;
