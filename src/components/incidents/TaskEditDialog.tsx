import { useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Box,
  Typography,
  Button,
  Tooltip,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { TaskEditor } from './TaskEditor';
import { IncidentTask, taskCategories } from '@/config/ocsfIncidentSchema';

interface TaskEditDialogProps {
  open: boolean;
  onClose: () => void;
  task: IncidentTask | null;
  onTaskChange: (updated: IncidentTask) => void;
  incidentId?: string;
  /** Ordered list of tasks in the *current visible context* (e.g. the lane the
   *  user opened the task from). When provided, the dialog shows Prev / Next
   *  arrows that walk through the list — much faster than closing → reopening. */
  siblings?: IncidentTask[];
  /** Open another task in the dialog. Wired by the parent to swap `task`. */
  onNavigate?: (taskId: string) => void;
}

/**
 * Single-task editor presented as a focused, spacious modal.
 *
 * Re-uses the same TaskEditor component as the /incidents detail page so
 * editing semantics stay 1:1 between simple and full views — but wraps it in
 * a wider shell with a stronger header (lane context, position, prev/next
 * arrows + arrow-key shortcuts) so the popup feels like a dedicated workspace
 * rather than a cramped form.
 */
export const TaskEditDialog = ({
  open,
  onClose,
  task,
  onTaskChange,
  incidentId,
  siblings,
  onNavigate,
}: TaskEditDialogProps) => {
  const handleTasksChange = (updated: IncidentTask[]) => {
    if (!task) return;
    const found = updated.find((t) => t.id === task.id);
    if (found) onTaskChange(found);
  };

  // Position within the sibling list — drives the header counter and which
  // prev/next arrows are enabled.
  const { index, prevTask, nextTask } = useMemo(() => {
    if (!task || !siblings || siblings.length === 0) {
      return { index: -1, prevTask: null as IncidentTask | null, nextTask: null as IncidentTask | null };
    }
    const i = siblings.findIndex((t) => t.id === task.id);
    return {
      index: i,
      prevTask: i > 0 ? siblings[i - 1] : null,
      nextTask: i >= 0 && i < siblings.length - 1 ? siblings[i + 1] : null,
    };
  }, [task, siblings]);

  // Keyboard navigation — Alt+Arrow keeps it from clashing with text selection
  // inside the editor's title/description fields.
  useEffect(() => {
    if (!open || !onNavigate) return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowLeft' && prevTask) {
        e.preventDefault();
        onNavigate(prevTask.id);
      } else if (e.key === 'ArrowRight' && nextTask) {
        e.preventDefault();
        onNavigate(nextTask.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, prevTask, nextTask, onNavigate]);

  if (!task) return null;

  const categoryInfo = taskCategories.find((c) => c.value === task.category);
  const showNav = !!siblings && siblings.length > 1 && !!onNavigate;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          // Generous min-height so the modal feels like a workspace even for
          // tasks with little content yet.
          minHeight: '60vh',
        },
      }}
    >
      {/* Hero header — task title is shown as a strong H6, with the lane /
          category as context above it. Prev/Next live on the right so the
          user always knows where they are in the column. */}
      <DialogTitle
        sx={{
          p: 0,
          borderBottom: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--background) / 0.5)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              {categoryInfo && (
                <Chip
                  size="small"
                  label={categoryInfo.label}
                  sx={{
                    height: 20,
                    fontSize: 10,
                    fontWeight: 600,
                    bgcolor: `${categoryInfo.color}22`,
                    color: categoryInfo.color,
                  }}
                />
              )}
              {task.completed && (
                <Chip
                  size="small"
                  label="Completed"
                  sx={{
                    height: 20,
                    fontSize: 10,
                    fontWeight: 600,
                    bgcolor: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                  }}
                />
              )}
              {showNav && (
                <Typography
                  variant="caption"
                  sx={{ color: 'hsl(var(--muted-foreground))', ml: 'auto' }}
                >
                  Task {index + 1} of {siblings!.length}
                </Typography>
              )}
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'hsl(var(--foreground))',
              }}
            >
              {task.title || 'Untitled task'}
            </Typography>
          </Box>

          {/* Prev / Next — disabled at list boundaries. Tooltip surfaces the
              Alt+Arrow shortcut so power users discover it. */}
          {showNav && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title={prevTask ? `Previous · ${prevTask.title}  (Alt+←)` : 'No previous task'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => prevTask && onNavigate?.(prevTask.id)}
                    disabled={!prevTask}
                    sx={{
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 1,
                      width: 32,
                      height: 32,
                    }}
                  >
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={nextTask ? `Next · ${nextTask.title}  (Alt+→)` : 'No next task'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => nextTask && onNavigate?.(nextTask.id)}
                    disabled={!nextTask}
                    sx={{
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 1,
                      width: 32,
                      height: 32,
                    }}
                  >
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          )}

          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              border: '1px solid hsl(var(--border))',
              borderRadius: 1,
              width: 32,
              height: 32,
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <TaskEditor
          tasks={[task]}
          onTasksChange={handleTasksChange}
          incidentId={incidentId}
        />
      </DialogContent>

      {/* Sticky footer — Done closes; Save & Next jumps to the next task in
          the same column for fast triage. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
          p: 2,
          borderTop: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--background) / 0.5)',
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ height: 36, textTransform: 'none' }}
        >
          Done
        </Button>
        {showNav && (
          <Button
            onClick={() => nextTask && onNavigate?.(nextTask.id)}
            disabled={!nextTask}
            variant="contained"
            endIcon={<ChevronRightIcon />}
            sx={{ height: 36, textTransform: 'none' }}
          >
            Next task
          </Button>
        )}
      </Box>
    </Dialog>
  );
};

export default TaskEditDialog;
