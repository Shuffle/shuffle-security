## Goal

Move the "Run Agent" sidebar (currently `src/components/agent/AgentPermissionsDrawer.tsx`, opened from `/agent` via the **Run Agent** button) into the Shuffle-MCPs library so it can be dropped into any host app — including standalone npm consumers — and replace its bespoke prompt/runner with the library's existing `AgentUI` component.

## What's there today

- `AgentPermissionsDrawer` is a 725-line MUI `Drawer` with three tabs: **Run**, **Permissions**, **Local LLM**.
- The **Run** tab is a custom `InputBase` + image-paste + selected-apps row + `runAgent()` call + `AgentRunResultViewer`. This duplicates what `AgentUI` (already exported by Shuffle-MCPs) does better.
- It pulls in project-only deps: `useNavigate`, `useAuth`, `services/agentRun`, `lib/utils.deduplicateAuthApps`, `PermissionsPanel`, `LocalLLMConfig`, `AppSearchDrawer` (already in lib).

## Plan

### 1. New library component: `src/Shuffle-MCPs/AgentRunDrawer.tsx`

A standalone right-side `Drawer` with tabs. Public props:

```ts
interface AgentRunDrawerProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'run' | 'permissions' | 'localLLM';
  /** Optional slot for the Permissions tab. Tab is hidden when omitted. */
  permissionsSlot?: React.ReactNode;
  /** Optional slot for the Local LLM tab. Tab is hidden when omitted. */
  localLLMSlot?: React.ReactNode;
  /** Forwarded to AgentUI (apiKey, apiBaseUrl, orgId, defaultApps, etc.). */
  agentUIProps?: Partial<React.ComponentProps<typeof AgentUI>>;
}
```

- **Run tab** renders `<AgentUI inline maxWidth={undefined} {...agentUIProps} />` — no more custom InputBase, no more `runAgent()` call, no more `AgentRunResultViewer` duplication. AgentUI already handles input, attached images, app chips, execution streaming, and the timeline.
- **Permissions / Local LLM tabs** are rendered via slots so the library has zero project coupling. If the host doesn't pass them, those tabs are not shown (drawer collapses to single-tab "Run" mode).
- All styling stays HSL-token based (`hsl(var(--card))`, `hsl(var(--border))`) — already the convention in the lib.
- Drop `useNavigate`, `useAuth`, `services/agentRun`, `deduplicateAuthApps`, `AGENT_TOOLS_KEY` localStorage logic (AgentUI manages its own app selection).

### 2. Re-export from the lib

Add to `src/Shuffle-MCPs/index.ts`:
```ts
export { default as AgentRunDrawer } from './AgentRunDrawer';
```
And document it in `LIBRARY.md` / `README.md` next to `AgentUI`.

### 3. Wire the host app to the new component

In `src/pages/dashboard/AgentActivityPage.tsx`:
- Replace `import AgentPermissionsDrawer from '@/components/agent/AgentPermissionsDrawer'` with `import { AgentRunDrawer } from '@/Shuffle-MCPs'`.
- Pass `permissionsSlot={<PermissionsPanel compact />}` (gated on `isSupport`) and `localLLMSlot={<LocalLLMConfig />}` so the existing project-only tabs keep working.
- Map `initialTab` numeric (0/1/2) → `'run' | 'permissions' | 'localLLM'`.

### 4. Delete the old component

Remove `src/components/agent/AgentPermissionsDrawer.tsx` once the page no longer references it. Search for any other importers (`rg AgentPermissionsDrawer`) and migrate them too.

### 5. Standalone-safety checklist

- No imports from `@/context/*`, `@/hooks/*`, `@/services/*`, `@/lib/*`, `react-router-dom`.
- Only depends on: `react`, `@mui/material`, `lucide-react`, sibling lib files (`AgentUI`, `AgentIcon`, `api`).
- Survives without project CSS — uses inline `sx` + HSL tokens with sane fallbacks (drawer already does this).
- Verified by importing it in `/shuffle-mcp-demo` (add a small "Open Agent drawer" button section).

## Files touched

| File | Change |
|---|---|
| `src/Shuffle-MCPs/AgentRunDrawer.tsx` | **new** — standalone drawer, embeds `AgentUI` |
| `src/Shuffle-MCPs/index.ts` | export `AgentRunDrawer` |
| `src/Shuffle-MCPs/README.md` + `LIBRARY.md` | document new component |
| `src/pages/dashboard/AgentActivityPage.tsx` | swap import, pass slots |
| `src/pages/ShuffleMcpTestPage.tsx` | demo section for `AgentRunDrawer` |
| `src/components/agent/AgentPermissionsDrawer.tsx` | **delete** |

## Open question

The current Run tab supports image paste/attach. `AgentUI` also accepts inputs but I want to confirm it already exposes image attachment in its inline UI before deletion — if not, I'll add an `attachments` prop pass-through rather than re-introducing a custom form.
