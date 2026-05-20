import { useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Auth-gated overlay. Shown ONLY on protected routes (this component is
 * the gate), and shown BEFORE any protected UI renders — children are not
 * mounted until `isLoading` resolves. Public/marketing routes never see
 * this because they do not pass through ProtectedRoute.
 */
const AuthCheckingOverlay = () => {
  const [tier, setTier] = useState(0); // 0=initial, 1=>4s, 2=>10s

  useEffect(() => {
    const t1 = window.setTimeout(() => setTier(1), 4000);
    const t2 = window.setTimeout(() => setTier(2), 10000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const primary =
    tier === 0
      ? 'Checking login details…'
      : tier === 1
        ? 'Still checking login details…'
        : 'This is taking longer than usual';

  const secondary =
    tier === 2
      ? 'Your connection or the server appears slow. We are still trying to reach Shuffle.'
      : 'Contacting Shuffle to verify your session.';

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: 'hsl(var(--background))',
        px: 3,
        textAlign: 'center',
      }}
    >
      <CircularProgress size={44} thickness={4} sx={{ color: '#FF6600' }} />
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
        {primary}
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', maxWidth: 360, lineHeight: 1.5 }}>
        {secondary}
      </Typography>
    </Box>
  );
};

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Allow public access when an authorization token is present alongside a
  // resource selector — `org` for shared incident links, `execution_id` for
  // shared agent run links. Both are pre-authorized via the token in the URL,
  // so the login wall would just block a legitimately scoped page.
  const hasPublicAccess =
    searchParams.has('authorization') &&
    (searchParams.has('org') || searchParams.has('execution_id'));
  if (hasPublicAccess) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <AuthCheckingOverlay />;
  }

  if (!isAuthenticated) {
    const view = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?view=${view}`} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
