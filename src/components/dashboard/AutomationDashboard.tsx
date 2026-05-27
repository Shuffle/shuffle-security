/**
 * Host wrapper around the Shuffle-Core AutomationDashboard — supplies
 * `orgId` + `displayName` from the host AuthContext, forwards the host's
 * resolved color scheme so the charts follow light/dark mode, and passes
 * through any additional props (e.g. `headerLeft`).
 */
import type { ComponentProps } from 'react';
import { API_CONFIG, AutomationDashboard as CoreAutomationDashboard } from '@/Shuffle-Core';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

type Props = Omit<ComponentProps<typeof CoreAutomationDashboard>, 'orgId' | 'displayName'>;

export const AutomationDashboard = (props: Props) => {
  const { userInfo } = useAuth();
  // Pass the already-resolved theme ('light' | 'dark') rather than 'system'
  // so the Shuffle-Core charts honor the host's current scheme instead of
  // defaulting to dark.
  const { resolvedTheme } = useTheme();
  return (
    <CoreAutomationDashboard
      orgId={userInfo?.active_org?.id}
      displayName={userInfo?.username}
      globalUrl={API_CONFIG.baseUrl}
      theme={resolvedTheme}
      {...props}
    />
  );
};

export default AutomationDashboard;
