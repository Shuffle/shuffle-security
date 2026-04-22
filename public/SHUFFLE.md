# Shuffle Core API Skill

A Claude Code / agent skill for building security platforms on top of the
**Shuffle Core** backend API. Shuffle Core is the engine behind
[shuffler.io](https://shuffler.io) - a workflow automation, integration, and
orchestration platform with 3,000+ apps. This skill teaches an agent how to
use Shuffle as the backend for a security product without per-call
hand-holding.

> Authoritative spec: <https://shuffler.io/docs/API> * Source: <https://github.com/Shuffle/Shuffle>
>
> Every endpoint, payload shape and gotcha below is taken from a real
> production client (the Shuffle Security frontend in this repo). Where the
> public reference and the live API disagree, the live API wins - this
> document tracks the live API.

---

## 0. Quick start

1. **Pick a base URL** - `https://shuffler.io` (EU), `https://us.shuffler.io`
   (US), or your self-hosted host.
2. **Get an API key** - UI -> user settings -> "API key". Send as
   `Authorization: Bearer <key>` on every request, or use a session cookie
   (never both).
3. **Call `GET /api/v1/getinfo`** - source of truth for the active user, the
   active org, and the user's `region_url`. Retarget your client to that URL
   if it differs from where you logged in.

```js
const BASE = 'https://shuffler.io';
const KEY  = process.env.SHUFFLE_API_KEY;
const H    = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const me = await fetch(`${BASE}/api/v1/getinfo`, { headers: H }).then(r => r.json());
console.log(me.username, '->', me.active_org.id);
```

That single call gives you everything else you need: `active_org.id` (used in
every datastore call), `region_url` (your true API base), `regions[]`,
`role`, `app_execution_usage` and `app_execution_limit`.

---

## 1. Tenants & multi-tenancy *(start here)*

Shuffle is multi-tenant by design. Every org can have **sub-organisations**
(tenants), and every API call runs against exactly one org at a time.

### Read tenants

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/orgs` | All orgs the current user can see |
| `GET`  | `/api/v1/orgs/{org_id}` | Read a single org |
| `GET`  | `/api/v1/orgs/{org_id}/suborgs` | Direct children of an org |
| `GET`  | `/api/v1/getinfo` | Includes `active_org` and the full `orgs[]` list |

### Create / update / switch tenants

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| `POST` | `/api/v1/orgs/{parent_org_id}/create_sub_org` | `{ org_id: parent_org_id, name }` | Create a sub-tenant |
| `PUT`  | `/api/v1/orgs/{org_id}` | partial org JSON | Update name, image, settings |
| `POST` | `/api/v1/orgs/{org_id}/change` | - | Switch the current session's active org. **Rotates cookies - do a full client reload after.** |

### Cross-tenant requests without switching

To read from a sub-tenant in a single request without changing the active
org, send the header:

```
Org-Id: <suborg_uuid>
```

This works on virtually every endpoint and is the safe way to fan out across
tenants from a parent org.

### Recipe - list every incident across every tenant

```js
const me = await fetch(`${BASE}/api/v1/getinfo`, { headers: H }).then(r => r.json());
const orgs = me.orgs ?? [me.active_org];

const all = [];
for (const org of orgs) {
  const url = `${BASE}/api/v1/orgs/${org.id}/list_cache`
            + `?category=shuffle-security_incidents&top=200`;
  const items = await fetch(url, { headers: { ...H, 'Org-Id': org.id } })
    .then(r => r.json())
    .then(d => Array.isArray(d) ? d : (d.keys || d.data || []));
  all.push(...items.map(i => ({ ...i, _org: org.id })));
}
```

---

## 2. Tickets / incidents via the built-in KV store

Shuffle ships a namespaced key/value store ("datastore" / "cache") that backs
most security state - incidents, tickets, assets, IOCs, settings. It is the
fastest path to a working security backend: no schema migrations, no separate
DB.

### Endpoints (org-scoped, v1)

| Method | Endpoint | Body / Query | Purpose |
|--------|----------|--------------|---------|
| `POST` | `/api/v1/orgs/{org_id}/set_cache` | `{ key, value, category, ignore_security_rules?: true }` | Upsert one item |
| `POST` | `/api/v1/orgs/{org_id}/get_cache` | `{ key, category, org_id }` | Read one. **404 = not found, treat as empty (success).** |
| `GET`  | `/api/v1/orgs/{org_id}/list_cache?category=<cat>&top=<n>&cursor=<c>` | - | Paginated list |
| `GET`  | `/api/v1/orgs/{org_id}/cache/{key}?authorization=<token>` | - | Public read (no session) - used for share links |
| `DELETE` | `/api/v1/orgs/{org_id}/delete_cache` | `{ key, category }` | Remove one |

### Bulk + history + automation (v2)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v2/datastore` | Bulk upsert. Body is an **array** of `{key, value, category}`. Send `Org-Id` header. |
| `GET`  | `/api/v2/datastore/category/{category}/{key}/revisions` | Full edit history for one entry |
| `POST` | `/api/v2/datastore/automate` | Configure category automations (workflow / webhook / agent triggers on create/edit/delete) |
| `GET`  | `/api/v2/correlations?key=<obs>&value=<v>` | Find every entry across every category that mentions an observable |

### Conventions used by Shuffle Security

| Category | Stores |
|----------|--------|
| `shuffle-security_incidents` | OCSF 2005 Incident Findings (the "tickets") |
| `shuffle-security_users` | Stakeholder registry |
| `shuffle-security_assets` | OCSF 6002 Device Inventory |
| `shuffle-security_sensors` | Endpoint monitor records |
| `shuffle-security_ioc_types` / `_threat_feeds` / `_response_actions` / `_custom_fields` | Detection config |
| `shuffle-security_settings` | Org preferences |

### Hard rules (read once, save weeks of debugging)

1. **`key` MUST be the raw entity ID** - the final `::`-separated segment of
   any namespaced string. Namespaced keys (`incidents::abc-123`) silently
   break round-trips.
2. **`value` is a JSON string.** Stringify your object client-side; the
   backend stores the string verbatim.
3. **`category` is required on every read and write.** Without it the lookup
   silently misses.
4. **The bulk `POST /api/v2/datastore` does not return per-item errors.** On
   partial failure, fall back to per-item `set_cache` calls.
5. **Some list endpoints return HTTP 4xx with valid JSON in the body.**
   Parse before treating non-2xx as fatal.

### Recipe - create, read, update, list a ticket

```js
const orgId = me.active_org.id;
const ticket = {
  id: crypto.randomUUID(),
  class_uid: 2005, category_uid: 2,
  time: Date.now(),
  severity_id: 4, severity: 'High',
  status_id: 1,   status: 'New',
  finding_info: {
    uid: '',                          // filled in below
    title: 'Suspicious login from new country',
    desc:  'User alice@acme.com signed in from RU.',
    types: ['authentication'],
    created_time: Date.now(),
  },
  assignee: 'bob@acme.com',
};
ticket.finding_info.uid = ticket.id;

// CREATE
await fetch(`${BASE}/api/v1/orgs/${orgId}/set_cache`, {
  method: 'POST', headers: H,
  body: JSON.stringify({
    category: 'shuffle-security_incidents',
    key: ticket.id,                       // raw ID, never namespaced
    value: JSON.stringify(ticket),        // value is a string
    ignore_security_rules: true,
  }),
});

// READ
const got = await fetch(`${BASE}/api/v1/orgs/${orgId}/get_cache`, {
  method: 'POST', headers: H,
  body: JSON.stringify({
    key: ticket.id, category: 'shuffle-security_incidents', org_id: orgId,
  }),
}).then(r => r.json());
const current = JSON.parse(got.value);

// UPDATE - fetch, mutate, write back (last-write-wins)
current.status_id = 2; current.status = 'In Progress';
await fetch(`${BASE}/api/v1/orgs/${orgId}/set_cache`, {
  method: 'POST', headers: H,
  body: JSON.stringify({
    category: 'shuffle-security_incidents',
    key: current.id,
    value: JSON.stringify(current),
    ignore_security_rules: true,
  }),
});

// LIST (paginated)
const list = await fetch(
  `${BASE}/api/v1/orgs/${orgId}/list_cache?category=shuffle-security_incidents&top=100`,
  { headers: H }
).then(r => r.json());
```

### Recipe - find every entry that references an observable

```js
// "Show me everything that touched 1.2.3.4"
const r = await fetch(
  `${BASE}/api/v2/correlations?key=ip&value=1.2.3.4`,
  { headers: H }
).then(r => r.json());
// r.data -> entries from every category that reference 1.2.3.4
```

### OCSF schema crib

Incidents follow **OCSF 2005 (Incident Finding)**. Required:
`class_uid: 2005`, `category_uid: 2`, `time` (epoch ms), `severity_id`
(1=Info -> 5=Critical), `status_id` + matching `status` string,
`finding_info: { uid, title, desc, types[], created_time }`, `assignee`.
Canonical status pairs: `1/New`, `2/In Progress`, `3/Resolved`, `4/Closed`.

Assets follow **OCSF 6002 (Device Inventory Info)**. Identify hosts by
**`hostname + serial_number`** so re-installs do not create duplicates.

---

## 3. Running and managing agent executions

Shuffle's agent endpoint is JSON-RPC `tools/call`. It picks the right app,
runs the action, and returns either an inline result or an **execution stub**
you poll for completion.

### Trigger an agent

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

### Poll for the real result

If the response contains `execution_id` but no `result`, it is a stub. Poll:

```
POST /api/v1/streams/results
Content-Type: application/json
{ "execution_id": "<id>", "authorization": "<auth or execution_id>" }
```

Lifecycle: `EXECUTING` -> optionally `WAITING` (sub-flow / pending approval) ->
`FINISHED` | `ABORTED`. Poll every 1-2 s until `status` is terminal.

The real output lives at `response.result`. When `result` is an object,
`result.message` is the human-readable summary; the rest is structured data.

### Approvals for "high-stakes" actions

Actions like **isolate host**, **disable user**, **mass delete** pause the run
and emit a notification of `type=agent_question`. Approvals flow through the
**Notifications API** - there is no dedicated `/decide` endpoint:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/notifications?type=agent_question&status=open` | Pending approvals |
| `POST` | `/api/v1/notifications/{id}/markasread` | Approve / acknowledge -> resumes the run |

### Inspect run history

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/workflows/search` | Body: `{ workflow_id: "AGENT", cursor, limit, status, start_time, end_time, suborg_runs }` |

### Reference client

`src/services/agentRun.ts` in this repo implements the full pattern (build
payload -> fetch -> detect stub -> poll -> unwrap). Mirror it instead of
re-deriving the lifecycle.

### Recipe - ask the agent to triage an alert

```js
const stub = await fetch(`${BASE}/api/v1/agent`, {
  method: 'POST', headers: H,
  body: JSON.stringify({
    jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call',
    params: { input: { text: 'Look up the reputation of 1.2.3.4 and create a ticket if malicious.' } },
  }),
}).then(r => r.json());

let res = stub;
while (res.execution_id && (res.status === 'EXECUTING' || res.status === 'WAITING' || res.result === undefined)) {
  await new Promise(r => setTimeout(r, 1500));
  res = await fetch(`${BASE}/api/v1/streams/results`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      execution_id: stub.execution_id,
      authorization: stub.authorization || stub.execution_id,
    }),
  }).then(r => r.json());
  if (res.status === 'FINISHED' || res.status === 'ABORTED') break;
}
console.log(res.result?.message ?? res.result);
```

---

## 4. Enabling usecases with `/api/v2/workflows/generate`

`/api/v2/workflows/generate` is the **single endpoint that turns on a use
case**. Instead of building a workflow node-by-node, you describe what you
want with a `label` (and optionally a category + apps) and Shuffle materialises
the workflow + webhook + automations for you.

### Endpoint

```
POST /api/v2/workflows/generate
{
  "label":       "Ingest Tickets",   // canonical usecase label
  "category":    "cases",            // optional - singul category
  "app_name":    "servicenow",       // optional - single app, comma-separated for multiple
  "action_name": "remove"            // optional - pass to disable / tear down
}
```

Common `label` values:

| Label | What it builds |
|-------|----------------|
| `Ingest Tickets` | Pull tickets from one or more ITSM/case tools into the datastore |
| `Ingest Tickets_webhook` | Stand up a public webhook that ingests tickets pushed at us |
| `Forward Tickets` | Push every new local ticket out to a downstream tool |
| `Send Message` | Slack/Teams/email notifier wired to incident events |
| `Enrich IP` / `Enrich Hash` / `Enrich URL` | IOC enrichment workflows |
| `Isolate Host` | EDR-backed host containment with approval gate |
| `Disable User` | IAM-backed user disable with approval gate |

### Disable / tear down

Re-POST the same `label` (+ `app_name` if scoped to one app) with
`"action_name": "remove"`. The platform removes the generated workflow and
unsubscribes the webhook.

### Recipe - turn on ticket ingestion from ServiceNow + Jira

```js
await fetch(`${BASE}/api/v2/workflows/generate`, {
  method: 'POST', headers: H,
  body: JSON.stringify({
    label: 'Ingest Tickets',
    category: 'cases',
    app_name: 'servicenow,jira',
  }),
});
```

That single call creates the workflow, links the right authentications, and
starts dropping tickets into `shuffle-security_incidents` as OCSF 2005 items
you can read with `list_cache`.

---

## 5. Apps & their MCPs

Shuffle exposes every app as an **MCP-style tool** at
`POST /api/v1/apps/{app_name}/mcp`. The agent can call them; you can call
them directly from your own UI for "talk to my SIEM" features.

### App lifecycle

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/apps` | Apps available to the org (authenticated + public) |
| `GET`  | `/api/v1/apps/{app_id}/config` | Full app definition incl. actions & params |
| `POST` | `/api/v1/apps/{app_id}/activate` | Make an app available to this org |
| `POST` | `/api/v1/apps/{app_id}/deactivate` | Remove it |

### Authentication entries

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/apps/authentication` | List configured auths |
| `POST` | `/api/v1/apps/authentication` | Create or update. Identify by **`app_id` UUID**. To rename, include the existing `id` and a new `label`. |
| `DELETE` | `/api/v1/apps/authentication/{id}` | Remove |

`fields` are app-specific (apikey, url, username/password, OAuth tokens).
**Always send the App ID UUID, not the name** - names collide and change.

### Talk to an app (MCP)

```
POST /api/v1/apps/{app_name}/mcp
Content-Type: application/json
{
  "jsonrpc": "2.0",
  "id": "<uuid>",
  "method": "tools/call",
  "params": {
    "tool_name": "<app_name>",
    "tool_id":   "<app_id_or_name>",
    "input":     { "text": "List the last 10 critical alerts" }
  }
}
```

Same response shape as `/api/v1/agent`: either an inline `result` (string,
or `{ message, ...structured }`) or an execution stub to poll on
`/api/v1/streams/results`.

### Recipe - activate Splunk, authenticate it, ask it a question

```js
// 1. activate
await fetch(`${BASE}/api/v1/apps/<splunk_app_id>/activate`, { method: 'POST', headers: H });

// 2. authenticate
await fetch(`${BASE}/api/v1/apps/authentication`, {
  method: 'POST', headers: H,
  body: JSON.stringify({
    app_id: '<splunk_app_id>',
    label:  'Splunk - prod',
    fields: [
      { key: 'url',    value: 'https://splunk.acme.com:8089' },
      { key: 'apikey', value: process.env.SPLUNK_TOKEN },
    ],
  }),
});

// 3. ask it something via MCP
const r = await fetch(`${BASE}/api/v1/apps/splunk/mcp`, {
  method: 'POST', headers: H,
  body: JSON.stringify({
    jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call',
    params: {
      tool_name: 'splunk', tool_id: 'splunk',
      input: { text: 'Show critical authentication failures from the last hour' },
    },
  }),
}).then(r => r.json());
console.log(r.result?.message ?? r.result);
```

---

## 6. Singul - categorised actions (vendor-agnostic)

Singul lets you call an action by **category + label** instead of binding to
one tool. The platform routes to whatever app the org has authenticated for
that category. Use this when you do not know the customer's stack.

```
POST /api/v1/apps/categories/run
{
  "app_name":      "",                // hint; "" lets the backend auto-pick
  "category":      "cases",
  "label":         "create_ticket",
  "fields":        [
    { "key": "title",       "value": "Phishing report" },
    { "key": "description", "value": "..." }
  ],
  "skip_workflow": true                // run directly, skip workflow wrapping
}
```

| Category | Common labels |
|----------|---------------|
| `cases`  | `create_ticket`, `update_ticket`, `get_ticket`, `list_tickets`, `add_comment`, `close_ticket` |
| `email`  | `send_email`, `forward_email`, `get_emails`, `search_emails` |
| `comms`  | `send_message`, `create_channel`, `list_users` |
| `siem`   | `search`, `list_alerts`, `update_alert`, `add_to_lookup` |
| `edr`    | `isolate_host`, `unisolate_host`, `run_script`, `list_alerts` |
| `iam`    | `disable_user`, `enable_user`, `reset_password`, `list_users` |
| `assets` | `get_asset`, `list_assets`, `update_asset` |
| `intel`  | `get_ioc`, `search_ioc`, `submit_ioc` |

Response: same as a workflow execution - inline data or an execution stub to
poll.

---

## 7. Workflows (raw)

When the use-case generator and Singul are not enough, drive workflows
directly.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/workflows` | List workflows in current org |
| `GET`  | `/api/v1/workflows/{id}` | Get workflow JSON |
| `POST` | `/api/v1/workflows` | Create |
| `PUT`  | `/api/v1/workflows/{id}` | Update full workflow (replace, not patch) |
| `DELETE` | `/api/v1/workflows/{id}` | Delete |
| `POST` | `/api/v1/workflows/{id}/execute` | Trigger run. Body: `{ "execution_argument": "<string-or-stringified-json>", "start"?: "<node_id>" }` |
| `GET`  | `/api/v1/workflows/{id}/executions` | List executions |
| `GET`  | `/api/v1/workflows/{id}/executions/{execution_id}/abort` | Abort (yes, GET) |
| `POST` | `/api/v1/workflows/search` | Filter executions across all workflows |
| `GET`  | `/api/v1/workflows/usecases` | Curated usecase catalogue |

### Webhook trigger

Create a webhook node, then `POST` arbitrary JSON or text to:

```
https://<host>/api/v1/hooks/webhook_<UUID>
```

The body becomes `exec.execution_argument` as a string - parse with
`JSON.parse` on the workflow side. No auth needed if the hook is public.

---

## 8. Identity & session

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/login` | `{username, password}` -> sets session cookie, returns user info |
| `POST` | `/api/v1/logout` | Invalidate session |
| `GET`  | `/api/v1/getinfo` | **Source of truth** - call on every reload |
| `GET`  | `/api/v1/getsettings` | Org-level settings (timezone, branding, MFA policy) |
| `GET`  | `/api/v1/getusers` | List users in current org (note: NOT `/users/getusers`) |

Auth: send `Authorization: Bearer <key>` **or** rely on the `session_token`
cookie with `credentials: 'include'`. Never both - some endpoints reject the
combination.

`getinfo` returns (selected fields):

```jsonc
{
  "id": "<user_uuid>",
  "username": "alice@example.com",
  "role": "admin",                 // admin | org-reader | ...
  "support": false,                 // staff flag
  "active_org": { "id": "...", "name": "..." },
  "orgs": [ /* every org the user can see */ ],
  "regions": [ /* every region the user has access to */ ],
  "region_url": "https://shuffler.io",
  "app_execution_usage": 1234,
  "app_execution_limit": 10000,
  "mfa_info": { /* ... */ }
}
```

---

## 9. Files & storage

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/files/create` | Reserve a file slot. Body: `{ filename, namespace?, workflow_id? }` -> `{ file_id }` |
| `POST` | `/api/v1/files/{file_id}/upload` | `multipart/form-data` with field `shuffle_file` |
| `GET`  | `/api/v1/files/{file_id}/content` | Download bytes |
| `PUT`  | `/api/v1/files/{file_id}/edit` | Overwrite text contents in place |
| `GET`  | `/api/v1/files/namespaces/{ns}` | List files in a namespace. Add `?ids=true` for id-only listing. |
| `POST` | `/api/v1/files/download_remote` | Server-side fetch a remote URL into a file slot |
| `DELETE` | `/api/v1/files/{file_id}` | Remove |

Use namespaces to attach files to entities (e.g. `incident_<id>`, `sigma`,
`translation_output`).

---

## 10. Detection - Sigma rules & Tenzir pipelines

### Sigma

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/detections/Sigma` | List sigma detections (note the capital S) |
| `POST` | `/api/v1/detections/sigma/selected_rules/enable_folder` | Bulk-enable a folder of rules |
| `POST` | `/api/v1/detections/sigma/selected_rules/disable_folder` | Bulk-disable a folder |
| `POST` | `/api/v1/files/download_remote` | Pull the official rule pack from a Git URL |
| `POST` | `/api/v1/conversation` | AI: generate a Sigma rule from a sample log |

### Tenzir pipelines

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/triggers` | List triggers (incl. pipelines) |
| `POST` | `/api/v1/triggers/pipeline` | Create or update a Tenzir pipeline trigger |

A "Pipeline Sensor" is an `environment` with `Type: onprem` and
`data_lake.enabled: true` running an orborus + tenzir stack - see §11.

---

## 11. Environments & Orborus (execution runners)

Environments define **where** workflows execute (cloud, on-prem agent).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/getenvironments` | List |
| `PUT`  | `/api/v1/setenvironments` | **Full-state replace** - send the entire array. Read first, mutate, write back. Otherwise you delete other envs. |

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

## 12. Notifications

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/notifications` | Inbox for current user. Filter with `?type=&status=`. |
| `POST` | `/api/v1/notifications/{id}/markasread` | Mark / acknowledge. Doubles as the agent approval endpoint. |
| `POST` | `/api/v1/notifications/clear` | Clear all |

Common `type` values: `agent_question`, `workflow_failure`, `mention`, `system`.

---

## 13. Security-domain helpers

These wrap the underlying datastore with security-aware logic
(deduplication, OCSF validation, cross-org search).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/incidents` | List incidents across allowed orgs |
| `GET`  | `/api/v1/vulnerabilities` | List vulnerability findings |
| `GET`  | `/api/v2/correlations?key=<obs>&value=<v>` | Find datastore items sharing an observable |
| `POST` | `/api/v1/apps/sensors/run` | Run a host-targeted action (terminal, isolate) on an orborus monitor |

---

## 14. Pitfalls & gotchas (read these once)

- **`setenvironments` is destructive.** Always GET -> mutate -> PUT the full
  list, never PUT a subset.
- **Datastore keys** must be the raw entity ID. Namespaced (`cat::id`)
  strings break read-after-write.
- **App identity is the `app_id` UUID** - names collide and change. The MCP
  endpoint is the one place you use the *name* in the URL.
- **Org switch reloads cookies.** After `/orgs/{id}/change`, do a full client
  reload or all subsequent requests fail with stale auth.
- **Service workers must exclude `/api/`** from runtime caching, or you
  serve stale auth + stale data.
- **`getinfo` is mandatory** on every app load to support cookie-only
  sessions and to learn the user's `region_url`.
- **Webhooks accept any payload**; the body becomes `execution_argument` as a
  **string**. Parse with `JSON.parse` on the workflow side.
- **`streams/results` is POST**, not GET, with the auth in the JSON body.
- **Agent / MCP results may be wrapped twice**: `{ result: { message, ... } }`.
  Surface `result.message` as the headline and treat the rest as structured.
- **Approvals are notifications**, not a dedicated endpoint. Mark the
  `agent_question` notification as read to approve the pending action.
- **Do not send `Authorization` _and_ a session cookie.** Pick one per
  request; some endpoints reject the combination.
- **404 from `get_cache`** means "key not found", not a transport error -
  treat as empty success.
- **Some list endpoints return 4xx with valid JSON in the body.** Inspect
  the body before declaring failure.
- **Rate limits:** cloud enforces `app_execution_limit` per month per org;
  surface `app_execution_usage` from `getinfo` to the user.

---

## 15. Reference

- Official API spec: <https://shuffler.io/docs/API>
- Source code: <https://github.com/Shuffle/Shuffle>
- Singul library: <https://github.com/Shuffle/singul.js>
- App catalogue: <https://shuffler.io/apps>
- Workflow templates: <https://shuffler.io/workflows>
- Reference client (this repo): `src/services/`, `src/hooks/`, `src/config/api.ts`

---

*Drop this file into a Claude Code skill (`~/.claude/skills/shuffle/SKILL.md`)
or any agent that supports markdown skill files. With these endpoints you can
build a full multi-tenant security platform on Shuffle Core - tickets,
agents, automations, integrations and MCPs included - without per-call
hand-holding.*
