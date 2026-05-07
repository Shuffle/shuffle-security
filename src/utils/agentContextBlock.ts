/**
 * Build a compact, structured "context block" appended to @AIAgent comments
 * sent from the incident detail page.
 *
 * Goal: give the agent the most useful pre-digested view of THIS incident
 * plus the strongest related-incident matches, so it can reason about
 * observables, correlations and next steps without having to re-derive
 * them from the raw OCSF object.
 *
 * The block is wrapped in a clearly labelled fenced section so it remains
 * readable in the timeline but is obviously machine context, not prose.
 */

import type { ScoredMergeCandidate } from './mergeCandidateScoring';

export interface AgentContextInput {
  incident: {
    id?: string;
    title?: string;
    severity?: string;
    status?: string;
    type?: string;
    source?: string;
    created?: number | string;
    assignee?: string;
  } | null | undefined;
  observables: Array<{ type?: string; value?: string; archived?: boolean }>;
  enrichments: Array<{ type?: string; value?: string; data?: string }>;
  iocObservableKeys: Set<string>; // lowercased "type::value"
  correlationKeys: string[];      // human-readable correlation labels
  stakeholders: Array<{ name?: string; email?: string; role?: string }>;
  recentTimeline: Array<{ type?: string; user?: string; content?: string; timestamp?: number }>;
  mergeCandidates: ScoredMergeCandidate[];
}

const cap = <T,>(arr: T[], n: number) => (arr.length > n ? arr.slice(0, n) : arr);

const safeStr = (v: unknown, max = 140): string => {
  if (v == null) return '';
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const fmtAge = (ts?: number | string): string => {
  if (!ts) return '';
  const n = typeof ts === 'string' ? Date.parse(ts) : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  const diff = Date.now() - n;
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
};

export const buildAgentContextBlock = (ctx: AgentContextInput): string => {
  const lines: string[] = [];
  const inc = ctx.incident || {};

  lines.push('Incident:');
  lines.push(`  id: ${safeStr(inc.id)}`);
  if (inc.title) lines.push(`  title: ${safeStr(inc.title, 200)}`);
  if (inc.severity) lines.push(`  severity: ${safeStr(inc.severity)}`);
  if (inc.status) lines.push(`  status: ${safeStr(inc.status)}`);
  if (inc.type) lines.push(`  type: ${safeStr(inc.type)}`);
  if (inc.source) lines.push(`  source: ${safeStr(inc.source)}`);
  if (inc.assignee) lines.push(`  assignee: ${safeStr(inc.assignee)}`);
  const age = fmtAge(inc.created);
  if (age) lines.push(`  age: ${age}`);

  // Observables (active only) — flag IOC matches
  const activeObs = ctx.observables.filter(o => !o.archived && o.type && o.value);
  if (activeObs.length) {
    lines.push('');
    lines.push(`Observables (${activeObs.length}):`);
    cap(activeObs, 25).forEach(o => {
      const key = `${String(o.type).toLowerCase()}::${String(o.value).toLowerCase()}`;
      const ioc = ctx.iocObservableKeys.has(key) ? ' [KNOWN IOC]' : '';
      lines.push(`  - ${safeStr(o.type)}: ${safeStr(o.value, 200)}${ioc}`);
    });
    if (activeObs.length > 25) lines.push(`  …and ${activeObs.length - 25} more`);
  }

  // Enrichments — summarized by type
  if (ctx.enrichments.length) {
    const byType = new Map<string, number>();
    ctx.enrichments.forEach(e => {
      const t = String(e.type || 'unknown');
      byType.set(t, (byType.get(t) || 0) + 1);
    });
    lines.push('');
    lines.push(`Enrichments (${ctx.enrichments.length}): ${Array.from(byType.entries())
      .map(([t, n]) => `${t}×${n}`)
      .join(', ')}`);
  }

  // Correlation tags
  if (ctx.correlationKeys.length) {
    lines.push('');
    lines.push(`Correlations: ${cap(ctx.correlationKeys, 15).map(c => safeStr(c, 80)).join(', ')}`);
  }

  // Stakeholders
  if (ctx.stakeholders.length) {
    lines.push('');
    lines.push(`Stakeholders (${ctx.stakeholders.length}):`);
    cap(ctx.stakeholders, 10).forEach(s => {
      const parts = [s.name, s.email, s.role].filter(Boolean).map(p => safeStr(p, 80));
      if (parts.length) lines.push(`  - ${parts.join(' · ')}`);
    });
  }

  // Recent timeline (non-comment events keep things compact)
  if (ctx.recentTimeline.length) {
    lines.push('');
    lines.push('Recent timeline:');
    cap(ctx.recentTimeline, 8).forEach(t => {
      const when = fmtAge(t.timestamp);
      const who = t.user ? ` by ${safeStr(t.user, 40)}` : '';
      lines.push(`  - [${safeStr(t.type || 'event', 30)}]${who} ${when}: ${safeStr(t.content, 160)}`);
    });
  }

  // Related incidents — the gold for cross-incident reasoning
  if (ctx.mergeCandidates.length) {
    lines.push('');
    lines.push(`Related incidents (top ${Math.min(ctx.mergeCandidates.length, 8)} by match score):`);
    cap(ctx.mergeCandidates, 8).forEach(c => {
      const reasons = c.reasons.map(r => {
        if (r.kind === 'title') return `title~${(r.similarity * 100).toFixed(0)}%`;
        const vals = cap(r.values, 3).map(v => safeStr(v, 60)).join(', ');
        return `${r.kind}: ${vals}${r.values.length > 3 ? ` +${r.values.length - 3}` : ''}`;
      }).join(' | ');
      lines.push(
        `  - ${c.id} · score=${c.score.toFixed(1)} · sev=${safeStr(c.severity || '?', 12)} · status=${safeStr(c.status || '?', 16)} · ${fmtAge(c.created)}`,
      );
      lines.push(`      title: ${safeStr(c.title, 160)}`);
      if (reasons) lines.push(`      match: ${reasons}`);
    });
  }

  if (!lines.length) return '';

  return [
    '',
    '---',
    '**Context (auto-attached for the AI agent)**',
    '```yaml',
    ...lines,
    '```',
  ].join('\n');
};

/**
 * Marker line that prefixes the auto-attached agent context block. Anything
 * from this line onward is for the AI agent and should be hidden in the UI.
 */
export const AGENT_CONTEXT_MARKER = '**Context (auto-attached for the AI agent)**';

/**
 * Remove the auto-attached agent context block from a comment body so the
 * user-facing rendering only shows what they actually typed. The block is
 * still persisted in the underlying message for the agent to consume.
 */
export const stripAgentContextBlock = (text: string): string => {
  if (!text) return text;
  const idx = text.indexOf(AGENT_CONTEXT_MARKER);
  if (idx === -1) return text;
  // Walk back over the leading "---\n" separator and any trailing whitespace
  // so the trimmed message looks clean.
  let cut = idx;
  // Strip an optional preceding line that is just a horizontal rule.
  const before = text.slice(0, cut);
  const trimmed = before.replace(/\n?-{3,}\s*\n?$/, '');
  cut = trimmed.length;
  return text.slice(0, cut).replace(/\s+$/, '');
};
