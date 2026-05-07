import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import BoltIcon from '@mui/icons-material/Bolt';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';
import { useAssignEscalateStatus } from '@/hooks/useAssignEscalateStatus';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getDatastoreByCategory, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import { seedDefaultIOCTypes } from '@/hooks/useIOCTypes';
import { seedDefaultThreatFeeds } from '@/hooks/useThreatFeeds';
import { toast } from '@/lib/toast';

/**
 * Compact automation readiness panel.
 *
 * Shown underneath the trend charts in the right-hand column on /incidents.
 * Always renders for admins so they have at-a-glance visibility into which
 * critical automations are wired up. Each row shows status + an inline
 * "Enable" action; "Enable all" wires up everything in one click.
 */
interface RowProps {
  label: string;
  active: boolean;
  loading?: boolean;
  enabling?: boolean;
  tooltip?: string;
  onEnable?: () => void;
}

const Row = ({ label, active, loading, enabling, tooltip, onEnable }: RowProps) => {
  const icon = loading ? (
    <CircularProgress size={12} sx={{ color: 'hsl(var(--muted-foreground))' }} />
  ) : active ? (
    <CheckCircleIcon sx={{ fontSize: 14, color: 'hsl(var(--severity-low))' }} />
  ) : (
    <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: 'hsl(var(--muted-foreground))' }} />
  );
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      {icon}
      <Tooltip title={tooltip || ''} arrow placement="left" disableHoverListener={!tooltip}>
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontSize: '0.78rem',
            color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          }}
        >
          {label}
        </Typography>
      </Tooltip>
      {!active && !loading && onEnable && (
        <Tooltip title={`Enable ${label}`} arrow>
          <span>
            <IconButton
              size="small"
              disabled={enabling}
              onClick={onEnable}
              sx={{
                width: 22,
                height: 22,
                color: 'hsl(var(--primary))',
                '&:hover': { bgcolor: 'hsl(var(--primary) / 0.1)' },
              }}
            >
              {enabling ? <CircularProgress size={12} /> : <BoltIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
};

export const AutomationReadinessBanner = () => {
  const isAdmin = useIsAdmin();
  const webhook = useWebhookStatus();
  const enrichment = useEnrichmentStatus();
  const assign = useAssignEscalateStatus();

  const [defaultsReady, setDefaultsReady] = useState<boolean | null>(null);
  const [enabling, setEnabling] = useState<string | null>(null);
  const [enablingAll, setEnablingAll] = useState(false);

  const checkDefaults = useCallback(async () => {
    try {
      const [iocs, feeds] = await Promise.all([
        getDatastoreByCategory(DATASTORE_CATEGORIES.IOCS),
        getDatastoreByCategory(DATASTORE_CATEGORIES.THREAT_FEEDS),
      ]);
      const ok = !!(iocs.success && (iocs.data?.length || 0) > 0
        && feeds.success && (feeds.data?.length || 0) > 0);
      setDefaultsReady(ok);
    } catch {
      setDefaultsReady(null);
    }
  }, []);

  useEffect(() => { if (isAdmin) checkDefaults(); }, [isAdmin, checkDefaults]);

  const allActive = useMemo(() =>
    webhook.enabled && enrichment.active && assign.active && defaultsReady === true,
  [webhook.enabled, enrichment.active, assign.active, defaultsReady]);

  const isLoading = webhook.isLoading || enrichment.isLoading || assign.isLoading || defaultsReady === null;

  const wrap = useCallback(async (key: string, fn: () => Promise<unknown>) => {
    setEnabling(key);
    try {
      await fn();
      if (key === 'defaults') await checkDefaults();
      toast.success(`Enabled: ${key}`);
    } catch (err) {
      console.error('[automation-readiness] enable failed', key, err);
      toast.error(`Failed to enable ${key}`);
    } finally {
      setEnabling(null);
    }
  }, [checkDefaults]);

  const handleEnableAll = useCallback(async () => {
    setEnablingAll(true);
    try {
      const tasks: Promise<unknown>[] = [];
      if (defaultsReady !== true) {
        tasks.push(seedDefaultIOCTypes());
        tasks.push(seedDefaultThreatFeeds());
      }
      if (!enrichment.active) tasks.push(enrichment.enable());
      if (!assign.active) tasks.push(assign.enable());
      if (!webhook.enabled) tasks.push(webhook.enable());
      await Promise.allSettled(tasks);
      await checkDefaults();
      toast.success('All critical automations enabled');
    } catch (err) {
      console.error('[automation-readiness] enable all failed', err);
      toast.error('Failed to enable some automations');
    } finally {
      setEnablingAll(false);
    }
  }, [defaultsReady, enrichment, assign, webhook, checkDefaults]);

  if (!isAdmin) return null;

  const enabledCount =
    (webhook.enabled ? 1 : 0) +
    (enrichment.active ? 1 : 0) +
    (assign.active ? 1 : 0) +
    (defaultsReady === true ? 1 : 0);

  return (
    <Box
      sx={{
        mt: 2,
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem' }}>
          Automation Readiness
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: allActive ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))' }}>
          {enabledCount}/4 active
        </Typography>
      </Box>
      <Row
        label="Ingestion Webhook"
        active={webhook.enabled}
        loading={webhook.isLoading}
        enabling={enabling === 'webhook'}
        tooltip="Pushes alerts directly into incidents via webhook URL"
        onEnable={() => wrap('webhook', () => webhook.enable())}
      />
      <Row
        label="Automatic Enrichment"
        active={enrichment.active}
        loading={enrichment.isLoading}
        enabling={enabling === 'enrichment'}
        tooltip="Threat feeds + IOC extraction + Enrich automation"
        onEnable={() => wrap('enrichment', () => enrichment.enable())}
      />
      <Row
        label="Assign & Escalate"
        active={assign.active}
        loading={assign.isLoading}
        enabling={enabling === 'assign'}
        tooltip="Routes incidents to the on-call analyst and escalates"
        onEnable={() => wrap('assign', () => assign.enable())}
      />
      <Row
        label="Default config"
        active={defaultsReady === true}
        loading={defaultsReady === null}
        enabling={enabling === 'defaults'}
        tooltip="Default IOC types and threat feeds seeded in datastore"
        onEnable={() => wrap('defaults', async () => {
          await Promise.allSettled([seedDefaultIOCTypes(), seedDefaultThreatFeeds()]);
        })}
      />
      {!allActive && (
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={enablingAll ? <CircularProgress size={12} color="inherit" /> : <RocketLaunchIcon sx={{ fontSize: 14 }} />}
          disabled={enablingAll || isLoading}
          onClick={handleEnableAll}
          sx={{
            mt: 1,
            height: 28,
            textTransform: 'none',
            fontSize: '0.72rem',
            fontWeight: 600,
            borderColor: 'hsl(var(--primary) / 0.5)',
            color: 'hsl(var(--primary))',
            '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.08)' },
          }}
        >
          {enablingAll ? 'Enabling…' : 'Enable all'}
        </Button>
      )}
    </Box>
  );
};

export default AutomationReadinessBanner;
