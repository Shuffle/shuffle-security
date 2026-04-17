import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  TextField,
  Button,
  Skeleton,
  Tooltip,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PersonIcon from '@mui/icons-material/Person';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { toast } from 'sonner';
import { getDatastoreItem, setDatastoreItem, DATASTORE_CATEGORIES } from '@/services/datastore';
import { useAuth } from '@/context/AuthContext';
import {
  IncidentTask,
  taskCategories,
  severityOptions,
  mapOCSFSeverity,
  mapOCSFStatus,
} from '@/config/ocsfIncidentSchema';
import {
  statusConfig,
  severityColors,
  normalizeStatus,
  getOCSFStatus,
} from '@/config/incidentConfig';
import { htmlToPlainText, decodeIfBase64, isAIAssignee } from '@/lib/utils';

// ============================================================================
// Kanban column definition — tasks are grouped into 3 lanes
// ============================================================================
type LaneKey = 'todo' | 'in_progress' | 'done';
const LANES: { key: LaneKey; label: string; color: string }[] = [
  { key: 'todo', label: 'To Do', color: statusConfig.new.color },
  { key: 'in_progress', label: 'In Progress', color: statusConfig.in_progress.color },
  { key: 'done', label: 'Done', color: statusConfig.resolved.color },
];

/** Determine which kanban lane a task belongs to. */
const getLane = (task: IncidentTask): LaneKey => {
  if (task.completed) return 'done';
  if (task.aiWorking || task.assignee) return 'in_progress';
  return 'todo';
};

/** Apply lane semantics to a task when it's moved between columns. */
const applyLane = (task: IncidentTask, lane: LaneKey): IncidentTask => {
  if (lane === 'done') {
    return { ...task, completed: true, completedAt: task.completedAt || Date.now() };
  }
  if (lane === 'in_progress') {
    return { ...task, completed: false, completedAt: 0 };
  }
  // todo: clear assignee/aiWorking only if it was the reason it was in_progress
  return { ...task, completed: false, completedAt: 0 };
};

interface IncidentSnapshot {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assignee: string;
  source?: string;
  createdTs: number;
  rawOCSF: any;
}

const IncidentSimplePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userInfo } = useAuth();
  const currentUser = userInfo?.username || 'You';

  const [loading, setLoading] = useState(true);
  const [incident, setIncident] = useState<IncidentSnapshot | null>(null);
  const [tasks, setTasks] = useState<IncidentTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<LaneKey | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(true);

  // Persist left-panel collapsed state per-user across sessions.
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('incidents-simple:leftCollapsed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('incidents-simple:leftCollapsed', leftCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [leftCollapsed]);

  // ==========================================================================
  // Load incident from datastore
  // ==========================================================================
  const loadIncident = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS);
      if (!result.success || !result.item?.value) {
        toast.error('Incident not found');
        setLoading(false);
        return;
      }
      const data = JSON.parse(result.item.value);
      const customAttrs = data?.metadata?.extensions?.custom_attributes;
      const findingInfo = data.finding_info_list?.[0] || data.finding_info;

      const rawDesc = data.desc || data.message || '';
      const decoded = decodeIfBase64(rawDesc);
      const description = htmlToPlainText(decoded);

      const sevId = data.severity_id ?? 3;
      const statusRaw = data.status || mapOCSFStatus(data.status_id ?? 1);
      const assigneeRaw = customAttrs?.assignee || data.assignee || '';

      const loadedTasks: IncidentTask[] =
        data.tasks || customAttrs?.tasks || [];
      const normalized = loadedTasks
        .filter((t) => !t.disabled)
        .map((t, i) => ({ ...t, id: t.id || `task-${Date.now()}-${i}` }));

      setIncident({
        id,
        title: data.title || findingInfo?.title || 'Untitled Incident',
        description,
        severity: mapOCSFSeverity(sevId),
        status: normalizeStatus(statusRaw),
        assignee: isAIAssignee(assigneeRaw) ? 'AI Agent' : assigneeRaw,
        source: data.product?.name || data.metadata?.product?.name,
        createdTs:
          (data.created_time ? new Date(data.created_time).getTime() : 0) ||
          (result.item.created ? Number(result.item.created) * 1000 : Date.now()),
        rawOCSF: data,
      });
      setTasks(normalized);
      // Skip the immediately-following auto-save triggered by this state hydration.
      skipNextSaveRef.current = true;
    } catch (err) {
      console.error('[IncidentSimple] Load failed:', err);
      toast.error('Failed to load incident');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  // ==========================================================================
  // Persist tasks back to the datastore (debounced).
  // ==========================================================================
  useEffect(() => {
    if (!incident) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const updated = {
        ...incident.rawOCSF,
        tasks,
        metadata: {
          ...incident.rawOCSF?.metadata,
          extensions: {
            ...incident.rawOCSF?.metadata?.extensions,
            custom_attributes: {
              ...incident.rawOCSF?.metadata?.extensions?.custom_attributes,
              tasks,
            },
          },
        },
      };
      try {
        const res = await setDatastoreItem(
          incident.id,
          updated,
          DATASTORE_CATEGORIES.INCIDENTS,
        );
        if (!res.success) toast.error('Failed to save tasks');
      } catch (err) {
        console.error('[IncidentSimple] Save failed:', err);
      }
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // ==========================================================================
  // Task mutations
  // ==========================================================================
  const handleAddTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    const t: IncidentTask = {
      id: `task-${Date.now()}`,
      title,
      completed: false,
      createdAt: Date.now(),
      createdBy: currentUser,
    };
    setTasks((prev) => [...prev, t]);
    setNewTaskTitle('');
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, disabled: true } : t)).filter((t) => !t.disabled),
    );
  };

  const handleDropToLane = (lane: LaneKey) => {
    if (!draggedTaskId) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === draggedTaskId ? applyLane(t, lane) : t)),
    );
    setDraggedTaskId(null);
    setHoverLane(null);
  };

  const tasksByLane = useMemo(() => {
    const groups: Record<LaneKey, IncidentTask[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) groups[getLane(t)].push(t);
    return groups;
  }, [tasks]);

  // ==========================================================================
  // Render
  // ==========================================================================
  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', gap: 3 }}>
        <Skeleton variant="rounded" width={420} height={520} />
        <Box sx={{ flex: 1, display: 'flex', gap: 2 }}>
          {LANES.map((l) => (
            <Skeleton key={l.key} variant="rounded" sx={{ flex: 1, height: 520 }} />
          ))}
        </Box>
      </Box>
    );
  }

  if (!incident) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Incident not found
        </Typography>
        <Button onClick={() => navigate('/incidents')} startIcon={<ArrowBackIcon />}>
          Back to incidents
        </Button>
      </Box>
    );
  }

  const sevColor = severityColors[incident.severity] || severityColors.medium;
  const statusInfo = statusConfig[incident.status] || statusConfig.new;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: 'calc(100vh - 64px)', bgcolor: 'hsl(var(--background))' }}>
      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/incidents')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          Simple view
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Open full incident view">
          <Button
            component={Link}
            to={`/incidents/${incident.id}`}
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            sx={{ height: 36, textTransform: 'none' }}
          >
            Full view
          </Button>
        </Tooltip>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '380px 1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* ====================================================================
            LEFT: Floating paper with incident details
            ==================================================================== */}
        <Paper
          elevation={6}
          sx={{
            p: 3,
            borderRadius: 2,
            position: { md: 'sticky' },
            top: { md: 96 },
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label={incident.severity.toUpperCase()}
              sx={{
                bgcolor: `${sevColor}22`,
                color: sevColor,
                fontWeight: 600,
                height: 24,
              }}
            />
            <Chip
              size="small"
              icon={<statusInfo.icon size={14} color={statusInfo.color} />}
              label={statusInfo.label}
              sx={{
                bgcolor: statusInfo.bg,
                color: statusInfo.color,
                fontWeight: 600,
                height: 24,
                '& .MuiChip-icon': { color: statusInfo.color },
              }}
            />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, lineHeight: 1.3 }}>
            {incident.title}
          </Typography>

          {incident.source && (
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Source · {incident.source}
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonIcon sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }} />
            <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))' }}>
              {incident.assignee || 'Unassigned'}
            </Typography>
          </Box>

          <Typography
            variant="caption"
            sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', mb: 0.5 }}
          >
            Description
          </Typography>
          <Box
            sx={{
              maxHeight: 320,
              overflowY: 'auto',
              p: 1.5,
              bgcolor: 'hsl(var(--muted) / 0.3)',
              borderRadius: 1,
              border: '1px solid hsl(var(--border))',
              fontSize: 13,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              color: 'hsl(var(--foreground))',
            }}
          >
            {incident.description || <em style={{ opacity: 0.6 }}>No description provided.</em>}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                Tasks
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {tasksByLane.done.length}/{tasks.length}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                Created
              </Typography>
              <Typography variant="body2">
                {incident.createdTs
                  ? new Date(incident.createdTs).toLocaleDateString()
                  : '—'}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* ====================================================================
            RIGHT: Kanban board
            ==================================================================== */}
        <Box>
          {/* New task bar */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              mb: 2,
              p: 1.5,
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 2,
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Add a task… (drag between columns to update status)"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
              }}
            />
            <Button
              variant="contained"
              onClick={handleAddTask}
              startIcon={<AddIcon />}
              sx={{ height: 36, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              Add task
            </Button>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {LANES.map((lane) => {
              const items = tasksByLane[lane.key];
              const isHover = hoverLane === lane.key;
              return (
                <Box
                  key={lane.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (hoverLane !== lane.key) setHoverLane(lane.key);
                  }}
                  onDragLeave={() => setHoverLane((p) => (p === lane.key ? null : p))}
                  onDrop={() => handleDropToLane(lane.key)}
                  sx={{
                    bgcolor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 2,
                    p: 1.5,
                    minHeight: 460,
                    transition: 'background-color 120ms, border-color 120ms',
                    ...(isHover && {
                      bgcolor: `${lane.color}10`,
                      borderColor: lane.color,
                    }),
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1.5,
                      px: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: lane.color,
                      }}
                    />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {lane.label}
                    </Typography>
                    <Chip
                      size="small"
                      label={items.length}
                      sx={{ height: 20, fontSize: 11, ml: 'auto' }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {items.length === 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'hsl(var(--muted-foreground))',
                          textAlign: 'center',
                          py: 4,
                          opacity: 0.7,
                        }}
                      >
                        Drop tasks here
                      </Typography>
                    )}
                    {items.map((task) => {
                      const cat = taskCategories.find((c) => c.value === task.category);
                      return (
                        <Box
                          key={task.id}
                          draggable
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setHoverLane(null);
                          }}
                          sx={{
                            p: 1.25,
                            bgcolor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 1.5,
                            cursor: 'grab',
                            opacity: draggedTaskId === task.id ? 0.4 : 1,
                            transition: 'box-shadow 120ms, transform 120ms',
                            '&:hover': {
                              boxShadow: 2,
                              borderColor: 'hsl(var(--primary) / 0.4)',
                            },
                            '&:active': { cursor: 'grabbing' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                            <DragIndicatorIcon
                              sx={{
                                fontSize: 16,
                                color: 'hsl(var(--muted-foreground))',
                                mt: 0.25,
                              }}
                            />
                            <Typography
                              variant="body2"
                              sx={{
                                flex: 1,
                                fontWeight: 500,
                                textDecoration: task.completed ? 'line-through' : 'none',
                                color: task.completed
                                  ? 'hsl(var(--muted-foreground))'
                                  : 'hsl(var(--foreground))',
                              }}
                            >
                              {task.title}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteTask(task.id)}
                              sx={{ p: 0.25 }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>
                          {(cat || task.assignee) && (
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 1, ml: 2.5, flexWrap: 'wrap' }}>
                              {cat && (
                                <Chip
                                  size="small"
                                  label={cat.label}
                                  sx={{
                                    height: 18,
                                    fontSize: 10,
                                    bgcolor: `${cat.color}22`,
                                    color: cat.color,
                                  }}
                                />
                              )}
                              {task.assignee && (
                                <Chip
                                  size="small"
                                  icon={<PersonIcon sx={{ fontSize: 11 }} />}
                                  label={task.assignee}
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              )}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default IncidentSimplePage;
