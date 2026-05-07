import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import TimelineIcon from '@mui/icons-material/Timeline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { AppAuthCard } from '@/Shuffle-MCPs/AppAuthConfig';
import type { AlgoliaSearchApp } from '@/Shuffle-MCPs';
import { useAppAuth } from '@/Shuffle-MCPs/useAppAuth';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { useAuth } from '@/context/AuthContext';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

import AppMcpChat from '@/Shuffle-MCPs/AppMcpChat';
import ApiCallViewer from '@/Shuffle-MCPs/ApiCallViewer';
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
    <LockOutlinedIcon sx={{ fontSize: 36, color: 'hsl(var(--muted-foreground))', mb: 2, opacity: 0.5 }} />
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

  const [authExpanded, setAuthExpanded] = useState(!hasValidAuth);
  const displayName = (appInfo?.name || appname || '').replace(/_/g, ' ');

  usePageMeta({
    title: displayName ? `${displayName} Integration` : 'App Integration',
    description: appInfo?.description
      ? `${displayName} — ${appInfo.description}. Connect and automate with Shuffle Security.`
      : `Connect ${displayName} to Shuffle Security. Automate workflows, run AI-powered actions, and integrate with 3,000+ tools.`,
    image: resolvedImage || undefined,
    url: `/apps/${appname}`,
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
          <ErrorOutlineIcon sx={{ fontSize: 56, color: 'hsl(var(--muted-foreground))', mb: 2, opacity: 0.5 }} />
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              mb: 4,
              p: 3,
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
              border: '1px solid hsl(var(--border))',
            }}
          >
            <Avatar
              src={resolvedImage}
              alt={displayName}
              sx={{
                width: 72,
                height: 72,
                borderRadius: '16px',
                backgroundColor: 'hsl(var(--muted))',
                border: '2px solid',
                borderColor: hasValidAuth
                  ? 'hsl(var(--severity-low))'
                  : hasAnyAuth
                    ? 'hsl(142 76% 36% / 0.3)'
                    : 'hsl(var(--border))',
                p: 0.5,
                '& img': {
                  objectFit: 'contain',
                  borderRadius: '12px',
                },
              }}
            >
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {displayName.charAt(0).toUpperCase()}
              </Typography>
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography
                  variant="h5"
                  sx={{
                    color: 'hsl(var(--foreground))',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                  }}
                >
                  {displayName}
                </Typography>
                {isAuthenticated && hasValidAuth && (
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                    label="Verified"
                    size="small"
                    sx={{
                      height: 24,
                      backgroundColor: 'hsla(142, 76%, 36%, 0.15)',
                      color: 'hsl(var(--severity-low))',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      '& .MuiChip-icon': { color: 'hsl(var(--severity-low))' },
                    }}
                  />
                )}
                {isAuthenticated && !hasValidAuth && hasAnyAuth && (
                  <Chip
                    icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />}
                    label="Pending"
                    size="small"
                    sx={{
                      height: 24,
                      backgroundColor: 'hsla(38, 92%, 50%, 0.15)',
                      color: 'hsl(var(--severity-medium))',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      '& .MuiChip-icon': { color: 'hsl(var(--severity-medium))' },
                    }}
                  />
                )}
              </Box>

              {appInfo?.description && (
                <CollapsibleDescription description={appInfo.description} />
              )}

              {appInfo?.categories && appInfo.categories.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                  {appInfo.categories.slice(0, 4).map((cat) => (
                    <Chip
                      key={cat}
                      label={cat}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 500,
                        backgroundColor: 'hsl(var(--muted))',
                        color: 'hsl(var(--muted-foreground))',
                        textTransform: 'capitalize',
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* Action buttons — only for authenticated users */}
            {isAuthenticated && (
              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
                {isActivated !== null && (
                  <Button
                    onClick={handleActivateToggle}
                    disabled={activateLoading}
                    variant={isActivated ? 'outlined' : 'contained'}
                    size="small"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      borderRadius: 2,
                      px: 2,
                      py: 0.75,
                      minHeight: 0,
                      ...(isActivated
                        ? {
                            color: 'hsl(var(--muted-foreground))',
                            borderColor: 'hsl(var(--border))',
                            '&:hover': {
                              borderColor: 'hsl(var(--destructive))',
                              color: 'hsl(var(--destructive))',
                              bgcolor: 'hsla(var(--destructive) / 0.08)',
                            },
                          }
                        : {
                            bgcolor: '#FF6600',
                            '&:hover': { bgcolor: '#e55c00' },
                          }),
                    }}
                  >
                    {activateLoading ? '…' : isActivated ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </motion.div>

        {/* Authentication section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography
                  variant="h6"
                  sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '1.1rem' }}
                >
                  Authentication
                </Typography>
                <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
                  {isAuthenticated
                    ? authCount > 0
                      ? `${authCount} configuration${authCount > 1 ? 's' : ''} found`
                      : 'No authentication configured yet'
                    : `Connect your ${displayName} account to get started`}
                </Typography>
              </Box>
            </Box>

            {isAuthenticated && algoliaApp ? (
              <AppAuthCard
                app={algoliaApp}
                authState={authState}
                isExpanded={authExpanded}
                onToggle={() => setAuthExpanded(prev => !prev)}
                onAuthChange={handleAuthChange}
                onTestConnection={(appId, authId) => handleTestConnection(appname || appId, authId)}
                onSaveAuth={(appId, creds) => handleSaveAuth(appname || appId, creds)}
                apiAuthEntries={matchingEntries}
                onRefreshAuth={refreshAuth}
              />
            ) : !isAuthenticated ? (
              <GuestLockedSection
                title="Authentication Required"
                description={`Sign up to connect your ${displayName} credentials and start automating workflows.`}
                appname={appname || ''}
              />
            ) : null}
          </Box>
        </motion.div>

        {/* Agent Chat / Try it out */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '1.1rem', mb: 2 }}
            >
              Try it out
            </Typography>

            {isAuthenticated ? (
              <>
                <AppMcpChat
                  appName={appname || ''}
                  appIcon={resolvedImage}
                  appId={matchingEntries[0]?.app?.id || matchingEntries[0]?.id || appname || ''}
                  categories={appInfo?.categories}
                />
                <Box sx={{ mt: 2 }}>
                  <ApiCallViewer
                    config={{
                      method: 'POST',
                      url: `${getApiUrl(`/api/v1/apps/${encodeURIComponent(appname || '')}/mcp`)}`,
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_CONFIG.apiKey || '<your-api-key>'}`,
                      },
                      body: {
                        jsonrpc: '2.0',
                        id: '<request-id>',
                        method: 'tools/call',
                        params: {
                          tool_name: appname || '',
                          tool_id: matchingEntries[0]?.app?.id || appname || '',
                          input: { text: '<your-prompt>' },
                        },
                      },
                    }}
                  />
                </Box>
              </>
            ) : (
              <GuestLockedSection
                title="AI-Powered Actions"
                description={`Run automated actions with ${displayName} using natural language. Sign up to try it.`}
                appname={appname || ''}
              />
            )}
          </Box>
        </motion.div>

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
