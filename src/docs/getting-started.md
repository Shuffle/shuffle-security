# Getting Started

This guide walks you through the onboarding process — from first login to a working dashboard with incidents flowing in and host monitors reporting.

## Overview

Onboarding has three required steps, followed by an in-app Setup Guide on the dashboard for anything that needs deeper configuration.

1. **Sources** — Choose the tools you already use
2. **Authenticate** — Connect your credentials
3. **Automate** — Enable data flows between your tools

After the wizard finishes you land on the **Dashboard**, where the **Setup Guide** card walks you through the remaining foundational tasks (host monitors, incident ingestion, vulnerability ingestion). A guided **Demo Walkthrough** is also available at any time if you want to see the platform in action with sample data before connecting real tools.

---

## Step 1: Choose Your Sources

When you first log in, you are asked to select the tools your organization uses. Search by product name or browse by category:

| Category | Examples |
|----------|----------|
| **SIEM** | Splunk, Microsoft Sentinel, Elastic, QRadar |
| **EDR** | CrowdStrike, SentinelOne, Microsoft Defender |
| **Email** | Microsoft 365, Google Workspace, Abnormal Security |
| **ITSM / Ticketing** | ServiceNow, Jira, TheHive |
| **Cloud** | AWS, Azure, GCP |
| **Threat Intel** | VirusTotal, AbuseIPDB, AlienVault OTX |

Selecting a tool activates it in your Shuffle environment. You can add more later from the [Infrastructure](/infrastructure) page or the [Apps Catalog](/apps).

> **Tip:** If you want to explore first, click **Start Demo** on the dashboard to run a guided walkthrough against sample incidents. No credentials required.

---

## Step 2: Authenticate Your Tools

Provide credentials for each selected tool. Shuffle Security uses these to talk to your existing infrastructure — no data is copied out.

### Authentication Methods

| Method | Description |
|--------|-------------|
| **API Key** | Most common — paste your tool's API key |
| **OAuth 2.0** | Redirects you to the tool's login page |
| **Basic Auth** | Username and password combination |
| **Custom Fields** | Tool-specific fields (for example tenant ID, region) |

### Connection Status

Each tool shows a status indicator:

- **Verified** — Credentials tested and working
- **Configured** — Credentials saved but not yet verified
- **Failed** — Credentials invalid or expired

Use the **Test Connection** button to verify each tool before proceeding. On failure you will see a specific error (invalid key, permission denied, network timeout) so you can fix it immediately.

> **Note:** Some tools do not require authentication (for example public threat intel feeds). These are marked as "Auth not required" and can be skipped.

---

## Step 3: Enable Automation

The final step turns on the data flows that connect your tools together. These are pre-built Shuffle workflows that handle the common security integrations for you.

### Automatic Ingestion

Pulls alerts and events from your source tools into Shuffle Security as **incidents** (OCSF 2005). Once enabled, new alerts are synced continuously.

### Forward Tickets

Sends enriched incidents from Shuffle Security to your case management or ticketing system (TheHive, Jira, ServiceNow, and others). This keeps your existing workflows intact while adding Shuffle's enrichment and triage.

### What Happens Behind the Scenes

Each automation maps to a Shuffle workflow that:

1. Connects to your tool's API using the credentials you provided
2. Fetches or pushes data on a schedule or via webhook
3. Normalizes the data into the OCSF schema
4. Routes it to the appropriate destination

You can view and customize these workflows any time from the [Infrastructure](/infrastructure) page or directly in [Shuffle Automation](https://shuffler.io).

---

## After Onboarding: The Dashboard

When you click **Finish Setup** the wizard hands you off to the [Dashboard](/dashboard). This is the operational home of Shuffle Security. Two things matter here on day one:

### 1. The Setup Guide

The Setup Guide card lists the remaining foundational tasks. It updates in real time as each item is completed:

| Task | What it does |
|------|--------------|
| **Enable incident ingestion** | Confirms the ingestion workflow is running and pulling data from your authenticated sources |
| **Set up host monitors** | Deploy lightweight endpoint agents that report compliance, encryption, and posture. See [Monitoring](/docs/monitoring) |
| **Set up vulnerability ingestion** | Connect vulnerability scanners to track CVEs, misconfigurations, and identity risk |

Each task shows one of three states: **not started**, **action needed**, or **complete**. You can dismiss tasks that do not apply to your environment — they can be restored later.

### 2. The Demo Walkthrough

If you want a guided tour before wiring up real tools, start the demo from the dashboard. It seeds sample incidents and walks you through:

- Adding an email source
- Turning on ingestion
- Reading an incident timeline
- Handling duplicates and correlations

The walkthrough is safe to run against a live tenant — sample data is scoped to the demo and cleared when you exit.

---

## What to Explore Next

- **[Incidents](/incidents)** — Triage, investigate, and resolve security incidents
- **[Infrastructure](/infrastructure)** — View your connected tools and data flows as a graph
- **[Usecases](/usecases)** — Browse automation patterns and enable new ones
- **[Detection Pipelines](/docs/shuffle-pipelines)** — Lightweight detection with Tenzir + Sigma
- **[Host Monitors](/docs/monitoring)** — Deploy endpoint agents and manage compliance
- **[Apps Catalog](/apps)** — Discover 3,000+ integrations

---

## Adding More Tools Later

You do not need to connect everything during onboarding. To add tools later:

1. Go to [Infrastructure](/infrastructure)
2. Click the **+** button on any category
3. Search and select your tool
4. Provide credentials and test the connection

The tool automatically appears in relevant data flows and becomes available for automation.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tool not found in search | Try the vendor name. If it is not listed, Shuffle supports any REST API — contact support to add it |
| Authentication fails | Double-check your API key, permissions, and that the tool's API is reachable from Shuffle |
| No incidents after setup | Verify that Automatic Ingestion is enabled and that your source tool has recent alerts |
| Setup Guide task stays incomplete | Refresh the dashboard — status is derived from live workflow and monitor state and may take a few seconds to update |
| Sync seems slow | First sync may take longer depending on the volume of existing alerts. Subsequent syncs are incremental |

For more help, see the [Shuffle API Documentation](https://shuffler.io/docs/API) or reach out on [Discord](https://discord.gg/shuffle).
