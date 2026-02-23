

# Unifying Usecases Across Infrastructure, Onboarding, and API

## Current State

There are three separate, disconnected representations of "usecases":

1. **Infrastructure page (`DATA_FLOWS` array)**: 22 hardcoded edge definitions (e.g., `siem_case_management_1`, `email_case_management_1`), each with source/target categories, label, description, phase, tags, and agenticDescription.

2. **Onboarding Automate page (`EnrichmentConfig`)**: 4 high-level automation areas (`automatic_ingestion`, `integration_search`, `threat_intel`, `notifications`), each calling `POST /api/v2/workflows/generate` with specific labels like `Ingest Tickets`, `Enable Threat feeds`, `Notifications`.

3. **API (`/api/v1/workflows/usecases`)**: Not yet consumed in the codebase. Structure unknown -- needs to be fetched and used as the source of truth.

These three are describing the same concepts at different granularity levels, but share no code or data.

## Proposed Architecture

### 1. Create a shared Usecase registry (`src/config/usecases.ts`)

A single file that:
- Defines the canonical `Usecase` type with all fields needed by both pages.
- Maps each usecase to its infrastructure edge ID, automation workflow label, and API identifier.
- Provides a default/fallback list of all usecases (derived from the current `DATA_FLOWS`).

```text
Usecase {
  id: string                    // e.g. "siem_case_management_1"
  source: string                // category ID, e.g. "siem"
  target: string                // category ID, e.g. "case_management"
  label: string                 // short label, e.g. "Alerts"
  description: string           // human-readable explanation
  agenticDescription: string    // AI agent perspective
  phase: FlowPhase              // "ingest" | "response" | "correlation"
  tags: string[]
  automationLabel?: string      // workflow generate label, e.g. "Ingest Tickets"
  automationCategory?: string   // e.g. "cases"
  animated?: boolean
  status?: "enabled" | "disabled" | "misconfigured"
}
```

### 2. Create a `useUsecases` hook (`src/hooks/useUsecases.ts`)

This hook will:
- Fetch from `GET /api/v1/workflows/usecases` on mount.
- Merge API response with local defaults (API is source of truth, local fills gaps).
- Expose the unified list to both pages.
- Provide helpers: `getByEdgeId()`, `getByPhase()`, `getByCategory()`, `getAutomationUsecases()`.
- Cache with React Query (5-minute stale time).

### 3. Refactor Infrastructure page

- Replace the hardcoded `DATA_FLOWS` array with data from `useUsecases()`.
- The `TOOL_CATEGORIES` array (with its per-category `useCases` strings) will also derive from the unified registry.
- Edge rendering, drawer details, and phase filtering all consume the shared data.

### 4. Refactor Onboarding Automate page

- Replace the hardcoded `AUTOMATION_WORKFLOW_LABELS` and `baseEnrichmentOptions` with filtered views from `useUsecases()`.
- The automation toggle for "Automatic Ingestion" maps to all usecases where `phase === 'ingest'` and the target or source matches the user's connected apps.
- "Threat Intel" maps to usecases with `source === 'threat_intel'` or `target === 'threat_intel'`.
- "Notifications" maps to usecases with `target === 'communication'`.
- Toggling an automation area still calls `POST /api/v2/workflows/generate`, but now uses the `automationLabel` from the usecase definition.

### 5. Mapping between the three

```text
Onboarding Area        | Infrastructure Edges              | API Usecase
-----------------------|-----------------------------------|------------------
Automatic Ingestion    | siem_case_management_1            | ingest_alerts
                       | email_case_management_1           | ingest_phishing
                       | edr_case_management_1             | ingest_edr
                       | cloud_siem_1                      | ingest_cloud
                       | network_siem_1                    | ingest_network
                       | asset_management_siem_1           | ingest_assets
Threat Intel           | threat_intel_case_management_1    | enrich_ti
                       | threat_intel_network_1            | ti_to_network
                       | threat_intel_edr_1                | ti_to_edr
                       | threat_intel_cloud_1              | ti_to_cloud
                       | email_threat_intel_1              | email_to_ti
Notifications          | case_management_communication_1   | notify
Response Actions       | case_management_iam_1             | disable_accounts
                       | case_management_edr_1             | containment
                       | case_management_network_1         | block_rules
                       | case_management_email_1           | quarantine
                       | case_management_cloud_1           | cloud_response
Correlation            | edr_siem_1                        | edr_telemetry
                       | iam_siem_1                        | iam_auth_logs
                       | asset_management_case_management_1| asset_context
                       | cloud_iam_1                       | cloud_identity
                       | cloud_asset_management_1          | cloud_inventory
```

## Implementation Steps

1. **Create `src/config/usecases.ts`** -- Define the `Usecase` type, the `DEFAULT_USECASES` array (migrated from `DATA_FLOWS`), and the `TOOL_CATEGORIES` array (migrated from InfrastructurePage). Add `automationLabel` and `automationCategory` fields to each usecase that has a corresponding workflow.

2. **Create `src/hooks/useUsecases.ts`** -- React Query hook that fetches from the API, merges with defaults, and provides accessor helpers.

3. **Refactor `InfrastructurePage.tsx`** -- Import `TOOL_CATEGORIES` and usecases from the shared config/hook instead of defining them inline. Remove the `DATA_FLOWS` and `TOOL_CATEGORIES` constants (~400 lines). Edge rendering logic stays the same but consumes the shared data.

4. **Refactor `EnrichmentConfig.tsx`** -- Import usecase definitions to derive which automations are available. Replace `AUTOMATION_WORKFLOW_LABELS` with mappings from the usecase registry.

5. **Handle API discovery** -- Since the `/api/v1/workflows/usecases` response structure is unknown, the hook will log the response shape on first fetch and gracefully fall back to defaults. Once the structure is confirmed, the mapping logic can be tightened.

## What stays the same

- Visual rendering of edges, nodes, and phases on the infrastructure page.
- The toggle UX on the onboarding automate page.
- The `POST /api/v2/workflows/generate` call mechanism.
- All existing styling and layout.

## Risk / Open Questions

- The exact response shape of `GET /api/v1/workflows/usecases` is not documented in the public API docs. The implementation will need to adapt once we see the actual response. We should test this endpoint first.
- Some usecases on the infrastructure page are purely visual (correlation edges) and may not have API equivalents. These will be marked as `automationLabel: undefined`.

