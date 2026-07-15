/**
 * AgentPromptPrefixChip — compact chip rendered at the START of the AgentUI
 * prompt input. Visually communicates "you are talking to Shuffle Tools" —
 * the underlying prompt text is a hidden prefix that is prepended when the
 * user submits.
 *
 * Clicking the chip opens a lightweight MUI Dialog editor so the user can
 * customize the default prompt. Self-contained: no host-app `@/` imports.
 *
 * Controlled mode: pass `value` + `onChange`.
 * Uncontrolled: pass `userId` (recommended) — the chip persists to the
 * Shuffle datastore via {@link useAgentPromptPrefix} keyed by that user.
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { X as CloseIcon } from 'lucide-react';
import { useAgentPromptPrefix } from '@/Shuffle-MCPs/useAgentPromptPrefix';

export interface AgentPromptPrefixChipProps {
  /** Optional label override. Defaults to "Shuffle Tools MCP". */
  label?: string;
  /** Storage key (typically the current user id) — used when uncontrolled. */
  userId?: string;
  /** Controlled value. When provided, disables internal persistence. */
  value?: string;
  /** Called when the user saves an edit in controlled mode. */
  onChange?: (next: string) => void | Promise<void>;
  /** Override the built-in default prompt seed. */
  defaultPrompt?: string;
  /** Dialog title override. */
  dialogTitle?: string;
}

export const AgentPromptPrefixChip = ({
  label = 'Shuffle Tools MCP',
  userId,
  value,
  onChange,
  defaultPrompt,
  dialogTitle,
}: AgentPromptPrefixChipProps) => {
  const controlled = value !== undefined;
  const managed = useAgentPromptPrefix({ userId, defaultPrompt, persist: !controlled });
  const prompt = controlled ? (value as string) : managed.prompt;
  const isSaving = controlled ? false : managed.isSaving;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(prompt);

  useEffect(() => { if (!open) setDraft(prompt); }, [prompt, open]);

  const handleOpen = () => {
    setDraft(prompt);
    setOpen(true);
  };

  const handleSave = async () => {
    if (controlled) {
      await onChange?.(draft);
    } else {
      await managed.savePrompt(draft);
    }
    setOpen(false);
  };

  // Cap the visible chip label at 15 characters so the prompt-prefix chip
  // never crowds the input — long preset names get truncated with an ellipsis.
  const MAX_LABEL_CHARS = 15;
  const displayLabel = label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1).trimEnd()}…` : label;

  return (
    <>
      <Tooltip title="Click to edit the default prompt sent with your message" placement="top" arrow>
        <Box
          onClick={handleOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); } }}
          sx={{
            display: 'inline-flex',
            alignItems: 'baseline',
            px: 0.5,
            borderRadius: 0.5,
            bgcolor: 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
            userSelect: 'none',
            transition: 'background-color 0.15s ease',
            '&:hover': { bgcolor: 'hsl(var(--muted))' },
          }}
          aria-label={`Edit default prompt for ${label}`}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'hsl(var(--primary))',
              whiteSpace: 'nowrap',
              lineHeight: 'inherit',
            }}
          >
          {displayLabel}
          </Typography>
        </Box>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
            },
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5, borderBottom: '1px solid hsl(var(--border))' }}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {dialogTitle || `Edit default prompt — ${label}`}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
              {isSaving
                ? 'Saving…'
                : 'This text is prepended to every message you send from this prompt box. Saved to your user preferences.'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'hsl(var(--muted-foreground))' }} aria-label="Close">
            <CloseIcon size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={10}
            maxRows={24}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Default prompt prefix…"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                '& fieldset': { borderColor: 'hsl(var(--border))' },
                '&:hover fieldset': { borderColor: 'hsl(var(--border))' },
                '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid hsl(var(--border))' }}>
          <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={isSaving}
            sx={{
              textTransform: 'none',
              bgcolor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              '&:hover': { bgcolor: 'hsl(var(--primary))', opacity: 0.9 },
            }}
          >
            {isSaving ? 'Saving…' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AgentPromptPrefixChip;
