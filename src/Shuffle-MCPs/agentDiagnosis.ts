/**
 * Shared diagnosis utilities for an agent execution result.
 *
 * Lives in the Shuffle-MCPs lib so every surface that displays an agent run
 * (AgentUI Simple/Detailed view, AgentExecutionDrawer, the incident-side
 * AgentRunResultViewer, the activity feed status pill, ...) uses the EXACT
 * same logic to decide whether the run "needs review" and what to tell the
 * user about it.
 *
 * Pure logic — no React, no MUI, no project-side imports.
 */

/** Minimal run shape the diagnoser needs. Compatible with AgentRun and
 *  AgentUI's internal ExecutionData. */
export interface DiagnosableRun {
  status?: string;
  results?: Array<{ result?: string } | any> | null;
}

// ---------------------------------------------------------------------------
// JSON parsing helpers
// ---------------------------------------------------------------------------

const deepParseJsonStrings = (obj: any, depth = 0): any => {
  if (depth > 5) return obj;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          return deepParseJsonStrings(parsed, depth + 1);
        }
        return parsed;
      } catch {
        return obj;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((item) => deepParseJsonStrings(item, depth + 1));
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepParseJsonStrings(value, depth + 1);
    }
    return result;
  }
  return obj;
};

/** Try to parse the result JSON from results[0].result, unwrapping AGENT-type executions. */
export const parseRunResult = (
  run: DiagnosableRun
): { raw: string | null; parsed: any | null } => {
  const firstResult = run.results?.[0]?.result;
  if (!firstResult) {
    const directPayload = run as any;
    if (
      directPayload &&
      typeof directPayload === 'object' &&
      (Array.isArray(directPayload.decisions) || directPayload.decision_string !== undefined)
    ) {
      const deepParsed = deepParseJsonStrings(directPayload);
      let raw: string | null = null;
      try {
        raw = JSON.stringify(deepParsed);
      } catch {
        raw = '[agent run data]';
      }
      return { raw, parsed: deepParsed };
    }
    return { raw: null, parsed: null };
  }

  try {
    let parsed = JSON.parse(firstResult);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.type === 'AGENT' &&
      Array.isArray(parsed.results) &&
      parsed.results.length > 0
    ) {
      const innerResult = parsed.results[0]?.result;
      if (innerResult) {
        try {
          parsed = JSON.parse(innerResult);
        } catch {
          return { raw: innerResult, parsed: null };
        }
      }
    }
    const deepParsed = deepParseJsonStrings(parsed);
    return { raw: firstResult, parsed: deepParsed };
  } catch {
    return { raw: firstResult, parsed: null };
  }
};

/** Extract failure info from a failed/aborted run. */
export const getFailureInfo = (run: DiagnosableRun): { reason: string } | null => {
  const status = run.status?.toUpperCase();
  if (status !== 'FAILED' && status !== 'ABORTED') return null;

  const { parsed } = parseRunResult(run);
  if (parsed && typeof parsed === 'object') {
    if (parsed.success === false && parsed.reason) return { reason: parsed.reason };
    if (parsed.message) return { reason: parsed.message };
    if (parsed.error)
      return { reason: typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error) };
  }
  return null;
};

/**
 * Restrict the search to the agent's own decision records and final
 * `decision_string`. Walking the full result picks up keywords from the
 * system prompt and produces false-positive "Auth Failure" diagnoses.
 */
const getDiagnosableScope = (parsed: any): unknown => {
  if (!parsed || typeof parsed !== 'object') return null;
  const scope: Record<string, unknown> = {};
  if (Array.isArray(parsed.decisions)) {
    // Keep positional alignment with parsed.decisions[N] so an evidence
    // path like `run_details[N]...` maps directly back to the Nth
    // decision in the agent's timeline. Decisions without run_details
    // are kept as `null` placeholders (the walker skips nulls).
    const runDetails = parsed.decisions.map((d: any) =>
      d && typeof d === 'object' && d.run_details ? d.run_details : null
    );
    if (runDetails.some((rd: unknown) => rd !== null)) scope.run_details = runDetails;
    const finalDecisions = parsed.decisions.map((d: any) => {
      if (!d || typeof d !== 'object') return null;
      const action = String(d.action || d.details?.action || '').toLowerCase();
      const category = String(d.category || '').toLowerCase();
      if (!['finish', 'finalise'].includes(action) && !['finish', 'finalise'].includes(category)) return null;
      return {
        reason: d.reason,
        fields: Array.isArray(d.fields) ? d.fields.map((f: any) => f?.value).filter(Boolean) : undefined,
      };
    });
    if (finalDecisions.some((d: unknown) => d !== null)) scope.decisions = finalDecisions;
  }
  if (parsed.decision_string !== undefined) scope.decision_string = parsed.decision_string;
  return Object.keys(scope).length > 0 ? scope : null;
};

