# Shuffle Pipelines - Lightweight Detection Without Heavy Infrastructure

Don't have a SIEM? No problem. With **Shuffle Pipelines**, you can ingest, parse, correlate, and forward security events directly - powered by [Tenzir](https://tenzir.com), a blazing-fast security data pipeline engine. You stay in full control of your data and infrastructure.

---

## Why Shuffle Pipelines?

Traditional SIEMs are expensive, complex, and slow to deploy. Shuffle Pipelines give you:

- **On-prem data control** - Your logs never leave your network unless you say so
- **Instant deployment** - A single Docker command gets you started in minutes
- **Sigma rule matching** - Apply community detection rules without vendor lock-in
- **Flexible forwarding** - Route matched events to any destination: SIEM, ticketing system, webhook, or Shuffle workflow

---

## Architecture Overview

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Log Sources  │────▶│  Shuffle Sensor   │────▶│  Shuffle Cloud   │
│  (Syslog,     │     │  (Tenzir Engine)  │     │  (Orchestration) │
│   Filebeat,   │     │                  │     │                  │
│   API polls)  │     │  * Ingest        │     │  * Sigma Rules   │
│              │     │  * Parse         │     │  * Workflows     │
│              │     │  * Match         │     │  * Case Mgmt     │
│              │     │  * Forward       │     │  * Response       │
└──────────────┘     └──────────────────┘     └─────────────────┘
```

The **Shuffle Sensor** runs on your infrastructure as a lightweight Docker container. It uses Tenzir under the hood to handle high-throughput log ingestion and real-time pattern matching.

---

## Getting Started

### Step 1: Deploy a Sensor

Navigate to [Detection Setup](/detection) and deploy a sensor on your infrastructure. The sensor requires Docker and access to the Docker socket.

**Quick deploy (Linux):**

```bash
docker run -d \
  --name shuffle-sensor \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /tmp:/tmp \
  -e AUTH=<your-auth-token> \
  -e ORG=<your-org-id> \
  -e BASE_URL=<your-shuffle-url> \
  ghcr.io/shuffle/shuffle-orborus:latest
```

You'll find the pre-filled command with your credentials on the [Detection Setup](/detection) page under your chosen cloud provider (GCP, AWS, Azure, or Self-Hosted).

**Verification:** The sensor status dot will turn green within 30 seconds once it checks in successfully.

### Step 2: Load Detection Rules

Head to [Detection Rules](/detection/sigma) to manage your Sigma rules.

- Click **Default Rules** to load curated community Sigma rules from GitHub
- Upload your own `.yml` Sigma rules
- Rules are automatically distributed to your running sensors

**What are Sigma rules?** Sigma is an open standard for writing detection rules that work across any log source. Think of it as "YARA for logs" - write once, detect everywhere.

Example Sigma rule:
```yaml
title: Suspicious PowerShell Download
status: experimental
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    CommandLine|contains|all:
      - 'powershell'
      - 'downloadstring'
  condition: selection
level: high
```

### Step 3: Create Pipelines

Navigate to [Pipeline Controller](/detection/pipelines) to create and manage your data pipelines.

Pipelines define **how data flows** through your sensor. Common patterns:

| Pipeline | What it does |
|----------|-------------|
| **TCP Syslog** | Listen for syslog on port 514 (TCP) |
| **UDP Syslog** | Listen for syslog on port 514 (UDP) |
| **Suricata EVE** | Read Suricata IDS alerts from eve.json |
| **Sigma Match** | Apply Sigma rules to incoming events |
| **Forward to SIEM** | Send matched events to Splunk/Elastic/Wazuh |

**Creating a pipeline:**

1. Click **New Pipeline** (requires a running sensor)
2. Enter a Tenzir pipeline command or use AI to generate one
3. Select the target sensor environment
4. Click **Deploy**

Example pipeline command for TCP syslog ingestion:
```
from tcp://0.0.0.0:514 read syslog | sigma /opt/shuffle/rules/ | publish alerts
```

---

## Pipeline Templates

Shuffle includes ready-to-deploy templates for common use cases:

### Syslog Ingestion
```
from tcp://0.0.0.0:514 read syslog | publish syslog_events
```

### Suricata Alert Processing
```
from file /var/log/suricata/eve.json read suricata | where event_type == "alert" | publish suricata_alerts
```

### Sigma Matching
```
subscribe syslog_events | sigma /opt/shuffle/rules/ --action publish alerts
```

### Forward to Elasticsearch
```
subscribe alerts | to https://elastic:9200 write elastic_bulk
```

---

## You Stay In Control

Unlike cloud-only SIEM solutions:

- **Your sensor, your infrastructure** - The Tenzir engine runs on machines you control
- **Your rules, your logic** - Use open Sigma rules, no proprietary query language
- **Your data, your routing** - Decide exactly where events go: local storage, cloud SIEM, ticketing system, or nowhere
- **No vendor lock-in** - Tenzir pipelines use a standardized syntax that's portable
- **No per-GB pricing** - Process as much data as your hardware allows

---

## Integration with Shuffle Workflows

Matched events from pipelines can trigger Shuffle workflows for automated response:

1. Pipeline detects a Sigma match -> publishes to `alerts` topic
2. Shuffle picks up the alert -> creates an incident
3. Workflow runs automated triage: enrichment, containment, notification
4. Case lands in your ticketing system (Jira, ServiceNow, TheHive, etc.)

This creates a complete **detect -> triage -> respond** loop without requiring a traditional SIEM.

---

## Monitoring & Management

- **Sensor health** is monitored via check-in timestamps (green = running, checked in < 5 minutes)
- **Pipeline status** shows running/stopped/error state for each deployed pipeline
- **Start/Stop/Delete** controls are available per-pipeline from the [Pipeline Controller](/detection/pipelines)

---

## Next Steps

- [Deploy your first sensor ->](/detection)
- [Load Sigma detection rules ->](/detection/sigma)
- [Create data pipelines ->](/detection/pipelines)
- [Set up automated incident response ->](/usecases)
