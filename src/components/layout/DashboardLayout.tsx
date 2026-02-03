import { useState, useEffect, ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { AppSidebar } from './AppSidebar';

const drawerWidth = 260;
const collapsedWidth = 64;
const SIDEBAR_STATE_KEY = 'shuffle-security-sidebar-collapsed';

interface DashboardLayoutProps {
  children?: ReactNode;
  defaultCollapsed?: boolean;
}

export const DashboardLayout = ({ children, defaultCollapsed }: DashboardLayoutProps) => {
  const location = useLocation();
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

  // Only persist state when NOT on onboarding page
  useEffect(() => {
    if (!isOnboarding) {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(sidebarCollapsed));
    }
  }, [sidebarCollapsed, isOnboarding]);

  return (
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
        }}
      >
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, width: '100%', maxWidth: '100%' }}>
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
};
