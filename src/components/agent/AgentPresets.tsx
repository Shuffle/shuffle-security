/**
 * AgentPresets — placeholder row shown above the AgentUI on /agents.
 *
 * Renders a set of "preset" chips (Workflow Builder, Incident Response, App
 * Builder, Support, Vulnerability, Detection). Not clickable yet — these are
 * placeholders while the load-into-prompt behavior is designed. Each preset
 * carries a default prompt and short description surfaced via tooltip so the
 * intent is discoverable.
 */
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { Workflow, ShieldAlert, Blocks, LifeBuoy, Bug, Radar } from 'lucide-react';

export interface AgentPreset {
  id: string;
  label: string;
  description: string;
  /** Default prompt seed — will pre-fill the AgentUI when presets become clickable. */
  defaultPrompt: string;
  icon: React.ReactNode;
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'workflow-builder',
    label: 'Workflow Builder Agent',
    description: 'Designs and edits Shuffle workflows for you — pick apps, wire actions, and iterate on automations from a description.',
    defaultPrompt: 'Build a Shuffle workflow that ',
    icon: <Workflow size={16} />,
  },
  {
    id: 'incident-response',
    label: 'Incident Response Agent',
    description: 'Triages incidents: enriches observables, correlates related cases, and proposes next actions with rationale.',
    defaultPrompt: 'Investigate this incident and recommend next steps: ',
    icon: <ShieldAlert size={16} />,
  },
  {
    id: 'app-builder',
    label: 'App Builder Agent',
    description: 'Generates a new Shuffle app from an OpenAPI spec or API description — actions, auth, and parameters included.',
    defaultPrompt: 'Build a Shuffle app for ',
    icon: <Blocks size={16} />,
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
];

export const AgentPresets = () => {
  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
          Presets
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
          Coming soon
        </Typography>
      </Stack>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {AGENT_PRESETS.map((p) => (
          <Tooltip
            key={p.id}
            title={
              <Box sx={{ maxWidth: 280 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5 }}>{p.label}</Typography>
                <Typography sx={{ fontSize: '0.75rem', opacity: 0.85 }}>{p.description}</Typography>
              </Box>
            }
            arrow
          >
            <Box
              aria-disabled="true"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                height: 32,
                borderRadius: 999,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
                color: 'hsl(var(--muted-foreground))',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'not-allowed',
                opacity: 0.65,
                userSelect: 'none',
              }}
            >
              {p.icon}
              <span>{p.label}</span>
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
};

export default AgentPresets;
