/**
 * AssignedToolsSection — top-of-Permissions UI that shows which apps
 * the agent will use for a given (agent, actionType) pair.
 *
 * Styled to match the rest of PermissionsPanel: a category-style card
 * with app pills that include the app icon (resolved from Algolia)
 * and an inline remove button.
 */

import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Button } from '@mui/material';
import { Plus, X, Wrench, AppWindow } from 'lucide-react';
import { AppSearchDrawer } from '@/Shuffle-MCPs';
import { useAppDetailOptional } from '@/Shuffle-MCPs/AppDetailContext';
import {
  AGENT_TOOLS_CHANGED_EVENT,
  DEFAULT_ACTION_TYPE,
  DEFAULT_AGENT,
  addAgentTool,
  formatToolName,
  getAgentTools,
  removeAgentTool,
  type ToolRef,
} from '@/lib/agentTools';

interface Props {
  agent?: string;
  actionType?: string;
  compact?: boolean;
}

const norm = (s: string) => (s || '').toLowerCase().replace(/[\s-]+/g, '_');

/** Lightweight Algolia lookup for app icons. Resolves once per name. */
const useAppIcons = (names: string[]) => {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const key = names.join('|');

  useEffect(() => {
    let cancelled = false;
    const missing = names.filter((n) => !(n in icons));
    if (missing.length === 0) return;
    (async () => {
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        const resolved: Record<string, string> = {};
        await Promise.all(
          missing.map(async (name) => {
            try {
              const res = await client.searchSingleIndex({
                indexName: 'appsearch',
                searchParams: { query: name.replace(/_/g, ' '), hitsPerPage: 3 },
              });
              const hits = (res.hits as any[]) || [];
              const match = hits.find((h) => norm(h.name || '') === norm(name)) || hits[0];
              resolved[name] = match?.image_url || '';
            } catch {
              resolved[name] = '';
            }
          }),
        );
        if (!cancelled) setIcons((prev) => ({ ...prev, ...resolved }));
      } catch {
        /* offline / blocked — pills fall back to letter avatars */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return icons;
};

const ToolPill = ({
  name,
  icon,
  onRemove,
  onOpen,
}: {
  name: string;
  icon?: string;
  onRemove: () => void;
  onOpen?: () => void;
}) => {
  const display = formatToolName(name);
  return (
    <Box
      onClick={onOpen}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        height: 30,
        pl: 0.5,
        pr: 0.5,
        borderRadius: 1.5,
        border: '1px solid hsl(var(--border))',
        bgcolor: 'hsl(var(--muted) / 0.4)',
        cursor: onOpen ? 'pointer' : 'default',
        transition: 'all 120ms ease',
        '&:hover': {
          borderColor: 'hsl(var(--primary) / 0.5)',
          bgcolor: 'hsl(var(--primary) / 0.06)',
        },
      }}
    >
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: 0.75,
          bgcolor: 'hsl(var(--background))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {icon ? (
          <img src={icon} alt={display} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
            {display.charAt(0).toUpperCase()}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: 'hsl(var(--foreground))', pr: 0.25 }}>
        {display}
      </Typography>
      <Tooltip title="Remove tool">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          sx={{
            width: 20,
            height: 20,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--destructive))', bgcolor: 'transparent' },
          }}
        >
          <X size={12} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const AssignedToolsSection = ({
  agent = DEFAULT_AGENT,
  actionType = DEFAULT_ACTION_TYPE,
  compact = false,
}: Props) => {
  const [tools, setTools] = useState<ToolRef[]>(() => getAgentTools(agent, actionType));
  const [pickerOpen, setPickerOpen] = useState(false);
  // Same drawer the global INTEGRATIONS strip uses, so clicking an
  // assigned-tool pill opens the catalog detail page for that app
  // instead of doing nothing — matching the behaviour from elsewhere
  // in the app.
  const appDetail = useAppDetailOptional();

  useEffect(() => {
    const refresh = () => setTools(getAgentTools(agent, actionType));
    refresh();
    window.addEventListener(AGENT_TOOLS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(AGENT_TOOLS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [agent, actionType]);

  const icons = useAppIcons(useMemo(() => tools.map((t) => t.name), [tools]));

  const labelText =
    agent === DEFAULT_AGENT
      ? 'Apps the default agent is allowed to use'
      : `Apps "${agent}" is allowed to use`;

  return (
    <>
      <Box
        sx={{
          mb: compact ? 2.5 : 3,
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          overflow: 'hidden',
        }}
      >
        {/* Header row — matches PermissionsPanel category headers */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: compact ? 2 : 2.5,
            py: 1.5,
            borderBottom: '1px solid hsl(var(--border))',
            bgcolor: 'hsl(var(--muted) / 0.25)',
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'hsl(var(--primary) / 0.12)',
              color: 'hsl(var(--primary))',
              flexShrink: 0,
            }}
          >
            <Wrench size={16} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: compact ? '0.82rem' : '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Assigned tools
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
              {labelText}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<Plus size={14} />}
            onClick={() => setPickerOpen(true)}
            sx={{
              height: 30,
              px: 1.25,
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.25,
              color: 'hsl(var(--foreground))',
              bgcolor: 'hsl(var(--background))',
              textTransform: 'none',
              fontSize: '0.75rem',
              fontWeight: 500,
              '&:hover': {
                bgcolor: 'hsl(var(--primary) / 0.08)',
                borderColor: 'hsl(var(--primary) / 0.4)',
                color: 'hsl(var(--primary))',
              },
            }}
          >
            Add tool
          </Button>
        </Box>

        {/* Body */}
        <Box sx={{ px: compact ? 2 : 2.5, py: 1.75 }}>
          {tools.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1,
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              <AppWindow size={16} style={{ opacity: 0.6 }} />
              <Typography sx={{ fontSize: '0.78rem' }}>
                No tools assigned yet — the agent will have nothing to call.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {tools.map((t) => (
                <ToolPill
                  key={t.id || t.name}
                  name={t.name}
                  icon={icons[t.name]}
                  onRemove={() => removeAgentTool(t.id || t.name, agent, actionType)}
                  onOpen={appDetail ? () => appDetail.openApp(t.name) : undefined}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <AppSearchDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Assign tool"
        subtitle="Pick an app the agent is allowed to use"
        onQuickSelect={(app) => {
          addAgentTool({ name: app.name, id: app.id || app.name }, agent, actionType);
          setPickerOpen(false);
        }}
      />
    </>
  );
};

export default AssignedToolsSection;
