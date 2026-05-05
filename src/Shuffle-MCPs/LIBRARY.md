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

<ShuffleMCP authToken="..." onAppSelected={(d) => console.log(d)} />
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
    authToken="..."
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

A full two-drawer reference (search → detail/auth) lives in [`src/components/shared/AppSearchDrawer.tsx`](../components/shared/AppSearchDrawer.tsx).

### Imperative search

```tsx
const ref = useRef<ShuffleMCPHandle>(null);
<button onClick={() => ref.current?.search('slack')}>Find Slack</button>
<ShuffleMCP ref={ref} authToken="..." inline />
```

### Multi-select

```tsx
const [picked, setPicked] = useState<AlgoliaSearchApp[]>([]);

<ShuffleMCP
  authToken="..."
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
  authToken={user.token}
  apiKey={user.apiKey}
  apiBaseUrl="https://your-backend.example.com"
  algoliaAppId="YOUR_APP_ID"
  algoliaApiKey="YOUR_SEARCH_KEY"
  algoliaIndexName="your-index"
/>
```

When `apiKey` is set, status dots are populated: validated, configured, selected, inactive.

## Props

### Required
| Prop | Type | Description |
|---|---|---|
| `authToken` | `string` | Token forwarded into the auth URL. |

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
| `apiKey` | `string` | — | Bearer token. Enables status dots **and** loads the user's private apps from `/api/v1/apps`. |
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
