/**
 * UsecaseAlluvialDiagram — Alluvial/Sankey-style visualization showing
 * Source tools → Shuffle → Destination tools for a given usecase.
 *
 * For ingest usecases (SIEM→Ticket, EDR→Ticket, Phishing→Ticket), sources
 * are all apps enabled in the "Ingest Tickets" workflow, with the apps
 * matching the usecase's source category visually highlighted (ring glow).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { algoliasearch } from 'algoliasearch';
import { Box, Typography, Avatar, Tooltip, IconButton, Chip, Popover, Button, Dialog, InputBase } from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Webhook,
  Ban as BlockIcon,
  CheckCircle as CheckCircleOutlineIcon,
  Check as CheckIcon,
  Copy as ContentCopyIcon,
  ExternalLink as OpenInNewIcon
} from 'lucide-react';
import { AppSearchDrawer } from '@shuffleio/shuffle-mcps';
import { useAppDetailOptional } from '@shuffleio/shuffle-mcps';
import { getApiUrl, getAuthHeader } from '@shuffleio/shuffle-mcps';
import type { ShuffleCoreHostProps } from '../types/host-props';
import { deduplicateAuthApps, backfillAppImages, type AuthAppEntry } from '../auth-utils';
import {
  SIEM_PATTERNS,
  CASES_PATTERNS,
  EDR_PATTERNS,
  EMAIL_APP_PATTERNS,
  findIngestTicketsWorkflow,
  findForwardTicketsWorkflow,
  extractWorkflowAppNames,
  normalizeAppName,
} from '../ingestionDetection';
import { TOOL_CATEGORIES } from './Usecases';
import shuffleInfraLogo from '../assets/shuffle-infrastructure-logo.png';
import shuffleIcon from '../assets/shuffle-icon.png';
import singulAgentIcon from '../assets/singul-agent-icon.png';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AppNode {
  id: string;
  name: string;
  icon: string;
  hasValidAuth: boolean;
  isActiveOnly: boolean;
  /** Whether this app matches the highlighted source category */
  isHighlighted?: boolean;
  /** Whether this app is enabled in the workflow (false = greyed out) */
  isEnabled?: boolean;
}

export interface UsecaseAlluvialDiagramProps extends ShuffleCoreHostProps {
  /** Source tool category ID (e.g. 'siem') */
  sourceCategory: string;
  /** Target tool category ID (e.g. 'case_management') */
  targetCategory: string;
  /**
   * If set, source apps are ALL apps in the Ingest Tickets workflow,
   * and apps matching this category get a visual highlight.
   */
  highlightCategory?: string;
}

// ── Pattern matchers ───────────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<string, string[]> = {
  siem: SIEM_PATTERNS,
  case_management: CASES_PATTERNS,
  edr: EDR_PATTERNS,
  email: EMAIL_APP_PATTERNS,
};

