import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Chip,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';

interface Integration {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'error' | 'pending';
}

interface IntegrationStatusProps {
  collapsed: boolean;
}

export const IntegrationStatus = ({ collapsed }: IntegrationStatusProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // Load integrations from localStorage (temporary until backend)
  useEffect(() => {
    const stored = localStorage.getItem('connected_integrations');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setIntegrations(
          parsed.map((sys: { id: string; name: string; icon: string }) => ({
            ...sys,
            status: 'connected' as const,
          }))
        );
      } catch {
        setIntegrations([]);
      }
    }
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

  if (collapsed) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, gap: 0.5 }}>
        {integrations.slice(0, 3).map((integration) => (
          <Tooltip key={integration.id} title={`${integration.name} - ${integration.status}`} placement="right">
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  backgroundColor: 'hsl(var(--muted))',
                  fontSize: '0.9rem',
                }}
              >
                {integration.icon}
              </Avatar>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(integration.status),
                  border: '1px solid hsl(var(--card))',
                }}
              />
            </Box>
          </Tooltip>
        ))}
        {integrations.length > 3 && (
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>
            +{integrations.length - 3}
          </Typography>
        )}
        <Tooltip title="Add Integration" placement="right">
          <IconButton
            size="small"
            onClick={() => navigate('/onboarding')}
            sx={{ color: 'hsl(var(--muted-foreground))', mt: 0.5 }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 1 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          borderRadius: 1,
          '&:hover': { backgroundColor: 'hsl(var(--muted))' },
        }}
      >
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Integrations
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {integrations.length > 0 && (
            <Chip
              label={integrations.length}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                backgroundColor: 'hsl(var(--primary) / 0.2)',
                color: 'hsl(var(--primary))',
              }}
            />
          )}
          {expanded ? (
            <ExpandLess sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
          ) : (
            <ExpandMore sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
          )}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <List disablePadding sx={{ py: 0.5 }}>
          {integrations.map((integration) => (
            <ListItem
              key={integration.id}
              sx={{
                py: 0.5,
                px: 1.5,
                borderRadius: 1,
                '&:hover': { backgroundColor: 'hsl(var(--muted))' },
              }}
            >
              <Box sx={{ position: 'relative', mr: 1.5 }}>
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: 'hsl(var(--muted))',
                    fontSize: '0.8rem',
                  }}
                >
                  {integration.icon}
                </Avatar>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: getStatusColor(integration.status),
                    border: '1px solid hsl(var(--card))',
                  }}
                />
              </Box>
              <ListItemText
                primary={integration.name}
                primaryTypographyProps={{
                  sx: { color: 'hsl(var(--foreground))', fontSize: '0.8rem' },
                }}
              />
            </ListItem>
          ))}

          {integrations.length === 0 && (
            <ListItem sx={{ py: 1, px: 1.5 }}>
              <ListItemText
                primary="No integrations"
                secondary="Click + to add"
                primaryTypographyProps={{
                  sx: { color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' },
                }}
                secondaryTypographyProps={{
                  sx: { color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' },
                }}
              />
            </ListItem>
          )}

          <ListItem
            onClick={() => navigate('/onboarding')}
            sx={{
              py: 0.75,
              px: 1.5,
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'hsl(var(--muted))' },
            }}
          >
            <AddIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))', mr: 1 }} />
            <ListItemText
              primary="Add Integration"
              primaryTypographyProps={{
                sx: { color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' },
              }}
            />
          </ListItem>
        </List>
      </Collapse>
    </Box>
  );
};
