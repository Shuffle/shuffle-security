import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  Tooltip,
  IconButton,
  Collapse,
  Autocomplete,
  TextField,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
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
  { 
    label: 'Cases', 
    icon: <FolderSpecialIcon />,
    path: '/dashboard/cases',
    children: [
      { label: 'Templates', path: '/dashboard/templates' },
    ],
  },
  { label: 'Users', icon: <PeopleIcon />, path: '/dashboard/users' },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// Region flag mapping based on region_url
const getRegionFlag = (regionUrl?: string): { flag: string; code: string } => {
  if (!regionUrl) return { flag: '🌐', code: '' };
  
  const url = regionUrl.toLowerCase();
  
  // Check US regions first (california, us.)
  if (url.includes('california') || url.includes('us.') || url.includes('us-')) {
    return { flag: '🇺🇸', code: 'US' };
  }
  // EU-2 region
  if (url.includes('eu-2') || url.includes('eu2')) {
    return { flag: '🇪🇺', code: 'EU-2' };
  }
  // Canada
  if (url.includes('ca.') || url.includes('canada')) {
    return { flag: '🇨🇦', code: 'CA' };
  }
  // Australia
  if (url.includes('au.') || url.includes('aus') || url.includes('australia')) {
    return { flag: '🇦🇺', code: 'AUS' };
  }
  // Default to UK for shuffler.io
  return { flag: '🇬🇧', code: 'UK' };
};

// Sort orgs with parent-child hierarchy
const sortOrgsWithHierarchy = (orgs: Array<{ id: string; name: string; creator_org?: string; region_url?: string }>) => {
  const orgMap = new Map(orgs.map(org => [org.id, org]));
  const result: Array<{ org: typeof orgs[0]; level: number }> = [];
  const processed = new Set<string>();

  // Find root orgs (no creator_org or creator_org not in list)
  const rootOrgs = orgs.filter(org => !org.creator_org || !orgMap.has(org.creator_org));
  
  const addOrgWithChildren = (org: typeof orgs[0], level: number) => {
    if (processed.has(org.id)) return;
    processed.add(org.id);
    result.push({ org, level });
    
    // Find children
    const children = orgs.filter(o => o.creator_org === org.id);
    children.sort((a, b) => a.name.localeCompare(b.name));
    children.forEach(child => addOrgWithChildren(child, level + 1));
  };

  // Sort root orgs alphabetically and process
  rootOrgs.sort((a, b) => a.name.localeCompare(b.name));
  rootOrgs.forEach(org => addOrgWithChildren(org, 0));

  // Add any remaining orgs that weren't processed (orphans with missing parents)
  orgs.forEach(org => {
    if (!processed.has(org.id)) {
      result.push({ org, level: 1 }); // Treat as sub-org level
    }
  });

  return result;
};

