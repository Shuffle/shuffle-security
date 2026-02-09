import { useState, useEffect, useMemo } from 'react';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import TimelineIcon from '@mui/icons-material/Timeline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { AppAuthCard } from '@/components/onboarding/AppAuthConfig';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
import { useAppAuth } from '@/hooks/useAppAuth';
import { API_CONFIG } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

import AppMcpChat from '@/components/app/AppMcpChat';

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

  const {
    authStates,
    authenticatedApps,
    loading: appAuthLoading,
    handleAuthChange,
    handleTestConnection,
    handleSaveAuth,
    refreshAuth,
  } = useAppAuth();

  // Fetch app info — try authenticated first, fall back to search for guests
  useEffect(() => {
    const fetchAppInfo = async () => {
      if (!appname) return;
      setAppLoading(true);
      setAppNotFound(false);

      // Try the config endpoint (works for authenticated users)
      try {
        const headers: Record<string, string> = {};
        if (API_CONFIG.apiKey) {
          headers['Authorization'] = `Bearer ${API_CONFIG.apiKey}`;
        }
        const response = await fetch(`${API_CONFIG.baseUrl}/api/v1/apps/${encodeURIComponent(appname)}/config`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data && data.name) {
            setAppInfo(data);
            setAppLoading(false);
            return;
          }
        }
      } catch {
        // Continue to fallback
      }

      // Fallback: try Algolia search to get basic app info for public view
      try {
        const searchName = appname.replace(/_/g, ' ');
        const algoliaRes = await fetch(
          `https://appsearch.shuffler.io/api/v1/apps/search`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search: searchName }),
          }
        );
        if (algoliaRes.ok) {
          const results = await algoliaRes.json();
          const apps = Array.isArray(results) ? results : results?.hits || [];
          const match = apps.find((a: any) =>
            a.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === appname.toLowerCase().replace(/[\s_\-]+/g, '_')
          );
          if (match) {
            setAppInfo({
              name: match.name || searchName,
              description: match.description || '',
              large_image: match.large_image || match.image_url || '',
              categories: match.categories || [],
            });
            setAppLoading(false);
            return;
          }
        }
      } catch {
        // Continue to basic fallback
      }

      // Final fallback: use the URL param as the name
      const formattedName = appname.replace(/_/g, ' ');
      if (formattedName.length > 1) {
        setAppInfo({ name: formattedName, description: '' });
      } else {
        setAppNotFound(true);
      }
      setAppLoading(false);
    };
    fetchAppInfo();
  }, [appname]);

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
      objectID: appname,
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
      ? `${displayName} — ${appInfo.description}. Connect and automate with Shutdown Security.`
      : `Connect ${displayName} to Shutdown Security. Automate workflows, run AI-powered actions, and integrate with 3,000+ tools.`,
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
                <Typography
                  variant="body2"
                  sx={{
                    color: 'hsl(var(--muted-foreground))',
                    lineHeight: 1.5,
                    maxWidth: 500,
                  }}
                >
                  {appInfo.description}
                </Typography>
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
              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Tooltip title="Refresh" arrow>
                  <IconButton
                    onClick={() => refreshAuth()}
                    sx={{
                      color: 'hsl(var(--muted-foreground))',
                      '&:hover': { color: 'hsl(var(--foreground))' },
                    }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="View agent activity" arrow>
                  <IconButton
                    component={Link}
                    to={`/agent?search=${encodeURIComponent(appname || '')}`}
                    sx={{
                      color: 'hsl(var(--muted-foreground))',
                      '&:hover': { color: 'hsl(var(--primary))' },
                    }}
                  >
                    <TimelineIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="View in catalog" arrow>
                  <IconButton
                    component={Link}
                    to={`/apps?search=${encodeURIComponent(appname || '')}`}
                    sx={{
                      color: 'hsl(var(--muted-foreground))',
                      '&:hover': { color: 'hsl(var(--primary))' },
                    }}
                  >
                    <OpenInNewIcon />
                  </IconButton>
                </Tooltip>
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
              <AppMcpChat
                appName={appname || ''}
                appIcon={resolvedImage}
                appId={matchingEntries[0]?.app?.id || matchingEntries[0]?.id || appname || ''}
                categories={appInfo?.categories}
              />
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
