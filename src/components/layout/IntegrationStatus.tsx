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
}

export const IntegrationStatus = ({ collapsed, filterApps, onAddClick }: IntegrationStatusProps) => {
  const [allIntegrations, setAllIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

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
      }}>
        {loading ? (
          <CircularProgress size={20} sx={{ color: 'hsl(var(--muted-foreground))' }} />
        ) : (
          <>
            {integrations.slice(0, displayLimit).map((integration) => (
              <Tooltip 
                key={integration.id} 
                title={
                  <Box sx={{ textAlign: 'left', minWidth: 160, p: 0.5 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
                      {integration.name}
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
                }
                placement="right"
                arrow
              >
              <Box
                  component={Link}
                  to={`/apps/${encodeURIComponent(integration.name)}`}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      transition: 'transform 0.15s ease',
                    },
                  }}
                >
                  {integration.icon && !failedImages.has(integration.id) ? (
                    <Box
                      component="img"
                      src={integration.icon}
                      alt={integration.name}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        objectFit: 'contain',
                        backgroundColor: 'hsl(var(--muted))',
                        p: 0.25,
                      }}
                      onError={() => {
                        setFailedImages(prev => new Set(prev).add(integration.id));
                      }}
                    />
                  ) : (
                    <Avatar
                      sx={{
                        width: 26,
                        height: 26,
                        backgroundColor: 'hsl(var(--muted))',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--foreground))',
                      }}
                    >
                      {integration.name.charAt(0).toUpperCase()}
                    </Avatar>
                  )}
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
                    }}
                  />
                </Box>
              </Tooltip>
            ))}
            
            {hasMore && !expanded && (
              <Tooltip title={`Show all ${integrations.length} integrations`} placement="right">
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
              <Tooltip title="Show less" placement="right">
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
            <Tooltip title="Add Integration" placement="right">
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
