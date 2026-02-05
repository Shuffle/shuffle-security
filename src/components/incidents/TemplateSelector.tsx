import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
} from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useCaseTemplates, CaseTemplate, TemplateTask } from '@/hooks/useCaseTemplates';
import { IncidentTask } from './CreateIncidentDialog';

interface TemplateSelectorProps {
  onApplyTemplate: (tasks: IncidentTask[]) => void;
  currentUsername?: string;
}

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  informational: '#3b82f6',
};

export const TemplateSelector = ({ onApplyTemplate, currentUsername = '' }: TemplateSelectorProps) => {
  const { templates, isLoading, trackUsage } = useCaseTemplates();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApplyTemplate = async (template: CaseTemplate) => {
    // Convert template tasks to incident tasks
    const newTasks: IncidentTask[] = template.tasks.map((t: TemplateTask, index: number) => ({
      id: `task-${Date.now()}-${index}`,
      title: t.title,
      description: t.description,
      category: t.category || '',
      completed: false,
      assignee: t.assignee || '',
      dependsOn: t.dependsOn || '',
      createdAt: Date.now(),
      createdBy: currentUsername,
    }));
    
    onApplyTemplate(newTasks);
    await trackUsage(template.id);
    handleClose();
  };

  return (
    <>
      <Tooltip title="Apply template">
        <IconButton 
          onClick={handleOpen}
          sx={{ 
            bgcolor: 'rgba(255, 102, 0, 0.15)', 
            color: '#ff6600', 
            '&:hover': { bgcolor: 'rgba(255, 102, 0, 0.25)' } 
          }}
        >
          {isLoading ? <CircularProgress size={20} sx={{ color: '#ff6600' }} /> : <PlaylistAddIcon />}
        </IconButton>
      </Tooltip>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            bgcolor: '#2a2a2a',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: 280,
            maxHeight: 400,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Apply Case Template
          </Typography>
        </Box>
        
        {templates.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No templates available
            </Typography>
          </MenuItem>
        ) : (
          templates.map((template) => (
            <MenuItem 
              key={template.id}
              onClick={() => handleApplyTemplate(template)}
              sx={{ 
                py: 1.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0.5,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                <Box sx={{ 
                  p: 0.75, 
                  borderRadius: 1, 
                  bgcolor: `${severityColors[template.severity || 'medium']}15`,
                }}>
                  <AssignmentIcon sx={{ fontSize: 16, color: severityColors[template.severity || 'medium'] }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {template.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip 
                      label={`${template.tasks.length} tasks`} 
                      size="small" 
                      sx={{ 
                        height: 18, 
                        fontSize: '0.65rem',
                        bgcolor: 'rgba(255,255,255,0.08)',
                      }} 
                    />
                    {template.severity && (
                      <Chip 
                        label={template.severity} 
                        size="small" 
                        sx={{ 
                          height: 18, 
                          fontSize: '0.65rem',
                          bgcolor: `${severityColors[template.severity]}20`,
                          color: severityColors[template.severity],
                          textTransform: 'capitalize',
                        }} 
                      />
                    )}
                  </Box>
                </Box>
              </Box>
              {template.description && (
                <Typography variant="caption" sx={{ color: 'text.secondary', pl: 4.5 }}>
                  {template.description}
                </Typography>
              )}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
};

export default TemplateSelector;
