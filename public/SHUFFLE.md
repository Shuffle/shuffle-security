# Shuffle Core API Skill

A Claude Code / agent skill for building applications on top of the **Shuffle Core** backend API. Shuffle Core is the engine behind [shuffler.io](https://shuffler.io) — a workflow automation, integration, and orchestration platform with 3,000+ apps. This document teaches an AI agent how to use it as a backend without manual wiring.

> Authoritative spec: <https://shuffler.io/docs/API> · Source: <https://github.com/Shuffle/Shuffle>
>
> Every endpoint, payload shape and gotcha below is taken from a real production
> client (the Shuffle Security frontend in this repo). Where the official
> reference and the live API disagree, the live API wins — this document
> tracks the live API.

---

## 1. Connection & Auth

### Base URLs
- **EU Cloud (default):** `https://shuffler.io`
- **US Cloud:** `https://us.shuffler.io`
- **Self-hosted:** `https://<your-host>` (Nginx fronts the Go backend on port 5001)

The active region for a given user is published in `getinfo.region_url`. After
login, switch your client base URL to that value to avoid cross-region latency.

### Authentication
Two interchangeable mechanisms — pick **one** per request, never both:

1. **API key** (preferred for agents/scripts/server-to-server)
   ```
   Authorization: Bearer <APIKEY>
   ```
   Generate in the UI under user settings → "API key".

2. **Session cookie** (browser only)
   `session_token` cookie, set after `POST /api/v1/login`. Send
   `credentials: 'include'` and **omit** the `Authorization` header — sending
   both confuses the backend.

### Multi-tenancy
Most endpoints are scoped to the user's currently-active org. To call into a
sub-organisation without switching, send the header:

```
Org-Id: <suborg_uuid>
```

To permanently switch the active org for a session, `POST /api/v1/orgs/{id}/change`.
The response rotates session cookies — do a full client reload afterwards.

### Standard envelope
- `GET` reads return raw JSON (object or array — depends on endpoint).
- `POST/PUT` writes return `{ "success": true, "id"?: "...", "reason"?: "..." }`.
- Errors return `{ "success": false, "reason": "..." }` with HTTP 4xx/5xx.
- Some list endpoints return `200 OK` with valid data even on partial failure;
  always parse the body before treating a non-2xx as fatal.

---

## 2. Identity & Session

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/login` | `{username, password}` → sets session cookie, returns user info |
| `POST` | `/api/v1/logout` | Invalidate session |
| `GET`  | `/api/v1/getinfo` | **Source of truth** for current user, active org, role, region URL, feature flags, app execution limits. Call on every reload. |
| `GET`  | `/api/v1/getsettings` | Org-level settings (timezone, branding, MFA policy) |
| `GET`  | `/api/v1/getusers` | List users in current org (note: NOT `/users/getusers`) |
| `POST` | `/api/v1/orgs/{org_id}/change` | Switch active org. Rotates cookies → reload the client. |
| `GET`  | `/api/v1/orgs/{org_id}` | Read a single org |
| `PUT`  | `/api/v1/orgs/{org_id}` | Update org metadata |

`getinfo` returns (selected fields):
```jsonc
{
  "id": "<user_uuid>",
  "username": "alice@example.com",
  "role": "admin",                 // admin | org-reader | …
  "support": false,                 // staff flag
  "active_org": { "id": "...", "name": "..." },
  "orgs": [ /* ... */ ],
  "regions": [ /* ... */ ],
  "region_url": "https://shuffler.io",
  "app_execution_usage": 1234,
  "app_execution_limit": 10000,
  "mfa_info": { /* ... */ }
}
```

User registration is org-specific and gated by signup mode — use the UI flow or
the org admin tools rather than guessing an endpoint.

---

## 3. Workflows (Automation)

Workflows are the unit of execution: triggers + actions chained as a DAG.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/workflows` | List workflows in current org |
| `GET`  | `/api/v1/workflows/{id}` | Get workflow JSON |
| `POST` | `/api/v1/workflows` | Create |
| `PUT`  | `/api/v1/workflows/{id}` | Update full workflow (replace, not patch) |
| `DELETE` | `/api/v1/workflows/{id}` | Delete |
| `POST` | `/api/v1/workflows/{id}/execute` | Trigger run. Body: `{ "execution_argument": "<string-or-stringified-json>", "start"?: "<node_id>" }` |
| `GET`  | `/api/v1/workflows/{id}/executions` | List executions for a workflow |
| `GET`  | `/api/v1/workflows/{id}/executions/{execution_id}/abort` | Abort a running execution (yes, GET) |
| `POST` | `/api/v1/workflows/search` | Filter executions. Body: `{ workflow_id, cursor, limit, status, start_time, end_time, suborg_runs }`. Pass `workflow_id: "AGENT"` to fetch agent runs. |
| `GET`  | `/api/v1/workflows/usecases` | Curated usecase catalogue |
| `POST` | `/api/v2/workflows/generate` | Generate a workflow from a natural-language description |

### Polling for execution results

```
POST /api/v1/streams/results
Content-Type: application/json
{ "execution_id": "<id>", "authorization": "<auth or execution_id>" }
```

Lifecycle: `EXECUTING` → optionally `WAITING` (sub-flow / agent decision) →
`FINISHED` | `ABORTED`. Poll every 1–2 s until `status` is terminal. The
`results[]` array contains per-action output keyed by `action.id`.

> **Note:** `streams/results` is **POST**, not GET, and the request body
> carries the auth — there is no query-string variant in current builds.

### Webhook trigger
Create a webhook node, then `POST` arbitrary JSON or text to:

```
https://<host>/api/v1/hooks/webhook_<UUID>
```

The body becomes `exec.execution_argument` as a string (parse with
`JSON.parse(...)` in the workflow). No auth needed if the hook is public.

---

## 4. Apps & Integrations (3,000+)

Apps are reusable connectors (HTTP, Python, OpenAPI). Each has versioned **actions**.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/apps` | Apps available to the org (authenticated + public) |
| `GET`  | `/api/v1/apps/{app_id}/config` | Full app definition incl. actions & params |

For ad-hoc execution prefer **Singul** (`/api/v1/apps/categories/run`, §5) or
wrap the action in a workflow and call `/workflows/{id}/execute`. There is no
stable per-action `apps/{id}/run` endpoint — the singul/workflow route is
canonical.

### Authentication entries

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/apps/authentication` | List configured auths |
| `POST` | `/api/v1/apps/authentication` | Create or update. Identify by **`app_id` UUID**. To rename, include the existing `id` and a new `label`. |
| `DELETE` | `/api/v1/apps/authentication/{id}` | Remove |

Auth `fields` are app-specific (apikey, url, username/password, OAuth tokens).
Always send the **App ID UUID**, not the app name — names collide and change.

---

## 5. Singul — Categorised Actions (the magic layer)

Singul lets you call an action by **category + label** (vendor-agnostic) instead
of binding to one tool. The platform routes to whatever app the org has
authenticated for that category.

```
POST /api/v1/apps/categories/run
Content-Type: application/json
{
  "app_name": "PagerDuty",          // hint; "" lets the backend auto-pick
  "category": "cases",              // see catalogue below
  "label":    "create_ticket",      // standardised verb for the category
  "fields":   [
    { "key": "title", "value": "Phishing report" },
    { "key": "description", "value": "..." }
  ],
  "skip_workflow": true             // run the action directly, skip workflow wrapping
}
```

**Categories & common labels (non-exhaustive):**

| Category | Common labels |
|----------|---------------|
| `cases`   | `create_ticket`, `update_ticket`, `get_ticket`, `list_tickets`, `add_comment`, `close_ticket` |
| `email`   | `send_email`, `forward_email`, `get_emails`, `search_emails` |
| `comms`   | `send_message`, `create_channel`, `list_users` |
| `siem`    | `search`, `list_alerts`, `update_alert`, `add_to_lookup` |
| `edr`     | `isolate_host`, `unisolate_host`, `run_script`, `list_alerts` |
| `iam`     | `disable_user`, `enable_user`, `reset_password`, `list_users` |
| `assets`  | `get_asset`, `list_assets`, `update_asset` |
| `intel`   | `get_ioc`, `search_ioc`, `submit_ioc` |

Use Singul whenever the agent doesn't know which exact tool the customer has —
write integrations once, run on any vendor.

The response mirrors a workflow execution: it may return data inline, or an
execution stub `{ execution_id, authorization }` to poll via
`/api/v1/streams/results`.

---

## 6. Datastore (Key/Value cache)

A namespaced KV store backing most app state (incidents, assets, configs).
The endpoints are **org-scoped** and live under `/api/v1/orgs/{org_id}/...`.
There is also a v2 batch surface for cross-cutting operations.

### Single-item access (v1, org-scoped)

| Method | Endpoint | Body / Query | Purpose |
|--------|----------|--------------|---------|
| `POST` | `/api/v1/orgs/{org_id}/set_cache` | `{ key, value, category, ignore_security_rules?: true }` | Upsert one item |
| `POST` | `/api/v1/orgs/{org_id}/get_cache` | `{ key, category, org_id }` | Read one (404 = empty, treat as success) |
| `GET`  | `/api/v1/orgs/{org_id}/list_cache?category=<cat>&top=<n>&cursor=<c>` | — | Paginated list |
| `GET`  | `/api/v1/orgs/{org_id}/cache/{key}?authorization=<token>` | — | Public read (no session needed) |

### Bulk + revisions + automation (v2)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v2/datastore` | Bulk upsert. Body is an **array** of `{key, value, category}`. |
| `GET`  | `/api/v2/datastore/category/{category}/{key}/revisions` | History of edits for one entry |
| `POST` | `/api/v2/datastore/automate` | Configure category automations (workflow / webhook / agent triggers on create/edit/delete) |

### Conventions used by Shuffle Security
- `shuffle-security_incidents` — OCSF 2005 Incident Findings
- `shuffle-security_users` — Stakeholder registry
- `shuffle-security_assets` — OCSF 6002 Device Inventory
- `shuffle-security_sensors` — Endpoint monitor records
- `shuffle-security_ioc_types`, `_threat_feeds`, `_response_actions`, `_custom_fields`
- `shuffle-security_settings` — org preferences

### Critical rules
1. **`key` MUST be the raw entity ID** — the final `::`-separated segment of
   any namespaced string. Namespaced keys break round-trips (the API stores
   what you give it but read paths assume the bare ID).
2. **`value` is a JSON-encoded string.** Stringify your object client-side;
   the backend stores the string verbatim.
3. **`category`** is required on every read and write; without it the lookup
   silently misses.
4. The bulk `POST /api/v2/datastore` does **not** return per-item errors —
   on partial failure, fall back to per-item `set_cache` calls.

---

## 7. Files & Storage

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/files/create` | Reserve a file slot. Body: `{ filename, namespace?, workflow_id? }` → `{ file_id }` |
| `POST` | `/api/v1/files/{file_id}/upload` | `multipart/form-data` with field `shuffle_file` |
| `GET`  | `/api/v1/files/{file_id}/content` | Download bytes |
| `PUT`  | `/api/v1/files/{file_id}/edit` | Overwrite text contents in place |
| `GET`  | `/api/v1/files/namespaces/{ns}` | List files in a namespace. Add `?ids=true` for id-only listing. |
| `POST` | `/api/v1/files/download_remote` | Server-side fetch a remote URL into a file slot |
| `DELETE` | `/api/v1/files/{file_id}` | Remove |

Use namespaces to attach files to entities (e.g. `incident_<id>`,
`translation_output`, `sigma`).

---

## 8. AI Agent (LLM tool-use)

Shuffle's agent endpoint accepts a JSON-RPC `tools/call` request and resolves
it via available apps + workflows. The payload shape is **specific** — copy
exactly:

```
POST /api/v1/agent
Content-Type: application/json
{
  "jsonrpc": "2.0",
  "id": "<uuid>",
  "method": "tools/call",
  "params": {
    "input":      { "text": "<user prompt>" },
    "tool_name":  "<optional single app name>",
    "tool_id":    "<optional single app id>",
    "tool_names": ["<optional>", "..."],
    "tool_ids":   ["<optional>", "..."]
  }
}
```

Returns either a final result or an **execution stub**
`{ execution_id, ... }`. When a stub is returned, poll
`/api/v1/streams/results` (POST, body `{ execution_id, authorization }`) until
`status` ≠ `EXECUTING` and ≠ `WAITING`. The real output lives at
`response.result` (string or object); when it's an object, `result.message` is
the human-readable summary and the rest is structured data.

### High-stakes actions & approvals
"High-stakes" actions (network isolation, account disable, mass-delete) pause
the agent and emit a notification of `type=agent_question`. Approvals are
handled via the **Notifications API**, not a dedicated `/decide` endpoint:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/notifications?type=agent_question&status=open` | Pending approvals |
| `POST` | `/api/v1/notifications/{id}/markasread` | Approve / acknowledge → resumes the run |

The reference implementation in this repo (`src/services/agentRun.ts`) handles
the full lifecycle (build payload → fetch → detect stub → poll → unwrap) — use
it as the canonical client pattern.

### Activity history
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/workflows/search` with `workflow_id: "AGENT"` | List historical agent runs (cursor-paginated) |

---

## 9. Detection — Sigma rules & Tenzir pipelines

### Sigma rules

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/detections/Sigma` | List sigma detections (note the capital S) |
| `POST` | `/api/v1/detections/sigma/selected_rules/enable_folder` | Bulk-enable a folder of rules |
| `POST` | `/api/v1/detections/sigma/selected_rules/disable_folder` | Bulk-disable a folder |
| `POST` | `/api/v1/files/download_remote` | Pull the official rule pack from a Git URL |

AI generation: `POST /api/v1/conversation` with the sample log + an instruction
to produce a Sigma rule; the response contains the YAML.

### Tenzir pipelines (Pipeline Sensors)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/triggers` | List pipeline triggers (and other trigger types) |
| `POST` | `/api/v1/triggers/pipeline` | Create or update a Tenzir pipeline trigger |

A "Pipeline Sensor" is an `environment` of `Type: onprem` with
`data_lake.enabled: true` running an orborus + tenzir stack — see §10.

---

## 10. Environments & Orborus (execution runners)

Environments define **where** workflows execute (cloud, on-prem agent).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/getenvironments` | List |
| `PUT`  | `/api/v1/setenvironments` | **Full-state replace** — send the entire array. Read first, mutate, write back. Otherwise you delete other envs. |

Orborus runner deployment (Docker):
```bash
docker run -d \
  -e ORG=<org_id> \
  -e ENVIRONMENT_NAME=onprem \
  -e BASE_URL=https://shuffler.io \
  -e AUTH=<apikey> \
  ghcr.io/shuffle/orborus:latest
```

The bootstrap command is also served as a shell script at
`https://<host>/api/v1/orborus` for copy/paste install.

---

## 11. Notifications

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/notifications` | Inbox for current user. Filter with `?type=&status=`. |
| `POST` | `/api/v1/notifications/{id}/markasread` | Mark / acknowledge. Doubles as the agent approval endpoint. |
| `POST` | `/api/v1/notifications/clear` | Clear all |

Common notification `type` values: `agent_question`, `workflow_failure`,
`mention`, `system`.

---

## 12. Incidents, Vulnerabilities, Correlations (security domain)

These endpoints power the Shuffle Security UI specifically. They wrap the
underlying datastore with security-aware logic (deduplication, OCSF
validation, cross-org search).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/incidents` | List incidents across allowed orgs |
| `GET`  | `/api/v1/vulnerabilities` | List vulnerability findings |
| `GET`  | `/api/v2/correlations?key=<obs>&value=<v>` | Find datastore items sharing an observable across categories |
| `POST` | `/api/v1/apps/sensors/run` | Run a host-targeted action (terminal, isolate) on an orborus monitor |

Correlations exclude noise fields (`status`, `created_time`, `assignee`, `id`)
automatically. Treat the response as "rows that mention this observable" — the
UI groups them by category.

---

## 13. OCSF schema conventions

Incidents follow **OCSF 2005 (Incident Finding)**. Required fields:
- `class_uid: 2005`
- `category_uid: 2`
- `time` (epoch ms)
- `severity_id` (1=Info, 2=Low, 3=Medium, 4=High, 5=Critical)
- `status_id` (1=New, 2=In Progress, 3=Resolved, 4=Closed) **plus** matching
  `status` string
- `finding_info: { uid, title, desc, types[], created_time }`
- `assignee` (username string), optional `assignee_details`

Assets follow **OCSF 6002 (Device Inventory Info)**. Identify hosts by
**`hostname + serial_number`** for stability across re-installs.

Canonical status strings (case-sensitive): `New`, `In Progress`, `Resolved`,
`Closed`. Always write the matching pair (`status_id` + `status`).

---

## 14. Common recipes

### Run a workflow with arguments and wait for the result
```js
const start = await fetch(`${BASE}/api/v1/workflows/${id}/execute`, {
  method: 'POST',
  credentials: 'include',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ execution_argument: JSON.stringify({ ip: '1.2.3.4' }) }),
}).then(r => r.json());

let res;
do {
  await new Promise(r => setTimeout(r, 1500));
  res = await fetch(`${BASE}/api/v1/streams/results`, {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      execution_id: start.execution_id,
      authorization: start.authorization || start.execution_id,
    }),
  }).then(r => r.json());
} while (res.status === 'EXECUTING' || res.status === 'WAITING');
```

### Create a ticket via Singul (vendor-agnostic)
```js
await fetch(`${BASE}/api/v1/apps/categories/run`, {
  method: 'POST',
  credentials: 'include',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    app_name: '',                     // let the backend pick whatever ticket tool is authed
    category: 'cases',
    label:    'create_ticket',
    fields:   [
      { key: 'title',    value: 'Suspicious login' },
      { key: 'severity', value: 'high' },
    ],
    skip_workflow: true,
  }),
});
```

### Persist an OCSF incident to the datastore
```js
const orgId = userInfo.active_org.id;
await fetch(`${BASE}/api/v1/orgs/${orgId}/set_cache`, {
  method: 'POST',
  credentials: 'include',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    category: 'shuffle-security_incidents',
    key:   incident.id,                 // raw ID, NOT a namespaced string
    value: JSON.stringify(incident),    // OCSF 2005 object, stringified
    ignore_security_rules: true,
  }),
});
```

### Bulk write
```js
await fetch(`${BASE}/api/v2/datastore`, {
  method: 'POST',
  credentials: 'include',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
             'Org-Id': orgId },
  body: JSON.stringify(items.map(i => ({
    key: i.id, value: JSON.stringify(i), category: 'shuffle-security_assets',
  }))),
});
```

### Pivot correlations across categories
```js
const r = await fetch(
  `${BASE}/api/v2/correlations?key=ip&value=1.2.3.4`,
  { credentials: 'include', headers: { Authorization: `Bearer ${KEY}` } },
).then(r => r.json());
// r.data → entries from every category that reference 1.2.3.4
```

### Ask the agent to do something
```js
const stub = await fetch(`${BASE}/api/v1/agent`, {
  method: 'POST',
  credentials: 'include',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { input: { text: 'Look up the reputation of 1.2.3.4' } },
  }),
}).then(r => r.json());
// If stub.execution_id exists → poll /api/v1/streams/results as above.
```

---

## 15. Pitfalls & gotchas

- **`setenvironments` is destructive.** Always GET → mutate → PUT the full
  list, never PUT a subset.
- **Datastore keys** must be the raw entity ID. Namespaced (`cat::id`) strings
  break read-after-write.
- **App identity** is the **`app_id` UUID** — names collide and change.
- **Org switch reloads cookies.** After `/orgs/{id}/change`, do a full client
  reload or all subsequent requests fail with stale auth.
- **Service workers** must exclude `/api/` from runtime caching, or you get
  stale auth + stale data.
- **`getinfo` is mandatory** on every app load to support cookie-only sessions
  and to learn the user's `region_url`.
- **Webhooks** accept any payload; the body becomes `execution_argument` as a
  **string**. Parse with `JSON.parse` on the workflow side.
- **`streams/results` is POST**, not GET, with the auth in the JSON body.
- **Agent results may be wrapped twice**: `{ result: { message, ... } }`.
  Surface `result.message` as the headline and treat the rest as structured.
- **Approvals are notifications**, not a dedicated endpoint. Mark the
  `agent_question` notification as read to approve the pending action.
- **Don't send `Authorization` _and_ a session cookie.** Pick one per request;
  some endpoints reject the combination.
- **404 from `get_cache`** means "key not found", not a transport error —
  treat as empty.
- **Some list endpoints return 4xx with valid JSON in the body.** Inspect
  the body before declaring failure.
- **Rate limits:** cloud enforces `app_execution_limit` per month per org;
  surface `app_execution_usage` from `getinfo` to the user.

---

## 16. Reference

- Official API spec: <https://shuffler.io/docs/API>
- Source code: <https://github.com/Shuffle/Shuffle>
- Singul library: <https://github.com/Shuffle/singul.js>
- App catalogue: <https://shuffler.io/apps>
- Workflow templates: <https://shuffler.io/workflows>
- Reference client (this repo): `src/services/`, `src/hooks/`, `src/config/api.ts`

---

*Drop this file into a Claude Code skill (`~/.claude/skills/shuffle/SKILL.md`)
or any agent that supports markdown skill files. The agent now has enough
surface area to build a full security platform on Shuffle Core without per-call
hand-holding.*
