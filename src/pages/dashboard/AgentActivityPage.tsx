/**
 * Security Agent Activity Page
 * Shows real-time agent execution feed, stats, and activity overview
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { motion } from 'framer-motion';
import { Settings, Play } from 'lucide-react';
import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import { useAgentActivity } from '@/hooks/useAgentActivity';
import AgentActivityStatsPanel from '@/components/agent/AgentActivityStats';

import PermissionsPanel from '@/components/agent/PermissionsPanel';
import LocalLLMConfig from '@/components/agent/LocalLLMConfig';
import {
  AgentRunDrawer,
  type AgentRunDrawerTab,
  AgentActivityList,
  AgentExecutionDrawer,
  type AgentRun,
} from '@/Shuffle-MCPs';
import { useAuth } from '@/context/AuthContext';
import { useAgentPermissions } from '@/hooks/useAgentPermissions';
import { usePageMeta } from '@/hooks/usePageMeta';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Completed', value: 'FINISHED' },
  { label: 'Running', value: 'EXECUTING' },
  { label: 'Failed', value: 'ABORTED' },
];

const AgentActivityPage = () => {

  usePageMeta({
    title: 'AI Agent activity',
    description: 'Monitor AI agent runs, decisions, and automated incident response activity.',
    url: '/agent',
  });
  const [searchParams] = useSearchParams();
  const {
    runs,
    isLoading,
    error,
    hasMore,
    stats,
    statusFilter,
    searchQuery,
    setStatusFilter,
    setSearchQuery,
    loadMore,
    refresh,
    skippedCount,
  } = useAgentActivity();

  const { enabledPermissions, totalPermissions } = useAgentPermissions();
  const { userInfo } = useAuth();
  const isSupport = userInfo?.support === true;
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionsInitialTab, setPermissionsInitialTab] = useState<AgentRunDrawerTab>('run');
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const openDrawer = (tab: number) => {
    const mapped: AgentRunDrawerTab = tab === 1 ? 'permissions' : tab === 2 ? 'localLLM' : 'run';
    setPermissionsInitialTab(mapped);
    setPermissionsOpen(true);
  };

  // Pre-fill search from URL query param (e.g. /agent?search=AbuseIPDB)
  useEffect(() => {
    const q = searchParams.get('search');
    if (q && !searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1400 }}>
        {/* Sticky top section */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'hsl(var(--background))',
          pb: 2,
          mx: { xs: -2, sm: -3, md: -4 },
          px: { xs: 2, sm: 3, md: 4 },
          pt: { xs: 0, sm: 0, md: 0 },
        }}>
        {/* Page header */}
        <Box sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 2,
          px: 3,
          py: 2,
          borderRadius: 2,
          bgcolor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
        }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'hsla(var(--primary) / 0.12)',
            color: 'hsl(var(--primary))',
            flexShrink: 0,
          }}>
            <AgentIcon size={26} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.25 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '1.15rem', color: 'hsl(var(--foreground))' }}>
                Security Agents
              </Typography>
              <Chip
                label="Active"
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  bgcolor: 'hsla(var(--severity-low) / 0.15)',
                  color: 'hsl(var(--severity-low))',
                  '& .MuiChip-label': { px: 1 },
                  '&::before': {
                    content: '""',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'hsl(var(--severity-low))',
                    ml: 1,
                    mr: -0.25,
                  },
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              {enabledPermissions}/{totalPermissions} permissions enabled
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={refresh}
                size="small"
                sx={{
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1.5,
                  color: 'hsl(var(--muted-foreground))',
                  px: 1.5,
                  '&:hover': { bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' },
                }}
              >
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              startIcon={<Play size={14} />}
              onClick={() => openDrawer(0)}
              sx={{
                border: '1px solid hsl(var(--border))',
                borderRadius: 1.5,
                color: 'hsl(var(--muted-foreground))',
                textTransform: 'none',
                fontSize: '0.8rem',
                px: 1.5,
                '&:hover': { bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' },
              }}
            >
              Run Agent
            </Button>
            <Tooltip title="Coming soon">
              <span>
                <Button
                  size="small"
                  startIcon={<Settings size={14} />}
                  disabled
                  sx={{
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 1.5,
                    color: 'hsl(var(--muted-foreground))',
                    textTransform: 'none',
                    fontSize: '0.8rem',
                    px: 1.5,
                    '&.Mui-disabled': {
                      color: 'hsl(var(--muted-foreground) / 0.5)',
                      borderColor: 'hsl(var(--border))',
                    },
                  }}
                >
                  Permissions
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        </Box>

        {/* Content layout */}
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
          {/* Left: Feed (sourced from Shuffle-MCPs lib) */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <AgentActivityList onRunClick={(run) => setSelectedRun(run)} />
          </Box>

          {/* Right: Stats */}
          <Box sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
            <AgentActivityStatsPanel stats={stats} />
          </Box>
        </Box>
      </Box>

      {/* Run / Permissions / Local LLM drawer (sourced from Shuffle-MCPs lib) */}
      <AgentRunDrawer
        open={permissionsOpen}
        onClose={() => setPermissionsOpen(false)}
        initialTab={permissionsInitialTab}
        permissionsSlot={<PermissionsPanel compact />}
        permissionsDisabled={!isSupport}
        permissionsDisabledTooltip="Coming soon"
        localLLMSlot={<LocalLLMConfig />}
      />

      {/* Execution view drawer (sourced from Shuffle-MCPs lib) */}
      <AgentExecutionDrawer
        open={!!selectedRun}
        onClose={() => setSelectedRun(null)}
        run={selectedRun}
      />
    </motion.div>
  );
};

export default AgentActivityPage;
