/**
 * Host wrapper around the Shuffle-Core DashboardOverview — forwards the
 * host's resolved color scheme so the charts honor light/dark mode instead
 * of falling back to the library default ("dark"), and wires the inline
 * UsecaseDrawer so the Security Operations setup CTAs open the relevant
 * usecase in-place instead of redirecting to /usecases.
 */
import { useState, type ComponentProps } from 'react';
import { API_CONFIG, DashboardOverview as CoreDashboardOverview, UsecaseDrawer } from '@/Shuffle-Core';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

type Props = ComponentProps<typeof CoreDashboardOverview>;

export const DashboardOverview = (props: Props) => {
  const { resolvedTheme } = useTheme();
  const { userInfo } = useAuth();
  const [openUsecaseId, setOpenUsecaseId] = useState<string | null>(null);

  return (
    <>
      <CoreDashboardOverview
        globalUrl={API_CONFIG.baseUrl}
        theme={resolvedTheme}
        onOpenUsecase={(flowId) => setOpenUsecaseId(flowId)}
        {...props}
      />
      <UsecaseDrawer
        open={openUsecaseId !== null}
        onClose={() => setOpenUsecaseId(null)}
        flowId={openUsecaseId}
        globalUrl={API_CONFIG.baseUrl}
        userdata={userInfo as any}
        isLoaded={true}
        isLoggedIn={!!userInfo}
        theme={resolvedTheme}
      />
    </>
  );
};

export default DashboardOverview;
