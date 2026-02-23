

# Unifying Usecases Across Infrastructure, Onboarding, and API

## Status: Phase 1 Complete ✅

### What's been built

1. **Shared Usecase Registry** (`src/config/usecases.ts`)
   - Canonical `Usecase` type with all fields for both pages
   - `DEFAULT_USECASES` array (22 data flows, migrated from InfrastructurePage)
   - `TOOL_CATEGORIES` array (10 categories, migrated from InfrastructurePage)
   - `FLOW_PHASES` definition
   - `CATEGORY_KEYWORDS` + `matchAppToCategory` helper
   - `getAutomationLabels()`, `getUsecasesByArea()`, `getUsecasesByPhase()` helpers
   - API type definitions: `ApiUsecaseCategory`, `ApiUsecase`, `ApiUsecaseItem`
   - `normalizeCategory()` — maps API category names (e.g. "cases") to our IDs ("case_management")
   - `apiCategoryToPhase()` — maps API category headers (e.g. "1. Collect") to FlowPhase

2. **`useUsecases` hook** (`src/hooks/useUsecases.ts`)
   - Fetches from `GET /api/v1/workflows/usecases`
   - Parses the real API structure: `[{ name, color, list: [{ name, type, last, ... }] }]`
   - Matches API usecases to local data flows by source→target route
   - Detects drift: `api_only`, `local_only`, `phase_mismatch`, `description_added`
   - Exposes: `usecases`, `apiCategories`, `drifts`, `driftMap`, `hasDrift`, accessor helpers
   - 5-minute React Query cache

3. **InfrastructurePage refactored**
   - Imports from shared config (removed ~370 lines of inline constants)
   - `useUsecases()` hook wired in
   - `useAuth()` provides `support` flag
   - DataFlowCard shows drift badges (support-only):
     - **NO API** (yellow) — data flow has no matching API usecase
     - **DRIFT** (blue) — matched but with differences
   - AllDataFlowsDrawer header shows drift count for support users
   - "API Usecases Without Data Flows" section at drawer bottom (support-only)

4. **EnrichmentConfig refactored**
   - `AUTOMATION_WORKFLOW_LABELS` derived from `getAutomationLabels()` instead of hardcoded

5. **AuthContext updated**
   - `support` flag extracted from `/api/v1/getinfo` response

### API Response Structure (confirmed)

```json
[{
  "name": "1. Collect",
  "color": "#FB47A0",
  "list": [
    {
      "name": "Email management",
      "priority": 100,
      "type": "communication",   // → source category
      "last": "cases",           // → target category  
      "description": "...",
      "video": "https://...",
      "blogpost": "https://...",
      "reference_image": "/images/...",
      "items": { "name": "...", "items": {} }
    }
  ]
}]
```

### Matching Logic

API usecases are matched to local data flows by:
- `normalizeCategory(apiUc.type)` → `usecase.source`
- `normalizeCategory(apiUc.last)` → `usecase.target`

If multiple local flows share the same source→target route, they're matched in order.

### What's Next (Phase 2)

- Wire `useUsecases()` into EnrichmentConfig for live automation labels
- Add `video`, `blogpost`, `reference_image` from API into edge detail drawer
- Add a "Sync" action for support users to push/pull changes
- Consider adding API usecase `priority` to influence display ordering
