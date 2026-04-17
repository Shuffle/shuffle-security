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
import { TaskKanbanBoard } from '@/components/incidents/TaskKanbanBoard';


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
  // Public sharing token lives on the datastore item envelope (sibling to
  // `value`), NOT inside the OCSF payload — capture it separately so the
  // Share dialog can build a working public link.
  const [publicAuthorization, setPublicAuthorization] = useState<string>('');
  const [tasks, setTasks] = useState<IncidentTask[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounces network writes for meta-patch (severity / status / assignee).
  // The local state still updates instantly, but the actual fetch is coalesced
  // so rapid changes (e.g. picking a different option twice) result in one
  // request, not three. Mirrors the pattern used by the tasks-save effect.
  const metaSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      setPublicAuthorization(result.item.public_authorization || '');
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
        toast.error('Failed to save tasks — check your connection');
      }
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // ==========================================================================
  // Persist a metadata patch (severity/status/assignee).
  //
  // The local state updates IMMEDIATELY so chips reflect the user's choice
  // without waiting for the network. The actual write is debounced (500ms)
  // and coalesces rapid edits — picking severity → status in quick succession
  // results in a single PUT that carries both changes. Mirrors the tasks-save
  // pattern below.
  // ==========================================================================
  const saveMetaPatch = useCallback(
    (patch: { severity?: string; status?: string; assignee?: string }) => {
      if (!incident) return;

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

      // Optimistic local update — chips re-render right away.
      setIncident({
        ...incident,
        severity: nextSeverity,
        status: nextStatusKey,
        assignee: isAIAssignee(nextAssignee) ? 'AI Agent' : nextAssignee,
        rawOCSF: updated,
      });
      // The tasks-save effect re-fires on incident changes — skip it so we
      // don't double-write (this hook is the one writing).
      skipNextSaveRef.current = true;

      // Debounce the actual network write. Subsequent calls within 500ms
      // replace the pending payload (which is fine — `updated` already merges
      // patch onto the latest local state via the closure).
      if (metaSaveTimeoutRef.current) clearTimeout(metaSaveTimeoutRef.current);
      setIsSavingMeta(true);
      metaSaveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await setDatastoreItem(
            incident.id,
            updated,
            DATASTORE_CATEGORIES.INCIDENTS,
          );
          if (!res.success) toast.error('Failed to save changes');
        } catch (err) {
          console.error('[IncidentSimple] Meta save failed:', err);
          toast.error('Failed to save changes — check your connection');
        } finally {
          setIsSavingMeta(false);
        }
      }, 500);
    },
    [incident],
  );

  // Cleanup pending meta-save timeout on unmount so a stale write doesn't fire
  // after the user has navigated away.
  useEffect(() => {
    return () => {
      if (metaSaveTimeoutRef.current) clearTimeout(metaSaveTimeoutRef.current);
    };
  }, []);


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
  // Derived counts (kanban DnD / mutations now live in <TaskKanbanBoard />)
  // ==========================================================================
  const taskStatuses = useTaskStatuses();
  const doneCount = useMemo(
    () => tasks.filter((t) => t.completed).length,
    [tasks],
  );

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
    <Box
      sx={{
        // Tighter horizontal padding on narrow screens — every pixel counts
        // when the kanban has 3+ lanes. Centered with a generous max-width on
        // very large monitors so the layout doesn't sprawl edge-to-edge.
        px: { xs: 1.5, sm: 2, md: 3, xl: 4 },
        py: { xs: 2, md: 3 },
        maxWidth: 1800,
        mx: 'auto',
        minHeight: 'calc(100vh - 64px)',
        bgcolor: 'hsl(var(--background))',
      }}
    >
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
          publicAuthorization={publicAuthorization}
          onAfterChange={() => loadIncident()}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            // Narrower left column on mid-size screens so the kanban gets the
            // breathing room it needs (3+ lanes get crushed otherwise).
            md: leftCollapsed ? '56px 1fr' : '300px 1fr',
            lg: leftCollapsed ? '64px 1fr' : '360px 1fr',
            xl: leftCollapsed ? '64px 1fr' : '380px 1fr',
          },
          // Smaller gap on tighter viewports — 24px between the rail and the
          // first lane was eating real estate on ~840px screens.
          gap: { xs: 1.5, md: 2, lg: 3 },
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
              <Tooltip title={`${doneCount}/${tasks.length} tasks done`} placement="right">
                <Chip
                  size="small"
                  label={`${doneCount}/${tasks.length}`}
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
                    {doneCount}/{tasks.length}
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
            RIGHT: Kanban board (shared component, also used on /incidents)
            ==================================================================== */}
        <Box>
          <TaskKanbanBoard
            tasks={tasks}
            onTasksChange={(next) => setTasks(next)}
            incidentId={incident.id}
            currentUser={currentUser}
          />
        </Box>
      </Box>

      <ResolveIncidentDialog
        open={showResolveDialog}
        onClose={() => setShowResolveDialog(false)}
        onResolve={handleResolve}
        incidentTitle={incident.title}
        isLoading={isSavingMeta}
      />

    </Box>
  );
};

export default IncidentSimplePage;