function matchesCategory(appName: string, categoryId: string): boolean {
  if (isShuffleInternalApp(appName)) return false;
  const patterns = CATEGORY_PATTERNS[categoryId];
  if (!patterns) return false;
  const lower = appName.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

/** Filter out Shuffle's own internal tools (e.g. "Shuffle Tools", "Shuffle Datastore") */
const SHUFFLE_INTERNAL_PATTERNS = ['shuffle tools', 'shuffle datastore', 'shuffle workflow'];
function isShuffleInternalApp(appName: string): boolean {
  const lower = appName.toLowerCase();
  return SHUFFLE_INTERNAL_PATTERNS.some(p => lower.includes(p));
}

// ── Sample apps for unauthenticated visitors ────────────────────────────────

const SAMPLE_APPS: Record<string, { name: string; icon: string }[]> = {
  siem: [
    { name: 'Splunk', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Splunk_1995363ec370368ed05a2882ec0ea8fc.png' },
    { name: 'Elasticsearch', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Elasticsearch_971706758e274c2e4083f2621fb5a6f7.png' },
    { name: 'Wazuh', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Wazuh_fb715a176a192620c25d49ba119e94e5.png' },
  ],
  edr: [
    { name: 'SentinelOne', icon: 'https://storage.googleapis.com/shuffle_public/app_images/SentinelOne_0373ed696a3a2cba0a2b6838068f2b80.png' },
    { name: 'Microsoft Defender', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Microsoft_365_Defender_29c926c37334c191666f6470caa05e1c.png' },
    { name: 'Carbon Black', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Carbon_Black_Response_e9fa2602ea6baafffa4b5eec722095d3.png' },
  ],
  email: [
    { name: 'Gmail', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Gmail_794e51c3c1a8b24b89ccc573a3defc47.png' },
    { name: 'Outlook', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Outlook_Office365_accdaaf2eeba6a6ed43b2efc0112032d.png' },
  ],
  case_management: [
    { name: 'Jira', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Jira_eb0c5e572e14ac1140a8355ba93c0d76.png' },
    { name: 'ServiceNow', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Servicenow_b9c2feaf99b6309dabaeaa8518c61d3d.png' },
    { name: 'TheHive', icon: 'https://storage.googleapis.com/shuffle_public/app_images/TheHive_7b0b20f198b28bcd6e7e3d2e7c1d84af.png' },
  ],
};

function getSampleApps(categoryId: string): AppNode[] {
  const samples = SAMPLE_APPS[categoryId] || [];
  return samples.map(s => ({
    id: `sample-${s.name}`,
    name: s.name,
    icon: s.icon,
    hasValidAuth: false,
    isActiveOnly: false,
  }));
}

// ── Status dot color ───────────────────────────────────────────────────────────

function getStatusColor(app: AppNode): string {
  if (app.hasValidAuth) return 'hsl(var(--severity-low))';       // Green — validated
  if (app.isActiveOnly) return 'hsl(var(--destructive))';        // Red — activated, no auth
  return 'hsl(var(--severity-medium))';                          // Yellow — auth exists, not validated
}

// ── App bubble component ───────────────────────────────────────────────────────

function AppBubble({ app, size = 40, highlighted = false, isSample = false, disabled = false, side = 'left', onClickApp, onRemoveApp, onToggleSync, onVisitApp, webhookInfo, onWebhookToggled }: { app: AppNode; size?: number; highlighted?: boolean; isSample?: boolean; disabled?: boolean; side?: 'left' | 'right'; onClickApp?: (appName: string) => void; onRemoveApp?: (appName: string) => void; onToggleSync?: (appName: string, enabled: boolean) => void; onVisitApp?: (appName: string) => void; webhookInfo?: { url: string | null; exists: boolean; enabled: boolean; workflowId: string | null }; onWebhookToggled?: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookOptimistic, setWebhookOptimistic] = useState<boolean | null>(null);
  const popoverOpen = Boolean(anchorEl);

  const displayName = app.name.replace(/_/g, ' ');
  const isEnabled = app.isEnabled !== false;
  const isWebhook = app.id === 'webhook-ingestion';
  const webhookEnabled = webhookOptimistic !== null ? webhookOptimistic : (webhookInfo?.enabled ?? false);

  const closeTooltip = useCallback(() => {
    setTooltipOpen(false);
    setHovered(false);
  }, []);

  const openTooltip = useCallback(() => {
    if (!popoverOpen && !confirmRemoveOpen) {
      setTooltipOpen(true);
    }
  }, [confirmRemoveOpen, popoverOpen]);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (isSample) return;
    closeTooltip();
    setAnchorEl(e.currentTarget);
  };

  const handleToggle = () => {
    setAnchorEl(null);
    closeTooltip();
    onToggleSync?.(app.name, !isEnabled);
  };

  const content = (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        transition: 'transform 0.15s ease',
        cursor: 'pointer',
        '&:hover': { transform: 'scale(1.12)' },
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {highlighted && (
        <Box
          sx={{
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            border: '2px solid hsl(var(--primary))',
            boxShadow: '0 0 10px hsl(var(--primary) / 0.4)',
            pointerEvents: 'none',
          }}
        />
      )}
      {isWebhook ? (
        <Avatar
          sx={{
            width: size,
            height: size,
            backgroundColor: webhookEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(6, 182, 212, 0.15)',
            color: webhookEnabled ? '#4ade80' : '#06b6d4',
            opacity: webhookEnabled ? 1 : 0.5,
          }}
        >
          <Webhook size={size * 0.5} />
        </Avatar>
      ) : app.icon && !imgFailed ? (
        <Box
          component="img"
          src={app.icon}
          alt={app.name}
          onError={() => setImgFailed(true)}
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'contain',
            backgroundColor: 'hsl(var(--muted))',
            p: 0.5,
            opacity: disabled ? 0.3 : (highlighted || isSample ? 1 : 0.7),
            filter: disabled ? 'grayscale(100%)' : 'none',
          }}
        />
      ) : (
        <Avatar
          sx={{
            width: size,
            height: size,
            backgroundColor: 'hsl(var(--muted))',
            fontSize: size * 0.38,
            color: 'hsl(var(--foreground))',
            opacity: disabled ? 0.3 : (highlighted || isSample ? 1 : 0.7),
            filter: disabled ? 'grayscale(100%)' : 'none',
          }}
        >
          {app.name.charAt(0).toUpperCase()}
        </Avatar>
      )}
      {!isSample && !hovered && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: getStatusColor(app),
            border: '2px solid hsl(var(--card))',
            pointerEvents: 'none',
          }}
        />
      )}
      {isSample && hovered && onRemoveApp && (
        <Box
          onClick={(e) => {
            e.stopPropagation();
            onRemoveApp(app.name);
          }}
          sx={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: 'hsl(var(--destructive))',
            border: '2px solid hsl(var(--card))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.1s ease',
            '&:hover': { transform: 'scale(1.2)' },
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 24 24"
            sx={{ width: 8, height: 8, stroke: 'white', strokeWidth: 3, fill: 'none' }}
          >
            <line x1="4" y1="4" x2="20" y2="20" />
            <line x1="20" y1="4" x2="4" y2="20" />
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <Tooltip
        title={
          <Box sx={{ textAlign: 'left', p: 0.5 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
              {app.name}
            </Typography>
            {!isSample && (
              <Typography sx={{ fontSize: '0.7rem', color: disabled ? 'hsl(var(--muted-foreground))' : (app.isEnabled === false) ? 'hsl(var(--muted-foreground))' : app.hasValidAuth ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))' }}>
                {disabled
                  ? 'Not enabled for ingestion'
                  : (app.isEnabled === false)
                    ? (side === 'right' ? 'Not forwarding' : 'Not enabled')
                    : app.hasValidAuth
                      ? (side === 'right' ? 'Forwarding' : 'Enabled')
                      : app.isActiveOnly ? 'Not enabled' : 'Inactive'}
              </Typography>
            )}
          </Box>
        }
        placement="bottom"
        arrow
        open={!popoverOpen && !confirmRemoveOpen && tooltipOpen}
        disableInteractive
        disableHoverListener
        disableFocusListener
        disableTouchListener
      >
        <Box
          onMouseEnter={openTooltip}
          onMouseLeave={closeTooltip}
          onMouseDown={closeTooltip}
          onClick={isSample ? undefined : handleClick}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          {content}
        </Box>
      </Tooltip>

      {/* Popover — webhook or app actions */}
      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
          closeTooltip();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 1600 }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              p: 1.5,
              minWidth: isWebhook ? 280 : 160,
              maxWidth: isWebhook ? 400 : undefined,
            },
          },
        }}
      >
        {isWebhook ? (
          /* Webhook popover — same UX as /incidents WebhookIngestionButton */
          <>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.5, display: 'block' }}>
              Ingestion Webhook
              {!webhookEnabled && (
                <Chip label="Not Active" size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }} />
              )}
            </Typography>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', mb: 1, display: 'block', lineHeight: 1.4 }}>
              {webhookEnabled
                ? 'Send alerts to this URL to push incidents directly.'
                : webhookInfo?.exists
                  ? 'This webhook is currently stopped. Enable it to receive pushed alerts.'
                  : 'Enable to create a webhook endpoint for pushing alerts.'}
            </Typography>

            {webhookEnabled && webhookInfo?.url && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                bgcolor: 'hsl(var(--muted) / 0.5)', border: '1px solid hsl(var(--border))',
                borderRadius: 1, px: 1, py: 0.5, mb: 1,
              }}>
                <InputBase
                  value={webhookInfo.url}
                  readOnly
                  fullWidth
                  sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'hsl(var(--foreground))', '& input': { p: 0 } }}
                />
                <IconButton size="small" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(webhookInfo.url!);
                    setCopied(true);
                    import('sonner').then(({ toast }) => toast.success('Webhook URL copied'));
                    setTimeout(() => setCopied(false), 2000);
                  } catch { import('sonner').then(({ toast }) => toast.error('Failed to copy')); }
                }} sx={{ p: 0.5, color: 'hsl(var(--muted-foreground))' }}>
                  {copied ? <CheckIcon size={14} color={'#4ade80'} /> : <ContentCopyIcon size={14} />}
                </IconButton>
              </Box>
            )}

            <Button
              size="small"
              startIcon={webhookEnabled ? <BlockIcon size={14} /> : <CheckCircleOutlineIcon size={14} />}
              onClick={async () => {
                const willBeEnabled = !webhookEnabled;
                setWebhookOptimistic(willBeEnabled);
                setAnchorEl(null);
                try {
                  const res = await fetch(getApiUrl('/api/v2/workflows/generate'), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      label: 'Ingest Tickets_webhook',
                      ...(willBeEnabled ? {} : { action_name: 'remove' }),
                    }),
                  });
                  if (!res.ok) throw new Error();
                  import('sonner').then(({ toast }) => toast.success(willBeEnabled ? 'Ingestion Webhook enabled' : 'Ingestion Webhook disabled'));
                  setWebhookOptimistic(null);
                  onWebhookToggled?.();
                } catch {
                  setWebhookOptimistic(null);
                  import('sonner').then(({ toast }) => toast.error('Failed to update webhook status'));
                }
              }}
              sx={{
                justifyContent: 'flex-start', textTransform: 'none', fontSize: '0.75rem',
                  color: webhookEnabled ? 'hsl(var(--destructive))' : 'hsl(var(--severity-low))',
                px: 1, py: 0.5, borderRadius: 1,
                  '&:hover': { bgcolor: webhookEnabled ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--severity-low) / 0.1)' },
              }}
            >
              {webhookEnabled ? 'Disable Webhook' : 'Enable Webhook'}
            </Button>
          </>
        ) : (
          /* Regular app popover */
          <>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', textTransform: 'capitalize', mb: 1, display: 'block' }}>
              {displayName}
              {!isEnabled && (
                <Chip label={side === 'right' ? 'Not Forwarding' : 'Not Active'} size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }} />
              )}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Button
                size="small"
                startIcon={<OpenInNewIcon size={14} />}
                onClick={() => {
                  setAnchorEl(null);
                  onVisitApp?.(app.name);
                }}
                sx={{
                  justifyContent: 'flex-start', textTransform: 'none', fontSize: '0.75rem',
                  color: 'hsl(var(--foreground))', px: 1, py: 0.5, borderRadius: 1,
                  '&:hover': { bgcolor: 'hsl(var(--muted))' },
                }}
              >
                Visit app
              </Button>
              {onToggleSync && (
                <Button
                  size="small"
                  startIcon={isEnabled ? <BlockIcon size={14} /> : <CheckCircleOutlineIcon size={14} />}
                  onClick={handleToggle}
                  sx={{
                    justifyContent: 'flex-start', textTransform: 'none', fontSize: '0.75rem',
                      color: isEnabled ? 'hsl(var(--destructive))' : 'hsl(var(--severity-low))',
                    px: 1, py: 0.5, borderRadius: 1,
                      '&:hover': { bgcolor: isEnabled ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--severity-low) / 0.1)' },
                  }}
                >
                  {isEnabled ? (side === 'right' ? 'Disable Forwarding' : 'Disable Sync') : (side === 'right' ? 'Enable Forwarding' : 'Enable Sync')}
                </Button>
              )}
              {onRemoveApp && (
                <Button
                  size="small"
                  startIcon={<Box component="svg" viewBox="0 0 24 24" sx={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" /></Box>}
                  onClick={() => {
                    setAnchorEl(null);
                    setConfirmRemoveOpen(true);
                  }}
                  sx={{
                    justifyContent: 'flex-start', textTransform: 'none', fontSize: '0.75rem',
                    color: 'hsl(var(--destructive))', px: 1, py: 0.5, borderRadius: 1,
                    '&:hover': { bgcolor: 'hsl(var(--destructive) / 0.1)' },
                  }}
                >
                  Remove
                </Button>
              )}
            </Box>
          </>
        )}
      </Popover>

      {/* Confirm remove dialog */}
      <Dialog
        open={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            p: 2.5,
            minWidth: 320,
            maxWidth: 400,
          },
        }}
      >
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.5 }}>
          Remove {app.name.replace(/_/g, ' ')}?
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', mb: 2 }}>
          This will hide the app from this diagram.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            onClick={() => setConfirmRemoveOpen(false)}
            sx={{ textTransform: 'none', fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', px: 2, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'hsl(var(--muted))' } }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            onClick={() => {
              setConfirmRemoveOpen(false);
              onRemoveApp?.(app.name);
            }}
            sx={{ textTransform: 'none', fontSize: '0.78rem', color: 'white', bgcolor: 'hsl(var(--destructive))', px: 2, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'hsl(var(--destructive) / 0.85)' } }}
          >
            Remove
          </Button>
        </Box>
      </Dialog>
    </>
  );
}

