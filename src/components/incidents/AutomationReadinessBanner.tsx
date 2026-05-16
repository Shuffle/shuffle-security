import { CheckCircle2 as CheckCircleIcon, Circle as RadioButtonUncheckedIcon, Zap as BoltIcon, Power as PowerSettingsNewIcon, Rocket as RocketLaunchIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { useEnrichmentStatus } from '@/hooks/useEnrichmentStatus';
import { useAssignEscalateStatus } from '@/hooks/useAssignEscalateStatus';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getDatastoreByCategory, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import { seedDefaultIOCTypes } from '@/hooks/useIOCTypes';
import { seedDefaultThreatFeeds } from '@/hooks/useThreatFeeds';
import { toast } from '@/lib/toast';

/**
 * Compact automation readiness panel — sits underneath the trend charts in the
 * right-hand column on /incidents. Each row shows status and inline
 * Enable/Disable actions; "Enable all" wires up everything in one click.
 */
interface RowProps {
  label: string;
  active: boolean;
  loading?: boolean;
  busy?: boolean;
  tooltip?: string;
  onEnable?: () => void;
  onDisable?: () => void;
}

const Row = ({ label, active, loading, busy, tooltip, onEnable, onDisable }: RowProps) => {
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
      {!loading && active && onDisable && (
        <Tooltip title={`Disable ${label}`} arrow>
          <span>
            <IconButton
              size="small"
              disabled={busy}
              onClick={onDisable}
              sx={{
                width: 22,
                height: 22,
                color: 'hsl(var(--muted-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' },
              }}
            >
              {busy ? <CircularProgress size={12} /> : <PowerSettingsNewIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {!loading && !active && onEnable && (
        <Tooltip title={`Enable ${label}`} arrow>
          <span>
            <IconButton
              size="small"
              disabled={busy}
              onClick={onEnable}
              sx={{
                width: 22,
                height: 22,
                color: 'hsl(var(--primary))',
                '&:hover': { bgcolor: 'hsl(var(--primary) / 0.1)' },
              }}
            >
              {busy ? <CircularProgress size={12} /> : <BoltIcon sx={{ fontSize: 14 }} />}
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
  const [busy, setBusy] = useState<string | null>(null);
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

  const wrap = useCallback(async (key: string, fn: () => Promise<unknown>, verb: 'Enabled' | 'Disabled') => {
    setBusy(key);
    try {
      await fn();
      toast.success(`${verb}: ${key}`);
    } catch (err) {
      console.error('[automation-readiness]', verb.toLowerCase(), 'failed', key, err);
      toast.error(`Failed to ${verb.toLowerCase().replace(/d$/, '')} ${key}`);
    } finally {
      setBusy(null);
    }
  }, []);

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
        label="Ingestion"
        active={webhook.enabled}
        loading={webhook.isLoading}
        busy={busy === 'Ingestion'}
        tooltip="Pushes alerts directly into incidents via webhook URL"
        onEnable={() => wrap('Ingestion', () => webhook.enable(), 'Enabled')}
        onDisable={() => wrap('Ingestion', () => webhook.disable(), 'Disabled')}
      />
      <Row
        label="Enrichment"
        active={enrichment.active}
        loading={enrichment.isLoading}
        busy={busy === 'Enrichment'}
        tooltip="Threat feeds + IOC extraction + Enrich automation"
        onEnable={() => wrap('Enrichment', () => enrichment.enable(), 'Enabled')}
        onDisable={() => wrap('Enrichment', () => enrichment.disable(), 'Disabled')}
      />
      <Row
        label="Assign & Escalate"
        active={assign.active}
        loading={assign.isLoading}
        busy={busy === 'Assign & Escalate'}
        tooltip="Routes incidents to the on-call analyst and escalates"
        onEnable={() => wrap('Assign & Escalate', () => assign.enable(), 'Enabled')}
        onDisable={() => wrap('Assign & Escalate', () => assign.disable(), 'Disabled')}
      />
      <Row
        label="Default config"
        active={defaultsReady === true}
        loading={defaultsReady === null}
        busy={busy === 'Default config'}
        tooltip="Default IOC types and threat feeds seeded in datastore"
        onEnable={() => wrap('Default config', async () => {
          await Promise.allSettled([seedDefaultIOCTypes(), seedDefaultThreatFeeds()]);
          await checkDefaults();
        }, 'Enabled')}
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
