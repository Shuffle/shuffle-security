# Getting Started

This guide walks you through the onboarding process - from first login to running your first automated workflow.

## Overview

Onboarding follows three steps:

1. **Sources** - Choose the tools you already use
2. **Authenticate** - Connect your credentials
3. **Automate** - Enable data flows between your tools

After completing these steps, Shuffle Security will begin ingesting and managing incidents from your connected tools automatically.

---

## Step 1: Choose Your Sources

When you first log in, you'll be prompted to select the tools your organization uses. These are grouped by category:

| Category | Examples |
|----------|----------|
| **SIEM** | Splunk, Microsoft Sentinel, Elastic, QRadar |
| **EDR** | CrowdStrike, SentinelOne, Microsoft Defender |
| **Email** | Microsoft 365, Google Workspace, Abnormal Security |
| **ITSM** | ServiceNow, Jira, TheHive |
| **Cloud** | AWS, Azure, GCP |
| **Threat Intel** | VirusTotal, AbuseIPDB, AlienVault OTX |

Search for your tools using the search bar or browse by category. Selecting a tool automatically activates it in your Shuffle environment.

> **Tip:** You can always add more tools later from the [Infrastructure](/infrastructure) page.

---

## Step 2: Authenticate Your Tools

After selecting your sources, you'll be asked to provide credentials for each tool. This is how Shuffle connects to your existing infrastructure.

### Authentication Methods

Different tools support different authentication methods:

| Method | Description |
|--------|-------------|
| **API Key** | Most common - paste your tool's API key |
| **OAuth 2.0** | Redirects you to the tool's login page |
| **Basic Auth** | Username and password combination |
| **Custom Fields** | Tool-specific fields (e.g., tenant ID, region) |

### Connection Status

Each tool shows its connection status:

- 🟢 **Verified** - Credentials tested and working
- 🟡 **Configured** - Credentials saved but not yet verified
- 🔴 **Failed** - Credentials invalid or expired

Use the **Test Connection** button to verify each tool before proceeding. If a test fails, you'll see a specific error message explaining what went wrong (e.g., invalid API key, permission denied, network timeout).

> **Note:** Some tools don't require authentication (e.g., public threat intel feeds). These are marked as "Auth not required" and can be skipped.

---

## Step 3: Enable Automation

The final step lets you enable the data flows that connect your tools together. These are pre-built automation workflows that handle common security operations:

### Automatic Ingestion

Pulls alerts and events from your source tools into Shuffle Security as incidents. Once enabled, new alerts are continuously synced.

### Forward Tickets

Sends enriched incidents from Shuffle Security to your case management or ticketing system (e.g., TheHive, Jira, ServiceNow). This keeps your existing workflows intact while adding Shuffle's enrichment and triage capabilities.

### What Happens Behind the Scenes

Each automation maps to a Shuffle workflow that:

1. Connects to your tool's API using the credentials you provided
2. Fetches or pushes data on a schedule (or via webhook)
3. Normalizes the data into a standard format
4. Routes it to the appropriate destination

You can view and customize these workflows anytime from the [Infrastructure](/infrastructure) page or directly in [Shuffle Automation](https://shuffler.io).

---

## After Onboarding

Once you click **Finish Setup**, you'll be redirected to the [Incidents](/incidents) page where your first sync will run automatically. Depending on your tools, you should see incidents appearing within a few seconds.

### What to Explore Next

- **[Incidents](/incidents)** - Triage, investigate, and resolve security incidents
- **[Infrastructure](/infrastructure)** - View your connected tools and data flows as a graph
- **[Usecases](/usecases)** - Browse all 22 automation patterns and enable new ones
- **[Templates](/templates)** - Create reusable incident response playbooks
- **[Apps Catalog](/apps)** - Discover 3,000+ integrations

---

## Adding More Tools Later

You don't need to connect everything during onboarding. To add tools later:

1. Go to **[Infrastructure](/infrastructure)**
2. Click the **+** button on any category
3. Search and select your tool
4. Provide credentials and test the connection

The tool will automatically appear in relevant data flows and become available for automation.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tool not found in search | Try searching by vendor name. If it's not listed, Shuffle supports any REST API - contact support to add it |
| Authentication fails | Double-check your API key, permissions, and that the tool's API is reachable from Shuffle |
| No incidents after setup | Verify that Automatic Ingestion is enabled and that your source tool has recent alerts |
| Sync seems slow | First sync may take longer depending on the volume of existing alerts. Subsequent syncs are incremental |

For more help, see the [Shuffle API Documentation](https://shuffler.io/docs/API) or reach out on [Discord](https://discord.gg/shuffle).
