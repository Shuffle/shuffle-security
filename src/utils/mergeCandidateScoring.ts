/**
 * Merge candidate scoring.
 *
 * Given the current incident's observables, correlation keys, and known IOC
 * keys, score every other recent incident in the datastore by how strongly
 * it appears to be a duplicate / sibling that the analyst might want to
 * merge into.
 *
 * Signals (in descending weight):
 *  1. Shared known-IOC observable      (very strong)
 *  2. Shared correlation key           (strong)
 *  3. Shared observable (type+value)   (medium)
 *  4. Title fuzzy similarity           (tiebreaker)
 *
 * Notes:
 *  - We compare on lowercased `${type}::${value}` keys, matching the
 *    convention used elsewhere in the incident page.
 *  - Title similarity is a cheap Jaccard over word-bigrams (no deps).
 *  - Returned candidates are sorted by score desc, then by recency.
 */

export interface CandidateInputObservable {
  type?: string;
  value?: string;
}

export interface RawCandidateIncident {
  /** Datastore key — the canonical incident id we will merge into. */
  id: string;
  /** Parsed JSON value of the datastore item. */
  raw: any;
  /** Datastore `created` timestamp in ms (or 0 if unknown). */
  created: number;
}

export interface ScoredMergeCandidate {
  id: string;
  title: string;
  created: number;
  severity?: string;
  status?: string;
  source?: string;
  observableCount: number;
  /** Total weighted score (higher = better match). */
  score: number;
  /** Human-readable match reasons, ordered strongest first. */
  reasons: MergeMatchReason[];
  /** Raw datastore JSON, kept so we don't have to re-fetch on click. */
  rawValue: string;
}

export type MergeMatchReason =
  | { kind: 'ioc'; values: string[] }
  | { kind: 'correlation'; values: string[] }
  | { kind: 'observable'; values: string[] }
  | { kind: 'title'; similarity: number };

const WEIGHT_IOC = 10;
const WEIGHT_CORRELATION = 6;
const WEIGHT_OBSERVABLE = 3;
const WEIGHT_TITLE_PER_UNIT = 4; // multiplied by similarity (0..1)

const TITLE_THRESHOLD = 0.45;

const obsKey = (o: CandidateInputObservable): string =>
  `${(o.type || '').toLowerCase()}::${(o.value || '').toLowerCase()}`;

const extractObservables = (raw: any): CandidateInputObservable[] => {
  if (!raw || typeof raw !== 'object') return [];
  const direct = Array.isArray(raw.observables) ? raw.observables : null;
  const ext = raw.metadata?.extensions?.custom_attributes?.observables;
  const fromExt = Array.isArray(ext) ? ext : null;
  return (direct || fromExt || []).filter(
    (o: any) => o && typeof o.value === 'string' && o.value.length > 0,
  );
};

const extractTitle = (raw: any, fallbackId: string): string => {
  if (!raw) return fallbackId;
  const findingTitle = raw.finding_info_list?.[0]?.title || raw.finding_info?.title;
  return raw.title || findingTitle || raw.message || fallbackId;
};

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);

const bigrams = (tokens: string[]): Set<string> => {
  const out = new Set<string>();
  if (tokens.length === 0) return out;
  if (tokens.length === 1) {
    out.add(tokens[0]);
    return out;
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    out.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach(x => {
    if (b.has(x)) inter += 1;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
};

const isMergedOrClosed = (raw: any): boolean => {
  if (!raw) return false;
  if (raw.merged_into) return true;
  if (typeof raw.status === 'string' && raw.status.toLowerCase() === 'merged') return true;
  // OCSF status_id 99 has been used in our smartMerge to mark the source.
  if (raw.status_id === 99) return true;
  // Resolved/closed = id 4 in our mapping. Treat as out-of-scope for merge.
  if (raw.status_id === 4) return true;
  return false;
};

export interface ScoreOptions {
  /** Lowercased `${type}::${value}` set of the current incident's observables. */
  currentObservableKeys: Set<string>;
  /** Lowercased correlation keys (typically observable values that correlate across incidents). */
  currentCorrelationKeys: Set<string>;
  /** Lowercased observable keys flagged as known IOCs. */
  currentIocKeys: Set<string>;
  /** Title of the current incident, used for fuzzy comparison. */
  currentTitle: string;
  /** Look back window in ms; candidates older than this are discarded. */
  maxAgeMs: number;
  /** Top N to return. */
  limit: number;
  /** Reference timestamp (defaults to Date.now()). */
  now?: number;
}

export const scoreMergeCandidates = (
  raw: RawCandidateIncident[],
  opts: ScoreOptions,
): ScoredMergeCandidate[] => {
  const now = opts.now ?? Date.now();
  const cutoff = now - opts.maxAgeMs;
  const currentTitleBigrams = bigrams(tokenize(opts.currentTitle || ''));

  const scored: ScoredMergeCandidate[] = [];

  for (const c of raw) {
    if (!c.raw) continue;
    if (isMergedOrClosed(c.raw)) continue;
    if (c.created && c.created < cutoff) continue;

    const observables = extractObservables(c.raw);
    const candidateKeys = new Set(observables.map(obsKey));

    const sharedIocValues: string[] = [];
    const sharedCorrValues: string[] = [];
    const sharedObsValues: string[] = [];

    candidateKeys.forEach(k => {
      if (!opts.currentObservableKeys.has(k)) return;
      // Pull the original value back out for display (key has form "type::value").
      const value = k.split('::').slice(1).join('::');
      if (opts.currentIocKeys.has(k)) {
        sharedIocValues.push(value);
      } else if (opts.currentCorrelationKeys.has(value)) {
        sharedCorrValues.push(value);
      } else {
        sharedObsValues.push(value);
      }
    });

    let score =
      sharedIocValues.length * WEIGHT_IOC +
      sharedCorrValues.length * WEIGHT_CORRELATION +
      sharedObsValues.length * WEIGHT_OBSERVABLE;

    const title = extractTitle(c.raw, c.id);
    const titleSim = jaccard(currentTitleBigrams, bigrams(tokenize(title)));
    const titleContributes = titleSim >= TITLE_THRESHOLD;
    if (titleContributes) {
      score += titleSim * WEIGHT_TITLE_PER_UNIT;
    }

    if (score <= 0) continue;

    const reasons: MergeMatchReason[] = [];
    if (sharedIocValues.length) reasons.push({ kind: 'ioc', values: sharedIocValues });
    if (sharedCorrValues.length) reasons.push({ kind: 'correlation', values: sharedCorrValues });
    if (sharedObsValues.length) reasons.push({ kind: 'observable', values: sharedObsValues });
    if (titleContributes) reasons.push({ kind: 'title', similarity: titleSim });

    scored.push({
      id: c.id,
      title,
      created: c.created,
      severity: undefined,
      status: undefined,
      source: c.raw.metadata?.product?.name || c.raw.product?.name || c.raw.types?.[0] || '',
      observableCount: observables.length,
      score,
      reasons,
      rawValue: JSON.stringify(c.raw),
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.created || 0) - (a.created || 0);
  });

  return scored.slice(0, opts.limit);
};

export const __testing = {
  obsKey,
  bigrams,
  jaccard,
  tokenize,
  extractObservables,
  isMergedOrClosed,
};
