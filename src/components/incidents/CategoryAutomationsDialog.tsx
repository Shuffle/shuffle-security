import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Switch,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Paper,
  Divider,
  CircularProgress,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import WebhookIcon from '@mui/icons-material/Webhook';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import EnhancedEncryptionIcon from '@mui/icons-material/EnhancedEncryption';
import { toast } from 'sonner';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';

export interface CategoryAutomation {
  id: string;
  name: string;
  type: 'workflow' | 'webhook' | 'ai_agent' | 'enrich';
  trigger: 'on_create' | 'on_edit' | 'on_delete';
  workflow_id?: string;
  webhook_url?: string;
  enabled: boolean;
}

interface CategoryAutomationsDialogProps {
  open: boolean;
  onClose: () => void;
  category: string;
  automations: CategoryAutomation[] | null;
  onAutomationsChange: (automations: CategoryAutomation[]) => void;
}

const automationTypeConfig = {
  workflow: {
    icon: AccountTreeIcon,
    label: 'Run Workflow',
    color: '#3b82f6',
  },
  webhook: {
    icon: WebhookIcon,
    label: 'Send Webhook',
    color: '#8b5cf6',
  },
  ai_agent: {
    icon: SmartToyIcon,
    label: 'Run AI Agent',
    color: '#10b981',
  },
  enrich: {
    icon: EnhancedEncryptionIcon,
    label: 'Enrich',
    color: '#f59e0b',
  },
};

const triggerOptions = [
  { value: 'on_edit', label: 'On Edit' },
  { value: 'on_create', label: 'On Create' },
  { value: 'on_delete', label: 'On Delete' },
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
}) => {
  const [automations, setAutomations] = useState<CategoryAutomation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open) {
      setAutomations(initialAutomations || []);
      setHasChanges(false);
    }
  }, [open, initialAutomations]);

  const handleAddAutomation = () => {
    const newAutomation: CategoryAutomation = {
      id: `auto-${Date.now()}`,
      name: 'New Automation',
      type: 'workflow',
      trigger: 'on_edit',
      enabled: true,
    };
    setAutomations([...automations, newAutomation]);
    setHasChanges(true);
  };

  const handleRemoveAutomation = (id: string) => {
    setAutomations(automations.filter(a => a.id !== id));
    setHasChanges(true);
  };

  const handleUpdateAutomation = (id: string, updates: Partial<CategoryAutomation>) => {
    setAutomations(automations.map(a => 
      a.id === id ? { ...a, ...updates } : a
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
      // Update category config via API
      const response = await fetch(getApiUrl(`/orgs/${orgId}/update_category`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(API_CONFIG.apiKey),
        },
        body: JSON.stringify({
          category,
          automations,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save automations');
      }

      onAutomationsChange(automations);
      toast.success('Automations saved');
      onClose();
    } catch (error) {
      toast.error('Failed to save automations');
    } finally {
      setIsSaving(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.03)',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
    },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(180deg, #262626 0%, #1f1f1f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoFixHighIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6">Category Automations</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Configure what happens automatically when incidents are created, edited, or deleted.
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {automations.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px dashed rgba(255,255,255,0.1)',
                borderRadius: 2,
              }}
            >
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                No automations configured
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddAutomation}
              >
                Add Automation
              </Button>
            </Paper>
          ) : (
            <>
              {automations.map((automation, index) => {
                const typeConfig = automationTypeConfig[automation.type];
                const TypeIcon = typeConfig.icon;

                return (
                  <Paper
                    key={automation.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: automation.enabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                      border: '1px solid',
                      borderColor: automation.enabled ? `${typeConfig.color}33` : 'rgba(255,255,255,0.05)',
                      borderRadius: 2,
                      opacity: automation.enabled ? 1 : 0.6,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor: `${typeConfig.color}22`,
                          flexShrink: 0,
                        }}
                      >
                        <TypeIcon sx={{ color: typeConfig.color }} />
                      </Box>

                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <TextField
                            size="small"
                            label="Name"
                            value={automation.name}
                            onChange={(e) => handleUpdateAutomation(automation.id, { name: e.target.value })}
                            sx={{ flex: 1, ...inputSx }}
                          />
                          <FormControl size="small" sx={{ minWidth: 140, ...inputSx }}>
                            <InputLabel>Type</InputLabel>
                            <Select
                              value={automation.type}
                              label="Type"
                              onChange={(e) => handleUpdateAutomation(automation.id, { type: e.target.value as CategoryAutomation['type'] })}
                            >
                              <MenuItem value="workflow">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <AccountTreeIcon sx={{ fontSize: 16 }} />
                                  Run Workflow
                                </Box>
                              </MenuItem>
                              <MenuItem value="webhook">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <WebhookIcon sx={{ fontSize: 16 }} />
                                  Send Webhook
                                </Box>
                              </MenuItem>
                              <MenuItem value="ai_agent">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <SmartToyIcon sx={{ fontSize: 16 }} />
                                  Run AI Agent
                                </Box>
                              </MenuItem>
                              <MenuItem value="enrich">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <EnhancedEncryptionIcon sx={{ fontSize: 16 }} />
                                  Enrich
                                </Box>
                              </MenuItem>
                            </Select>
                          </FormControl>
                          <FormControl size="small" sx={{ minWidth: 120, ...inputSx }}>
                            <InputLabel>Trigger</InputLabel>
                            <Select
                              value={automation.trigger}
                              label="Trigger"
                              onChange={(e) => handleUpdateAutomation(automation.id, { trigger: e.target.value as CategoryAutomation['trigger'] })}
                            >
                              {triggerOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>

                        {(automation.type === 'workflow') && (
                          <TextField
                            size="small"
                            label="Workflow ID"
                            placeholder="Enter workflow ID to run"
                            value={automation.workflow_id || ''}
                            onChange={(e) => handleUpdateAutomation(automation.id, { workflow_id: e.target.value })}
                            sx={inputSx}
                          />
                        )}

                        {automation.type === 'webhook' && (
                          <TextField
                            size="small"
                            label="Webhook URL"
                            placeholder="https://..."
                            value={automation.webhook_url || ''}
                            onChange={(e) => handleUpdateAutomation(automation.id, { webhook_url: e.target.value })}
                            sx={inputSx}
                          />
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Switch
                          checked={automation.enabled}
                          onChange={(e) => handleUpdateAutomation(automation.id, { enabled: e.target.checked })}
                          size="small"
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveAutomation(automation.id)}
                          sx={{ color: 'text.secondary', '&:hover': { color: '#ef4444' } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}

              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddAutomation}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Automation
              </Button>
            </>
          )}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CategoryAutomationsDialog;
