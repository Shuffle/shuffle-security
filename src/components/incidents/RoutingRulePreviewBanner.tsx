/**
 * RoutingRulePreviewBanner — incident-detail dry-run preview of routing rules.
 *
 * Reads `shuffle-security_routing` rules from the parent org's datastore,
 * evaluates them against the current (possibly unsaved) incident state in
 * the browser, and surfaces matches as actionable suggestions.
 *
 * This is intentionally separate from `RoutingSuggestionBanner`, which
 * surfaces suggestions written by the backend workflow. Both can coexist:
 * this one is the "would match" preview for fast feedback while the
 * workflow is the source of truth for cross-tenant moves.
 *
 * Per-action buttons:
 *   - suggest_move      → calls onMove(targetOrgId, targetOrgName?) — page decides
 *   - set_severity      → calls onApply({ severity })
 *   - set_status        → calls onApply({ status })
 *   - add_label         → calls onApply({ addLabel: value })
 *   - assign_to         → calls onApply({ assignee: value })
 *   - add_comment       → calls onApply({ addComment: value })
 *   - set_priority/set_field — listed read-only (no canonical setter on the page yet).
 */
import { X as CloseIcon, GitBranch as CallSplitIcon, ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, IconButton, Stack, Tooltip, Chip } from '@mui/material';
import { useDatastore } from '@/hooks/useDatastore';
import {
  ROUTING_DATASTORE_CATEGORY,
  type RoutingRule,
  type RoutingAction,
  ACTION_TYPE_LABELS,
} from '@/components/settings/IncidentRoutingEditor';
import { useSubOrgs } from '@/hooks/useSubOrgs';
import { useAuth } from '@/context/AuthContext';
import {
  evaluateRoutingRules,
  type IncidentEvaluationContext,
  type RoutingRuleMatch,
} from '@/utils/routingRuleEvaluator';

export interface RoutingApplyPayload {
  severity?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  addLabel?: string;
  addComment?: string;
  setField?: { field: string; value: string };
}

interface RoutingRulePreviewBannerProps {
  context: IncidentEvaluationContext;
  incidentId?: string;
  onMove?: (targetOrgId: string, targetOrgName?: string) => void;
  onApply?: (patch: RoutingApplyPayload) => void | Promise<void>;
  /**
   * Optional predicate the host page implements to tell the banner whether
   * a given action's effect is already present on the incident (e.g. label
   * already added, comment text already posted). Fully-applied rules are
   * hidden and applied actions render as muted "done" chips.
   */
  isActionApplied?: (action: RoutingAction) => boolean;
}

const dismissKey = (incidentId: string | undefined, ruleId: string) =>
  `routing-rule-preview-dismiss::${incidentId || 'unknown'}::${ruleId}`;

