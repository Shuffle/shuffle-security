import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Avatar,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import { getApiUrl, getAuthHeader, API_CONFIG } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { AssignmentScheduleConfig } from '@/components/settings/AssignmentScheduleConfig';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface Settings {
  username?: string;
  id?: string;
  active_org?: {
    name: string;
    id: string;
  };
  apikey?: string;
}

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const { sessionToken, logout, userInfo } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(getApiUrl('/getsettings'), {
          credentials: 'include',
          headers: {
            ...getAuthHeader(sessionToken),
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.reason || 'Failed to fetch settings');
        }

        const data = await response.json();
        setSettings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch settings');
        if (userInfo) {
          setSettings({
            username: userInfo.username,
            id: userInfo.id,
            active_org: userInfo.active_org,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [sessionToken, userInfo]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleClearApiKey = () => {
    API_CONFIG.setApiKey(null);
    window.location.reload();
  };

  const getUserInitial = () => {
    const name = settings?.username || userInfo?.username;
    if (name) {
      return name.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3, color: 'hsl(var(--foreground))' }}>
        Settings
      </Typography>

      <Tabs 
        value={tabValue} 
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{ 
          borderBottom: 1, 
          borderColor: 'hsl(var(--border))',
          '& .MuiTab-root': {
            color: 'hsl(var(--muted-foreground))',
            '&.Mui-selected': {
              color: 'hsl(var(--primary))',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'hsl(var(--primary))',
          },
        }}
      >
        <Tab label="Account" />
        <Tab label="Assignment Schedules" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {error && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: 'hsl(var(--primary))' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 500 }}>
            <Paper 
              sx={{ 
                p: 3,
                bgcolor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Avatar
                  sx={{ 
                    width: 56, 
                    height: 56, 
                    bgcolor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                  }}
                >
                  {getUserInitial()}
                </Avatar>
                <Box>
                  <Typography 
                    variant="h6" 
                    sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  >
                    {settings?.username || userInfo?.username || 'User'}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ color: 'hsl(var(--muted-foreground))' }}
                  >
                    {settings?.active_org?.name || userInfo?.active_org?.name || 'No organization'}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Divider sx={{ borderColor: 'hsl(var(--border))' }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {API_CONFIG.apiKey && (
                <Button
                  variant="outlined"
                  onClick={handleClearApiKey}
                  sx={{
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    '&:hover': {
                      borderColor: 'hsl(var(--primary))',
                      bgcolor: 'hsla(var(--primary), 0.1)',
                    },
                  }}
                >
                  Clear API Key
                </Button>
              )}
              
              <Button
                variant="outlined"
                color="error"
                onClick={handleLogout}
                sx={{
                  borderColor: 'hsl(0, 84%, 60%)',
                  color: 'hsl(0, 84%, 60%)',
                  '&:hover': {
                    borderColor: 'hsl(0, 84%, 50%)',
                    bgcolor: 'hsla(0, 84%, 60%, 0.1)',
                  },
                }}
              >
                Sign Out
              </Button>
            </Box>
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <AssignmentScheduleConfig />
      </TabPanel>
    </Box>
  );
};

export default SettingsPage;
