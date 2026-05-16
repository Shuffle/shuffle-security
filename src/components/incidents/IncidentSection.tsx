/**
 * IncidentSection — the single, canonical collapsible panel used across the
 * incident detail page (Description, Email Thread, Timeline, Metadata,
 * Custom Fields, Metrics, …).
 *
 * Goal: every panel in the incident page MUST render through this component
 * so that border, border-radius, header height, padding, icon size and
 * chevron behaviour stay identical. If you find yourself building another
 * `<Box border borderRadius onClick toggle>` wrapper — use this instead.
 */
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon } from 'lucide-react';
import { forwardRef, useEffect, useState, type ReactNode, type ElementType } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
export interface IncidentSectionProps {
  title: string;
  icon: ElementType;
  /** Tint for the header icon. Defaults to `text.secondary`. */
  iconColor?: string;
  children: ReactNode;
  /** Initial open state when uncontrolled. Default true. */
  defaultOpen?: boolean;
  /** Optional badge/chip rendered next to the title (e.g. message count). */
  badge?: ReactNode;
  /** Optional right-aligned actions rendered before the chevron. Click events
   *  are stopped from bubbling so action buttons do not toggle the section. */
  actions?: ReactNode;
  /** Persist open/closed in localStorage under this key. */
  storageKey?: string;
  /** Controlled open state. When provided, `onOpenChange` should also be set. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Apply default body padding (px:2.5, pb:2.5). Set false when children
   *  manage their own padding (e.g. message lists with internal dividers). */
  bodyPadded?: boolean;
  /** data-tour attribute forwarded to the root for guided demos. */
  dataTour?: string;
  /** Optional extra sx overrides on the outer container. */
  sx?: object;
}

export const IncidentSection = forwardRef<HTMLDivElement, IncidentSectionProps>(({
  title,
  icon: Icon,
  iconColor = 'text.secondary',
  children,
  defaultOpen = true,
  badge,
  actions,
  storageKey,
  open: controlledOpen,
  onOpenChange,
  bodyPadded = true,
  dataTour,
  sx,
}, ref) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (!storageKey || typeof window === 'undefined') return defaultOpen;
    try {
      const v = localStorage.getItem(storageKey);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch { /* ignore */ }
    return defaultOpen;
  });
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen! : internalOpen;

  useEffect(() => {
    if (isControlled || !storageKey) return;
    try { localStorage.setItem(storageKey, internalOpen ? '1' : '0'); } catch { /* ignore */ }
  }, [internalOpen, storageKey, isControlled]);

  const toggle = () => {
    const next = !open;
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
      onOpenChange?.(next);
    }
  };

  return (
    <Box
      ref={ref}
      {...(dataTour ? { 'data-tour': dataTour } : {})}
      sx={{
        bgcolor: 'hsl(var(--card))',
        borderRadius: 2,
        border: '1px solid hsl(var(--border))',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box
        onClick={toggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 2,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'hsl(var(--muted))' },
        }}
      >
        <Icon sx={{ fontSize: 20, color: iconColor }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {badge !== undefined && badge !== null && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
            {badge}
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        {actions && (
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            {actions}
          </Box>
        )}
        {open
          ? <ExpandLessIcon style={{ color: 'text.secondary' }} />
          : <ExpandMoreIcon style={{ color: 'text.secondary' }} />}
      </Box>
      <Collapse in={open}>
        {bodyPadded ? (
          <Box sx={{ px: 2.5, pb: 2.5 }}>{children}</Box>
        ) : (
          children
        )}
      </Collapse>
    </Box>
  );
});
IncidentSection.displayName = 'IncidentSection';

export default IncidentSection;
