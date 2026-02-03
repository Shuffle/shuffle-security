import { Box, Typography, Chip, Checkbox } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useState } from 'react';

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
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  selectionMode?: boolean;
}

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

export const IncidentCardView = ({ 
  incidents, 
  onIncidentClick, 
  onFilterChange, 
  getIncidentUrl,
  selectedIds = new Set(),
  onSelectionChange,
  selectionMode = false,
}: IncidentCardViewProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleCheckboxChange = (id: string, checked: boolean, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    onSelectionChange?.(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === incidents.length) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(incidents.map(i => i.id)));
    }
  };

  const isSelected = (id: string) => selectedIds.has(id);
  const showCheckbox = (id: string) => selectionMode || selectedIds.size > 0 || hoveredId === id;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Select All row when in selection mode */}
      <AnimatePresence>
        {(selectionMode || selectedIds.size > 0) && incidents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: 1,
                backgroundColor: 'hsl(var(--muted) / 0.3)',
              }}
            >
              <Checkbox
                checked={selectedIds.size === incidents.length && incidents.length > 0}
                indeterminate={selectedIds.size > 0 && selectedIds.size < incidents.length}
                onChange={handleSelectAll}
                size="small"
                sx={{
                  color: 'hsl(var(--muted-foreground))',
                  '&.Mui-checked, &.MuiCheckbox-indeterminate': {
                    color: 'hsl(var(--primary))',
                  },
                }}
              />
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                {selectedIds.size === 0 
                  ? 'Select all' 
                  : selectedIds.size === incidents.length 
                    ? `All ${incidents.length} selected`
                    : `${selectedIds.size} selected`}
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {incidents.map((incident, index) => {
        const IconComponent = getIncidentIcon(incident.source, incident.title);
        const statusInfo = statusConfig[incident.status] || statusConfig.new;
        const StatusIcon = statusInfo.icon;
        const severityColor = severityColors[incident.severity] || '#94a3b8';
        const selected = isSelected(incident.id);
        const showCheck = showCheckbox(incident.id);

        return (
          <motion.div
            key={incident.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
            onMouseEnter={() => setHoveredId(incident.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <Box
              component={!showCheck && getIncidentUrl ? Link : 'div'}
              to={!showCheck && getIncidentUrl ? getIncidentUrl(incident) : undefined}
              onClick={showCheck ? undefined : (onIncidentClick ? () => onIncidentClick(incident) : undefined)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                borderRadius: 2,
                backgroundColor: selected 
                  ? 'hsl(var(--primary) / 0.08)' 
                  : 'hsl(var(--card))',
                border: '1px solid',
                borderColor: selected 
                  ? 'hsl(var(--primary) / 0.3)' 
                  : 'hsl(var(--border))',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textDecoration: 'none',
                color: 'inherit',
                '&:hover': {
                  backgroundColor: selected 
                    ? 'hsl(var(--primary) / 0.12)' 
                    : 'hsl(var(--background-surface))',
                  borderColor: selected 
                    ? 'hsl(var(--primary) / 0.4)' 
                    : 'hsl(var(--border-subtle))',
                  transform: showCheck ? 'none' : 'translateX(4px)',
                },
              }}
            >
              {/* Icon container with checkbox overlay on hover */}
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: showCheck 
                    ? 'transparent' 
                    : `${severityColor}15`,
                  border: showCheck 
                    ? 'none' 
                    : `1px solid ${severityColor}30`,
                  flexShrink: 0,
                  position: 'relative',
                }}
                onClick={(e) => {
                  if (showCheck) {
                    handleCheckboxChange(incident.id, !selected, e);
                  }
                }}
              >
                <AnimatePresence mode="wait">
                  {showCheck ? (
                    <motion.div
                      key="checkbox"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Checkbox
                        checked={selected}
                        size="medium"
                        sx={{
                          color: 'hsl(var(--muted-foreground))',
                          '&.Mui-checked': {
                            color: 'hsl(var(--primary))',
                          },
                          '& .MuiSvgIcon-root': {
                            fontSize: 28,
                          },
                        }}
                        onClick={(e) => handleCheckboxChange(incident.id, !selected, e)}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="icon"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <IconComponent size={22} color={severityColor} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>

              {/* Content */}
              <Box 
                sx={{ flex: 1, minWidth: 0 }}
                component={getIncidentUrl ? Link : 'div'}
                to={getIncidentUrl ? getIncidentUrl(incident) : undefined}
                onClick={(e) => {
                  if (selectedIds.size > 0) {
                    e.preventDefault();
                    handleCheckboxChange(incident.id, !selected, e);
                  }
                }}
              >
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
                    {incident.title || 'Untitled Incident'}
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
                  label={incident.severity || 'unknown'}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
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
                    e.preventDefault();
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

              {/* Chevron - hide when in selection mode */}
              {!showCheck && (
                <ChevronRight size={20} color="hsl(var(--muted-foreground))" />
              )}
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