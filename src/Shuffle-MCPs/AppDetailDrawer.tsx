/**
 * AppDetailDrawer — Shows app detail content (header, auth, MCP chat, API viewer)
 * inside a drawer. Used from alluvial diagrams and the app search drawer.
 *
 * Accepts either an app name (fetches data) or pre-loaded app info.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Download, Forward } from 'lucide-react';
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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AppAuthCard } from '@/Shuffle-MCPs/AppAuthConfig';
import AppMcpChat from '@/Shuffle-MCPs/AppMcpChat';
import ApiCallViewer from '@/Shuffle-MCPs/ApiCallViewer';
import type { AlgoliaSearchApp } from './shuffle-mcp.helpers';
import { useAppAuth } from '@/Shuffle-MCPs/useAppAuth';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
// AuthContext detached — consumers can pass `isAuthenticated` as a prop. Defaults to true.

interface AppInfo {
  name: string;
  description: string;
  large_image?: string;
  categories?: string[];
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

interface AppDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  /** App name to load */
  appName: string | null;
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
}

export default function AppDetailDrawer({
  open,
  onClose,
  appName,
  anchor = 'right',
  width = 520,
  onRefresh,
  onAddToCanvas,
  isAuthenticated = true,
}: AppDetailDrawerProps) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appLoading, setAppLoading] = useState(false);
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [activatedAppId, setActivatedAppId] = useState<string | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);
  const [resolvedAlgoliaId, setResolvedAlgoliaId] = useState<string | null>(null);
  const [authExpanded, setAuthExpanded] = useState(true);
  const [incidentStats, setIncidentStats] = useState<{ ingested: number; forwarded: number } | null>(null);

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
    setResolvedAlgoliaId(null);
    // Always refresh auth when opening a different app
    refreshAuth();

    const normalizedName = appName.toLowerCase().replace(/[\s_\-]+/g, '_');
    const searchName = appName.replace(/_/g, ' ');

    (async () => {
      // Algolia lookup
      let algoliaId: string | null = null;
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        const res = await client.search({
          requests: [{ indexName: 'appsearch', query: searchName, hitsPerPage: 10 }],
        });
        const hits = (res as any)?.results?.[0]?.hits || [];
        const match = hits.find((h: any) =>
          h.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName
        ) || (hits.length > 0 ? hits[0] : null);

        if (match) {
          algoliaId = match.objectID;
          setResolvedAlgoliaId(algoliaId);
          setAppInfo({
            name: match.name || searchName,
            description: match.description || '',
            large_image: match.image_url || '',
            categories: match.categories || [],
          });
        }
      } catch {}

      // Config API — fetch immediately, don't block on activation check
      if (API_CONFIG.apiKey && algoliaId) {
        try {
          const response = await fetch(
            getApiUrl(`/api/v1/apps/${encodeURIComponent(algoliaId)}/config`),
            { credentials: 'include', headers: { ...getAuthHeader() } }
          );
          if (response.ok) {
            const data = await response.json();
            if (data?.name) {
              setAppInfo(prev => ({ ...prev, ...data, large_image: data.large_image || prev?.large_image || '' }));
            }
          }
        } catch {}

        // Fire activation check in background — don't await it
        (async () => {
          try {
            const res = await fetch(getApiUrl('/api/v1/apps'), {
              credentials: 'include',
              headers: { ...getAuthHeader() },
            });
            if (res.ok) {
              const apps = await res.json();
              if (Array.isArray(apps)) {
                const match = apps.find((a: any) =>
                  (a.name || '').toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName && a.activated
                );
                setIsActivated(!!match);
                setActivatedAppId(match?.id || null);
              } else {
                setIsActivated(false);
              }
            } else {
              setIsActivated(false);
            }
          } catch {
            setIsActivated(false);
          }
        })();
      }

      setAppLoading(false);
    })();
  }, [open, appName]);

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
  const authCount = matchingEntries.length;
  const displayName = (appInfo?.name || appName || '').replace(/_/g, ' ');

  const handleActivateToggle = async () => {
    if (!appName || activateLoading) return;
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
        toast.success(`${displayName} deactivated`);
      } else {
        const appId = resolvedAlgoliaId;
        if (!appId) throw new Error('App ID not resolved yet');
        const activateRes = await fetch(getApiUrl(`/api/v1/apps/${appId}/activate`), {
          method: 'GET', credentials: 'include', headers: { ...getAuthHeader() },
        });
        if (!activateRes.ok) throw new Error(`Activate failed (${activateRes.status})`);
        setActivatedAppId(appId);
        toast.success(`${displayName} activated`);
      }
    } catch (err: any) {
      console.error('[Activate] Error:', err);
      toast.error(err?.message || 'Activation failed');
      setIsActivated(wasActivated);
      setActivatedAppId(prevAppId);
    } finally {
      setActivateLoading(false);
    }
  };

  const isLoadingAll = appLoading || (isAuthenticated && appAuthLoading);

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width,
          maxWidth: '100vw',
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: anchor === 'right' ? '1px solid hsl(var(--border))' : 'none',
          borderRight: anchor === 'left' ? '1px solid hsl(var(--border))' : 'none',
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
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, textTransform: 'capitalize' }}>
            {isLoadingAll ? <Skeleton width={140} /> : displayName}
          </Typography>
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
            App configuration
          </Typography>
        </Box>
        <IconButton
          component={Link}
          to={`/apps/${encodeURIComponent(appName || '')}`}
          size="small"
          sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {isLoadingAll ? (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Skeleton variant="circular" width={56} height={56} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width={180} height={28} />
                <Skeleton width={260} height={18} sx={{ mt: 0.5 }} />
              </Box>
            </Box>
            <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
          </Box>
        ) : (
          <>
            {/* App header */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 3,
                  p: 2.5,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <Avatar
                  src={resolvedImage}
                  alt={displayName}
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '14px',
                    backgroundColor: 'hsl(var(--muted))',
                    border: '2px solid',
                    borderColor: hasValidAuth
                      ? 'hsl(var(--severity-low))'
                      : hasAnyAuth
                        ? 'hsl(142 76% 36% / 0.3)'
                        : 'hsl(var(--border))',
                    p: 0.5,
                    '& img': { objectFit: 'contain', borderRadius: '10px' },
                  }}
                >
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>{displayName.charAt(0).toUpperCase()}</Typography>
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: '1rem', textTransform: 'capitalize' }}>
                      {displayName}
                    </Typography>
                    {isAuthenticated && hasValidAuth && (
                      <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label="Verified" size="small"
                        sx={{ height: 22, backgroundColor: 'hsla(142, 76%, 36%, 0.15)', color: 'hsl(var(--severity-low))', fontWeight: 600, fontSize: '0.7rem', '& .MuiChip-icon': { color: 'hsl(var(--severity-low))' } }} />
                    )}
                    {isAuthenticated && !hasValidAuth && hasAnyAuth && (
                      <Chip icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />} label="Pending" size="small"
                        sx={{ height: 22, backgroundColor: 'hsla(38, 92%, 50%, 0.15)', color: 'hsl(var(--severity-medium))', fontWeight: 600, fontSize: '0.7rem', '& .MuiChip-icon': { color: 'hsl(var(--severity-medium))' } }} />
                    )}
                  </Box>

                  {appInfo?.categories && appInfo.categories.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {appInfo.categories.slice(0, 3).map(cat => (
                        <Chip key={cat} label={cat} size="small"
                          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }} />
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Add to canvas button (usecase page) */}
                {onAddToCanvas && appName && (
                  <Button
                    onClick={() => {
                      onAddToCanvas({ name: appName, icon: resolvedImage || '', algoliaId: resolvedAlgoliaId });
                      onClose();
                    }}
                    variant="contained"
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 2, px: 1.5, py: 0.5, minHeight: 0, flexShrink: 0,
                      bgcolor: '#FF6600', '&:hover': { bgcolor: '#e55c00' },
                    }}
                  >
                    + Add
                  </Button>
                )}

                {/* Activate toggle (non-usecase contexts) */}
                {!onAddToCanvas && isAuthenticated && isActivated !== null && (
                  <Button
                    onClick={handleActivateToggle}
                    disabled={activateLoading}
                    variant={isActivated ? 'outlined' : 'contained'}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 2, px: 1.5, py: 0.5, minHeight: 0, flexShrink: 0,
                      ...(isActivated
                        ? { color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))', '&:hover': { borderColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive))', bgcolor: 'hsla(var(--destructive) / 0.08)' } }
                        : { bgcolor: '#FF6600', '&:hover': { bgcolor: '#e55c00' } }),
                    }}
                  >
                    {activateLoading ? '…' : isActivated ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </Box>
            </motion.div>


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
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>
                  Authentication
                </Typography>
                <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 1.5 }}>
                  {isAuthenticated
                    ? authCount > 0
                      ? `${authCount} configuration${authCount > 1 ? 's' : ''} found`
                      : 'No authentication configured yet'
                    : `Connect your ${displayName} account`}
                </Typography>
                {isAuthenticated && algoliaApp && resolvedAlgoliaId && (
                  <AppAuthCard
                    app={algoliaApp}
                    authState={authState}
                    isExpanded={authExpanded}
                    onToggle={() => setAuthExpanded(prev => !prev)}
                    onAuthChange={handleAuthChange}
                    onTestConnection={(appId, authId) => handleTestConnection(appName || appId, authId)}
                    onSaveAuth={(appId, creds) => handleSaveAuth(appId, creds, appName || undefined)}
                    apiAuthEntries={matchingEntries}
                    onRefreshAuth={refreshAuth}
                  />
                )}
              </Box>
            </motion.div>

            {/* MCP Chat */}
            {isAuthenticated && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '0.95rem', mb: 1.5 }}>
                    Try it out
                  </Typography>
                  <AppMcpChat
                    appName={appName || ''}
                    appIcon={resolvedImage}
                    appId={matchingEntries[0]?.app?.id || matchingEntries[0]?.id || appName || ''}
                    categories={appInfo?.categories}
                  />
                </Box>
              </motion.div>
            )}

          </>
        )}
      </Box>
    </Drawer>
  );
}