export const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo, setActiveOrg } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Cases']);

  const organizations = userInfo?.orgs || [];
  const sortedOrgs = sortOrgsWithHierarchy(organizations);
  const selectedOrg = userInfo?.active_org || organizations[0];

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

  const handleOrgChange = async (org: { id: string; name: string } | null) => {
    if (org) {
      await setActiveOrg(org.id);
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 10,
        top: '2.5%',
        height: '95%',
        width: collapsed ? collapsedWidth : drawerWidth,
        backgroundColor: 'hsl(var(--card))',
        borderRadius: 2,
        border: '1px solid hsl(var(--border))',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        zIndex: 1200,
      }}
    >
      {/* Header with Logo */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          minHeight: 64,
        }}
      >
        {/* Shuffle Logo - Links to Home */}
        <Tooltip title="Go to Home" placement="right">
          <Box
            component={Link}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexShrink: 0,
              textDecoration: 'none',
              '&:hover': {
                opacity: 0.8,
              },
            }}
          >
            <svg width="32" height="32" viewBox="0 0 56 56" fill="none">
              <path
                d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z"
                fill="#FF6600"
              />
            </svg>
            {!collapsed && (
              <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '1rem' }}>
                Cases
              </Typography>
            )}
          </Box>
        </Tooltip>
      </Box>

      {/* Divider with Toggle Button */}
      <Box sx={{ position: 'relative', mx: collapsed ? 1 : 2 }}>
        <Divider sx={{ borderColor: 'hsl(var(--border))' }} />
        <IconButton 
          onClick={onToggle} 
          size="small" 
          sx={{ 
            position: 'absolute',
            right: collapsed ? '50%' : -12,
            top: '50%',
            transform: collapsed ? 'translate(50%, -50%)' : 'translateY(-50%)',
            color: 'hsl(var(--muted-foreground))',
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 1,
            width: 24,
            height: 24,
            zIndex: 1,
            '&:hover': {
              backgroundColor: 'hsl(var(--muted))',
            },
          }}
        >
          {collapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ChevronLeftIcon sx={{ fontSize: 16 }} />}
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
      <List sx={{ px: 1, py: 2, flexGrow: 1, overflowY: 'auto' }}>
        {navItems.map((item) => (
          <Box key={item.label}>
            {item.children ? (
              <>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => {
                        if (!collapsed) {
                          handleExpand(item.label);
                        }
                        if (item.path) {
                          navigate(item.path);
                        }
                      }}
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
                        <>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{ 
                              fontSize: '0.875rem', 
                              fontWeight: isActive(item.path) ? 500 : 400,
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
                          color: 'hsl(var(--foreground))',
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
              onChange={(_, newValue) => handleOrgChange(newValue)}
              options={sortedOrgs.map(item => item.org)}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              size="small"
              disableClearable
              renderInput={(params) => {
                const region = getRegionFlag(selectedOrg?.region_url);
                return (
                  <TextField
                    {...params}
                    placeholder="Select organization"
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        startAdornment: selectedOrg ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                            <span style={{ fontSize: '14px' }}>{region.flag}</span>
                            <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                              {region.code}
                            </Typography>
                          </Box>
                        ) : null,
                      },
                    }}
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
                );
              }}
              slotProps={{
                paper: {
                  sx: {
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 1,
                    mt: 0.5,
                    minWidth: 280,
                    maxHeight: 300,
                    overflow: 'auto',
                    '& .MuiAutocomplete-listbox': {
                      padding: 0,
                      maxHeight: 'none',
                    },
                  },
                },
              }}
              renderOption={(props, option) => {
                const sortedItem = sortedOrgs.find(item => item.org.id === option.id);
                const level = sortedItem?.level || 0;
                const region = getRegionFlag(option.region_url);
                const { key, ...restProps } = props;
                
                return (
                  <Box
                    component="li"
                    key={option.id}
                    {...restProps}
                    sx={{
                      fontSize: '0.875rem',
                      color: 'hsl(var(--foreground))',
                      backgroundColor: 'hsl(var(--card))',
                      pl: `${16 + level * 16}px !important`,
                      py: 1,
                      '&:hover': {
                        backgroundColor: 'hsl(var(--muted)) !important',
                      },
                      '&.Mui-focused': {
                        backgroundColor: 'hsl(var(--muted)) !important',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: '14px' }}>{region.flag}</span>
                      <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', minWidth: 28 }}>
                        {region.code}
                      </Typography>
                      <Typography sx={{ fontSize: '0.875rem' }}>
                        {option.name}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
            />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Tooltip title={selectedOrg?.name || 'No org'} placement="right">
              <IconButton size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                <BusinessIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Settings Button (User Section) */}
        <Box
          onClick={() => navigate('/dashboard/settings')}
          sx={{
            p: 2,
            pt: 0,
            cursor: 'pointer',
            '&:hover': {
              '& .settings-container': {
                backgroundColor: 'hsl(var(--muted))',
              },
            },
          }}
        >
          <Box
            className="settings-container"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              justifyContent: collapsed ? 'center' : 'flex-start',
              p: 1.5,
              borderRadius: 1,
              transition: 'background-color 0.15s ease',
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
                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500, 
                      color: 'hsl(var(--foreground))',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {userInfo?.username || 'User'}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'hsl(var(--muted-foreground))',
                      display: 'block',
                    }}
                  >
                    Settings
                  </Typography>
                </Box>
                <SettingsIcon 
                  sx={{ 
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: 18,
                  }} 
                />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
