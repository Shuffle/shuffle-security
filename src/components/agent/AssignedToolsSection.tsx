/**
 * AssignedToolsSection — top-of-Permissions UI that shows which apps
 * the agent will use for a given (agent, actionType) pair, with chips
 * to remove and a button to add more via the AppSearchDrawer.
 */

import { useEffect, useState } from 'react';
import { Box, Typography, Chip, Button, Tooltip } from '@mui/material';
import { Plus, X } from 'lucide-react';
import { AppSearchDrawer } from '@/Shuffle-MCPs';
import {
  AGENT_TOOLS_CHANGED_EVENT,
  DEFAULT_ACTION_TYPE,
  DEFAULT_AGENT,
  addAgentTool,
  formatToolName,
  getAgentTools,
  removeAgentTool,
} from '@/lib/agentTools';

interface Props {
  agent?: string;
  actionType?: string;
  compact?: boolean;
}

const AssignedToolsSection = ({
  agent = DEFAULT_AGENT,
  actionType = DEFAULT_ACTION_TYPE,
  compact = false,
}: Props) => {
  const [tools, setTools] = useState<string[]>(() => getAgentTools(agent, actionType));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setTools(getAgentTools(agent, actionType));
    refresh();
    window.addEventListener(AGENT_TOOLS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(AGENT_TOOLS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [agent, actionType]);

  const labelText =
    agent === DEFAULT_AGENT
      ? 'Tools the default agent can use'
      : `Tools "${agent}" can use`;

  return (
    <>
      <Box
        sx={{
          mb: compact ? 2.5 : 3,
          p: compact ? 2 : 2.5,
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: compact ? '0.78rem' : '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Assigned tools
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
              {labelText}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<Plus size={14} />}
            onClick={() => setPickerOpen(true)}
            sx={{
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'none',
              fontSize: '0.75rem',
              height: 28,
              px: 1.25,
              '&:hover': { bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' },
            }}
          >
            Add tool
          </Button>
        </Box>

        {tools.length === 0 ? (
          <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
            No tools assigned yet — the agent will have nothing to call.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {tools.map((t) => (
              <Tooltip key={t} title="Remove tool">
                <Chip
                  label={formatToolName(t)}
                  size="small"
                  onDelete={() => removeAgentTool(t, agent, actionType)}
                  deleteIcon={<X size={12} />}
                  sx={{
                    height: 24,
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    bgcolor: 'hsl(var(--primary) / 0.12)',
                    color: 'hsl(var(--primary))',
                    border: '1px solid hsl(var(--primary) / 0.25)',
                    '& .MuiChip-deleteIcon': {
                      color: 'hsl(var(--primary))',
                      '&:hover': { color: 'hsl(var(--primary))', opacity: 0.8 },
                    },
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>

      <AppSearchDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Assign tool"
        subtitle="Pick an app the agent is allowed to use"
        onQuickSelect={(app) => {
          addAgentTool(app.name, agent, actionType);
          setPickerOpen(false);
        }}
      />
    </>
  );
};

export default AssignedToolsSection;
