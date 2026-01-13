import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useUsers } from '@/hooks/useUsers';
import { MentionInput } from './MentionInput';
import { TaskDateTimePicker } from './TaskDateTimePicker';
import { FileAttachments } from './FileAttachments';
import { taskCategories, IncidentTask, FileAttachment } from './CreateIncidentDialog';

interface TaskEditorProps {
  tasks: IncidentTask[];
  onTasksChange: (tasks: IncidentTask[]) => void;
  incidentId?: string;
  compact?: boolean;
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.2)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#FF6600' },
  },
};

export const TaskEditor = ({ 
  tasks, 
  onTasksChange, 
  incidentId = 'new',
  compact = false,
}: TaskEditorProps) => {
  const { users, loading: usersLoading } = useUsers();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const handleToggleTask = (taskId: string) => {
    onTasksChange(tasks.map(task => 
      task.id === taskId 
        ? { 
            ...task, 
            completed: !task.completed, 
            completedAt: !task.completed ? Date.now() : undefined 
          } 
        : task
    ));
  };

  const handleUpdateTaskTitle = (taskId: string, title: string) => {
    onTasksChange(tasks.map(task => 
      task.id === taskId ? { ...task, title } : task
    ));
  };

  const handleUpdateTaskAssignee = (taskId: string, assignee: string) => {
    onTasksChange(tasks.map(task => 
      task.id === taskId ? { ...task, assignee } : task
    ));
  };

  const handleUpdateTaskDueDate = (taskId: string, dueDate: string) => {
    onTasksChange(tasks.map(task => 
      task.id === taskId ? { ...task, dueDate } : task
    ));
  };

  const handleUpdateTaskDescription = (taskId: string, description: string) => {
    onTasksChange(tasks.map(task => 
      task.id === taskId ? { ...task, description } : task
    ));
  };

  const handleUpdateTaskCategory = (taskId: string, category: string) => {
    onTasksChange(tasks.map(task => 
      task.id === taskId ? { ...task, category } : task
    ));
  };

  const handleUpdateTaskAttachments = (taskId: string, attachments: FileAttachment[]) => {
    onTasksChange(tasks.map(task => 
      task.id === taskId ? { ...task, attachments } : task
    ));
  };

  const handleUpdateTaskDependency = (taskId: string, dependsOn: string) => {
    onTasksChange(tasks.map(task => 
      task.id === taskId ? { ...task, dependsOn: dependsOn || undefined } : task
    ));
  };

  const handleDeleteTask = (taskId: string) => {
    onTasksChange(tasks.filter(task => task.id !== taskId));
  };

  const isTaskBlocked = (task: IncidentTask): boolean => {
    if (!task.dependsOn) return false;
    const dependencyTask = tasks.find(t => t.title === task.dependsOn);
    return dependencyTask ? !dependencyTask.completed : false;
  };

  const getTaskProgress = () => {
    if (tasks.length === 0) return 0;
    const completedCount = tasks.filter(t => t.completed).length;
    return Math.round((completedCount / tasks.length) * 100);
  };

  if (tasks.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        No tasks yet.
      </Typography>
    );
  }

  return (
    <Box>
      {/* Progress bar */}
      {!compact && tasks.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Progress
            </Typography>
            <Typography variant="caption" sx={{ color: getTaskProgress() === 100 ? '#22c55e' : 'text.secondary' }}>
              {getTaskProgress()}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={getTaskProgress()} 
            sx={{ 
              height: 4, 
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: getTaskProgress() === 100 ? '#22c55e' : '#ff6600',
                borderRadius: 2,
              },
            }} 
          />
        </Box>
      )}

      {/* Task list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {tasks.map((task) => {
          const isBlocked = isTaskBlocked(task);
          const dependencyTask = task.dependsOn ? tasks.find(t => t.title === task.dependsOn) : null;
          const isExpanded = expandedTaskId === task.id;
          const categoryInfo = taskCategories.find(c => c.value === task.category);
          
          return (
            <Box key={task.id}>
              {/* Task Header Row */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: compact ? 1 : 1.5,
                  p: compact ? 1 : 1.5,
                  borderRadius: isExpanded ? '8px 8px 0 0' : 1,
                  bgcolor: task.completed ? 'rgba(34, 197, 94, 0.08)' : isBlocked ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)',
                  border: '1px solid',
                  borderColor: task.completed ? 'rgba(34, 197, 94, 0.2)' : isBlocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                  borderBottom: isExpanded ? 'none' : undefined,
                  opacity: isBlocked ? 0.6 : 1,
                }}
              >
                {/* Expand toggle */}
                {!compact && (
                  <IconButton 
                    size="small" 
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    sx={{ p: 0.25, color: 'text.secondary' }}
                  >
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                )}
                
                <IconButton 
                  size="small" 
                  onClick={() => !isBlocked && handleToggleTask(task.id)}
                  disabled={isBlocked}
                  sx={{ 
                    p: 0.5,
                    color: task.completed ? '#22c55e' : 'text.secondary',
                  }}
                >
                  {task.completed ? (
                    <CheckCircleIcon fontSize="small" />
                  ) : (
                    <Box sx={{ 
                      width: 18, 
                      height: 18, 
                      borderRadius: '50%', 
                      border: '2px solid currentColor',
                    }} />
                  )}
                </IconButton>
                
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <MentionInput
                      value={task.title}
                      onChange={(value) => handleUpdateTaskTitle(task.id, value)}
                      size="small"
                      variant="standard"
                      placeholder="Task title..."
                      InputProps={{
                        disableUnderline: true,
                        sx: { 
                          fontSize: compact ? '0.8rem' : '0.875rem',
                          textDecoration: task.completed ? 'line-through' : 'none',
                          color: task.completed ? 'text.secondary' : 'text.primary',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                          borderRadius: 0.5,
                          px: 0.5,
                        },
                      }}
                      sx={{ flex: 1, minWidth: 100 }}
                    />
                    {categoryInfo && (
                      <Chip
                        size="small"
                        label={categoryInfo.label}
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          bgcolor: `${categoryInfo.color}20`,
                          color: categoryInfo.color,
                          border: `1px solid ${categoryInfo.color}40`,
                        }}
                      />
                    )}
                    {task.assignee === 'AI Agent' && (
                      <Chip
                        size="small"
                        label={task.aiWorking ? 'AI Working...' : 'AI Agent'}
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          bgcolor: task.aiWorking ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                          color: '#22c55e',
                          border: task.aiWorking ? '1px solid rgba(34, 197, 94, 0.4)' : 'none',
                          animation: task.aiWorking ? 'pulse 2s infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.6 },
                          },
                        }}
                      />
                    )}
                  </Box>
                  {isBlocked && dependencyTask && (
                    <Typography variant="caption" sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      ⏳ Waiting on: {dependencyTask.title}
                    </Typography>
                  )}
                </Box>
                
                {!compact && (
                  <>
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <Select
                        value={task.assignee || ''}
                        onChange={(e) => handleUpdateTaskAssignee(task.id, e.target.value)}
                        variant="standard"
                        disableUnderline
                        displayEmpty
                        disabled={usersLoading}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        <MenuItem value=""><em>Unassigned</em></MenuItem>
                        <MenuItem value="AI Agent" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box component="span" sx={{ 
                            width: 6, 
                            height: 6, 
                            borderRadius: '50%', 
                            bgcolor: '#22c55e',
                            display: 'inline-block',
                            mr: 0.5,
                          }} />
                          AI Agent
                        </MenuItem>
                        {users.map((user) => (
                          <MenuItem key={user.id} value={user.username}>{user.username}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <TaskDateTimePicker
                      value={task.dueDate}
                      onChange={(date) => handleUpdateTaskDueDate(task.id, date)}
                    />
                  </>
                )}
                
                <IconButton 
                  size="small" 
                  onClick={() => handleDeleteTask(task.id)}
                  sx={{ 
                    p: 0.5, 
                    color: 'text.disabled',
                    '&:hover': { color: '#ef4444' },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
              
              {/* Expanded Task Details */}
              {!compact && (
                <Collapse in={isExpanded}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: 'rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                  }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel sx={{ fontSize: '0.75rem' }}>Category</InputLabel>
                        <Select
                          value={task.category || ''}
                          label="Category"
                          onChange={(e) => handleUpdateTaskCategory(task.id, e.target.value)}
                          sx={{ fontSize: '0.8rem' }}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {taskCategories.map((cat) => (
                            <MenuItem key={cat.value} value={cat.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cat.color }} />
                                {cat.label}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel sx={{ fontSize: '0.75rem' }}>Depends On</InputLabel>
                        <Select
                          value={task.dependsOn || ''}
                          label="Depends On"
                          onChange={(e) => handleUpdateTaskDependency(task.id, e.target.value)}
                          sx={{ fontSize: '0.8rem' }}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {tasks.filter(t => t.id !== task.id).map((t) => (
                            <MenuItem key={t.id} value={t.title}>{t.title}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    
                    <MentionInput
                      value={task.description || ''}
                      onChange={(value) => handleUpdateTaskDescription(task.id, value)}
                      multiline
                      rows={2}
                      fullWidth
                      size="small"
                      placeholder="Add notes or description..."
                      sx={inputSx}
                    />
                    
                    {/* File attachments */}
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                        Attachments
                      </Typography>
                      <FileAttachments
                        attachments={task.attachments || []}
                        onChange={(attachments) => handleUpdateTaskAttachments(task.id, attachments)}
                        namespace="incidents"
                        labels={[`task-${task.id}`, incidentId]}
                        compact
                      />
                    </Box>
                    
                    {/* Task metadata */}
                    <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        Created: {new Date(task.createdAt).toLocaleDateString()}
                      </Typography>
                      {task.createdBy && (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          By: {task.createdBy}
                        </Typography>
                      )}
                      {task.completedAt && (
                        <Typography variant="caption" sx={{ color: '#22c55e' }}>
                          Completed: {new Date(task.completedAt).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Collapse>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default TaskEditor;
