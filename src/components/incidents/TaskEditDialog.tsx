import { Dialog, DialogContent, DialogTitle, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { TaskEditor } from './TaskEditor';
import { IncidentTask } from '@/config/ocsfIncidentSchema';

interface TaskEditDialogProps {
  open: boolean;
  onClose: () => void;
  task: IncidentTask | null;
  onTaskChange: (updated: IncidentTask) => void;
  incidentId?: string;
}

/**
 * Single-task editor presented as a focused modal.
 *
 * Re-uses the same TaskEditor component as the /incidents detail page so
 * editing semantics (assignees, due dates, attachments, description) stay
 * 1:1 between the simple kanban view and the full incident view.
 */
export const TaskEditDialog = ({
  open,
  onClose,
  task,
  onTaskChange,
  incidentId,
}: TaskEditDialogProps) => {
  if (!task) return null;

  const handleTasksChange = (updated: IncidentTask[]) => {
    const found = updated.find((t) => t.id === task.id);
    if (found) onTaskChange(found);
  };

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
        <TaskEditor
          tasks={[task]}
          onTasksChange={handleTasksChange}
          incidentId={incidentId}
        />
      </DialogContent>
    </Dialog>
  );
};

export default TaskEditDialog;
