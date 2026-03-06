# Incident Creation

Shuffle Security supports multiple ways to create and ingest incidents. Choose the method that fits your workflow — or combine them for full coverage.

---

## Manual Creation

You can create incidents directly from the Shuffle Security UI.

1. Navigate to **Incidents** in the sidebar
2. Click the **+ New Incident** button
3. Fill in the incident details:
   - **Title** — A short summary of the incident
   - **Severity** — Critical, High, Medium, Low, or Informational
   - **Description** — Detailed context about what happened
   - **Assignee** — Who should handle this incident
4. Click **Create** to save

Manual creation is useful for ad-hoc incidents reported via email, phone, or chat — situations where automated ingestion isn't available.

---

## API Ingestion (Webhook)

For programmatic ingestion, Shuffle Security provides a webhook endpoint that accepts incident data via HTTP POST requests. This is ideal for integrating with tools that support outbound webhooks or custom scripts.

### Setup

1. Go to **Incidents** and click the **Webhook** button in the toolbar
2. If no webhook workflow exists yet, click **Enable** to generate one
3. Copy the webhook URL provided in the popover

### Sending Incidents

Send a POST request to the webhook URL with your incident payload:

```bash
curl -X POST https://your-shuffle-instance/api/v1/hooks/<hook_id> \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Suspicious login from unknown IP",
    "severity": "high",
    "description": "Multiple failed login attempts followed by a successful login from 203.0.113.42",
    "source": "custom-script"
  }'
```

The webhook accepts any JSON payload. Shuffle will normalize the data into the internal incident format automatically.

### Use Cases

- **SIEM forwarding** — Send alerts from your SIEM when they match specific rules
- **Custom scripts** — Ingest incidents from internal tools or scheduled scans
- **Third-party integrations** — Connect any tool that supports outbound webhooks (e.g., PagerDuty, Opsgenie)

---

## Pulling from Connected Apps

The most common method is automated pulling from your connected security tools. Once you authenticate an app during onboarding, Shuffle Security periodically fetches new incidents from it.

### How It Works

1. **Connect a source** — During onboarding (or later via Infrastructure), authenticate with your SIEM, EDR, ITSM, or email security tool
2. **Activate a data flow** — Enable the incident ingestion workflow for that source
3. **Automatic polling** — Shuffle periodically queries the source API for new alerts, tickets, or events
4. **Normalization** — Incoming data is mapped to a standardized incident format (OCSF-based)

### Supported Sources

| Category | Examples |
|----------|----------|
| **SIEM** | Splunk, Microsoft Sentinel, Elastic, QRadar |
| **EDR** | CrowdStrike, SentinelOne, Microsoft Defender |
| **Email Security** | Microsoft 365, Google Workspace, Abnormal Security |
| **ITSM** | ServiceNow, Jira, TheHive |
| **Cloud** | AWS GuardDuty, Azure Security Center, GCP Security Command Center |

### Resyncing

If an incident appears incomplete (missing title or description), you can manually trigger a resync:

- Open the incident detail page
- Click the **Resync** button (or use the menu → Resync)
- Shuffle will re-fetch the latest data from the original source

This is useful when an alert was updated in the source tool after initial ingestion.

---

## Choosing the Right Method

| Method | Best For | Setup Effort |
|--------|----------|--------------|
| **Manual** | Ad-hoc reports, phone/email escalations | None |
| **API (Webhook)** | Custom integrations, scripts, SIEM forwarding | Low |
| **Pulling** | Continuous monitoring of connected tools | Medium (one-time auth) |

Most organizations use **pulling** as their primary ingestion method, supplemented by **webhooks** for tools without native integration and **manual creation** for edge cases.
