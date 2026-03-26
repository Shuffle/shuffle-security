

## Unify Status Dot Colors Across Platform

### Color Standard

| State | Color Token | Visual |
|---|---|---|
| Inactive / not activated | `hsl(var(--muted-foreground))` | Gray |
| Activated, no auth | `hsl(var(--destructive))` | Red |
| Auth exists, not validated | `hsl(var(--severity-medium))` | Yellow |
| Validated / tested | `hsl(var(--severity-low))` | Green |

### Files to Change

**1. `src/components/shared/AppSearchDrawer.tsx`** (lines 264, 273-274)
- "In this usecase" section currently uses yellow (`--severity-medium`) for unauthenticated apps
- The `hasValidAuth` boolean is only true/false — no distinction between "no auth" and "auth not validated"
- Need to update the `ConnectionPathApp` interface to include `isActiveOnly` so we can distinguish red vs yellow vs green
- Dot color logic: `isActiveOnly` → red, `hasValidAuth` → green, else yellow
- Text: "Authenticated" (green), "Not validated" (yellow), "Not authenticated" (red)

**2. `src/components/usecases/UsecaseAlluvialDiagram.tsx`** (line 128)
- `getStatusColor` currently falls back to gray (`--muted-foreground`) for non-active, non-validated apps
- This is wrong — if an app is activated and has unvalidated auth, it should be yellow, not gray
- Gray should only apply to truly inactive/sample apps
- Fix: `if (!app.hasValidAuth && !app.isActiveOnly)` check whether it's a sample/inactive (gray) or has auth pending (yellow)
- Also update the data passed to `AppSearchDrawer`'s `connectionPathApps` to include `isActiveOnly`

**3. `src/components/incidents/IngestionSourceButton.tsx`** (lines 50-54, 62-63, line 78)
- Uses raw `rgba(245, 158, 11, ...)` (yellow) for enabled but unvalidated apps — should use `hsl(var(--severity-medium))` token variants
- Uses raw `rgba(34, 197, 94, ...)` (green) for validated — should use `hsl(var(--severity-low))` token variants
- This is a token consistency fix; the actual colors map correctly (yellow = auth not validated, green = validated)

**4. `src/components/layout/IntegrationStatus.tsx`** (line 195)
- Already correct: red for `isActiveOnly`, green for `hasValidAuth`, yellow for auth pending
- No changes needed — this is the reference implementation

### Summary of Changes
- 3 files modified
- Add `isActiveOnly` to `ConnectionPathApp` interface and pass it through
- Replace hardcoded rgba values with CSS variable tokens in IngestionSourceButton
- Fix alluvial diagram's gray fallback to properly distinguish inactive (gray) from auth-pending (yellow)

