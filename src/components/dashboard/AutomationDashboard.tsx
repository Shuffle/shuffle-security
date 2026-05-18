/**
 * Host wrapper around the Shuffle-Core AutomationDashboard — supplies
 * `orgId` + `displayName` from the host AuthContext.
 */
import { AutomationDashboard as CoreAutomationDashboard } from '@/Shuffle-Core';
import { useAuth } from '@/context/AuthContext';

export const AutomationDashboard = () => {
  const { userInfo } = useAuth();
  return (
    <CoreAutomationDashboard
      orgId={userInfo?.active_org?.id}
      displayName={userInfo?.username}
    />
  );
};

export default AutomationDashboard;
