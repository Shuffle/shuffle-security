/**
 * Dialog for answering agent questions.
 * Displays the questions the AI agent needs answered to continue processing.
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogContent,
  TextField,
} from '@mui/material';
import { HelpCircle, Send, X as CloseIcon } from 'lucide-react';
import { stripAgentTitlePrefix, type AgentNotification } from '@/services/notifications';

interface Props {
  open: boolean;
  onClose: () => void;
  notification: AgentNotification | null;
  onSubmit: (notificationId: string, answers: Record<number, string>) => void;
}

const AgentQuestionDialog = ({ open, onClose, notification, onSubmit }: Props) => {
  const [answers, setAnswers] = useState<Record<number, string>>({});

  if (!notification) return null;

  // Fall back to the (cleaned) title when the backend did not send a
  // discrete questions[] array — common for "input required" handoffs where
  // the question itself lives in the notification title.
  const rawQuestions = notification.questions && notification.questions.length > 0
    ? notification.questions
    : [stripAgentTitlePrefix(notification.title) || notification.description || 'Provide an answer to continue'];
  const questions = rawQuestions;
  const allAnswered = questions.every((_, i) => answers[i]?.trim());

  const handleSubmit = () => {
    onSubmit(notification.id, answers);
    setAnswers({});
    onClose();
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
          backgroundImage: 'none',
          border: '1px solid hsl(var(--border))',
          borderRadius: 3,
          maxHeight: '85vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Header */}
        <Box sx={{
          px: 3,
          pt: 2.5,
          pb: 2,
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
        }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <HelpCircle size={18} style={{ color: 'hsl(var(--severity-info))' }} />
              <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', color: 'hsl(var(--foreground))' }}>
                Agent Needs Your Input
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              {stripAgentTitlePrefix(notification.title)}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))', mt: -0.5 }}>
            <CloseIcon size={20} />
          </IconButton>
        </Box>

        {/* Description */}
        {notification.description && (
          <Box sx={{ px: 3, pt: 2.5 }}>
            <Box sx={{
              px: 2.5,
              py: 2,
              borderRadius: 2,
              backgroundColor: 'hsl(var(--muted) / 0.3)',
              border: '1px solid hsl(var(--border))',
            }}>
              <Typography sx={{
                fontSize: '0.85rem',
                color: 'hsl(var(--foreground))',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {notification.description}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Questions */}
        <Box sx={{ px: 3, py: 2.5 }}>
          <Typography sx={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            mb: 2,
          }}>
            Questions to Answer
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {questions.map((question, index) => (
              <Box key={index}>
                <Typography sx={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                  mb: 0.75,
                }}>
                  {index + 1}. {question}
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={4}
                  placeholder="Type your answer…"
                  value={answers[index] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: '0.85rem',
                      bgcolor: 'hsl(var(--background))',
                      '& fieldset': { borderColor: 'hsl(var(--border))' },
                      '&:hover fieldset': { borderColor: 'hsl(var(--primary) / 0.5)' },
                      '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'hsl(var(--foreground))',
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{
          px: 3,
          pb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          justifyContent: 'flex-end',
        }}>
          <Button
            onClick={onClose}
            size="small"
            sx={{
              fontSize: '0.8rem',
              textTransform: 'none',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            size="small"
            variant="contained"
            disabled={!allAnswered}
            startIcon={<Send size={14} />}
            sx={{
              fontSize: '0.8rem',
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              px: 2.5,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: 'hsl(var(--primary) / 0.9)',
                boxShadow: 'none',
              },
              '&.Mui-disabled': {
                backgroundColor: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
              },
            }}
          >
            Submit Answers
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AgentQuestionDialog;
