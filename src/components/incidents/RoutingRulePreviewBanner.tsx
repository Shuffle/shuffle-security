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
import { toast } from '@/lib/toast';
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
  onApplyActions?: (actions: RoutingAction[]) => void | Promise<void>;
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
  onApplyActions,
  isActionApplied,
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
  const [isApplying, setIsApplying] = useState(false);

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

  // Filter out dismissed rules AND rules whose actions have all already been
  // applied (nothing left to suggest). `isActionApplied` is optional — when
  // absent we keep prior behavior and show everything.
  const isApplied = (a: RoutingAction) => (isActionApplied ? isActionApplied(a) : false);
  const visible = matches
    .filter((m) => !dismissed.has(m.rule.id))
    .filter((m) => m.rule.actions.some((a) => !isApplied(a)));
  if (visible.length === 0) return null;
  const pendingActions = visible.flatMap((m) => m.rule.actions.filter((a) => !isApplied(a)));

  /** Dispatch a single action through the correct callback. */
  const runAction = async (a: RoutingAction) => {
    if (isApplied(a)) return;
    switch (a.type) {
      case 'suggest_move':
        if (a.targetOrgId && onMove) {
          const name = orgNameById[a.targetOrgId] || a.targetOrgId.slice(0, 8);
          await onMove(a.targetOrgId, name);
        }
        return;
      case 'set_severity':  if (a.value) await onApply?.({ severity: a.value }); return;
      case 'set_status':    if (a.value) await onApply?.({ status: a.value }); return;
      case 'set_priority':  if (a.value) await onApply?.({ priority: a.value }); return;
      case 'add_label':     if (a.value) await onApply?.({ addLabel: a.value }); return;
      case 'assign_to':     if (a.value) await onApply?.({ assignee: a.value }); return;
      case 'add_comment':   if (a.value) await onApply?.({ addComment: a.value }); return;
      case 'set_field':
        if (a.field && a.value !== undefined) {
          await onApply?.({ setField: { field: a.field, value: a.value } });
        }
        return;
    }
  };

  const applyAllForRule = async (rule: RoutingRule) => {
    await applyActions(rule.actions);
  };

  const applyActions = async (actions: RoutingAction[]) => {
    const todo = actions.filter((a) => !isApplied(a));
    if (todo.length === 0 || isApplying) return;
    setIsApplying(true);
    try {
      if (onApplyActions) {
        await onApplyActions(todo);
      } else {
        for (const a of todo) {
          // eslint-disable-next-line no-await-in-loop
          await runAction(a);
        }
      }
    } catch (error) {
      console.error('[RoutingRulePreviewBanner] apply failed', error);
      toast.error(error instanceof Error ? error.message : 'Failed to apply routing action');
    } finally {
      setIsApplying(false);
    }
  };


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
      height: 26,
      textTransform: 'none' as const,
      fontWeight: 500,
      fontSize: 12,
      px: 1,
      minWidth: 0,
      color: 'hsl(var(--foreground))',
      '&:hover': { bgcolor: 'hsl(var(--muted) / 0.6)' },
      '&.Mui-disabled': { color: 'hsl(var(--muted-foreground))' },
    };

    if (isApplied(a)) {
      const label =
        a.type === 'suggest_move' ? `Moved to ${a.targetOrgId ? (orgNameById[a.targetOrgId] || a.targetOrgId.slice(0, 8)) : '?'}`
        : a.type === 'set_severity' ? `Severity: ${a.value}`
        : a.type === 'set_status' ? `Status: ${a.value}`
        : a.type === 'set_priority' ? `Priority: ${a.value}`
        : a.type === 'add_label' ? `Label: ${a.value}`
        : a.type === 'assign_to' ? `Assigned: ${a.value}`
        : a.type === 'add_comment' ? 'Comment posted'
        : a.type === 'set_field' ? `${a.field}: ${a.value}`
        : ACTION_TYPE_LABELS[a.type];
      return (
        <Typography key={idx} variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', textDecoration: 'line-through', fontSize: 11 }}>
          {label}
        </Typography>
      );
    }

    const labelFor = (): string => {
      switch (a.type) {
        case 'suggest_move': {
          const name = a.targetOrgId ? (orgNameById[a.targetOrgId] || a.targetOrgId.slice(0, 8)) : 'no target';
          return `Move to ${name}`;
        }
        case 'set_severity': return `Set severity → ${a.value || '?'}`;
        case 'set_status': return `Set status → ${a.value || '?'}`;
        case 'set_priority': return `Set priority → ${a.value || '?'}`;
        case 'add_label': return `Add label "${a.value || ''}"`;
        case 'assign_to': return `Assign to ${a.value || '?'}`;
        case 'add_comment': return 'Add comment';
        case 'set_field': return `Set ${a.field || '?'} → ${a.value || '?'}`;
        default: return `${ACTION_TYPE_LABELS[a.type]}${a.value ? `: ${a.value}` : ''}`;
      }
    };

    const disabled =
      isApplying ||
      (a.type === 'suggest_move' ? (!a.targetOrgId || (!onMove && !onApplyActions)) :
       a.type === 'set_field' ? (!a.field || a.value === undefined || (!onApply && !onApplyActions)) :
       a.type === 'add_comment' ? (!a.value || (!onApply && !onApplyActions)) :
       (!a.value || (!onApply && !onApplyActions)));

    return (
      <Button key={idx} size="small" variant="text" sx={baseSx} disabled={disabled} onClick={() => applyActions([a])}>
        {labelFor()}
      </Button>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        py: 1,
        mb: 1.5,
        borderTop: '1px solid hsl(var(--border))',
        borderBottom: '1px solid hsl(var(--border))',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CallSplitIcon size={14} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, flex: 1 }}>
          {visible.length} routing rule{visible.length === 1 ? '' : 's'} matched
        </Typography>
        {pendingActions.length > 0 && (
          <Button
            size="small"
            variant="text"
            disabled={isApplying}
            onClick={() => applyActions(pendingActions)}
            sx={{
              height: 26,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 12,
              px: 1,
              color: 'hsl(var(--primary))',
              '&:hover': { bgcolor: 'hsl(var(--primary) / 0.08)' },
            }}
          >
            {isApplying ? 'Applying…' : `Apply all (${pendingActions.length})`}
          </Button>
        )}
        <IconButton size="small" onClick={() => setExpanded((v) => !v)}
          sx={{ width: 24, height: 24, color: 'hsl(var(--muted-foreground))' }}>
          {expanded ? <ExpandLessIcon size={16} /> : <ExpandMoreIcon size={16} />}
        </IconButton>
      </Box>

      {expanded && (
        <Stack spacing={0.5} sx={{ pl: 2.75 }}>
          {visible.map((m) => (
            <Box key={m.rule.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 500, fontSize: 13 }}>
                  {m.rule.name}
                </Typography>
                <Stack direction="row" spacing={0.25} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  {m.rule.actions.map((a, i) => renderActionButton(a, i))}
                </Stack>
              </Box>
              <IconButton size="small" onClick={() => dismissRule(m.rule.id)}
                sx={{ width: 22, height: 22, color: 'hsl(var(--muted-foreground))', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                <CloseIcon size={14} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default RoutingRulePreviewBanner;
