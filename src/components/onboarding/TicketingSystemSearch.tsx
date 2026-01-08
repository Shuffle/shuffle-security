import { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Chip,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Avatar,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export interface TicketingSystem {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'ticketing' | 'siem' | 'itsm' | 'other';
}

const ticketingSystems: TicketingSystem[] = [
  { id: 'jira', name: 'Jira', icon: '🎫', description: 'Atlassian issue tracking', category: 'ticketing' },
  { id: 'servicenow', name: 'ServiceNow', icon: '⚙️', description: 'IT service management', category: 'itsm' },
  { id: 'zendesk', name: 'Zendesk', icon: '💬', description: 'Customer support platform', category: 'ticketing' },
  { id: 'freshdesk', name: 'Freshdesk', icon: '🌿', description: 'Customer engagement suite', category: 'ticketing' },
  { id: 'pagerduty', name: 'PagerDuty', icon: '🚨', description: 'Incident management', category: 'other' },
  { id: 'splunk', name: 'Splunk', icon: '📊', description: 'Security information and event management', category: 'siem' },
  { id: 'qradar', name: 'IBM QRadar', icon: '🔷', description: 'Security intelligence platform', category: 'siem' },
  { id: 'sentinel', name: 'Microsoft Sentinel', icon: '🛡️', description: 'Cloud-native SIEM', category: 'siem' },
  { id: 'thehive', name: 'TheHive', icon: '🐝', description: 'Security incident response', category: 'siem' },
  { id: 'opsgenie', name: 'Opsgenie', icon: '📟', description: 'Alert management', category: 'other' },
  { id: 'slack', name: 'Slack', icon: '💼', description: 'Team communication', category: 'other' },
  { id: 'teams', name: 'Microsoft Teams', icon: '👥', description: 'Collaboration platform', category: 'other' },
];

interface TicketingSystemSearchProps {
  selectedSystems: TicketingSystem[];
  onSelectionChange: (systems: TicketingSystem[]) => void;
}

export const TicketingSystemSearch = ({ selectedSystems, onSelectionChange }: TicketingSystemSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSystems = ticketingSystems.filter(
    (system) =>
      system.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      system.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSystem = (system: TicketingSystem) => {
    const isSelected = selectedSystems.some((s) => s.id === system.id);
    if (isSelected) {
      onSelectionChange(selectedSystems.filter((s) => s.id !== system.id));
    } else {
      onSelectionChange([...selectedSystems, system]);
    }
  };

  const isSelected = (systemId: string) => selectedSystems.some((s) => s.id === systemId);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1, color: 'hsl(var(--foreground))' }}>
        Select Your Ticketing Systems
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'hsl(var(--muted-foreground))' }}>
        Choose the tools you currently use for alert and case management. We'll help you connect them.
      </Typography>

      {/* Search Input */}
      <TextField
        fullWidth
        placeholder="Search ticketing systems, SIEMs, or communication tools..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'hsl(var(--muted))',
            borderRadius: 2,
            '& fieldset': { borderColor: 'transparent' },
            '&:hover fieldset': { borderColor: 'hsl(var(--border))' },
            '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
          },
          '& .MuiInputBase-input': { color: 'hsl(var(--foreground))' },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />
            </InputAdornment>
          ),
        }}
      />

      {/* Selected Systems */}
      {selectedSystems.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {selectedSystems.map((system) => (
            <Chip
              key={system.id}
              label={`${system.icon} ${system.name}`}
              onDelete={() => toggleSystem(system)}
              sx={{
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                '& .MuiChip-deleteIcon': {
                  color: 'hsl(var(--primary-foreground))',
                  '&:hover': { color: 'hsl(var(--primary-foreground))' },
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Systems List */}
      <Paper
        sx={{
          backgroundColor: 'hsl(var(--muted))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          maxHeight: 320,
          overflow: 'auto',
        }}
      >
        <List disablePadding>
          {filteredSystems.map((system) => (
            <ListItem key={system.id} disablePadding>
              <ListItemButton
                onClick={() => toggleSystem(system)}
                sx={{
                  py: 1.5,
                  '&:hover': { backgroundColor: 'hsl(var(--background))' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox
                    checked={isSelected(system.id)}
                    sx={{
                      color: 'hsl(var(--muted-foreground))',
                      '&.Mui-checked': { color: 'hsl(var(--primary))' },
                    }}
                  />
                </ListItemIcon>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    mr: 2,
                    backgroundColor: 'hsl(var(--background))',
                    fontSize: '1rem',
                  }}
                >
                  {system.icon}
                </Avatar>
                <ListItemText
                  primary={system.name}
                  secondary={system.description}
                  primaryTypographyProps={{
                    sx: { color: 'hsl(var(--foreground))', fontWeight: 500 },
                  }}
                  secondaryTypographyProps={{
                    sx: { color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' },
                  }}
                />
                <Chip
                  label={system.category.toUpperCase()}
                  size="small"
                  sx={{
                    backgroundColor: 'hsl(var(--background))',
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: '0.65rem',
                    height: 20,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {filteredSystems.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No systems found"
                secondary="Try a different search term"
                primaryTypographyProps={{ sx: { color: 'hsl(var(--foreground))' } }}
                secondaryTypographyProps={{ sx: { color: 'hsl(var(--muted-foreground))' } }}
              />
            </ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
};
