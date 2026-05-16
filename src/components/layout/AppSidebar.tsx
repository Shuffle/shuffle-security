import { useState, useRef, useEffect, useMemo } from 'react';
import shuffleInfraLogo from '@/assets/shuffle-infrastructure-logo.png';
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
  Menu,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { Activity, Sun, Moon, Monitor, Shield, Radar, Users, AlertTriangle as WarningAmberIcon, Users as PeopleIcon, Building2 as BusinessIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, ChevronUp as ExpandLess, ChevronDown as ExpandMore, Search as SearchIcon, Settings as SettingsIcon, FileText as DescriptionIcon, Fingerprint as FingerprintIcon, SlidersHorizontal as TuneIcon, Rss as RssFeedIcon, Radar as RadarIcon, LogOut as LogoutIcon, ShieldCheck as AdminPanelSettingsIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { SHUFFLE_AUTOMATION_URL } from '@/Shuffle-MCPs/api';
import { IntegrationStatus } from '@/Shuffle-MCPs/IntegrationStatus';
import { SidebarSearchDialog } from './SidebarSearchDialog';

import { useEntityPreference, useSidebarTabs } from '@/hooks/useEntityLabel';
import { SIDEBAR_NAV, SidebarChildSpec } from '@/config/sidebarNav';
import { getRegionFlag } from '@/lib/regionFlag';

const drawerWidth = 260;
const collapsedWidth = 64;
const hoverCollapseDelay = 150;

// Render-time nav node — derived inside the component from the shared
// SIDEBAR_NAV config plus the user's entity-label preference (Incidents
// adapts to Alerts/Cases/…). The `__divider__` sentinel keeps the existing
// rendering loop's grouping visuals intact.
interface NavChild {
  label: string;
  path: string;
  icon: React.ReactNode;
  disabled?: boolean;
  supportOnly?: boolean;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: NavChild[];
  supportOnly?: boolean;
}

const childToNav = (c: SidebarChildSpec): NavChild => ({
  label: c.label,
  path: c.path,
  icon: c.icon,
  supportOnly: c.supportOnly,
});

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}


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
  const { userInfo, setActiveOrg, logout } = useAuth();
  const { theme: currentTheme, setTheme } = useTheme();
  const { plural: entityPlural, basePath: entityBasePath } = useEntityPreference();
  const sidebarTabs = useSidebarTabs();
  const isSupport = userInfo?.support === true;

  // Filter the shared SIDEBAR_NAV against the user's preferences and
  // support flag, then convert to runtime nav items. The visibility map is
  // keyed by `tabKey`, so this stays in lock-step with /preferences without
  // any path/label lookup tables.
  const navItems = useMemo(() => {
    const out: NavItem[] = [];
    for (const spec of SIDEBAR_NAV) {
      // Top-level visibility gate (Incidents is alwaysVisible).
      if (spec.supportOnly && !isSupport) continue;
      if (!spec.alwaysVisible && sidebarTabs[spec.tabKey] === false) continue;

      const filteredChildren = spec.children
        ?.filter((c) => {
          if (c.supportOnly && !isSupport) return false;
          if (sidebarTabs[c.tabKey] === false) return false;
          return true;
        })
        .map(childToNav);

      const isIncidents = spec.tabKey === 'incidents';
      out.push({
        label: isIncidents ? entityPlural : spec.label,
        icon: spec.icon,
        path: isIncidents ? entityBasePath : spec.path,
        supportOnly: spec.supportOnly,
        children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : undefined,
      });

      // Divider after the Detection group, matching the previous layout.
      if (spec.tabKey === 'detection') {
        out.push({ label: '__divider__', icon: <></> });
      }
    }
    return out;
  }, [entityPlural, entityBasePath, isSupport, sidebarTabs]);
  const [expandedItems, setExpandedItems] = useState<string[]>([entityPlural]);
  const [changingOrg, setChangingOrg] = useState(false);
  
  const [toolMenuAnchor, setToolMenuAnchor] = useState<null | HTMLElement>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Auto-expand the nav group whose own path or any child path matches the current route.
  // This prevents the previously-expanded group (e.g. Incidents) from staying open when
  // navigating to a sibling group like Vulnerabilities.
  useEffect(() => {
    const path = location.pathname;
    const matches = (p?: string) => !!p && (path === p || path.startsWith(p + '/'));
    const owning = navItems.find(item => {
      if (matches(item.path)) return true;
      if (item.children?.some(c => matches(c.path))) return true;
      return false;
    });
    if (owning) {
      setExpandedItems(prev => (prev.length === 1 && prev[0] === owning.label ? prev : [owning.label]));
    }
  }, [location.pathname, navItems]);

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
      setChangingOrg(true);
      await setActiveOrg(org.id);
    }
  };

  return (
    <>
      {/* Full-screen overlay when changing org */}
      {changingOrg && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            backgroundColor: 'hsla(var(--background) / 0.85)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <CircularProgress size={32} sx={{ color: 'hsl(var(--primary))' }} />
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Changing tenant…
          </Typography>
        </Box>
      )}

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
        {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
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
              <ExpandMore size={16} style={{ color: 'hsl(var(--muted-foreground))', marginLeft: '4px' }} />
            </Box>
          )}
        </Box>
        <Menu
          anchorEl={toolMenuAnchor}
          open={Boolean(toolMenuAnchor)}
          onClose={() => setToolMenuAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 1.5,
                minWidth: 230,
                zIndex: 1400,
              },
            },
          }}
        >
          <MenuItem
            component="a"
            href="/"
            selected
            sx={{
              py: 1.5,
              px: 2,
              gap: 1.5,
              backgroundColor: 'hsla(var(--primary) / 0.12) !important',
              border: '1px solid hsla(var(--primary) / 0.3)',
              borderRadius: 1,
              mx: 0.5,
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': { backgroundColor: 'hsla(var(--primary) / 0.18) !important' },
            }}
            onClick={(e: React.MouseEvent) => {
              // Allow ctrl/cmd+click to open in new tab naturally
              if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setToolMenuAnchor(null);
                navigate('/');
              }
            }}
          >
            <svg width="24" height="24" viewBox="0 0 56 56" fill="none">
              <path d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z" fill="#FF6600" />
            </svg>
            <Typography sx={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))', fontWeight: 600 }}>
              <span style={{ color: '#FF6600' }}>Shuffle</span> Security
            </Typography>
          </MenuItem>
          <MenuItem
            component="a"
            href={(() => {
              const hostname = window.location.hostname;
              const isManagedHost = hostname.includes('lovable') || hostname.includes('shuffler.io') || hostname.includes('shutdown.no');
              return isManagedHost
                ? SHUFFLE_AUTOMATION_URL
                : `${window.location.protocol}//${hostname}:3001`;
            })()}
            sx={{
              py: 1.5,
              px: 2,
              gap: 1.5,
              mx: 0.5,
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': { backgroundColor: 'hsl(var(--muted))' },
            }}
            onClick={(e: React.MouseEvent) => {
              // Allow ctrl/cmd+click to open in new tab naturally
              if (!e.ctrlKey && !e.metaKey) {
                setToolMenuAnchor(null);
              }
            }}
          >
            <img src={shuffleInfraLogo} alt="Shuffle Core" width={24} height={24} style={{ borderRadius: 4 }} />
            <Typography sx={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
              <span style={{ color: '#FF6600' }}>Shuffle</span> Core
            </Typography>
          </MenuItem>
        </Menu>

      </Box>

      {/* Search Bar */}
      {!visuallyCollapsed ? (
        <Box sx={{ px: 2, mb: 2 }}>
          <Box
            onClick={() => setSearchOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'hsl(var(--muted))',
              borderRadius: 1,
              px: 1.5,
              py: 1,
              gap: 1,
              cursor: 'pointer',
              '&:hover': { border: '1px solid hsl(var(--border))', backgroundColor: 'transparent' },
              border: '1px solid transparent',
            }}
          >
            <SearchIcon size={20} style={{ color: 'hsl(var(--muted-foreground))' }} />
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
            <IconButton size="small" onClick={() => setSearchOpen(true)} sx={{ color: 'hsl(var(--muted-foreground))' }}>
              <SearchIcon size={20} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Divider sx={{ borderColor: 'hsl(var(--border))', mx: visuallyCollapsed ? 1 : 2 }} />

      {/* Scrollable area: nav items + integrations */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        <List sx={{ px: 1, py: 2 }}>
        {navItems.map((item, idx) => (
          <Box key={item.label === '__divider__' ? `divider-${idx}` : item.label}>
            {item.label === '__divider__' ? (
              <Divider sx={{ borderColor: 'hsl(var(--border))', mx: visuallyCollapsed ? 1 : 1.5, my: 1 }} />
            ) : item.children ? (
              <>
                <Tooltip title={visuallyCollapsed ? item.label : ''} placement="right">
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component={Link}
                      to={item.path!}
                      data-tour={item.path === entityBasePath ? 'sidebar-incidents-link' : undefined}
                      onClick={() => {
                        // Always switch the expanded group to this item synchronously
                        // (avoids a brief flicker where the previously-open group stays
                        // open while the route changes).
                        setExpandedItems([item.label]);
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
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{item.label}</span>
                                {item.supportOnly && (
                                  <Typography
                                    component="span"
                                    sx={{
                                      fontSize: '0.6rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                      px: 0.8,
                                      py: 0.2,
                                      borderRadius: '4px',
                                      backgroundColor: 'hsla(var(--primary) / 0.12)',
                                      color: 'hsl(var(--primary))',
                                      lineHeight: 1.4,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Support
                                  </Typography>
                                )}
                              </Box>
                            }
                            primaryTypographyProps={{ 
                              fontSize: '0.875rem', 
                              fontWeight: isActive(item.path) ? 500 : 400,
                              color: 'hsl(var(--foreground))',
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleExpand(item.label);
                            }}
                            sx={{
                              p: 0.25,
                              color: 'hsl(var(--muted-foreground))',
                              '&:hover': { color: 'hsl(var(--foreground))' },
                            }}
                          >
                            {expandedItems.includes(item.label) ? (
                              <ExpandLess size={18} />
                            ) : (
                              <ExpandMore size={18} />
                            )}
                          </IconButton>
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
                            component={child.disabled ? 'div' : Link}
                            {...(child.disabled ? {} : { to: child.path })}
                            disabled={child.disabled}
                            sx={{
                              pl: 3,
                              borderRadius: 1,
                              minHeight: 36,
                              backgroundColor: isActive(child.path) ? 'hsl(var(--muted))' : 'transparent',
                              '&:hover': {
                                backgroundColor: child.disabled ? 'transparent' : 'hsl(var(--muted))',
                              },
                              opacity: child.disabled ? 0.45 : 1,
                              pointerEvents: child.disabled ? 'none' : 'auto',
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
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <span>{child.label}</span>
                                  {child.supportOnly && (
                                    <Typography
                                      component="span"
                                      sx={{
                                        fontSize: '0.6rem',
                                        fontWeight: 600,
                                        color: 'hsl(var(--primary))',
                                        backgroundColor: 'hsl(var(--primary) / 0.1)',
                                        px: 0.6,
                                        py: 0.15,
                                        borderRadius: 0.5,
                                        lineHeight: 1.2,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.03em',
                                      }}
                                    >
                                      Support
                                    </Typography>
                                  )}
                                </Box>
                              }
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: isActive(item.path) ? 500 : 400,
                            color: 'hsl(var(--foreground))',
                          }}
                        />
                        {item.supportOnly && (
                          <Typography
                            sx={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              px: 0.8,
                              py: 0.2,
                              borderRadius: '4px',
                              backgroundColor: 'hsla(var(--primary) / 0.12)',
                              color: 'hsl(var(--primary))',
                              lineHeight: 1.4,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Support
                          </Typography>
                        )}
                      </Box>
                    )}
                  </ListItemButton>
                </ListItem>
              </Tooltip>
            )}
          </Box>
        ))}
      </List>
      </Box>

      {/* Bottom Section */}
      <Box sx={{ mt: 'auto' }}>
        <Divider sx={{ borderColor: 'hsl(var(--border))', mx: visuallyCollapsed ? 1 : 2 }} />
        
        {/* Organization Selector */}
        {!visuallyCollapsed ? (
          <Box sx={{ p: 2 }}>
            <Autocomplete
              value={selectedOrg}
              onChange={(_, newValue) => handleOrgChange(newValue)}
              onOpen={() => {
                // Scroll the currently-selected tenant into the middle of the
                // listbox so users in deeply-nested child tenants don't have
                // to hunt from the top of an alphabetised list.
                requestAnimationFrame(() => {
                  // The listbox is portaled into a popper outside the sidebar.
                  const listboxes = document.querySelectorAll<HTMLElement>('.MuiAutocomplete-listbox');
                  const listbox = listboxes[listboxes.length - 1];
                  if (!listbox) return;
                  const selected = listbox.querySelector<HTMLElement>('li[aria-selected="true"]');
                  if (selected) {
                    selected.scrollIntoView({ block: 'center' });
                  }
                });
              }}
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
                    placeholder="Select tenant"
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        startAdornment: selectedOrg ? (
                          <Tooltip title={!region.code ? `Region URL: ${fullOrgData?.region_url || selectedOrg?.region_url || 'none'}` : region.code} placement="bottom">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5, cursor: !region.code ? 'help' : 'default' }}>
                              <span style={{ fontSize: '14px' }}>{region.flag}</span>
                              <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                {region.code || '?'}
                              </Typography>
                            </Box>
                          </Tooltip>
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
                      <Tooltip title={!region.code ? `Region URL: ${option.region_url || 'none'}` : ''} placement="left">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: !region.code ? 'help' : 'default' }}>
                          <span style={{ fontSize: '14px' }}>{region.flag}</span>
                          <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', minWidth: 28 }}>
                            {region.code || '?'}
                          </Typography>
                        </Box>
                      </Tooltip>
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
            <Tooltip title={selectedOrg?.name || 'No tenant'} placement="right">
              <IconButton size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                <BusinessIcon size={20} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Execution Usage Warning */}
        {userInfo?.app_execution_limit && userInfo.app_execution_limit > 0 && (() => {
          const usage = userInfo.app_execution_usage || 0;
          const limit = userInfo.app_execution_limit;
          const pct = (usage / limit) * 100;
          if (pct < 65) return null;
          const isOver = pct >= 100;

          // Collapsed: show a small icon indicator
          if (visuallyCollapsed) {
            return (
              <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1.5 }}>
                <Tooltip title={isOver ? 'App run limit reached' : `${pct.toFixed(0)}% of app runs used`} placement="right">
                  <Box sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: isOver ? 'hsl(var(--destructive) / 0.15)' : 'hsl(var(--severity-medium) / 0.15)',
                    border: `1.5px solid ${isOver ? 'hsl(var(--destructive) / 0.5)' : 'hsl(var(--severity-medium) / 0.5)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'default',
                  }}>
                    <WarningAmberIcon size={16} style={{ color: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--severity-medium))' }} />
                  </Box>
                </Tooltip>
              </Box>
            );
          }

          return (
            <Box sx={{ px: 2, pb: 1.5 }}>
              <Box sx={{
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: isOver ? 'hsl(var(--destructive) / 0.08)' : 'hsl(var(--severity-medium) / 0.08)',
                border: `1px solid ${isOver ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--severity-medium) / 0.2)'}`,
                position: 'relative',
              }}>
                <Box sx={{ p: 1.5, pb: 1.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    <WarningAmberIcon size={14} style={{ color: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--severity-medium))' }} />
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--severity-medium))' }}>
                      {isOver ? 'App run limit reached' : 'App run limit warning'}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4, mb: 1 }}>
                    {isOver
                      ? `Automation will stop until ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, but incidents and detections still work.`
                      : `${pct.toFixed(0)}% of app runs used. Automation may stop soon, but incidents and detections still work.`}
                  </Typography>
                  {/* Action links */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      component="a"
                      href="https://shuffler.io/pricing"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--severity-medium))',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      Upgrade →
                    </Box>
                    <Box
                      component="a"
                      href="https://shuffler.io/contact?category=support"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 500,
                        color: 'hsl(var(--muted-foreground))',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      Contact support
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.6rem', color: 'hsl(var(--muted-foreground))', mt: 0.75, opacity: 0.7 }}>
                    {usage.toLocaleString()} / {limit.toLocaleString()} runs
                  </Typography>
                </Box>
                {/* Bottom border progress bar */}
                <Box sx={{ width: '100%', height: 3, bgcolor: 'hsl(var(--muted) / 0.5)' }}>
                  <Box sx={{
                    width: `${Math.min(pct, 100)}%`,
                    height: '100%',
                    bgcolor: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--severity-medium))',
                    transition: 'width 0.3s ease',
                  }} />
                </Box>
              </Box>
            </Box>
          );
        })()}

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
                  size={18} style={{ color: 'hsl(var(--muted-foreground))' }} 
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
            to="/usecases"
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
            <Activity size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
            Usecases
          </MenuItem>
          <Divider sx={{ borderColor: 'hsl(var(--border))', my: 0.5 }} />
          <MenuItem
            component={Link}
            to="/admin"
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
            <AdminPanelSettingsIcon size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
            Tenant Admin
          </MenuItem>
          <MenuItem
            component={Link}
            to="/preferences"
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
            <TuneIcon size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
            Tenant Preferences
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
            <SettingsIcon size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
            User Account
          </MenuItem>
          <Divider sx={{ borderColor: 'hsl(var(--border))', my: 0.5 }} />
          {/* Theme Toggle - icon only with tooltips */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.25, py: 0.75, px: 1.5 }}>
            {([
              { value: 'light' as const, icon: <Sun size={16} />, label: 'Light' },
              { value: 'dark' as const, icon: <Moon size={16} />, label: 'Dark' },
              { value: 'system' as const, icon: <Monitor size={16} />, label: 'System' },
            ]).map(({ value, icon, label }) => (
              <Tooltip key={value} title={label} placement="top">
                <IconButton
                  size="small"
                  onClick={() => setTheme(value)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    color: currentTheme === value ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    bgcolor: currentTheme === value ? 'hsl(var(--muted))' : 'transparent',
                    '&:hover': {
                      bgcolor: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))',
                    },
                  }}
                >
                  {icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>
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
            <LogoutIcon size={18} />
            Logout
          </MenuItem>
        </Menu>
      </Box>
    </Box>
    <SidebarSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};