/** Extract the originating decision index (in parsed.decisions / agentData.decisions)
 *  from a diagnosis evidence path like `run_details[3].result.error`.
 *  Returns null if the path does not start at a decision row. */
export const extractDecisionIndex = (path: string | undefined | null): number | null => {
  if (!path) return null;
  const m = /^(?:run_details|decisions)\[(\d+)\]/.exec(path);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};

/** Detect if the output content hints at an error/failure even if the run
 *  status is "finished". Only returns true when `diagnoseOutputWarning`
 *  would produce a concrete, actionable diagnosis — never on vague keyword
 *  matches alone. */
export const hasOutputWarning = (run: DiagnosableRun): boolean => {
  return diagnoseOutputWarning(run) !== null;
};

// ---------------------------------------------------------------------------
// Diagnosis
// ---------------------------------------------------------------------------

export type DiagnosisEvidence = {
  /** Dotted JSON path inside the parsed run result. */
  path: string;
  /** Trimmed snippet of the value at that path. */
  value: string;
};

export type OutputDiagnosis = {
  kind: 'auth' | 'permission' | 'not_found' | 'rate_limit' | 'token_limit' | 'network' | 'validation' | 'generic';
  status?: number;
  title: string;
  explanation: string;
  remediation: string;
  snippet?: string;
  evidence: DiagnosisEvidence[];
};

type ResultEntry = { path: string; value: string };

const collectEntries = (root: unknown): ResultEntry[] => {
  const out: ResultEntry[] = [];
  const walk = (v: unknown, path: string, depth: number): void => {
    if (depth > 8 || v == null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out.push({ path, value: String(v) });
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const next = path ? `${path}.${k}` : k;
        walk(val, next, depth + 1);
      }
    }
  };
  walk(root, '', 0);
  return out;
};

