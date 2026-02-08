import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { AppAuthCard } from '@/components/onboarding/AppAuthConfig';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
import { useAppAuth } from '@/hooks/useAppAuth';
import { API_CONFIG } from '@/config/api';

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

const AppDetailPage = () => {
  const { appname } = useParams<{ appname: string }>();
  const navigate = useNavigate();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appLoading, setAppLoading] = useState(true);

  const {
    authStates,
    authenticatedApps,
    loading: authLoading,
    handleAuthChange,
    handleTestConnection,
    handleSaveAuth,
    refreshAuth,
  } = useAppAuth();

  // Fetch app info
  useEffect(() => {
    const fetchAppInfo = async () => {
      if (!appname || !API_CONFIG.apiKey) return;
      setAppLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/api/v1/apps/${encodeURIComponent(appname)}/config`, {
          headers: { 'Authorization': `Bearer ${API_CONFIG.apiKey}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAppInfo(data);
        } else {
          // Fallback: build minimal info from URL param
          setAppInfo({
            name: appname.replace(/_/g, ' '),
            description: '',
          });
        }
      } catch {
        setAppInfo({
          name: appname.replace(/_/g, ' '),
          description: '',
        });
      } finally {
        setAppLoading(false);
      }
    };
    fetchAppInfo();
  }, [appname]);

  // Get matching auth entries for this app
  const matchingEntries = useMemo(() => {
    if (!appname) return [];
    return authenticatedApps.filter(
      auth => auth.app?.name?.toLowerCase().replace(/[\s_\-]+/g, '_') === appname.toLowerCase().replace(/[\s_\-]+/g, '_')
    );
  }, [appname, authenticatedApps]);

  // Resolve the best image: config API > auth entries > empty
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

  // Overall validation status
  const hasValidAuth = matchingEntries.some(e => e.validation?.valid === true);
  const hasAnyAuth = matchingEntries.length > 0;
  const authCount = matchingEntries.length;

  const displayName = (appInfo?.name || appname || '').replace(/_/g, ' ');

  if (appLoading || authLoading) {
    return (
      <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
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
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: 'auto' }}>
      {/* Back navigation */}
      <Button
        component={Link}
        to="/incidents"
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
        Back
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
              {hasValidAuth && (
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
              {!hasValidAuth && hasAnyAuth && (
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
                sx={{
                  color: 'hsl(var(--foreground))',
                  fontWeight: 600,
                  fontSize: '1.1rem',
                }}
              >
                Authentication
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'hsl(var(--muted-foreground))', mt: 0.25 }}
              >
                {authCount > 0
                  ? `${authCount} configuration${authCount > 1 ? 's' : ''} found`
                  : 'No authentication configured yet'}
              </Typography>
            </Box>
          </Box>

          {algoliaApp && (
            <AppAuthCard
              app={algoliaApp}
              authState={authState}
              isExpanded={!hasValidAuth}
              onToggle={() => {}}
              onAuthChange={handleAuthChange}
              onTestConnection={(appId, authId) => handleTestConnection(appname || appId, authId)}
              onSaveAuth={(appId, creds) => handleSaveAuth(appname || appId, creds)}
              apiAuthEntries={matchingEntries}
            />
          )}
        </Box>
      </motion.div>

      {/* Agent Chat */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h6"
            sx={{
              color: 'hsl(var(--foreground))',
              fontWeight: 600,
              fontSize: '1.1rem',
              mb: 2,
            }}
          >
          Try it out
          </Typography>
          <AppMcpChat appName={appname || ''} appIcon={resolvedImage} appId={matchingEntries[0]?.app?.id || matchingEntries[0]?.id || appname || ''} categories={appInfo?.categories} />
        </Box>
      </motion.div>

      {/* Quick info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <Divider sx={{ borderColor: 'hsl(var(--border))', my: 3 }} />
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
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
              {hasValidAuth ? 'Connected' : hasAnyAuth ? 'Pending Validation' : 'Not Configured'}
            </Typography>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default AppDetailPage;