// ── Shuffle Pipelines Banner ───────────────────────────────────────────────────

export function ShufflePipelinesBanner() {
  return (
    <Box
      component="a"
      href="/detection"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        mb: 2,
        borderRadius: 2.5,
        background: 'linear-gradient(135deg, hsla(25, 100%, 50%, 0.08) 0%, hsla(25, 100%, 50%, 0.03) 100%)',
        border: '1px solid hsla(25, 100%, 50%, 0.2)',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          border: '1px solid hsla(25, 100%, 50%, 0.4)',
          background: 'linear-gradient(135deg, hsla(25, 100%, 50%, 0.12) 0%, hsla(25, 100%, 50%, 0.05) 100%)',
        },
      }}
    >
      <Box
        component="img"
        src={shuffleIcon}
        alt="Shuffle"
        sx={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--foreground))', lineHeight: 1.3 }}>
          Shuffle Pipelines
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>
          Don't have a SIEM? Shuffle can ingest, parse, and correlate your logs and events directly — no external SIEM required.
        </Typography>
      </Box>
      <Chip
        label="Built-in"
        size="small"
        sx={{
          height: 22,
          fontSize: '0.65rem',
          fontWeight: 700,
          backgroundColor: 'hsl(var(--primary) / 0.15)',
          color: 'hsl(var(--primary))',
          border: '1px solid hsl(var(--primary) / 0.3)',
          flexShrink: 0,
        }}
      />
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UsecaseAlluvialDiagram({
  sourceCategory,
  targetCategory,
  highlightCategory,
  isLoggedIn = false,
}: UsecaseAlluvialDiagramProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // isLoggedIn comes from props (host injects); defaults to false.
  const appDetailCtx = useAppDetailOptional();
  const handleVisitApp = useCallback((appName: string) => {
    appDetailCtx?.openApp(appName);
  }, [appDetailCtx]);
  const [allApps, setAllApps] = useState<AppNode[]>([]);
  const [ingestAppNames, setIngestAppNames] = useState<Set<string> | null>(null);
  const [forwardAppNames, setForwardAppNames] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookInfo, setWebhookInfo] = useState<{ url: string | null; exists: boolean; enabled: boolean; workflowId: string | null }>({ url: null, exists: false, enabled: false, workflowId: null });
  const [searchOpen, setSearchOpen] = useState<'left' | 'right' | null>(null);
  // Track apps manually added to the destination via "+ Add" (bypasses category matching)
  const [manualDestApps, setManualDestApps] = useState<Set<string>>(new Set());
  const pendingTogglesRef = useRef<Map<string, boolean>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache Algolia icons for guest-added apps (name → icon URL)
  const [guestAppIcons, setGuestAppIcons] = useState<Record<string, string>>({});

  // Fetch icons from Algolia for guest apps loaded from URL params
  useEffect(() => {
    if (isLoggedIn) return;
    const allGuestNames = [
      ...(searchParams.get('source')?.split(',').filter(Boolean) || []),
      ...(searchParams.get('dest')?.split(',').filter(Boolean) || []),
    ];
    const missing = allGuestNames.filter(n => !guestAppIcons[n.toLowerCase()]);
    if (missing.length === 0) return;

    const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
    (async () => {
      const icons: Record<string, string> = {};
      for (const name of missing) {
        try {
          const res = await client.searchSingleIndex({
            indexName: 'appsearch',
            searchParams: { query: name.replace(/_/g, ' '), hitsPerPage: 1 },
          });
          const hit = res.hits[0] as any;
          if (hit?.image_url) {
            icons[name.toLowerCase()] = hit.image_url;
          }
        } catch { /* skip */ }
      }
      if (Object.keys(icons).length > 0) {
        setGuestAppIcons(prev => ({ ...prev, ...icons }));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // Guest-selected apps from URL params
  const guestSourceNames = useMemo(() => {
    const raw = searchParams.get('source');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const guestDestNames = useMemo(() => {
    const raw = searchParams.get('dest');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const addGuestApp = (side: 'left' | 'right', app: { name: string; icon: string }) => {
    const paramKey = side === 'left' ? 'source' : 'dest';
    const current = searchParams.get(paramKey);
    const names = current ? current.split(',').filter(Boolean) : [];
    if (!names.some(n => n.toLowerCase() === app.name.toLowerCase())) {
      names.push(app.name);
    }
    const newParams = new URLSearchParams(searchParams);
    newParams.set(paramKey, names.join(','));
    setSearchParams(newParams, { replace: true });
    // Store the Algolia icon so we can render it
    if (app.icon) {
      setGuestAppIcons(prev => ({ ...prev, [app.name.toLowerCase()]: app.icon }));
    }
    // Clear from hiddenApps in case it was previously removed
    setHiddenApps(prev => {
      const next = new Set(prev);
      next.delete(app.name.toLowerCase());
      return next;
    });
  };

  // Locally disabled apps (hidden from the diagram)
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());

  const handleRemoveApp = useCallback((appName: string) => {
    // For guests: also remove from URL params
    if (!isLoggedIn) {
      const newParams = new URLSearchParams(searchParams);
      for (const key of ['source', 'dest']) {
        const current = newParams.get(key);
        if (current) {
          const filtered = current.split(',').filter(n => n.toLowerCase() !== appName.toLowerCase());
          if (filtered.length > 0) {
            newParams.set(key, filtered.join(','));
          } else {
            newParams.delete(key);
          }
        }
      }
      setSearchParams(newParams, { replace: true });
    }
    setHiddenApps(prev => new Set(prev).add(appName.toLowerCase()));
  }, [isLoggedIn, searchParams, setSearchParams]);

  // Re-fetch webhook status after toggle
  const handleWebhookToggled = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/v1/workflows'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (res.ok) {
        const wfData = await res.json();
        const workflows = Array.isArray(wfData) ? wfData : (wfData.workflows || []);
        const webhookWorkflow = workflows.find((w: any) => w.name === 'Ingestion Webhook');
        if (webhookWorkflow) {
          const webhookTrigger = (webhookWorkflow.triggers || []).find(
            (t: any) => t.trigger_type === 'WEBHOOK' || t.app_name === 'Webhook'
          );
          let webhookUrl: string | null = null;
          if (webhookTrigger) {
            const webhookId = webhookTrigger.id || webhookTrigger.trigger_id;
            if (webhookId) webhookUrl = getApiUrl(`/api/v1/hooks/webhook_${webhookId}`);
          }
          const triggerStopped = !webhookTrigger || (webhookTrigger.status || '').toLowerCase() === 'stopped';
          setWebhookInfo({ url: webhookUrl, exists: true, enabled: !triggerStopped, workflowId: webhookWorkflow.id });
        } else {
          setWebhookInfo({ url: null, exists: false, enabled: false, workflowId: null });
        }
      }
    } catch {}
  }, []);

  // Toggle sync: same debounced approach as /incidents page
  const handleToggleSync = useCallback((appName: string, enabled: boolean) => {
    // Optimistic update: toggle the app in ingestAppNames
    setIngestAppNames(prev => {
      if (!prev) return prev;
      const next = new Set(prev);
      const normalized = normalizeAppName(appName);
      if (enabled) {
        next.add(normalized);
      } else {
        next.delete(normalized);
      }
      return next;
    });

    pendingTogglesRef.current.set(appName, enabled);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const toggles = new Map(pendingTogglesRef.current);
      pendingTogglesRef.current.clear();

      // Build active app names from current source apps + toggles
      const currentIngest = ingestAppNames || new Set<string>();
      const activeNames: string[] = [];
      // Include currently enabled apps (minus any toggled off)
      allApps.filter(a => a.hasValidAuth && !isShuffleInternalApp(a.name)).forEach(a => {
        const norm = normalizeAppName(a.name);
        const isCurrentlyIn = currentIngest.has(norm);
        const toggled = toggles.get(a.name);
        const shouldBeEnabled = toggled !== undefined ? toggled : isCurrentlyIn;
        if (shouldBeEnabled) activeNames.push(a.name);
      });

      try {
        const { toast } = await import('sonner');
        await fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'Ingest Tickets',
            app_name: activeNames.join(','),
            category: 'cases',
          }),
        });
        toast.success('Ingestion sources updated');
      } catch (error) {
        console.error('Failed to update ingestion sources:', error);
        const { toast } = await import('sonner');
        toast.error('Failed to update ingestion sources');
      }
    }, 3000);
  }, [allApps, ingestAppNames]);

  /**
   * Re-fetch the Forward Tickets workflow and sync `forwardAppNames` from
   * the backend (workflow is the source of truth, mirroring AutomationConfig
   * on /onboarding/automate). Returns the freshly-extracted Set, or null if
   * the workflow could not be fetched / parsed.
   */
  const refreshForwardWorkflow = useCallback(async (): Promise<Set<string> | null> => {
    try {
      const res = await fetch(getApiUrl('/api/v1/workflows'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const workflows = Array.isArray(data) ? data : (data.workflows || []);
      const forwardWf = findForwardTicketsWorkflow(workflows);
      if (!forwardWf) {
        setForwardAppNames(new Set());
        return new Set();
      }
      const fresh = extractWorkflowAppNames(forwardWf);
      setForwardAppNames(fresh);
      return fresh;
    } catch (err) {
      console.warn('[AlluvialDiagram] refreshForwardWorkflow failed:', err);
      return null;
    }
  }, []);

  /**
   * Push the desired full Forward Tickets app set to the backend (single
   * source-of-truth pattern used by /onboarding/automate AutomationConfig).
   * Sends every active app on every change, then re-fetches the workflow to
   * verify the new state landed. Reverts optimistic UI on mismatch.
   */
  const pushForwardWorkflow = useCallback(async (
    desiredAppNames: string[],
    intent: { action: 'add' | 'remove' | 'sync'; appName?: string },
  ): Promise<boolean> => {
    const { toast } = await import('sonner');
    try {
      const res = await fetch(getApiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Forward Tickets',
          app_name: desiredAppNames.join(','),
          category: 'cases',
        }),
      });
      if (!res.ok) {
        throw new Error(`generate failed: HTTP ${res.status}`);
      }

      // Verify the workflow now matches the desired state
      const verified = await refreshForwardWorkflow();
      const target = intent.appName ? normalizeAppName(intent.appName) : null;
      const verb = intent.action === 'remove' ? 'removed from' : 'added to';
      const label = intent.appName ? intent.appName.replace(/_/g, ' ') : 'Forwarding';

      if (verified && target) {
        const present = verified.has(target);
        const expectedPresent = intent.action !== 'remove';
        if (present !== expectedPresent) {
          toast.warning(
            `${label} not yet ${verb} forwarding`,
            { description: 'The Forward Tickets workflow did not pick up the change. Check the workflow.' },
          );
          return false;
        }
      }
      if (intent.action !== 'sync') {
        toast.success(`${label} ${verb} forwarding`);
      }
      return true;
    } catch (error) {
      console.error('Failed to update Forward Tickets workflow:', error);
      toast.error('Failed to update forwarding');
      // Revert optimistic state from the workflow (real source of truth)
      await refreshForwardWorkflow();
      return false;
    }
  }, [refreshForwardWorkflow]);

  // Toggle forwarding: add/remove app from Forward Tickets workflow.
  // Mirrors the /onboarding/automate "Forward" pattern: send the FULL list
  // of currently-forwarded apps every time, then verify by re-fetching.
  const handleToggleForward = useCallback((appName: string, enabled: boolean) => {
    const normalized = normalizeAppName(appName);

    // Optimistic UI update
    setForwardAppNames(prev => {
      const next = new Set(prev || []);
      if (enabled) next.add(normalized); else next.delete(normalized);
      return next;
    });

    // Build the desired full list (current ± this toggle), de-normalized to
    // the app names the backend expects.
    const currentSet = new Set(forwardAppNames || []);
    if (enabled) currentSet.add(normalized); else currentSet.delete(normalized);

    // Resolve normalized names back to display names (prefer allApps lookup,
    // fall back to the raw input name for the toggled app).
    const desiredAppNames: string[] = [];
    currentSet.forEach(norm => {
      const match = allApps.find(a => normalizeAppName(a.name) === norm);
      if (match) desiredAppNames.push(match.name);
      else if (norm === normalized) desiredAppNames.push(appName);
    });

    pushForwardWorkflow(desiredAppNames, {
      action: enabled ? 'add' : 'remove',
      appName,
    });
  }, [forwardAppNames, allApps, pushForwardWorkflow]);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }

    (async () => {
      try {
        // Parallel fetch: auth apps, active apps, workflows
        const [authRes, appsRes, workflowsRes] = await Promise.all([
          fetch(getApiUrl('/api/v1/apps/authentication'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          }),
          fetch(getApiUrl('/api/v1/apps'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          }),
          fetch(getApiUrl('/api/v1/workflows'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          }),
        ]);

        const authNameSet = new Set<string>();
        let nodes: AppNode[] = [];

        if (authRes.ok) {
          const result = await authRes.json();
          const authData: AuthAppEntry[] = result.data || result;
          if (Array.isArray(authData)) {
            const deduped = deduplicateAuthApps(authData);
            await backfillAppImages(deduped);
            nodes = deduped.map(({ app, hasValidAuth, bestImage }) => {
              authNameSet.add(app.name.toLowerCase());
              return {
                id: app.id,
                name: app.name,
                icon: bestImage || app.large_image || '',
                hasValidAuth,
                isActiveOnly: false,
              };
            });
          }
        }

        // Fill with active apps
        if (appsRes.ok) {
          try {
            const appsData = await appsRes.json();
            if (Array.isArray(appsData)) {
              for (const app of appsData.filter((a: any) => a.activated)) {
                if (!authNameSet.has((app.name || '').toLowerCase())) {
                  authNameSet.add((app.name || '').toLowerCase());
                  nodes.push({
                    id: app.id || app.name,
                    name: app.name,
                    icon: app.large_image || '',
                    hasValidAuth: false,
                    isActiveOnly: true,
                  });
                }
              }
            }
          } catch (_) {}
        }

        // Parse ingest & forward workflows + webhook status
        if (workflowsRes.ok) {
          try {
            const wfData = await workflowsRes.json();
            const workflows = Array.isArray(wfData) ? wfData : (wfData.workflows || []);
            const ingestWf = findIngestTicketsWorkflow(workflows);
            if (ingestWf) {
              setIngestAppNames(extractWorkflowAppNames(ingestWf));
            }
            const forwardWf = findForwardTicketsWorkflow(workflows);
            if (forwardWf) {
              setForwardAppNames(extractWorkflowAppNames(forwardWf));
            }
            // Detect webhook workflow
            const webhookWorkflow = workflows.find((w: any) => w.name === 'Ingestion Webhook');
            if (webhookWorkflow) {
              const webhookTrigger = (webhookWorkflow.triggers || []).find(
                (t: any) => t.trigger_type === 'WEBHOOK' || t.app_name === 'Webhook'
              );
              let webhookUrl: string | null = null;
              if (webhookTrigger) {
                const webhookId = webhookTrigger.id || webhookTrigger.trigger_id;
                if (webhookId) {
                  webhookUrl = getApiUrl(`/api/v1/hooks/webhook_${webhookId}`);
                }
              }
              const triggerStopped = !webhookTrigger || (webhookTrigger.status || '').toLowerCase() === 'stopped';
              setWebhookInfo({ url: webhookUrl, exists: true, enabled: !triggerStopped, workflowId: webhookWorkflow.id });
            } else {
              setWebhookInfo({ url: null, exists: false, enabled: false, workflowId: null });
            }
          } catch (_) {}
        }

        setAllApps(nodes);
      } catch (err) {
        console.error('[AlluvialDiagram] fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Permanent webhook node shown at the top of every source column
  const webhookNode: AppNode = useMemo(() => ({
    id: 'webhook-ingestion',
    name: 'Webhook',
    icon: '',
    hasValidAuth: webhookInfo.enabled,
    isActiveOnly: false,
    isHighlighted: true,
    isEnabled: !isLoggedIn || webhookInfo.enabled || webhookInfo.exists,
  }), [webhookInfo]);

  // Source apps: if highlightCategory is set, show all ingest workflow apps
  // Otherwise fall back to category-based filtering
  const sourceApps = useMemo(() => {
    const prependWebhook = (apps: AppNode[]) => [webhookNode, ...apps];

    if (!isLoggedIn) {
      const samples = highlightCategory ? getSampleApps(highlightCategory) : getSampleApps(sourceCategory);
      // Add guest-selected apps from URL
      const guestNodes: AppNode[] = guestSourceNames
        .filter(name => !samples.some(s => s.name.toLowerCase() === name.toLowerCase()))
        .map(name => ({
          id: `guest-${name}`,
          name,
          icon: guestAppIcons[name.toLowerCase()] || `https://storage.googleapis.com/shuffle_public/app_images/${name.replace(/\s+/g, '_')}.png`,
          hasValidAuth: false,
          isActiveOnly: false,
          isHighlighted: true,
          isEnabled: true,
        }));
      return prependWebhook(
        [...samples.map(a => ({ ...a, isHighlighted: true, isEnabled: true })), ...guestNodes]
          .filter(a => !hiddenApps.has(a.name.toLowerCase()))
      );
    }
    if (highlightCategory && ingestAppNames) {
      // Only show apps that match the usecase's source category from the user's apps
      const categoryApps = allApps.filter(a =>
        !isShuffleInternalApp(a.name) && matchesCategory(a.name, highlightCategory)
      );

      const enabledNodes = categoryApps
        .filter(a => ingestAppNames.has(normalizeAppName(a.name)))
        .map(a => ({
          ...a,
          isHighlighted: true,
          isEnabled: true,
        }));

      const disabledNodes = categoryApps
        .filter(a => !ingestAppNames.has(normalizeAppName(a.name)))
        .map(a => ({
          ...a,
          isHighlighted: false,
          isEnabled: false,
        }));

      // If user has no apps matching this category, fall back to samples
      const filtered = [...enabledNodes, ...disabledNodes].filter(a => !hiddenApps.has(a.name.toLowerCase()));
      if (filtered.length === 0) {
        const samples = getSampleApps(highlightCategory);
        return prependWebhook(samples.map(a => ({ ...a, isHighlighted: true, isEnabled: true })));
      }

      return prependWebhook(filtered);
    }
    return prependWebhook(
      allApps.filter(a => matchesCategory(a.name, sourceCategory) && !hiddenApps.has(a.name.toLowerCase())).map(a => ({ ...a, isEnabled: true }))
    );
  }, [allApps, sourceCategory, highlightCategory, ingestAppNames, isLoggedIn, guestSourceNames, guestAppIcons, hiddenApps, webhookNode]);

  // Target/destination apps: use Forward Tickets workflow as source of truth when available
  const targetApps = useMemo(() => {
    if (!isLoggedIn) {
      const samples = getSampleApps(targetCategory);
      // Add guest-selected apps from URL
      const guestNodes: AppNode[] = guestDestNames
        .filter(name => !samples.some(s => s.name.toLowerCase() === name.toLowerCase()))
        .map(name => ({
          id: `guest-${name}`,
          name,
          icon: guestAppIcons[name.toLowerCase()] || `https://storage.googleapis.com/shuffle_public/app_images/${name.replace(/\s+/g, '_')}.png`,
          hasValidAuth: false,
          isActiveOnly: false,
        }));
      return [...samples, ...guestNodes].filter(a => !hiddenApps.has(a.name.toLowerCase()));
    }
    if (highlightCategory) {
      // Show only user's apps that match the target category (+ manually added ones)
      const caseMgmtApps = allApps.filter(a =>
        !isShuffleInternalApp(a.name) && (matchesCategory(a.name, targetCategory) || manualDestApps.has(normalizeAppName(a.name))) && !hiddenApps.has(a.name.toLowerCase())
      );

      // If user has no matching apps, fall back to samples
      if (caseMgmtApps.length === 0) {
        const samples = getSampleApps(targetCategory);
        return samples.filter(a => !hiddenApps.has(a.name.toLowerCase()));
      }

      if (forwardAppNames && forwardAppNames.size > 0) {
        const enabledApps = caseMgmtApps
          .filter(a => forwardAppNames.has(normalizeAppName(a.name)))
          .map(a => ({ ...a, isEnabled: true }));
        const disabledApps = caseMgmtApps
          .filter(a => !forwardAppNames.has(normalizeAppName(a.name)))
          .map(a => ({ ...a, isEnabled: false }));
        return [...enabledApps, ...disabledApps];
      }
      return caseMgmtApps;
    }
    return allApps.filter(a => (matchesCategory(a.name, targetCategory) || manualDestApps.has(normalizeAppName(a.name))) && !hiddenApps.has(a.name.toLowerCase()));
  }, [allApps, targetCategory, highlightCategory, forwardAppNames, isLoggedIn, guestDestNames, guestAppIcons, hiddenApps, manualDestApps]);

  const sourceMeta = TOOL_CATEGORIES.find(c => c.id === sourceCategory);
  const targetMeta = TOOL_CATEGORIES.find(c => c.id === targetCategory);

  // Source label: when showing ingest apps, label as "Ingestion Sources"
  const sourceLabel = highlightCategory ? 'Ingestion Sources' : (sourceMeta?.label || sourceCategory);

  // SVG dimensions
  const nodeSize = 40;
  const colWidth = 80;
  const svgPadding = 20;
  const rowGap = 16;
  const addButtonSpace = 48; // space for the + button below apps

  const maxNodes = Math.max(sourceApps.length, targetApps.length, 1);
  const colHeight = maxNodes * (nodeSize + rowGap) - rowGap;
  const svgHeight = colHeight + svgPadding * 2 + 40 + addButtonSpace;
  const svgWidth = colWidth * 3 + 300;

  const leftX = svgPadding + nodeSize / 2;
  const centerX = svgWidth / 2;
  const rightX = svgWidth - svgPadding - nodeSize / 2;

  const getY = (idx: number, total: number) => {
    const totalHeight = total * (nodeSize + rowGap) - rowGap;
    const startY = (svgHeight - 30) / 2 - totalHeight / 2 + nodeSize / 2;
    return startY + idx * (nodeSize + rowGap);
  };

  const centerY = (svgHeight - 30) / 2;

  // Y position for the add button (below the last app, or at center if no apps)
  const getAddButtonY = (appCount: number) => {
    if (appCount === 0) return centerY;
    const lastY = getY(appCount - 1, appCount);
    return lastY + nodeSize / 2 + rowGap + 16;
  };

  const makePath = (fromX: number, fromY: number, toX: number, toY: number) => {
    const cx1 = fromX + (toX - fromX) * 0.45;
    const cx2 = fromX + (toX - fromX) * 0.55;
    // When fromY ≈ toY the bezier is flat/invisible — add a slight arc
    const yDiff = Math.abs(fromY - toY);
    if (yDiff < 8) {
      const bulge = 20; // vertical offset to create visible curvature
      return `M ${fromX} ${fromY} C ${cx1} ${fromY - bulge}, ${cx2} ${toY - bulge}, ${toX} ${toY}`;
    }
    return `M ${fromX} ${fromY} C ${cx1} ${fromY}, ${cx2} ${toY}, ${toX} ${toY}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 4, py: 4, px: 2, alignItems: 'center' }}>
        {/* Left column shimmer */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              sx={{
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted-foreground) / 0.08) 50%, hsl(var(--muted)) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '200% 0' },
                  '100%': { backgroundPosition: '-200% 0' },
                },
              }}
            />
          ))}
        </Box>
        {/* Center lines shimmer */}
        <Box sx={{ width: 60, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              sx={{
                height: 2,
                width: '100%',
                borderRadius: 1,
                background: 'linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted-foreground) / 0.08) 50%, hsl(var(--muted)) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </Box>
        {/* Right column shimmer */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              sx={{
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted-foreground) / 0.08) 50%, hsl(var(--muted)) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  const hasApps = sourceApps.length > 0 || targetApps.length > 0;

  const isSiemSource = sourceCategory === 'siem' || highlightCategory === 'siem';

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>


      <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <svg
          width={svgWidth}
          height={svgHeight + 30}
          viewBox={`0 0 ${svgWidth} ${svgHeight + 30}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="flow-gradient-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="flow-gradient-right" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Flow paths: source → center (only for enabled apps) */}
          {sourceApps.map((app, i) => {
            if (app.isEnabled === false) return null;
            const fromY = getY(i, sourceApps.length);
            return (
              <path
                key={`sl-${i}`}
                d={makePath(leftX + nodeSize / 2 + 4, fromY, centerX - 28, centerY)}
                fill="none"
                stroke="url(#flow-gradient-left)"
                strokeWidth={2.5}
                opacity={0.7}
              />
            );
          })}

          {/* Flow paths: center → target (only for enabled/forwarding apps) */}
          {targetApps.map((app, i) => {
            if (isLoggedIn && app.isEnabled === false) return null;
            const toY = getY(i, targetApps.length);
            return (
              <path
                key={`sr-${i}`}
                d={makePath(centerX + 28, centerY, rightX - nodeSize / 2 - 4, toY)}
                fill="none"
                stroke="url(#flow-gradient-right)"
                strokeWidth={2.5}
                opacity={app.isEnabled === false ? 0.2 : 0.7}
              />
            );
          })}

          {/* Animated particles — for authenticated source apps, or all apps when not logged in */}
          {sourceApps.map((app, i) => {
            if (app.isEnabled === false) return null;
            if (isLoggedIn && !app.hasValidAuth) return null;
            const fromY = getY(i, sourceApps.length);
            const pathD = makePath(leftX + nodeSize / 2 + 4, fromY, centerX - 28, centerY);
            return (
              <g key={`pl-${i}`}>
                <circle r="3" fill="hsl(var(--primary))" opacity="0.6" filter="url(#glow)">
                  <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" path={pathD} />
                </circle>
              </g>
            );
          })}
          {(isLoggedIn ? sourceApps.some(app => app.hasValidAuth && app.isEnabled !== false) : sourceApps.length > 0) && targetApps.map((app, i) => {
            if (isLoggedIn && (!app.hasValidAuth || app.isEnabled === false)) return null;
            const toY = getY(i, targetApps.length);
            const pathD = makePath(centerX + 28, centerY, rightX - nodeSize / 2 - 4, toY);
            return (
              <g key={`pr-${i}`}>
                <circle r="3" fill="hsl(var(--primary))" opacity="0.6" filter="url(#glow)">
                  <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" path={pathD} />
                </circle>
              </g>
            );
          })}

          {/* Column labels */}
          <text x={leftX} y={svgHeight + 16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="600">
            {sourceLabel}
          </text>
          <text x={centerX} y={svgHeight + 16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="600">
            Shuffle
          </text>
          <text x={rightX} y={svgHeight + 16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="600">
            {targetCategory === 'case_management' ? 'Cases (optional)' : (targetMeta?.label || targetCategory)}
          </text>
        </svg>

        {/* Overlay HTML app bubbles */}
        <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: svgWidth, height: svgHeight + 30, pointerEvents: 'none' }}>
          {sourceApps.map((app, i) => {
            const y = getY(i, sourceApps.length);
            return (
              <Box
                key={app.id}
                sx={{
                  position: 'absolute',
                  left: leftX - nodeSize / 2,
                  top: y - nodeSize / 2,
                  pointerEvents: 'auto',
                }}
              >
                <AppBubble app={app} size={nodeSize} highlighted={!!app.isHighlighted} isSample={!isLoggedIn} disabled={app.isEnabled === false} onRemoveApp={handleRemoveApp} onToggleSync={isLoggedIn && highlightCategory ? handleToggleSync : undefined} onVisitApp={handleVisitApp} webhookInfo={app.id === 'webhook-ingestion' ? webhookInfo : undefined} onWebhookToggled={handleWebhookToggled} />
              </Box>
            );
          })}

          {/* Center: Shuffle logo */}
          <Box
            sx={{
              position: 'absolute',
              left: centerX - 24,
              top: centerY - 24,
              pointerEvents: 'auto',
            }}
          >
            <Tooltip
              placement="bottom"
              arrow
              title={
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
                  {['OCSF translation', 'Enrichment', 'Task creation', 'Agentic response'].map((step) => (
                    <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CheckIcon size={13} color={'#4ade80'} />
                      <Typography sx={{ fontSize: '0.75rem', color: 'inherit', lineHeight: 1.3 }}>
                        {step}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              }
            >
              <Box
                component="img"
                src={singulAgentIcon}
                alt="Shuffle Security Agent"
                sx={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '6px' }}
              />
            </Tooltip>
          </Box>

          {targetApps.map((app, i) => {
            const y = getY(i, targetApps.length);
            return (
              <Box
                key={app.id}
                sx={{
                  position: 'absolute',
                  left: rightX - nodeSize / 2,
                  top: y - nodeSize / 2,
                  pointerEvents: 'auto',
                }}
              >
                <AppBubble app={app} size={nodeSize} isSample={!isLoggedIn} side="right" onRemoveApp={handleRemoveApp} onToggleSync={isLoggedIn ? handleToggleForward : undefined} onVisitApp={handleVisitApp} />
              </Box>
            );
          })}

          {/* Show source tools button */}
          <Box
            sx={{
              position: 'absolute',
              left: sourceApps.length === 0 ? leftX - 20 : leftX - 16,
              top: getAddButtonY(sourceApps.length),
              pointerEvents: 'auto',
            }}
          >
            {sourceApps.length === 0 ? (
              <Tooltip title="Browse and add source tools" placement="bottom" arrow>
                <Box
                  onClick={() => setSearchOpen('left')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: '8px',
                    border: '1px dashed hsla(var(--muted-foreground) / 0.3)',
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      borderColor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary))',
                      bgcolor: 'hsla(var(--primary) / 0.08)',
                    },
                  }}
                >
                  <Plus size={12} />
                  Show source tools
                </Box>
              </Tooltip>
            ) : (
              <Tooltip title="Add source tools" placement="bottom" arrow>
                <IconButton
                  onClick={() => setSearchOpen('left')}
                  sx={{
                    width: 32,
                    height: 32,
                    border: '2px dashed hsla(var(--muted-foreground) / 0.3)',
                    color: 'hsl(var(--muted-foreground))',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary))',
                      bgcolor: 'hsla(var(--primary) / 0.08)',
                    },
                  }}
                >
                  <Plus size={16} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Add destination tool button */}
          <Box
            sx={{
              position: 'absolute',
              left: rightX - 16,
              top: getAddButtonY(targetApps.length),
              pointerEvents: 'auto',
            }}
          >
            <Tooltip title="Add destination tools" placement="bottom" arrow>
              <IconButton
                onClick={() => setSearchOpen('right')}
                sx={{
                  width: 32,
                  height: 32,
                  border: '2px dashed hsla(var(--muted-foreground) / 0.3)',
                  color: 'hsl(var(--muted-foreground))',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary))',
                    bgcolor: 'hsla(var(--primary) / 0.08)',
                  },
                }}
              >
                <Plus size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* App search drawer — shared component */}
      <AppSearchDrawer
        open={searchOpen !== null}
        onClose={() => setSearchOpen(null)}
        initialQuery={(() => {
          const raw = searchOpen === 'left'
            ? (sourceMeta?.label || highlightCategory || sourceCategory)
            : (targetMeta?.label || targetCategory);
          if (raw?.toLowerCase() === 'email') return 'Communication';
          if (raw?.toLowerCase() === 'case management') return 'Cases';
          return raw;
        })()}
        title={`Add ${searchOpen === 'left' ? (sourceLabel) : (targetMeta?.label || targetCategory)} Tool`}
        subtitle="Search and authenticate an integration"
        
        priorityCategory={searchOpen === 'left' ? (highlightCategory || sourceCategory) : targetCategory}
        connectionPathApps={(() => {
          const apps = searchOpen === 'left' ? sourceApps : targetApps;
          return apps
            .filter(a => a.id !== 'webhook-ingestion' && a.name !== 'Webhook')
            .map(a => ({ name: a.name, icon: a.icon, hasValidAuth: a.hasValidAuth, isActiveOnly: a.isActiveOnly }));
        })()}
        onAddToCanvas={isLoggedIn ? ({ name: addedAppName, icon: addedIcon, algoliaId }) => {
          const side = searchOpen || 'right';

          // Ensure app exists in allApps so it renders on the canvas
          setAllApps(prev => {
            const exists = prev.some(a => normalizeAppName(a.name) === normalizeAppName(addedAppName));
            if (exists) {
              return prev.map(a =>
                normalizeAppName(a.name) === normalizeAppName(addedAppName)
                  ? { ...a, hasValidAuth: true, icon: addedIcon || a.icon }
                  : a
              );
            }
            return [...prev, { id: algoliaId || addedAppName, name: addedAppName, icon: addedIcon || '', hasValidAuth: true, isActiveOnly: false }];
          });

          // Activate app in background
          if (algoliaId) {
            (async () => {
              try {
                const configRes = await fetch(getApiUrl(`/api/v1/apps/${encodeURIComponent(algoliaId)}/config`), {
                  credentials: 'include', headers: { ...getAuthHeader() },
                });
                if (configRes.ok) {
                  const data = await configRes.json();
                  if (data.id) {
                    await fetch(getApiUrl(`/api/v1/apps/${data.id}/activate`), {
                      method: 'POST', credentials: 'include', headers: { ...getAuthHeader() },
                    });
                  }
                }
              } catch {}
            })();
          }

          if (side === 'left' && highlightCategory) {
            handleToggleSync(addedAppName, true);
            setHiddenApps(prev => { const next = new Set(prev); next.delete(addedAppName.toLowerCase()); return next; });
            import('sonner').then(({ toast }) => toast.success(`${addedAppName.replace(/_/g, ' ')} added to ingestion sources`));
          } else {
            // Optimistic UI: show immediately on the destination column,
            // then push the FULL desired Forward Tickets list to the backend
            // and verify the workflow picked it up (mirrors the
            // /onboarding/automate "Forward" pattern).
            setManualDestApps(prev => { const next = new Set(prev); next.add(normalizeAppName(addedAppName)); return next; });
            setHiddenApps(prev => { const next = new Set(prev); next.delete(addedAppName.toLowerCase()); return next; });
            handleToggleForward(addedAppName, true);
          }
          setSearchOpen(null);
        } : undefined}
        onQuickSelect={!isLoggedIn ? (app) => {
          if (searchOpen) addGuestApp(searchOpen, app);
        } : undefined}
        onSelectOverride={isLoggedIn ? (app) => {
          // Check if this app is already authenticated
          const matchedApp = allApps.find(a => 
            normalizeAppName(a.name) === normalizeAppName(app.name) && a.hasValidAuth
          );
          if (!matchedApp) return false; // Not authenticated — open detail drawer

          // Backfill icon from Algolia if the API didn't provide one
          if (!matchedApp.icon && app.icon) {
            matchedApp.icon = app.icon;
          }

          // Already authenticated: add to the workflow directly
          if (searchOpen === 'left' && highlightCategory) {
            // Add to ingestion sources
            handleToggleSync(matchedApp.name, true);
            // Also unhide if it was hidden
            setHiddenApps(prev => {
              const next = new Set(prev);
              next.delete(matchedApp.name.toLowerCase());
              return next;
            });
            import('sonner').then(({ toast }) => toast.success(`${matchedApp.name.replace(/_/g, ' ')} added to ingestion sources`));
          } else if (searchOpen === 'right') {
            setHiddenApps(prev => {
              const next = new Set(prev);
              next.delete(matchedApp.name.toLowerCase());
              return next;
            });
            // Activate the app in the tenant first (no-op if already active),
            // then push the FULL desired Forward Tickets list and verify.
            (async () => {
              try {
                if (matchedApp.id) {
                  await fetch(getApiUrl(`/api/v1/apps/${matchedApp.id}/activate`), {
                    method: 'POST', credentials: 'include', headers: { ...getAuthHeader() },
                  });
                }
              } catch {}
              handleToggleForward(matchedApp.name, true);
            })();
          }
          setSearchOpen(null);
          return true; // Handled — don't open detail drawer
        } : undefined}
        onDetailClose={isLoggedIn ? async (appName) => {
          // After authenticating, re-check if app is now valid and auto-add
          try {
            const res = await fetch(getApiUrl('/api/v1/apps/authentication'), {
              credentials: 'include',
              headers: getAuthHeader(),
            });
            if (!res.ok) return;
            const result = await res.json();
            const authData: AuthAppEntry[] = result.data || result;
            const deduped = deduplicateAuthApps(authData);
            const match = deduped.find(d => normalizeAppName(d.app.name) === normalizeAppName(appName));
            if (!match?.hasValidAuth) return;

            // Update allApps with the new/updated app
            const newNode: AppNode = {
              id: match.app.id,
              name: match.app.name,
              icon: match.bestImage || match.app.large_image || '',
              hasValidAuth: true,
              isActiveOnly: false,
            };
            setAllApps(prev => {
              const exists = prev.some(a => normalizeAppName(a.name) === normalizeAppName(appName));
              if (exists) {
                return prev.map(a => normalizeAppName(a.name) === normalizeAppName(appName) ? { ...a, ...newNode } : a);
              }
              return [...prev, newNode];
            });

            // Auto-add to the correct side
            const side = searchOpen || 'right';
            if (side === 'left' && highlightCategory) {
              handleToggleSync(match.app.name, true);
              setHiddenApps(prev => { const n = new Set(prev); n.delete(match.app.name.toLowerCase()); return n; });
              const { toast } = await import('sonner');
              toast.success(`${match.app.name.replace(/_/g, ' ')} authenticated & added to ingestion`);
            } else {
              handleToggleForward(match.app.name, true);
              setHiddenApps(prev => { const n = new Set(prev); n.delete(match.app.name.toLowerCase()); return n; });
              const { toast } = await import('sonner');
              toast.success(`${match.app.name.replace(/_/g, ' ')} authenticated & added to forwarding`);
            }
          } catch (err) {
            console.error('[AlluvialDiagram] post-auth check failed:', err);
          }
        } : undefined}
      />


      {!hasApps && (
        <Typography sx={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mt: 2 }}>
          No {sourceMeta?.label} or {targetMeta?.label} tools connected yet.{' '}
          <Box component={Link} to="/onboarding/sources" sx={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
            Connect tools
          </Box>
        </Typography>
      )}
    </Box>
  );
}
