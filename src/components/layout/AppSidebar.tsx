import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  Avatar,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

const drawerWidth = 260;
const collapsedWidth = 72;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: 'Alerts', icon: <NotificationsActiveIcon />, path: '/dashboard/alerts' },
  { label: 'Cases', icon: <FolderSpecialIcon />, path: '/dashboard/cases' },
  { 
    label: 'Templates', 
    icon: <AssignmentIcon />, 
    children: [
      { label: 'Case Templates', path: '/dashboard/templates/cases' },
      { label: 'Task Templates', path: '/dashboard/templates/tasks' },
    ],
  },
  { label: 'Users', icon: <PeopleIcon />, path: '/dashboard/users' },
  { label: 'Organizations', icon: <BusinessIcon />, path: '/dashboard/organizations' },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const handleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? collapsedWidth : drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? collapsedWidth : drawerWidth,
          boxSizing: 'border-box',
          transition: 'width 0.2s ease',
          overflowX: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          p: 2,
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #22b8cf 0%, #0ea5e9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SecureOps
            </Typography>
          </Box>
        )}
        {collapsed && <SecurityIcon sx={{ color: 'primary.main', fontSize: 28 }} />}
        <IconButton onClick={onToggle} size="small" sx={{ color: 'text.secondary' }}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)' }} />

      <List sx={{ px: 1, py: 2 }}>
        {navItems.map((item) => (
          <Box key={item.label}>
            {item.children ? (
              <>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => handleExpand(item.label)}
                      sx={{
                        borderRadius: 1.5,
                        minHeight: 44,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        px: collapsed ? 1 : 2,
                        '&:hover': {
                          backgroundColor: 'rgba(34, 184, 207, 0.08)',
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: collapsed ? 0 : 40,
                          color: 'text.secondary',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {!collapsed && (
                        <>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }}
                          />
                          {expandedItems.includes(item.label) ? <ExpandLess /> : <ExpandMore />}
                        </>
                      )}
                    </ListItemButton>
                  </ListItem>
                </Tooltip>
                {!collapsed && (
                  <Collapse in={expandedItems.includes(item.label)} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.children.map((child) => (
                        <ListItem key={child.path} disablePadding sx={{ mb: 0.5 }}>
                          <ListItemButton
                            component={Link}
                            to={child.path}
                            sx={{
                              pl: 6,
                              borderRadius: 1.5,
                              minHeight: 36,
                              backgroundColor: isActive(child.path) ? 'rgba(34, 184, 207, 0.12)' : 'transparent',
                              '&:hover': {
                                backgroundColor: 'rgba(34, 184, 207, 0.08)',
                              },
                            }}
                          >
                            <ListItemText
                              primary={child.label}
                              primaryTypographyProps={{
                                fontSize: '0.85rem',
                                fontWeight: isActive(child.path) ? 600 : 400,
                                color: isActive(child.path) ? 'primary.main' : 'text.secondary',
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </>
            ) : (
              <Tooltip title={collapsed ? item.label : ''} placement="right">
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    to={item.path!}
                    sx={{
                      borderRadius: 1.5,
                      minHeight: 44,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      px: collapsed ? 1 : 2,
                      backgroundColor: isActive(item.path) ? 'rgba(34, 184, 207, 0.12)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(34, 184, 207, 0.08)',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 40,
                        color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: '0.9rem',
                          fontWeight: isActive(item.path) ? 600 : 500,
                          color: isActive(item.path) ? 'primary.main' : 'inherit',
                        }}
                      />
                    )}
                  </ListItemButton>
                </ListItem>
              </Tooltip>
            )}
          </Box>
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)' }} />

      <List sx={{ px: 1, py: 1 }}>
        <Tooltip title={collapsed ? 'Settings' : ''} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/dashboard/settings"
              sx={{
                borderRadius: 1.5,
                minHeight: 44,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1 : 2,
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, color: 'text.secondary' }}>
                <SettingsIcon />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary="Settings"
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }}
                />
              )}
            </ListItemButton>
          </ListItem>
        </Tooltip>
      </List>

      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: collapsed ? 0 : 1.5,
            borderRadius: 2,
            backgroundColor: collapsed ? 'transparent' : 'rgba(34, 184, 207, 0.08)',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontSize: '0.875rem',
            }}
          >
            JD
          </Avatar>
          {!collapsed && (
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                John Doe
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                SOC Analyst
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};
