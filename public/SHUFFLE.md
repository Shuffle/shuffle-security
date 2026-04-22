# Shuffle Core API Skill

A Claude Code / agent skill for building applications on top of the **Shuffle Core** backend API. Shuffle Core is the engine behind [shuffler.io](https://shuffler.io) — a workflow automation, integration, and orchestration platform with 3,000+ apps. This document teaches an AI agent how to use it as a backend without manual wiring.

> Cross-reference the official API spec: <https://shuffler.io/docs/API>

---

## 1. Connection & Auth

### Base URLs
- **EU Cloud (default):** `https://shuffler.io`
- **US Cloud:** `https://us.shuffler.io`
- **Self-hosted:** `https://<your-host>` (typically port 3001 internally, fronted by Nginx)

Configure via env: `VITE_SHUFFLE_API_URL` (frontend) or any HTTP client base.

### Authentication
Two interchangeable mechanisms — pick one per request:

1. **API key** (preferred for agents/scripts)
   ```
   Authorization: Bearer <APIKEY>
   ```
   Get yours at `/admin?tab=api`.

2. **Session cookie** (browser)
   `session_token` cookie, set after `POST /api/v1/login`. Include `credentials: 'include'`.

### Multi-tenancy
Most endpoints accept an `?org_id=<UUID>` query string to scope the call to a sub-organisation. Without it, the request runs against the user's currently-active org. Switch active org with `POST /api/v1/orgs/{id}/change`.

### Standard envelope
- `GET` reads return raw JSON (object or array).
- `POST/PUT` writes return `{ "success": true, "id"?: "...", "reason"?: "..." }`.
- Errors return `{ "success": false, "reason": "..." }` with HTTP 4xx/5xx.

---

## 2. Identity & Session

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/login` | `{username, password}` → sets session cookie |
| `POST` | `/api/v1/logout` | Invalidate session |
| `GET`  | `/api/v1/getinfo` | **Source of truth** for current user, active org, role, feature flags, app execution limits. Call on every reload. |
| `POST` | `/api/v1/users/register` | Create user (admin/open-signup) |
| `POST` | `/api/v1/orgs/{org_id}/change` | Switch active org (response sets new cookies — full reload recommended) |
| `GET`  | `/api/v1/users/getusers` | List users in current org |

`getinfo` returns: `id`, `username`, `role` (`admin`/`org-reader`), `active_org`, `orgs[]`, `regions[]`, `app_execution_usage`, `app_execution_limit`, `support` (boolean), `mfa_info`, etc.

---

## 3. Workflows (Automation)

Workflows are the unit of execution. Triggers + actions chained as a DAG.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/workflows` | List workflows |
| `GET`  | `/api/v1/workflows/{id}` | Get workflow JSON |
| `POST` | `/api/v1/workflows` | Create |
| `PUT`  | `/api/v1/workflows/{id}` | Update full workflow |
| `DELETE` | `/api/v1/workflows/{id}` | Delete |
| `POST` | `/api/v1/workflows/{id}/execute` | Trigger run. Body: `{ execution_argument: "<string-or-json>", start?: "<node_id>" }` |
| `GET`  | `/api/v1/workflows/{id}/executions` | List executions |
| `GET`  | `/api/v1/streams/results?execution_id=...&authorization=...` | Poll a single execution's status + results |
| `POST` | `/api/v1/workflows/{id}/publish` | Publish to org/parent |
| `GET`  | `/api/v1/workflows/templates` | List templates |

**Execution lifecycle:** `EXECUTING` → `WAITING` (sub-flow/agent) → `FINISHED` | `ABORTED`. Poll `streams/results` until `status == FINISHED`. The `results[]` array contains per-action output keyed by `action.id`.

**Webhook trigger:** create a webhook node, then `POST` arbitrary JSON to `https://<host>/api/v1/hooks/webhook_<UUID>`. Auto-fires the workflow with the body as `exec.execution_argument`.

---

## 4. Apps & Integrations (3,000+)

Apps are reusable connectors (HTTP, Python, OpenAPI). Each has versioned **actions**.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/apps` | List apps available to the org |
| `GET`  | `/api/v1/apps/search?q=...` | Search the public catalogue |
| `GET`  | `/api/v1/apps/{app_id}/config` | Full app definition incl. actions & params |
| `POST` | `/api/v1/apps/{app_id}/run` | Execute a single action (no workflow). Body: `{ action, authentication_id, parameters: [{name,value}] }` |

### Authentication entries
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/apps/authentication` | List configured auths (per app) |
| `POST` | `/api/v1/apps/authentication` | Create/update. Identify by **app_id** (UUID), not name. PUT-style: include `id` to update (e.g. rename via `label`) |
| `DELETE` | `/api/v1/apps/authentication/{id}` | Remove |
| `POST` | `/api/v1/apps/authentication/{id}/config` | OAuth2 callback exchange |

Auth fields are app-specific (apikey, url, username/password, OAuth tokens). Always send the **App ID UUID** — names are not stable.

---

## 5. Singul — Categorised Actions (the magic layer)

Singul lets you call an action by **category + label** (vendor-agnostic) instead of binding to one tool. The platform routes to whatever app the org has authenticated for that category.

```
POST /api/v1/apps/categories/run
{
  "app_name": "PagerDuty",          // hint; can be "" to auto-pick
  "category": "cases",              // cases | email | siem | edr | comms | assets | iam | intel
  "label":    "create_ticket",      // standardised verb for the category
  "fields":   [{ "key": "title", "value": "Phishing report" },
               { "key": "description", "value": "..." }],
  "skip_workflow": true             // run the action directly, skip workflow wrapping
}
```

**Common labels per category:**
- `cases`: `create_ticket`, `update_ticket`, `get_ticket`, `list_tickets`, `add_comment`, `close_ticket`
- `email`: `send_email`, `forward_email`, `get_emails`, `search_emails`
- `comms`: `send_message`, `create_channel`, `list_users`
- `siem`: `search`, `list_alerts`, `update_alert`, `add_to_lookup`
- `edr`: `isolate_host`, `unisolate_host`, `run_script`, `list_alerts`
- `iam`: `disable_user`, `enable_user`, `reset_password`, `list_users`
- `assets`: `get_asset`, `list_assets`, `update_asset`
- `intel`: `get_ioc`, `search_ioc`, `submit_ioc`

Use Singul whenever the agent doesn't know which exact tool the customer has — write workflows once, run on any vendor.

---

## 6. Datastore (Key/Value store)

A namespaced KV store backing most app state (incidents, assets, configs).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/datastore` | Set/upsert. Body: `{ key, value, category, workflow_id?, edited?, expires? }` |
| `GET`  | `/api/v1/datastore?key=...&category=...` | Get one |
| `GET`  | `/api/v1/datastore/category/{category}?max=100&cursor=...` | List a category |
| `DELETE` | `/api/v1/datastore?key=...&category=...` | Delete |

**Conventions used by Shuffle Security:**
- `shuffle-security_incidents` — OCSF 2005 Incident Findings
- `shuffle-security_users` — Stakeholder registry
- `shuffle-security_assets` — OCSF 6002 Device Inventory
- `shuffle-security_ioc_types`, `_threat_feeds`, `_response_actions`, `_custom_fields`
- `shuffle-security_settings` — org preferences

**Critical:** the datastore `key` MUST be the **raw incident ID** (final segment of any namespaced string). Never use the full namespace as the key.

`value` is a JSON-encoded string (the API stringifies/parses for you when `Content-Type: application/json`).

---

## 7. Files & Storage

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/files/create` | Reserve a file slot. Body: `{ filename, namespace?, workflow_id? }` → `{ file_id }` |
| `POST` | `/api/v1/files/{file_id}/upload` | `multipart/form-data` with `shuffle_file` field |
| `GET`  | `/api/v1/files/{file_id}/content` | Download bytes |
| `GET`  | `/api/v1/files/namespaces/{ns}` | List files in namespace |
| `DELETE` | `/api/v1/files/{file_id}` | Remove |

Use namespaces to attach files to entities (e.g. `incident_<id>`).

---

## 8. AI Agent (LLM Tool-use)

Shuffle's agent endpoint accepts a JSON-RPC `tools/call` style request and resolves it via available apps.

```
POST /api/v1/agent
Content-Type: application/json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "<workflow_id_or_app_action>",
    "arguments": { "key": "value" }
  },
  "model": "gpt-4o" | "claude-sonnet-4" | "local",
  "decision": "auto" | "approve" | "deny"
}
```

Returns an **execution stub** `{ execution_id, authorization }`. Poll `/api/v1/streams/results?execution_id=...&authorization=...` until `status == FINISHED`, then unwrap `result.AGENT.output` for tool outputs.

**High-stakes actions** (network isolation, account disable, mass-delete) return `WAITING` with a `decision_required: true` flag — the agent must POST a decision back to `/api/v1/agent/{execution_id}/decide` with `{approved: bool, reason}`.

The agent service in this repo (`src/services/agentRun.ts`) centralises retry, timeout, and result unwrapping — mirror that pattern.

---

## 9. Detection — Sigma Rules & Tenzir Pipelines

### Sigma rules
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/files/namespaces/sigma` | List sigma rules |
| `POST` | `/api/v1/files/create` (namespace `sigma`) + upload | Add a rule |
| `POST` | `/api/v1/triggers/sigma` | Validate / dry-run a rule |

AI generation: `POST /api/v1/conversation` with the sample log + `task: "generate_sigma"`.

### Tenzir pipelines (Pipeline Sensors)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/pipelines` | List pipelines |
| `POST` | `/api/v1/pipelines` | Create from template (`ingest`, `parse`, `enrich`, `dispatch`) |
| `PUT`  | `/api/v1/pipelines/{id}` | Update |
| `POST` | `/api/v1/pipelines/{id}/start` `…/stop` | Lifecycle |
| `GET`  | `/api/v1/pipelines/{id}/stats` | Throughput, lag, errors |

Sensors are filtered by `Type: onprem` and `data_lake.enabled: true` for production use.

---

## 10. Environments & Orborus (Execution runners)

Environments define **where** workflows execute (cloud, on-prem agent).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/getenvironments` | List |
| `PUT`  | `/api/v1/setenvironments` | **Full-state replace** — send the entire array. Read first, mutate, write back. Otherwise you delete other envs. |
| `POST` | `/api/v1/orborus/register` | Register an on-prem runner |

Orborus runner deployment:
```bash
docker run -d \
  -e ORG=<org_id> \
  -e ENVIRONMENT_NAME=onprem \
  -e BASE_URL=https://shuffler.io \
  -e AUTH=<apikey> \
  ghcr.io/shuffle/orborus:latest
```

---

## 11. Notifications & Activity

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/v1/notifications` | Inbox for current user |
| `POST` | `/api/v1/notifications/{id}/markasread` | Mark single |
| `POST` | `/api/v1/notifications/clear` | Clear all |
| `GET`  | `/api/v1/agent/activity?limit=...` | Agent run history |

---

## 12. OCSF Schema Conventions

Incidents follow **OCSF 2005 (Incident Finding)**. Required fields:
- `class_uid: 2005`
- `category_uid: 2`
- `time` (epoch ms)
- `severity_id` (1=Info, 2=Low, 3=Medium, 4=High, 5=Critical)
- `status_id` (1=New, 2=In Progress, 3=Resolved, 4=Closed) + `status` string
- `finding_info: { uid, title, desc, types[], created_time }`
- `assignee` (username string), optional `assignee_details`

Assets follow **OCSF 6002 (Device Inventory Info)**. Identify hosts by **`hostname + serial_number`** for stability.

Status-string mapping is centralised — when writing back, use the canonical: `New`, `In Progress`, `Resolved`, `Closed`.

---

## 13. Common Recipes

### Run a workflow with arguments and wait for result
```js
const start = await fetch(`${BASE}/api/v1/workflows/${id}/execute`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ execution_argument: JSON.stringify({ ip: "1.2.3.4" }) }),
}).then(r => r.json());

let res;
do {
  await new Promise(r => setTimeout(r, 1500));
  res = await fetch(
    `${BASE}/api/v1/streams/results?execution_id=${start.execution_id}&authorization=${start.authorization}`
  ).then(r => r.json());
} while (res.status === 'EXECUTING' || res.status === 'WAITING');
```

### Create an incident via Singul (vendor-agnostic)
```js
await fetch(`${BASE}/api/v1/apps/categories/run`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    category: 'cases', label: 'create_ticket',
    fields: [{key:'title',value:'Suspicious login'},{key:'severity',value:'high'}],
    skip_workflow: true,
  }),
});
```

### Persist an OCSF incident to the datastore
```js
await fetch(`${BASE}/api/v1/datastore`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    category: 'shuffle-security_incidents',
    key: incident.id,                  // raw ID, NOT namespaced
    value: JSON.stringify(incident),   // OCSF 2005 object
  }),
});
```

### Pivot correlations across categories
List a category, scan each entry's observable values (IPs, hashes, emails) and intersect with another category. Exclude noise fields: `status`, `created_time`, `assignee`, `id`.

---

## 14. Pitfalls & Gotchas

- **`setenvironments` is destructive.** Always GET → mutate → PUT the full list.
- **Datastore keys** must be the raw entity ID. Namespaced strings break round-trips.
- **App identity** is the **app_id UUID** — names collide and change.
- **Org switch reloads cookies** — do a full client reload after `/orgs/{id}/change`.
- **Service workers** must exclude `/api/` from runtime caching, or you get stale auth.
- **`getinfo` is mandatory** on every app load to support cookie-only sessions.
- **Webhooks** accept any payload; the body becomes `execution_argument` as a string. Parse on the workflow side.
- **Agent results** are wrapped twice: `result.AGENT.output` then per-tool outputs. The `agentRun` service unwraps both.
- **Rate limits:** cloud enforces ~`app_execution_limit` per month per org; surface `app_execution_usage` from `getinfo` to the user.

---

## 15. Reference

- Official API spec: <https://shuffler.io/docs/API>
- Source: <https://github.com/Shuffle/Shuffle>
- App catalogue: <https://shuffler.io/apps>
- Workflow templates: <https://shuffler.io/workflows>
- This skill is built from the live Shuffle Security frontend (`src/services/`, `src/hooks/`) and the public API documentation.

---

*Drop this file into a Claude Code skill (`~/.claude/skills/shuffle/SKILL.md`) or any agent that supports markdown skill files. The agent now has enough surface area to build a full security platform on Shuffle Core without per-call hand-holding.*
