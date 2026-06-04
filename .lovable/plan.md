## Problem

On `/usecases/siem_alerts` the Alluvial diagram has its own click handlers:
- Clicking an app bubble opens a small `Visit app / Enable Sync / Remove` popover (`AppBubble` local state).
- Clicking the dashed `+` opens an `AppSearchDrawer` with its own `onSelectOverride` that calls `handleToggleSync` / `handleToggleForward`.

The default Source/Destination view (`IntegrationStatusLite` in `UsecaseDetailContent`) does something different and richer:
- Clicking a tile opens a popover with the usecase status chip ("In use" / "Not in use"), an `Enable for <usecase>` / `Disable for <usecase>` toggle wired to `handleUsecaseAppToggle` (POSTs `/api/v2/workflows/generate` with the full `app_name` list and toasts on success), and a `Manage authentication` / `Authenticate app` button that opens the AppDetailDrawer.
- Clicking the `+` calls `setAddToolFor({ side, categoryId, multiDest })` which opens an `AppSearchDrawer` configured with `connectionPathApps`, `priorityCategory`, `autoActivate` and an `onSelectOverride` that wires the app into the usecase workflow via `/api/v2/workflows/generate` with toast feedback and `invalidateAppsCache()` + `setIntegrationsRefreshKey()`.

The two surfaces disagree, and on the Alluvial side many clicks appear to do nothing because they delegate to `appDetailCtx.openApp` / local toggles that do not feed back into the same usecase wiring path the rest of the page expects.

## Goal

Make the Alluvial diagram reuse the default Source/Destination behavior end‑to‑end:
- Clicking an app bubble opens the same popover, with `Enable for <usecase>` / `Disable for <usecase>` and `Manage authentication`.
- Clicking the Add button opens the same `AppSearchDrawer` flow (`setAddToolFor`) the default view uses.

Visuals stay the same (positioned bubbles, stripes, webhook node). Only behavior changes.

## Changes

### 1. `src/Shuffle-Core/views/UsecaseAlluvialDiagram.tsx`

- Add optional handoff props on `UsecaseAlluvialDiagramProps`:
  - `onBubbleClick?: (args: { appName: string; side: 'left' | 'right'; anchorEl: HTMLElement }) => boolean` — return `true` to skip the local Visit/Enable Sync/Remove popover.
  - `onAddTool?: (side: 'left' | 'right') => boolean` — return `true` to skip the local `AppSearchDrawer`.
- In `AppBubble`, accept and call a new `onPrimaryClick(appName, anchorEl)` prop. If it returns `true`, do not set local `anchorEl` (i.e., do not show the local popover). Webhook bubbles keep their existing popover behavior.
- Pass `onPrimaryClick` through from the diagram so both source (`side="left"`) and destination (`side="right"`) bubbles delegate to the host.
- In the diagram's `+` Add buttons (lines ~1434, ~1463, ~1494) call `onAddTool?.(side)` first; only fall back to `setSearchOpen(side)` (existing `AppSearchDrawer`) when the host did not handle it.
- Keep all existing handlers (`handleToggleSync`, `handleToggleForward`, `handleVisitApp`, `handleRemoveApp`, webhook flow) intact for guest mode and standalone usage.

### 2. `src/Shuffle-Core/views/Usecases.tsx`

- In `UsecaseDetailContent`, wire the new props on the existing `<UsecaseAlluvialDiagram>` instance (around line 3918):
  - `onAddTool={(side) => { setAddToolFor({ side: side === 'left' ? 'source' : 'destination', categoryId: side === 'left' ? flow.source : flow.target, multiDest: endpointAllowsMultiDestAdd }); return true; }}`
  - `onBubbleClick={({ appName, side, anchorEl }) => { setPopoverFor({ el: anchorEl, item: synthesizeItem(appName) }); return true; }}`
- Lift the existing `IntegrationStatusLite` popover (`renderPopover`) so it can be reused outside the lite strip, OR (simpler) expose the same data via a small inline popover component in `Usecases.tsx` that calls the same `handleUsecaseAppToggle` + `appDetail.openApp` the lite strip uses. Reuse the existing `popoverFor` shape (`{ el, item }`) so styling and copy stay identical.
- `synthesizeItem(appName)` resolves the bubble's app name to an `IntegrationItem` using the already-fetched authenticated apps + catalog icons (same lookup the lite strip uses) so the popover shows `Validated` / `Configured` / `Not configured` correctly.

### 3. No changes to

- `AppSearchDrawer`, `IntegrationStatusLite` rendering, `/api/v2/workflows/generate` request shape, guest-mode URL params, or webhook handling.

## Technical notes

- The Alluvial today calls `appDetailCtx?.openApp(appName)` from `handleVisitApp`. Once `onBubbleClick` handles the click, that path is no longer hit for the bubble — but it stays available for any code still using `onVisitApp` (e.g., a guest flow).
- `connectionViewMode === 'source_destination'` already gates Alluvial rendering, so this change only affects the three usecases that opt into it (`siem_case_management_1`, `edr_case_management_1`, `email_case_management_1`).
- After approval I will verify by opening `/usecases/siem_alerts`, clicking an existing source app bubble (expecting the same popover as the default card view), and clicking the `+` button (expecting the same `AppSearchDrawer` opened by `setAddToolFor`).
