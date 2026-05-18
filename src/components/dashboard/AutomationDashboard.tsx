/**
 * Host wrapper around the Shuffle-Core AutomationDashboard — supplies
 * `orgId` + `displayName` from the host AuthContext and forwards any
 * additional props (e.g. `headerLeft`).
 */
import type { ComponentProps } from 'react';
import { AutomationDashboard as CoreAutomationDashboard } from '@/Shuffle-Core';
import { useAuth } from '@/context/AuthContext';

type Props = Omit<ComponentProps<typeof CoreAutomationDashboard>, 'orgId' | 'displayName'>;

export const AutomationDashboard = (props: Props) => {
  const { userInfo } = useAuth();
  return (
    <CoreAutomationDashboard
      orgId={userInfo?.active_org?.id}
      displayName={userInfo?.username}
      {...props}
    />
  );
};

export default AutomationDashboard;
