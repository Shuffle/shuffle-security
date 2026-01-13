// Shared incident status and severity configuration
// Used across IncidentCardView, IncidentsPage, IncidentDetailPage, and IncidentStatsCards

import { Clock, Zap, Flame, CheckCircle, LucideIcon } from 'lucide-react';

export const statusConfig: Record<string, { 
  icon: LucideIcon; 
  color: string; 
  bg: string; 
  label: string;
}> = {
  new: { 
    icon: Clock, 
    color: '#22b8cf', 
    bg: 'rgba(34, 184, 207, 0.15)',
    label: 'New',
  },
  in_progress: { 
    icon: Zap, 
    color: '#f97316', 
    bg: 'rgba(249, 115, 22, 0.15)',
    label: 'In Progress',
  },
  escalated: { 
    icon: Flame, 
    color: '#ef4444', 
    bg: 'rgba(239, 68, 68, 0.15)',
    label: 'Escalated',
  },
  resolved: { 
    icon: CheckCircle, 
    color: '#22c55e', 
    bg: 'rgba(34, 197, 94, 0.15)',
    label: 'Resolved',
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
