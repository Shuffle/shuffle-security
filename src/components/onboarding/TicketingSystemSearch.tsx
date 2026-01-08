import { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Chip,
  InputAdornment,
  Card,
  CardContent,
  Checkbox,
  Divider,
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import { SingulJS } from '@singulio/singul/react';

export interface TicketingSystem {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'ticketing' | 'siem' | 'itsm' | 'other';
  color: string;
}

const ticketingSystems: TicketingSystem[] = [
  { id: 'jira', name: 'Jira', icon: '🎫', description: 'Atlassian issue tracking', category: 'ticketing', color: '#0052CC' },
  { id: 'servicenow', name: 'ServiceNow', icon: '⚙️', description: 'IT service management', category: 'itsm', color: '#62d84e' },
  { id: 'zendesk', name: 'Zendesk', icon: '💬', description: 'Customer support platform', category: 'ticketing', color: '#03363D' },
  { id: 'freshdesk', name: 'Freshdesk', icon: '🌿', description: 'Customer engagement suite', category: 'ticketing', color: '#25c16f' },
  { id: 'pagerduty', name: 'PagerDuty', icon: '🚨', description: 'Incident management', category: 'other', color: '#06AC38' },
  { id: 'splunk', name: 'Splunk', icon: '📊', description: 'Security information and event management', category: 'siem', color: '#65A637' },
  { id: 'qradar', name: 'IBM QRadar', icon: '🔷', description: 'Security intelligence platform', category: 'siem', color: '#0f62fe' },
  { id: 'sentinel', name: 'Microsoft Sentinel', icon: '🛡️', description: 'Cloud-native SIEM', category: 'siem', color: '#0078D4' },
  { id: 'thehive', name: 'TheHive', icon: '🐝', description: 'Security incident response', category: 'siem', color: '#FFC107' },
  { id: 'opsgenie', name: 'Opsgenie', icon: '📟', description: 'Alert management', category: 'other', color: '#2684FF' },
  { id: 'slack', name: 'Slack', icon: '💼', description: 'Team communication', category: 'other', color: '#4A154B' },
  { id: 'teams', name: 'Microsoft Teams', icon: '👥', description: 'Collaboration platform', category: 'other', color: '#6264A7' },
];

interface TicketingSystemSearchProps {
  selectedSystems: TicketingSystem[];
  onSelectionChange: (systems: TicketingSystem[]) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

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
      <Typography
        variant="h5"
        sx={{
          color: 'white',
          fontWeight: 700,
          mb: 1,
        }}
      >
        Select Your Ticketing Systems
      </Typography>
      <Typography
        variant="body1"
        sx={{ mb: 4, color: 'rgba(255, 255, 255, 0.5)' }}
      >
        Choose the tools you currently use for alert and case management.
      </Typography>

      {/* Search Input */}
      <TextField
        fullWidth
        placeholder="Search ticketing systems, SIEMs, or communication tools..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{
          mb: 3,
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 3,
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
            '&.Mui-focused fieldset': { borderColor: '#FF6600' },
          },
          '& .MuiInputBase-input': {
            color: 'white',
            '&::placeholder': { color: 'rgba(255, 255, 255, 0.4)' },
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.4)' }} />
            </InputAdornment>
          ),
        }}
      />

      {/* Selected Systems */}
      {selectedSystems.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {selectedSystems.map((system) => (
            <Chip
              key={system.id}
              label={`${system.icon} ${system.name}`}
              onDelete={() => toggleSystem(system)}
              sx={{
                background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                color: 'white',
                fontWeight: 500,
                '& .MuiChip-deleteIcon': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': { color: 'white' },
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Systems Grid */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
            maxHeight: 400,
            overflow: 'auto',
            pr: 1,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { background: 'rgba(255, 255, 255, 0.05)', borderRadius: 3 },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(255, 255, 255, 0.1)', borderRadius: 3 },
          }}
        >
          {filteredSystems.map((system) => {
            const selected = isSelected(system.id);
            return (
              <motion.div key={system.id} variants={itemVariants}>
                <Card
                  onClick={() => toggleSystem(system)}
                  sx={{
                    cursor: 'pointer',
                    background: selected ? 'rgba(255, 102, 0, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid',
                    borderColor: selected ? '#FF6600' : 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: selected ? '#FF6600' : 'rgba(255, 102, 0, 0.5)',
                      transform: 'translateY(-2px)',
                      background: selected ? 'rgba(255, 102, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box
                        sx={{
                          fontSize: '1.5rem',
                          width: 40,
                          height: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: 2,
                        }}
                      >
                        {system.icon}
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}
                        >
                          {system.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255, 255, 255, 0.4)',
                            display: 'block',
                            lineHeight: 1.4,
                          }}
                        >
                          {system.description}
                        </Typography>
                      </Box>
                      <Checkbox
                        checked={selected}
                        sx={{
                          color: 'rgba(255, 255, 255, 0.2)',
                          '&.Mui-checked': { color: '#FF6600' },
                          p: 0,
                        }}
                      />
                    </Box>
                    <Chip
                      label={system.category.toUpperCase()}
                      size="small"
                      sx={{
                        mt: 1.5,
                        height: 20,
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'rgba(255, 255, 255, 0.4)',
                        letterSpacing: 0.5,
                      }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </Box>
      </motion.div>

      {filteredSystems.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            No systems found. Try a different search term.
          </Typography>
        </Box>
      )}

      {/* Singul Integration Search */}
      <Divider sx={{ my: 4, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
      
      <Box>
        <Typography
          variant="overline"
          sx={{
            color: 'rgba(255, 102, 0, 0.8)',
            fontWeight: 600,
            letterSpacing: 1.5,
            mb: 1,
            display: 'block',
          }}
        >
          Or search all integrations
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255, 255, 255, 0.4)', mb: 2 }}
        >
          Use Singul to find and connect any integration
        </Typography>
        <Box
          sx={{
            '& > div': {
              width: '100%',
            },
          }}
        >
          <SingulJS
            authToken="demo-token"
            placeholder="Search all available integrations..."
            customStyles={{
              container: { 
                width: '100%',
                backgroundColor: 'transparent',
                borderRadius: '12px',
              },
              inputWrapper: {
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
              input: {
                backgroundColor: 'transparent',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
              },
              searchIcon: {
                color: 'rgba(255, 255, 255, 0.4)',
              },
              loadingSpinner: {
                color: '#FF6600',
              },
              dropdown: {
                backgroundColor: 'rgba(30, 30, 30, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                marginTop: '8px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                maxHeight: '300px',
                overflowY: 'auto',
              },
              dropdownItem: {
                padding: '12px 16px',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              },
              selectedItem: {
                backgroundColor: 'rgba(255, 102, 0, 0.15)',
                color: '#FF6600',
              },
              appIcon: {
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                marginRight: '12px',
              },
              appName: {
                fontSize: '14px',
                fontWeight: '500',
              },
              emptyState: {
                padding: '24px',
                color: 'rgba(255, 255, 255, 0.4)',
                textAlign: 'center',
                fontSize: '14px',
              },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
