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
import RefreshIcon from '@mui/icons-material/Refresh';
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
import { IncidentActionsMenu } from '@/components/incidents/IncidentActionsMenu';
import { IncidentMetaChips } from '@/components/incidents/IncidentMetaChips';
import { useSourceAppImage } from '@/hooks/useSourceAppImage';
import { useTaskStatuses } from '@/hooks/useEntityLabel';
import {
  ResolveIncidentDialog,
  ResolutionData,
  RESOLUTION_REASONS,
} from '@/components/incidents/ResolveIncidentDialog';
import { TaskEditDialog } from '@/components/incidents/TaskEditDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ============================================================================
// Kanban column definition — lanes are configured per-org via Org Preferences.
// `done` is a reserved key that maps to `task.completed === true`. All other
// lanes are stored on the task as a `_lane` marker. The first non-`done` lane
// in the configured list is treated as the default for unmarked tasks.
// ============================================================================
type LaneKey = string;

/**
 * Determine which kanban lane a task belongs to.
 *
 * Tasks don't have an explicit `status` field in OCSF, so we derive lane
 * membership from existing fields:
 *  - `completed: true` → `done`
 *  - explicit `_lane` marker that matches a configured key → that lane
 *  - has `aiWorking` / `assignee` → second-from-top lane (the conventional
 *    "in progress" slot) if present, else default
 *  - otherwise → first lane (the conventional "to do" slot)
 */
const getLane = (
  task: IncidentTask & { _lane?: LaneKey },
  laneKeys: LaneKey[],
): LaneKey => {
  if (task.completed) return 'done';
  if (task._lane && laneKeys.includes(task._lane)) return task._lane;
  const openLanes = laneKeys.filter((k) => k !== 'done');
  // Heuristic for legacy tasks created before the lane marker existed.
  if ((task.aiWorking || task.assignee) && openLanes.length > 1) {
    return openLanes[1];
  }
  return openLanes[0] || laneKeys[0];
};

/**
 * Apply lane semantics to a task when it's moved between columns.
 *
 * The explicit `_lane` marker keeps drag deterministic — without it, an
 * assigned task dragged back to "To Do" would immediately bounce because
 * `getLane` would re-derive it from the assignee.
 */
