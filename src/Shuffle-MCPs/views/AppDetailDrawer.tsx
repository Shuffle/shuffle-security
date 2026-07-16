/**
 * AppDetailDrawer — Shows app detail content (header, auth, MCP chat, API viewer)
 * inside a drawer. Used from alluvial diagrams and the app search drawer.
 *
 * Accepts either an app name (fetches data) or pre-loaded app info.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from '@/Shuffle-MCPs/toast';
import {
  Download,
  Forward,
  CheckCircle2 as CheckCircleIcon,
  X as CloseIcon,
  AlertCircle as ErrorOutlineIcon,
  ExternalLink as OpenInNewIcon,
  Play as PlayArrowIcon
} from 'lucide-react';
import { getDatastoreByCategory, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Skeleton,
  Button,
  Divider,
  Drawer,
  Autocomplete,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { AppAuthCard } from '@/Shuffle-MCPs/components/AppAuthConfig';
import AppMcpChat from '@/Shuffle-MCPs/views/AppMcpChat';
import ApiCallViewer from '@/Shuffle-MCPs/components/ApiCallViewer';
import type { AlgoliaSearchApp } from '@/Shuffle-MCPs/shuffle-mcp.helpers';
import { useAppAuth } from '@/Shuffle-MCPs/useAppAuth';
import { API_CONFIG, getApiUrl, getAuthHeader, getTrackedOrgId } from '@/Shuffle-MCPs/api';
import { fetchAppsViaApiConfig } from '@/Shuffle-MCPs/appsCache';
import { fetchAppConfig } from '@/Shuffle-MCPs/appConfigFetch';
import AppTitleHeader from '@/Shuffle-MCPs/components/AppTitleHeader';
import AppAuthSection from '@/Shuffle-MCPs/components/AppAuthSection';
import TryMcpSection from '@/Shuffle-MCPs/views/TryMcpSection';
import SingulActionsPreview from '@/Shuffle-MCPs/components/SingulActionsPreview';
import type { ShuffleHostProps } from '@/Shuffle-MCPs/host-props';
import { useShuffleMcpTheme } from '@/Shuffle-MCPs/ShuffleMcpThemeProvider';
// AuthContext detached — consumers can pass `isAuthenticated` as a prop. Defaults to true.

interface AppInfo {
  name: string;
  description: string;
  large_image?: string;
  categories?: string[];
  actions?: unknown[];
  authentication?: {
    type?: string;
    parameters?: { id: string; name: string; description: string; example: string; required: boolean }[];
  };
}


/** Collapsible markdown description */
const CollapsibleDescription = ({ description }: { description: string }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box
      onClick={() => setExpanded(prev => !prev)}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        ...(!expanded && {
          maxHeight: '5em',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 32,
            background: 'linear-gradient(transparent, hsl(var(--card)))',
            pointerEvents: 'none',
          },
        }),
        '& p': { fontSize: '0.78rem', lineHeight: 1.5, color: 'hsl(var(--muted-foreground))', m: 0, '&:not(:last-child)': { mb: 1 } },
        '& a': { color: 'hsl(var(--primary))', textDecoration: 'underline' },
        '& code': { fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", bgcolor: 'hsl(var(--muted))', px: 0.5, borderRadius: 0.5 },
        '& ul, & ol': { pl: 2, fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
      {!expanded && (
        <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--primary))', mt: 0.5, fontWeight: 500 }}>Show more…</Typography>
      )}
    </Box>
  );
};

/**
 * Singul standard actions catalog, keyed by lowercase category fragment.
 * Mirrors the canonical action names exposed by https://singul.io —
 * each name becomes the `{action}` segment in `POST /api/{action}`.
 * Fields shown here are starter parameters; the full schema lives on
 * the Singul side and is editable in the curl preview below.
 */

