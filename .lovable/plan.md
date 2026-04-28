## Plan

Remove the host monitor count from the demo mode gating logic in `src/components/demo/DemoModeCard.tsx`. Demo mode will only be blocked when the account already has too many incidents (≥ 10). Host monitors will no longer factor into the decision.

### Changes to `src/components/demo/DemoModeCard.tsx`

1. **Remove `useMonitorCount` usage** — keep the hook definition harmless or delete it; simplest is to delete it since it is only used here.
2. **Remove `MONITOR_THRESHOLD`** constant.
3. **Update gating logic**:
   - `setupExists = tooManyIncidents` (drop `tooManyMonitors`)
   - `disableStart = !active && tooManyIncidents`
   - Simplify `disableReason` to only the incidents message:
     > `You already have ${incidentCount} ${entityPluralLower} — demo mode is for accounts with fewer than ${INCIDENT_THRESHOLD}.`
4. **Leave the rest untouched** (UI, copy, demo seeding behavior).

### Why

Users with host monitors deployed (a normal, expected production state) were being blocked from trying demo mode. Only the volume of real incidents should signal "this is a live account, do not seed demo data."

### Files

- edit `src/components/demo/DemoModeCard.tsx`
