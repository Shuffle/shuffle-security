import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Switch,
  Card,
  CardContent,
  Chip,
  Collapse,
  TextField,
  Avatar,
  Tooltip,
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
import shuffleLogo from '@/assets/shuffle-logo.png';
import { API_CONFIG, getApiUrl } from '@/config/api';

// Workflow labels for each automation area
const AUTOMATION_WORKFLOW_LABELS: Record<string, string[]> = {
  automatic_ingestion: ['Ingest Tickets', 'Ingest Tickets_webhook'],
  threat_intel: ['Threat Intel'],
  notifications: ['Notifications'],
};

// Generate workflow for an automation area
const generateWorkflow = async (
  label: string,
  enabledAppNames: string[],
  category: string = 'cases',
  actionName?: string
): Promise<void> => {
  // For disable action, we still need to send the request even with no apps
  if (enabledAppNames.length === 0 && actionName !== 'disable') return;
  
  const appNamesStr = enabledAppNames.join(',');
  
  try {
    const body: Record<string, string> = {
      label,
      app_name: appNamesStr,
      category,
    };
    
    if (actionName) {
      body.action_name = actionName;
    }
    
    await fetch(getApiUrl('/api/v2/workflows/generate'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    console.log(`Workflow generated: ${label} with apps: ${appNamesStr}${actionName ? ` (action: ${actionName})` : ''}`);
  } catch (error) {
    console.error(`Failed to generate workflow ${label}:`, error);
  }
};

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
  // For notification sources breakdown (chat, email)
  notificationSources?: NotificationSource[];
  // For threat intel sources
  threatIntelSources?: ThreatIntelSource[];
  // For disabled/coming soon options
  disabled?: boolean;
}

interface ConnectedApp {
  id: string;
  name: string;
  image?: string;
  isValidated?: boolean;  // Has valid/tested auth
  isSelected?: boolean;   // Was selected on "Select Tools" page
  hasAuthConfig?: boolean; // Has any auth configured (even if not validated)
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
    id: 'threat_intel',
    name: 'Threat Intel',
    description: 'Compare indicators against known threat intelligence lists and feeds',
    icon: <SecurityIcon />,
    color: '#ef4444',
    category: 'enrichment',
    isDynamic: true, // Will be built with Threat Intel sources
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

// Type for selected apps from Algolia
interface SelectedApp {
  objectID: string;
  name: string;
  image_url?: string;
  categories?: string[];
}

interface EnrichmentConfigProps {
  enrichmentState: EnrichmentState;
  onEnrichmentChange: (state: EnrichmentState) => void;
  onSave?: (state: EnrichmentState) => void;
  authenticatedApps?: AuthAppEntry[];
  selectedApps?: SelectedApp[];
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

// Threat Intel source detection
const THREAT_INTEL_PATTERNS = ['virustotal', 'shodan', 'alienvault', 'otx', 'threatcrowd', 'urlscan', 'hybrid-analysis', 'abuseipdb', 'greynoise', 'urlhaus', 'malwarebazaar', 'threatfox', 'misp', 'opencti', 'recorded future', 'mandiant', 'crowdstrike intel', 'intel471', 'flashpoint', 'domaintools'];
const isThreatIntelApp = (appName: string) =>
  THREAT_INTEL_PATTERNS.some(pattern => appName.toLowerCase().includes(pattern));

type IngestionCategory = 'email' | 'cases' | 'edr' | 'siem';
type NotificationCategory = 'chat' | 'email';
type ThreatIntelCategory = 'threat_intel';

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

interface NotificationSource {
  category: NotificationCategory;
  label: string;
  apps: ConnectedApp[];
}

interface ThreatIntelSource {
  category: ThreatIntelCategory;
  label: string;
  apps: ConnectedApp[];
}

// Helper component for rendering source category chips
interface SourceChipProps {
  label: string;
  apps: ConnectedApp[];
  activeCount: number;
  totalCount: number;
  hasAnyActive: boolean;
  optionId: string;
  isToolEnabled: (optionId: string, appId: string) => boolean;
}

const SourceChip = ({ label, apps, activeCount, totalCount, hasAnyActive, optionId, isToolEnabled }: SourceChipProps) => {
  const hasAny = apps.length > 0;
  // Filter to only show active (enabled) apps
  const activeApps = apps.filter(app => isToolEnabled(optionId, app.id));
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, borderRadius: 2,
      background: hasAnyActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
      border: '1px solid', borderColor: hasAnyActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)',
    }}>
      <Typography variant="caption" sx={{ color: hasAnyActive ? '#22c55e' : 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>
        {label}{hasAny && <Box component="span" sx={{ ml: 0.5, opacity: 0.8 }}>({activeCount}/{totalCount})</Box>}
      </Typography>
      {activeApps.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {activeApps.slice(0, 2).map((app) => (
            <Tooltip key={app.id} title={<Box><Typography variant="caption" sx={{ fontWeight: 600 }}>{app.name}</Typography><Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>Active{app.isSelected ? ' • This setup' : ' • Pre-existing'}</Typography></Box>} arrow placement="top">
              <Box sx={{ position: 'relative' }}>
                <Avatar src={app.image} alt={app.name} sx={{ width: 16, height: 16, fontSize: '0.5rem', border: '1px solid', borderColor: 'rgba(34, 197, 94, 0.5)' }}>{app.name[0]}</Avatar>
              </Box>
            </Tooltip>
          ))}
          {activeApps.length > 2 && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', ml: 0.25 }}>+{activeApps.length - 2}</Typography>}
        </Box>
      )}
    </Box>
  );
};

export const EnrichmentConfig = ({
  enrichmentState, 
  onEnrichmentChange,
  onSave,
  authenticatedApps = [],
  selectedApps = [],
}: EnrichmentConfigProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create a set of selected app names (normalized) for quick lookup
  const selectedAppNames = useMemo(() => {
    const names = new Set<string>();
    selectedApps.forEach(app => {
      names.add(app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_'));
    });
    return names;
  }, [selectedApps]);

  // Check if an app was selected on the "Select Tools" page
  const isAppSelected = (appName: string) => {
    const normalized = appName.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
    return selectedAppNames.has(normalized);
  };

  // Build dynamic options based on connected apps
  const enrichmentOptions = useMemo(() => {
    // Get active apps and deduplicate using shared utility
    const dedupedApps = deduplicateAuthApps(
      authenticatedApps.filter(auth => auth.active || auth.validation?.valid)
    );
    
    // Create a map of app names to their validation status for quick lookup
    const appValidationMap = new Map<string, boolean>();
    dedupedApps.forEach(({ app, hasValidAuth }) => {
      const normalized = app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
      appValidationMap.set(normalized, hasValidAuth);
    });
    
    // Build ingestion sources by category - include both validated AND selected apps
    const ingestionByCategory: Record<IngestionCategory, ConnectedApp[]> = {
      email: [],
      cases: [],
      edr: [],
      siem: [],
    };
    
    // First add authenticated apps (validated or just active)
    dedupedApps.forEach(({ app, bestImage, hasValidAuth }) => {
      const mockEntry: AuthAppEntry = {
        app: { ...app, large_image: bestImage || app.large_image },
        active: true,
        validation: { valid: hasValidAuth },
      };
      const category = getIngestionCategory(mockEntry);
      if (category) {
        ingestionByCategory[category].push({
          id: app.id,
          name: app.name,
          image: bestImage || app.large_image,
          isValidated: hasValidAuth,
          isSelected: isAppSelected(app.name),
          hasAuthConfig: true, // Has auth configured (even if not validated)
        });
      }
    });
    
    // Then add selected apps that aren't already in the list (for each category)
    selectedApps.forEach(app => {
      const normalizedName = app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
      if (appValidationMap.has(normalizedName)) return; // Already added from authenticated apps
      
      // Create a mock AuthAppEntry to check category
      const mockEntry: AuthAppEntry = {
        app: { id: app.objectID, name: app.name, categories: app.categories },
      };
      const category = getIngestionCategory(mockEntry);
      if (category) {
        ingestionByCategory[category].push({
          id: app.objectID,
          name: app.name,
          image: app.image_url,
          isValidated: false,
          isSelected: true,
          hasAuthConfig: false, // No auth configured yet
        });
      }
    });
    
    // Sort apps: 1) Selected + Validated, 2) Selected + Pending, 3) Pre-existing + Validated, 4) Pre-existing + Pending
    const sortApps = (apps: ConnectedApp[]): ConnectedApp[] => {
      return [...apps].sort((a, b) => {
        const scoreA = (a.isSelected ? 2 : 0) + (a.isValidated ? 1 : 0);
        const scoreB = (b.isSelected ? 2 : 0) + (b.isValidated ? 1 : 0);
        return scoreB - scoreA; // Higher score first
      });
    };
    
    const ingestionSources: IngestionSource[] = [
      { category: 'email', label: 'Email', apps: sortApps(ingestionByCategory.email) },
      { category: 'cases', label: 'Cases', apps: sortApps(ingestionByCategory.cases) },
      { category: 'edr', label: 'EDR', apps: sortApps(ingestionByCategory.edr) },
      { category: 'siem', label: 'SIEM', apps: sortApps(ingestionByCategory.siem) },
    ];
    
    const validatedCount = Object.values(ingestionByCategory).flat().filter(a => a.isValidated).length;
    const totalCount = Object.values(ingestionByCategory).flat().length;
    
    // Build options, replacing dynamic ones
    const options: EnrichmentOption[] = baseEnrichmentOptions.map(opt => {
      if (opt.id === 'automatic_ingestion') {
        return {
          ...opt,
          description: totalCount > 0
            ? `${validatedCount} validated${totalCount > validatedCount ? `, ${totalCount - validatedCount} pending` : ''}`
            : 'Connect Email, Cases, EDR, or SIEM tools to enable automatic ingestion',
          ingestionSources,
        };
      }
      if (opt.id === 'threat_intel') {
        // Build Threat Intel sources from authenticated apps
        const threatIntelApps: ConnectedApp[] = [];
        
        // Add default "Shuffle Threat Lists" - always available and validated
        threatIntelApps.push({
          id: 'shuffle_threat_lists',
          name: 'Shuffle Threat Lists',
          image: shuffleLogo,
          isValidated: true,
          isSelected: true,
          hasAuthConfig: true,
        });
        
        dedupedApps.forEach(({ app, bestImage, hasValidAuth }) => {
          if (isThreatIntelApp(app.name)) {
            threatIntelApps.push({
              id: app.id,
              name: app.name,
              image: bestImage || app.large_image,
              isValidated: hasValidAuth,
              isSelected: isAppSelected(app.name),
              hasAuthConfig: true,
            });
          }
        });
        // Also add selected threat intel apps that aren't authenticated yet
        selectedApps.forEach(selApp => {
          const normalizedName = selApp.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
          if (!appValidationMap.has(normalizedName) && isThreatIntelApp(selApp.name)) {
            threatIntelApps.push({
              id: selApp.objectID,
              name: selApp.name,
              image: selApp.image_url,
              isValidated: false,
              isSelected: true,
              hasAuthConfig: false,
            });
          }
        });
        
        const threatIntelSources: ThreatIntelSource[] = [
          { category: 'threat_intel', label: 'Threat Intel', apps: sortApps(threatIntelApps) },
        ];
        const tiValidatedCount = threatIntelApps.filter(a => a.isValidated).length;
        const tiTotalCount = threatIntelApps.length;
        
        return {
          ...opt,
          description: `${tiValidatedCount} validated${tiTotalCount > tiValidatedCount ? `, ${tiTotalCount - tiValidatedCount} pending` : ''}`,
          threatIntelSources,
        };
      }
      return opt;
    });
    
    // Email apps for Notifications - filter from deduplicated apps with valid auth
    const emailNotifyApps: ConnectedApp[] = dedupedApps
      .filter(({ app, hasValidAuth }) => hasValidAuth && isEmailApp(app.name))
      .map(({ app, bestImage, hasValidAuth }) => ({
        id: app.id,
        name: app.name,
        image: bestImage || app.large_image,
        isValidated: hasValidAuth,
        isSelected: isAppSelected(app.name),
        hasAuthConfig: true,
      }));
    
    // Communication apps for Notifications - filter from deduplicated apps with valid auth
    const chatNotifyApps: ConnectedApp[] = dedupedApps
      .filter(({ app, hasValidAuth }) => hasValidAuth && isCommunicationApp({ app, active: true, validation: { valid: true } }))
      .map(({ app, bestImage, hasValidAuth }) => ({
        id: app.id,
        name: app.name,
        image: bestImage || app.large_image,
        isValidated: hasValidAuth,
        isSelected: isAppSelected(app.name),
        hasAuthConfig: true,
      }));
    
    const notificationSources: NotificationSource[] = [
      { category: 'chat', label: 'Chat', apps: sortApps(chatNotifyApps) },
      { category: 'email', label: 'Email', apps: sortApps(emailNotifyApps) },
    ];
    
    const notifyTotal = emailNotifyApps.length + chatNotifyApps.length;
    
    // Add combined Notifications option
    options.push({
      id: 'notifications',
      name: 'Notifications',
      description: notifyTotal > 0 
        ? `Send alerts via ${chatNotifyApps.length > 0 ? 'Chat' : ''}${chatNotifyApps.length > 0 && emailNotifyApps.length > 0 ? ' & ' : ''}${emailNotifyApps.length > 0 ? 'Email' : ''}`
        : 'Connect email or chat tools to enable notifications',
      icon: <ChatIcon />,
      color: '#8b5cf6',
      category: 'response',
      notificationSources,
    });
    
    return options;
  }, [authenticatedApps]);

  const toggleOption = (id: string) => {
    const current = enrichmentState[id] || { enabled: false, config: {} };
    const isEnabling = !current.enabled;
    const newState = {
      ...enrichmentState,
      [id]: { ...current, enabled: isEnabling },
    };
    onEnrichmentChange(newState);
    // Optimistically save
    onSave?.(newState);
    
    // Trigger workflow generation API
    triggerWorkflowGeneration(id, newState, isEnabling ? undefined : 'disable');
  };

  const updateConfig = (id: string, field: string, value: string) => {
    const current = enrichmentState[id] || { enabled: false, config: {} };
    const newState = {
      ...enrichmentState,
      [id]: {
        ...current,
        config: { ...current.config, [field]: value },
      },
    };
    onEnrichmentChange(newState);
    // Optimistically save
    onSave?.(newState);
  };

  // Get all tools for an option (from various sources or connected apps)
  const getAllToolsForOption = (option: EnrichmentOption): ConnectedApp[] => {
    if (option.ingestionSources) {
      return option.ingestionSources.flatMap(s => s.apps);
    }
    if (option.notificationSources) {
      return option.notificationSources.flatMap(s => s.apps);
    }
    if (option.threatIntelSources) {
      return option.threatIntelSources.flatMap(s => s.apps);
    }
    if (option.connectedApps) {
      return option.connectedApps;
    }
    return [];
  };

  // Get app info for checking default enable state
  const getAppInfo = (optionId: string, appId: string): ConnectedApp | undefined => {
    const option = enrichmentOptions.find(o => o.id === optionId);
    if (!option) return undefined;
    if (option.ingestionSources) {
      return option.ingestionSources.flatMap(s => s.apps).find(a => a.id === appId);
    }
    if (option.notificationSources) {
      return option.notificationSources.flatMap(s => s.apps).find(a => a.id === appId);
    }
    if (option.threatIntelSources) {
      return option.threatIntelSources.flatMap(s => s.apps).find(a => a.id === appId);
    }
    if (option.connectedApps) {
      return option.connectedApps.find(a => a.id === appId);
    }
    return undefined;
  };

  const isToolEnabled = (optionId: string, appId: string): boolean => {
    const current = enrichmentState[optionId];
    // If explicitly set, use that value
    if (current?.tools && appId in current.tools) {
      return current.tools[appId] !== false;
    }
    // Default: only enable if both selected in this setup AND validated
    const appInfo = getAppInfo(optionId, appId);
    return appInfo?.isSelected === true && appInfo?.isValidated === true;
  };

  // Trigger workflow generation for an automation area
  const triggerWorkflowGeneration = useCallback((optionId: string, state: EnrichmentState, actionName?: string) => {
    const option = enrichmentOptions.find(o => o.id === optionId);
    if (!option) return;
    
    // Get all tools for this option
    const allTools = getAllToolsForOption(option);
    
    // Filter to only enabled tools (unless disabling the whole area)
    const enabledTools = actionName === 'disable' 
      ? allTools // Include all tools when disabling
      : allTools.filter(tool => {
          const current = state[optionId];
          if (current?.tools && tool.id in current.tools) {
            return current.tools[tool.id] !== false;
          }
          // Default: enabled if selected and validated
          return tool.isSelected === true && tool.isValidated === true;
        });
    
    const enabledAppNames = enabledTools.map(tool => tool.name);
    
    // Get the workflow labels for this automation area
    const labels = AUTOMATION_WORKFLOW_LABELS[optionId] || [];
    
    // Fire and forget API calls for each label
    labels.forEach(label => {
      generateWorkflow(label, enabledAppNames, 'cases', actionName);
    });
  }, [enrichmentOptions]);

  const toggleTool = (optionId: string, appId: string, appName: string) => {
    const current = enrichmentState[optionId] || { enabled: false, config: {}, tools: {} };
    const currentTools = current.tools || {};
    const isCurrentlyEnabled = currentTools[appId] !== false; // Default to true if not set
    const newToolState = !isCurrentlyEnabled;
    
    const newState = {
      ...enrichmentState,
      [optionId]: {
        ...current,
        tools: { ...currentTools, [appId]: newToolState },
      },
    };
    onEnrichmentChange(newState);
    // Optimistically save
    onSave?.(newState);
    
    // Trigger workflow generation API for the automation area
    triggerWorkflowGeneration(optionId, newState);
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
            const hasNotificationSources = option.notificationSources && option.notificationSources.some(s => s.apps.length > 0);
            const hasThreatIntelSources = option.threatIntelSources && option.threatIntelSources.some(s => s.apps.length > 0);
            const isDisabled = option.disabled || (option.id === 'notifications' && !hasNotificationSources);
            const allTools = getAllToolsForOption(option);
            const hasExpandableTools = allTools.length > 0 && !isDisabled;

            return (
              <motion.div key={option.id} variants={itemVariants}>
                <Card
                  onClick={() => {
                    // Only expand on card click when collapsed
                    if (!isExpanded && (hasExpandableTools || (hasConfig && state.enabled))) {
                      setExpandedId(option.id);
                    }
                  }}
                  sx={{
                    background: 'rgba(33, 33, 33, 0.6)',
                    border: '1px solid',
                    borderColor: state.enabled && !isDisabled ? `${option.color}50` : 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 3,
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                    opacity: isDisabled ? 0.5 : 1,
                    cursor: (!isExpanded && (hasExpandableTools || (hasConfig && state.enabled))) ? 'pointer' : 'default',
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
                          sx={{ 
                            color: 'rgba(255, 255, 255, 0.5)', 
                            lineHeight: 1.4, 
                            mb: (option.ingestionSources || option.notificationSources || option.threatIntelSources) ? 1.5 : 0 
                          }}
                        >
                          {option.description}
                        </Typography>
                        
                        {/* Ingestion sources breakdown */}
                        {option.ingestionSources && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {option.ingestionSources.map((source) => {
                              const activeCount = source.apps.filter(a => isToolEnabled(option.id, a.id)).length;
                              const totalCount = source.apps.length;
                              const hasAnyActive = activeCount > 0;
                              
                              return (
                                <SourceChip
                                  key={source.category}
                                  label={source.label}
                                  apps={source.apps}
                                  activeCount={activeCount}
                                  totalCount={totalCount}
                                  hasAnyActive={hasAnyActive}
                                  optionId={option.id}
                                  isToolEnabled={isToolEnabled}
                                />
                              );
                            })}
                          </Box>
                        )}
                        
                        {/* Notification sources breakdown */}
                        {option.notificationSources && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {option.notificationSources.map((source) => {
                              const activeCount = source.apps.filter(a => isToolEnabled(option.id, a.id)).length;
                              const totalCount = source.apps.length;
                              const hasAnyActive = activeCount > 0;
                              
                              return (
                                <SourceChip
                                  key={source.category}
                                  label={source.label}
                                  apps={source.apps}
                                  activeCount={activeCount}
                                  totalCount={totalCount}
                                  hasAnyActive={hasAnyActive}
                                  optionId={option.id}
                                  isToolEnabled={isToolEnabled}
                                />
                              );
                            })}
                          </Box>
                        )}
                        
                        {/* Threat Intel sources breakdown */}
                        {option.threatIntelSources && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {option.threatIntelSources.map((source) => {
                              const activeCount = source.apps.filter(a => isToolEnabled(option.id, a.id)).length;
                              const totalCount = source.apps.length;
                              const hasAnyActive = activeCount > 0;
                              
                              return (
                                <SourceChip
                                  key={source.category}
                                  label={source.label}
                                  apps={source.apps}
                                  activeCount={activeCount}
                                  totalCount={totalCount}
                                  hasAnyActive={hasAnyActive}
                                  optionId={option.id}
                                  isToolEnabled={isToolEnabled}
                                />
                              );
                            })}
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 0.5 }}>
                        {(hasExpandableTools || (hasConfig && state.enabled)) && (
                          <Box
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : option.id);
                            }}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              p: 0.5,
                              borderRadius: 1,
                              '&:hover': {
                                background: 'rgba(255, 255, 255, 0.1)',
                              },
                            }}
                          >
                            <ExpandMoreIcon
                              sx={{
                                color: 'rgba(255, 255, 255, 0.5)',
                                transform: isExpanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.3s ease',
                                fontSize: 20,
                              }}
                            />
                          </Box>
                        )}
                        <Switch
                          checked={state.enabled && !isDisabled}
                          onChange={() => toggleOption(option.id)}
                          onClick={(e) => e.stopPropagation()}
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
                            {(option.ingestionSources || option.notificationSources || option.threatIntelSources) ? (
                              // Group by category for all source types
                              (option.ingestionSources || option.notificationSources || option.threatIntelSources)!.filter(s => s.apps.length > 0).map((source) => (
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
                                  {source.apps.map((app) => {
                                    const enabled = isToolEnabled(option.id, app.id);
                                    return (
                                    <Box
                                      key={app.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        py: 0.75,
                                        px: 1.5,
                                        borderRadius: 1.5,
                                        background: enabled 
                                          ? 'rgba(255, 102, 0, 0.08)' 
                                          : 'rgba(0, 0, 0, 0.2)',
                                        border: '1px solid',
                                        borderColor: enabled 
                                          ? 'rgba(255, 102, 0, 0.25)' 
                                          : 'transparent',
                                        mb: 0.5,
                                        opacity: enabled ? 1 : 0.6,
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                          background: enabled 
                                            ? 'rgba(255, 102, 0, 0.12)' 
                                            : 'rgba(0, 0, 0, 0.3)',
                                        },
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Box sx={{ position: 'relative' }}>
                                          <Avatar
                                            src={app.image}
                                            alt={app.name}
                                            sx={{
                                              width: 24,
                                              height: 24,
                                              fontSize: '0.7rem',
                                              border: '2px solid',
                                              borderColor: app.isValidated 
                                                ? 'rgba(34, 197, 94, 0.6)' 
                                                : app.hasAuthConfig
                                                  ? 'rgba(255, 152, 0, 0.6)'
                                                  : 'rgba(239, 68, 68, 0.6)',
                                              opacity: app.isValidated ? 1 : 0.8,
                                            }}
                                          >
                                            {app.name[0]}
                                          </Avatar>
                                          {/* Validation status dot */}
                                          <Box
                                            sx={{
                                              position: 'absolute',
                                              bottom: -2,
                                              right: -2,
                                              width: 10,
                                              height: 10,
                                              borderRadius: '50%',
                                              backgroundColor: app.isValidated 
                                                ? '#22c55e' 
                                                : app.hasAuthConfig
                                                  ? '#ff9800'
                                                  : '#ef4444',
                                              border: '2px solid rgba(33, 33, 33, 0.9)',
                                            }}
                                          />
                                        </Box>
                                        <Box>
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            <Typography variant="body2" sx={{ color: 'white' }}>
                                              {app.name}
                                            </Typography>
                                            {app.isSelected && (
                                              <Chip
                                                label="This setup"
                                                size="small"
                                                sx={{
                                                  height: 16,
                                                  fontSize: '0.55rem',
                                                  fontWeight: 600,
                                                  background: 'rgba(59, 130, 246, 0.2)',
                                                  color: '#60a5fa',
                                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                                  '& .MuiChip-label': { px: 0.75 },
                                                }}
                                              />
                                            )}
                                          </Box>
                                          <Typography 
                                            variant="caption" 
                                            sx={{ 
                                              color: app.isValidated 
                                                ? '#22c55e' 
                                                : app.hasAuthConfig 
                                                  ? '#ff9800' 
                                                  : '#ef4444',
                                              fontSize: '0.65rem',
                                            }}
                                          >
                                            {app.isValidated 
                                              ? 'Validated' 
                                              : app.hasAuthConfig 
                                                ? 'Pending validation' 
                                                : 'Pending auth'}
                                            {!app.isSelected && (
                                              <Box component="span" sx={{ color: 'rgba(255,255,255,0.4)', ml: 0.5 }}>
                                                • Pre-existing
                                              </Box>
                                            )}
                                          </Typography>
                                        </Box>
                                      </Box>
                                      <Switch
                                        size="small"
                                        checked={isToolEnabled(option.id, app.id)}
                                        onChange={() => toggleTool(option.id, app.id, app.name)}
                                        disabled={!app.isValidated}
                                        sx={{
                                          '& .MuiSwitch-switchBase.Mui-checked': {
                                            color: option.color,
                                          },
                                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                            backgroundColor: option.color,
                                          },
                                          '&.Mui-disabled': {
                                            opacity: 0.4,
                                          },
                                        }}
                                      />
                                    </Box>
                                  )})}
                                </Box>
                              ))
                            ) : option.connectedApps ? (
                              // Flat list for legacy connected apps
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
                                    onChange={() => toggleTool(option.id, app.id, app.name)}
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
                            ) : null}
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