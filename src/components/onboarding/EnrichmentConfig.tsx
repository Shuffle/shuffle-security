import { useState, useMemo, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AppAuthCard, type AppAuthState, type ApiAuthEntry as AppAuthApiEntry } from '@/components/onboarding/AppAuthConfig';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
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
  IconButton,
  Button,
} from '@mui/material';
import { motion } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import EmailIcon from '@mui/icons-material/Email';
import ChatIcon from '@mui/icons-material/Chat';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import RestoreIcon from '@mui/icons-material/Restore';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import {
  EMAIL_APP_PATTERNS, CASES_PATTERNS, EDR_PATTERNS, SIEM_PATTERNS,
  THREAT_INTEL_PATTERNS, COMMUNICATION_PATTERNS_NAMES,
  isEmailApp, isThreatIntelApp, getIngestionCategory,
  type IngestionCategory,
} from '@/lib/ingestionDetection';
import shuffleLogo from '@/assets/shuffle-logo.png';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { useThreatFeeds, DEFAULT_THREAT_FEEDS, ThreatFeed } from '@/hooks/useThreatFeeds';

// Workflow labels for each automation area
const AUTOMATION_WORKFLOW_LABELS: Record<string, string[]> = {
  automatic_ingestion: ['Ingest Tickets', 'Ingest Tickets_webhook'],
  threat_intel: ['Enable Threat feeds'],
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
      credentials: 'include',
      headers: {
        ...getAuthHeader(),
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
  connectedApps?: ConnectedApp[];
  ingestionSources?: IngestionSource[];
  notificationSources?: NotificationSource[];
  threatIntelSources?: ThreatIntelSource[];
  disabled?: boolean;
}

interface ConnectedApp {
  id: string;
  name: string;
  image?: string;
  isValidated?: boolean;
  isSelected?: boolean;
  hasAuthConfig?: boolean;
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
    isDynamic: true,
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
    isDynamic: true,
  },
];

export interface EnrichmentState {
  [key: string]: {
    enabled: boolean;
    config: Record<string, string>;
    tools?: Record<string, boolean>;
  };
}

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
  // Auth callbacks for inline configuration of pending apps
  authStates?: Record<string, AppAuthState>;
  apiAuthEntries?: AppAuthApiEntry[];
  onAuthChange?: (appId: string, credentials: Record<string, string>) => void;
  onTestConnection?: (appId: string, authenticationId?: string) => void;
  onSaveAuth?: (appId: string, credentials: Record<string, string>) => Promise<boolean>;
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

// Communication app detection
const COMMUNICATION_CATEGORIES = ['COMMUNICATION', 'communication', 'Communication'];
const isCommunicationApp = (app: AuthAppEntry) => {
  const categories = app.app.categories || [];
  return categories.some(cat => COMMUNICATION_CATEGORIES.includes(cat)) ||
    COMMUNICATION_PATTERNS_NAMES.some(
      pattern => app.app.name.toLowerCase().includes(pattern)
    );
};

type NotificationCategory = 'chat' | 'email';
type ThreatIntelCategory = 'threat_intel';

interface IngestionSource {
  category: IngestionCategory | 'other';
  label: string;
  apps: ConnectedApp[];
  isOther?: boolean;
}

interface NotificationSource {
  category: NotificationCategory | 'other';
  label: string;
  apps: ConnectedApp[];
  isOther?: boolean;
}

