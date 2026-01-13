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
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '@/config/api';

interface Integration {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'error' | 'pending';
}

interface ApiAuthEntry {
  app: {
    id: string;
    name: string;
    large_image?: string;
  };
  active?: boolean;
  validation?: {
    valid: boolean;
    error?: string;
  };
}

interface IntegrationStatusProps {
  collapsed: boolean;
}

export const IntegrationStatus = ({ collapsed }: IntegrationStatusProps) => {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const defaultLimit = collapsed ? 4 : 8;
  const displayLimit = expanded ? integrations.length : defaultLimit;
  const hasMore = integrations.length > defaultLimit;

  // Fetch enabled integrations from API
  useEffect(() => {
    const fetchIntegrations = async () => {
      if (!API_CONFIG.apiKey) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/api/v1/apps/authentication`, {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const authData: ApiAuthEntry[] = result.data || result;
          
          if (Array.isArray(authData)) {
            // Deduplicate by app.id, prioritizing validated entries
            const appMap = new Map<string, { entry: ApiAuthEntry; isValidated: boolean }>();
            
            authData.forEach(entry => {
              if (!entry.active && !entry.validation?.valid) return; // Skip inactive/unvalidated
              
              const existing = appMap.get(entry.app.id);
              const isValidated = entry.validation?.valid === true;
              
              // Keep this entry if: no existing, or this one is validated and existing isn't
              if (!existing || (isValidated && !existing.isValidated)) {
                appMap.set(entry.app.id, { entry, isValidated });
              }
            });
            
            // Convert to integration objects
            const dedupedIntegrations = Array.from(appMap.values()).map(({ entry }) => ({
              id: entry.app.id,
              name: entry.app.name,
              icon: entry.app.large_image || '',
              status: entry.validation?.valid ? 'connected' as const : 'pending' as const,
            }));
            
            setIntegrations(dedupedIntegrations);
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

  const getStatusColor = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return 'hsl(var(--severity-low))';
      case 'error':
        return 'hsl(var(--severity-critical))';
      default:
        return 'hsl(var(--muted-foreground))';
    }
  };

  const getStatusLabel = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return '✓ Connected';
      case 'error':
        return '✗ Error';
      default:
        return '⏳ Pending';
    }
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
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      {integration.name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: getStatusColor(integration.status) }}>
                      {getStatusLabel(integration.status)}
                    </Typography>
                  </Box>
                } 
                placement="right"
                arrow
              >
                <Box
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      transition: 'transform 0.15s ease',
                    },
                  }}
                >
                  {integration.icon ? (
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
                      onError={(e) => {
                        // Fallback to initial if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.setAttribute('style', 'display: flex');
                      }}
                    />
                  ) : null}
                  <Avatar
                    sx={{
                      width: 26,
                      height: 26,
                      backgroundColor: 'hsl(var(--muted))',
                      fontSize: '0.75rem',
                      display: integration.icon ? 'none' : 'flex',
                    }}
                  >
                    {integration.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(integration.status),
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
              <IconButton
                size="small"
                onClick={() => navigate('/onboarding')}
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
            </Tooltip>
          </>
        )}
      </Box>
    </Box>
  );
};
