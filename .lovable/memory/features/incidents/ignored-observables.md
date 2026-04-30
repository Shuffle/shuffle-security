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
- **Persisted key**: `encodeCompositeKey(type, value)` from
  `src/utils/compositeKey.ts` — uses `||` (NOT `::`) because
  `normalizeDatastoreKey` in `services/datastore.ts` greedily strips
  `::`-segmented keys down to the last segment, which silently destroyed the
  type prefix and broke round-tripping.
- **In-memory canonical key**: `canonicalCompositeKey(type, value)` =
  `${type.toLowerCase()}::${value.toLowerCase()}`. Use this for Set/Map
  membership and lookups; never send it to the API.
- **Value**: JSON `{ type, value, reason?, ignored_at }`. Type/value in the
  JSON payload is the source of truth on read (key may be lossy for legacy
  rows).
- Datastore is org-scoped via session, so the list is automatically per-org.

## Hook
`useIgnoredObservables()` (in `src/hooks/useIgnoredObservables.ts`) returns
`{ ignoredKeys, isIgnored(type,value), ignore(type,value,reason?), unignore(type,value), entries, refetch }`.

**Listing strategy**: fetch the full category list ONCE on mount, then keep a
local `Map<key, entry>` as the source of truth for the rest of the session.
`ignore`/`unignore` mutate the local map immediately (optimistic) and fire the
write/delete API in the background, rolling back on failure. We deliberately do
NOT re-list the datastore after writes — doing so caused a flicker where the
hidden observable would briefly disappear and then reappear if the API list
endpoint had not yet caught up with the write. Do not switch this back to
`useDatastore`'s default refetch-after-write pattern.

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
