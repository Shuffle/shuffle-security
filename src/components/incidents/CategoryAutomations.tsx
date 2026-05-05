import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Paper,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WebhookIcon from '@mui/icons-material/Webhook';
import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import EnhancedEncryptionIcon from '@mui/icons-material/EnhancedEncryption';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import BoltIcon from '@mui/icons-material/Bolt';

export interface CategoryAutomation {
  id?: string;
  name: string;
  type?: 'workflow' | 'webhook' | 'ai_agent' | 'enrich' | 'send_message';
  trigger?: 'on_create' | 'on_edit' | 'on_delete';
  workflow_id?: string;
  webhook_url?: string;
  enabled: boolean;
  description?: string;
  options?: { key: string; value: string }[];
}

interface CategoryAutomationsProps {
  automations: CategoryAutomation[] | null;
  isLoading?: boolean;
}

const automationTypeConfig = {
  workflow: {
    icon: AccountTreeIcon,
    label: 'Run Workflow',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  webhook: {
    icon: WebhookIcon,
    label: 'Send Webhook',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
  },
  ai_agent: {
    icon: (props: any) => <AgentIcon size={props?.sx?.fontSize || 20} />,
    label: 'Run AI Agent',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  enrich: {
    icon: EnhancedEncryptionIcon,
    label: 'Enrich',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
};

const triggerConfig = {
  on_create: {
    icon: AddCircleIcon,
    label: 'On Create',
    color: '#22c55e',
  },
  on_edit: {
    icon: EditIcon,
    label: 'On Edit',
    color: '#3b82f6',
  },
  on_delete: {
    icon: DeleteIcon,
    label: 'On Delete',
    color: '#ef4444',
  },
};

export const CategoryAutomations: React.FC<CategoryAutomationsProps> = ({
  automations,
  isLoading = false,
}) => {
  const enabledAutomations = automations?.filter(a => a.enabled) || [];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.5 }}>
        <BoltIcon sx={{ fontSize: 16 }} />
        <Typography variant="caption">Loading automations...</Typography>
      </Box>
    );
  }

  if (enabledAutomations.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoFixHighIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Active Automations
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <AnimatePresence>
          {enabledAutomations.map((automation, index) => {
            const typeConfig = automationTypeConfig[automation.type] || automationTypeConfig.workflow;
            const trigger = triggerConfig[automation.trigger] || triggerConfig.on_edit;
            const TypeIcon = typeConfig.icon;
            const TriggerIcon = trigger.icon;

            return (
              <motion.div
                key={automation.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Tooltip
                  title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>{automation.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {typeConfig.label} • {trigger.label}
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <Paper
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 2,
                      bgcolor: typeConfig.bgColor,
                      border: `1px solid ${typeConfig.color}33`,
                      cursor: 'default',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: `${typeConfig.color}22`,
                        borderColor: `${typeConfig.color}55`,
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: `${typeConfig.color}22`,
                      }}
                    >
                      <TypeIcon sx={{ fontSize: 12, color: typeConfig.color }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: typeConfig.color, fontWeight: 500 }}>
                      {automation.name}
                    </Typography>
                    <Chip
                      size="small"
                      icon={<TriggerIcon sx={{ fontSize: '12px !important', color: `${trigger.color} !important` }} />}
                      label={trigger.label}
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        bgcolor: 'hsl(var(--input))',
                        color: trigger.color,
                        '& .MuiChip-label': { px: 0.5 },
                        '& .MuiChip-icon': { ml: 0.5 },
                      }}
                    />
                  </Paper>
                </Tooltip>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </Box>
    </Box>
  );
};

export default CategoryAutomations;
