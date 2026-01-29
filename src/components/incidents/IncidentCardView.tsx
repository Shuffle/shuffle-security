import { Box, Typography, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Fingerprint,
  FileCode,
  Radar,
  Send,
  Cpu,
  ChevronRight,
  Lock,
  Globe,
  Terminal,
  Bug,
} from 'lucide-react';
import { statusConfig, severityColors } from '@/config/incidentConfig';

interface DisplayIncident {
  id: string;
  title: string;
  source: string;
  severity: string;
  status: string;
  assignee: string | null;
  created: string;
  createdTs: number;
  edited?: string;
  editedTs?: number;
  tlp?: string;
}

interface IncidentCardViewProps {
  incidents: DisplayIncident[];
  onIncidentClick?: (incident: DisplayIncident) => void;
  onFilterChange?: (type: 'severity' | 'status' | 'assignee', value: string) => void;
  getIncidentUrl?: (incident: DisplayIncident) => string;
}

// Status and severity colors now imported from @/config/incidentConfig

// Map incident types/sources to icons - more original choices
const getIncidentIcon = (source: string, title: string) => {
  const lowerTitle = title.toLowerCase();
  const lowerSource = source.toLowerCase();
  
  if (lowerTitle.includes('login') || lowerTitle.includes('auth') || lowerTitle.includes('block')) {
    return Fingerprint;
  }
  if (lowerTitle.includes('firewall') || lowerSource.includes('firewall')) {
    return Lock;
  }
  if (lowerTitle.includes('scan') || lowerTitle.includes('vulnerability')) {
    return Radar;
  }
  if (lowerTitle.includes('report') || lowerTitle.includes('email') || lowerTitle.includes('sent')) {
    return Send;
  }
  if (lowerTitle.includes('endpoint') || lowerTitle.includes('quarantine')) {
    return Cpu;
  }
  if (lowerTitle.includes('malware') || lowerTitle.includes('virus')) {
    return Bug;
  }
  if (lowerTitle.includes('network') || lowerSource.includes('network')) {
    return Globe;
  }
  if (lowerTitle.includes('code') || lowerTitle.includes('script')) {
    return FileCode;
  }
  return Terminal;
};

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `about ${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

export const IncidentCardView = ({ incidents, onIncidentClick, onFilterChange, getIncidentUrl }: IncidentCardViewProps) => {

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {incidents.map((incident, index) => {
        const IconComponent = getIncidentIcon(incident.source, incident.title);
        const statusInfo = statusConfig[incident.status] || statusConfig.new;
        const StatusIcon = statusInfo.icon;
        const severityColor = severityColors[incident.severity] || '#94a3b8';

        return (
          <motion.div
            key={incident.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
          >
            <Box
              component={getIncidentUrl ? Link : 'div'}
              to={getIncidentUrl ? getIncidentUrl(incident) : undefined}
              onClick={onIncidentClick ? () => onIncidentClick(incident) : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                borderRadius: 2,
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textDecoration: 'none',
                color: 'inherit',
                '&:hover': {
                  backgroundColor: 'hsl(var(--background-surface))',
                  borderColor: 'hsl(var(--border-subtle))',
                  transform: 'translateX(4px)',
                },
              }}
            >
              {/* Icon container */}
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${severityColor}15`,
                  border: `1px solid ${severityColor}30`,
                  flexShrink: 0,
                }}
              >
                <IconComponent size={22} color={severityColor} />
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {incident.title}
                  </Typography>
                  <StatusIcon size={16} color={statusInfo.color} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'hsl(var(--muted-foreground))' }}
                  >
                    {formatRelativeTime(incident.editedTs || incident.createdTs)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    •
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'hsl(var(--muted-foreground))' }}
                  >
                    {incident.source || 'Unknown'}
                  </Typography>
                  {incident.assignee && (
                    <>
                      <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                        •
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'hsl(var(--muted-foreground))' }}
                      >
                        {incident.assignee}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>

              {/* Chips */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Chip
                  label={incident.severity}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterChange?.('severity', incident.severity);
                  }}
                  sx={{
                    backgroundColor: `${severityColor}20`,
                    color: severityColor,
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    fontSize: '0.7rem',
                    height: 24,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: `${severityColor}35` },
                  }}
                />
                <Chip
                  label={statusInfo.label}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterChange?.('status', incident.status);
                  }}
                  sx={{
                    backgroundColor: statusInfo.bg,
                    color: statusInfo.color,
                    fontWeight: 500,
                    fontSize: '0.7rem',
                    height: 24,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 },
                  }}
                />
              </Box>

              {/* Chevron */}
              <ChevronRight size={20} color="hsl(var(--muted-foreground))" />
            </Box>
          </motion.div>
        );
      })}

      {incidents.length === 0 && (
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            No incidents found
          </Typography>
        </Box>
      )}
    </Box>
  );
};
