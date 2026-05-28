import { ArrowLeft as ArrowBackIcon, CheckCircle2 as CheckCircleIcon, AlertCircle as ErrorOutlineIcon, ExternalLink as OpenInNewIcon, RefreshCw as RefreshIcon, Activity as TimelineIcon, Lock as LockOutlinedIcon, ArrowRight as ArrowForwardIcon } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Skeleton,
  Button,
  Divider,
  Tooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AlgoliaSearchApp } from '@/Shuffle-MCPs';
import { useAppAuth } from '@/Shuffle-MCPs/useAppAuth';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import AppTitleHeader from '@/Shuffle-MCPs/components/AppTitleHeader';
import AppAuthSection from '@/Shuffle-MCPs/components/AppAuthSection';
import TryMcpSection from '@/Shuffle-MCPs/views/TryMcpSection';
import SingulActionsPreview from '@/Shuffle-MCPs/components/SingulActionsPreview';
import { useAuth } from '@/context/AuthContext';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

import ApiCallViewer from '@/Shuffle-MCPs/components/ApiCallViewer';
interface AppInfo {
  name: string;
  description: string;
  large_image?: string;
  categories?: string[];
  /** Algolia objectID — used as the canonical app ID for API calls */
  algoliaId?: string;
  authentication?: {
    type?: string;
    parameters?: { id: string; name: string; description: string; example: string; required: boolean }[];
  };
}

/** Collapsible markdown description — shows 5 lines by default */
const CollapsibleDescription = ({ description }: { description: string }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box
      onClick={() => setExpanded(prev => !prev)}
      sx={{
        maxWidth: 520,
        cursor: 'pointer',
        position: 'relative',
        ...(!expanded && {
          maxHeight: '7.5em', // ~5 lines at 1.5 line-height
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: 'linear-gradient(transparent, hsl(var(--background)))',
            pointerEvents: 'none',
          },
        }),
        '& p': {
          fontSize: '0.8rem',
          lineHeight: 1.5,
          color: 'hsl(var(--muted-foreground))',
          m: 0,
          '&:not(:last-child)': { mb: 1 },
        },
        '& a': { color: 'hsl(var(--primary))', textDecoration: 'underline' },
        '& code': {
          fontSize: '0.72rem',
          fontFamily: "'JetBrains Mono', monospace",
          bgcolor: 'hsl(var(--muted))',
          px: 0.5,
          borderRadius: 0.5,
        },
        '& ul, & ol': { pl: 2, fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' },
        '& h1, & h2, & h3, & h4, & h5, & h6': {
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'hsl(var(--foreground))',
          mt: 1,
          mb: 0.5,
        },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
      {!expanded && (
        <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--primary))', mt: 0.5, fontWeight: 500 }}>
          Show more…
        </Typography>
      )}
    </Box>
  );
};

/** Locked section placeholder for guests */
const GuestLockedSection = ({ title, description, appname }: { title: string; description: string; appname: string }) => (
  <Box
    sx={{
      p: 4,
      borderRadius: 3,
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
      border: '1px solid hsl(var(--border))',
      textAlign: 'center',
    }}
  >
    <LockOutlinedIcon size={36} style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '16px', opacity: 0.5 }} />
    <Typography variant="h6" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, mb: 1 }}>
      {title}
    </Typography>
    <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3, maxWidth: 400, mx: 'auto', lineHeight: 1.6 }}>
      {description}
    </Typography>
    <Button
      component={Link}
      to={`/register?app=${encodeURIComponent(appname)}`}
      variant="contained"
      endIcon={<ArrowForwardIcon />}
      sx={{
        px: 4,
        py: 1.25,
        borderRadius: 2,
        textTransform: 'none',
        fontWeight: 600,
        backgroundColor: '#FF6600',
        '&:hover': { backgroundColor: '#e55c00' },
      }}
    >
      Sign up to configure
    </Button>
  </Box>
);

