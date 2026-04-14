# Monitoring

Monitors provide endpoint-level visibility and control across your environment. They let you track device compliance, inspect host telemetry, and execute response actions — all from a single interface.

---

## Why Monitoring Exists

Traditional security tools give you visibility at the network or cloud layer, but lack direct insight into what's happening on individual endpoints. Monitors fill that gap by deploying lightweight agents to your hosts that report back on compliance, installed software, and system configuration.

This gives your security team:

- **Real-time compliance checks** — encryption status, screenlock policies, software inventory, log forwarding, and response action readiness
- **Direct endpoint interaction** — execute commands and response actions on hosts without switching tools
- **Centralized visibility** — see all monitored hosts across your environment in one place

---

## How It Works

Monitors use the Shuffle agent (`orborus`) deployed on each endpoint. The agent checks in periodically and reports telemetry data back to Shuffle Core.

```
┌─────────────────┐        ┌──────────────────┐
│   Host Agent    │───────▶│   Shuffle Core    │
│  (orborus.go)   │◀───────│   (Backend API)   │
└─────────────────┘        └──────────────────┘
        │                          │
        ▼                          ▼
  Local compliance          Monitors page
  checks & actions          (/monitors)
```

### Deployment

Monitors are deployed by running the Shuffle agent on your endpoints:

```bash
go run orborus.go --base_url <YOUR_BACKEND_URL> --response_actions=full
```

The `--response_actions` flag controls the level of access:

| Mode | Description |
|------|-------------|
| **Full Control** | Execute any command on the host (RCE). Default and recommended for managed endpoints. |
| **Controlled** | Restricted set of predefined actions only. *(Coming soon)* |

### Compliance Checks

Once deployed, each host is evaluated against five compliance checks:

| Check | Icon | What It Monitors |
|-------|------|------------------|
| **Encryption** | 💾 | Disk encryption status (BitLocker, FileVault, LUKS) |
| **Screenlock** | 🔒 | Whether a 15-minute idle screenlock policy is enforced |
| **Software** | 📦 | Installed software inventory |
| **Response Actions** | ⚡ | Whether the host accepts remote commands |
| **Log Forwarding** | 📤 | Whether logs are being forwarded to your SIEM |

Each check is shown as a status dot in the host table — green for passing, orange for partial, and grey for disabled or unavailable.

---

## Using the Monitors Page

### Host Table

The main view displays all monitored hosts in a sortable table:

- **OS icon** — Apple, Windows, or Linux, shown as the first column
- **Hostname** — Normalized (domain suffixes like `.local` and `.lan` are stripped)
- **Serial number** — For asset tracking and correlation
- **Compliance dots** — Five status indicators for each check
- **Terminal trigger** — A play icon to open the interactive terminal

Click any row to expand and see full host metadata, installed software, and detailed status for each compliance check.

### Software Inventory

The expanded host detail panel includes a searchable list of installed software. The filter is case-insensitive and updates in real-time as you type.

### Monitor Groups

Hosts are organized into monitoring groups. Use the **Group Sync** dropdown to switch between groups. The **Refresh** button is always visible and works even when no groups or hosts are configured.

---

## Response Actions & Terminal

Monitors with Response Actions enabled support direct command execution via an interactive terminal.

### Opening the Terminal

- Click the **play icon** on any responsive host row
- Or navigate directly to `/monitors/:hostUuid/terminal`

The terminal is disabled (with an explanatory tooltip) for hosts that don't have Response Actions enabled.

### Using the Terminal

The terminal interface includes:

- **Scrollable history** at the top showing previous commands and results
- **Predefined action chips** in the middle for common operations
- **Auto-focusing input** at the bottom for custom commands

Commands can be:
- `script:<actionId>` — Run a predefined response action
- Any raw string — Execute as a custom command on the host

### Terminal Features

- **Parallel execution** — Run multiple commands simultaneously
- **Arrow-key history** — Navigate through previous commands
- **Auto-scrolling** — Output scrolls to latest result automatically
- **Abort support** — Click "Stop" to cancel a running command (sends server-side abort)
- **Session persistence** — Terminal sessions are saved per-host in your browser's localStorage
- **Real-time status** — Green dot indicator if the host checked in within the last 5 minutes

---

## Setting Up Monitors

### Step 1: Deploy the Agent

Run the deployment command on each endpoint you want to monitor. The Monitors page provides a setup wizard that generates the correct command for your environment.

### Step 2: Verify Connection

After deployment, the agent will check in with Shuffle Core. The Monitors page detects new hosts by watching for a host count increase. Once detected, the host appears in your table with compliance status.

### Step 3: Configure Compliance

The setup wizard walks you through five compliance checks. All checks are optional, but **Response Actions** is enabled by default in Full Control mode.

### Step 4: Interact

Once hosts are reporting, you can:
- View compliance status at a glance
- Expand rows for detailed telemetry
- Search installed software
- Execute response actions via the terminal

---

## Tips

- **Hostnames are normalized** — Domain suffixes (`.local`, `.lan`, etc.) are automatically stripped for cleaner display
- **Compliance tiles hide automatically** — The top-level compliance summary tiles disappear once at least one monitor is active, keeping the interface clean
- **Terminal history is local** — Command history is stored in your browser, not on the server. A privacy disclaimer is shown in the terminal
- **Host identification** — Endpoints are identified by hostname + serial number as the primary stable identifier
