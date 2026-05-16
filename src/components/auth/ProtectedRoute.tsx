import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

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
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!isAuthenticated) {
    const view = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?view=${view}`} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
