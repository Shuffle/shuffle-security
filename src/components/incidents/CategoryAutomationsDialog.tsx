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
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import WebhookIcon from '@mui/icons-material/Webhook';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import EnhancedEncryptionIcon from '@mui/icons-material/EnhancedEncryption';
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
    }
  }, [open, initialAutomations]);

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
      <DialogTitle sx={{ pb: 2, pr: 6, pt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <RocketLaunchIcon sx={{ color: enabledCount > 0 ? '#4ade80' : 'text.secondary', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Automation for '{category}'
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
              bgcolor: 'rgba(255,255,255,0.03)', 
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Typography sx={{ fontSize: '0.95rem' }}>
              An incident is edited
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.06)' }} />

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

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                    gap: 2,
                    py: 1.5,
                    px: 1.5,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    bgcolor: automation.enabled ? 'rgba(255,255,255,0.03)' : 'transparent',
                    border: '1px solid',
                    borderColor: automation.enabled ? 'rgba(255,255,255,0.08)' : 'transparent',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.04)',
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
                      p: 0.5,
                      '&.Mui-checked': {
                        color: typeConfig.color,
                      },
                    }}
                  />
                  <TypeIcon 
                    sx={{ 
                      color: automation.enabled ? typeConfig.color : 'rgba(255,255,255,0.4)',
                      fontSize: 22,
                      transition: 'color 0.15s',
                    }} 
                  />
                  <Typography 
                    sx={{ 
                      flex: 1,
                      fontSize: '0.95rem',
                      color: automation.enabled ? 'text.primary' : 'rgba(255,255,255,0.6)',
                      fontWeight: automation.enabled ? 500 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    {typeConfig.label}
                  </Typography>
                  
                  {automation.enabled && (
                    <Chip
                      label="Configure"
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info('Configuration options coming soon');
                      }}
                      sx={{
                        height: 26,
                        fontSize: '0.75rem',
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: 'text.secondary',
                        '&:hover': {
                          borderColor: 'rgba(255,255,255,0.3)',
                          bgcolor: 'rgba(255,255,255,0.05)',
                        },
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

      <DialogActions sx={{ px: 4, py: 2.5, justifyContent: 'space-between' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={() => toast.info('Additional automation types coming soon')}
          sx={{ color: 'text.secondary' }}
        >
          Add action
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
  );
};

export default CategoryAutomationsDialog;
