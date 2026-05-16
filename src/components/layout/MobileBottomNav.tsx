import { useLocation, Link } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { Activity, AlertTriangle as WarningAmberIcon, Radar as RadarIcon, Settings as SettingsIcon } from 'lucide-react';
import { useEntityPreference } from '@/hooks/useEntityLabel';

const MobileBottomNavInner = () => {
  const { plural: entityPlural, basePath: entityBasePath } = useEntityPreference();

  const navItems = [
    { label: entityPlural, icon: <WarningAmberIcon sx={{ fontSize: 22 }} />, path: entityBasePath },
    { label: 'Automation', icon: <Activity size={20} />, path: '/usecases' },
    { label: 'Detection', icon: <RadarIcon sx={{ fontSize: 22 }} />, path: '/detection' },
    { label: 'Settings', icon: <SettingsIcon sx={{ fontSize: 22 }} />, path: '/settings' },
  ];

  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <Box
      sx={{
        display: { xs: 'flex', sm: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        bgcolor: 'hsl(var(--card))',
        borderTop: '1px solid hsl(var(--border))',
        justifyContent: 'space-around',
        alignItems: 'center',
        py: 0.75,
        pb: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        backdropFilter: 'blur(12px)',
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <Box
            key={item.path}
            component={Link}
            to={item.path}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.25,
              textDecoration: 'none',
              color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              minWidth: 56,
              py: 0.5,
              borderRadius: 1,
              transition: 'color 0.15s',
            }}
          >
            {item.icon}
            <Typography sx={{ fontSize: '0.6rem', fontWeight: active ? 600 : 400 }}>
              {item.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export const MobileBottomNav = MobileBottomNavInner;
