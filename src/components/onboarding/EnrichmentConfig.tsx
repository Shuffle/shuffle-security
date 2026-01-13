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
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';

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
  // For ingestion sources breakdown
  ingestionSources?: IngestionSource[];
  // For disabled/coming soon options
  disabled?: boolean;
}

interface ConnectedApp {
  id: string;
  name: string;
  image?: string;
}

// Base static options - automatic_ingestion will be built dynamically
const baseEnrichmentOptions: (Omit<EnrichmentOption, 'connectedApps'> & { isDynamic?: boolean })[] = [
  {
    id: 'automatic_ingestion',
    name: 'Automatic Ingestion',
    description: 'Automatically ingest and normalize data from connected tools',
    icon: <DownloadIcon />,
    color: '#22c55e',
    category: 'enrichment',
    isDynamic: true, // Will be replaced with dynamic version
  },
  {
    id: 'integration_search',
    name: 'Integration Search',
    description: 'Search across all connected tools simultaneously for IOCs and context (coming soon)',
    icon: <TravelExploreIcon />,
    color: '#3b82f6',
    category: 'enrichment',
    disabled: true,
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
    // Individual tool toggles (keyed by app id)
    tools?: Record<string, boolean>;
  };
}

interface EnrichmentConfigProps {
  enrichmentState: EnrichmentState;
  onEnrichmentChange: (state: EnrichmentState) => void;
  authenticatedApps?: AuthAppEntry[];
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
const isCommunicationApp = (app: AuthAppEntry) => {
  const categories = app.app.categories || [];
  return categories.some(cat => COMMUNICATION_CATEGORIES.includes(cat)) ||
    ['slack', 'teams', 'discord', 'mattermost', 'telegram', 'webhook'].some(
      pattern => app.app.name.toLowerCase().includes(pattern)
    );
};

// Ingestion source detection - Email, Cases (ticketing), EDR, SIEM
const CASES_PATTERNS = ['jira', 'servicenow', 'zendesk', 'freshdesk', 'pagerduty', 'opsgenie', 'ticket', 'itsm', 'salesforce', 'thehive', 'cortex'];
const EDR_PATTERNS = ['crowdstrike', 'sentinelone', 'carbon black', 'defender', 'cylance', 'sophos', 'trellix', 'vmware', 'tanium', 'falcon', 'edr'];
const SIEM_PATTERNS = ['splunk', 'elastic', 'qradar', 'sentinel', 'chronicle', 'logrhythm', 'sumo logic', 'graylog', 'wazuh', 'siem', 'arcsight'];

type IngestionCategory = 'email' | 'cases' | 'edr' | 'siem';

const getIngestionCategory = (app: AuthAppEntry): IngestionCategory | null => {
  const name = app.app.name.toLowerCase();
  const categories = (app.app.categories || []).map(c => c.toLowerCase());
  
  if (isEmailApp(name)) return 'email';
  if (CASES_PATTERNS.some(p => name.includes(p)) || categories.includes('cases') || categories.includes('itsm')) return 'cases';
  if (EDR_PATTERNS.some(p => name.includes(p)) || categories.includes('edr') || categories.includes('endpoint')) return 'edr';
  if (SIEM_PATTERNS.some(p => name.includes(p)) || categories.includes('siem')) return 'siem';
  
  return null;
};

interface IngestionSource {
  category: IngestionCategory;
  label: string;
  apps: ConnectedApp[];
}

export const EnrichmentConfig = ({ 
  enrichmentState, 
  onEnrichmentChange,
  authenticatedApps = [],
}: EnrichmentConfigProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build dynamic options based on connected apps
  const enrichmentOptions = useMemo(() => {
    // Get validated/active apps and deduplicate using shared utility
    const dedupedApps = deduplicateAuthApps(
      authenticatedApps.filter(auth => auth.active || auth.validation?.valid)
    );
    
    // Convert back to AuthAppEntry format with bestImage applied
    const validatedApps: AuthAppEntry[] = dedupedApps.map(({ app, bestImage }) => ({
      app: { ...app, large_image: bestImage || app.large_image },
      active: true,
      validation: { valid: true },
    }));
    
    // Build ingestion sources by category
    const ingestionByCategory: Record<IngestionCategory, ConnectedApp[]> = {
      email: [],
      cases: [],
      edr: [],
      siem: [],
    };
    
    validatedApps.forEach(auth => {
      const category = getIngestionCategory(auth);
      if (category) {
        ingestionByCategory[category].push({
          id: auth.app.id,
          name: auth.app.name,
          image: auth.app.large_image,
        });
      }
    });
    
    const ingestionSources: IngestionSource[] = [
      { category: 'email', label: 'Email', apps: ingestionByCategory.email },
      { category: 'cases', label: 'Cases', apps: ingestionByCategory.cases },
      { category: 'edr', label: 'EDR', apps: ingestionByCategory.edr },
      { category: 'siem', label: 'SIEM', apps: ingestionByCategory.siem },
    ];
    
    const totalIngestionApps = Object.values(ingestionByCategory).flat().length;
    
    // Build options, replacing dynamic ones
    const options: EnrichmentOption[] = baseEnrichmentOptions.map(opt => {
      if (opt.id === 'automatic_ingestion') {
        return {
          ...opt,
          description: totalIngestionApps > 0
            ? `Ingest from ${totalIngestionApps} connected tool${totalIngestionApps > 1 ? 's' : ''}`
            : 'Connect Email, Cases, EDR, or SIEM tools to enable automatic ingestion',
          ingestionSources,
        };
      }
      return opt;
    });
    
    // Email apps for Email Notifications (already deduplicated)
    const emailApps = validatedApps.filter(auth => isEmailApp(auth.app.name));
    
    // Communication apps for Chat Notifications (already deduplicated)
    const commApps = validatedApps.filter(auth => isCommunicationApp(auth));
    
    // Add Email Notifications
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

  const toggleTool = (optionId: string, appId: string) => {
    const current = enrichmentState[optionId] || { enabled: false, config: {}, tools: {} };
    const currentTools = current.tools || {};
    const isCurrentlyEnabled = currentTools[appId] !== false; // Default to true if not set
    onEnrichmentChange({
      ...enrichmentState,
      [optionId]: {
        ...current,
        tools: { ...currentTools, [appId]: !isCurrentlyEnabled },
      },
    });
  };

  const isToolEnabled = (optionId: string, appId: string): boolean => {
    const current = enrichmentState[optionId];
    if (!current?.tools) return true; // Default to enabled
    return current.tools[appId] !== false;
  };

  // Get all tools for an option (from ingestion sources or connected apps)
  const getAllToolsForOption = (option: EnrichmentOption): ConnectedApp[] => {
    if (option.ingestionSources) {
      return option.ingestionSources.flatMap(s => s.apps);
    }
    if (option.connectedApps) {
      return option.connectedApps;
    }
    return [];
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
            const hasIngestionSources = option.ingestionSources && option.ingestionSources.some(s => s.apps.length > 0);
            const isDisabled = option.disabled || (!hasConnectedApps && (option.id === 'email_notify' || option.id === 'chat_notify'));
            const allTools = getAllToolsForOption(option);
            const hasExpandableTools = allTools.length > 0 && !isDisabled;

            return (
              <motion.div key={option.id} variants={itemVariants}>
                <Card
                  sx={{
                    background: 'rgba(33, 33, 33, 0.6)',
                    border: '1px solid',
                    borderColor: state.enabled && !isDisabled ? `${option.color}50` : 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 3,
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                    opacity: isDisabled ? 0.5 : 1,
                    '&:hover': {
                      borderColor: isDisabled ? 'rgba(255, 255, 255, 0.08)' : (state.enabled ? option.color : 'rgba(255, 102, 0, 0.3)'),
                      transform: isDisabled ? 'none' : 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
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
                          mt: 0.5,
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
                          {/* Show connected apps as badges for non-ingestion options */}
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
                          {/* Show check for ingestion if any sources connected */}
                          {hasIngestionSources && (
                            <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e' }} />
                          )}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{ color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.4, mb: option.ingestionSources ? 1.5 : 0 }}
                        >
                          {option.description}
                        </Typography>
                        
                        {/* Ingestion sources breakdown */}
                        {option.ingestionSources && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {option.ingestionSources.map((source) => (
                              <Box
                                key={source.category}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.75,
                                  px: 1.5,
                                  py: 0.75,
                                  borderRadius: 2,
                                  background: source.apps.length > 0 
                                    ? 'rgba(34, 197, 94, 0.1)' 
                                    : 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid',
                                  borderColor: source.apps.length > 0 
                                    ? 'rgba(34, 197, 94, 0.3)' 
                                    : 'rgba(255, 255, 255, 0.1)',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: source.apps.length > 0 ? '#22c55e' : 'rgba(255, 255, 255, 0.4)',
                                    fontWeight: 500,
                                  }}
                                >
                                  {source.label}
                                </Typography>
                                {source.apps.length > 0 && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                    {source.apps.slice(0, 2).map((app) => (
                                      <Avatar
                                        key={app.id}
                                        src={app.image}
                                        alt={app.name}
                                        sx={{
                                          width: 16,
                                          height: 16,
                                          fontSize: '0.5rem',
                                          border: '1px solid rgba(255,255,255,0.2)',
                                        }}
                                      >
                                        {app.name[0]}
                                      </Avatar>
                                    ))}
                                    {source.apps.length > 2 && (
                                      <Typography
                                        variant="caption"
                                        sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', ml: 0.25 }}
                                      >
                                        +{source.apps.length - 2}
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 0.5 }}>
                        {hasExpandableTools && (
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
                        {hasConfig && state.enabled && !hasExpandableTools && (
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
                          checked={state.enabled && !isDisabled}
                          onChange={() => toggleOption(option.id)}
                          disabled={isDisabled}
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

                    {/* Expandable tools list */}
                    {hasExpandableTools && (
                      <Collapse in={isExpanded}>
                        <Box sx={{ mt: 2, pl: 7 }}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255, 255, 255, 0.4)', mb: 1.5, display: 'block' }}
                          >
                            Toggle individual tools:
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {option.ingestionSources ? (
                              // Group by category for ingestion sources
                              option.ingestionSources.filter(s => s.apps.length > 0).map((source) => (
                                <Box key={source.category}>
                                  <Typography
                                    variant="caption"
                                    sx={{ 
                                      color: 'rgba(255, 255, 255, 0.5)', 
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: 0.5,
                                      fontSize: '0.65rem',
                                      mb: 0.5,
                                      display: 'block',
                                    }}
                                  >
                                    {source.label}
                                  </Typography>
                                  {source.apps.map((app) => (
                                    <Box
                                      key={app.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        py: 0.75,
                                        px: 1.5,
                                        borderRadius: 1.5,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        mb: 0.5,
                                        '&:hover': {
                                          background: 'rgba(0, 0, 0, 0.3)',
                                        },
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Avatar
                                          src={app.image}
                                          alt={app.name}
                                          sx={{
                                            width: 24,
                                            height: 24,
                                            fontSize: '0.7rem',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                          }}
                                        >
                                          {app.name[0]}
                                        </Avatar>
                                        <Typography variant="body2" sx={{ color: 'white' }}>
                                          {app.name}
                                        </Typography>
                                      </Box>
                                      <Switch
                                        size="small"
                                        checked={isToolEnabled(option.id, app.id)}
                                        onChange={() => toggleTool(option.id, app.id)}
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
                                  ))}
                                </Box>
                              ))
                            ) : (
                              // Flat list for connected apps
                              allTools.map((app) => (
                                <Box
                                  key={app.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    py: 0.75,
                                    px: 1.5,
                                    borderRadius: 1.5,
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    '&:hover': {
                                      background: 'rgba(0, 0, 0, 0.3)',
                                    },
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Avatar
                                      src={app.image}
                                      alt={app.name}
                                      sx={{
                                        width: 24,
                                        height: 24,
                                        fontSize: '0.7rem',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                      }}
                                    >
                                      {app.name[0]}
                                    </Avatar>
                                    <Typography variant="body2" sx={{ color: 'white' }}>
                                      {app.name}
                                    </Typography>
                                  </Box>
                                  <Switch
                                    size="small"
                                    checked={isToolEnabled(option.id, app.id)}
                                    onChange={() => toggleTool(option.id, app.id)}
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
                              ))
                            )}
                          </Box>
                        </Box>
                      </Collapse>
                    )}

                    {hasConfig && !hasExpandableTools && (
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