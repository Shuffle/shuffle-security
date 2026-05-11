## Goal

Move the agent executions list (currently on `/agent`) and its click-to-open execution view into the `Shuffle-MCPs/` library so they work standalone. Replace the existing custom timeline drawer (`AgentActionDrawer`) with the canonical `AgentUI` Simple/Detailed view (the same one used on `/agents`).

## What gets added to `src/Shuffle-MCPs/`

### 1. `agentActivity.ts` (new, library-internal)
Self-contained service for `/api/v1/workflows/search` (workflow_id `AGENT`).
- Reuses lib `API_CONFIG` / `getApiUrl` / `getAuthHeader` so it works standalone with the same `apiKey`/`apiBaseUrl`/`orgId` pattern as the rest of the library.
- Exports `AgentRun`, `AgentRunResult`, `AgentDecision`, `searchAgentActivity()`.

### 2. `AgentActivityList.tsx` (new)
Standalone list component. Props:
- `apiKey?`, `apiBaseUrl?`, `orgId?` — same auth pattern as `AgentUI`.
- `onRunClick(run)` — required; consumer decides what happens on click.
- `statusFilter?`, `searchQuery?`, `onStatusFilterChange?`, `onSearchQueryChange?` — optional controlled mode; uncontrolled by default.
- `showSearchBar?`, `showStatusChips?` — default true; lets callers hide chrome.
- Renders search box, status chips ("All / Completed / Running / Failed"), feed of run rows, "Load more", empty/loading/error states.
- Internal lightweight `AgentRunRow` (replaces `AgentRunHeader`) — title, status chip, time-ago, duration. No project couplings (no `parseDatastoreReference`, no incident link, no skip-info; those are project-specific concerns and not needed for the standalone list).
- HSL tokens only.

### 3. `AgentExecutionDrawer.tsx` (new)
Right-side `Drawer` that embeds `<AgentUI>` configured to display an existing run with the Simple/Detailed view (no Start prompt).
- Props: `open`, `onClose`, `run: AgentRun | null`, plus `apiKey?`, `apiBaseUrl?`, `orgId?`, `width?`.
- Renders header (status icon, title, close button) + `<AgentUI>` underneath.
- Uses a new `initialExecution` prop on `AgentUI` (see §4) so Simple/Detailed renders immediately from the already-loaded `AgentRun` data — no extra fetch needed and no `authorization` token required.
- HSL tokens only.

### 4. Small extension to `AgentUI.tsx`
Add a new optional prop:
```ts
initialExecution?: ExecutionData;
```
When provided:
- Skip the starter (`setShowStarter(false)`).
- `setExecution(initialExecution)` and seed `agentActionResult` / `agentData` from `initialExecution.results` (same path as `getExecution` after a successful fetch).
- Skip the `getExecution` call (which requires `authorization`).
- Polling-on-EXECUTING still works if the run is live and `authorization` is present; for completed runs, no polling needed.

This is the smallest surface-area change that lets the canonical Simple/Detailed UI render from a pre-loaded run.

### 5. `index.ts` re-exports
Export `AgentActivityList`, `AgentExecutionDrawer`, `searchAgentActivity`, and the `AgentRun` / `AgentDecision` / `AgentRunResult` types.

## Wire-up in the host app

### `src/pages/dashboard/AgentActivityPage.tsx`
- Replace the `<AgentActivityFeed>` + `<AgentActionDrawer>` block with `<AgentActivityList onRunClick={setSelectedRun} />` + `<AgentExecutionDrawer open={!!selectedRun} onClose={...} run={selectedRun} />`.
- Stats panel, page header, Run/Permissions buttons, search/filter bar — kept as-is. (We keep the page-level search/chips above the list, and pass them in as controlled props so the existing `useAgentActivity` stats panel still works.)

### Files left in place (project-only, not migrated)
- `src/components/agent/AgentActionDrawer.tsx` — superseded; deleted.
- `src/components/agent/AgentActivityFeed.tsx` — superseded; deleted.
- `src/components/agent/AgentRunHeader.tsx`, `AgentRunResultViewer.tsx` — kept; still used by `IncidentDetailPage`, `useAgentActivity` (search filter helper), and `AgentQuickViewDrawer`.
- `src/services/agentActivity.ts` — kept as a thin re-export from the lib so `useAgentActivity` keeps working.
- `src/hooks/useAgentActivity.ts` — kept; project-side stats + search/skip filtering remain useful for the page.

## Out of scope

- The "Run / Permissions / Local LLM" `AgentRunDrawer` already lives in the lib — unchanged.
- No changes to incident-pivot links, skipped-run UI, or stats panel — those stay project-only.
- `AgentQuickViewDrawer` (used in the dashboard) — unchanged.

## Acceptance

- `/agent` lists runs and opens a drawer on click that shows the same Simple/Detailed tabs as `/agents`.
- `AgentActivityList` and `AgentExecutionDrawer` can be imported from `@/Shuffle-MCPs` and rendered with only `apiKey` + `apiBaseUrl` (no project hooks/contexts/services needed).
- Typecheck clean.
