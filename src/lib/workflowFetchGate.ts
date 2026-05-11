/**
 * Global fetch gate: delays GET /api/v1/workflows until ~2s after any
 * /api/v2/workflows/generate request finishes. Prevents the workflows
 * list from being fetched while a generate is in flight (or just settled),
 * which avoids race conditions across the entire platform.
 *
 * Installed once from main.tsx by patching window.fetch.
 */

const GATE_DELAY_MS = 2000;

let inFlightGenerates = 0;
let readyAt = 0; // epoch ms — workflows GET must wait until now >= readyAt

const isGenerateUrl = (url: string) => url.includes('/api/v2/workflows/generate');

const isWorkflowsListUrl = (url: string, method: string) => {
  if (method.toUpperCase() !== 'GET') return false;
  // Match exactly /api/v1/workflows (with optional query string) — not
  // /api/v1/workflows/{id} or other sub-paths.
  return /\/api\/v1\/workflows(?:\?|$)/.test(url);
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const waitForGate = async () => {
  // Loop in case more generates start while we wait.
  // Cap total wait to ~30s so we never deadlock the UI.
  const hardDeadline = Date.now() + 30_000;
  while (Date.now() < hardDeadline) {
    if (inFlightGenerates === 0 && Date.now() >= readyAt) return;
    const wait = Math.max(50, Math.min(500, readyAt - Date.now()));
    await sleep(inFlightGenerates > 0 ? 200 : wait);
  }
};

export const installWorkflowFetchGate = () => {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __workflowGateInstalled?: boolean };
  if (w.__workflowGateInstalled) return;
  w.__workflowGateInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET');

    if (isGenerateUrl(url)) {
      inFlightGenerates++;
      try {
        const res = await originalFetch(input as any, init);
        return res;
      } finally {
        readyAt = Date.now() + GATE_DELAY_MS;
        inFlightGenerates--;
      }
    }

    if (isWorkflowsListUrl(url, method)) {
      if (inFlightGenerates > 0 || Date.now() < readyAt) {
        await waitForGate();
      }
    }

    return originalFetch(input as any, init);
  };
};
