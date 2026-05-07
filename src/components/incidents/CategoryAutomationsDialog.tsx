import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Divider,
  CircularProgress,
  Checkbox,
  TextField,
  Autocomplete,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import RestoreIcon from '@mui/icons-material/Restore';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import WebhookIcon from '@mui/icons-material/Webhook';
import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import EnhancedEncryptionIcon from '@mui/icons-material/EnhancedEncryption';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SecurityIcon from '@mui/icons-material/Security';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { toast } from '@/lib/toast';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import DownloadIcon from '@mui/icons-material/Download';
import PopupTextEditor from '@/components/shared/PopupTextEditor';
import AppSearchDrawer from '@/Shuffle-MCPs/AppSearchDrawer';
import { useAuthenticatedApps } from '@/hooks/useAuthenticatedApps';
import AddIcon from '@mui/icons-material/Add';
import { Tooltip } from '@mui/material';

import { CategoryAutomation } from '@/Shuffle-MCPs/datastore';
import { extractValidatedIngestionApps, ValidatedIngestionApp, findIngestTicketsWorkflow, extractWorkflowAppNames } from '@/Shuffle-MCPs/ingestionDetection';
import { IngestionSourceButton } from '@/components/incidents/IngestionSourceButton';

// API format for automations
interface AutomationApiFormat {
  name: string;
  description: string;
  options: { key: string; value: string }[];
  icon: string;
  enabled: boolean;
  type?: string;
  disabled?: boolean;
}

interface Workflow {
  id: string;
  name: string;
}

interface CategoryAutomationsDialogProps {
  open: boolean;
  onClose: () => void;
  category: string;
  automations: CategoryAutomation[] | null;
  onAutomationsChange: (automations: CategoryAutomation[]) => void;
  initialSettings?: { timeout?: number; public?: boolean };
  onSaved?: () => void;
}

const WEEKS_OPTIONS = [
  { label: 'Never', seconds: 0 },
  { label: '1 week', seconds: 604800 },
  { label: '2 weeks', seconds: 1209600 },
  { label: '4 weeks', seconds: 2419200 },
  { label: '8 weeks', seconds: 4838400 },
  { label: '12 weeks', seconds: 7257600 },
  { label: '26 weeks', seconds: 15724800 },
  { label: '52 weeks', seconds: 31449600 },
  { label: '104 weeks', seconds: 62899200 },
  { label: '156 weeks', seconds: 94348800 },
];

const automationConfigs = [
  {
    type: 'ai_agent',
    name: 'Run AI Agent',
    description: 'Runs an AI Agent to process the updated value. Uses built-in ShuffleAI configs. Learn more: https://shuffler.io/docs/AI',
    icon: (props: any) => <AgentIcon size={props?.sx?.fontSize || 20} />,
    color: '#10b981',
    apiIcon: '',
    apiType: 'singul',
    optionKey: 'prompts',
    hasConfig: true,
  },
  {
    type: 'workflow',
    name: 'Run workflow',
    description: 'Runs one or more workflows with the updated value as runtime argument',
    icon: AccountTreeIcon,
    color: '#3b82f6',
    apiIcon: '',
    optionKey: 'workflow_id',
    hasConfig: true,
  },
  {
    type: 'webhook',
    name: 'Send webhook',
    description: 'Sends the updated value to a specified webhook URL as a POST request',
    icon: WebhookIcon,
    color: '#8b5cf6',
    apiIcon: '',
    optionKey: 'webhook_url',
    hasConfig: true,
  },
  {
    type: 'enrich',
    name: 'Enrich',
    description: "Enriches the data. Only runs on valid JSON data AND if the 'enrichment' field does not exist.",
    icon: EnhancedEncryptionIcon,
    color: '#f59e0b',
    apiIcon: '/images/logos/singul.svg',
    apiType: 'singul',
    hasConfig: false,
  },
  {
    type: 'security_rules',
    name: 'Security Rules',
    description: 'Describes security rules that are validated BEFORE an update occurs. This is in order for bad writes to be avoided. Control: allow, deny, merge, overwrite. Logic: if, or, and. Functions: same_shape, is_superset, has_deleted_field',
    icon: SecurityIcon,
    color: '#3b82f6',
    apiIcon: '',
    apiType: '',
    optionKey: 'rule',
    hasConfig: true,
  },
];