const AppDetailPage = () => {
  const { appname } = useParams<{ appname: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoActivateRequested = searchParams.get('autoActivate') === '1';
  const [autoActivateTried, setAutoActivateTried] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appLoading, setAppLoading] = useState(true);
  const [appNotFound, setAppNotFound] = useState(false);
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [activatedAppId, setActivatedAppId] = useState<string | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);

  const {
    authStates,
    authenticatedApps,
    loading: appAuthLoading,
    handleAuthChange,
    handleTestConnection,
    handleSaveAuth,
    refreshAuth,
  } = useAppAuth();

  // Fetch app info — Algolia first (public, always works), then config API for auth details
  useEffect(() => {
    const fetchAppInfo = async () => {
      if (!appname) return;
      setAppLoading(true);
      setAppNotFound(false);

      const normalizedName = appname.toLowerCase().replace(/[\s_\-]+/g, '_');
      const searchName = appname.replace(/_/g, ' ');

      // Step 1: Always try Algolia first (public, no auth needed)
      let algoliaMatch: any = null;
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        const res = await client.search({
          requests: [{ indexName: 'appsearch', query: searchName, hitsPerPage: 10 }],
        });
        const hits = (res as any)?.results?.[0]?.hits || [];
        algoliaMatch = hits.find((h: any) =>
          h.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName
        ) || (hits.length > 0 ? hits[0] : null);
      } catch (e) {
        console.warn('Algolia search failed:', e);
      }

      if (algoliaMatch) {
        setAppInfo({
          name: algoliaMatch.name || searchName,
          description: algoliaMatch.description || '',
          large_image: algoliaMatch.image_url || '',
          categories: algoliaMatch.categories || [],
          algoliaId: algoliaMatch.objectID,
        });
      }

      // Step 2: Use the Algolia objectID (app ID) for the config API
      const appId = algoliaMatch?.objectID;
      if (appId) {
        try {
          const response = await fetch(
            getApiUrl(`/api/v1/apps/${encodeURIComponent(appId)}/config`),
            { credentials: 'include', headers: { ...getAuthHeader() } }
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.name) {
              setAppInfo(prev => ({
                ...prev,
                ...data,
                large_image: data.large_image || prev?.large_image || '',
              }));
            }
          }
        } catch {
          // Config API failed, Algolia data is enough
        }
      }

      // Step 3: Fallback — if Algolia didn't return an image (or no match at all),
      // pull the app image from /api/v1/apps so we still render an icon.
      const needsImageFallback = !algoliaMatch || !algoliaMatch.image_url;
      if (needsImageFallback) {
        try {
          const res = await fetch(getApiUrl('/api/v1/apps'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          });
          if (res.ok) {
            const apps = await res.json();
            if (Array.isArray(apps)) {
              const match = apps.find((a: any) =>
                (a.name || '').toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName
              );
              if (match) {
                setAppInfo(prev => ({
                  name: prev?.name || match.name || searchName,
                  description: prev?.description || match.description || '',
                  ...prev,
                  large_image: prev?.large_image || match.large_image || '',
                  categories: prev?.categories?.length ? prev.categories : (match.categories || []),
                }));
                algoliaMatch = algoliaMatch || match;
              }
            }
          }
        } catch {
          // ignore — we'll fall through to the not-found handling below
        }
      }

      // If neither source found anything
      if (!algoliaMatch && !appInfo) {
        if (searchName.length > 1) {
          setAppInfo({ name: searchName, description: '' });
        } else {
          setAppNotFound(true);
        }
      }

      setAppLoading(false);
    };
    fetchAppInfo();
  }, [appname]);

  // Check if app is activated via /api/v1/apps
  useEffect(() => {
    if (!appname || !isAuthenticated) return;
    const normalizedName = appname.toLowerCase().replace(/[\s_\-]+/g, '_');
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/apps'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!res.ok) return;
        const apps = await res.json();
        if (!Array.isArray(apps)) return;
        const match = apps.find((a: any) =>
          (a.name || '').toLowerCase().replace(/[\s_\-]+/g, '_') === normalizedName && a.activated
        );
        setIsActivated(!!match);
        setActivatedAppId(match?.id || null);
      } catch {
        // silently fail
      }
    })();
  }, [appname, isAuthenticated]);

  const handleActivateToggle = async () => {
    if (!appname || activateLoading) return;
    const wasActivated = isActivated;
    const prevAppId = activatedAppId;

    // Optimistic update
    setIsActivated(!wasActivated);
    setActivateLoading(true);

    try {
      if (wasActivated && prevAppId) {
        const res = await fetch(getApiUrl(`/api/v1/apps/${prevAppId}/deactivate`), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!res.ok) throw new Error('Deactivate failed');
        setActivatedAppId(null);
      } else {
        const configId = appInfo?.algoliaId;
        if (!configId) throw new Error('App ID not resolved yet');
        const searchRes = await fetch(getApiUrl(`/api/v1/apps/${encodeURIComponent(configId!)}/config`), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!searchRes.ok) throw new Error('Could not find app');
        const data = await searchRes.json();
        const appId = data.id;
        if (!appId) throw new Error('No app ID');
        const activateRes = await fetch(getApiUrl(`/api/v1/apps/${appId}/activate`), {
          method: 'GET',
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!activateRes.ok) throw new Error('Activate failed');
        setActivatedAppId(appId);
      }
    } catch (e) {
      // Revert optimistic update
      setIsActivated(wasActivated);
      setActivatedAppId(prevAppId);
      toast.error(wasActivated ? 'Deactivation failed' : 'Activation failed', {
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setActivateLoading(false);
    }
  };

  // Auto-activate: when arriving from the Usecases AppSearchDrawer with
  // ?autoActivate=1, fire the Activate button as soon as the app's
  // algoliaId is resolved and we know it is not already activated.
  useEffect(() => {
    if (!autoActivateRequested || autoActivateTried) return;
    if (!isAuthenticated || appLoading) return;
    if (!appInfo?.algoliaId) return;
    // Wait until /api/v1/apps has resolved activation state.
    if (isActivated === null) return;
    if (isActivated) {
      // Already activated — just strip the param so a refresh doesn't loop.
      setAutoActivateTried(true);
      const next = new URLSearchParams(searchParams);
      next.delete('autoActivate');
      setSearchParams(next, { replace: true });
      return;
    }
    setAutoActivateTried(true);
    handleActivateToggle().finally(() => {
      const next = new URLSearchParams(searchParams);
      next.delete('autoActivate');
      setSearchParams(next, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoActivateRequested, autoActivateTried, isAuthenticated, appLoading, appInfo?.algoliaId, isActivated]);



  // Get matching auth entries for this app
  const matchingEntries = useMemo(() => {
    if (!appname || !isAuthenticated) return [];
    return authenticatedApps.filter(
      auth => auth.app?.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === appname.toLowerCase().replace(/[\s_\-]+/g, '_')
    );
  }, [appname, authenticatedApps, isAuthenticated]);

  // Resolve the best image
  const resolvedImage = useMemo(() => {
    if (appInfo?.large_image) return appInfo.large_image;
    for (const entry of matchingEntries) {
      const img = (entry as any).app?.large_image || (entry as any).large_image;
      if (img) return img;
    }
    return '';
  }, [appInfo, matchingEntries]);

  // Build AlgoliaSearchApp-compatible object
  const algoliaApp: AlgoliaSearchApp | null = useMemo(() => {
    if (!appname) return null;
    return {
      objectID: appInfo?.algoliaId || appname,
      name: appname,
      image_url: resolvedImage,
      description: appInfo?.description || '',
      categories: appInfo?.categories || [],
    } as AlgoliaSearchApp;
  }, [appname, appInfo, resolvedImage]);

  // Auth state for this app
  const authState = authStates[appname || ''] || {
    systemId: appname || '',
    status: 'pending' as const,
    credentials: {},
  };

  const hasValidAuth = matchingEntries.some(e => e.validation?.valid === true);
  const hasAnyAuth = matchingEntries.length > 0;
  const authCount = matchingEntries.length;
  // If the app has any authentication entry it must already be present in
  // the tenant — auth cannot exist on an un-activated app. Avoid showing a
  // stale "Activate" button when the app is clearly already in use.
  const effectiveActivated = isActivated === null
    ? (hasAnyAuth ? true : null)
    : (isActivated || hasAnyAuth);

  const [authExpanded, setAuthExpanded] = useState(!hasValidAuth);
  const displayName = (appInfo?.name || appname || '').replace(/_/g, ' ');

  usePageMeta({
    title: displayName ? `${displayName} Integration` : 'App Integration',
    description: appInfo?.description
      ? `${displayName} — ${appInfo.description}. Connect and automate with Shuffle Security.`
      : `Connect ${displayName} to Shuffle Security. Automate workflows, run AI-powered actions, and integrate with 3,000+ tools.`,
    image: resolvedImage || undefined,
    url: `/apps/${appname}`,
    jsonLd: displayName
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: `${displayName} Integration`,
          description: appInfo?.description
            ? `${displayName} — ${appInfo.description}. Connect and automate with Shuffle Security.`
            : `Connect ${displayName} to Shuffle Security and automate workflows.`,
          image: resolvedImage || undefined,
          url: `https://security.shuffler.io/apps/${appname}`,
          brand: { '@type': 'Brand', name: 'Shuffle Security' },
          category: 'Security Integration',
        }
      : undefined,
  });

  const isLoadingAll = appLoading || (isAuthenticated && appAuthLoading) || authLoading;

  if (isLoadingAll) {
    return (
      <Box>
        {!isAuthenticated && <LandingNavbar />}
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto', pt: !isAuthenticated ? 12 : 4 }}>
          <Skeleton variant="rectangular" width={120} height={36} sx={{ mb: 4, borderRadius: 1 }} />
          <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
            <Skeleton variant="circular" width={72} height={72} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width={200} height={32} />
              <Skeleton width={300} height={20} sx={{ mt: 1 }} />
            </Box>
          </Box>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
        </Box>
      </Box>
    );
  }

  if (appNotFound) {
    return (
      <Box>
        {!isAuthenticated && <LandingNavbar />}
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto', pt: !isAuthenticated ? 14 : 4, textAlign: 'center' }}>
          <ErrorOutlineIcon size={56} style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '16px', opacity: 0.5 }} />
          <Typography variant="h5" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, mb: 1.5 }}>
            App not found
          </Typography>
          <Typography variant="body1" sx={{ color: 'hsl(var(--muted-foreground))', mb: 4, maxWidth: 400, mx: 'auto' }}>
            The integration "{appname}" doesn't exist or may have been renamed. Browse our catalog to find what you're looking for.
          </Typography>
          <Button
            component={Link}
            to="/apps"
            variant="contained"
            sx={{
              px: 4,
              py: 1.25,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#FF6600',
              '&:hover': { backgroundColor: '#e55c00' },
            }}
          >
            Browse Integrations
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Show landing navbar for guests */}
      {!isAuthenticated && <LandingNavbar />}

      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: 'auto', pt: !isAuthenticated ? 12 : { xs: 2, md: 4 } }}>
        {/* Back navigation */}
        <Button
          component={Link}
          to="/apps"
          startIcon={<ArrowBackIcon />}
          sx={{
            color: 'hsl(var(--muted-foreground))',
            fontWeight: 500,
            mb: 4,
            '&:hover': {
              color: 'hsl(var(--foreground))',
              background: 'transparent',
            },
          }}
        >
          Back to Apps
        </Button>

        {/* App header */}
        <AppTitleHeader
          name={displayName}
          image={resolvedImage}
          hasValidAuth={hasValidAuth}
          hasAnyAuth={hasAnyAuth}
          isAuthenticated={isAuthenticated}
          categories={appInfo?.categories}
          isActivated={effectiveActivated}
          activateLoading={activateLoading}
          onActivateToggle={handleActivateToggle}
        />

        {/* Description (kept on the page; the drawer shows this inline in the header) */}
        {appInfo?.description && (
          <Box sx={{ mb: 3 }}>
            <CollapsibleDescription description={appInfo.description} />
          </Box>
        )}

        {/* Authentication section */}
        {isAuthenticated ? (
          <Box id="app-auth-section">
            <AppAuthSection
              displayName={displayName}
              algoliaApp={algoliaApp}
              resolvedAlgoliaId={appInfo?.algoliaId || null}
              authState={authState}
              expanded={authExpanded}
              onToggle={() => setAuthExpanded(prev => !prev)}
              authCount={authCount}
              isAuthenticated={isAuthenticated}
              matchingEntries={matchingEntries}
              onAuthChange={handleAuthChange}
              onTestConnection={(appId, authId) => handleTestConnection(appname || appId, authId)}
              onSaveAuth={(appId, creds) => handleSaveAuth(appname || appId, creds)}
              onRefreshAuth={refreshAuth}
            />
          </Box>
        ) : (
          <Box sx={{ mb: 4 }}>
            <GuestLockedSection
              title="Authentication Required"
              description={`Sign up to connect your ${displayName} credentials and start automating workflows.`}
              appname={appname || ''}
            />
          </Box>
        )}

        {/* Try MCP — shared with the App Configuration drawer */}
        {isAuthenticated ? (
          <>
            <TryMcpSection
              appName={appname || ''}
              appIcon={resolvedImage}
              appId={matchingEntries[0]?.app?.id || matchingEntries[0]?.id || appname || ''}
              categories={appInfo?.categories}
            />
            <Box sx={{ mb: 4 }}>
              <ApiCallViewer
                config={{
                  method: 'POST',
                  url: `${(API_CONFIG.baseUrl || '').replace(/\/+$/, '')}/api/v1/mcp`,
                  headers: {
                    'Authorization': `Bearer ${API_CONFIG.apiKey || '<your-api-key>'}`,
                  },
                  body: {
                    jsonrpc: '2.0',
                    method: 'tools/call',
                    params: {
                      tool_name: appname || '',
                      ...(((matchingEntries[0]?.app?.id || appname || '') !== (appname || ''))
                        ? { tool_id: matchingEntries[0]?.app?.id }
                        : {}),
                      input: { text: '<your-prompt>' },
                    },
                  },
                }}
              />
            </Box>
            <SingulActionsPreview appName={appname || ''} appIcon={resolvedImage} categories={appInfo?.categories} />
          </>
        ) : (
          <Box sx={{ mb: 4 }}>
            <GuestLockedSection
              title="AI-Powered Actions"
              description={`Run automated actions with ${displayName} using natural language. Sign up to try it.`}
              appname={appname || ''}
            />
          </Box>
        )}
        {/* Quick info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Divider sx={{ borderColor: 'hsl(var(--border))', my: 3 }} />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box
              sx={{
                flex: 1,
                minWidth: 200,
                p: 2.5,
                borderRadius: 2,
                backgroundColor: 'hsl(var(--muted) / 0.5)',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <Typography variant="overline" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, letterSpacing: 1 }}>
                Auth Type
              </Typography>
              <Typography variant="body1" sx={{ color: 'hsl(var(--foreground))', fontWeight: 500, mt: 0.5, textTransform: 'capitalize' }}>
                {appInfo?.authentication?.type?.replace(/_/g, ' ') || 'API Key'}
              </Typography>
            </Box>
            {isAuthenticated && (
              <Box
                sx={{
                  flex: 1,
                  minWidth: 200,
                  p: 2.5,
                  borderRadius: 2,
                  backgroundColor: 'hsl(var(--muted) / 0.5)',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <Typography variant="overline" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, letterSpacing: 1 }}>
                  Configurations
                </Typography>
                <Typography variant="body1" sx={{ color: 'hsl(var(--foreground))', fontWeight: 500, mt: 0.5 }}>
                  {authCount} active
                </Typography>
              </Box>
            )}
            <Box
              sx={{
                flex: 1,
                minWidth: 200,
                p: 2.5,
                borderRadius: 2,
                backgroundColor: hasValidAuth
                  ? 'hsla(142, 76%, 36%, 0.08)'
                  : 'hsl(var(--muted) / 0.5)',
                border: '1px solid',
                borderColor: hasValidAuth
                  ? 'hsla(142, 76%, 36%, 0.2)'
                  : 'hsl(var(--border))',
              }}
            >
              <Typography variant="overline" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, letterSpacing: 1 }}>
                Status
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: hasValidAuth ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))',
                  fontWeight: 500,
                  mt: 0.5,
                }}
              >
                {isAuthenticated
                  ? hasValidAuth ? 'Connected' : hasAnyAuth ? 'Pending Validation' : 'Not Configured'
                  : 'Sign up to connect'}
              </Typography>
            </Box>
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
};

export default AppDetailPage;
