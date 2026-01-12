import React, { useState, useEffect } from 'react';
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
  Chip,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import WebhookIcon from '@mui/icons-material/Webhook';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import EnhancedEncryptionIcon from '@mui/icons-material/EnhancedEncryption';
import SendIcon from '@mui/icons-material/Send';
import { toast } from 'sonner';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';

import { CategoryAutomation } from '@/services/datastore';

interface CategoryAutomationsDialogProps {
  open: boolean;
  onClose: () => void;
  category: string;
  automations: CategoryAutomation[] | null;
  onAutomationsChange: (automations: CategoryAutomation[]) => void;
}

const automationTypes = [
  {
    type: 'workflow',
    icon: AccountTreeIcon,
    label: 'Run workflow',
    color: '#3b82f6',
  },
  {
    type: 'webhook',
    icon: WebhookIcon,
    label: 'Send webhook',
    color: '#8b5cf6',
  },
  {
    type: 'ai_agent',
    icon: SmartToyIcon,
    label: 'Run AI Agent',
    color: '#10b981',
  },
  {
    type: 'enrich',
    icon: EnhancedEncryptionIcon,
    label: 'Enrich',
    color: '#f59e0b',
  },
  {
    type: 'send_message',
    icon: SendIcon,
    label: 'Send message',
    color: '#6b7280',
  },
];

const triggerOptions = [
  { value: 'on_edit', label: 'A key is edited' },
  { value: 'on_create', label: 'A key is created' },
  { value: 'on_delete', label: 'A key is deleted' },
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
  const [selectedTrigger, setSelectedTrigger] = useState<string>('on_edit');

  useEffect(() => {
    if (open) {
      // Initialize with all automation types, preserving existing states
      const existingMap = new Map((initialAutomations || []).map(a => [a.type, a]));
      const allAutomations: CategoryAutomation[] = automationTypes.map(at => {
        const existing = existingMap.get(at.type as CategoryAutomation['type']);
        return existing || {
          id: `auto-${at.type}`,
          name: at.label,
          type: at.type as CategoryAutomation['type'],
          trigger: 'on_edit' as const,
          enabled: false,
        };
      });
      setAutomations(allAutomations);
      setHasChanges(false);
      
      // Set trigger from first enabled automation or default
      const enabledAuto = allAutomations.find(a => a.enabled);
      if (enabledAuto) {
        setSelectedTrigger(enabledAuto.trigger);
      }
    }
  }, [open, initialAutomations]);

  const handleToggleAutomation = (type: string) => {
    setAutomations(automations.map(a => 
      a.type === type ? { ...a, enabled: !a.enabled, trigger: selectedTrigger as CategoryAutomation['trigger'] } : a
    ));
    setHasChanges(true);
  };

  const handleTriggerChange = (trigger: string) => {
    setSelectedTrigger(trigger);
    // Update all enabled automations with new trigger
    setAutomations(automations.map(a => 
      a.enabled ? { ...a, trigger: trigger as CategoryAutomation['trigger'] } : a
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
      const enabledAutomations = automations.filter(a => a.enabled);
      
      const response = await fetch(getApiUrl(`/orgs/${orgId}/update_category`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(API_CONFIG.apiKey),
        },
        body: JSON.stringify({
          category,
          automations: enabledAutomations,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save automations');
      }

      onAutomationsChange(enabledAutomations);
      toast.success('Automations saved');
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
          background: 'linear-gradient(180deg, #262626 0%, #1f1f1f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RocketLaunchIcon sx={{ color: enabledCount > 0 ? '#4ade80' : 'text.secondary' }} />
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
              Automation for category '{category}'
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 12,
            top: 12,
            color: 'text.secondary',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Trigger Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            When
          </Typography>
          <FormControl size="small" fullWidth>
            <Select
              value={selectedTrigger}
              onChange={(e) => handleTriggerChange(e.target.value)}
              sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              {triggerOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Actions Section */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Do
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {automations.map((automation) => {
              const typeConfig = automationTypes.find(at => at.type === automation.type);
              if (!typeConfig) return null;
              const TypeIcon = typeConfig.icon;

              return (
                <Box
                  key={automation.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 1.5,
                    px: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.03)',
                    },
                  }}
                  onClick={() => handleToggleAutomation(automation.type)}
                >
                  <Checkbox
                    checked={automation.enabled}
                    onChange={() => handleToggleAutomation(automation.type)}
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                    sx={{
                      color: 'rgba(255,255,255,0.3)',
                      '&.Mui-checked': {
                        color: typeConfig.color,
                      },
                    }}
                  />
                  <TypeIcon 
                    sx={{ 
                      color: automation.enabled ? typeConfig.color : 'text.secondary',
                      fontSize: 20,
                      transition: 'color 0.15s',
                    }} 
                  />
                  <Typography 
                    sx={{ 
                      flex: 1,
                      color: automation.enabled ? 'text.primary' : 'text.secondary',
                      fontWeight: automation.enabled ? 500 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    {typeConfig.label}
                  </Typography>
                  
                  {automation.enabled && (
                    <Chip
                      label="Save"
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 24,
                        fontSize: '0.7rem',
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: 'text.secondary',
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </DialogContent>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={() => toast.info('Additional automation types coming soon')}
          sx={{ color: 'text.secondary' }}
        >
          Add action
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
  );
};

export default CategoryAutomationsDialog;
