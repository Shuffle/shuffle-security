/**
 * AgentPresets — compact "+ Templates" trigger shown above the AgentUI textbox.
 *
 * Self-contained: no host-app `@/` imports. Consumers can override the template
 * list via the `presets` prop; otherwise the built-in {@link AGENT_PRESETS}
 * list is used.
 *
 * Enabled templates notify the consumer via the `onSelectPreset` callback. The
 * consumer is responsible for forwarding the preset to the backend API; the
 * frontend no longer seeds the prompt or pre-selects tools locally. Disabled
 * presets render with a "coming soon" chip and are not clickable.
 */
import { useState } from 'react';
import { Box, Button, Menu, MenuItem, Typography } from '@mui/material';
import { Workflow, ShieldAlert, LifeBuoy, Bug, Radar, Monitor, Plus, X as CloseIcon } from 'lucide-react';

export interface AgentPreset {
  id: string;
  label: string;
  description: string;
  /** Default prompt seed — will pre-fill the AgentUI when the preset is clicked. */
  defaultPrompt: string;
  icon: React.ReactNode;
  /** When true, the preset is clickable and pre-fills the prompt. Others are placeholders. */
  enabled?: boolean;
  /** Optional tools/apps to pre-select when this preset is clicked. */
  defaultApps?: Array<{ name: string; id?: string; icon?: string }>;
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'build-workflows',
    label: 'Build Workflows',
    description: 'Designs and edits Shuffle workflows for you — pick apps, wire actions, and iterate on automations from a description.',
    defaultPrompt: 'Build a Shuffle workflow that ',
    icon: <Workflow size={16} />,
    enabled: true,
    defaultApps: [{ name: 'shuffle_workflows' }],
  },
  {
    id: 'incident-response',
    label: 'Incident Response Agent',
    description: 'Triages incidents: enriches observables, correlates related cases, and proposes next actions with rationale.',
    defaultPrompt: 'Investigate this incident and recommend next steps: ',
    icon: <ShieldAlert size={16} />,
  },
  {
    id: 'support',
    label: 'Support Agent',
    description: 'Uses the platform on your behalf — navigates settings, runs diagnostics, and answers "how do I…" questions.',
    defaultPrompt: 'Help me with the following on the Shuffle platform: ',
    icon: <LifeBuoy size={16} />,
  },
  {
    id: 'vulnerability',
    label: 'Vulnerability Agent',
    description: 'Reviews vulnerabilities, ranks by exploitability and asset criticality, and drafts remediation plans.',
    defaultPrompt: 'Review my current vulnerabilities and prioritize them by ',
    icon: <Bug size={16} />,
  },
  {
    id: 'detection',
    label: 'Detection Agent',
    description: 'Creates and tunes detection rules (Sigma, pipelines) — adjusts logic, filters false positives, and validates coverage.',
    defaultPrompt: 'Modify my detections to ',
    icon: <Radar size={16} />,
  },
  {
    id: 'host-monitor-control',
    label: 'Host Monitor Control',
    description: 'Controls a host computer with screenshots and mouse/keyboard input — useful for hands-on remediation or guided walkthroughs.',
    defaultPrompt: 'Take control of this host and help me with: ',
    icon: <Monitor size={16} />,
  },
];

export interface AgentPresetsProps {
  /** Inline variant sits inside the prompt input row alongside action buttons. */
  variant?: 'default' | 'inline' | 'floating';
  /** Called when the user picks a preset — receives the preset's default prompt seed. */
  onSelectPreset?: (preset: AgentPreset) => void;
  /** Optional currently selected preset — turns the trigger into a chip showing the preset label. */
  selectedPreset?: AgentPreset | null;
  /** Called when the user clicks the remove (X) button on a selected preset chip. */
  onRemoveSelected?: () => void;
  /** Override the built-in preset list. */
  presets?: AgentPreset[];
  /** Ref forwarded to the trigger button so the host can measure its width. */
  chipRef?: React.Ref<HTMLButtonElement>;
}

export const AgentPresets = ({ variant = 'default', onSelectPreset, selectedPreset, onRemoveSelected, presets, chipRef }: AgentPresetsProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const list = presets && presets.length > 0 ? presets : AGENT_PRESETS;

  const MAX_LABEL_CHARS = 18;
  const displayLabel = selectedPreset
    ? (selectedPreset.label.length > MAX_LABEL_CHARS ? `${selectedPreset.label.slice(0, MAX_LABEL_CHARS - 1).trimEnd()}…` : selectedPreset.label)
    : 'Templates';

  const trigger = (
    <Button
      ref={chipRef}
      size="small"
      onClick={(e) => setAnchorEl(e.currentTarget)}
      startIcon={selectedPreset ? (selectedPreset.icon ?? undefined) : <Plus size={variant === 'floating' ? 12 : 14} />}
      endIcon={
        selectedPreset ? (
          <Box
            component="span"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveSelected?.();
            }}
            sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ml: 0.25 }}
          >
            <CloseIcon size={variant === 'floating' ? 12 : 14} />
          </Box>
        ) : undefined
      }
      sx={{
        textTransform: 'none',
        fontSize: variant === 'floating' ? '0.72rem' : '0.78rem',
        fontWeight: 500,
        height: variant === 'floating' ? 24 : variant === 'inline' ? 32 : 30,
        px: variant === 'floating' ? 0.875 : 1.25,
        borderRadius: 999,
        color: selectedPreset ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        border: '1px solid hsl(var(--border))',
        bgcolor: selectedPreset ? 'hsl(var(--primary) / 0.08)' : 'transparent',
        flexShrink: 0,
        '&:hover': {
          bgcolor: selectedPreset ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
          color: selectedPreset ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
          borderColor: 'hsl(var(--border))',
        },
      }}
    >
      {displayLabel}
    </Button>
  );

  const menu = (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={() => setAnchorEl(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            mt: 0.5,
            maxWidth: 360,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            boxShadow: '0 8px 24px hsl(var(--background) / 0.4)',
          },
        },
      }}
    >
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid hsl(var(--border))' }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
          Agent presets
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7, mt: 0.25 }}>
          Click a preset to seed the prompt. More coming soon.
        </Typography>
      </Box>
      {list.map((p) => (
        <MenuItem
          key={p.id}
          disabled={!p.enabled}
          aria-disabled={!p.enabled}
          onClick={p.enabled ? () => {
            onSelectPreset?.(p);
            setAnchorEl(null);
          } : undefined}
          sx={{
            alignItems: 'flex-start',
            gap: 1.25,
            py: 1,
            px: 1.5,
            opacity: '1 !important',
            '&.Mui-disabled': { opacity: 1 },
            cursor: p.enabled ? 'pointer' : 'not-allowed',
            whiteSpace: 'normal',
          }}
        >
          <Box
            sx={{
              mt: 0.25,
              width: 26,
              height: 26,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
              flexShrink: 0,
            }}
          >
            {p.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {p.label}
              </Typography>
              {!p.enabled && (
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'hsl(var(--muted-foreground))',
                    bgcolor: 'hsl(var(--muted))',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 999,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  coming soon
                </Typography>
              )}
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4, mt: 0.25 }}>
              {p.description}
            </Typography>
          </Box>
        </MenuItem>
      ))}
    </Menu>
  );

  if (variant === 'inline') {
    return (
      <>
        {trigger}
        {menu}
      </>
    );
  }

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
      {trigger}
      {menu}
    </Box>
  );
};

export default AgentPresets;
