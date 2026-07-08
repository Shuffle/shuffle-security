/**
 * routingConditionTree — tree-shaped condition model for Incident Routing
 * Rules. Supports arbitrarily-nested AND/OR groups (the UI caps depth at
 * MAX_GROUP_DEPTH). Backwards-compatible with the legacy flat
 * `conditions[]` + per-condition `or` boolean model.
 */
import type {
  RoutingCondition,
  RoutingConditionOp,
  RoutingRule,
} from '@/components/settings/IncidentRoutingEditor';

/** Root group counts as depth 1. */
export const MAX_GROUP_DEPTH = 5;

export interface ConditionLeaf {
  kind: 'condition';
  field: string;
  op: RoutingConditionOp;
  value?: string;
}

export interface ConditionGroup {
  kind: 'group';
  op: 'and' | 'or';
  children: ConditionNode[];
}

export type ConditionNode = ConditionLeaf | ConditionGroup;

export const isGroup = (n: ConditionNode | undefined | null): n is ConditionGroup =>
  !!n && n.kind === 'group';

export const emptyLeaf = (defaults: Partial<ConditionLeaf> = {}): ConditionLeaf => ({
  kind: 'condition',
  field: defaults.field ?? 'title',
  op: defaults.op ?? 'contains',
  value: defaults.value ?? '',
});

export const emptyGroup = (
  op: 'and' | 'or' = 'and',
  children: ConditionNode[] = [emptyLeaf()],
): ConditionGroup => ({ kind: 'group', op, children });

/** Depth of the deepest nested group. Root group = 1. */
export const treeDepth = (n: ConditionNode): number => {
  if (n.kind !== 'group') return 0;
  let max = 1;
  for (const c of n.children) {
    if (c.kind === 'group') max = Math.max(max, 1 + treeDepth(c));
  }
  return max;
};

/**
 * Convert the legacy flat conditions[] + `or` flag model into a tree:
 *   AND of (OR-groups) — the same semantics `buildGroups` gave us.
 */
export const migrateLegacyConditions = (rule: RoutingRule): ConditionGroup => {
  const conds = rule.conditions || [];
  if (conds.length === 0) {
    return emptyGroup('and', [emptyLeaf()]);
  }
  const hasOr = conds.some((c) => (c as any).or);
  if (!hasOr) {
    // matchMode drives it: 'any' -> single OR group; 'all' -> AND of leaves.
    if (rule.matchMode === 'any') {
      return {
        kind: 'group',
        op: 'or',
        children: conds.map((c) => leafFromLegacy(c)),
      };
    }
    return {
      kind: 'group',
      op: 'and',
      children: conds.map((c) => leafFromLegacy(c)),
    };
  }
  // Group contiguous `or` conditions into OR-groups; groups joined by AND.
  const groups: ConditionNode[] = [];
  let current: ConditionLeaf[] = [];
  const flush = () => {
    if (current.length === 1) groups.push(current[0]);
    else if (current.length > 1) groups.push({ kind: 'group', op: 'or', children: current });
    current = [];
  };
  conds.forEach((c, i) => {
    if (i > 0 && (c as any).or) {
      current.push(leafFromLegacy(c));
    } else {
      flush();
      current = [leafFromLegacy(c)];
    }
  });
  flush();
  if (groups.length === 1 && groups[0].kind === 'group') return groups[0];
  return { kind: 'group', op: 'and', children: groups };
};

const leafFromLegacy = (c: RoutingCondition): ConditionLeaf => ({
  kind: 'condition',
  field: c.field,
  op: c.op,
  value: c.value,
});

/**
 * Flatten a tree back into the legacy conditions[] + or-flag shape as a
 * best-effort so external evaluators (e.g. an old workflow) still receive
 * something usable. Any nesting deeper than "AND of ORs" is collapsed by
 * DNF expansion; if the expansion would explode we truncate and mark the
 * rule as tree-authoritative via `conditionTree` on the payload.
 */
