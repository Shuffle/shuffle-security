import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Switch,
  Card,
  CardContent,
  Chip,
  IconButton,
  Collapse,
  TextField,
  Avatar,
} from '@mui/material';
import { motion } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import EmailIcon from '@mui/icons-material/Email';
import ChatIcon from '@mui/icons-material/Chat';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface EnrichmentOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: 'enrichment' | 'response';
  configFields?: { label: string; placeholder: string; type?: string }[];
  // For dynamic options with connected apps
  connectedApps?: ConnectedApp[];
}

interface ConnectedApp {
  id: string;
  name: string;
  image?: string;
}

// Base static options
const baseEnrichmentOptions: Omit<EnrichmentOption, 'connectedApps'>[] = [
  {
    id: 'automatic_ingestion',
    name: 'Automatic Ingestion',
    description: 'Automatically ingest and normalize data from connected tools',
    icon: <DownloadIcon />,
    color: '#22c55e',
    category: 'enrichment',
  },
  {
    id: 'integration_search',
    name: 'Integration Search',
    description: 'Search across all connected tools simultaneously for IOCs and context',
    icon: <TravelExploreIcon />,
    color: '#3b82f6',
    category: 'enrichment',
  },
  {
    id: 'threat_list',
    name: 'Threat List Comparisons',
    description: 'Compare indicators against known threat intelligence lists',
    icon: <SecurityIcon />,
    color: '#ef4444',
    category: 'enrichment',
  },
];

export interface EnrichmentState {
  [key: string]: {
    enabled: boolean;
    config: Record<string, string>;
  };
}

// Type for authenticated apps from API
interface ApiAuthEntry {
  app: {
    id: string;
    name: string;
    large_image?: string;
    categories?: string[];
  };
  active?: boolean;
  validation?: {
    valid: boolean;
    error?: string;
  };
}