const getOrgId = (): string | null => {
  try {
    const userInfo = localStorage.getItem('shuffle_user_info');
    if (userInfo) {
      const parsed = JSON.parse(userInfo);
      return parsed.active_org?.id || null;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
};

export const CategoryAutomationsDialog: React.FC<CategoryAutomationsDialogProps> = ({
  open,
  onClose,
  category,
  automations: initialAutomations,
  onAutomationsChange,
  initialSettings,
  onSaved,
}) => {
  const navigate = useNavigate();
  const [automations, setAutomations] = useState<CategoryAutomation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [cleanupTimeout, setCleanupTimeout] = useState<number>(0);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [selectedWorkflows, setSelectedWorkflows] = useState<Workflow[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [ingestionApps, setIngestionApps] = useState<ValidatedIngestionApp[]>([]);
  const [securityRulesText, setSecurityRulesText] = useState('');
  const [aiAgentPrompts, setAiAgentPrompts] = useState<string[]>(['']);
  /** Per-prompt allow-list of app names. Indices align with aiAgentPrompts. */
  const [aiAgentApps, setAiAgentApps] = useState<string[][]>([[]]);
  const [appPickerForIdx, setAppPickerForIdx] = useState<number | null>(null);
  const { data: authenticatedApps = [] } = useAuthenticatedApps();
  /** Lookup table for app metadata (image, display name) keyed by both
   *  app ID and app name, so that legacy stored values still resolve. */
  const appMetaById = React.useMemo(() => {
    const map = new Map<string, { name: string; image: string }>();
    authenticatedApps.forEach((a: any) => {
      const name = a?.app?.name;
      const id = a?.app?.id || a?.id;
      const image = a?.app?.large_image || a?.app?.small_image || '';
      if (id && !map.has(id)) map.set(id, { name: name || id, image });
      if (name && !map.has(name)) map.set(name, { name, image });
    });
    return map;
  }, [authenticatedApps]);

  /** Algolia-fetched metadata for app IDs that are NOT in the authenticated
   *  list (allowed apps may include catalog-only apps). Cached for the
   *  lifetime of the component. */
  const [algoliaAppMeta, setAlgoliaAppMeta] = useState<Record<string, { name: string; image: string }>>({});
  useEffect(() => {
    // Collect all IDs currently referenced that we don't know yet
    const allIds = new Set<string>();
    aiAgentApps.forEach(arr => arr.forEach(id => { if (id) allIds.add(id); }));
    const missing = [...allIds].filter(id =>
      !appMetaById.has(id) && !algoliaAppMeta[id] && /^[a-f0-9]{16,}$/i.test(id),
    );
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        const res: any = await (client as any).getObjects({
          requests: missing.map(objectID => ({ indexName: 'appsearch', objectID })),
        });
        if (cancelled) return;
        const next: Record<string, { name: string; image: string }> = {};
        (res?.results || []).forEach((hit: any) => {
          if (hit?.objectID) {
            next[hit.objectID] = {
              name: hit.name || hit.objectID,
              image: hit.image_url || '',
            };
          }
        });
        if (Object.keys(next).length > 0) {
          setAlgoliaAppMeta(prev => ({ ...prev, ...next }));
        }
      } catch {
        /* ignore — image lookup is optional */
      }
    })();
    return () => { cancelled = true; };
  }, [aiAgentApps, appMetaById, algoliaAppMeta]);

  /** Unified resolver: prefer authenticated apps, then Algolia cache. */
  const resolveAppMeta = (key: string): { name: string; image: string } => {
    return (
      appMetaById.get(key) ||
      algoliaAppMeta[key] || {
        name: key,
        image: '',
      }
    );
  };
  /**
   * Tracks which automation rows have their config section expanded.
   * Enabling an automation no longer auto-expands it — the user explicitly
   * clicks the chevron on the row header to reveal/hide configuration.
   * Keyed by automation type (e.g. 'workflow', 'webhook', 'security_rules').
   */
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  // (Popup editor lives inside the shared PopupTextEditor component.)
  const toggleExpanded = (type: string) =>
    setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));

  const fetchIngestionApps = async () => {
    try {
      const [authResponse, wfResponse] = await Promise.all([
        fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
        fetch(getApiUrl('/api/v1/workflows'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        }),
      ]);
      if (authResponse.ok) {
        const result = await authResponse.json();
        const authApps = Array.isArray(result) ? result : (result.data || []);
        let workflowAppNames: Set<string> | undefined;
        if (wfResponse.ok) {
          const wfData = await wfResponse.json();
          const wfList = Array.isArray(wfData) ? wfData : wfData.workflows || [];
          const ingestWf = findIngestTicketsWorkflow(wfList);
          if (ingestWf) {
            workflowAppNames = extractWorkflowAppNames(ingestWf);
          }
        }
        setIngestionApps(extractValidatedIngestionApps(authApps, workflowAppNames));
      }
    } catch (error) {
      console.error('Failed to fetch ingestion apps:', error);
    }
  };

  // Fetch workflows and ingestion config when dialog opens
  useEffect(() => {
    if (open) {
      const fetchWorkflows = async () => {
        setLoadingWorkflows(true);
        try {
          const response = await fetch(getApiUrl('/api/v1/workflows'), {
            credentials: 'include',
            headers: {
              ...getAuthHeader(),
            },
          });
          if (response.ok) {
            const data = await response.json();
            const workflowList = Array.isArray(data) ? data : data.workflows || [];
            // Pre-collect already-selected workflow IDs from the existing config so
            // background_processing workflows that are already in use stay visible
            // (otherwise the picker would show their raw ID instead of the name).
            const preselectedIds = new Set<string>();
            const wfAutomation = (initialAutomations || []).find(a => a.name === 'Run workflow');
            const wfOption = wfAutomation?.options?.find(o => o.key === 'workflow_id');
            if (wfOption?.value) {
              wfOption.value.split(',').map(s => s.trim()).filter(Boolean).forEach(id => preselectedIds.add(id));
            }
            setWorkflows(
              workflowList
                .filter((w: any) => !w.background_processing || preselectedIds.has(w.id))
                .map((w: any) => ({ id: w.id, name: w.name || w.id })),
            );
          }
        } catch (error) {
          console.error('Failed to fetch workflows:', error);
        } finally {
          setLoadingWorkflows(false);
        }
      };

      fetchWorkflows();
      fetchIngestionApps();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      // Initialize with all automation types, preserving existing states
      // Match by name since API uses name as identifier
      const existingByName = new Map((initialAutomations || []).map(a => [a.name, a]));
      const allAutomations: CategoryAutomation[] = automationConfigs.map(config => {
        const existing = existingByName.get(config.name);
        if (existing) {
          return {
            ...existing,
            type: config.type as CategoryAutomation['type'],
          };
        }
        return {
          id: `auto-${config.type}`,
          name: config.name,
          type: config.type as CategoryAutomation['type'],
          trigger: 'on_edit' as const,
          enabled: false,
        };
      });
      setAutomations(allAutomations);
      setHasChanges(false);
      setCleanupTimeout(initialSettings?.timeout || 0);

      // Extract existing workflow IDs and webhook URL
      const workflowAutomation = existingByName.get('Run workflow');
      if (workflowAutomation?.options) {
        const workflowOption = workflowAutomation.options.find(o => o.key === 'workflow_id');
        if (workflowOption?.value) {
          const ids = workflowOption.value.split(',').filter(Boolean);
          // Will be populated once workflows are loaded
          setSelectedWorkflows(ids.map(id => ({ id: id.trim(), name: id.trim() })));
        }
      }

      const webhookAutomation = existingByName.get('Send webhook');
      if (webhookAutomation?.options) {
        const urlOption = webhookAutomation.options.find(o => o.key === 'webhook_url');
        if (urlOption?.value) {
          setWebhookUrl(urlOption.value);
        }
      }

      const rulesAutomation = existingByName.get('Security Rules');
      if (rulesAutomation?.options) {
        const rulesOption = rulesAutomation.options.find(o => o.key === 'rule');
        if (rulesOption?.value) {
          setSecurityRulesText(rulesOption.value);
        }
      }

      const aiAutomation = existingByName.get('Run AI Agent');
      if (aiAutomation?.options && aiAutomation.options.length > 0) {
        // Options use keys: "action", "action-2", "action-3", etc.
        const actionOptions = aiAutomation.options
          .filter(o => o.key === 'action' || /^action-\d+$/.test(o.key))
          .sort((a, b) => {
            const numA = a.key === 'action' ? 1 : parseInt(a.key.replace('action-', ''));
            const numB = b.key === 'action' ? 1 : parseInt(b.key.replace('action-', ''));
            return numA - numB;
          });
        const prompts = actionOptions.map(o => o.value).filter(Boolean);
        const finalPrompts = prompts.length > 0 ? prompts : [''];
        setAiAgentPrompts(finalPrompts);

        // Parse parallel "apps" / "apps-N" options (comma-separated app names)
        const appsByIdx: string[][] = finalPrompts.map((_, i) => {
          const key = i === 0 ? 'apps' : `apps-${i + 1}`;
          const opt = aiAutomation.options.find(o => o.key === key);
          return opt?.value
            ? opt.value.split(',').map(s => s.trim()).filter(Boolean)
            : [];
        });
        setAiAgentApps(appsByIdx);
      } else {
        setAiAgentPrompts(['']);
        setAiAgentApps([[]]);
      }
    }
  }, [open, initialAutomations]);

  // Update selected workflows with names once workflows are loaded
  useEffect(() => {
    if (workflows.length > 0 && selectedWorkflows.length > 0) {
      setSelectedWorkflows(prev => 
        prev.map(sw => {
          const found = workflows.find(w => w.id === sw.id);
          return found || sw;
        })
      );
    }
  }, [workflows]);

  const handleToggleAutomation = (type: string) => {
    setAutomations(automations.map(a => 
      a.type === type ? { ...a, enabled: !a.enabled, trigger: 'on_edit' as CategoryAutomation['trigger'] } : a
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const orgId = getOrgId();
    if (!orgId) {
      toast.error('No organization found');
      return;
    }

    setIsSaving(true);
    try {
      // Build API format payload
      const apiAutomations: AutomationApiFormat[] = automationConfigs.map(config => {
        const automation = automations.find(a => a.type === config.type);
        const isEnabled = automation?.enabled || false;
        
        // Build options based on type
        let options: { key: string; value: string }[] = [];
        if (config.type === 'workflow') {
          options = [{ key: config.optionKey || '', value: selectedWorkflows.map(w => w.id).join(',') }];
        } else if (config.type === 'webhook') {
          options = [{ key: config.optionKey || '', value: webhookUrl }];
        } else if (config.type === 'security_rules') {
          options = [{ key: config.optionKey || '', value: securityRulesText }];
        } else if (config.type === 'ai_agent') {
          // Use "action", "action-2", "action-3" format, with parallel
          // "apps", "apps-2", … entries holding the per-prompt allow-list
          // of app names (comma-separated).
          const pairs = aiAgentPrompts
            .map((prompt, idx) => ({ prompt, apps: aiAgentApps[idx] || [] }))
            .filter(p => p.prompt.trim());
          options = [];
          pairs.forEach((p, idx) => {
            options.push({
              key: idx === 0 ? 'action' : `action-${idx + 1}`,
              value: p.prompt,
            });
            options.push({
              key: idx === 0 ? 'apps' : `apps-${idx + 1}`,
              value: p.apps.join(','),
            });
          });
          if (options.length === 0) {
            options = [{ key: 'action', value: '' }, { key: 'apps', value: '' }];
          }
        } else {
          options = [{ key: config.optionKey || '', value: '' }];
        }
        
        const baseAutomation: AutomationApiFormat = {
          name: config.name,
          description: config.description,
          options,
          icon: config.apiIcon || '',
          enabled: isEnabled,
        };

        if (config.apiType) {
          baseAutomation.type = config.apiType;
        }

        return baseAutomation;
      });

      // Add "Send message" as disabled (per API format)
      apiAutomations.push({
        name: 'Send message',
        description: '',
        type: 'singul',
        options: [{ key: 'app', value: '' }],
        icon: '',
        disabled: true,
        enabled: false,
      });

      const payload: any = {
        category,
        automations: apiAutomations,
      };
      if (cleanupTimeout > 0) {
        payload.settings = { timeout: cleanupTimeout };
      } else {
        payload.settings = { timeout: 0 };
      }
      
      const response = await fetch(getApiUrl('/api/v2/datastore/automate'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save automations');
      }

      const enabledAutomations = automations.filter(a => a.enabled);
      onAutomationsChange(enabledAutomations);
      toast.success('Automations saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error('Failed to save automations');
    } finally {
      setIsSaving(false);
    }
  };

  const enabledCount = automations.filter(a => a.enabled).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 2, pr: 6, pt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <RocketLaunchIcon sx={{ color: enabledCount > 0 ? '#4ade80' : 'text.secondary', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Automation for Incidents
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 16,
            top: 16,
            color: 'text.secondary',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 4, pb: 3 }}>
        {/* Trigger Section */}
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 1.5, 
              fontWeight: 500, 
              textTransform: 'uppercase', 
              letterSpacing: 0.5,
              fontSize: '0.75rem',
            }}
          >
            When
          </Typography>
          <Box 
            sx={{ 
              py: 1.5, 
              px: 2, 
              bgcolor: 'hsl(var(--muted) / 0.4)', 
              borderRadius: 1,
              border: '1px solid hsl(var(--border))',
            }}
          >
            <Typography sx={{ fontSize: '0.95rem' }}>
              An incident is edited
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3, borderColor: 'hsl(var(--border))' }} />

        {/* Actions Section */}
        <Box>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2, 
              fontWeight: 500, 
              textTransform: 'uppercase', 
              letterSpacing: 0.5,
              fontSize: '0.75rem',
            }}
          >
            Do
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {automations.map((automation) => {
              const config = automationConfigs.find(c => c.type === automation.type);
              if (!config) return null;
              const TypeIcon = config.icon;

              return (
                <Box
                  key={automation.id || automation.name}
                  sx={{
                    borderRadius: 1.5,
                    transition: 'all 0.15s',
                    bgcolor: automation.enabled ? 'hsl(var(--muted) / 0.35)' : 'transparent',
                    border: '1px solid',
                    borderColor: automation.enabled ? 'hsl(var(--border))' : 'transparent',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      py: 1.5,
                      px: 1.5,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'hsl(var(--muted) / 0.45)',
                      },
                    }}
                    onClick={() => handleToggleAutomation(automation.type!)}
                  >
                    <Checkbox
                      checked={automation.enabled}
                      onChange={() => handleToggleAutomation(automation.type!)}
                      onClick={(e) => e.stopPropagation()}
                      size="small"
                      sx={{
                        color: 'hsl(var(--muted-foreground))',
                        p: 0.5,
                        '&.Mui-checked': {
                          color: config.color,
                        },
                      }}
                    />
                    <TypeIcon 
                      sx={{ 
                        color: automation.enabled ? config.color : 'hsl(var(--muted-foreground))',
                        fontSize: 22,
                        transition: 'color 0.15s',
                      }} 
                    />
                    <Typography 
                      sx={{ 
                        flex: 1,
                        fontSize: '0.95rem',
                        color: automation.enabled ? 'text.primary' : 'hsl(var(--muted-foreground))',
                        fontWeight: automation.enabled ? 500 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {config.name}
                    </Typography>
                    {/* Chevron — only for automations that have a config
                        section. Clicking expands/collapses the config without
                        toggling the enabled state. Enabling no longer auto-
                        opens the config; the user controls visibility. */}
                    {config.hasConfig && (
                      <IconButton
                        size="small"
                        aria-label={expandedTypes[automation.type!] ? 'Collapse configuration' : 'Expand configuration'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(automation.type!);
                        }}
                        sx={{
                          color: 'hsl(var(--muted-foreground))',
                          p: 0.5,
                          transition: 'transform 0.15s',
                          transform: expandedTypes[automation.type!] ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        <ExpandMoreIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    )}
                  </Box>

                  {/* Workflow Configuration */}
                  {automation.type === 'workflow' && expandedTypes['workflow'] && (
                    <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={workflows}
                        loading={loadingWorkflows}
                        value={selectedWorkflows}
                        onChange={(_, newValue) => {
                          setSelectedWorkflows(newValue);
                          setHasChanges(true);
                        }}
                        getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Select workflows to run"
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                bgcolor: 'hsl(var(--background))',
                              },
                            }}
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              {...getTagProps({ index })}
                              key={option.id}
                              label={option.name}
                              size="small"
                              sx={{
                                bgcolor: 'hsl(var(--severity-info) / 0.2)',
                                color: 'hsl(var(--severity-info))',
                                '& .MuiChip-deleteIcon': {
                                  color: 'hsl(var(--severity-info) / 0.6)',
                                  '&:hover': { color: 'hsl(var(--severity-info))' },
                                },
                              }}
                            />
                          ))
                        }
                        sx={{
                          '& .MuiAutocomplete-popupIndicator': { color: 'text.secondary' },
                          '& .MuiAutocomplete-clearIndicator': { color: 'text.secondary' },
                        }}
                        slotProps={{
                          paper: {
                            sx: {
                              bgcolor: 'background.paper',
                              border: '1px solid',
                              borderColor: 'divider',
                            },
                          },
                        }}
                      />
                    </Box>
                  )}

                  {/* AI Agent Configuration - multiple prompts */}
                  {automation.type === 'ai_agent' && expandedTypes['ai_agent'] && (
                    <Box sx={{ px: 2, pb: 2, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      {aiAgentPrompts.map((prompt, idx) => {
                        const apps = aiAgentApps[idx] || [];
                        return (
                          <Box
                            key={idx}
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.75,
                              p: 1,
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 1.5,
                              bgcolor: 'hsl(var(--muted) / 0.2)',
                            }}
                          >
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <PopupTextEditor
                                value={prompt}
                                onChange={(next) => {
                                  const updated = [...aiAgentPrompts];
                                  updated[idx] = next;
                                  setAiAgentPrompts(updated);
                                  setHasChanges(true);
                                }}
                                placeholder={`Prompt ${idx + 1}...`}
                                title={`Edit prompt ${idx + 1}`}
                                subtitle="Full editor for the AI Agent prompt."
                              />
                              {aiAgentPrompts.length > 1 && (
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setAiAgentPrompts(aiAgentPrompts.filter((_, i) => i !== idx));
                                    setAiAgentApps(aiAgentApps.filter((_, i) => i !== idx));
                                    setHasChanges(true);
                                  }}
                                  sx={{ color: 'text.secondary', '&:hover': { color: 'hsl(var(--destructive))' } }}
                                >
                                  <CloseIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              )}
                            </Box>

                            {/* Per-prompt App Permissions */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography sx={{
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                color: 'hsl(var(--muted-foreground))',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}>
                                Allowed apps
                              </Typography>
                              <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                flexWrap: 'wrap',
                                flex: 1,
                              }}>
                                {apps.length === 0 && (
                                  <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
                                    All authenticated apps
                                  </Typography>
                                )}
                                {apps.map((appKey) => {
                                  const meta = resolveAppMeta(appKey);
                                  const displayName = meta.name;
                                  const img = meta.image || `https://shuffler.io/images/apps/${displayName}.png`;
                                  return (
                                    <Tooltip key={appKey} title={`Remove ${displayName.replace(/_/g, ' ')}`}>
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          const updated = [...aiAgentApps];
                                          updated[idx] = (updated[idx] || []).filter(n => n !== appKey);
                                          setAiAgentApps(updated);
                                          setHasChanges(true);
                                        }}
                                        sx={{
                                          width: 26,
                                          height: 26,
                                          border: '1px solid hsl(var(--severity-low) / 0.3)',
                                          bgcolor: 'hsl(var(--severity-low) / 0.1)',
                                          borderRadius: 1,
                                          '&:hover': {
                                            bgcolor: 'hsl(var(--destructive) / 0.15)',
                                            borderColor: 'hsl(var(--destructive) / 0.4)',
                                          },
                                        }}
                                      >
                                        <Box
                                          component="img"
                                          src={img}
                                          alt={displayName}
                                          sx={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'contain' }}
                                        />
                                      </IconButton>
                                    </Tooltip>
                                  );
                                })}
                                <Tooltip title="Add allowed app">
                                  <IconButton
                                    size="small"
                                    onClick={() => setAppPickerForIdx(idx)}
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      color: 'hsl(var(--muted-foreground))',
                                      border: '1px dashed hsl(var(--border))',
                                      borderRadius: 1,
                                      '&:hover': {
                                        bgcolor: 'hsl(var(--muted))',
                                        borderStyle: 'solid',
                                        color: 'hsl(var(--primary))',
                                      },
                                    }}
                                  >
                                    <AddIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                      <Button
                        size="small"
                        onClick={() => {
                          setAiAgentPrompts([...aiAgentPrompts, '']);
                          setAiAgentApps([...aiAgentApps, []]);
                          setHasChanges(true);
                        }}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontSize: '0.8rem', color: 'hsl(var(--severity-low))' }}
                      >
                        + Add prompt
                      </Button>
                    </Box>
                  )}

                  {/* Webhook Configuration */}
                  {automation.type === 'webhook' && expandedTypes['webhook'] && (
                    <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="https://your-webhook-url.com"
                        value={webhookUrl}
                        onChange={(e) => {
                          setWebhookUrl(e.target.value);
                          setHasChanges(true);
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'hsl(var(--background))',
                          },
                        }}
                      />
                    </Box>
                  )}

                  {/* Security Rules Configuration */}
                  {automation.enabled && automation.type === 'security_rules' && expandedTypes['security_rules'] && (
                    <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                      <TextField
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={6}
                        placeholder="Enter security rules..."
                        value={securityRulesText}
                        onChange={(e) => {
                          setSecurityRulesText(e.target.value);
                          setHasChanges(true);
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'hsl(var(--background))',
                            fontSize: '0.85rem',
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Divider sx={{ my: 3, borderColor: 'hsl(var(--border))' }} />

        {/* Cleanup Section */}
        <Box>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 1.5, 
              fontWeight: 500, 
              textTransform: 'uppercase', 
              letterSpacing: 0.5,
              fontSize: '0.75rem',
            }}
          >
            Cleanup
          </Typography>
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              py: 1.5, 
              px: 2, 
              bgcolor: 'hsl(var(--muted) / 0.35)', 
              borderRadius: 1.5,
              border: '1px solid hsl(var(--border))',
            }}
          >
            <DeleteSweepIcon sx={{ color: cleanupTimeout > 0 ? 'hsl(var(--severity-medium))' : 'hsl(var(--muted-foreground))', fontSize: 22 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.95rem', color: cleanupTimeout > 0 ? 'text.primary' : 'hsl(var(--muted-foreground))' }}>
                Auto-delete incidents after
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Automatically removes resolved incidents after the selected period
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={String(cleanupTimeout)}
                onChange={(e) => {
                  setCleanupTimeout(Number(e.target.value));
                  setHasChanges(true);
                }}
                displayEmpty
                sx={{
                  bgcolor: 'hsl(var(--background))',
                  fontSize: '0.85rem',
                  '& .MuiSelect-select': { py: 0.75 },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' },
                  },
                }}
              >
                {WEEKS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.seconds} value={String(opt.seconds)}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </DialogContent>

      <Divider sx={{ borderColor: 'hsl(var(--border))' }} />

      <DialogActions sx={{ px: 4, py: 2.5, justifyContent: 'space-between' }}>
        <Button
          size="small"
          startIcon={<RestoreIcon />}
          onClick={() => {
            setAutomations(automations.map(a => {
              if (a.type === 'enrich') return { ...a, enabled: true, trigger: 'on_edit' as const };
              if (a.type === 'security_rules') return { ...a, enabled: true, trigger: 'on_edit' as const };
              if (a.type === 'ai_agent') return { ...a, enabled: true, trigger: 'on_edit' as const };
              return a;
            }));
            setSecurityRulesText('merge if always; deny if has_deleted_field');
            setAiAgentPrompts([`Provide a short triage plan for the incident in english and update it in the internal shuffle datastore with the same key and category 'shuffle-security_incidents'.   Make sure it is JSON formatted like {"tasks": []} so that we can inject it in existing data. Some incidents are duds and should be closed quickly. Others are important ones. Others are missing important details. Use the following format for each task, and ONLY update the relevant fields: [{"assignee": "AI Agent", "title": "Title of the task", "category": "triage/containment/recovery/communication/documentation", "completed": false, "createdBy": "ai-agent@shuffler.io"}]. ONLY output as JSON and nothing more.   If the incident has RELEVANT tasks, add to them if necessary. When done, ALWAYS make sure the "status" is inProgress.`, `Go through each task one by one if there are any. When starting them, self-assign yourself to make it clear you are working on it. Go in the order of incident response relevance, which is typically in order. If a task is irrelevant, set "disabled": true as a value for it.  Before starting, get "agent_permissions" from "shuffle-security_configuration". This has a list of permissions you NEED to follow. This extends the reach of tools and capabilities you are allowed to use. ONLY use the permissions that are enabled.`]);
            setAiAgentApps([['b82668d868f6dc7ac1dc14caa92c674b'], ['b82668d868f6dc7ac1dc14caa92c674b']]);
            setHasChanges(true);
          }}
          sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
        >
          Reset to default
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </DialogActions>

      <AppSearchDrawer
        open={appPickerForIdx !== null}
        onClose={() => setAppPickerForIdx(null)}
        title="Allow App"
        subtitle="Restrict this AI Agent prompt to specific apps"
        onQuickSelect={(app) => {
          if (appPickerForIdx === null) return;
          if (!app.id) {
            toast.error('Cannot allow app: missing canonical app ID');
            return;
          }
          const appId = app.id;
          const updated = [...aiAgentApps];
          const current = updated[appPickerForIdx] || [];
          if (!current.includes(appId)) {
            updated[appPickerForIdx] = [...current, appId];
            setAiAgentApps(updated);
            setHasChanges(true);
          }
        }}
      />
    </Dialog>
  );
};

export default CategoryAutomationsDialog;
