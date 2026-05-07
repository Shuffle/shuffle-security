/**
 * IncidentRoutingEditor — multi-tenant incident routing rules.
 *
 * This is a STANDALONE component. It owns its own datastore I/O and does not
 * depend on whatever page hosts it, so it can be moved out of the Tenant
 * Preferences page later (e.g. to its own /routing settings route) by simply
 * importing it elsewhere.
 *
 * Storage:
 *   datastore category: `shuffle-security_routing` on the parent org.
 *   Each item is one rule with the shape defined in `RoutingRule` below.
 *
 * Execution model:
 *   The UI does NOT move incidents. A workflow ("When an Incident is
 *   edited") reads these rules, evaluates them, and writes a
 *   `routing_suggestions` array onto the incident. The incident detail page
 *   surfaces the suggestion as a CTA the user can act on.
 *
 * Visibility:
 *   Only meaningful on a parent org (tenants exist). The hosting page
 *   should hide this card when there are no sub-orgs.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  IconButton,
  MenuItem,
  Switch,
  Tooltip,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { toast } from '@/lib/toast';
import { useDatastore } from '@/hooks/useDatastore';
import { useSubOrgs } from '@/hooks/useSubOrgs';
import { useAuth } from '@/context/AuthContext';

export const ROUTING_DATASTORE_CATEGORY = 'shuffle-security_routing';

export type RoutingConditionOp =
  | 'equals'
  | 'contains'
  | 'regex'
  | 'startsWith'
  | 'endsWith'
  | 'exists';

export interface RoutingCondition {
  field: string; // e.g. "title", "source", "observables.email", "labels", "stakeholders.email"
  op: RoutingConditionOp;
  value?: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchMode: 'all' | 'any';
  conditions: RoutingCondition[];
  action: {
    type: 'suggest_move';
    targetOrgId: string;
    reason?: string;
  };
  createdBy?: string;
  createdTs?: number;
  updatedTs?: number;
  lastMatchedTs?: number;
  matchCount?: number;
}

const FIELD_SUGGESTIONS = [
  'title',
  'description',
  'source',
  'severity',
  'labels',
  'observables.email',
  'observables.domain',
  'observables.ip',
  'stakeholders.email',
  'rawOCSF.message',
  'rawOCSF.unmapped_original.from',
  'rawOCSF.unmapped_original.to',
  'rawOCSF.unmapped_original.subject',
];

const OP_LABELS: Record<RoutingConditionOp, string> = {
  equals: 'equals',
  contains: 'contains',
  regex: 'matches regex',
  startsWith: 'starts with',
  endsWith: 'ends with',
  exists: 'exists',
};

const newId = () =>
  `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const emptyRule = (defaults: Partial<RoutingRule> = {}): RoutingRule => ({
  id: newId(),
  name: 'New rule',
  enabled: true,
  priority: 100,
  matchMode: 'all',
  conditions: [{ field: 'rawOCSF.unmapped_original.to', op: 'contains', value: '' }],
  action: { type: 'suggest_move', targetOrgId: '', reason: '' },
  createdTs: Date.now(),
  updatedTs: Date.now(),
  matchCount: 0,
  ...defaults,
});

const parseRule = (key: string, value: string): RoutingRule | null => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      id: parsed.id || key,
      name: typeof parsed.name === 'string' ? parsed.name : 'Untitled rule',
      enabled: parsed.enabled !== false,
      priority: Number.isFinite(parsed.priority) ? parsed.priority : 100,
      matchMode: parsed.matchMode === 'any' ? 'any' : 'all',
      conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
      action: {
        type: 'suggest_move',
        targetOrgId: parsed.action?.targetOrgId || '',
        reason: parsed.action?.reason || '',
      },
      createdBy: parsed.createdBy,
      createdTs: parsed.createdTs,
      updatedTs: parsed.updatedTs,
      lastMatchedTs: parsed.lastMatchedTs,
      matchCount: Number.isFinite(parsed.matchCount) ? parsed.matchCount : 0,
    };
  } catch {
    return null;
  }
};

interface IncidentRoutingEditorProps {
  /**
   * When true, render even if no sub-orgs exist. The component will warn
   * inline that rules need a target tenant. Useful for previewing.
   */
  forceShow?: boolean;
}

