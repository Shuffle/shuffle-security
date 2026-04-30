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
import AgentIcon from '@/components/agent/AgentIcon';
import EnhancedEncryptionIcon from '@mui/icons-material/EnhancedEncryption';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SecurityIcon from '@mui/icons-material/Security';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { toast } from 'sonner';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';

import { CategoryAutomation } from '@/services/datastore';
import { extractValidatedIngestionApps, ValidatedIngestionApp, findIngestTicketsWorkflow, extractWorkflowAppNames } from '@/lib/ingestionDetection';
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
  /**
   * Tracks which automation rows have their config section expanded.
   * Enabling an automation no longer auto-expands it — the user explicitly
   * clicks the chevron on the row header to reveal/hide configuration.
   * Keyed by automation type (e.g. 'workflow', 'webhook', 'security_rules').
   */
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  // Popup editor for AI Agent prompts
  const [promptEditor, setPromptEditor] = useState<{ idx: number; value: string } | null>(null);
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
        setAiAgentPrompts(prompts.length > 0 ? prompts : ['']);
      } else {
        setAiAgentPrompts(['']);
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
          // Use "action", "action-2", "action-3" format
          const validPrompts = aiAgentPrompts.filter(p => p.trim());
          options = validPrompts.map((prompt, idx) => ({
            key: idx === 0 ? 'action' : `action-${idx + 1}`,
            value: prompt,
          }));
          if (options.length === 0) {
            options = [{ key: 'action', value: '' }];
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
    <>
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
                  {automation.enabled && automation.type === 'workflow' && expandedTypes['workflow'] && (
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
                  {automation.enabled && automation.type === 'ai_agent' && expandedTypes['ai_agent'] && (
                    <Box sx={{ px: 2, pb: 2, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {aiAgentPrompts.map((prompt, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <TextField
                            size="small"
                            fullWidth
                            placeholder={`Prompt ${idx + 1}...`}
                            value={prompt}
                            onChange={(e) => {
                              const updated = [...aiAgentPrompts];
                              updated[idx] = e.target.value;
                              setAiAgentPrompts(updated);
                              setHasChanges(true);
                            }}
                            InputProps={{
                              endAdornment: (
                                <IconButton
                                  size="small"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPromptEditor({ idx, value: aiAgentPrompts[idx] ?? '' });
                                  }}
                                  title="Open editor"
                                  sx={{
                                    color: 'hsl(var(--muted-foreground))',
                                    '&:hover': { color: 'hsl(var(--primary))' },
                                    mr: -0.5,
                                  }}
                                >
                                  <OpenInFullIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                bgcolor: 'hsl(var(--background))',
                                fontSize: '0.85rem',
                              },
                            }}
                          />
                          {aiAgentPrompts.length > 1 && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                setAiAgentPrompts(aiAgentPrompts.filter((_, i) => i !== idx));
                                setHasChanges(true);
                              }}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'hsl(var(--destructive))' } }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          )}
                        </Box>
                      ))}
                      <Button
                        size="small"
                        onClick={() => {
                          setAiAgentPrompts([...aiAgentPrompts, '']);
                          setHasChanges(true);
                        }}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontSize: '0.8rem', color: 'hsl(var(--severity-low))' }}
                      >
                        + Add prompt
                      </Button>
                    </Box>
                  )}

                  {/* Webhook Configuration */}
                  {automation.enabled && automation.type === 'webhook' && expandedTypes['webhook'] && (
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
    </Dialog>

    {/* Popup editor for AI Agent prompts */}
    <Dialog
      open={!!promptEditor}
      onClose={() => setPromptEditor(null)}
      maxWidth="md"
      fullWidth
      sx={{ zIndex: 9999 }}
      PaperProps={{
        sx: {
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1.5 }}>
        <AgentIcon size={20} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1rem' }}>
            Edit prompt {promptEditor ? promptEditor.idx + 1 : ''}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
            Full editor for the AI Agent prompt. More controls (permissions, variables) coming soon.
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setPromptEditor(null)} sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider sx={{ borderColor: 'hsl(var(--border))' }} />
      <DialogContent sx={{ pt: 2.5 }}>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={14}
          maxRows={28}
          placeholder="Write your prompt here..."
          value={promptEditor?.value ?? ''}
          onChange={(e) => setPromptEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'hsl(var(--background))',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.85rem',
              lineHeight: 1.55,
              alignItems: 'flex-start',
            },
          }}
        />
      </DialogContent>
      <Divider sx={{ borderColor: 'hsl(var(--border))' }} />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => setPromptEditor(null)} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            if (!promptEditor) return;
            const updated = [...aiAgentPrompts];
            updated[promptEditor.idx] = promptEditor.value;
            setAiAgentPrompts(updated);
            setHasChanges(true);
            setPromptEditor(null);
          }}
          sx={{ textTransform: 'none' }}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default CategoryAutomationsDialog;