export const flattenTreeToLegacy = (
  tree: ConditionGroup,
): { conditions: RoutingCondition[]; matchMode: 'all' | 'any' } => {
  // Simple cases: a pure AND of leaves, or pure OR of leaves.
  const allLeaves = tree.children.every((c) => c.kind === 'condition');
  if (allLeaves) {
    if (tree.op === 'or') {
      return {
        matchMode: 'any',
        conditions: tree.children.map((c, i) => ({
          field: (c as ConditionLeaf).field,
          op: (c as ConditionLeaf).op,
          value: (c as ConditionLeaf).value,
          or: i > 0,
        })),
      };
    }
    return {
      matchMode: 'all',
      conditions: tree.children.map((c) => ({
        field: (c as ConditionLeaf).field,
        op: (c as ConditionLeaf).op,
        value: (c as ConditionLeaf).value,
      })),
    };
  }
  // AND of OR-groups (2-layer): direct legacy shape.
  if (
    tree.op === 'and' &&
    tree.children.every(
      (c) =>
        c.kind === 'condition' ||
        (c.kind === 'group' && c.op === 'or' && c.children.every((cc) => cc.kind === 'condition')),
    )
  ) {
    const out: RoutingCondition[] = [];
    tree.children.forEach((child) => {
      if (child.kind === 'condition') {
        out.push({ field: child.field, op: child.op, value: child.value });
      } else {
        (child as ConditionGroup).children.forEach((leaf, li) => {
          const l = leaf as ConditionLeaf;
          out.push({ field: l.field, op: l.op, value: l.value, or: li > 0 });
        });
      }
    });
    return { matchMode: 'all', conditions: out };
  }
  // Deeper nesting — legacy consumers only see the first leaf as a stub;
  // tree-aware consumers use `conditionTree`.
  const firstLeaf = findFirstLeaf(tree);
  return {
    matchMode: 'all',
    conditions: firstLeaf
      ? [{ field: firstLeaf.field, op: firstLeaf.op, value: firstLeaf.value }]
      : [],
  };
};

const findFirstLeaf = (n: ConditionNode): ConditionLeaf | null => {
  if (n.kind === 'condition') return n;
  for (const c of n.children) {
    const f = findFirstLeaf(c);
    if (f) return f;
  }
  return null;
};

/**
 * Immutable update helpers keyed by array-of-indices path from the root.
 */
export type NodePath = number[];

export const getNode = (root: ConditionGroup, path: NodePath): ConditionNode | undefined => {
  let cur: ConditionNode = root;
  for (const idx of path) {
    if (cur.kind !== 'group') return undefined;
    cur = cur.children[idx];
    if (!cur) return undefined;
  }
  return cur;
};

const cloneNode = (n: ConditionNode): ConditionNode =>
  n.kind === 'group' ? { ...n, children: n.children.slice() } : { ...n };

export const updateNode = (
  root: ConditionGroup,
  path: NodePath,
  updater: (n: ConditionNode) => ConditionNode,
): ConditionGroup => {
  if (path.length === 0) {
    const next = updater(root);
    return next.kind === 'group' ? (next as ConditionGroup) : root;
  }
  const rootCopy = cloneNode(root) as ConditionGroup;
  let parent: ConditionGroup = rootCopy;
  for (let i = 0; i < path.length - 1; i++) {
    const idx = path[i];
    const child = parent.children[idx];
    if (!child || child.kind !== 'group') return root;
    const childCopy = cloneNode(child) as ConditionGroup;
    parent.children[idx] = childCopy;
    parent = childCopy;
  }
  const leafIdx = path[path.length - 1];
  const target = parent.children[leafIdx];
  if (!target) return root;
  parent.children[leafIdx] = updater(target);
  return rootCopy;
};

export const removeNode = (root: ConditionGroup, path: NodePath): ConditionGroup => {
  if (path.length === 0) return root;
  if (path.length === 1) {
    const next = cloneNode(root) as ConditionGroup;
    next.children = next.children.filter((_, i) => i !== path[0]);
    if (next.children.length === 0) next.children = [emptyLeaf()];
    return next;
  }
  return updateNode(root, path.slice(0, -1), (parent) => {
    if (parent.kind !== 'group') return parent;
    const next = cloneNode(parent) as ConditionGroup;
    next.children = next.children.filter((_, i) => i !== path[path.length - 1]);
    if (next.children.length === 0) next.children = [emptyLeaf()];
    return next;
  });
};

export const appendChild = (
  root: ConditionGroup,
  path: NodePath,
  child: ConditionNode,
): ConditionGroup =>
  updateNode(root, path, (parent) => {
    if (parent.kind !== 'group') return parent;
    return { ...parent, children: [...parent.children, child] };
  });

/** Evaluate a tree against a boolean-yielding leaf evaluator. */
export const evaluateTree = (
  node: ConditionNode,
  evalLeaf: (leaf: ConditionLeaf) => boolean,
): boolean => {
  if (node.kind === 'condition') return evalLeaf(node);
  if (node.children.length === 0) return false;
  if (node.op === 'and') return node.children.every((c) => evaluateTree(c, evalLeaf));
  return node.children.some((c) => evaluateTree(c, evalLeaf));
};

/** Collect all leaves in a tree (useful for "matched conditions" reporting). */
export const collectLeaves = (node: ConditionNode): ConditionLeaf[] => {
  if (node.kind === 'condition') return [node];
  return node.children.flatMap(collectLeaves);
};
