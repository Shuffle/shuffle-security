import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Avatar,
} from '@mui/material';
import { getApiUrl } from '@/config/api';
import { useAuth } from '@/context/AuthContext';

interface UserInfo {
  username: string;
  id: string;
  active_org?: {
    name: string;
    id: string;
  };
  avatar?: string;
  apikey?: string;
}

const SettingsPage = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { sessionToken, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch(getApiUrl('/me'), {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.reason || 'Failed to fetch user info');
        }

        const data = await response.json();
        setUserInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user info');
      } finally {
        setLoading(false);
      }
    };

    if (sessionToken) {
      fetchUserInfo();
    }
  }, [sessionToken]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ p: 4, maxWidth: 800 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 4 }}>
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : userInfo ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Profile Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Profile
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
              <Avatar
                src={userInfo.avatar}
                sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}
              >
                {userInfo.username?.charAt(0).toUpperCase() || '?'}
              </Avatar>
              <Box>
                <Typography variant="h6">{userInfo.username}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {userInfo.active_org?.name || 'No organization'}
                </Typography>
              </Box>
            </Box>
            <TextField
              label="Username"
              value={userInfo.username || ''}
              fullWidth
              disabled
              sx={{ mb: 2 }}
            />
            <TextField
              label="User ID"
              value={userInfo.id || ''}
              fullWidth
              disabled
            />
          </Paper>

          {/* Organization Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Active Organization
            </Typography>
            <TextField
              label="Organization Name"
              value={userInfo.active_org?.name || ''}
              fullWidth
              disabled
              sx={{ mb: 2 }}
            />
            <TextField
              label="Organization ID"
              value={userInfo.active_org?.id || ''}
              fullWidth
              disabled
            />
          </Paper>

          {/* API Key Section */}
          {userInfo.apikey && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                API Key
              </Typography>
              <TextField
                label="API Key"
                value={userInfo.apikey}
                fullWidth
                disabled
                type="password"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Use this key for API authentication. Keep it secret.
              </Typography>
            </Paper>
          )}

          <Divider />

          {/* Logout */}
          <Box>
            <Button
              variant="outlined"
              color="error"
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </Box>
        </Box>
      ) : (
        <Typography color="text.secondary">No user information available</Typography>
      )}
    </Box>
  );
};

export default SettingsPage;