export const IncidentRoutingEditor = ({ forceShow = false }: IncidentRoutingEditorProps) => {
  const { userInfo } = useAuth();
  const currentOrgId = userInfo?.active_org?.id;
  const { subOrgs, isParentOrg } = useSubOrgs(currentOrgId);

  const { items, isLoading, hasFetched, fetchItems, addItem, removeItem } = useDatastore({
    category: ROUTING_DATASTORE_CATEGORY,
  });

  // Local draft state — only saved on explicit "Save" per rule.
  const [drafts, setDrafts] = useState<Record<string, RoutingRule>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  // IDs that exist only in the browser (not yet saved to the datastore).
  const [localOnlyIds, setLocalOnlyIds] = useState<Set<string>>(new Set());
  // Per-rule expand/collapse. Saved rules default collapsed; new rules open.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate drafts from the datastore, but PRESERVE any in-flight local drafts
  // (newly added rules that have not been saved yet).
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, RoutingRule> = {};
      // Keep local-only drafts as-is.
      for (const id of localOnlyIds) {
        if (prev[id]) next[id] = prev[id];
      }
      for (const it of items) {
        const rule = parseRule(it.key, typeof it.value === 'string' ? it.value : JSON.stringify(it.value));
        if (rule) next[rule.id] = rule;
      }
      return next;
    });
  }, [items, localOnlyIds]);

  const sortedRules = useMemo(
    () =>
      Object.values(drafts).sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (a.createdTs || 0) - (b.createdTs || 0);
      }),
    [drafts]
  );

  const updateRule = (id: string, patch: Partial<RoutingRule>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, updatedTs: Date.now() } }));
  };

  const updateCondition = (id: string, idx: number, patch: Partial<RoutingCondition>) => {
    setDrafts((prev) => {
      const r = prev[id];
      if (!r) return prev;
      const conds = r.conditions.slice();
      conds[idx] = { ...conds[idx], ...patch };
      return { ...prev, [id]: { ...r, conditions: conds, updatedTs: Date.now() } };
    });
  };

  const addCondition = (id: string) => {
    setDrafts((prev) => {
      const r = prev[id];
      if (!r) return prev;
      return {
        ...prev,
        [id]: {
          ...r,
          conditions: [...r.conditions, { field: 'title', op: 'contains', value: '' }],
          updatedTs: Date.now(),
        },
      };
    });
  };

  const removeCondition = (id: string, idx: number) => {
    setDrafts((prev) => {
      const r = prev[id];
      if (!r) return prev;
      const conds = r.conditions.filter((_, i) => i !== idx);
      return { ...prev, [id]: { ...r, conditions: conds, updatedTs: Date.now() } };
    });
  };

  const handleSave = async (rule: RoutingRule) => {
    if (!rule.name.trim()) {
      toast.error('Give the rule a name first');
      return;
    }
    if (!rule.action.targetOrgId) {
      toast.error('Select a target tenant');
      return;
    }
    setSaving((p) => ({ ...p, [rule.id]: true }));
    try {
      const payload: RoutingRule = {
        ...rule,
        createdBy: rule.createdBy || userInfo?.username || userInfo?.id,
        createdTs: rule.createdTs || Date.now(),
        updatedTs: Date.now(),
      };
      const ok = await addItem(rule.id, JSON.stringify(payload));
      if (ok) {
        toast.success('Routing rule saved');
        // Update local draft in place — no full reload of the area.
        setDrafts((prev) => ({ ...prev, [rule.id]: payload }));
        // Promote local-only rule to "persisted".
        setLocalOnlyIds((prev) => {
          if (!prev.has(rule.id)) return prev;
          const next = new Set(prev);
          next.delete(rule.id);
          return next;
        });
        // Collapse saved rule for a clean overview.
        setExpanded((prev) => ({ ...prev, [rule.id]: false }));
      } else {
        toast.error('Failed to save routing rule');
      }
    } finally {
      setSaving((p) => ({ ...p, [rule.id]: false }));
    }
  };

  const handleDelete = async (rule: RoutingRule) => {
    // Local-only (never saved) — just drop it.
    if (localOnlyIds.has(rule.id)) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[rule.id];
        return next;
      });
      setLocalOnlyIds((prev) => {
        const next = new Set(prev);
        next.delete(rule.id);
        return next;
      });
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[rule.id];
        return next;
      });
      return;
    }
    // Optimistic remove for persisted rules.
    const snapshot = drafts[rule.id];
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[rule.id];
      return next;
    });
    const ok = await removeItem(rule.id);
    if (ok) {
      toast.success(`Deleted "${rule.name}"`);
    } else {
      toast.error('Failed to delete rule');
      if (snapshot) {
        setDrafts((prev) => ({ ...prev, [rule.id]: snapshot }));
      }
    }
  };

  const handleDuplicate = (rule: RoutingRule) => {
    const copy = emptyRule({
      name: `${rule.name} (copy)`,
      priority: rule.priority + 1,
      matchMode: rule.matchMode,
      conditions: rule.conditions.map((c) => ({ ...c })),
      action: { ...rule.action },
    });
    setDrafts((prev) => ({ ...prev, [copy.id]: copy }));
    setLocalOnlyIds((prev) => new Set(prev).add(copy.id));
    setExpanded((prev) => ({ ...prev, [copy.id]: true }));
  };

  const handleAdd = () => {
    const fresh = emptyRule({
      action: {
        type: 'suggest_move',
        targetOrgId: subOrgs[0]?.id || '',
        reason: '',
      },
    });
    setDrafts((prev) => ({ ...prev, [fresh.id]: fresh }));
    setLocalOnlyIds((prev) => new Set(prev).add(fresh.id));
    setExpanded((prev) => ({ ...prev, [fresh.id]: true }));
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const orgOptions = useMemo(() => {
    const opts: { id: string; name: string }[] = [];
    if (currentOrgId) opts.push({ id: currentOrgId, name: `${userInfo?.active_org?.name || 'This tenant'} (current)` });
    for (const so of subOrgs) opts.push({ id: so.id, name: so.name || so.id.slice(0, 8) });
    return opts;
  }, [subOrgs, currentOrgId, userInfo]);

  if (!isParentOrg && !forceShow) {
    return (
      <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
        Incident routing is only available when you have one or more child tenants.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
            {hasFetched ? `${sortedRules.length} rule${sortedRules.length === 1 ? '' : 's'}` : 'Loading…'}
            {hasFetched && sortedRules.length > 0 && ' · evaluated low-to-high priority'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={handleAdd}
          sx={{
            height: 36,
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            textTransform: 'none',
            '&:hover': { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' },
          }}
        >
          Add rule
        </Button>
      </Box>

      {isLoading && !hasFetched && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {hasFetched && sortedRules.length === 0 && (
        <Paper
          sx={{
            p: 3,
            bgcolor: 'hsl(var(--muted) / 0.3)',
            border: '1px dashed hsl(var(--border))',
            borderRadius: 2,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 1 }}>
            No routing rules yet.
          </Typography>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Rules are evaluated by your incident automation. When a rule matches, an incident shows
            a suggestion banner with a "Move" CTA — your team confirms before anything happens.
          </Typography>
        </Paper>
      )}

      {sortedRules.map((rule) => {
        const isOpen = expanded[rule.id] ?? false;
        const targetName = orgOptions.find((o) => o.id === rule.action.targetOrgId)?.name || 'no target';
        const condSummary = rule.conditions.length === 1
          ? `${rule.conditions[0].field} ${OP_LABELS[rule.conditions[0].op]}${rule.conditions[0].op !== 'exists' ? ` "${rule.conditions[0].value || ''}"` : ''}`
          : `${rule.conditions.length} conditions (${rule.matchMode === 'all' ? 'all' : 'any'})`;
        return (
        <Paper
          key={rule.id}
          sx={{
            p: isOpen ? 2 : 1.25,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: isOpen ? 1.5 : 0,
            opacity: rule.enabled ? 1 : 0.6,
          }}
        >
          {/* Collapsed summary row */}
          {!isOpen && (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box
                onClick={() => toggleExpanded(rule.id)}
                sx={{ flex: 1, minWidth: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0.25 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rule.name || 'Untitled rule'}
                  </Typography>
                  <Chip
                    label={`p${rule.priority}`}
                    size="small"
                    sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
                  />
                  {!rule.enabled && (
                    <Chip label="disabled" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }} />
                  )}
                  {localOnlyIds.has(rule.id) && (
                    <Chip label="unsaved" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }} />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  When {condSummary} → move to {targetName}
                </Typography>
              </Box>
              <Tooltip title={rule.enabled ? 'Disable rule' : 'Enable rule'}>
                <Switch
                  checked={rule.enabled}
                  onChange={(e) => {
                    updateRule(rule.id, { enabled: e.target.checked });
                    if (!localOnlyIds.has(rule.id)) {
                      // Persist toggle immediately for saved rules.
                      const updated = { ...drafts[rule.id], enabled: e.target.checked, updatedTs: Date.now() };
                      addItem(rule.id, JSON.stringify(updated));
                    }
                  }}
                  size="small"
                />
              </Tooltip>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => toggleExpanded(rule.id)} sx={{ width: 36, height: 36 }}>
                  <ExpandMoreIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => handleDelete(rule)}
                  sx={{
                    width: 36,
                    height: 36,
                    color: 'hsl(var(--muted-foreground))',
                    '&:hover': { color: 'hsl(var(--destructive))' },
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {isOpen && (
          <>
          {/* Header row: name + enable + priority + actions */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              value={rule.name}
              onChange={(e) => updateRule(rule.id, { name: e.target.value })}
              placeholder="Rule name"
              sx={{ flex: 1, minWidth: 220 }}
              inputProps={{ style: { fontWeight: 600 } }}
            />
            <TextField
              size="small"
              type="number"
              value={rule.priority}
              onChange={(e) => updateRule(rule.id, { priority: Number(e.target.value) || 0 })}
              label="Priority"
              sx={{ width: 100 }}
              inputProps={{ min: 0 }}
            />
            <Tooltip title={rule.enabled ? 'Disable rule' : 'Enable rule'}>
              <Switch
                checked={rule.enabled}
                onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                size="small"
              />
            </Tooltip>
            <Tooltip title="Duplicate">
              <IconButton size="small" onClick={() => handleDuplicate(rule)} sx={{ width: 36, height: 36 }}>
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Collapse">
              <IconButton size="small" onClick={() => toggleExpanded(rule.id)} sx={{ width: 36, height: 36 }}>
                <ExpandLessIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => handleDelete(rule)}
                sx={{
                  width: 36,
                  height: 36,
                  color: 'hsl(var(--muted-foreground))',
                  '&:hover': { color: 'hsl(var(--destructive))' },
                }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Conditions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                When
              </Typography>
              <Chip
                label={rule.matchMode === 'all' ? 'all match' : 'any matches'}
                size="small"
                onClick={() => updateRule(rule.id, { matchMode: rule.matchMode === 'all' ? 'any' : 'all' })}
                sx={{
                  height: 22,
                  fontSize: '0.65rem',
                  bgcolor: 'hsl(var(--muted))',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'hsl(var(--muted) / 0.7)' },
                }}
              />
            </Box>
            {rule.conditions.map((cond, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  value={cond.field}
                  onChange={(e) => updateCondition(rule.id, idx, { field: e.target.value })}
                  placeholder="Field path"
                  select
                  SelectProps={{
                    native: false,
                    renderValue: (v) => v as string,
                  }}
                  sx={{ minWidth: 220, flex: 1 }}
                >
                  {FIELD_SUGGESTIONS.map((f) => (
                    <MenuItem key={f} value={f} sx={{ fontSize: '0.8rem' }}>
                      {f}
                    </MenuItem>
                  ))}
                  {!FIELD_SUGGESTIONS.includes(cond.field) && cond.field && (
                    <MenuItem value={cond.field}>{cond.field}</MenuItem>
                  )}
                </TextField>
                <TextField
                  size="small"
                  select
                  value={cond.op}
                  onChange={(e) => updateCondition(rule.id, idx, { op: e.target.value as RoutingConditionOp })}
                  sx={{ width: 140 }}
                >
                  {(Object.keys(OP_LABELS) as RoutingConditionOp[]).map((op) => (
                    <MenuItem key={op} value={op} sx={{ fontSize: '0.8rem' }}>
                      {OP_LABELS[op]}
                    </MenuItem>
                  ))}
                </TextField>
                {cond.op !== 'exists' && (
                  <TextField
                    size="small"
                    value={cond.value || ''}
                    onChange={(e) => updateCondition(rule.id, idx, { value: e.target.value })}
                    placeholder="value"
                    sx={{ flex: 1, minWidth: 200 }}
                  />
                )}
                <IconButton
                  size="small"
                  onClick={() => removeCondition(rule.id, idx)}
                  disabled={rule.conditions.length <= 1}
                  sx={{ width: 36, height: 36 }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              onClick={() => addCondition(rule.id)}
              startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              sx={{
                alignSelf: 'flex-start',
                height: 28,
                textTransform: 'none',
                fontSize: '0.7rem',
                color: 'hsl(var(--muted-foreground))',
                '&:hover': { color: 'hsl(var(--primary))', bgcolor: 'transparent' },
              }}
            >
              Add condition
            </Button>
          </Box>

          {/* Action */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1, borderTop: '1px solid hsl(var(--border))' }}>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
              Then suggest moving incident to
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <TextField
                size="small"
                select
                value={rule.action.targetOrgId}
                onChange={(e) => updateRule(rule.id, { action: { ...rule.action, targetOrgId: e.target.value } })}
                sx={{ minWidth: 240 }}
                label="Target tenant"
              >
                {orgOptions.length === 0 && (
                  <MenuItem value="" disabled>
                    No tenants available
                  </MenuItem>
                )}
                {orgOptions.map((o) => (
                  <MenuItem key={o.id} value={o.id} sx={{ fontSize: '0.8rem' }}>
                    {o.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                value={rule.action.reason || ''}
                onChange={(e) => updateRule(rule.id, { action: { ...rule.action, reason: e.target.value } })}
                placeholder="Reason shown to user (optional)"
                sx={{ flex: 1, minWidth: 220 }}
              />
            </Stack>
          </Box>

          {/* Footer: stats + save */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>
              {rule.matchCount ? `${rule.matchCount} match${rule.matchCount === 1 ? '' : 'es'}` : 'No matches yet'}
              {rule.lastMatchedTs ? ` · last ${new Date(rule.lastMatchedTs).toLocaleString()}` : ''}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleSave(rule)}
              disabled={!!saving[rule.id]}
              sx={{
                height: 36,
                bgcolor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                textTransform: 'none',
                '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
              }}
            >
              {saving[rule.id] ? <CircularProgress size={16} /> : 'Save rule'}
            </Button>
          </Box>
          </>
          )}
        </Paper>
        );
      })}
    </Box>
  );
};

export default IncidentRoutingEditor;