interface ThreatIntelSource {
  category: ThreatIntelCategory | 'other';
  label: string;
  apps: ConnectedApp[];
  isOther?: boolean;
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
  authStates = {},
  apiAuthEntries = [],
  onAuthChange,
  onTestConnection,
  onSaveAuth,
}: EnrichmentConfigProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [configuringAppId, setConfiguringAppId] = useState<string | null>(null);
  const [otherExpanded, setOtherExpanded] = useState<Record<string, boolean>>({});
  
  // Threat feeds management
  const { threatFeeds, saveFeed, deleteFeed, toggleFeed, initializeDefaults: initThreatFeeds } = useThreatFeeds();
  const [editingFeed, setEditingFeed] = useState<ThreatFeed | null>(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedName, setNewFeedName] = useState('');

  // Create a set of selected app names (normalized) for quick lookup
  const selectedAppNames = useMemo(() => {
    const names = new Set<string>();
    selectedApps.forEach(app => {
      names.add(app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_'));
    });
    return names;
  }, [selectedApps]);

  const isAppSelected = (appName: string) => {
    const normalized = appName.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
    return selectedAppNames.has(normalized);
  };

  // Build dynamic options based on connected apps
  const enrichmentOptions = useMemo(() => {
    const dedupedApps = deduplicateAuthApps(
      authenticatedApps.filter(auth => auth.active || auth.validation?.valid)
    );
    
    const appValidationMap = new Map<string, boolean>();
    dedupedApps.forEach(({ app, hasValidAuth }) => {
      const normalized = app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
      appValidationMap.set(normalized, hasValidAuth);
    });
    
    const ingestionByCategory: Record<IngestionCategory | 'other', ConnectedApp[]> = {
      email: [],
      cases: [],
      edr: [],
      siem: [],
      other: [],
    };
    
    // Track which app IDs have been categorized
    const categorizedIngestionIds = new Set<string>();
    
    dedupedApps.forEach(({ app, bestImage, hasValidAuth }) => {
      const category = getIngestionCategory(app.name, app.categories);
      if (category) {
        ingestionByCategory[category].push({
          id: app.id,
          name: app.name,
          image: bestImage || app.large_image,
          isValidated: hasValidAuth,
          isSelected: isAppSelected(app.name),
          hasAuthConfig: true,
        });
        categorizedIngestionIds.add(app.id);
      }
    });
    
    selectedApps.forEach(app => {
      const normalizedName = app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
      if (appValidationMap.has(normalizedName)) return;
      
      const category = getIngestionCategory(app.name, app.categories);
      if (category) {
        ingestionByCategory[category].push({
          id: app.objectID,
          name: app.name,
          image: app.image_url,
          isValidated: false,
          isSelected: true,
          hasAuthConfig: false,
        });
        categorizedIngestionIds.add(app.objectID);
      }
    });
    
    // Collect "Other" apps: authenticated but not categorized as ingestion, threat intel, or communication
    dedupedApps.forEach(({ app, bestImage, hasValidAuth }) => {
      if (categorizedIngestionIds.has(app.id)) return;
      if (isThreatIntelApp(app.name)) return;
      if (isEmailApp(app.name)) return; // Already in email category
      if (isCommunicationApp({ app, active: true, validation: { valid: true } })) return;
      
      ingestionByCategory.other.push({
        id: app.id,
        name: app.name,
        image: bestImage || app.large_image,
        isValidated: hasValidAuth,
        isSelected: isAppSelected(app.name),
        hasAuthConfig: true,
      });
    });
    
    const sortApps = (apps: ConnectedApp[]): ConnectedApp[] => {
      return [...apps].sort((a, b) => {
        const scoreA = (a.isSelected ? 2 : 0) + (a.isValidated ? 1 : 0);
        const scoreB = (b.isSelected ? 2 : 0) + (b.isValidated ? 1 : 0);
        return scoreB - scoreA;
      });
    };
    
    const ingestionSources: IngestionSource[] = [
      { category: 'email', label: 'Email', apps: sortApps(ingestionByCategory.email) },
      { category: 'cases', label: 'Cases', apps: sortApps(ingestionByCategory.cases) },
      { category: 'edr', label: 'EDR', apps: sortApps(ingestionByCategory.edr) },
      { category: 'siem', label: 'SIEM', apps: sortApps(ingestionByCategory.siem) },
    ];
    
    // Only add "Other" if there are uncategorized apps
    if (ingestionByCategory.other.length > 0) {
      ingestionSources.push({ category: 'other', label: 'Other', apps: sortApps(ingestionByCategory.other), isOther: true });
    }
    
    const validatedCount = Object.values(ingestionByCategory).flat().filter(a => a.isValidated).length;
    const totalCount = Object.values(ingestionByCategory).flat().length;
    
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
        const threatIntelApps: ConnectedApp[] = [];
        
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
    onSave?.(newState);
    
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
    onSave?.(newState);
  };

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
    if (current?.tools && appId in current.tools) {
      return current.tools[appId] !== false;
    }
    const appInfo = getAppInfo(optionId, appId);
    return appInfo?.isSelected === true && appInfo?.isValidated === true;
  };

  const triggerWorkflowGeneration = useCallback((optionId: string, state: EnrichmentState, actionName?: string) => {
    const option = enrichmentOptions.find(o => o.id === optionId);
    if (!option) return;
    
    const allTools = getAllToolsForOption(option);
    
    const enabledTools = actionName === 'disable' 
      ? allTools
      : allTools.filter(tool => {
          const current = state[optionId];
          if (current?.tools && tool.id in current.tools) {
            return current.tools[tool.id] !== false;
          }
          return tool.isSelected === true && tool.isValidated === true;
        });
    
    const enabledAppNames = enabledTools.map(tool => tool.name);
    
    const labels = AUTOMATION_WORKFLOW_LABELS[optionId] || [];
    
    labels.forEach(label => {
      generateWorkflow(label, enabledAppNames, 'cases', actionName);
    });
  }, [enrichmentOptions]);

  const toggleTool = (optionId: string, appId: string, appName: string) => {
    const current = enrichmentState[optionId] || { enabled: false, config: {}, tools: {} };
    const currentTools = current.tools || {};
    const isCurrentlyEnabled = currentTools[appId] !== false;
    const newToolState = !isCurrentlyEnabled;
    
    const newState = {
      ...enrichmentState,
      [optionId]: {
        ...current,
        tools: { ...currentTools, [appId]: newToolState },
      },
    };
    onEnrichmentChange(newState);
    onSave?.(newState);
    
    triggerWorkflowGeneration(optionId, newState);
  };

  const enrichmentItems = enrichmentOptions.filter((o) => o.category === 'enrichment');
  const responseItems = enrichmentOptions.filter((o) => o.category === 'response');

  // Helper to render inline auth card for a pending app
  const renderInlineAuth = (app: ConnectedApp) => {
    if (!onAuthChange || !onTestConnection || !onSaveAuth) return null;
    
    const algoliaApp = {
      objectID: app.id,
      name: app.name,
      image_url: app.image || '',
      description: '',
      categories: [],
    } as AlgoliaSearchApp;
    const curAuthState = authStates[app.id] || {
      systemId: app.id,
      status: 'pending' as const,
      credentials: {},
    };
    const matchingEntries = apiAuthEntries.filter(
      auth => auth.app?.name?.toLowerCase() === app.name.toLowerCase()
    );
    return (
      <Box sx={{ mt: 1 }}>
        <AppAuthCard
          app={algoliaApp}
          authState={curAuthState}
          isExpanded={true}
          onToggle={() => {}}
          onAuthChange={onAuthChange}
          onTestConnection={onTestConnection}
          onSaveAuth={onSaveAuth}
          apiAuthEntries={matchingEntries}
        />
      </Box>
    );
  };

  // Render a single tool row with optional inline auth
  const renderToolRow = (app: ConnectedApp, optionId: string, optionColor: string) => {
    const enabled = isToolEnabled(optionId, app.id);
    const isConfiguring = configuringAppId === app.id;
    
    return (
      <Box key={app.id} sx={{ mb: 0.5 }}>
        <Box
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
              : isConfiguring
                ? 'rgba(255, 102, 0, 0.4)'
                : 'transparent',
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!app.isValidated && onAuthChange && onTestConnection && onSaveAuth && (
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfiguringAppId(isConfiguring ? null : app.id);
                }}
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  py: 0.25,
                  px: 1,
                  minWidth: 'auto',
                  borderColor: isConfiguring ? '#FF6600' : 'rgba(255, 152, 0, 0.4)',
                  color: isConfiguring ? '#FF6600' : '#ff9800',
                  '&:hover': {
                    borderColor: '#FF6600',
                    background: 'rgba(255, 102, 0, 0.1)',
                  },
                }}
              >
                {isConfiguring ? 'Close' : 'Configure'}
              </Button>
            )}
            <Switch
              size="small"
              checked={isToolEnabled(optionId, app.id)}
              onChange={() => toggleTool(optionId, app.id, app.name)}
              disabled={!app.isValidated}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: optionColor,
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: optionColor,
                },
                '&.Mui-disabled': {
                  opacity: 0.4,
                },
              }}
            />
          </Box>
        </Box>
        {isConfiguring && renderInlineAuth(app)}
      </Box>
    );
  };

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
                        
                        {/* Source breakdowns */}
                        {option.ingestionSources && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {option.ingestionSources.map((source) => {
                              const activeCount = source.apps.filter(a => isToolEnabled(option.id, a.id)).length;
                              const totalCount = source.apps.length;
                              return (
                                <SourceChip key={source.category} label={source.label} apps={source.apps} activeCount={activeCount} totalCount={totalCount} hasAnyActive={activeCount > 0} optionId={option.id} isToolEnabled={isToolEnabled} />
                              );
                            })}
                          </Box>
                        )}
                        
                        {option.notificationSources && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {option.notificationSources.map((source) => {
                              const activeCount = source.apps.filter(a => isToolEnabled(option.id, a.id)).length;
                              const totalCount = source.apps.length;
                              return (
                                <SourceChip key={source.category} label={source.label} apps={source.apps} activeCount={activeCount} totalCount={totalCount} hasAnyActive={activeCount > 0} optionId={option.id} isToolEnabled={isToolEnabled} />
                              );
                            })}
                          </Box>
                        )}
                        
                        {option.threatIntelSources && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {option.threatIntelSources.map((source) => {
                              const activeCount = source.apps.filter(a => isToolEnabled(option.id, a.id)).length;
                              const totalCount = source.apps.length;
                              return (
                                <SourceChip key={source.category} label={source.label} apps={source.apps} activeCount={activeCount} totalCount={totalCount} hasAnyActive={activeCount > 0} optionId={option.id} isToolEnabled={isToolEnabled} />
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
                              (option.ingestionSources || option.notificationSources || option.threatIntelSources)!.filter(s => s.apps.length > 0).map((source) => (
                                <Box key={source.category}>
                                  {source.isOther ? (
                                    // "Other" section: collapsed by default with icon preview
                                    <Box>
                                      <Box
                                        onClick={() => setOtherExpanded(prev => ({ ...prev, [option.id]: !prev[option.id] }))}
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 1,
                                          cursor: 'pointer',
                                          py: 0.75,
                                          px: 1,
                                          borderRadius: 1.5,
                                          border: '1px dashed rgba(255, 255, 255, 0.12)',
                                          background: 'rgba(255, 255, 255, 0.02)',
                                          transition: 'all 0.2s ease',
                                          '&:hover': {
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            borderColor: 'rgba(255, 255, 255, 0.2)',
                                          },
                                        }}
                                      >
                                        <Typography
                                          variant="caption"
                                          sx={{ 
                                            color: 'rgba(255, 255, 255, 0.4)', 
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5,
                                            fontSize: '0.65rem',
                                          }}
                                        >
                                          Other
                                        </Typography>
                                        {/* App icon preview when collapsed */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5, flex: 1 }}>
                                          {source.apps.slice(0, 6).map((app, idx) => (
                                            <Tooltip key={app.id} title={app.name} arrow placement="top">
                                              <Avatar
                                                src={app.image}
                                                alt={app.name}
                                                sx={{
                                                  width: 20,
                                                  height: 20,
                                                  fontSize: '0.5rem',
                                                  border: '2px solid',
                                                  borderColor: app.isValidated 
                                                    ? 'rgba(34, 197, 94, 0.4)' 
                                                    : 'rgba(255, 152, 0, 0.4)',
                                                  backgroundColor: 'rgba(33, 33, 33, 0.9)',
                                                  ml: idx > 0 ? -0.5 : 0,
                                                }}
                                              >
                                                {app.name[0]}
                                              </Avatar>
                                            </Tooltip>
                                          ))}
                                          {source.apps.length > 6 && (
                                            <Typography
                                              variant="caption"
                                              sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', ml: 0.5 }}
                                            >
                                              +{source.apps.length - 6}
                                            </Typography>
                                          )}
                                        </Box>
                                        <ExpandMoreIcon
                                          sx={{
                                            color: 'rgba(255, 255, 255, 0.3)',
                                            transform: otherExpanded[option.id] ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 0.2s ease',
                                            fontSize: 16,
                                          }}
                                        />
                                      </Box>
                                      <Collapse in={otherExpanded[option.id] || false}>
                                        <Box sx={{ mt: 0.5 }}>
                                          {source.apps.map((app) => renderToolRow(app, option.id, option.color))}
                                        </Box>
                                      </Collapse>
                                    </Box>
                                  ) : (
                                    // Standard categorized section
                                    <>
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
                                      {source.apps.map((app) => renderToolRow(app, option.id, option.color))}
                                    </>
                                  )}
                                </Box>
                              ))
                            ) : option.connectedApps ? (
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

                    {/* Threat Feed URLs section - only for threat_intel */}
                    {option.id === 'threat_intel' && (
                      <Collapse in={isExpanded}>
                        <Box sx={{ mt: 2, pl: 7 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                            <Typography
                              variant="caption"
                              sx={{ 
                                color: 'rgba(255, 255, 255, 0.5)', 
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                fontSize: '0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <LinkIcon sx={{ fontSize: 14 }} />
                              Threat Feed URLs
                            </Typography>
                            <Tooltip title="Reset to default feeds" arrow>
                              <IconButton
                                size="small"
                                onClick={() => initThreatFeeds()}
                                sx={{ 
                                  color: 'rgba(255, 255, 255, 0.4)',
                                  '&:hover': { color: '#ff6600' },
                                }}
                              >
                                <RestoreIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          
                          {/* Existing feeds */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                            {threatFeeds.map((feed) => (
                              <Box
                                key={feed.id}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  py: 0.75,
                                  px: 1.5,
                                  borderRadius: 1.5,
                                  background: feed.enabled 
                                    ? 'rgba(239, 68, 68, 0.08)' 
                                    : 'rgba(0, 0, 0, 0.2)',
                                  border: '1px solid',
                                  borderColor: feed.enabled 
                                    ? 'rgba(239, 68, 68, 0.25)' 
                                    : 'transparent',
                                  opacity: feed.enabled ? 1 : 0.6,
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                {editingFeed?.id === feed.id ? (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, mr: 1 }}>
                                    <TextField
                                      size="small"
                                      placeholder="Feed name"
                                      value={editingFeed.name}
                                      onChange={(e) => setEditingFeed({ ...editingFeed, name: e.target.value })}
                                      sx={{
                                        '& .MuiOutlinedInput-root': {
                                          bgcolor: 'rgba(0,0,0,0.3)',
                                          fontSize: '0.85rem',
                                        },
                                      }}
                                    />
                                    <TextField
                                      size="small"
                                      placeholder="Feed URL"
                                      value={editingFeed.url}
                                      onChange={(e) => setEditingFeed({ ...editingFeed, url: e.target.value })}
                                      sx={{
                                        '& .MuiOutlinedInput-root': {
                                          bgcolor: 'rgba(0,0,0,0.3)',
                                          fontFamily: 'monospace',
                                          fontSize: '0.75rem',
                                        },
                                      }}
                                    />
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        onClick={async () => {
                                          await saveFeed(editingFeed);
                                          setEditingFeed(null);
                                        }}
                                        sx={{ fontSize: '0.7rem', py: 0.25, bgcolor: option.color }}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setEditingFeed(null)}
                                        sx={{ fontSize: '0.7rem', py: 0.25 }}
                                      >
                                        Cancel
                                      </Button>
                                    </Box>
                                  </Box>
                                ) : (
                                  <>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                                        {feed.name}
                                      </Typography>
                                      <Typography 
                                        variant="caption" 
                                        sx={{ 
                                          color: 'rgba(255, 255, 255, 0.5)', 
                                          fontFamily: 'monospace',
                                          fontSize: '0.65rem',
                                          display: 'block',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {feed.url}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Tooltip title="Edit feed" arrow>
                                        <IconButton
                                          size="small"
                                          onClick={() => setEditingFeed(feed)}
                                          sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}
                                        >
                                          <EditIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete feed" arrow>
                                        <IconButton
                                          size="small"
                                          onClick={() => deleteFeed(feed.id)}
                                          sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444' } }}
                                        >
                                          <DeleteIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                      </Tooltip>
                                      <Switch
                                        size="small"
                                        checked={feed.enabled}
                                        onChange={() => toggleFeed(feed.id)}
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
                                  </>
                                )}
                              </Box>
                            ))}
                          </Box>
                          
                          {/* Add new feed */}
                          <Box 
                            sx={{ 
                              p: 1.5, 
                              borderRadius: 1.5, 
                              border: '1px dashed rgba(255, 255, 255, 0.15)',
                              background: 'rgba(0, 0, 0, 0.15)',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', mb: 1, display: 'block' }}>
                              Add new threat feed URL
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <TextField
                                size="small"
                                placeholder="Feed name"
                                value={newFeedName}
                                onChange={(e) => setNewFeedName(e.target.value)}
                                sx={{
                                  minWidth: 150,
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: 'rgba(0,0,0,0.3)',
                                    fontSize: '0.85rem',
                                  },
                                }}
                              />
                              <TextField
                                size="small"
                                placeholder="https://..."
                                value={newFeedUrl}
                                onChange={(e) => setNewFeedUrl(e.target.value)}
                                sx={{
                                  flex: 1,
                                  minWidth: 200,
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: 'rgba(0,0,0,0.3)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                  },
                                }}
                              />
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                                disabled={!newFeedUrl.trim() || !newFeedName.trim()}
                                onClick={async () => {
                                  if (newFeedUrl.trim() && newFeedName.trim()) {
                                    const newFeed: ThreatFeed = {
                                      id: `custom_${Date.now()}`,
                                      url: newFeedUrl.trim(),
                                      name: newFeedName.trim(),
                                      enabled: true,
                                    };
                                    await saveFeed(newFeed);
                                    setNewFeedUrl('');
                                    setNewFeedName('');
                                  }
                                }}
                                sx={{ 
                                  borderColor: 'rgba(255, 255, 255, 0.2)',
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  '&:hover': {
                                    borderColor: option.color,
                                    color: option.color,
                                  },
                                }}
                              >
                                Add
                              </Button>
                            </Box>
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

  // Build connected apps summary from authenticatedApps
  const dedupedSummaryApps = useMemo(() => {
    return deduplicateAuthApps(
      authenticatedApps.filter(auth => auth.active || auth.validation?.valid)
    );
  }, [authenticatedApps]);

  const validatedSummaryCount = dedupedSummaryApps.filter(a => a.hasValidAuth).length;
  const totalSummaryCount = dedupedSummaryApps.length;

  // Sort: validated first, then alphabetically
  const sortedSummaryApps = useMemo(() => {
    return [...dedupedSummaryApps].sort((a, b) => {
      if (a.hasValidAuth && !b.hasValidAuth) return -1;
      if (!a.hasValidAuth && b.hasValidAuth) return 1;
      return a.app.name.localeCompare(b.app.name);
    });
  }, [dedupedSummaryApps]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{
            color: 'white',
            fontWeight: 700,
            mb: 0.5,
          }}
        >
          Automate & Finish
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
        >
          Review your connected tools, configure automation, and you're all set.
        </Typography>
      </Box>

      {/* Connected Apps Summary Strip */}
      {totalSummaryCount > 0 && (
        <Box
          sx={{
            mb: 4,
            p: 2.5,
            borderRadius: 3,
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: 600,
                letterSpacing: 1.5,
                fontSize: '0.65rem',
              }}
            >
              Connected Apps
            </Typography>
            <Chip
              label={`${validatedSummaryCount}/${totalSummaryCount} validated`}
              size="small"
              sx={{
                height: 22,
                background: validatedSummaryCount === totalSummaryCount
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(255, 152, 0, 0.15)',
                color: validatedSummaryCount === totalSummaryCount ? '#22c55e' : '#ff9800',
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {sortedSummaryApps.map((dedupedApp) => (
              <Tooltip
                key={dedupedApp.app.id}
                title={
                  <Box sx={{ p: 0.5 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      {dedupedApp.app.name.replace(/_/g, ' ')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', opacity: 0.8, mt: 0.25 }}>
                      {dedupedApp.hasValidAuth ? '✓ Validated' : '⏳ Pending validation'}
                    </Typography>
                  </Box>
                }
                arrow
                placement="top"
              >
                <Box
                  component={RouterLink}
                  to={`/apps/${encodeURIComponent(dedupedApp.app.name.toLowerCase())}`}
                  sx={{
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                    '&:hover': { transform: 'scale(1.15)' },
                  }}
                >
                  {dedupedApp.bestImage ? (
                    <Avatar
                      src={dedupedApp.bestImage}
                      alt={dedupedApp.app.name}
                      sx={{
                        width: 32,
                        height: 32,
                        border: '2px solid',
                        borderColor: dedupedApp.hasValidAuth ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 152, 0, 0.5)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        '& img': { objectFit: 'contain', p: 0.25 },
                      }}
                    />
                  ) : (
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        border: '2px solid',
                        borderColor: dedupedApp.hasValidAuth ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 152, 0, 0.5)',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {dedupedApp.app.name.charAt(0).toUpperCase()}
                    </Avatar>
                  )}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: dedupedApp.hasValidAuth ? '#22c55e' : '#ff9800',
                      border: '2px solid rgba(0, 0, 0, 0.5)',
                    }}
                  />
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {/* Automation Sections */}
      <Box sx={{ mb: 1 }}>
        {enabledCount > 0 && (
          <Chip
            label={`${enabledCount} automation${enabledCount > 1 ? 's' : ''} enabled`}
            size="small"
            sx={{
              mb: 2,
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
