# Cross-reference merging + threading

Replace the current destructive `smartMerge` (which folds a source into a target and tombstones the source) with a lightweight **pointer-array** model. Incidents stay separate rows; the frontend cross-loads and unions them at render time. Merged incidents get a dedicated status whose detail page redirects to the primary.

## Data model

Each incident gets a new field on its JSON payload:

```json
"related_incidents": [
  {
    "id": "abc123",
    "relation": "merged",         // "merged" | "duplicate" | "related"
    "primary": true,               // exactly one side of a merge pair is primary
    "linked_at": "2026-07-20T...",
    "linked_by": "user@x"
  }
]
```

- Written symmetrically: merging B into A adds a `{id: B, primary: false}` entry on A and a `{id: A, primary: true}` entry on B.
- Primary owns status, assignee, SLA, resolution. Non-primary shows read-only.
- Unmerge = delete the pointer on both sides. No payload rewriting.

## Merged status

Add `status_id: 5` = "Merged" alongside the existing OCSF status mapping (New/In Progress/Resolved/Closed). Non-primary incidents in a merge pair are flipped to this status when the link is created; unmerge flips them back to their prior status (stored on the pointer as `previous_status`).

- Status chip color: neutral grey with a link icon.
- List views: filter out `status_id: 5` by default (like Resolved is optionally hidden), with a "Show merged" toggle.

## Incident detail behavior when Merged

If the current incident has `status_id: 5`:
- Render a compact "This incident was merged into &lt;Primary title&gt;" banner at the top.
- Primary CTA button: **Open primary incident** (navigates to the primary).
- Body of the page is dimmed / read-only; comments and observables are still viewable for audit but not editable.
- Also visible: "Unmerge" button (permission-gated) that clears the link on both sides.

## Primary incident view

When an incident has `related_incidents` entries where it is the primary:
- Banner listing linked incidents with title + status + unlink button.
- **Email thread panel** concatenates each linked incident's `resolveEmailThread(...)` output, sorts by date across all sources, tags each message with its source incident id.
- **Observables / IOCs / correlations tabs** compute a union across primary + linked incidents (dedup by composite key). Each row shows a small "from &lt;incident&gt;" chip when it originates from a linked one.
- **Activity feed** interleaves timelines from all linked incidents.
- Tasks stay per-incident (not unioned) — merging shouldn't reshuffle work assignments.

## Fetching

New hook `useRelatedIncidents(incident)`:
- Reads `related_incidents` from the incident payload.
- Fires parallel `GET /api/v1/incidents/{id}` for each pointer through the existing coalesced fetch layer.
- Returns `{ linked: Incident[], primary: Incident | null, loading, error }`.
- Silently drops incidents the caller cannot see (multi-tenant permission mismatch) and reports the count in the banner ("2 linked incidents, 1 not visible to you").

## Merge flow

`MergeIncidentDialog` (existing) is repurposed:
- User picks a target ("merge INTO which incident").
- Confirming issues two PUT requests: primary gets a `{id: source, primary: false}` pointer; source gets a `{id: primary, primary: true}` pointer AND `status_id: 5` with `previous_status` stashed on the pointer.
- No payload copy, no field union, no tombstone. Existing `smartMerge` util is deleted.

Auto-suggestions from `scoreMergeCandidates` keep working unchanged — they just call the new merge writer.

## Files to change

- `src/config/ocsfIncidentSchema.ts` — add status_id 5 "Merged".
- `src/config/incidentConfig.ts` — status color + list-filter default.
- `src/lib/utils.ts` — delete `smartMerge` and `deepMergeIncidents` merge-target logic; keep the cross-tenant view merger unchanged.
- `src/utils/mergeCandidateScoring.ts` — untouched (scoring still relevant).
- `src/hooks/useRelatedIncidents.ts` — new.
- `src/hooks/useMergeCandidates.ts` — call new merge writer.
- `src/components/incidents/MergeIncidentDialog.tsx` — new pointer writer.
- `src/components/incidents/MergedIncidentBanner.tsx` — new (the "jump to primary" banner + CTA).
- `src/components/incidents/RelatedIncidentsBanner.tsx` — new (primary side, list + unlink).
- `src/components/incidents/EmailThreadPanel.tsx` — accept multiple incident sources, sort union.
- `src/components/incidents/ObservablesTab.tsx`, `CorrelationsTab.tsx`, `IOCsTab.tsx`, `ActivityFeed.tsx` — union across linked incidents.
- Incident detail page (`src/pages/dashboard/...`) — mount banners, gate edit UI when `status_id: 5`.
- List page filter — hide Merged by default with toggle.

## Migration for existing merged incidents

Existing incidents already carry `status_id: 99` + `merged_into` (from old smartMerge). A one-time UI-side reconciliation on load:
- If `merged_into` is set and no `related_incidents` pointer exists, synthesize a pointer pair and write it back on next interaction (lazy migration — no bulk job).
- Flip `status_id: 99` → `5` at the same time.

## Downsides accepted

- **N+1 fetches per open** for the primary. Coalesced fetcher + 30s cache absorbs most of it; if it gets heavy we add a batch `?ids=` endpoint later.
- **List views** won't reflect the union (search on incident B still finds B). Acceptable — B is Merged status, one click to reach primary.
- **Two mutations per merge** (both sides). If one fails we retry the other; worst case a one-sided pointer remains and the UI shows an "inconsistent link" warning with a repair button.

## Out of scope

- Backend follow-pointer at ingest. Provider keeps overwriting the source incident by thread-id, which is exactly what we want — new replies show up in the primary automatically via the render-time union.
- Multi-level chains (A → B → C). Merge target must itself be primary or unmerged; the dialog rejects merging into an already-Merged incident.
