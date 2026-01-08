import { useState, ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { AppSidebar } from './AppSidebar';

const drawerWidth = 260;
const collapsedWidth = 64;

interface DashboardLayoutProps {
  children?: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