export const RoutingRulePreviewBanner = ({
  context,
  incidentId,
  onMove,
  onApply,
}: RoutingRulePreviewBannerProps) => {
  const { userInfo } = useAuth();
  const currentOrgId = userInfo?.active_org?.id;
  const { subOrgs, parentOrg } = useSubOrgs(currentOrgId);

  // Rules live on the PARENT org. If we're on a parent, that's `currentOrgId`.
  // If we're on a sub-org and the parent is known, fetch from there.
  const targetOrgId = parentOrg?.id || currentOrgId;
  const { items, fetchItems } = useDatastore({
    category: ROUTING_DATASTORE_CATEGORY,
    orgId: targetOrgId,
  });

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrgId]);

  const rules: RoutingRule[] = useMemo(() => {
    const out: RoutingRule[] = [];
    for (const it of items) {
      try {
        const v = typeof it.value === 'string' ? JSON.parse(it.value) : it.value;
        if (v && typeof v === 'object') {
          // Ensure actions array (legacy fallback).
          let actions: RoutingAction[] = Array.isArray(v.actions) ? v.actions : [];
          if (actions.length === 0 && v.action) actions = [v.action];
          out.push({
            id: v.id || it.key,
            name: v.name || 'Untitled rule',
            enabled: v.enabled !== false,
            priority: Number.isFinite(v.priority) ? v.priority : 100,
            matchMode: v.matchMode === 'any' ? 'any' : 'all',
            conditions: Array.isArray(v.conditions) ? v.conditions : [],
            actions,
          });
        }
      } catch { /* skip malformed */ }
    }
    return out;
  }, [items]);

  const matches: RoutingRuleMatch[] = useMemo(
    () => evaluateRoutingRules(context, rules),
    [context, rules]
  );

  // Resolve org names for `suggest_move` actions.
  const orgNameById = useMemo(() => {
    const m: Record<string, string> = {};
    if (currentOrgId) m[currentOrgId] = userInfo?.active_org?.name || 'This tenant';
    if (parentOrg) m[parentOrg.id] = parentOrg.name || parentOrg.id;
    for (const so of subOrgs) m[so.id] = so.name || so.id;
    return m;
  }, [currentOrgId, userInfo, subOrgs, parentOrg]);

  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState(true);

  // Hydrate dismissals per incident.
  useEffect(() => {
    const next = new Set<string>();
    for (const m of matches) {
      try {
        if (window.localStorage.getItem(dismissKey(incidentId, m.rule.id))) {
          next.add(m.rule.id);
        }
      } catch { /* ignore */ }
    }
    setDismissed(next);
  }, [incidentId, matches]);

  const visible = matches.filter((m) => !dismissed.has(m.rule.id));
  if (visible.length === 0) return null;

  const dismissRule = (ruleId: string) => {
    try {
      window.localStorage.setItem(dismissKey(incidentId, ruleId), '1');
    } catch { /* ignore */ }
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(ruleId);
      return next;
    });
  };

  const renderActionButton = (a: RoutingAction, idx: number) => {
    const baseSx = {
      height: 28,
      textTransform: 'none' as const,
      fontWeight: 600,
      fontSize: 12,
      borderColor: 'hsl(var(--primary) / 0.5)',
      color: 'hsl(var(--primary))',
      '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.08)' },
    };

    switch (a.type) {
      case 'suggest_move': {
        const name = a.targetOrgId ? (orgNameById[a.targetOrgId] || a.targetOrgId.slice(0, 8)) : 'no target';
        return (
          <Button
            key={idx}
            size="small"
            variant="outlined"
            onClick={() => a.targetOrgId && onMove?.(a.targetOrgId, name)}
            disabled={!a.targetOrgId || !onMove}
            sx={baseSx}
          >
            Move to {name}
          </Button>
        );
      }
      case 'set_severity':
        return (
          <Button key={idx} size="small" variant="outlined" sx={baseSx}
            disabled={!a.value || !onApply}
            onClick={() => a.value && onApply?.({ severity: a.value })}>
            Set severity → {a.value || '?'}
          </Button>
        );
      case 'set_status':
        return (
          <Button key={idx} size="small" variant="outlined" sx={baseSx}
            disabled={!a.value || !onApply}
            onClick={() => a.value && onApply?.({ status: a.value })}>
            Set status → {a.value || '?'}
          </Button>
        );
      case 'add_label':
        return (
          <Button key={idx} size="small" variant="outlined" sx={baseSx}
            disabled={!a.value || !onApply}
            onClick={() => a.value && onApply?.({ addLabel: a.value })}>
            Add label "{a.value || ''}"
          </Button>
        );
      case 'assign_to':
        return (
          <Button key={idx} size="small" variant="outlined" sx={baseSx}
            disabled={!a.value || !onApply}
            onClick={() => a.value && onApply?.({ assignee: a.value })}>
            Assign to {a.value || '?'}
          </Button>
        );
      case 'add_comment':
        return (
          <Button key={idx} size="small" variant="outlined" sx={baseSx}
            disabled={!a.value || !onApply}
            onClick={() => a.value && onApply?.({ addComment: a.value })}>
            Add comment
          </Button>
        );
      case 'set_priority':
      case 'set_field':
      default:
        return (
          <Chip
            key={idx}
            size="small"
            label={`${ACTION_TYPE_LABELS[a.type]}${a.value ? `: ${a.value}` : ''}`}
            sx={{
              height: 24,
              fontSize: 11,
              bgcolor: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
            }}
          />
        );
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        px: 2,
        py: 1.25,
        mb: 1.5,
        borderRadius: 2,
        bgcolor: 'hsl(var(--primary) / 0.06)',
        border: '1px solid hsl(var(--primary) / 0.35)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CallSplitIcon size={18} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, flex: 1 }}>
          {visible.length} routing rule{visible.length === 1 ? '' : 's'} matched this incident
        </Typography>
        <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
          <IconButton size="small" onClick={() => setExpanded((v) => !v)}
            sx={{ width: 28, height: 28, color: 'hsl(var(--muted-foreground))' }}>
            {expanded ? <ExpandLessIcon size={18} /> : <ExpandMoreIcon size={18} />}
          </IconButton>
        </Tooltip>
      </Box>

      {expanded && (
        <Stack spacing={1}>
          {visible.map((m) => (
            <Box
              key={m.rule.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
                  {m.rule.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', display: 'block', mb: 0.75 }}>
                  Matched {m.matched.length}/{m.rule.conditions.length} condition{m.rule.conditions.length === 1 ? '' : 's'}
                  {m.matched[0]?.field ? ` — ${m.matched[0].field} ${m.matched[0].op}${m.matched[0].value ? ` "${m.matched[0].value}"` : ''}` : ''}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {m.rule.actions.map((a, i) => renderActionButton(a, i))}
                </Stack>
              </Box>
              <Tooltip title="Dismiss for this incident">
                <IconButton size="small" onClick={() => dismissRule(m.rule.id)}
                  sx={{ width: 28, height: 28, color: 'hsl(var(--muted-foreground))' }}>
                  <CloseIcon size={16} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default RoutingRulePreviewBanner;
