---
name: Global agent handoff watcher
description: Single global toast watcher for stuck AI Agent handoffs (approvals + questions), polled per minute via shared query
type: feature
---
`AgentHandoffWatcher` (mounted once in `DashboardLayout`) is the sole component
that surfaces stuck AI Agent runs (approvals + open questions) outside the
dashboard. It subscribes to the shared `useAgentNotifications` query (60s
poll, 30s stale) so polling is never duplicated. Rules:
 - Skip toasts on `/dashboard` and `/` — already shown inline there.
 - Track toasted IDs per-session; baseline existing notifications on first load
   so users are not bombarded on sign-in.
 - Toasts are sticky (`duration: Infinity`) — handoffs are rare and important.
 - Action button opens `${entityBasePath}/${incident_id}` if present, else `/agent`.
Do NOT add additional pollers for `/api/v1/notifications` — extend this watcher.
