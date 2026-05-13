import { useState, useEffect, ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box, Alert, Button } from '@mui/material';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { AppDetailProvider, useAppDetail } from '@/Shuffle-MCPs/AppDetailContext';
import AppDetailDrawer from '@/components/shared/AppDetailDrawer';
import AgentHandoffWatcher from '@/components/agent/AgentHandoffWatcher';
import GlobalAgentDrawer from '@/components/agent/GlobalAgentDrawer';
import { useAuth } from '@/context/AuthContext';
import { loadAgentToolsFromDatastore } from '@/lib/agentTools';

const drawerWidth = 260;
const collapsedWidth = 64;
const SIDEBAR_STATE_KEY = 'shuffle-security-sidebar-collapsed';

interface DashboardLayoutProps {
  children?: ReactNode;
  defaultCollapsed?: boolean;
}

const GlobalAppDetailDrawer = () => {
  const { currentAppName, isOpen, closeApp } = useAppDetail();
  return (
    <AppDetailDrawer
      open={isOpen}
      onClose={closeApp}
      appName={currentAppName}
    />
  );
};

export const DashboardLayout = ({ children, defaultCollapsed }: DashboardLayoutProps) => {
  const location = useLocation();
  const { orgMismatchWarning, dismissOrgMismatch, setActiveOrg, userInfo } = useAuth();
  const isOnboarding = location.pathname === '/onboarding';
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Always collapse on onboarding page regardless of saved state
    if (isOnboarding || defaultCollapsed) return true;
    const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
    return saved === 'true';
  });

  // Force collapse when navigating to onboarding
  useEffect(() => {
    if (isOnboarding) {
      setSidebarCollapsed(true);
    }
  }, [isOnboarding]);

  // Allow other parts of the app (e.g. demo mode startup) to request the
  // sidebar be collapsed for more screen real-estate. Dispatched as a
  // window event so callers do not need access to this component's state.
  useEffect(() => {
    const onCollapse = () => setSidebarCollapsed(true);
    window.addEventListener('shuffle:sidebar-collapse', onCollapse);
    return () => window.removeEventListener('shuffle:sidebar-collapse', onCollapse);
  }, []);

  // Only persist state when NOT on onboarding page
  useEffect(() => {
    if (!isOnboarding) {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(sidebarCollapsed));
    }
  }, [sidebarCollapsed, isOnboarding]);

  // Hydrate the agent-tools cache from the datastore once we have an active
  // org. This keeps "Assigned tools" in sync across browsers/devices instead
  // of being a per-browser localStorage list.
  useEffect(() => {
    if (!userInfo?.active_org?.id) return;
    loadAgentToolsFromDatastore();
  }, [userInfo?.active_org?.id]);

  return (
    <AppDetailProvider>
      <Box sx={{ display: 'flex', height: '100vh', backgroundColor: 'hsl(var(--background))', width: '100%' }}>
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            minWidth: 0,
            width: '100%',
            transition: 'margin 0.2s ease',
            marginLeft: { 
              xs: 0, 
              sm: `${(sidebarCollapsed ? collapsedWidth : drawerWidth) + 20}px` 
            },
            overflowY: 'auto',
            overflowX: 'hidden',
            // Add bottom padding on mobile for the bottom nav
            pb: { xs: '80px', sm: 0 },
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, width: '100%', maxWidth: '100%' }}>
            {orgMismatchWarning && (
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                action={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {userInfo?.active_org?.id && (
                      <Button color="inherit" size="small" variant="outlined" onClick={() => setActiveOrg(userInfo.active_org!.id)}>
                        Change back
                      </Button>
                    )}
                    <Button color="inherit" size="small" onClick={dismissOrgMismatch}>
                      Dismiss
                    </Button>
                    <Button color="warning" size="small" variant="outlined" onClick={() => window.location.reload()}>
                      Refresh
                    </Button>
                  </Box>
                }
              >
                Your active tenant has changed in another tab. Refresh to sync.
              </Alert>
            )}
            {children || <Outlet />}
          </Box>
        </Box>
        <MobileBottomNav />
        <GlobalAppDetailDrawer />
        {/* Global watcher: surfaces stuck AI Agent handoffs (approvals + open
            questions) as toasts on every page. Polls once per minute via the
            shared useAgentNotifications query. */}
        <AgentHandoffWatcher />
        {/* Global Agent (Run / Permissions / Local LLM) drawer — mounted once
            so any page can open it via openAgentDrawer(tab). */}
        <GlobalAgentDrawer />
      </Box>
    </AppDetailProvider>
  );
};
