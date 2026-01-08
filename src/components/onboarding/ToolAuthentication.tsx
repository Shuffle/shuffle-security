import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
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

// Define required fields for each system
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

const getStatusIcon = (status: AuthStatus) => {
  switch (status) {
    case 'connected':
      return <CheckCircleIcon sx={{ color: 'hsl(var(--severity-low))' }} />;
    case 'error':
      return <ErrorIcon sx={{ color: 'hsl(var(--severity-critical))' }} />;
    case 'testing':
      return <CircularProgress size={20} sx={{ color: 'hsl(var(--primary))' }} />;
    default:
      return null;
  }
};

const getStatusChip = (status: AuthStatus) => {
  const config = {
    pending: { label: 'Not Configured', color: 'hsl(var(--muted-foreground))' },
    testing: { label: 'Testing...', color: 'hsl(var(--primary))' },
    connected: { label: 'Connected', color: 'hsl(var(--severity-low))' },
    error: { label: 'Error', color: 'hsl(var(--severity-critical))' },
  };
  const { label, color } = config[status];
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        backgroundColor: `${color}20`,
        color: color,
        fontWeight: 500,
        fontSize: '0.7rem',
      }}
    />
  );
};

export const ToolAuthentication = ({
  systems,
  authStates,
  onAuthChange,
  onTestConnection,
}: ToolAuthenticationProps) => {
  const [expanded, setExpanded] = useState<string | false>(systems[0]?.id || false);

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  if (systems.length === 0) {
    return (
      <Alert severity="info" sx={{ backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}>
        No systems selected. Go back and select at least one ticketing system.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1, color: 'hsl(var(--foreground))' }}>
        Configure Authentication
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'hsl(var(--muted-foreground))' }}>
        Enter the credentials for each selected system. We'll test the connections for you.
      </Typography>

      {systems.map((system) => {
        const authState = authStates[system.id] || { status: 'pending', credentials: {} };
        const fields = authFields[system.id] || [
          { label: 'API Key', type: 'password', placeholder: 'Your API key' },
        ];

        return (
          <Accordion
            key={system.id}
            expanded={expanded === system.id}
            onChange={handleChange(system.id)}
            sx={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px !important',
              mb: 1.5,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: '0 0 12px 0' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />}
              sx={{
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center',
                  gap: 2,
                },
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  backgroundColor: 'hsl(var(--muted))',
                  fontSize: '1.1rem',
                }}
              >
                {system.icon}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                  {system.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                  {system.description}
                </Typography>
              </Box>
              {getStatusIcon(authState.status)}
              {getStatusChip(authState.status)}
            </AccordionSummary>
            <AccordionDetails>
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
                        backgroundColor: 'hsl(var(--muted))',
                        '& fieldset': { borderColor: 'hsl(var(--border))' },
                        '&:hover fieldset': { borderColor: 'hsl(var(--border))' },
                        '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                      },
                      '& .MuiInputBase-input': { color: 'hsl(var(--foreground))' },
                      '& .MuiInputLabel-root': { color: 'hsl(var(--muted-foreground))' },
                    }}
                  />
                ))}

                {authState.status === 'error' && authState.errorMessage && (
                  <Alert
                    severity="error"
                    sx={{
                      backgroundColor: 'hsl(var(--severity-critical) / 0.1)',
                      color: 'hsl(var(--severity-critical))',
                    }}
                  >
                    {authState.errorMessage}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  onClick={() => onTestConnection(system.id)}
                  disabled={authState.status === 'testing'}
                  sx={{
                    alignSelf: 'flex-start',
                    backgroundColor: 'hsl(var(--primary))',
                    '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)' },
                  }}
                >
                  {authState.status === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};
