/**
 * Test page for the Shuffle-Core CombinedDashboard surface.
 * Mounts CombinedDashboard with the exact same host-prop contract used
 * everywhere else (serverside, isLoaded, isLoggedIn, userdata, globalUrl,
 * theme) so we can validate it in isolation at /dashboard-view.
 */
import { Box } from '@mui/material';
import { CombinedDashboard } from '@/Shuffle-Core';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { getApiBaseUrl } from '@/Shuffle-Core/api';

const DashboardViewPage = () => {
  const { userInfo, isLoaded, isLoggedIn } = useAuth();
  const { resolvedTheme } = useTheme();

  return (
    <Box sx={{ p: 3 }}>
      <CombinedDashboard
        serverside={false}
        isLoaded={isLoaded}
        isLoggedIn={isLoggedIn}
        userdata={userInfo}
        globalUrl={getApiBaseUrl()}
        theme={resolvedTheme}
      />
    </Box>
  );
};

export default DashboardViewPage;
