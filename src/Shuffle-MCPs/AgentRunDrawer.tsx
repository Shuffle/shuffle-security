/**
 * AgentRunDrawer — standalone right-side drawer that hosts the canonical
 * `AgentUI` "Run Agent" experience plus optional caller-provided slots for
 * Permissions and Local LLM tabs.
 *
 * Replaces the project-only `AgentPermissionsDrawer`. It has zero
 * dependencies on host-app contexts (no react-router, no AuthContext, no
 * project services), so it works when the library is consumed standalone
 * via npm — pass `apiKey` / `apiBaseUrl` / `orgId` to authenticate the
 * embedded `AgentUI`.
 *
 * Design:
 *   - Tabs: Run (always), Permissions (if `permissionsSlot`), Local LLM
 *     (if `localLLMSlot`). When neither slot is provided, the tab strip is
 *     hidden and the drawer shows only the AgentUI.
 *   - All colors use HSL tokens so themes flow through. Falls back to
 *     reasonable inline values when tokens are missing.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Drawer,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { Play, Server, ShieldCheck } from 'lucide-react';

import AgentIcon from './AgentIcon';
import AgentUI, { type AgentUIProps } from './AgentUI';

export type AgentRunDrawerTab = 'run' | 'permissions' | 'localLLM';

export interface AgentRunDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Which tab to focus when the drawer opens. Default: 'run'. */
  initialTab?: AgentRunDrawerTab;
  /** Render content for the Permissions tab. Tab is hidden when omitted. */
  permissionsSlot?: React.ReactNode;
  /** Render content for the Local LLM tab. Tab is hidden when omitted. */
  localLLMSlot?: React.ReactNode;
  /**
   * Custom badge node next to the Local LLM tab label (e.g. a green check
   * when OpenAI auth is detected). Optional.
   */
  localLLMTabBadge?: React.ReactNode;
  /** Tooltip shown when the Permissions tab is rendered but disabled. */
  permissionsDisabled?: boolean;
  permissionsDisabledTooltip?: string;
  /** Forwarded to the embedded AgentUI (apiKey, apiBaseUrl, orgId, etc.). */
  agentUIProps?: Partial<AgentUIProps>;
  /** Drawer width override (default: 480 px on >=sm, full-width on xs). */
  width?: number;
  /** Header title. Default: "Agent". */
  title?: string;
  /** Header subtitle. Default: "Run actions and manage permissions". */
  subtitle?: string;
  /** Optional className forwarded to the Drawer Paper. */
  className?: string;
  /** Style overrides merged into the Drawer Paper sx. Use to override colors, padding, etc. */
  paperSx?: SxProps<Theme>;
  /** Style overrides for the header bar (icon + title + close). */
  headerSx?: SxProps<Theme>;
  /** Style overrides for the tab strip. */
  tabsSx?: SxProps<Theme>;
  /** Style overrides for the body container that wraps the active tab content. */
  bodySx?: SxProps<Theme>;
}

const TAB_ORDER: AgentRunDrawerTab[] = ['run', 'permissions', 'localLLM'];

const AgentRunDrawer = ({
  open,
  onClose,
  initialTab = 'run',
  permissionsSlot,
  localLLMSlot,
  localLLMTabBadge,
  permissionsDisabled = false,
  permissionsDisabledTooltip = 'Coming soon',
  agentUIProps,
  width = 520,
  title = 'Agent',
  subtitle = 'Run actions and manage permissions',
  className,
  paperSx,
  headerSx,
  tabsSx,
  bodySx,
}: AgentRunDrawerProps) => {
  const [activeTab, setActiveTab] = useState<AgentRunDrawerTab>(initialTab);

  // Reset tab whenever the drawer transitions from closed -> open so each
  // open honors the caller's initialTab (matches the legacy behavior).
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) setActiveTab(initialTab);
    prevOpenRef.current = open;
  }, [open, initialTab]);

  const visibleTabs = TAB_ORDER.filter((t) => {
    if (t === 'run') return true;
    if (t === 'permissions') return !!permissionsSlot;
    if (t === 'localLLM') return !!localLLMSlot;
    return false;
  });
  const showTabs = visibleTabs.length > 1;

  // If the requested tab isn't visible, fall back to the first visible one.
  const safeActiveTab: AgentRunDrawerTab = visibleTabs.includes(activeTab)
    ? activeTab
    : 'run';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: width },
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: '1px solid hsl(var(--border))',
          boxShadow: '-8px 0 32px hsla(0, 0%, 0%, 0.4)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid hsl(var(--border))',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'hsla(var(--primary) / 0.12)',
            color: 'hsl(var(--primary))',
            flexShrink: 0,
          }}
        >
          <AgentIcon size={22} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', color: 'hsl(var(--foreground))' }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
            {subtitle}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Tabs (hidden when only Run is available) */}
      {showTabs && (
        <Box sx={{ borderBottom: '1px solid hsl(var(--border))', flexShrink: 0 }}>
          <Tabs
            value={safeActiveTab}
            onChange={(_, v) => setActiveTab(v as AgentRunDrawerTab)}
            sx={{
              minHeight: 42,
              px: 3,
              '& .MuiTab-root': {
                minHeight: 42,
                textTransform: 'none',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'hsl(var(--muted-foreground))',
                '&.Mui-selected': { color: 'hsl(var(--primary))' },
              },
              '& .MuiTabs-indicator': { bgcolor: 'hsl(var(--primary))' },
            }}
          >
            {visibleTabs.includes('run') && (
              <Tab
                value="run"
                label="Run"
                icon={<Play size={14} />}
                iconPosition="start"
                sx={{ gap: 0.75 }}
              />
            )}
            {visibleTabs.includes('permissions') && (
              <Tab
                value="permissions"
                label={
                  permissionsDisabled ? (
                    <Tooltip title={permissionsDisabledTooltip} arrow>
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                        Permissions
                      </Box>
                    </Tooltip>
                  ) : (
                    'Permissions'
                  )
                }
                icon={<ShieldCheck size={14} />}
                iconPosition="start"
                disabled={permissionsDisabled}
                sx={{ gap: 0.75 }}
              />
            )}
            {visibleTabs.includes('localLLM') && (
              <Tab
                value="localLLM"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Local LLM
                    {localLLMTabBadge}
                  </Box>
                }
                icon={<Server size={14} />}
                iconPosition="start"
                sx={{ gap: 0.75 }}
              />
            )}
          </Tabs>
        </Box>
      )}

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {safeActiveTab === 'run' && (
          <Box sx={{ px: 2, py: 2 }}>
            <AgentUI
              compact
              hideHeroIcon
              title=""
              subtitle={null}
              {...agentUIProps}
            />
          </Box>
        )}
        {safeActiveTab === 'permissions' && permissionsSlot && (
          <Box sx={{ px: 3, py: 2.5 }}>{permissionsSlot}</Box>
        )}
        {safeActiveTab === 'localLLM' && localLLMSlot && (
          <Box sx={{ px: 3, py: 2.5 }}>{localLLMSlot}</Box>
        )}
      </Box>
    </Drawer>
  );
};

export default AgentRunDrawer;
