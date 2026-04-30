---
name: Incident section open-state persistence
description: Email Thread, Description, and Timeline collapse state persists in localStorage so users can keep their preferred workflow across incidents
type: feature
---

Users typically follow a consistent reading pattern per incident page — e.g.
"always show Description first" or "keep Email Thread collapsed". Forcing
them to re-toggle on every navigation is friction.

## Storage keys

- `shuffle-incident-email-thread-open` — `'1'` open, `'0'` collapsed.
  Read/written inside `EmailThreadPanel`.
- `shuffle-incident-description-open` — same format. Passed via the
  `Section` component's `storageKey` prop on both Description renders
  (left column when no email, right column when an email thread exists).
- `shuffle-incident-timeline-collapsed` — `'1'` collapsed, `'0'` open
  (legacy inverse semantics from when it was added). Lives directly in
  `IncidentDetailPage.tsx` next to the timeline state.

## Pattern: `Section` storageKey prop

`src/pages/dashboard/IncidentDetailPage.tsx`'s `Section` component accepts
an optional `storageKey`. If provided, the open/closed state is hydrated
from localStorage on mount and written on every change. Use this for any
new top-level collapsible section on the incident page so the user's
workflow preference sticks. `defaultOpen` is only consulted when the key
has never been set (or storage is unavailable).
