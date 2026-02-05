// Shared incident status and severity configuration
// Used across IncidentCardView, IncidentsPage, IncidentDetailPage, and IncidentStatsCards

import { Clock, Zap, Flame, CheckCircle, PauseCircle, LucideIcon } from 'lucide-react';

export const statusConfig: Record<string, { 
  icon: LucideIcon; 
  color: string; 
  bg: string; 
  label: string;
  id: number; // OCSF status_id
}> = {
  new: { 
    icon: Clock, 
    color: '#3b82f6', 
    bg: 'rgba(59, 130, 246, 0.15)',
    label: 'New',
    id: 1,
  },
  in_progress: { 
    icon: Zap, 
    color: '#f97316', 
    bg: 'rgba(249, 115, 22, 0.15)',
    label: 'In Progress',
    id: 2,
  },
  resolved: { 
    icon: CheckCircle, 
    color: '#22c55e', 
    bg: 'rgba(34, 197, 94, 0.15)',
    label: 'Resolved',
    id: 3,
  },
  on_hold: { 
    icon: PauseCircle, 
    color: '#a855f7', 
    bg: 'rgba(168, 85, 247, 0.15)',
    label: 'On Hold',
    id: 4,
  },
  escalated: { 
    icon: Flame, 
    color: '#ef4444', 
    bg: 'rgba(239, 68, 68, 0.15)',
    label: 'Escalated',
    id: 5,
  },
};

export const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  informational: '#3b82f6',
};

export const severityOrder: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

// Helper to get status display info
export const getStatusDisplay = (status: string) => {
  const config = statusConfig[status];
  return config || { 
    icon: Clock, 
    color: '#94a3b8', 
    bg: 'rgba(148, 163, 184, 0.1)',
    label: status.replace('_', ' '),
  };
};