interface AppDetailDrawerProps extends ShuffleHostProps {
  open: boolean;
  onClose: () => void;
  /** App name to load */
  appName: string | null;
  /** Pre-resolved Algolia objectID — bypasses Algolia lookup when provided (e.g. when the
   *  caller already had the hit, like AppSearchDrawer / "Add Ingestion Source"). */
  appId?: string | null;
  /** Anchor side */
  anchor?: 'left' | 'right';
  /** Width in px */
  width?: number;
  /** Called when drawer closes so parent can refresh data */
  onRefresh?: () => void;
  /** When set, replaces the Activate button with "+ Add" and calls this on click */
  onAddToCanvas?: (appInfo: { name: string; icon: string; algoliaId: string | null }) => void;
  /** Whether the current user is authenticated. Defaults to true. */
  isAuthenticated?: boolean;
  /** Host app's currently active org id. If different from the library's tracked org,
   *  an `Org-Id` header is injected into the Singul curl preview. */
  activeOrgId?: string | null;
  /** When true, automatically fire the Activate action once the app is loaded
   *  and not yet activated. Used when the drawer is opened from a flow that
   *  expects the app to be wired up immediately (e.g. Usecases tool picker). */
  autoActivate?: boolean;
}

export default function AppDetailDrawer({
  open,
  onClose,
  appName,
  appId,
  anchor = 'right',
  width = 520,
  onRefresh,
  onAddToCanvas,
  isAuthenticated = true,
  activeOrgId,
  autoActivate = false,
  globalUrl,
  userdata,
  isLoaded,
  isLoggedIn,
  serverside,
  theme,
  colorMode,
}: AppDetailDrawerProps) {
  const themeScope = useShuffleMcpTheme();
  const scopeClassName = themeScope?.scopeClassName ?? (theme === 'dark' ? 'shuffle-mcp-scope dark' : theme === 'light' ? 'shuffle-mcp-scope' : undefined);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  // Start in loading state so the skeleton paints on the very first frame
  // after the drawer mounts/opens — avoids a flash of empty/partial content
  // before the open-effect kicks in and flips this to true.
  const [appLoading, setAppLoading] = useState(true);
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [activatedAppId, setActivatedAppId] = useState<string | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);
  const [resolvedAlgoliaId, setResolvedAlgoliaId] = useState<string | null>(null);
  const [authExpanded, setAuthExpanded] = useState(true);
  // Auto-collapse Authentication section when a valid auth exists; expand otherwise.
  // Only fires when validity flips, so user manual toggles are preserved.
  const lastValidAuthRef = useRef<boolean | null>(null);
  const [incidentStats, setIncidentStats] = useState<{ ingested: number; forwarded: number } | null>(null);
  const [appNotFound, setAppNotFound] = useState(false);

  const {
    authStates,
    authenticatedApps,
    loading: appAuthLoading,
    handleAuthChange,
    handleTestConnection,
    handleSaveAuth,
    refreshAuth,
  } = useAppAuth();

  // Fetch app info and refresh auth when opened with a new app
  useEffect(() => {
    if (!open || !appName) return;
    setAppLoading(true);
    setAppInfo(null);
    setIsActivated(null);
    setAppNotFound(false);
    // Seed from caller-provided id (e.g. AppSearchDrawer already has the Algolia hit)
    setResolvedAlgoliaId(appId || null);
    // Always refresh auth when opening a different app
    refreshAuth();

    const normalizedName = appName.toLowerCase().replace(/[\s_\-]+/g, '_');
    const searchName = appName.replace(/_/g, ' ');

    // Fast path: when the caller already supplied the Algolia objectID we can
    // hit `/api/v1/apps/{id}/config` directly and paint the drawer immediately.
    // Algolia (for image/categories) and the apps list (for activation status)
    // are fired in parallel but don't block the initial render.
    let cancelled = false;

    const configPromise = (API_CONFIG.apiKey && appId)
      ? fetch(
          getApiUrl(`/api/v1/apps/${encodeURIComponent(appId)}/config`),
          { credentials: 'include', headers: { ...getAuthHeader() } }
        )
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null);

    const algoliaPromise = (async () => {
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        const res = await client.search({
          requests: [{ indexName: 'appsearch', query: searchName, hitsPerPage: 10 }],
        });
        const hits = (res as any)?.results?.[0]?.hits || [];
        return (
          (appId && hits.find((h: any) => h.objectID === appId)) ||
          hits.find((h: any) =>
            h.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName
          ) ||
          (hits.length > 0 ? hits[0] : null)
        );
      } catch {
        return null;
      }
    })();

    const appsListPromise = API_CONFIG.apiKey
      ? fetchAppsViaApiConfig().catch(() => null)
      : Promise.resolve(null);

    (async () => {
      let algoliaId: string | null = appId || null;
      let foundMatch = false;

      // Race: paint from whichever resolves first (config on fast path, algolia otherwise).
      const configData = await configPromise;
      if (cancelled) return;
      if (configData?.name) {
        foundMatch = true;
        setAppInfo(prev => ({
          ...(prev || {}),
          ...configData,
          large_image: configData.large_image || prev?.large_image || '',
        }));
        setAppLoading(false);
      }

      // Merge in Algolia results for image/categories (and objectID if we didn't have one)
      const match = await algoliaPromise;
      if (cancelled) return;
      if (match) {
        foundMatch = true;
        if (!algoliaId) {
          algoliaId = match.objectID;
          setResolvedAlgoliaId(match.objectID);
        }
        setAppInfo(prev => ({
          name: prev?.name || match.name || searchName,
          description: prev?.description || match.description || '',
          large_image: prev?.large_image || match.image_url || '',
          categories: prev?.categories?.length ? prev.categories : (match.categories || []),
          actions: prev?.actions,
          authentication: prev?.authentication,
        }));
        setAppLoading(false);
      }

      // If we still have no id, use the apps list to resolve one, then fetch config
      const appsList = await appsListPromise;
      if (cancelled) return;

      if (!algoliaId && Array.isArray(appsList)) {
        const localMatch = appsList.find((a: any) =>
          (a.name || '').toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName
        );
        if (localMatch?.id) {
          foundMatch = true;
          algoliaId = localMatch.id;
          setResolvedAlgoliaId(localMatch.id);
          setAppInfo(prev => prev ?? {
            name: localMatch.name || searchName,
            description: localMatch.description || '',
            large_image: localMatch.large_image || '',
            categories: localMatch.categories || [],
            authentication: localMatch.authentication,
          });
        }
      }

      // Late config fetch only if fast path didn't run (no appId prop)
      if (API_CONFIG.apiKey && algoliaId && !configData) {
        try {
          const response = await fetch(
            getApiUrl(`/api/v1/apps/${encodeURIComponent(algoliaId)}/config`),
            { credentials: 'include', headers: { ...getAuthHeader() } }
          );
          if (response.ok) {
            const data = await response.json();
            if (!cancelled && data?.name) {
              setAppInfo(prev => ({ ...prev, ...data, large_image: data.large_image || prev?.large_image || '' }));
            }
          }
        } catch {}
      }

      if (cancelled) return;

      // Activation status
      if (Array.isArray(appsList)) {
        const activeMatch = appsList.find((a: any) =>
          (a.name || '').toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName && a.activated
        );
        setIsActivated(!!activeMatch);
        setActivatedAppId(activeMatch?.id || null);
      } else {
        setIsActivated(false);
      }

      setAppInfo(prev => prev ?? {
        name: searchName,
        description: '',
        large_image: '',
        categories: [],
      });

      setAppNotFound(!foundMatch);
      setAppLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, appName, appId]);

  // Fetch incident stats for this app
  useEffect(() => {
    if (!open || !appName || !isAuthenticated) {
      setIncidentStats(null);
      return;
    }

    (async () => {
      try {
        const result = await getDatastoreByCategory(DATASTORE_CATEGORIES.INCIDENTS);
        if (!result.success || !result.data) {
          setIncidentStats({ ingested: 0, forwarded: 0 });
          return;
        }

        const normalizedAppName = appName.toLowerCase().replace(/[\s_\-]+/g, '');
        let ingested = 0;
        let forwarded = 0;

        for (const item of result.data) {
          try {
            const parsed = JSON.parse(item.value);
            const productName = (parsed.metadata?.product?.name || '').toLowerCase().replace(/[\s_\-]+/g, '');
            if (productName && productName === normalizedAppName) {
              ingested++;
            }
            // Check if forwarded to this app (via finding_info dest or similar)
            const forwardDest = (parsed.metadata?.product?.forward_name || parsed.forward_target || '').toLowerCase().replace(/[\s_\-]+/g, '');
            if (forwardDest && forwardDest === normalizedAppName) {
              forwarded++;
            }
          } catch {}
        }

        setIncidentStats({ ingested, forwarded });
      } catch {
        setIncidentStats({ ingested: 0, forwarded: 0 });
      }
    })();
  }, [open, appName, isAuthenticated]);

  const handleClose = () => {
    onRefresh?.();
    onClose();
  };

  // Matching auth entries
  const matchingEntries = useMemo(() => {
    if (!appName || !isAuthenticated) return [];
    return authenticatedApps.filter(
      auth => auth.app?.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === appName.toLowerCase().replace(/[\s_\-]+/g, '_')
    );
  }, [appName, authenticatedApps, isAuthenticated]);

  const resolvedImage = useMemo(() => {
    if (appInfo?.large_image) return appInfo.large_image;
    for (const entry of matchingEntries) {
      const img = (entry as any).app?.large_image || (entry as any).large_image;
      if (img) return img;
    }
    return '';
  }, [appInfo, matchingEntries]);

  const algoliaApp: AlgoliaSearchApp | null = useMemo(() => {
    if (!appName) return null;
    return {
      objectID: resolvedAlgoliaId || appName,
      name: appName,
      image_url: resolvedImage,
      description: appInfo?.description || '',
      categories: appInfo?.categories || [],
    } as AlgoliaSearchApp;
  }, [appName, appInfo, resolvedImage, resolvedAlgoliaId]);

  const authState = authStates[appName || ''] || { systemId: appName || '', status: 'pending' as const, credentials: {} };
  const hasValidAuth = matchingEntries.some(e => e.validation?.valid === true);
  const hasAnyAuth = matchingEntries.length > 0;
  // If the app has any authentication entry, it must already exist in the
  // tenant — Shuffle does not allow auth on an un-activated app. Treat as
  // activated even if `/api/v1/apps` didn't surface an `activated:true` row
  // (name-mismatch / cache lag is common for renamed apps like "Gmail" vs
  // "google_mail"). This keeps the header from showing a stale "Activate"
  // button when the sidebar already shows the app as Verified.
  const effectiveActivated = isActivated === null
    ? (hasAnyAuth ? true : null)
    : (isActivated || hasAnyAuth);
  const authCount = matchingEntries.length;
  const displayName = (appInfo?.name || appName || '').replace(/_/g, ' ');

  // Auto-collapse when valid auth appears, auto-expand when it disappears.
  useEffect(() => {
    if (lastValidAuthRef.current === hasValidAuth) return;
    lastValidAuthRef.current = hasValidAuth;
    setAuthExpanded(!hasValidAuth);
  }, [hasValidAuth]);

  // Reset tracker when switching apps so the new app starts from current state.
  useEffect(() => {
    lastValidAuthRef.current = null;
  }, [appName]);

  const handleActivateToggle = async (opts?: { silent?: boolean }) => {
    if (!appName || activateLoading) return;
    const silent = !!opts?.silent;
    const wasActivated = isActivated;
    const prevAppId = activatedAppId;
    setIsActivated(!wasActivated);
    setActivateLoading(true);
    try {
      if (wasActivated && prevAppId) {
        const res = await fetch(getApiUrl(`/api/v1/apps/${prevAppId}/deactivate`), {
          method: 'POST', credentials: 'include', headers: { ...getAuthHeader() },
        });
        if (!res.ok) throw new Error('Deactivate failed');
        setActivatedAppId(null);
        if (!silent) toast.success(`${displayName} deactivated`);
      } else {
        const appId = resolvedAlgoliaId;
        if (!appId) throw new Error('App ID not resolved yet');
        const activateRes = await fetch(getApiUrl(`/api/v1/apps/${appId}/activate`), {
          method: 'GET', credentials: 'include', headers: { ...getAuthHeader() },
        });
        if (!activateRes.ok) throw new Error(`Activate failed (${activateRes.status})`);
        setActivatedAppId(appId);
        if (!silent) toast.success(`${displayName} activated`);
      }
    } catch (err: any) {
      console.error('[Activate] Error:', err);
      if (!silent) toast.error(err?.message || 'Activation failed');
      setIsActivated(wasActivated);
      setActivatedAppId(prevAppId);
    } finally {
      setActivateLoading(false);
    }
  };

  // Auto-activate when the drawer opens with autoActivate=true. Fires once per
  // (open, appName) pair as soon as we know the app is not already activated
  // and the Algolia ID has resolved (required by the activate endpoint).
  // Runs silently (no toast) — the Activate button itself pulses so the user
  // sees the click happening.
  const autoActivateFiredRef = useRef<string | null>(null);
  const [autoActivatePulse, setAutoActivatePulse] = useState(false);
  useEffect(() => {
    if (!open || !autoActivate || !appName) return;
    const key = `${appName}`;
    if (autoActivateFiredRef.current === key) return;
    if (isActivated !== false) return; // null = loading, true = already done
    if (!resolvedAlgoliaId) return;
    if (activateLoading) return;
    autoActivateFiredRef.current = key;
    setAutoActivatePulse(true);
    handleActivateToggle({ silent: true }).finally(() => {
      // Keep the highlight visible briefly after the request resolves so
      // the user can see the button settled into its new state.
      setTimeout(() => setAutoActivatePulse(false), 1200);
    });
  }, [open, autoActivate, appName, isActivated, resolvedAlgoliaId, activateLoading]);

  // Reset auto-activate guard when drawer closes or app changes
  useEffect(() => {
    if (!open) {
      autoActivateFiredRef.current = null;
      setAutoActivatePulse(false);
    }
  }, [open, appName]);


  const isLoadingAll = appLoading || (isAuthenticated && appAuthLoading);

  // Strict, environment-independent sizing — matches AppSearchDrawer. Uses
  // PaperProps (MUI v5 compatible) instead of slotProps.paper, which is
  // silently ignored on v5 hosts and made the drawer collapse to content
  // width when consumed from the published library.
  const drawerWidth = `min(${width}px, 100vw)`;

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={handleClose}
      PaperProps={{
        className: scopeClassName,
        sx: {
          width: drawerWidth,
          minWidth: drawerWidth,
          maxWidth: drawerWidth,
          flex: `0 0 ${drawerWidth}`,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: anchor === 'right' ? '1px solid hsl(var(--border))' : 'none',
          borderRight: anchor === 'left' ? '1px solid hsl(var(--border))' : 'none',
        },
      }}
      sx={{
        zIndex: 9999,
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: `${drawerWidth} !important`,
          minWidth: `${drawerWidth} !important`,
          maxWidth: `${drawerWidth} !important`,
          flex: `0 0 ${drawerWidth} !important`,
        },
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid hsl(var(--border))',
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, textTransform: 'capitalize' }}>
              {appLoading ? <Skeleton width={140} /> : displayName}
            </Typography>
            {!appLoading && typeof appInfo?.actions?.length === 'number' && appInfo.actions.length > 0 && (
              <Chip
                size="small"
                label={`${appInfo.actions.length} action${appInfo.actions.length === 1 ? '' : 's'}`}
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  bgcolor: 'hsl(var(--primary) / 0.12)',
                  color: 'hsl(var(--primary))',
                  border: '1px solid hsl(var(--primary) / 0.3)',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
          </Box>
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
            {appLoading ? <Skeleton width={100} /> : (appNotFound ? 'App not found in catalog' : 'App configuration')}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
        >
          <CloseIcon size={16} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {isLoadingAll ? (
          <Box>
            {/* App header skeleton */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
              <Skeleton variant="rounded" width={56} height={56} sx={{ borderRadius: 2 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" height={24} />
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75 }}>
                  <Skeleton variant="rounded" width={64} height={18} />
                  <Skeleton variant="rounded" width={48} height={18} />
                </Box>
              </Box>
              <Skeleton variant="rounded" width={90} height={32} sx={{ borderRadius: 1 }} />
            </Box>

            {/* Description skeleton */}
            <Skeleton width="100%" height={14} sx={{ mb: 0.5 }} />
            <Skeleton width="90%" height={14} sx={{ mb: 0.5 }} />
            <Skeleton width="70%" height={14} sx={{ mb: 3 }} />

            {/* Authentication section skeleton */}
            <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 2, mb: 2 }} />

            {/* Try individual actions skeleton */}
            <Skeleton width={160} height={20} sx={{ mb: 1.5 }} />
            <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
              {[92, 76, 108, 84, 96].map((w, i) => (
                <Skeleton key={i} variant="rounded" width={w} height={28} sx={{ borderRadius: 999 }} />
              ))}
            </Box>
            <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
          </Box>

        ) : (
          <>
            {/* App header */}
            <AppTitleHeader
              name={displayName}
              image={resolvedImage}
              hasValidAuth={hasValidAuth}
              hasAnyAuth={hasAnyAuth}
              isAuthenticated={isAuthenticated}
              categories={appInfo?.categories}
              isActivated={onAddToCanvas ? null : effectiveActivated}
              activateLoading={activateLoading}
              onActivateToggle={() => handleActivateToggle()}
              highlightActivate={autoActivatePulse}
              onAdd={onAddToCanvas && appName ? () => {
                onAddToCanvas({ name: appName, icon: resolvedImage || '', algoliaId: resolvedAlgoliaId });
                onClose();
              } : undefined}
              globalUrl={globalUrl}
              userdata={userdata}
              isLoaded={isLoaded}
              isLoggedIn={isLoggedIn}
              serverside={serverside}
              theme={theme}
              colorMode={colorMode}
            />

            {/* Incident stats */}
            {isAuthenticated && incidentStats && incidentStats.ingested > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
                <Box sx={{
                  display: 'flex',
                  gap: 2,
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--muted) / 0.3)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Download size={14} style={{ color: 'hsl(var(--primary))' }} />
                    <Box>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1 }}>
                        {incidentStats.ingested}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
                        Incidents ingested
                      </Typography>
                    </Box>
                  </Box>
                  {incidentStats.forwarded > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, pl: 2, borderLeft: '1px solid hsl(var(--border))' }}>
                      <Forward size={14} style={{ color: 'hsl(var(--severity-low))' }} />
                      <Box>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1 }}>
                          {incidentStats.forwarded}
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
                          Forwarded
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </motion.div>
            )}

            {/* Authentication section */}
            <Box id="app-auth-section">
              <AppAuthSection
                displayName={displayName}
                algoliaApp={algoliaApp}
                resolvedAlgoliaId={resolvedAlgoliaId}
                authState={authState}
                expanded={authExpanded}
                onToggle={() => setAuthExpanded(prev => !prev)}
                authCount={authCount}
                isAuthenticated={isAuthenticated}
                matchingEntries={matchingEntries}
                onAuthChange={handleAuthChange}
                onTestConnection={(appId, authId) => handleTestConnection(appName || appId, authId)}
                onSaveAuth={(appId, creds) => handleSaveAuth(appId, creds, appName || undefined)}
                onRefreshAuth={refreshAuth}
                globalUrl={globalUrl}
                userdata={userdata}
                isLoaded={isLoaded}
                isLoggedIn={isLoggedIn}
                serverside={serverside}
                theme={theme}
                colorMode={colorMode}
              />
            </Box>

            {/* MCP Chat + individual actions */}
            {isAuthenticated && (
              <>
                <TryMcpSection
                  appName={appName || ''}
                  appIcon={resolvedImage}
                  appId={matchingEntries[0]?.app?.id || matchingEntries[0]?.id || appName || ''}
                  categories={appInfo?.categories}
                  globalUrl={globalUrl}
                  userdata={userdata}
                  isLoaded={isLoaded}
                  isLoggedIn={isLoggedIn}
                  serverside={serverside}
                  theme={theme}
                  colorMode={colorMode}
                />
                <SingulActionsPreview
                  appName={appName || ''}
                  appIcon={resolvedImage}
                  categories={appInfo?.categories}
                  activeOrgId={activeOrgId}
                  globalUrl={globalUrl}
                  userdata={userdata}
                  isLoaded={isLoaded}
                  isLoggedIn={isLoggedIn}
                  serverside={serverside}
                  theme={theme}
                  colorMode={colorMode}
                />
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
