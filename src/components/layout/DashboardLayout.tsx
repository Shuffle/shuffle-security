import { useState, useEffect, ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (defaultCollapsed !== undefined) return defaultCollapsed;
    const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'hsl(var(--background))' }}>
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
          minHeight: '100vh',
          transition: 'margin 0.2s ease',
          marginLeft: `${(sidebarCollapsed ? collapsedWidth : drawerWidth) + 20}px`,
        }}
      >
        <Box sx={{ flexGrow: 1, p: 3 }}>
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
};
