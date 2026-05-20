import { useEffect, useState } from 'react';

import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@/context/AuthContext';

/**
 * Full-screen overlay shown when initial /api/v1/getinfo is slow.
 *
 * Appears after a short delay so quick page loads do not flash a spinner,
 * then escalates the wording once the wait gets long (typical of bad
 * connections or backend hiccups). Suppressed on public/marketing routes
 * that do not require a logged-in session — there is no point telling a
 * visitor we are "checking login" when login is not needed to view the page.
 */
const PUBLIC_PATH_PREFIXES = ['/usecases', '/features', '/docs'];
const PUBLIC_EXACT_PATHS = new Set(['/']);

const isPublicRoute = (pathname: string): boolean => {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};

const GlobalLoadingOverlay = () => {
  const { isLoading } = useAuth();
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener('pushstate', update as any);
    window.addEventListener('replacestate', update as any);
    const id = window.setInterval(update, 500);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('pushstate', update as any);
      window.removeEventListener('replacestate', update as any);
      window.clearInterval(id);
    };
  }, []);
  const suppressed = isPublicRoute(pathname);
  const [show, setShow] = useState(false);
  const [elapsedTier, setElapsedTier] = useState(0); // 0=initial, 1=>4s, 2=>10s

  useEffect(() => {
    if (!isLoading || suppressed) {
      setShow(false);
      setElapsedTier(0);
      return;
    }
    const t1 = window.setTimeout(() => setShow(true), 1200);
    const t2 = window.setTimeout(() => setElapsedTier(1), 4000);
    const t3 = window.setTimeout(() => setElapsedTier(2), 10000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isLoading, suppressed]);

  if (!isLoading || !show || suppressed) return null;

  const primary =
    elapsedTier === 0
      ? 'Checking login details…'
      : elapsedTier === 1
        ? 'Still checking login details…'
        : 'This is taking longer than usual';

  const secondary =
    elapsedTier === 2
      ? 'Your connection or the server appears slow. We are still trying to reach Shuffle.'
      : 'Contacting Shuffle to verify your session.';

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: 'hsl(var(--background) / 0.85)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        px: 3,
        textAlign: 'center',
      }}
    >
      <CircularProgress size={44} thickness={4} sx={{ color: '#FF6600' }} />
      <Typography
        sx={{
          fontSize: '0.95rem',
          fontWeight: 600,
          color: 'hsl(var(--foreground))',
        }}
      >
        {primary}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.8rem',
          color: 'hsl(var(--muted-foreground))',
          maxWidth: 360,
          lineHeight: 1.5,
        }}
      >
        {secondary}
      </Typography>
    </Box>
  );
};

export default GlobalLoadingOverlay;
