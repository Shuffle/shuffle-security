/**
 * The Demo Mode CTA card shown at the top of the dashboard.
 *
 * Two states:
 *   - Inactive: pitch + "Start Demo Tour" button
 *   - Active:   live counts + "Continue Tour" + "Clean up demo data"
 */

import { Box, Typography, Button, Chip, CircularProgress, Tooltip } from '@mui/material';
import { Sparkles, Play, Trash2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useDemo } from '@/context/DemoContext';
import { useWorkflows } from '@/hooks/useWorkflows';
import { findIngestTicketsWorkflow, isWorkflowScheduleStopped } from '@/lib/ingestionDetection';
import { getApiUrl, getAuthHeader } from '@/config/api';

/** Returns the total number of host monitors across all sensor_group environments. */
const useMonitorCount = () => {
  return useQuery<number>({
    queryKey: ['demo-card', 'monitor-count'],
    queryFn: async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/getenvironments'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!res.ok) return 0;
        const data = await res.json();
        const envs = Array.isArray(data) ? data : [];
        return envs.reduce((sum: number, e: any) => {
          if (e?.archived || e?.sensor_group !== true) return sum;
          return sum + (Array.isArray(e?.sensor_hosts) ? e.sensor_hosts.length : 0);
        }, 0);
      } catch {
        return 0;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/** Returns the total number of incidents in the org's datastore. */
const useIncidentCount = () => {
  return useQuery<number>({
    queryKey: ['demo-card', 'incident-count'],
    queryFn: async () => {
      try {
        const res = await fetch(
          getApiUrl('/api/v1/datastore/list_cache?category=shuffle-security_incidents&top=50'),
          { credentials: 'include', headers: { ...getAuthHeader() } },
        );
        if (!res.ok) return 0;
        const data = await res.json();
        if (typeof data?.total === 'number') return data.total;
        if (Array.isArray(data?.keys)) return data.keys.length;
        if (Array.isArray(data)) return data.length;
        return 0;
      } catch {
        return 0;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

const INCIDENT_THRESHOLD = 10;
const MONITOR_THRESHOLD = 1;

export const DemoModeCard = () => {
  const { active, isSeeding, isCleaning, stats, startDemo, openTour, cleanup } = useDemo();
  const { data: workflows } = useWorkflows();
  const { data: monitorCount = 0 } = useMonitorCount();
  const { data: incidentCount = 0 } = useIncidentCount();

  // Allow demo mode when the account is still light on real data:
  // ≤ 10 incidents AND ≤ 1 host monitor. Ingest workflow is informational only.
  const ingestWorkflow = workflows ? findIngestTicketsWorkflow(workflows) : null;
  const hasIngest = !!ingestWorkflow && !isWorkflowScheduleStopped(ingestWorkflow);
  const tooManyIncidents = incidentCount >= INCIDENT_THRESHOLD;
  const tooManyMonitors = monitorCount > MONITOR_THRESHOLD;
  const setupExists = tooManyIncidents || tooManyMonitors;
  const disableStart = !active && setupExists;
  const disableReason = tooManyIncidents && tooManyMonitors
    ? `You already have ${incidentCount} incidents and ${monitorCount} host monitors — demo mode is for lightly-used accounts.`
    : tooManyIncidents
      ? `You already have ${incidentCount} incidents — demo mode is for accounts with fewer than ${INCIDENT_THRESHOLD}.`
      : `You already have ${monitorCount} host monitors — demo mode is for accounts with ${MONITOR_THRESHOLD} or fewer.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        sx={{
          mb: 4,
          borderRadius: 2.5,
          border: '1px solid hsl(var(--primary) / 0.25)',
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--primary) / 0.02))',
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            backgroundColor: 'hsl(var(--primary) / 0.15)',
            color: 'hsl(var(--primary))',
            flexShrink: 0,
          }}
        >
          <Sparkles size={22} />
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {active ? 'Demo mode is active' : 'Try the platform with sample data'}
            </Typography>
            {active && (
              <Chip
                label="ON"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: 'hsl(var(--severity-low) / 0.18)',
                  color: 'hsl(var(--severity-low))',
                  letterSpacing: '0.04em',
                }}
              />
            )}
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', mt: 0.5, lineHeight: 1.5 }}>
            {active
              ? `Sample data is loaded into your account: ${stats.incidents} incidents, ${stats.assets} assets, ${stats.users} users. Take the tour to see how everything works, then clean up when you are done.`
              : disableStart
                ? `${disableReason} You are already past the demo — explore your real data instead.`
                : 'A guided, hands-on tour: we will enable apps in your account for real, seed sample incidents, assets and users, and let an AI agent perform live actions on your approval. Everything we create can be removed in one click when you are done.'}
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          {active ? (
            <>
              <Button
                onClick={openTour}
                variant="text"
                size="small"
                startIcon={<Play size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: 'hsl(var(--muted-foreground))',
                  px: 1.5,
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    backgroundColor: 'hsl(var(--muted) / 0.6)',
                    color: 'hsl(var(--foreground))',
                  },
                }}
              >
                Continue tour
              </Button>
              <Button
                onClick={cleanup}
                disabled={isCleaning}
                variant="outlined"
                size="small"
                startIcon={isCleaning ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <Trash2 size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  px: 2,
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    borderColor: 'hsl(var(--destructive) / 0.5)',
                    backgroundColor: 'hsl(var(--destructive) / 0.06)',
                    color: 'hsl(var(--destructive))',
                  },
                }}
              >
                {isCleaning ? 'Cleaning…' : 'Clean up demo data'}
              </Button>
            </>
          ) : (
            <Tooltip title={disableStart ? disableReason : ''} arrow disableHoverListener={!disableStart}>
              <span>
                <Button
                  onClick={startDemo}
                  disabled={isSeeding || disableStart}
                  variant="contained"
                  size="medium"
                  endIcon={isSeeding ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <ArrowRight size={16} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    px: 2.5,
                    py: 1,
                    boxShadow: 'none',
                    whiteSpace: 'nowrap',
                    width: { xs: '100%', sm: 'auto' },
                    '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)', boxShadow: 'none' },
                    '&.Mui-disabled': {
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--muted-foreground))',
                    },
                  }}
                >
                  {isSeeding ? 'Seeding sample data…' : 'Start demo tour'}
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>
    </motion.div>
  );
};

export default DemoModeCard;
