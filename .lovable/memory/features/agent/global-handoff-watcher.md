---
name: Global agent handoff watcher
description: Single global toast watcher for stuck AI Agent handoffs — splits approval (Approve/Deny inline) vs question (Answer/Dismiss) flows
type: feature
---
`AgentHandoffWatcher` (mounted once in `DashboardLayout`) is the sole component
that surfaces stuck AI Agent runs outside the dashboard. It subscribes to the
shared `useAgentNotifications` query (60s poll, 30s stale) so polling is never
duplicated.

Two distinct handoff systems share the same notification feed (both polled via
`?type=agent_question`) and MUST be kept visually + functionally separate.
Disambiguation lives in `isApprovalNotification(n)` and uses, in order:
  1. `severity` — "medium" → approval, "low" → question
  2. Title/description wording — "approval required" → approval,
     "input required" → question
  3. Legacy fallback — `questions[]` populated → question

The two flows:
 1. **Approval** (`isApprovalNotification(n) === true`) — agent wants to perform
    an action and needs go/no-go. Toast headline "AI Agent needs approval" and
    exposes inline `Approve` (action) + `Deny` (cancel) buttons that call
    `continueAgentExecution({ approve })` followed by `approveAgentAction(id)`.
    Both buttons refresh the shared notifications query on success.
 2. **Question** (`questions[]` present) — agent needs typed answers. Toast
    headline "AI Agent has a question" with `Answer` (navigates to incident or
    `/agent` where the question form lives) + `Dismiss`. Cannot be answered
    inline because answers require a multi-field form.

Other rules:
 - Skip toasts on `/dashboard` and `/` — already shown inline there.
 - Track toasted IDs per-session; baseline existing notifications on first load
   so users are not bombarded on sign-in.
 - Toasts are sticky (`duration: Infinity`) — handoffs are rare and important.
 - Navigation target: `${entityBasePath}/${incident_id}` if present, else `/agent`.
Do NOT add additional pollers for `/api/v1/notifications` — extend this watcher.
