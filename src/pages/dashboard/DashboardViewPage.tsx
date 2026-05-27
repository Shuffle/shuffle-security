/**
 * Test page for the Shuffle-Core CombinedDashboard surface.
 * Renders CombinedDashboard directly with no wrapper so its own
 * spacing/max-width/padding is exactly what you see.
 */
import { CombinedDashboard } from '@/Shuffle-Core';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const DashboardViewPage = () => {
  const { userInfo, isAuthenticated, isLoading } = useAuth();
  const { resolvedTheme } = useTheme();

  return (
    <CombinedDashboard
      serverside={false}
      isLoaded={!isLoading}
      isLoggedIn={isAuthenticated}
      userdata={userInfo}
      globalUrl={window.location.origin}
      theme={resolvedTheme}
    />
  );
};

export default DashboardViewPage;
