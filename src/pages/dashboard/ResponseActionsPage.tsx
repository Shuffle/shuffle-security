import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Bot,
  Radio,
} from 'lucide-react';
import PermissionsPanel from '@/components/agent/PermissionsPanel';

const HostMonitorsPanel = () => {
  return (
    <Paper
      sx={{
        bgcolor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        p: 6,
        textAlign: 'center',
      }}
    >
      <Radio size={40} className="text-muted-foreground/30 mx-auto mb-3" />
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 1 }}>
        Host Monitor Permissions
      </Typography>
      <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', maxWidth: 420, mx: 'auto' }}>
        Configure what actions your host monitors (EDR, endpoint agents) are allowed to perform autonomously on individual hosts.
      </Typography>
      <Chip
        label="Coming Soon"
        size="small"
        sx={{
          mt: 2,
          fontWeight: 600,
          fontSize: '0.7rem',
          bgcolor: 'hsl(var(--primary) / 0.1)',
          color: 'hsl(var(--primary))',
        }}
      />
    </Paper>
  );
};

const ResponseActionsPage = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Box sx={{ p: 4, maxWidth: 900 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.5 }}>
            Response Actions
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Control what automated response actions are allowed across AI Agents and Host Monitors.
          </Typography>
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            mb: 3,
            minHeight: 36,
            '& .MuiTabs-indicator': { bgcolor: 'hsl(var(--primary))' },
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 36,
              color: 'hsl(var(--muted-foreground))',
              '&.Mui-selected': { color: 'hsl(var(--primary))' },
            },
          }}
        >
          <Tab icon={<Bot size={16} />} iconPosition="start" label="AI Agents" />
          <Tab icon={<Radio size={16} />} iconPosition="start" label="Host Monitors" />
        </Tabs>

        {activeTab === 0 && <PermissionsPanel />}
        {activeTab === 1 && <HostMonitorsPanel />}
      </Box>
    </motion.div>
  );
};

export default ResponseActionsPage;
