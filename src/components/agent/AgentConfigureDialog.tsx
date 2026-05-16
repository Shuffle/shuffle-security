/**
 * Dialog for configuring/modifying an agent's proposed action before approval.
 * Allows the user to review, edit, or completely change what the agent wants to do.
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
  Chip,
} from '@mui/material';
import { Settings, CheckCircle, AlertTriangle, Mail, X as CloseIcon } from 'lucide-react';
import { stripAgentTitlePrefix, type AgentNotification } from '@/services/notifications';

interface Props {
  open: boolean;
  onClose: () => void;
  notification: AgentNotification | null;
  onApprove: (notificationId: string, modifiedAction?: string) => void;
}

const AgentConfigureDialog = ({ open, onClose, notification, onApprove }: Props) => {
  const [modifiedAction, setModifiedAction] = useState('');

  if (!notification) return null;

  const actionDescription = notification.action || notification.description || '';

  const handleApproveAsIs = () => {
    onApprove(notification.id);
    onClose();
  };

  const handleApproveModified = () => {
    onApprove(notification.id, modifiedAction);
    setModifiedAction('');
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
              <Settings size={18} style={{ color: 'hsl(var(--primary))' }} />
              <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', color: 'hsl(var(--foreground))' }}>
                Configure Action
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              {stripAgentTitlePrefix(notification.title)}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))', mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Proposed action */}
        <Box sx={{ px: 3, pt: 2.5 }}>
          <Typography sx={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            mb: 1,
          }}>
            Proposed Action
          </Typography>
          <Box sx={{
            px: 2.5,
            py: 2,
            borderRadius: 2,
            backgroundColor: 'hsl(var(--severity-info) / 0.06)',
            border: '1px solid hsl(var(--severity-info) / 0.15)',
          }}>
            <Typography sx={{
              fontSize: '0.85rem',
              color: 'hsl(var(--foreground))',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              <Typography component="span" sx={{ fontWeight: 600, fontSize: 'inherit', color: 'hsl(var(--foreground))' }}>
                Agent wants to:
              </Typography>{' '}
              {actionDescription}
            </Typography>
          </Box>
        </Box>

        {/* Modify action */}
        <Box sx={{ px: 3, py: 2.5 }}>
          <Typography sx={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            mb: 1,
          }}>
            Modify Action (Optional)
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', mb: 1.5 }}>
            Leave empty to approve the action as-is, or provide an alternative action below.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            placeholder="Describe the modified action…"
            value={modifiedAction}
            onChange={(e) => setModifiedAction(e.target.value)}
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

        {/* Email-also notice */}
        <Box sx={{ px: 3, pb: 2 }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            px: 1.5,
            py: 1,
            borderRadius: 1.5,
            backgroundColor: 'hsl(var(--severity-info) / 0.08)',
            border: '1px solid hsl(var(--severity-info) / 0.2)',
          }}>
            <Mail size={14} style={{ color: 'hsl(var(--severity-info))', marginTop: 2, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--foreground))', lineHeight: 1.5 }}>
              We have also emailed you this approval request — you can allow or deny it directly from your inbox.
            </Typography>
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
          {modifiedAction.trim() ? (
            <Button
              onClick={handleApproveModified}
              size="small"
              variant="contained"
              startIcon={<Settings size={14} />}
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
              }}
            >
              Approve Modified Action
            </Button>
          ) : (
            <Button
              onClick={handleApproveAsIs}
              size="small"
              variant="contained"
              startIcon={<CheckCircle size={14} />}
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
              }}
            >
              Approve As-Is
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AgentConfigureDialog;
