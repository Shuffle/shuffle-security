/**
 * AgentPromptPrefixChip — compact chip rendered at the START of the AgentUI
 * prompt input. Visually communicates "you are talking to Shuffle Tools" —
 * the underlying prompt text is a hidden prefix that is prepended when the
 * user submits.
 *
 * Clicking the chip opens the shared PopupTextEditor so the user can edit
 * the default prompt. Saving persists it per-user via `useAgentPromptPrefix`.
 */
import { useState } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import PopupTextEditor from '@/components/shared/PopupTextEditor';
import { useAgentPromptPrefix } from '@/hooks/useAgentPromptPrefix';

export interface AgentPromptPrefixChipProps {
  /** Optional label override. Defaults to "Shuffle Tools MCP". */
  label?: string;
}

export const AgentPromptPrefixChip = ({ label = 'Shuffle Tools MCP' }: AgentPromptPrefixChipProps) => {
  const { prompt, savePrompt, isSaving } = useAgentPromptPrefix();
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(prompt);

  const handleOpen = () => {
    setDraftValue(prompt);
    setOpen(true);
  };

  const handleChange = async (next: string) => {
    setDraftValue(next);
    // PopupTextEditor calls onChange once on Apply (see its Dialog Apply button).
    await savePrompt(next);
  };

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
            alignItems: 'center',
            gap: 0.75,
            height: 28,
            pl: 0.5,
            pr: 1.25,
            borderRadius: 999,
            bgcolor: 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
            userSelect: 'none',
            transition: 'background-color 0.15s ease',
            '&:hover': { bgcolor: 'hsl(var(--muted))' },
          }}
          aria-label={`Edit default prompt for ${label}`}
        >
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #FF8544 0%, #EC517C 55%, #9C5AF2 100%)',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 700,
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-hidden
          >
            S
          </Box>
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: 'hsl(var(--primary))',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </Typography>
        </Box>
      </Tooltip>

      <PopupTextEditor
        value={draftValue}
        onChange={handleChange}
        renderInline={false}
        open={open}
        onOpenChange={setOpen}
        mode="multiline"
        title={`Edit default prompt — ${label}`}
        subtitle={
          isSaving
            ? 'Saving…'
            : 'This text is prepended to every message you send from this prompt box. Saved to your user preferences.'
        }
        placeholder="Default prompt prefix…"
        popupMinRows={10}
        popupMaxRows={24}
      />
    </>
  );
};

export default AgentPromptPrefixChip;
