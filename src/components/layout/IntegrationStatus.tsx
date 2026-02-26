import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Avatar,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link } from 'react-router-dom';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';

interface Integration {
  id: string;
  name: string;
  icon: string;
  category: string;
  hasValidAuth: boolean;
  authInstances: { label: string; isValidated: boolean }[];
}

interface IntegrationStatusProps {
  collapsed: boolean;
  /** When provided, only show integrations whose name is in this list */
  filterApps?: string[];
  /** When provided, the Add button calls this instead of navigating to /onboarding */
  onAddClick?: () => void;
  /** Icon size override (default: 26) */
  iconSize?: number;
  /** When provided, hovering an icon shows a cross-out button that calls this with the app name */
  onDisable?: (name: string) => void;
  /** Set of app names that are currently disabled */
  disabledApps?: Set<string>;
}

export const IntegrationStatus = ({ collapsed, filterApps, onAddClick, iconSize = 26, onDisable, disabledApps }: IntegrationStatusProps) => {
  const [allIntegrations, setAllIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Apply filter if provided (case-insensitive name match)
  const integrations = filterApps
    ? allIntegrations.filter(i => filterApps.some(f => f.toLowerCase() === i.name.toLowerCase()))
    : allIntegrations;

  const defaultLimit = collapsed ? 4 : 8;
  const displayLimit = expanded ? integrations.length : defaultLimit;
  const hasMore = integrations.length > defaultLimit;

  // Fetch enabled integrations from API
  useEffect(() => {
    const fetchIntegrations = async () => {
      if (!API_CONFIG.apiKey) return;
      
      setLoading(true);
      try {
        const response = await fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: {
            ...getAuthHeader(),
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const authData: AuthAppEntry[] = result.data || result;
          
          if (Array.isArray(authData)) {
            // Use shared deduplication utility
            const dedupedApps = deduplicateAuthApps(authData);
            
            // Convert to integration objects and sort by validation status
            const dedupedIntegrations = dedupedApps
              .map(({ app, instances, hasValidAuth, bestImage }) => ({
                id: app.id,
                name: app.name,
                icon: bestImage || app.large_image || '',
                category: app.categories?.[0] || 'Integration',
                hasValidAuth,
                authInstances: instances,
              }))
              .sort((a, b) => {
                // Valid first, then alphabetically
                if (a.hasValidAuth && !b.hasValidAuth) return -1;
                if (!a.hasValidAuth && b.hasValidAuth) return 1;
                return a.name.localeCompare(b.name);
              });
            
            setAllIntegrations(dedupedIntegrations);
          }
        }
      } catch (error) {
        console.error('Failed to fetch integrations:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchIntegrations();
  }, []);

  const getStatusColor = (hasValidAuth: boolean) => {
    return hasValidAuth ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))';
  };

  // Icon-only view for both collapsed and expanded states
  const sz = iconSize;
  return (
    <Box sx={{ px: collapsed ? 0 : 1, py: 1 }}>
      {/* Header - only show when expanded */}
      {!collapsed && (
        <Typography 
          sx={{ 
            color: 'hsl(var(--muted-foreground))', 
            fontSize: '0.7rem', 
            fontWeight: 600, 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em',
            px: 1.5,
            mb: 1,
          }}
        >
          Integrations
        </Typography>
      )}
      
      {/* Icon grid */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        gap: 0.5,
        justifyContent: collapsed ? 'center' : 'flex-start',
        px: collapsed ? 0 : 1,
        maxHeight: expanded ? 'none' : 80,
        overflow: 'hidden',
      }}>
        {loading ? (
          <CircularProgress size={20} sx={{ color: 'hsl(var(--muted-foreground))' }} />
        ) : (
          <>
            {integrations.slice(0, displayLimit).map((integration) => {
              const isDisabled = disabledApps?.has(integration.name) ?? false;
              const isHovered = hoveredId === integration.id;
              return (
              <Tooltip 
                key={integration.id} 
                title={onDisable && isHovered ? '' : (
                  <Box sx={{ textAlign: 'left', minWidth: 160, p: 0.5 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
                      {integration.name}
                      {isDisabled && <Typography component="span" sx={{ ml: 1, fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>(disabled)</Typography>}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', mb: 1, textTransform: 'capitalize' }}>
                      {integration.category}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {integration.authInstances.map((instance, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Box 
                            sx={{ 
                              width: 7, 
                              height: 7, 
                              borderRadius: '50%', 
                              backgroundColor: instance.isValidated 
                                ? 'hsl(var(--severity-low))' 
                                : 'hsl(var(--severity-medium))',
                              flexShrink: 0,
                            }} 
                          />
                          <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--foreground))', opacity: 0.9 }}>
                            {instance.label}
                          </Typography>
                          <Typography sx={{ fontSize: '0.65rem', color: instance.isValidated ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))', ml: 'auto' }}>
                            {instance.isValidated ? 'Valid' : 'Pending'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
                placement="bottom"
                arrow
              >
              <Box
                  onMouseEnter={() => onDisable && setHoveredId(integration.id)}
                  onMouseLeave={() => onDisable && setHoveredId(null)}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: onDisable ? 'default' : 'pointer',
                    textDecoration: 'none',
                    opacity: isDisabled ? 0.35 : 1,
                    transition: 'opacity 0.15s ease',
                    '&:hover': onDisable ? {} : {
                      transform: 'scale(1.1)',
                      transition: 'transform 0.15s ease',
                    },
                  }}
                >
                  {/* Icon — rendered as link only when not in disable mode */}
                  <Box
                    component={onDisable ? 'div' : Link}
                    {...(!onDisable ? { to: `/apps/${encodeURIComponent(integration.name)}` } : {})}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                  >
                    {integration.icon && !failedImages.has(integration.id) ? (
                      <Box
                        component="img"
                        src={integration.icon}
                        alt={integration.name}
                        sx={{
                          width: sz,
                          height: sz,
                          borderRadius: '50%',
                          objectFit: 'contain',
                          backgroundColor: 'hsl(var(--muted))',
                          p: 0.25,
                          filter: isDisabled ? 'grayscale(1)' : 'none',
                          transition: 'filter 0.15s ease',
                        }}
                        onError={() => {
                          setFailedImages(prev => new Set(prev).add(integration.id));
                        }}
                      />
                    ) : (
                      <Avatar
                        sx={{
                          width: sz,
                          height: sz,
                          backgroundColor: 'hsl(var(--muted))',
                          fontSize: sz * 0.4 + 'px',
                          color: 'hsl(var(--foreground))',
                          filter: isDisabled ? 'grayscale(1)' : 'none',
                        }}
                      >
                        {integration.name.charAt(0).toUpperCase()}
                      </Avatar>
                    )}
                  </Box>

                  {/* Status dot */}
                  {!isDisabled && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(integration.hasValidAuth),
                        border: '1.5px solid hsl(var(--card))',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Hover cross-out overlay */}
                  {onDisable && isHovered && (
                    <Box
                      onClick={() => onDisable(integration.name)}
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isDisabled
                          ? 'hsla(var(--severity-low) / 0.25)'
                          : 'hsla(var(--destructive) / 0.75)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {isDisabled ? (
                        /* Re-enable: checkmark */
                        <svg width={sz * 0.45} height={sz * 0.45} viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="hsl(var(--severity-low))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        /* Disable: X */
                        <svg width={sz * 0.45} height={sz * 0.45} viewBox="0 0 12 12" fill="none">
                          <path d="M2 2l8 8M10 2l-8 8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      )}
                    </Box>
                  )}
                </Box>
              </Tooltip>
              );
            })}
            
            {hasMore && !expanded && (
              <Tooltip title={`Show all ${integrations.length} integrations`} placement="bottom">
                <Avatar
                  onClick={() => setExpanded(true)}
                  sx={{
                    width: 26,
                    height: 26,
                    backgroundColor: 'hsl(var(--muted))',
                    fontSize: '0.65rem',
                    color: 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'hsl(var(--accent))',
                    },
                  }}
                >
                  +{integrations.length - defaultLimit}
                </Avatar>
              </Tooltip>
            )}
            
            {expanded && hasMore && (
              <Tooltip title="Show less" placement="bottom">
                <Avatar
                  onClick={() => setExpanded(false)}
                  sx={{
                    width: 26,
                    height: 26,
                    backgroundColor: 'hsl(var(--muted))',
                    fontSize: '0.65rem',
                    color: 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'hsl(var(--accent))',
                    },
                  }}
                >
                  −
                </Avatar>
              </Tooltip>
            )}
            
            {/* Add button */}
            <Tooltip title="Add Integration" placement="bottom">
              {onAddClick ? (
                <IconButton
                  size="small"
                  onClick={onAddClick}
                  sx={{ 
                    width: 26,
                    height: 26,
                    color: 'hsl(var(--muted-foreground))',
                    border: '1px dashed hsl(var(--border))',
                    borderRadius: '50%',
                    '&:hover': {
                      backgroundColor: 'hsl(var(--muted))',
                      borderStyle: 'solid',
                    },
                  }}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              ) : (
                <IconButton
                  size="small"
                  component={Link}
                  to="/onboarding"
                  sx={{ 
                    width: 26,
                    height: 26,
                    color: 'hsl(var(--muted-foreground))',
                    border: '1px dashed hsl(var(--border))',
                    borderRadius: '50%',
                    '&:hover': {
                      backgroundColor: 'hsl(var(--muted))',
                      borderStyle: 'solid',
                    },
                  }}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Tooltip>
          </>
        )}
      </Box>
    </Box>
  );
};