const trimEvidenceValue = (v: string, max = 180): string => {
  const cleaned = v.replace(/\s+/g, ' ').trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max).trim()}…`;
};

export const diagnoseOutputWarning = (run: DiagnosableRun): OutputDiagnosis | null => {
  const { parsed, raw } = parseRunResult(run);
  if (!parsed || typeof parsed !== 'object') return null;

  const scope = getDiagnosableScope(parsed);
  if (!scope) return null;

  const entries = collectEntries(scope);
  if (raw && entries.length === 0) entries.push({ path: '', value: raw });

  const haystack = entries.map((e) => e.value).join('\n');
  const lower = haystack.toLowerCase();

  const findEvidence = (
    test: (lowerVal: string, val: string) => boolean,
    max = 3
  ): DiagnosisEvidence[] => {
    const out: DiagnosisEvidence[] = [];
    for (const e of entries) {
      if (test(e.value.toLowerCase(), e.value)) {
        out.push({ path: e.path || '(root)', value: trimEvidenceValue(e.value) });
        if (out.length >= max) break;
      }
    }
    return out;
  };
  const findEvidenceByRegex = (re: RegExp, max = 3): DiagnosisEvidence[] =>
    findEvidence((l) => re.test(l), max);
  const findEvidenceByKeywords = (needles: string[], max = 3): DiagnosisEvidence[] =>
    findEvidence((l) => needles.some((n) => l.includes(n.toLowerCase())), max);

  let status: number | undefined;
  let statusEvidence: DiagnosisEvidence | null = null;
  const statusPatterns = [
    /\bhttp[\s/]?(\d{3})\b/i,
    /\bstatus[\s:_-]+(\d{3})\b/i,
    /\bstatus[_\s-]?code["\s:]+(\d{3})\b/i,
    /\bcode["\s:]+(\d{3})\b/i,
    /\[(\d{3})\]/,
    /\((\d{3})\)/,
    /\b(4\d{2}|5\d{2})\b/,
  ];
  outer: for (const re of statusPatterns) {
    for (const e of entries) {
      const m = e.value.match(re);
      if (m) {
        const n = Number(m[1]);
        if (n >= 400 && n < 600) {
          status = n;
          statusEvidence = { path: e.path || '(root)', value: trimEvidenceValue(e.value) };
          break outer;
        }
      }
    }
  }

  const findSnippet = (needles: string[]): string | undefined => {
    for (const needle of needles) {
      const i = lower.indexOf(needle);
      if (i >= 0) {
        const start = Math.max(0, i - 40);
        const end = Math.min(haystack.length, i + 160);
        return (
          (start > 0 ? '…' : '') +
          haystack.slice(start, end).trim() +
          (end < haystack.length ? '…' : '')
        );
      }
    }
    return undefined;
  };

  const withStatusEvidence = (ev: DiagnosisEvidence[]): DiagnosisEvidence[] => {
    if (!statusEvidence) return ev;
    const dedup = ev.filter((e) => e.path !== statusEvidence!.path);
    return [statusEvidence, ...dedup].slice(0, 3);
  };

  if (
    status === 401 ||
    /\b(unauthori[sz]ed|invalid[_\s-]*(api[_\s-]*key|token|credentials?)|authentication[_\s-]*(failed|required)|missing[_\s-]*(api[_\s-]*key|token|authorization)|bearer[_\s-]*token|expired[_\s-]*token)\b/.test(
      lower
    )
  ) {
    const ev = findEvidenceByRegex(
      /unauthori[sz]ed|invalid[_\s-]*(api[_\s-]*key|token|credentials?)|authentication[_\s-]*(failed|required)|missing[_\s-]*(api[_\s-]*key|token|authorization)|bearer[_\s-]*token|expired[_\s-]*token|\b401\b/
    );
    return {
      kind: 'auth',
      status,
      title: status === 401 ? 'Authentication failed (HTTP 401)' : 'Authentication failed',
      explanation:
        'The upstream service rejected the request because the credentials were missing, invalid, or expired.',
      remediation:
        'Open the integration in Apps → Authentication, reconnect or paste a fresh API key/token, then re-run the action.',
      snippet: findSnippet(['401', 'unauthorized', 'invalid api', 'invalid token', 'authentication']),
      evidence: withStatusEvidence(ev),
    };
  }

  if (
    status === 403 ||
    /\b(forbidden|permission[_\s-]*denied|not[_\s-]*allowed|access[_\s-]*denied|insufficient[_\s-]*(scope|permission|privileges?)|missing[_\s-]*scope)\b/.test(
      lower
    )
  ) {
    const ev = findEvidenceByRegex(
      /forbidden|permission[_\s-]*denied|not[_\s-]*allowed|access[_\s-]*denied|insufficient[_\s-]*(scope|permission|privileges?)|missing[_\s-]*scope|\b403\b/
    );
    return {
      kind: 'permission',
      status,
      title: status === 403 ? 'Permission denied (HTTP 403)' : 'Permission denied',
      explanation:
        'The credentials are valid, but the connected account does not have permission (or scope) to perform this action.',
      remediation:
        'Re-authenticate the integration with the missing scope, or grant the connected account permission for this resource in the source app.',
      snippet: findSnippet(['403', 'forbidden', 'permission', 'scope', 'access denied']),
      evidence: withStatusEvidence(ev),
    };
  }

  if (
    status === 429 ||
    /\b(rate[_\s-]*limit|too[_\s-]*many[_\s-]*requests|quota[_\s-]*exceeded|throttled)\b/.test(lower)
  ) {
    const ev = findEvidenceByRegex(
      /rate[_\s-]*limit|too[_\s-]*many[_\s-]*requests|quota[_\s-]*exceeded|throttled|\b429\b/
    );
    return {
      kind: 'rate_limit',
      status,
      title: status === 429 ? 'Rate limited (HTTP 429)' : 'Rate limited',
      explanation: 'The upstream service is throttling requests from this integration.',
      remediation:
        "Wait a minute and re-run, or reduce how often this action fires. Check the integration's rate-limit settings if the problem keeps happening.",
      snippet: findSnippet(['429', 'rate limit', 'too many', 'quota', 'throttled']),
      evidence: withStatusEvidence(ev),
    };
  }

  if (
    /\b(ai[_\s-]*token[_\s-]*limit|token[_\s-]*limit|limit[_\s-]*is[_\s-]*reached|limit[_\s-]*reached|context[_\s-]*limit|maximum[_\s-]*context|context[_\s-]*length|too[_\s-]*many[_\s-]*tokens|exceeds?[_\s-]*(the[_\s-]*)?(token|context))\b/.test(lower)
  ) {
    const ev = findEvidenceByRegex(
      /ai[_\s-]*token[_\s-]*limit|token[_\s-]*limit|limit[_\s-]*is[_\s-]*reached|limit[_\s-]*reached|context[_\s-]*limit|maximum[_\s-]*context|context[_\s-]*length|too[_\s-]*many[_\s-]*tokens|exceeds?[_\s-]*(the[_\s-]*)?(token|context)/
    );
    return {
      kind: 'token_limit',
      status,
      title: 'AI token limit reached',
      explanation:
        'The agent stopped because the prompt, context, and generated output exceeded the configured AI token limit.',
      remediation:
        'Reduce the input size or connected context and re-run, or connect an API vendor/self-hosted model with a higher limit.',
      snippet: findSnippet(['ai token limit', 'token limit', 'limit reached', 'context limit', 'context length', 'too many tokens']),
      evidence: withStatusEvidence(ev),
    };
  }

  if (
    status === 404 ||
    /\b(not[_\s-]*found|no such|does not exist|unknown[_\s-]*(id|resource))\b/.test(lower)
  ) {
    const ev = findEvidenceByRegex(
      /not[_\s-]*found|no such|does not exist|unknown[_\s-]*(id|resource)|\b404\b/
    );
    return {
      kind: 'not_found',
      status,
      title: status === 404 ? 'Resource not found (HTTP 404)' : 'Resource not found',
      explanation:
        'The action ran, but the target resource (record, ticket, channel, file) could not be located.',
      remediation:
        'Verify the ID or path the agent used is correct, and that the connected account can see that resource.',
      snippet: findSnippet(['404', 'not found', 'no such', 'does not exist']),
      evidence: withStatusEvidence(ev),
    };
  }

  if (
    status === 400 ||
    status === 422 ||
    /\b(bad[_\s-]*request|validation[_\s-]*(error|failed)|invalid[_\s-]*(parameter|field|argument|body|payload))\b/.test(
      lower
    )
  ) {
    const ev = findEvidenceByRegex(
      /bad[_\s-]*request|validation[_\s-]*(error|failed)|invalid[_\s-]*(parameter|field|argument|body|payload)|\b400\b|\b422\b/
    );
    return {
      kind: 'validation',
      status,
      title: status ? `Invalid request (HTTP ${status})` : 'Invalid request',
      explanation:
        'The upstream service rejected the request because the parameters were missing or malformed.',
      remediation:
        "Check the action's required fields and the values the agent sent. The Debug section below shows the exact payload.",
      snippet: findSnippet(['400', '422', 'bad request', 'validation', 'invalid']),
      evidence: withStatusEvidence(ev),
    };
  }

  if (
    (typeof status === 'number' && status >= 500) ||
    /\b(timeout|timed[_\s-]*out|econnrefused|enotfound|network[_\s-]*error|connection[_\s-]*(refused|reset|closed)|service[_\s-]*unavailable|bad[_\s-]*gateway|gateway[_\s-]*timeout)\b/.test(
      lower
    )
  ) {
    const ev = findEvidenceByRegex(
      /timeout|timed[_\s-]*out|econnrefused|enotfound|network[_\s-]*error|connection[_\s-]*(refused|reset|closed)|service[_\s-]*unavailable|bad[_\s-]*gateway|gateway[_\s-]*timeout|\b5\d{2}\b/
    );
    return {
      kind: 'network',
      status,
      title: status ? `Upstream error (HTTP ${status})` : 'Network or upstream error',
      explanation:
        'The integration could not reach the upstream service, or the service returned a server error.',
      remediation:
        "Re-run the action shortly. If it keeps failing, check the upstream service's status page and the integration's base URL.",
      snippet: findSnippet(['500', '502', '503', '504', 'timeout', 'timed out', 'unavailable']),
      evidence: withStatusEvidence(ev),
    };
  }

  const namedFields: Array<keyof typeof parsed & string> = ['reason', 'error', 'message'];
  let namedReason: string | undefined;
  let namedEvidence: DiagnosisEvidence | null = null;
  for (const k of namedFields) {
    const v = (parsed as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) {
      namedReason = v;
      namedEvidence = { path: k, value: trimEvidenceValue(v) };
      break;
    }
  }

  if ((parsed as { success?: unknown }).success === false || namedReason) {
    const ev: DiagnosisEvidence[] = [];
    if (namedEvidence) ev.push(namedEvidence);
    if ((parsed as { success?: unknown }).success === false) {
      ev.push({ path: 'success', value: 'false' });
    }
    return {
      kind: 'generic',
      status,
      title: status ? `Action failed (HTTP ${status})` : 'Action failed',
      explanation:
        namedReason || 'The action returned a failure but did not include a recognizable error code.',
      remediation: 'Open the Debug section below to see the full response from the integration.',
      snippet: namedReason,
      evidence: withStatusEvidence(ev).slice(0, 3),
    };
  }

  // No specific signal found — do NOT surface a generic "may need review"
  // banner. It is too vague to be actionable and just adds noise.
  return null;
};