interface EnrichmentConfigProps {
  enrichmentState: EnrichmentState;
  onEnrichmentChange: (state: EnrichmentState) => void;
  authenticatedApps?: ApiAuthEntry[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// Email app detection
const EMAIL_APP_PATTERNS = ['gmail', 'outlook', 'email', 'microsoft_graph', 'office365', 'exchange', 'imap', 'smtp'];
const isEmailApp = (appName: string) => 
  EMAIL_APP_PATTERNS.some(pattern => appName.toLowerCase().includes(pattern));

// Communication app detection
const COMMUNICATION_CATEGORIES = ['COMMUNICATION', 'communication', 'Communication'];
const isCommunicationApp = (app: ApiAuthEntry) => {
  const categories = app.app.categories || [];
  return categories.some(cat => COMMUNICATION_CATEGORIES.includes(cat)) ||
    ['slack', 'teams', 'discord', 'mattermost', 'telegram', 'webhook'].some(
      pattern => app.app.name.toLowerCase().includes(pattern)
    );
};

export const EnrichmentConfig = ({ 
  enrichmentState, 
  onEnrichmentChange,
  authenticatedApps = [],
}: EnrichmentConfigProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build dynamic options based on connected apps
  const enrichmentOptions = useMemo(() => {
    const options: EnrichmentOption[] = [...baseEnrichmentOptions];
    
    // Get validated/active apps
    const validatedApps = authenticatedApps.filter(
      auth => auth.active || auth.validation?.valid
    );
    
    // Email apps for Email Notifications
    const emailApps = validatedApps.filter(auth => isEmailApp(auth.app.name));
    
    // Communication apps for Chat Notifications
    const commApps = validatedApps.filter(auth => isCommunicationApp(auth));
    
    // Add Email Notifications if email apps are connected
    options.push({
      id: 'email_notify',
      name: 'Email Notifications',
      description: emailApps.length > 0 
        ? 'Send email alerts for critical severity issues'
        : 'Connect an email tool (Gmail, Outlook) to enable email notifications',
      icon: <EmailIcon />,
      color: '#22c55e',
      category: 'response',
      connectedApps: emailApps.map(auth => ({
        id: auth.app.id,
        name: auth.app.name,
        image: auth.app.large_image,
      })),
    });
    
    // Add Chat Notifications with connected communication tools
    options.push({
      id: 'chat_notify',
      name: 'Chat Notifications',
      description: commApps.length > 0 
        ? 'Post alerts to your connected communication tools'
        : 'Connect a chat tool (Slack, Teams, Discord) to enable chat notifications',
      icon: <ChatIcon />,
      color: '#8b5cf6',
      category: 'response',
      connectedApps: commApps.map(auth => ({
        id: auth.app.id,
        name: auth.app.name,
        image: auth.app.large_image,
      })),
    });
    
    return options;
  }, [authenticatedApps]);

  const toggleOption = (id: string) => {
    const current = enrichmentState[id] || { enabled: false, config: {} };
    onEnrichmentChange({
      ...enrichmentState,
      [id]: { ...current, enabled: !current.enabled },
    });
  };

  const updateConfig = (id: string, field: string, value: string) => {
    const current = enrichmentState[id] || { enabled: false, config: {} };
    onEnrichmentChange({
      ...enrichmentState,
      [id]: {
        ...current,
        config: { ...current.config, [field]: value },
      },
    });
  };

  const enrichmentItems = enrichmentOptions.filter((o) => o.category === 'enrichment');
  const responseItems = enrichmentOptions.filter((o) => o.category === 'response');

  const renderSection = (title: string, items: EnrichmentOption[]) => (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="overline"
        sx={{
          color: 'rgba(255, 102, 0, 0.8)',
          fontWeight: 600,
          letterSpacing: 1.5,
          mb: 2,
          display: 'block',
        }}
      >
        {title}
      </Typography>
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((option) => {
            const state = enrichmentState[option.id] || { enabled: false, config: {} };
            const isExpanded = expandedId === option.id;
            const hasConfig = option.configFields && option.configFields.length > 0;
            const hasConnectedApps = option.connectedApps && option.connectedApps.length > 0;

            return (
              <motion.div key={option.id} variants={itemVariants}>
                <Card
                  sx={{
                    background: 'rgba(33, 33, 33, 0.6)',
                    border: '1px solid',
                    borderColor: state.enabled ? `${option.color}50` : 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 3,
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                    opacity: (!hasConnectedApps && (option.id === 'email_notify' || option.id === 'chat_notify')) ? 0.5 : 1,
                    '&:hover': {
                      borderColor: state.enabled ? option.color : 'rgba(255, 102, 0, 0.3)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          background: `${option.color}15`,
                          color: option.color,
                          flexShrink: 0,
                        }}
                      >
                        {option.icon}
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ color: 'white', fontWeight: 600 }}
                          >
                            {option.name}
                          </Typography>
                          {/* Show connected apps as badges */}
                          {hasConnectedApps && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {option.connectedApps!.slice(0, 3).map((app) => (
                                <Avatar
                                  key={app.id}
                                  src={app.image}
                                  alt={app.name}
                                  sx={{
                                    width: 20,
                                    height: 20,
                                    fontSize: '0.6rem',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                  }}
                                >
                                  {app.name[0]}
                                </Avatar>
                              ))}
                              {option.connectedApps!.length > 3 && (
                                <Chip
                                  label={`+${option.connectedApps!.length - 3}`}
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.6rem' }}
                                />
                              )}
                              <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e', ml: 0.5 }} />
                            </Box>
                          )}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{ color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.4 }}
                        >
                          {option.description}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {hasConfig && state.enabled && (
                          <IconButton
                            size="small"
                            onClick={() => setExpandedId(isExpanded ? null : option.id)}
                            sx={{
                              color: 'rgba(255, 255, 255, 0.5)',
                              transform: isExpanded ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.3s ease',
                            }}
                          >
                            <ExpandMoreIcon />
                          </IconButton>
                        )}
                        <Switch
                          checked={state.enabled}
                          onChange={() => toggleOption(option.id)}
                          disabled={!hasConnectedApps && (option.id === 'email_notify' || option.id === 'chat_notify')}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: option.color,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: option.color,
                            },
                          }}
                        />
                      </Box>
                    </Box>

                    {hasConfig && (
                      <Collapse in={isExpanded && state.enabled}>
                        <Box sx={{ mt: 3, pl: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {option.configFields!.map((field) => (
                            <TextField
                              key={field.label}
                              label={field.label}
                              placeholder={field.placeholder}
                              type={field.type || 'text'}
                              size="small"
                              value={state.config[field.label] || ''}
                              onChange={(e) => updateConfig(option.id, field.label, e.target.value)}
                              fullWidth
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                  borderRadius: 2,
                                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                                  '&.Mui-focused fieldset': { borderColor: option.color },
                                },
                                '& .MuiInputBase-input': { color: 'white' },
                                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
                              }}
                            />
                          ))}
                        </Box>
                      </Collapse>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </Box>
      </motion.div>
    </Box>
  );

  const enabledCount = Object.values(enrichmentState).filter((s) => s.enabled).length;

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          sx={{
            color: 'white',
            fontWeight: 700,
            mb: 1,
          }}
        >
          Enrichment & Response
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 2 }}
        >
          Configure automatic data enrichment and response actions. You can always change these later.
        </Typography>
        {enabledCount > 0 && (
          <Chip
            label={`${enabledCount} feature${enabledCount > 1 ? 's' : ''} enabled`}
            size="small"
            sx={{
              background: 'rgba(255, 102, 0, 0.1)',
              border: '1px solid rgba(255, 102, 0, 0.3)',
              color: '#FF6600',
            }}
          />
        )}
      </Box>

      {renderSection('Data Enrichment', enrichmentItems)}
      {renderSection('Automated Response', responseItems)}
    </Box>
  );
};