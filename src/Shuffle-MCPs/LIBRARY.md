# Singul Integrations Library — Reference

Full API reference for [`shuffle-mcps`](./README.md). For a quick start, see the [README](./README.md).

> **Contributor note:** this folder is a standalone, publishable npm package (`shuffle-mcps`). The only allowed imports are `react`, `react-dom`, `algoliasearch`, and relative paths inside this folder. Anything else will break the npm build. Publishing is handled by `.github/workflows/publish-shuffle-mcps.yml`.

## Table of contents

- [Framework integration](#framework-integration)
- [Recipes](#recipes)
- [Props](#props)
- [Events](#events)
- [Imperative handle](#imperative-handle)
- [Troubleshooting](#troubleshooting)
- [Publishing](#publishing)

## Framework integration

### React

```tsx
import { ShuffleMCP } from 'shuffle-mcps';

<ShuffleMCP apiKey="..." onAppSelected={(d) => console.log(d)} />
```

### Next.js

The component touches `window` for the auth handoff, so render it client-side:

```tsx
'use client';
import { ShuffleMCP } from 'shuffle-mcps';
```

Or import dynamically:

```tsx
import dynamic from 'next/dynamic';
const ShuffleMCP = dynamic(
  () => import('shuffle-mcps').then((m) => m.ShuffleMCP),
  { ssr: false }
);
```

### Vue

```vue
<template>
  <ShuffleMCP :auth-token="token" @app-selected="onPick" />
</template>

<script>
import { ShuffleMCP } from 'shuffle-mcps/vue';
export default { components: { ShuffleMCP } /* ... */ };
</script>
```

## Recipes

### Drawer with predefined search

```tsx
<Drawer open={open} onClose={onClose} PaperProps={{ sx: { width: 560 } }}>
  <ShuffleMCP
    apiKey="..."
    inline
    layout="grid"
    gridColumns={2}
    initialFilterQuery={category}
    placeholder={`Search ${category}...`}
    preventDefault
    onAppSelected={(d) => { onClose(); /* open auth flow */ }}
  />
</Drawer>
```

A full two-drawer reference (search → detail/auth) lives in [`src/Shuffle-MCPs/AppSearchDrawer.tsx`](./AppSearchDrawer.tsx).

### Imperative search

```tsx
const ref = useRef<ShuffleMCPHandle>(null);
<button onClick={() => ref.current?.search('slack')}>Find Slack</button>
<ShuffleMCP ref={ref} apiKey="..." inline />
```

### Multi-select

```tsx
const [picked, setPicked] = useState<AlgoliaSearchApp[]>([]);

<ShuffleMCP
  apiKey="..."
  inline
  multiSelect
  showCheckbox
  selectedApps={picked}
  onSelectionChange={setPicked}
/>
```

### Your own backend / Algolia index

```tsx
<ShuffleMCP
  apiKey={user.apiKey}
  apiBaseUrl="https://your-backend.example.com"
  algoliaAppId="YOUR_APP_ID"
  algoliaApiKey="YOUR_SEARCH_KEY"
  algoliaIndexName="your-index"
/>
```

> **About `apiKey`:** this is the **current user's personal Shuffle API key**, not an org-level or service token. Your backend should look up the signed-in user's API key (wherever you store it — DB, session, etc.) and pass it through to this component. The component sends it as `Authorization: Bearer` on every API request and forwards it into the auth handoff URL as `&auth=`, so all reads and authentications happen as that user.

When `apiKey` is set, status dots are populated: validated, configured, selected, inactive.

## Props

### Required
| Prop | Type | Description |
|---|---|---|
| `apiKey` | `string` | The **current user's** Shuffle API key. Your backend should fetch it from wherever you store the user's credentials and pass it in. Used as `Authorization: Bearer` on all API calls and forwarded into the auth handoff URL as `&auth=`. |

### Search
| Prop | Type | Default | Description |
|---|---|---|---|
| `placeholder` | `string` | `"Search apps..."` | Input placeholder |
| `initialQuery` | `string` | `""` | Pre-fills input AND searches |
| `initialFilterQuery` | `string` | — | Searches WITHOUT filling input |
| `hitsPerPage` | `number` | `15` | Results per query |

### Layout & display
| Prop | Type | Default | Description |
|---|---|---|---|
| `layout` | `'list' \| 'grid'` | `'list'` | Result layout |
| `gridColumns` | `number \| { xs?, sm?, md?, lg? }` | `3` | Grid columns |
| `inline` | `boolean` | `false` | Inline results vs. floating dropdown |
| `showDescription` | `boolean` | `false` | Show app description |
| `showCategories` | `boolean` | `false` | Show first category chip |
| `showCheckbox` | `boolean` | `false` | Show selection checkbox |
| `hideAuthStatus` | `boolean` | `false` | Hide status dot |

### Selection
| Prop | Type | Default | Description |
|---|---|---|---|
| `multiSelect` | `boolean` | `false` | Allow selecting multiple apps |
| `selectedApps` | `AlgoliaSearchApp[]` | `[]` | Controlled selection |
| `preventDefault` | `boolean` | `false` | Skip default `window.open(authUrl)` |
| `pinnedApps` | `AlgoliaSearchApp[]` | — | Pinned to top, deduped by name |

### Backend / auth
| Prop | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | The **current user's** Shuffle API key — canonical credential. Your backend resolves the signed-in user's key and passes it in. Used as `Authorization: Bearer` on `/api/v1/apps/authentication` and `/api/v1/apps`, and forwarded into the auth handoff URL as `&auth=`. Enables status dots and merges private apps into search. |
| `~~authToken~~` | `string` | — | **Deprecated.** Use `apiKey`. Only used for the auth handoff URL when `apiKey` is not set. Kept for backwards compatibility. |
| `orgId` | `string` | — | Optional Shuffle organization ID. When set, every request the component issues (`/api/v1/apps/authentication`, `/api/v1/apps`) includes an `Org-Id: <orgId>` header, and the auth handoff URL gets `&org_id=<orgId>` appended. Omit to use the user's default org. |
| `apiBaseUrl` | `string` | `"https://shuffler.io"` | API base URL |
| `authPath` | `string` | `"/api/v1/apps/authentication"` | Authenticated-apps path |
| `appAuthPath` | `string` | `"/appauth"` | OAuth handoff path |
| `privateAppsPath` | `string` | `"/api/v1/apps"` | Private apps endpoint. Results are merged into search and tagged with `source: 'private'`. |
| `disablePrivateApps` | `boolean` | `false` | Skip the private-apps fetch even when `apiKey` is set. |
| `showSourceFilter` | `boolean` | `true` | Show the **All / Public / Private** filter pills above results when private apps are loaded. |
| `singulBaseUrl` | `string` | `"https://singul.io"` | Singul API base |
| `authenticatedApps` | `AppAuthentication[]` | — | Inject manually instead of fetching |

### Algolia
| Prop | Type | Default | Description |
|---|---|---|---|
| `algoliaAppId` | `string` | Shuffle public ID | Algolia app ID |
| `algoliaApiKey` | `string` | Shuffle public key | Search-only API key |
| `algoliaIndexName` | `string` | `"appsearch"` | Index name |

### Styling & rendering
| Prop | Type | Description |
|---|---|---|
| `customStyles` | `CustomStyles` | Per-slot style overrides — see [`shuffle-mcp.helpers.ts`](./shuffle-mcp.helpers.ts) |
| `className` | `string` | Extra class on the root |
| `renderItem` | `(app, isSelected, onSelect, authState) => ReactNode` | Replace item renderer |
| `renderEmptyState` | `() => ReactNode` | Replace empty state |
| `renderLoadingState` | `() => ReactNode` | Replace loading spinner |

## Events

| Event | Signature | Fired when |
|---|---|---|
| `onAppSelected` | `(detail: { app, authUrl }) => void` | Single-select pick |
| `onSelectionChange` | `(apps: AlgoliaSearchApp[]) => void` | Multi-select changes |
| `onSearchChange` | `(query: string) => void` | Each keystroke |

In Vue: `@app-selected`, `@selection-change`, `@search-change`.

## Imperative handle

```ts
interface ShuffleMCPHandle {
  search: (query: string) => void;
  clear: () => void;
}
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Empty results | Check `algoliaAppId` / `algoliaApiKey` / `algoliaIndexName`. |
| `window is not defined` (Next.js) | Add `'use client'` or use `next/dynamic` with `ssr: false`. |
| Status dots never appear | Pass `apiKey`. Verify `apiBaseUrl + authPath` returns `{ data: [...] }` or an array. |
| Auth opens wrong URL | Override `apiBaseUrl` + `appAuthPath`. URL is `${apiBaseUrl}${appAuthPath}?app_id=...&auth=...&source=shuffle`. |
| Click does not call my handler | Set `preventDefault` so the default `window.open` is skipped. |

## Publishing

Tag a commit:

```bash
git tag shuffle-mcps-v0.1.0 && git push origin shuffle-mcps-v0.1.0
```

`.github/workflows/publish-shuffle-mcps.yml` then:
1. Resolves version from the tag (`shuffle-mcps-v0.1.0` → `0.1.0`)
2. Materializes `package.json` from `package.tpl.json`
3. `npm run build` (tsup → ESM + CJS + `.d.ts`)
4. `npm publish --access public --provenance`

Requires the `NPM_TOKEN` repo secret. Trigger manually from the Actions tab with `dry_run: true` to only produce the `.tgz`.

### Local test

```bash
cd src/Shuffle-MCPs
cp package.tpl.json package.json
npm install && npm run build && npm pack
```
