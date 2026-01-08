import { useState } from 'react';
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
} from '@mui/material';
import { motion } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { TicketingSystem } from './TicketingSystemSearch';

export type AuthStatus = 'pending' | 'testing' | 'connected' | 'error';

export interface ToolAuthState {
  systemId: string;
  status: AuthStatus;
  credentials: Record<string, string>;
  errorMessage?: string;
}

interface ToolAuthenticationProps {
  systems: TicketingSystem[];
  authStates: Record<string, ToolAuthState>;
  onAuthChange: (systemId: string, credentials: Record<string, string>) => void;
  onTestConnection: (systemId: string) => void;
}

const authFields: Record<string, { label: string; type: string; placeholder: string }[]> = {
  jira: [
    { label: 'Jira URL', type: 'url', placeholder: 'https://your-domain.atlassian.net' },
    { label: 'Email', type: 'email', placeholder: 'your-email@company.com' },
    { label: 'API Token', type: 'password', placeholder: 'Your Jira API token' },
  ],
  servicenow: [
    { label: 'Instance URL', type: 'url', placeholder: 'https://your-instance.service-now.com' },
    { label: 'Username', type: 'text', placeholder: 'admin' },
    { label: 'Password', type: 'password', placeholder: 'Your password' },
  ],
  zendesk: [
    { label: 'Subdomain', type: 'text', placeholder: 'your-company' },
    { label: 'Email', type: 'email', placeholder: 'your-email@company.com' },
    { label: 'API Token', type: 'password', placeholder: 'Your Zendesk API token' },
  ],
  freshdesk: [
    { label: 'Domain', type: 'text', placeholder: 'your-company.freshdesk.com' },
    { label: 'API Key', type: 'password', placeholder: 'Your Freshdesk API key' },
  ],
  pagerduty: [
    { label: 'API Key', type: 'password', placeholder: 'Your PagerDuty API key' },
  ],
  splunk: [
    { label: 'Splunk URL', type: 'url', placeholder: 'https://your-splunk-instance:8089' },
    { label: 'Username', type: 'text', placeholder: 'admin' },
    { label: 'Password', type: 'password', placeholder: 'Your password' },
  ],
  qradar: [
    { label: 'Console URL', type: 'url', placeholder: 'https://qradar-console' },
    { label: 'SEC Token', type: 'password', placeholder: 'Your QRadar SEC token' },
  ],
  sentinel: [
    { label: 'Workspace ID', type: 'text', placeholder: 'Your Log Analytics workspace ID' },
    { label: 'Primary Key', type: 'password', placeholder: 'Your primary key' },
  ],
  thehive: [
    { label: 'TheHive URL', type: 'url', placeholder: 'https://your-thehive-instance' },
    { label: 'API Key', type: 'password', placeholder: 'Your TheHive API key' },
  ],
  opsgenie: [
    { label: 'API Key', type: 'password', placeholder: 'Your Opsgenie API key' },
  ],
  slack: [
    { label: 'Bot Token', type: 'password', placeholder: 'xoxb-your-bot-token' },
    { label: 'Signing Secret', type: 'password', placeholder: 'Your signing secret' },
  ],
  teams: [
    { label: 'Webhook URL', type: 'url', placeholder: 'https://outlook.office.com/webhook/...' },
  ],
};

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

export const ToolAuthentication = ({
  systems,
  authStates,
  onAuthChange,
  onTestConnection,
}: ToolAuthenticationProps) => {
  const [expanded, setExpanded] = useState<string | false>(systems[0]?.id || false);

  if (systems.length === 0) {
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
        No systems selected. Go back and select at least one ticketing system.
      </Alert>
    );
  }

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
        Configure Authentication
      </Typography>
      <Typography
        variant="body1"
        sx={{ mb: 4, color: 'rgba(255, 255, 255, 0.5)' }}
      >
        Enter the credentials for each selected system. We'll test the connections for you.
      </Typography>

      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {systems.map((system) => {
            const authState = authStates[system.id] || { status: 'pending', credentials: {} };
            const fields = authFields[system.id] || [
              { label: 'API Key', type: 'password', placeholder: 'Your API key' },
            ];
            const isExpanded = expanded === system.id;
            const statusConfig = getStatusConfig(authState.status);

            return (
              <motion.div key={system.id} variants={itemVariants}>
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
                    onClick={() => setExpanded(isExpanded ? false : system.id)}
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
                    <Box
                      sx={{
                        fontSize: '1.5rem',
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 2,
                      }}
                    >
                      {system.icon}
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography sx={{ color: 'white', fontWeight: 600 }}>
                        {system.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                        {system.description}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {fields.map((field, index) => (
                          <TextField
                            key={index}
                            label={field.label}
                            type={field.type}
                            placeholder={field.placeholder}
                            value={authState.credentials[field.label] || ''}
                            onChange={(e) =>
                              onAuthChange(system.id, {
                                ...authState.credentials,
                                [field.label]: e.target.value,
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
                        ))}

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

                        <Button
                          variant="contained"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTestConnection(system.id);
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
                      </Box>
                    </Box>
                  </Collapse>
                </Card>
              </motion.div>
            );
          })}
        </Box>
      </motion.div>
    </Box>
  );
};
