import { Dialog, DialogContent, DialogTitle, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { TaskEditor } from './TaskEditor';
import { IncidentTask } from './CreateIncidentDialog';

interface TaskEditDialogProps {
  open: boolean;
  onClose: () => void;
  task: IncidentTask | null;
  /** Full task list — required so TaskEditor can resolve dependencies between tasks. */
  allTasks: IncidentTask[];
  onTaskChange: (updated: IncidentTask) => void;
  incidentId?: string;
}

/**
 * Single-task editor presented as a focused modal.
 *
 * Re-uses the exact same TaskEditor component as the /incidents detail page so
 * task editing semantics (assignees, due dates, dependencies, attachments) stay
 * 1:1 between the simple kanban view and the full incident view.
 */
export const TaskEditDialog = ({
  open,
  onClose,
  task,
  allTasks,
  onTaskChange,
  incidentId,
}: TaskEditDialogProps) => {
  if (!task) return null;

  // TaskEditor accepts an array — we hand it the full list but it visually
  // renders only the one task we're editing by passing a single-item slice.
  // To keep dependency dropdowns populated with the other tasks, we feed it
  // the full list and let it filter by id.
  const handleTasksChange = (updated: IncidentTask[]) => {
    const found = updated.find((t) => t.id === task.id);
    if (found) onTaskChange(found);
  };

  // Reorder so the edited task is first; TaskEditor expands the first one when
  // the user clicks its expand toggle, but the meta row is always visible.
  const orderedTasks = [task, ...allTasks.filter((t) => t.id !== task.id)];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Edit task
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <Box sx={{ '& > div > div:not(:first-of-type)': { display: 'none' } }}>
          {/*
            We restrict TaskEditor's visible list to just our task by hiding
            siblings via CSS. This avoids forking the component while reusing
            its full editing surface (title, category, assignee, due date,
            description, attachments, dependencies).
          */}
          <TaskEditor
            tasks={orderedTasks}
            onTasksChange={handleTasksChange}
            incidentId={incidentId}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default TaskEditDialog;
