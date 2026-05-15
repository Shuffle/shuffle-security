/**
 * Floating "Continue demo" pill shown in the bottom-right corner when the
 * user previously started demo mode but never finished or cleaned it up.
 *
 * Hidden when:
 *  - Demo mode is currently active (the tour drawer is in charge)
 *  - The user explicitly dismissed it via the X icon
 *  - They reached the final tour step or ran "Clean up demo data"
 */

import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Sparkles, X } from 'lucide-react';
import { useDemo } from '@/context/DemoContext';

export const DemoResumePill = () => {
  const { active, wasStarted, resumeDismissed, resumeTour, dismissResumePrompt } = useDemo();

  if (active || !wasStarted || resumeDismissed) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 1.5,
        pr: 0.5,
        py: 0.75,
        borderRadius: 999,
        bgcolor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        boxShadow: '0 8px 24px hsl(var(--background) / 0.4)',
        backdropFilter: 'blur(8px)',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, transform 0.2s ease',
        '&:hover': {
          borderColor: '#FF6600',
          transform: 'translateY(-1px)',
        },
      }}
      onClick={resumeTour}
      role="button"
      aria-label="Continue demo mode"
    >
      <Sparkles size={16} color="#FF6600" />
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', fontSize: '0.8125rem' }}
      >
        Continue demo
      </Typography>
      <Tooltip title="Hide until next demo">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            dismissResumePrompt();
          }}
          sx={{
            width: 24,
            height: 24,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsl(var(--muted))' },
          }}
        >
          <X size={14} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default DemoResumePill;
