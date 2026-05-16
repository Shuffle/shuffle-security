import { CheckCircle2 as CheckCircleIcon, AlertCircle as ErrorOutlineIcon } from 'lucide-react';
import { Alert, Box, Button, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsSupport } from '@/hooks/useIsSupport';

/**
 * Shared "Threat Intel Automation: Active/Inactive" banner.
 *
 * Used on both /detection/threat-feeds and /detection/ioc-types so the
 * enable/disable affordance is identical and stays in sync. Backed by
 * `useEnrichmentStatus` (the single source of truth for whether the
 * threat-intel enrichment workflow is active).
 *
 * Admin-only: non-admins cannot toggle automations.
 */
const ThreatIntelAutomationBanner = ({ sx }: { sx?: object }) => {
  const isAdmin = useIsAdmin();
  const isSupportUser = useIsSupport();
  const enrichmentStatus = useEnrichmentStatus();
  const automationEnabled = enrichmentStatus.active;
  const automationAction = enrichmentStatus.action;

  if (!isAdmin) return null;
  if (enrichmentStatus.isLoading || automationEnabled === null) return null;

  const tooltipContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5, maxWidth: 360 }}>
      {enrichmentStatus.checks.map((c) => (
        <Box key={c.label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CheckCircleIcon size={13} style={{ color: c.active ? 'hsl(var(--severity-low))' : 'hsl(var(--destructive))' }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{c.label}</Typography>
          </Box>
          {isSupportUser && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)', pl: 2.5, lineHeight: 1.3 }}>
              {c.detail}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );

  return (
    <Alert
      severity={automationEnabled ? 'success' : 'warning'}
      icon={automationEnabled ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
      sx={{
        mb: 2,
        alignItems: 'center',
        '& .MuiAlert-icon': {
          color: automationEnabled ? 'hsl(var(--severity-low))' : undefined,
          alignItems: 'center',
          display: 'flex',
          padding: 0,
          marginRight: 1.5,
        },
        '& .MuiAlert-message': { width: '100%', padding: 0, display: 'flex', alignItems: 'center' },
        ...(sx || {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Tooltip title={tooltipContent} arrow placement="top">
          <Typography variant="body2" sx={{ fontWeight: 500, cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
            Threat Intel Automation: {automationEnabled ? 'Active' : 'Inactive'}
          </Typography>
        </Tooltip>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {automationEnabled
            ? '— Incidents will be automatically enriched with threat intelligence from enabled feeds.'
            : '— Enable to automatically enrich incidents with threat intelligence.'}
        </Typography>
        <Button
          size="small"
          variant={automationEnabled ? 'outlined' : 'contained'}
          disabled={enrichmentStatus.isEnabling}
          onClick={async () => {
            try {
              if (automationEnabled) {
                await enrichmentStatus.disable();
              } else {
                await enrichmentStatus.enable();
              }
            } catch (error) {
              console.error('Failed to toggle threat intel:', error);
            }
          }}
          sx={{
            whiteSpace: 'nowrap',
            ml: 0.5,
            ...(automationEnabled
              ? {
                  borderColor: 'success.main',
                  color: 'success.main',
                }
              : {
                  bgcolor: 'warning.main',
                  color: 'warning.contrastText',
                  '&:hover': { bgcolor: 'warning.dark' },
                }),
          }}
          startIcon={enrichmentStatus.isEnabling ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {automationAction === 'disable'
            ? 'Disabling…'
            : automationAction === 'enable'
              ? 'Enabling…'
              : automationEnabled
                ? 'Disable'
                : 'Enable'}
        </Button>
      </Box>
    </Alert>
  );
};

export default ThreatIntelAutomationBanner;
