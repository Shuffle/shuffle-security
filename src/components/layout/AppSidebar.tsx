import { useState, useRef } from 'react';
import shuffleInfraLogo from '@/assets/shuffle-infrastructure-logo.png';
import { useLocation, Link } from 'react-router-dom';
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
  Menu,
  MenuItem,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import TuneIcon from '@mui/icons-material/Tune';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import RadarIcon from '@mui/icons-material/Radar';
import { Braces, Waypoints, Bot, Network } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { SHUFFLE_AUTOMATION_URL } from '@/config/api';
import { IntegrationStatus } from './IntegrationStatus';
import AgentPermissionsDrawer from '@/components/agent/AgentPermissionsDrawer';

const drawerWidth = 260;
const collapsedWidth = 64;
const hoverCollapseDelay = 150;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { label: string; path: string; icon: React.ReactNode }[];
}

const navItems: NavItem[] = [
  { 
    label: 'Incidents', 
    icon: <WarningAmberIcon />,
    path: '/incidents',
    children: [
      { label: 'Templates', path: '/templates', icon: <DescriptionIcon fontSize="small" /> },
      { label: 'IOC Types', path: '/incidents/ioc-types', icon: <FingerprintIcon fontSize="small" /> },
      { label: 'Threat Feeds', path: '/incidents/threat-feeds', icon: <RssFeedIcon fontSize="small" /> },
      { label: 'Custom Fields', path: '/incidents/custom-fields', icon: <TuneIcon fontSize="small" /> },
    ],
  },
  { 
    label: 'Detection', 
    icon: <RadarIcon />,
    path: '/detection',
    children: [
      { label: 'Sigma Rules', path: '/detection/sigma', icon: <Braces size={16} /> },
      { label: 'MITRE ATT&CK', path: '/detection/mitre', icon: <Waypoints size={16} /> },
    ],
  },
  { label: 'Infrastructure', icon: <Network size={20} />, path: '/infrastructure' },
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
  const { userInfo, setActiveOrg, logout } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Incidents']);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const [toolMenuAnchor, setToolMenuAnchor] = useState<null | HTMLElement>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // The sidebar appears expanded if it's actually expanded OR hover-expanded
  const visuallyCollapsed = collapsed && !hoverExpanded;

  const handleMouseEnter = () => {
    if (!collapsed) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoverExpanded(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoverExpanded(false);
    }, hoverCollapseDelay);
  };

  const organizations = userInfo?.orgs || [];
  const sortedOrgs = sortOrgsWithHierarchy(organizations);
  const selectedOrg = userInfo?.active_org || organizations[0];

  const handleExpand = (label: string) => {
    // Only allow one expanded item at a time - toggle off if already open, otherwise switch to new one
    setExpandedItems((prev) =>
      prev.includes(label) ? [] : [label]
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
    <>
      {/* Toggle button - fixed position outside sidebar to avoid clipping */}
      <IconButton 
        onClick={onToggle} 
        size="small" 
        sx={{ 
          position: 'fixed',
          left: (collapsed ? collapsedWidth : drawerWidth) + 10 - 12,
          top: collapsed ? 'calc(2.5% + 100px)' : 'calc(2.5% + 104px)',
          color: 'hsl(var(--muted-foreground))',
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 1,
          width: 24,
          height: 24,
          zIndex: 1300,
          display: { xs: 'none', sm: hoverExpanded ? 'none' : 'flex' },
          transition: 'left 0.2s ease',
          '&:hover': {
            backgroundColor: 'hsl(var(--muted))',
          },
        }}
      >
        {collapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ChevronLeftIcon sx={{ fontSize: 16 }} />}
      </IconButton>

      <Box
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          position: 'fixed',
          left: 10,
          top: '2.5%',
          height: '95%',
          width: visuallyCollapsed ? collapsedWidth : drawerWidth,
          backgroundColor: 'hsl(var(--card))',
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          display: { xs: 'none', sm: 'flex' },
          flexDirection: 'column',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          zIndex: hoverExpanded ? 1250 : 1200,
        }}
      >
      {/* Header with Logo and Toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          minHeight: 64,
        }}
      >
        <Box
          onClick={(e) => !visuallyCollapsed && setToolMenuAnchor(e.currentTarget)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexShrink: 0,
            cursor: visuallyCollapsed ? 'default' : 'pointer',
            borderRadius: 1,
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
          {!visuallyCollapsed && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ 
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 600, 
                  fontSize: '1rem' 
                }}>
                  Shuffle
                </Typography>
                <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '1rem' }}>
                  Security
                </Typography>
              </Box>
              <ExpandMore sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))', ml: 0.5 }} />
            </Box>
          )}
        </Box>
        <Menu
          anchorEl={toolMenuAnchor}
          open={Boolean(toolMenuAnchor)}
          onClose={() => setToolMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 1.5,
                mt: 0.5,
                minWidth: 220,
                zIndex: 1400,
              },
            },
          }}
        >
          <MenuItem
            onClick={() => {
              window.open(SHUFFLE_AUTOMATION_URL, '_blank');
              setToolMenuAnchor(null);
            }}
            sx={{
              py: 1.5,
              px: 2,
              gap: 1.5,
              '&:hover': { backgroundColor: 'hsl(var(--muted))' },
            }}
          >
            <img src={shuffleInfraLogo} alt="Shuffle Infrastructure" width={24} height={24} style={{ borderRadius: 4 }} />
            <Typography sx={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
              Shuffle Infrastructure
            </Typography>
          </MenuItem>
          <MenuItem
            selected
            sx={{
              py: 1.5,
              px: 2,
              gap: 1.5,
              backgroundColor: 'hsla(var(--primary) / 0.12) !important',
              border: '1px solid hsla(var(--primary) / 0.3)',
              borderRadius: 1,
              '&:hover': { backgroundColor: 'hsla(var(--primary) / 0.18)' },
            }}
          >
            <svg width="24" height="24" viewBox="0 0 56 56" fill="none">
              <path d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z" fill="#FF6600" />
            </svg>
            <Typography sx={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))', fontWeight: 600 }}>
              Shuffle Security
            </Typography>
          </MenuItem>
        </Menu>

      </Box>

      {/* Search Bar */}
      {!visuallyCollapsed ? (
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

      <Divider sx={{ borderColor: 'hsl(var(--border))', mx: visuallyCollapsed ? 1 : 2 }} />

      {/* Navigation Items */}
      <List sx={{ px: 1, py: 2, flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {navItems.map((item) => (
          <Box key={item.label}>
            {item.children ? (
              <>
                <Tooltip title={visuallyCollapsed ? item.label : ''} placement="right">
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component={Link}
                      to={item.path!}
                      onClick={(e: React.MouseEvent) => {
                        // Allow ctrl/cmd+click to open in new tab
                        if (e.ctrlKey || e.metaKey) return;
                        
                        if (!visuallyCollapsed) {
                          handleExpand(item.label);
                        }
                      }}
                      sx={{
                        borderRadius: 1,
                        minHeight: 40,
                        justifyContent: visuallyCollapsed ? 'center' : 'flex-start',
                        px: visuallyCollapsed ? 1.5 : 2,
                        backgroundColor: isActive(item.path) ? 'hsl(var(--muted))' : 'transparent',
                        '&:hover': {
                          backgroundColor: 'hsl(var(--muted))',
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: visuallyCollapsed ? 0 : 36,
                          color: isActive(item.path) 
                            ? 'hsl(var(--primary))' 
                            : 'hsl(var(--muted-foreground))',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {!visuallyCollapsed && (
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
                {/* Expanded: show children in collapsible list */}
                {!visuallyCollapsed && (
                  <Collapse in={expandedItems.includes(item.label)} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.children.map((child) => (
                        <ListItem key={child.path} disablePadding sx={{ mb: 0.5 }}>
                          <ListItemButton
                            component={Link}
                            to={child.path}
                            sx={{
                              pl: 3,
                              borderRadius: 1,
                              minHeight: 36,
                              backgroundColor: isActive(child.path) ? 'hsl(var(--muted))' : 'transparent',
                              '&:hover': {
                                backgroundColor: 'hsl(var(--muted))',
                              },
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 28,
                                color: isActive(child.path) 
                                  ? 'hsl(var(--primary))' 
                                  : 'hsl(var(--muted-foreground))',
                              }}
                            >
                              {child.icon}
                            </ListItemIcon>
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
                {/* Collapsed: show children as icon-only buttons */}
                {visuallyCollapsed && (
                  <List component="div" disablePadding sx={{ mt: 0.5 }}>
                    {item.children.map((child) => (
                      <Tooltip key={child.path} title={child.label} placement="right">
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                          <ListItemButton
                            component={Link}
                            to={child.path}
                            sx={{
                              borderRadius: 1,
                              minHeight: 32,
                              justifyContent: 'center',
                              px: 1.5,
                              backgroundColor: isActive(child.path) ? 'hsl(var(--muted))' : 'transparent',
                              '&:hover': {
                                backgroundColor: 'hsl(var(--muted))',
                              },
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 0,
                                color: isActive(child.path) 
                                  ? 'hsl(var(--primary))' 
                                  : 'hsl(var(--muted-foreground))',
                              }}
                            >
                              {child.icon}
                            </ListItemIcon>
                          </ListItemButton>
                        </ListItem>
                      </Tooltip>
                    ))}
                  </List>
                )}
              </>
            ) : (
              <Tooltip title={visuallyCollapsed ? item.label : ''} placement="right">
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    to={item.path!}
                    sx={{
                      borderRadius: 1,
                      minHeight: 40,
                      justifyContent: visuallyCollapsed ? 'center' : 'flex-start',
                      px: visuallyCollapsed ? 1.5 : 2,
                      backgroundColor: isActive(item.path) ? 'hsl(var(--muted))' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'hsl(var(--muted))',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: visuallyCollapsed ? 0 : 36,
                        color: isActive(item.path) 
                          ? 'hsl(var(--primary))' 
                          : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!visuallyCollapsed && (
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
      {/* Integrations Section */}
      <Box sx={{ mt: 2, overflow: 'hidden' }}>
        <Divider sx={{ borderColor: 'hsl(var(--border))', mx: visuallyCollapsed ? 1 : 2, mb: 1 }} />
        <IntegrationStatus collapsed={visuallyCollapsed} />
        
        {/* Agent Permissions Button */}
        <Box sx={{ px: visuallyCollapsed ? 0 : 1, py: 0.5 }}>
          <Tooltip title={visuallyCollapsed ? 'Agent Permissions' : ''} placement="right">
            <Box
              onClick={() => setAgentDrawerOpen(true)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: visuallyCollapsed ? 0 : 1.5,
                py: 0.75,
                borderRadius: 1,
                cursor: 'pointer',
                justifyContent: visuallyCollapsed ? 'center' : 'flex-start',
                color: 'hsl(var(--muted-foreground))',
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: 'hsl(var(--muted))',
                  color: 'hsl(var(--primary))',
                },
              }}
            >
              <Bot size={16} />
              {!visuallyCollapsed && (
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                  Agent Permissions
                </Typography>
              )}
            </Box>
          </Tooltip>
        </Box>
      </Box>

      {/* Agent Permissions Drawer */}
      <AgentPermissionsDrawer open={agentDrawerOpen} onClose={() => setAgentDrawerOpen(false)} />

      {/* Bottom Section */}
      <Box sx={{ mt: 'auto' }}>
        <Divider sx={{ borderColor: 'hsl(var(--border))', mx: visuallyCollapsed ? 1 : 2 }} />
        
        {/* Organization Selector */}
        {!visuallyCollapsed ? (
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
                // Find the full org data from the list to get region_url
                const fullOrgData = organizations.find(org => org.id === selectedOrg?.id);
                const region = getRegionFlag(fullOrgData?.region_url || selectedOrg?.region_url);
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
                const isCurrentOrg = option.id === selectedOrg?.id;
                
                return (
                  <Box
                    component="li"
                    key={option.id}
                    {...restProps}
                    sx={{
                      fontSize: '0.875rem',
                      color: isCurrentOrg ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                      backgroundColor: isCurrentOrg ? 'rgba(255, 102, 0, 0.1)' : 'hsl(var(--card))',
                      pl: `${16 + level * 16}px !important`,
                      py: 1,
                      borderLeft: isCurrentOrg ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                      '&:hover': {
                        backgroundColor: isCurrentOrg 
                          ? 'rgba(255, 102, 0, 0.15) !important' 
                          : 'hsl(var(--muted)) !important',
                      },
                      '&.Mui-focused': {
                        backgroundColor: isCurrentOrg 
                          ? 'rgba(255, 102, 0, 0.15) !important' 
                          : 'hsl(var(--muted)) !important',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: '14px' }}>{region.flag}</span>
                      <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', minWidth: 28 }}>
                        {region.code}
                      </Typography>
                      <Typography sx={{ 
                        fontSize: '0.875rem', 
                        fontWeight: isCurrentOrg ? 600 : 400,
                        color: isCurrentOrg ? 'hsl(var(--primary))' : 'inherit',
                      }}>
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
          onClick={(e) => setUserMenuAnchor(e.currentTarget)}
          sx={{
            p: 2,
            pt: 0,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'block',
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
              justifyContent: visuallyCollapsed ? 'center' : 'flex-start',
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
            {!visuallyCollapsed && (
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
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={() => setUserMenuAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 1.5,
                minWidth: 180,
                mb: 1,
                zIndex: 1400,
              },
            },
          }}
        >
          <MenuItem
            component={Link}
            to="/users"
            onClick={() => setUserMenuAnchor(null)}
            sx={{
              py: 1.25,
              px: 2,
              gap: 1.5,
              fontSize: '0.875rem',
              color: 'hsl(var(--foreground))',
              '&:hover': { backgroundColor: 'hsl(var(--muted))' },
            }}
          >
            <AdminPanelSettingsIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
            Org Admin
          </MenuItem>
          <MenuItem
            component={Link}
            to="/settings"
            onClick={() => setUserMenuAnchor(null)}
            sx={{
              py: 1.25,
              px: 2,
              gap: 1.5,
              fontSize: '0.875rem',
              color: 'hsl(var(--foreground))',
              '&:hover': { backgroundColor: 'hsl(var(--muted))' },
            }}
          >
            <SettingsIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
            User Account
          </MenuItem>
          <Divider sx={{ borderColor: 'hsl(var(--border))', my: 0.5 }} />
          <MenuItem
            onClick={() => {
              setUserMenuAnchor(null);
              logout();
            }}
            sx={{
              py: 1.25,
              px: 2,
              gap: 1.5,
              fontSize: '0.875rem',
              color: 'hsl(var(--destructive, 0 84% 60%))',
              '&:hover': { backgroundColor: 'hsl(var(--destructive, 0 84% 60%) / 0.1)' },
            }}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
            Logout
          </MenuItem>
        </Menu>
      </Box>
    </Box>
    </>
  );
};
