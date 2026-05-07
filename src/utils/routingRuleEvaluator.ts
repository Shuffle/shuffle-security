/**
 * routingRuleEvaluator — client-side preview/dry-run for incident routing rules.
 *
 * The "real" execution path runs inside a Shuffle workflow that writes
 * `routing_suggestions` onto the incident. Until that workflow is in place
 * (and as a sanity check even when it is), this module evaluates the same
 * rule set in the browser so the incident detail page can show
 * "Rule X matched — do you want to apply it?" suggestions immediately.
 *
 * Inputs:
 *   - The current edited state of the incident (whatever the user is
 *     looking at, including unsaved edits).
 *   - The rule list pulled from the parent org's `shuffle-security_routing`
 *     datastore.
 *
 * Output: an array of { rule, matchedConditions } for rules that match.
 */
import type {
  RoutingRule,
  RoutingCondition,
} from '@/components/settings/IncidentRoutingEditor';

export interface RoutingRuleMatch {
  rule: RoutingRule;
  matched: RoutingCondition[];
}

/** Snapshot of the fields a rule can target. */
export interface IncidentEvaluationContext {
  title?: string;
  description?: string;
  source?: string;
  severity?: string;
  status?: string;
  labels?: string[];
  observables?: Array<{ type?: string; value?: string }>;
  stakeholders?: Array<{ email?: string }>;
  rawOCSF?: any;
}

const getDeep = (obj: any, path: string): any => {
  if (obj == null) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

/**
 * Resolve a rule field path against the evaluation context. Returns either
 * a single value or an array (for fields like `observables.email` that
 * naturally fan out).
 */
const resolveField = (ctx: IncidentEvaluationContext, field: string): any => {
  if (!field) return undefined;

  // Top-level normalized fields
  switch (field) {
    case 'title': return ctx.title;
    case 'description': return ctx.description;
    case 'source': return ctx.source;
    case 'severity': return ctx.severity;
    case 'status': return ctx.status;
    case 'labels': return ctx.labels;
  }

  // observables.<type> — collect values of that observable type
  if (field.startsWith('observables.')) {
    const t = field.slice('observables.'.length).toLowerCase();
    return (ctx.observables || [])
      .filter((o) => (o.type || '').toLowerCase() === t)
      .map((o) => o.value)
      .filter((v): v is string => typeof v === 'string');
  }

  // stakeholders.email — emails of all stakeholders
  if (field === 'stakeholders.email') {
    return (ctx.stakeholders || [])
      .map((s) => s.email)
      .filter((v): v is string => typeof v === 'string');
  }

  // rawOCSF.* — deep-path into the original payload
  if (field.startsWith('rawOCSF.')) {
    return getDeep(ctx.rawOCSF, field.slice('rawOCSF.'.length));
  }

  return undefined;
};

const asStringArray = (v: any): string[] => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(asStringArray);
  if (typeof v === 'object') {
    try { return [JSON.stringify(v)]; } catch { return []; }
  }
  return [String(v)];
};

const evaluateCondition = (ctx: IncidentEvaluationContext, c: RoutingCondition): boolean => {
  const raw = resolveField(ctx, c.field);
  const haystacks = asStringArray(raw).map((s) => s.toLowerCase());
  const needle = (c.value ?? '').toLowerCase();

  switch (c.op) {
    case 'exists':
      return haystacks.length > 0 && haystacks.some((s) => s.length > 0);
    case 'equals':
      return haystacks.some((s) => s === needle);
    case 'contains':
      return needle.length > 0 && haystacks.some((s) => s.includes(needle));
    case 'startsWith':
      return needle.length > 0 && haystacks.some((s) => s.startsWith(needle));
    case 'endsWith':
      return needle.length > 0 && haystacks.some((s) => s.endsWith(needle));
    case 'regex': {
      if (!c.value) return false;
      try {
        const re = new RegExp(c.value, 'i');
        return haystacks.some((s) => re.test(s));
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
};

export const evaluateRoutingRules = (
  ctx: IncidentEvaluationContext,
  rules: RoutingRule[]
): RoutingRuleMatch[] => {
  const out: RoutingRuleMatch[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!rule.conditions || rule.conditions.length === 0) continue;
    const matched: RoutingCondition[] = [];
    for (const c of rule.conditions) {
      if (evaluateCondition(ctx, c)) matched.push(c);
    }
    const ok = rule.matchMode === 'any'
      ? matched.length > 0
      : matched.length === rule.conditions.length;
    if (ok) out.push({ rule, matched });
  }
  // Lower priority number = higher priority
  out.sort((a, b) => (a.rule.priority || 0) - (b.rule.priority || 0));
  return out;
};
