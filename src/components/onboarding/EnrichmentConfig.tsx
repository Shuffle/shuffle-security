import { useState } from 'react';
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
  FormControlLabel,
} from '@mui/material';
import { motion } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SecurityIcon from '@mui/icons-material/Security';
import DnsIcon from '@mui/icons-material/Dns';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import EmailIcon from '@mui/icons-material/Email';
import ChatIcon from '@mui/icons-material/Chat';

interface EnrichmentOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: 'enrichment' | 'response';
  configFields?: { label: string; placeholder: string; type?: string }[];
}

const enrichmentOptions: EnrichmentOption[] = [
  {
    id: 'virustotal',
    name: 'VirusTotal',
    description: 'Automatically check IPs, domains, and file hashes',
    icon: <SecurityIcon />,
    color: '#3b82f6',
    category: 'enrichment',
    configFields: [{ label: 'API Key', placeholder: 'Your VirusTotal API key', type: 'password' }],
  },
  {
    id: 'shodan',
    name: 'Shodan',
    description: 'Enrich with internet-facing asset information',
    icon: <DnsIcon />,
    color: '#ef4444',
    category: 'enrichment',
    configFields: [{ label: 'API Key', placeholder: 'Your Shodan API key', type: 'password' }],
  },
  {
    id: 'hibp',
    name: 'Have I Been Pwned',
    description: 'Check if emails appear in known breaches',
    icon: <PersonSearchIcon />,
    color: '#f59e0b',
    category: 'enrichment',
    configFields: [{ label: 'API Key', placeholder: 'Your HIBP API key', type: 'password' }],
  },
  {
    id: 'ai_triage',
    name: 'AI-Powered Triage',
    description: 'Use AI to automatically categorize and prioritize alerts',
    icon: <AutoFixHighIcon />,
    color: '#FF6600',
    category: 'enrichment',
  },
  {
    id: 'email_notify',
    name: 'Email Notifications',
    description: 'Send email alerts for critical severity issues',
    icon: <EmailIcon />,
    color: '#22c55e',
    category: 'response',
    configFields: [
      { label: 'SMTP Server', placeholder: 'smtp.company.com' },
      { label: 'From Address', placeholder: 'alerts@company.com' },
    ],
  },
  {
    id: 'slack_notify',
    name: 'Slack Notifications',
    description: 'Post alerts to Slack channels',
    icon: <ChatIcon />,
    color: '#8b5cf6',
    category: 'response',
    configFields: [{ label: 'Webhook URL', placeholder: 'https://hooks.slack.com/...', type: 'password' }],
  },
  {
    id: 'auto_assign',
    name: 'Auto-Assignment',
    description: 'Automatically assign cases based on type and severity',
    icon: <NotificationsActiveIcon />,
    color: '#06b6d4',
    category: 'response',
  },
];

export interface EnrichmentState {
  [key: string]: {
    enabled: boolean;
    config: Record<string, string>;
  };
}

interface EnrichmentConfigProps {
  enrichmentState: EnrichmentState;
  onEnrichmentChange: (state: EnrichmentState) => void;
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

export const EnrichmentConfig = ({ enrichmentState, onEnrichmentChange }: EnrichmentConfigProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                        <Typography
                          variant="subtitle1"
                          sx={{ color: 'white', fontWeight: 600 }}
                        >
                          {option.name}
                        </Typography>
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
