

## Vulnerabilities Page - Full Build Plan

### Overview

Build out the Vulnerabilities page to ingest, display, and manage vulnerabilities from multiple source categories. Data is stored in the Shuffle datastore (category: `shuffle-vulnerabilities`), pulled from scanner APIs via workflows, and optionally discovered via AI. A "Remediate" CTA will be present but non-functional for now.

### Data Model

Vulnerabilities stored in the datastore with this shape:
- `id`, `title`, `description`, `severity` (critical/high/medium/low/info)
- `category`: one of `software_cve`, `user_identity`, `cloud_misconfig`, `code_dependency`
- `status`: `open`, `in_progress`, `resolved`, `accepted`
- `source`: scanner app name (e.g. "qualys", "snyk", "aws_config")
- `asset_type`: `asset` or `user`
- `asset_id`, `asset_name`: the affected entity
- `cve_id` (optional), `remediation` (optional text)
- `first_seen`, `last_seen`, `resolved_at`

### Tab Structure

**Assets tab** - shows vulnerabilities where `asset_type === 'asset'`, grouped/filterable by:
- Severity (Critical / High / Medium / Low)
- Category (Software/CVEs, Cloud Misconfigs, Code/Dependencies)
- Source scanner
- Status (Open / In Progress / Resolved)

**Users tab** - shows vulnerabilities where `asset_type === 'user'`, grouped/filterable by:
- Severity
- Category (User/Identity issues)
- Source (e.g. "azure_ad", "okta")
- Status

### Ingestion Pipeline (similar to Incidents automation strip)

A compact automation strip at the top (between stats and tabs) showing:
1. **Sources** - connected scanner apps (Qualys, Tenable, Snyk, AWS Config, etc.) pulled from authenticated apps, filtered by new `VULN_SCANNER_PATTERNS`
2. **Arrow -> Shuffle** - processing/normalization
3. **"Add Source"** button opens the AppSearchDrawer filtered to vuln scanner category

New pattern list in `ingestionDetection.ts`:
```
VULN_SCANNER_PATTERNS = ['qualys', 'tenable', 'nessus', 'rapid7', 'nexpose', 
  'snyk', 'sonarqube', 'trivy', 'grype', 'anchore', 'dependabot', 
  'aws_inspector', 'azure_defender', 'gcp_scc', 'scout', 'prowler', 
  'checkov', 'wiz', 'orca', 'lacework', 'prisma']
```

### AI Discovery

An "AI Scan" button in the header that calls `/api/v1/conversation` with a prompt asking the AI to analyze connected apps for misconfigurations and identity issues. Results are displayed in a dialog and can be saved as vulnerability entries.

### Vulnerability Table

Each tab shows a sortable table with columns:
- Severity (color-coded chip)
- Title
- Category (chip)
- Asset/User name
- Source
- Status
- First Seen
- Actions (View, Remediate CTA)

### Remediate CTA

A "Remediate" button appears on each vulnerability row and in the detail view. For now it's a placeholder - shows a tooltip "Coming soon: automated remediation workflows". The button is visible and styled but triggers a toast saying remediation config is coming soon.

### File Changes

1. **`src/lib/ingestionDetection.ts`** - Add `VULN_SCANNER_PATTERNS` and `isVulnScannerApp()` helper
2. **`src/hooks/useVulnerabilities.ts`** (new) - Fetch from datastore category `shuffle-vulnerabilities`, parse, filter by tab
3. **`src/pages/dashboard/VulnerabilitiesPage.tsx`** - Full rebuild: stats from live data, automation strip, table with filters, AI scan button, remediate CTAs
4. **`src/services/ai.ts`** - No changes needed (reuse `askAI`)

### Stats Cards

The 4 severity cards pull live counts from the fetched vulnerability data instead of hardcoded zeros.

