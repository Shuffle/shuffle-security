import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
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
  Autocomplete,
  TextField,
  InputAdornment,
} from '@mui/material';
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
import SearchIcon from '@mui/icons-material/Search';
import KeyboardCommandKeyIcon from '@mui/icons-material/KeyboardCommandKey';
import { useAuth } from '@/context/AuthContext';

const drawerWidth = 260;
const collapsedWidth = 64;

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

// Mock organizations - this would come from API
const mockOrganizations = [
  { id: '1', name: 'Okiok Parent Org' },
  { id: '2', name: 'Security Team' },
  { id: '3', name: 'Development Org' },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo, logout } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [selectedOrg, setSelectedOrg] = useState(mockOrganizations[0]);

  const handleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getUserInitial = () => {
    if (userInfo?.username) {
      return userInfo.username.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const handleSettingsClick = () => {
    navigate('/dashboard/settings');
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
          backgroundColor: 'hsl(var(--background))',
          borderRight: '1px solid hsl(var(--border))',
        },
      }}
    >
      {/* Header with Logo and Toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          p: 2,
          minHeight: 64,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            backgroundColor: '#f25022',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 18 }}>S</Typography>
        </Box>
        
        <IconButton 
          onClick={onToggle} 
          size="small" 
          sx={{ 
            color: 'hsl(var(--muted-foreground))',
            backgroundColor: collapsed ? 'hsl(var(--muted))' : 'transparent',
            borderRadius: 1,
            '&:hover': {
              backgroundColor: 'hsl(var(--muted))',
            },
          }}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Search Bar */}
      {!collapsed ? (
        <Box sx={{ px: 2, mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'hsl(var(--muted))',
              borderRadius: 1,
              px: 1.5,
              py: 1,
              gap: 1,
            }}
          >
            <SearchIcon sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 20 }} />
            <Typography 
              sx={{ 
                color: 'hsl(var(--muted-foreground))', 
                fontSize: '0.875rem',
                flexGrow: 1,
              }}
            >
              Search
            </Typography>
            <Typography 
              sx={{ 
                color: 'hsl(var(--muted-foreground))', 
                fontSize: '0.75rem',
                fontFamily: 'monospace',
              }}
            >
              Ctrl+K
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Tooltip title="Search (Ctrl+K)" placement="right">
            <IconButton size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Divider sx={{ borderColor: 'hsl(var(--border))', mx: collapsed ? 1 : 2 }} />

      {/* Navigation Items */}
      <List sx={{ px: 1, py: 2, flexGrow: 1 }}>
        {navItems.map((item) => (
          <Box key={item.label}>
            {item.children ? (
              <>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => !collapsed && handleExpand(item.label)}
                      sx={{
                        borderRadius: 1,
                        minHeight: 40,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        px: collapsed ? 1.5 : 2,
                        '&:hover': {
                          backgroundColor: 'hsl(var(--muted))',
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: collapsed ? 0 : 36,
                          color: 'hsl(var(--muted-foreground))',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {!collapsed && (
                        <>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{ 
                              fontSize: '0.875rem', 
                              fontWeight: 500,
                              color: 'hsl(var(--foreground))',
                            }}
                          />
                          {expandedItems.includes(item.label) ? (
                            <ExpandLess sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
                          ) : (
                            <ExpandMore sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
                          )}
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
                              pl: 4,
                              borderRadius: 1,
                              minHeight: 36,
                              backgroundColor: isActive(child.path) ? 'hsl(var(--muted))' : 'transparent',
                              '&:hover': {
                                backgroundColor: 'hsl(var(--muted))',
                              },
                              '&::before': {
                                content: '"•"',
                                marginRight: 1.5,
                                color: 'hsl(var(--muted-foreground))',
                              },
                            }}
                          >
                            <ListItemText
                              primary={child.label}
                              primaryTypographyProps={{
                                fontSize: '0.875rem',
                                fontWeight: isActive(child.path) ? 500 : 400,
                                color: isActive(child.path) 
                                  ? 'hsl(var(--foreground))' 
                                  : 'hsl(var(--muted-foreground))',
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
                      borderRadius: 1,
                      minHeight: 40,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      px: collapsed ? 1.5 : 2,
                      backgroundColor: isActive(item.path) ? 'hsl(var(--muted))' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'hsl(var(--muted))',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 36,
                        color: isActive(item.path) 
                          ? 'hsl(var(--primary))' 
                          : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          fontWeight: isActive(item.path) ? 500 : 400,
                          color: isActive(item.path) 
                            ? 'hsl(var(--foreground))' 
                            : 'hsl(var(--foreground))',
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

      {/* Bottom Section */}
      <Box sx={{ mt: 'auto' }}>
        <Divider sx={{ borderColor: 'hsl(var(--border))', mx: collapsed ? 1 : 2 }} />
        
        {/* Organization Selector */}
        {!collapsed ? (
          <Box sx={{ p: 2 }}>
            <Autocomplete
              value={selectedOrg}
              onChange={(_, newValue) => newValue && setSelectedOrg(newValue)}
              options={mockOrganizations}
              getOptionLabel={(option) => option.name}
              size="small"
              disableClearable
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select organization"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'hsl(var(--muted))',
                      borderRadius: 1,
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: 'transparent',
                      },
                      '&:hover fieldset': {
                        borderColor: 'hsl(var(--border))',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'hsl(var(--primary))',
                      },
                    },
                    '& .MuiInputBase-input': {
                      color: 'hsl(var(--foreground))',
                    },
                  }}
                />
              )}
              PaperComponent={({ children, ...props }) => (
                <Box
                  {...props}
                  sx={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 1,
                    mt: 0.5,
                  }}
                >
                  {children}
                </Box>
              )}
              renderOption={(props, option) => (
                <Box
                  component="li"
                  {...props}
                  sx={{
                    fontSize: '0.875rem',
                    color: 'hsl(var(--foreground))',
                    '&:hover': {
                      backgroundColor: 'hsl(var(--muted))',
                    },
                  }}
                >
                  {option.name}
                </Box>
              )}
            />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Tooltip title={selectedOrg.name} placement="right">
              <IconButton size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                <ExpandMore fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* User Section */}
        <Box sx={{ p: 2, pt: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {getUserInitial()}
            </Avatar>
            {!collapsed && (
              <>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 500, 
                    color: 'hsl(var(--foreground))',
                    flexGrow: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {userInfo?.username || 'User'}
                </Typography>
                <Tooltip title="Settings" placement="top">
                  <IconButton 
                    size="small" 
                    onClick={handleSettingsClick}
                    sx={{ 
                      color: 'hsl(var(--muted-foreground))',
                      '&:hover': {
                        color: 'hsl(var(--foreground))',
                      },
                    }}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};
