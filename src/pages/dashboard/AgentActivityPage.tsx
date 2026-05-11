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
import AgentActivityFeed from '@/components/agent/AgentActivityFeed';
import AgentActivityStatsPanel from '@/components/agent/AgentActivityStats';

import AgentActionDrawer from '@/components/agent/AgentActionDrawer';
import PermissionsPanel from '@/components/agent/PermissionsPanel';
import LocalLLMConfig from '@/components/agent/LocalLLMConfig';
import { AgentRunDrawer, type AgentRunDrawerTab } from '@/Shuffle-MCPs';
import { useAuth } from '@/context/AuthContext';
import { useAgentPermissions } from '@/hooks/useAgentPermissions';
import type { AgentRun } from '@/services/agentActivity';
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
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionsInitialTab, setPermissionsInitialTab] = useState(0);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const openDrawer = (tab: number) => {
    setPermissionsInitialTab(tab);
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
            <Button
              size="small"
              startIcon={<Settings size={14} />}
              onClick={() => openDrawer(1)}
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
              Permissions
            </Button>
          </Box>
        </Box>

            {/* Search & Filter bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search results..."
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  flex: 1,
                  maxWidth: 280,
                  minWidth: 160,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'hsl(var(--card))',
                    borderRadius: 1.5,
                    fontSize: '0.85rem',
                    height: 36,
                    '& fieldset': { borderColor: 'hsl(var(--border))' },
                    '&:hover fieldset': { borderColor: 'hsl(var(--muted-foreground) / 0.3)' },
                    '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                  },
                  '& .MuiInputBase-input': { color: 'hsl(var(--foreground))' },
                }}
              />

              {/* Status filter chips — always visible */}
              {STATUS_FILTERS.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label}
                  size="small"
                  variant={statusFilter === f.value ? 'filled' : 'outlined'}
                  onClick={() => setStatusFilter(f.value)}
                  sx={{
                    fontSize: '0.75rem',
                    height: 28,
                    borderColor: statusFilter === f.value ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    bgcolor: statusFilter === f.value ? 'hsla(var(--primary) / 0.15)' : 'transparent',
                    color: statusFilter === f.value ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    '&:hover': { bgcolor: 'hsl(var(--muted))' },
                  }}
                />
              ))}

              {/* Skipped pseudo-filter — only render if there are any skipped runs */}
              {skippedCount > 0 && (
                <Chip
                  label={`${skippedCount} Skipped`}
                  size="small"
                  variant={statusFilter === 'SKIPPED' ? 'filled' : 'outlined'}
                  onClick={() => setStatusFilter(statusFilter === 'SKIPPED' ? '' : 'SKIPPED')}
                  sx={{
                    fontSize: '0.75rem',
                    height: 28,
                    borderStyle: 'dashed',
                    borderColor: statusFilter === 'SKIPPED' ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    bgcolor: statusFilter === 'SKIPPED' ? 'hsla(var(--primary) / 0.15)' : 'transparent',
                    color: statusFilter === 'SKIPPED' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    '&:hover': { bgcolor: 'hsl(var(--muted))' },
                  }}
                />
              )}

              {/* Inline loading indicator — visible when switching filters with existing results */}
              {isLoading && runs.length > 0 && (
                <CircularProgress size={16} sx={{ color: 'hsl(var(--primary))', ml: 0.5 }} />
              )}
            </Box>
        </Box>

        {/* Content layout */}
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
          {/* Left: Feed */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Loading */}
            {isLoading && runs.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={28} sx={{ color: 'hsl(var(--primary))' }} />
              </Box>
            ) : error ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography sx={{ color: 'hsl(var(--severity-critical))', fontSize: '0.9rem', mb: 1 }}>
                  {error}
                </Typography>
                <Button size="small" onClick={refresh} sx={{ color: 'hsl(var(--primary))', textTransform: 'none' }}>
                  Try again
                </Button>
              </Box>
            ) : (
              <>
                <AgentActivityFeed runs={runs} onRunClick={(run) => setSelectedRun(run)} />
                
                {/* Load more */}
                {hasMore && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Button
                      size="small"
                      onClick={loadMore}
                      disabled={isLoading}
                      sx={{
                        color: 'hsl(var(--primary))',
                        textTransform: 'none',
                        fontSize: '0.8rem',
                      }}
                    >
                      {isLoading ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                      Load more
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Right: Stats */}
          <Box sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
            <AgentActivityStatsPanel stats={stats} />
          </Box>
        </Box>
      </Box>

      {/* Permissions drawer */}
      <AgentPermissionsDrawer open={permissionsOpen} onClose={() => setPermissionsOpen(false)} initialTab={permissionsInitialTab} />

      {/* Action/view drawer for selected run */}
      <AgentActionDrawer
        open={!!selectedRun}
        onClose={() => setSelectedRun(null)}
        run={selectedRun}
      />
    </motion.div>
  );
};

export default AgentActivityPage;
