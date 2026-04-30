---
name: Ignored observables
description: Per-org list of uninteresting observables hidden from the default Observables view
type: feature
---

Users can mark any observable (manual or enrichment-sourced) as "ignored" so it
disappears from the default Observables tab on incident detail. Stored per-org
in the Shuffle datastore.

## Storage
- **Category**: `ignored-observables`
- **Key**: `${type.toLowerCase()}::${value.toLowerCase()}` — same canonical
  identity used for `iocObservableKeys`, correlations, and highlights elsewhere.
- **Value**: JSON `{ type, value, reason?, ignored_at }`.
- Datastore is org-scoped via session, so the list is automatically per-org.

## Hook
`useIgnoredObservables()` (in `src/hooks/useIgnoredObservables.ts`) returns
`{ ignoredKeys, isIgnored(type,value), ignore(type,value,reason?), unignore(type,value), entries, refetch }`.
Auto-fetches once on mount.

## UI on incident detail Observables tab
- Each row has a VisibilityOff icon next to Search/Delete. Click toggles
  ignore/unignore. Shown for both manual and enrichment observables.
- Filter bar shows a "Show ignored (N)" / "Hide ignored (N)" chip when
  the org has any ignored entries — toggles `showIgnoredObs` state.
- Ignored rows are filtered out of the unified list by default; when
  revealed they render at 55% opacity so they read as "muted but visible".

## Counts
Tab badges and activity-feed deltas still count ignored observables (they
remain in `editedObservables` / `enrichments`). Ignoring is purely a view
filter, not a data deletion.