const applyLane = (
  task: IncidentTask & { _lane?: LaneKey },
  lane: LaneKey,
): IncidentTask & { _lane?: LaneKey } => {
  if (lane === 'done') {
    return { ...task, _lane: 'done', completed: true, completedAt: task.completedAt || Date.now() };
  }
  return { ...task, _lane: lane, completed: false, completedAt: 0, aiWorking: false };
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
  // Manual refresh — distinct from initial load so we don't show the skeleton.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [incident, setIncident] = useState<IncidentSnapshot | null>(null);
  // Org-configured kanban lanes. Memoised lane keys keep the getLane call cheap.
  const taskStatuses = useTaskStatuses();
  const laneKeys = useMemo(() => taskStatuses.map((s) => s.key), [taskStatuses]);
  const [tasks, setTasks] = useState<IncidentTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<LaneKey | null>(null);
  // Single-task edit modal
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  // Delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(true);

  // Inline meta editing (severity / status / assignee). The detail page tracks
  // these in separate "edited*" state — we mirror that here so the chips behave
  // identically and writes are immediate (no debounce) for snappier feedback.
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // App logo for the incident source — shared with the detail page.
  const sourceAppImage = useSourceAppImage(incident?.source);

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
  const loadIncident = useCallback(async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    try {
      const result = await getDatastoreItem(id, DATASTORE_CATEGORIES.INCIDENTS);
      if (!result.success || !result.item?.value) {
        toast.error('Incident not found');
        if (showLoading) setLoading(false);
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
      if (showLoading) setLoading(false);
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
  // Persist a metadata patch (severity/status/assignee) immediately. Mirrors
  // the save shape used by IncidentDetailPage so both views stay schema-aligned.
  // ==========================================================================
  const saveMetaPatch = useCallback(
    async (patch: { severity?: string; status?: string; assignee?: string }) => {
      if (!incident) return;
      setIsSavingMeta(true);

      const nextSeverity = patch.severity ?? incident.severity;
      const nextStatusKey = patch.status ?? incident.status;
      const nextAssignee = patch.assignee ?? incident.assignee;

      const sevOption = severityOptions.find((s) => s.value === nextSeverity);
      const { label: statusLabel, id: statusId } = getOCSFStatus(nextStatusKey);

      const updated = incident.rawOCSF
        ? {
            ...incident.rawOCSF,
            severity_id: sevOption?.id ?? incident.rawOCSF.severity_id,
            severity: sevOption?.label ?? incident.rawOCSF.severity,
            status_id: statusId,
            status: statusLabel,
            assignee: nextAssignee || '',
            metadata: {
              ...incident.rawOCSF.metadata,
              extensions: {
                ...incident.rawOCSF.metadata?.extensions,
                custom_attributes: {
                  ...incident.rawOCSF.metadata?.extensions?.custom_attributes,
                  assignee: nextAssignee || '',
                },
              },
            },
          }
        : {
            id: incident.id,
            title: incident.title,
            severity: nextSeverity,
            status: nextStatusKey,
            assignee: nextAssignee || '',
          };

      setIncident({
        ...incident,
        severity: nextSeverity,
        status: nextStatusKey,
        assignee: isAIAssignee(nextAssignee) ? 'AI Agent' : nextAssignee,
        rawOCSF: updated,
      });
      // Suppress the next tasks-save effect — that hook re-fires on incident changes
      skipNextSaveRef.current = true;

      try {
        const res = await setDatastoreItem(
          incident.id,
          updated,
          DATASTORE_CATEGORIES.INCIDENTS,
        );
        if (!res.success) toast.error('Failed to save changes');
      } catch (err) {
        console.error('[IncidentSimple] Meta save failed:', err);
        toast.error('Failed to save changes');
      } finally {
        setIsSavingMeta(false);
      }
    },
    [incident],
  );

  // ==========================================================================
  // Resolve flow — uses the same dialog as the detail page.
  // ==========================================================================
  const handleResolve = useCallback(
    async (resolutionData: ResolutionData) => {
      if (!incident) return;
      setIsSavingMeta(true);
      const reasonLabel =
        RESOLUTION_REASONS.find((r) => r.value === resolutionData.reason)?.label ||
        resolutionData.reason;
      const existingActivity =
        incident.rawOCSF?.activity ||
        incident.rawOCSF?.metadata?.extensions?.custom_attributes?.activity ||
        [];
      const resolveActivity = {
        id: `status-${Date.now()}`,
        type: 'status' as const,
        user: currentUser,
        timestamp: Date.now(),
        content: `Resolved: ${reasonLabel}${resolutionData.notes ? ` - ${resolutionData.notes}` : ''}`,
        details: {},
        attachments: [],
      };
      const updated = {
        ...(incident.rawOCSF || { id: incident.id, title: incident.title }),
        status_id: 3,
        status: 'Resolved',
        status_detail: `${resolutionData.reason}${resolutionData.notes ? `: ${resolutionData.notes}` : ''}`,
        activity: [...existingActivity, resolveActivity],
        metadata: {
          ...incident.rawOCSF?.metadata,
          extensions: {
            ...incident.rawOCSF?.metadata?.extensions,
            custom_attributes: {
              ...incident.rawOCSF?.metadata?.extensions?.custom_attributes,
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
        if (!res.success) {
          toast.error('Failed to resolve');
          return;
        }
        toast.success('Incident resolved');
        setShowResolveDialog(false);
        navigate('/incidents');
      } catch {
        toast.error('Failed to resolve');
      } finally {
        setIsSavingMeta(false);
      }
    },
    [incident, currentUser, navigate],
  );

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

  // Soft-delete: marks task as disabled and filters it out of the visible list.
  // Always called via the AlertDialog confirmation flow.
  const confirmDeleteTask = () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, disabled: true } : t)).filter((t) => !t.disabled),
    );
    setPendingDeleteId(null);
  };

  // Update a single task in-place (used by TaskEditDialog).
  const handleTaskUpdate = (updated: IncidentTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
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
    // Build an empty bucket per configured lane so missing lanes still render.
    const groups: Record<string, IncidentTask[]> = Object.fromEntries(
      laneKeys.map((k) => [k, [] as IncidentTask[]]),
    );
    for (const t of tasks) {
      const laneKey = getLane(t, laneKeys);
      // Defensive — if a stale `_lane` value points to a removed lane, the
      // task lands in the first lane (or `done` if it was completed).
      (groups[laneKey] || groups[laneKeys[0]] || []).push(t);
    }
    return groups;
  }, [tasks, laneKeys]);

  // ==========================================================================
  // Render
  // ==========================================================================
  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', gap: 3 }}>
        <Skeleton variant="rounded" width={420} height={520} />
        <Box sx={{ flex: 1, display: 'flex', gap: 2 }}>
          {taskStatuses.map((l) => (
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
        {/* Refresh — same UI/behaviour as the Refresh button on /incidents/<id> */}
        <Tooltip title="Refresh">
          <span>
            <IconButton
              size="small"
              onClick={async () => {
                setIsRefreshing(true);
                await loadIncident(false);
                setIsRefreshing(false);
              }}
              disabled={loading || isRefreshing}
              sx={{
                border: '1px solid hsl(var(--border))',
                borderRadius: 1,
                width: 36,
                height: 36,
              }}
            >
              <RefreshIcon
                fontSize="small"
                sx={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
        <IncidentActionsMenu
          incident={{
            id: incident.id,
            title: incident.title,
            source: incident.source,
            status: incident.status,
            rawOCSF: incident.rawOCSF,
          }}
          showSimpleViewEntry={false}
          showFullViewEntry
          publicAuthorization={incident.rawOCSF?.public_authorization || ''}
          onAfterChange={() => loadIncident()}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: leftCollapsed ? '64px 1fr' : '380px 1fr',
          },
          gap: 3,
          alignItems: 'start',
          transition: 'grid-template-columns 200ms ease',
        }}
      >
        {/* ====================================================================
            LEFT: Floating paper with incident details (collapsible horizontally)
            ==================================================================== */}
        <Paper
          elevation={6}
          sx={{
            // Top padding leaves room for the absolutely-positioned source app
            // avatar, which sits half-overlapping the top edge of the paper
            // (and visually overlaps the page top bar above it).
            p: leftCollapsed ? 1 : 3,
            pt: leftCollapsed ? 1 : 5,
            borderRadius: 2,
            position: { xs: 'relative', md: 'sticky' },
            top: { md: 96 },
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            transition: 'padding 200ms ease',
            // overflow visible so the floating avatar can extend above the paper
            overflow: 'visible',
          }}
        >
          {/* Source app icon — absolutely positioned to overlap the top edge of
              the sidebar (visually overlapping the page top bar above it).
              A strong visual anchor for "where this came from". Hidden in the
              collapsed rail since the rail already shows source-related icons. */}
          {sourceAppImage && !leftCollapsed && (
            <Tooltip title={incident.source || ''} placement="top">
              <Box
                sx={{
                  position: 'absolute',
                  top: -28,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'hsl(var(--card))',
                  // Thicker ring + outer glow makes the avatar float above the
                  // panel rather than appear glued to it.
                  border: '2px solid hsl(var(--border))',
                  boxShadow: '0 6px 18px hsl(0 0% 0% / 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  zIndex: 2,
                  transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                  '&:hover': {
                    transform: 'translateX(-50%) scale(1.06)',
                    borderColor: 'hsl(var(--primary) / 0.6)',
                    boxShadow: '0 8px 22px hsl(var(--primary) / 0.3)',
                  },
                }}
              >
                <img
                  src={sourceAppImage}
                  alt={incident.source || ''}
                  // Fill the avatar — `cover` crops to the circle so square app
                  // logos no longer float as a small tile inside a big ring.
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </Box>
            </Tooltip>
          )}

          {/* Collapse toggle — absolute top-right in the expanded view so it
              doesn't push meta chips down. In the collapsed rail it stays
              inline (centered) since there's nothing to collide with.
              Tooltip placement=right prevents clipping by the page top bar. */}
          {leftCollapsed ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
              <Tooltip title="Expand details" placement="right">
                <IconButton size="small" onClick={() => setLeftCollapsed(false)} sx={{ p: 0.5 }}>
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Tooltip title="Collapse details" placement="right">
              <IconButton
                size="small"
                onClick={() => setLeftCollapsed(true)}
                sx={{ position: 'absolute', top: 8, right: 8, p: 0.5, zIndex: 3 }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {leftCollapsed ? (
            // ---- Minimised: just the essentials, vertically stacked ----
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Tooltip title={`Severity: ${incident.severity}`} placement="right">
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: sevColor,
                  }}
                />
              </Tooltip>
              <Tooltip title={`Status: ${statusInfo.label}`} placement="right">
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: statusInfo.bg,
                    color: statusInfo.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <statusInfo.icon size={14} />
                </Box>
              </Tooltip>
              <Tooltip title={incident.assignee || 'Unassigned'} placement="right">
                <PersonIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
              </Tooltip>
              <Tooltip title={`${(tasksByLane.done?.length || 0)}/${tasks.length} tasks done`} placement="right">
                <Chip
                  size="small"
                  label={`${(tasksByLane.done?.length || 0)}/${tasks.length}`}
                  sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                />
              </Tooltip>
            </Box>
          ) : (
            // ---- Expanded: full details ----
            <>
              {/* Editable status / severity / assignee chips — same component as /incidents.
                  singleLine + tight maxWidth keeps them on ONE row regardless of username length. */}
              <Box sx={{ mb: 2, minWidth: 0 }}>
                <IncidentMetaChips
                  status={incident.status}
                  severity={incident.severity}
                  assignee={incident.assignee}
                  onStatusChange={(v) => saveMetaPatch({ status: v })}
                  onSeverityChange={(v) => saveMetaPatch({ severity: v })}
                  onAssigneeChange={(v) => saveMetaPatch({ assignee: v })}
                  onResolveRequest={() => setShowResolveDialog(true)}
                  assigneeMaxWidth={140}
                  singleLine
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {incident.title}
                  </Typography>
                  {incident.source && !sourceAppImage && (
                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                      Source · {incident.source}
                    </Typography>
                  )}
                </Box>
                {isSavingMeta && (
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    Saving…
                  </Typography>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

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
                    {(tasksByLane.done?.length || 0)}/{tasks.length}
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
            </>
          )}
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
              gridTemplateColumns: {
                xs: '1fr',
                // Auto-fit columns so 2/4/5/6+ configured lanes lay out cleanly
                // without hardcoding `repeat(3, 1fr)`.
                md: `repeat(${Math.max(taskStatuses.length, 1)}, minmax(0, 1fr))`,
              },
              gap: 2,
            }}
          >
            {taskStatuses.map((lane) => {
              const items = tasksByLane[lane.key] || [];
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
                          onClick={() => setEditingTaskId(task.id)}
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
                              onClick={(e) => {
                                // Stop propagation so the card's onClick doesn't
                                // also open the edit dialog underneath.
                                e.stopPropagation();
                                setPendingDeleteId(task.id);
                              }}
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

      <ResolveIncidentDialog
        open={showResolveDialog}
        onClose={() => setShowResolveDialog(false)}
        onResolve={handleResolve}
        incidentTitle={incident.title}
        isLoading={isSavingMeta}
      />

      {/* Single-task editor — reuses the exact TaskEditor component as /incidents */}
      <TaskEditDialog
        open={!!editingTaskId}
        onClose={() => setEditingTaskId(null)}
        task={tasks.find((t) => t.id === editingTaskId) || null}
        onTaskChange={handleTaskUpdate}
        incidentId={incident.id}
      />

      {/* Delete confirmation — required so a stray click doesn't drop tasks */}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(o) => !o && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the task from this incident. You can't undo this from the simple view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
};

export default IncidentSimplePage;
