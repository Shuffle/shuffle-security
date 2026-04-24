<div align="center">

[<img src="https://shuffler.io/images/logos/singul.svg" alt="Singul Logo" width="100"/>](https://singul.io)

# Singul Integrations Library

**Search, select, and authenticate against 3,000+ SaaS integrations.**

[![npm](https://img.shields.io/npm/v/singul-integrations.svg)](https://www.npmjs.com/package/singul-integrations)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![upstream](https://img.shields.io/badge/upstream-Shuffle%2Fsingul.js-orange)](https://github.com/Shuffle/singul.js)

</div>

---

A headless, prop-driven React component for app discovery, selection, and OAuth handoff. Powers integration drawers, onboarding flows, app pickers, and MCP setup. Works out of the box against Shuffle's public Algolia index — point it at your own backend and index when ready.

## Table of contents

- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Framework integration](#framework-integration)
- [Common patterns](#common-patterns)
- [Props](#props)
- [Events](#events)
- [Imperative handle](#imperative-handle)
- [Troubleshooting](#troubleshooting)
- [Publishing](#publishing)

---

<img width="746" height="758" alt="image" src="https://github.com/user-attachments/assets/774a6c5e-a8aa-4a12-9931-a952147b0992" />

<img width="766" height="974" alt="image" src="https://github.com/user-attachments/assets/e31ec066-c921-4db3-b1be-5f12ff43d8bb" />

## Features

- 🪶 Headless and prop-driven — no global state, no context
- 🔎 Algolia-backed search across 3,000+ apps (swappable index)
- 🟢 Auth-status dots when you provide an `apiKey`
- 📐 Inline grid, inline list, or floating dropdown
- ✅ Single- or multi-select, controlled or uncontrolled
- 📌 Pinned apps, custom item rendering, full style override
- 🎯 Imperative `search()` / `clear()` via `ref`
- ⚡ Tiny — only `react` + `algoliasearch`

## Install

```bash
npm install singul-integrations
# or: yarn add singul-integrations / pnpm add singul-integrations
```

Peer deps: `react >= 18`, `react-dom >= 18`, `algoliasearch >= 5`.

## Quick start

```tsx
import { SingulJS } from 'singul-integrations';

export default function App() {
  return (
    <SingulJS
      authToken="any-token"
      inline
      layout="grid"
      gridColumns={3}
      hitsPerPage={12}
      onAppSelected={(d) => console.log('picked', d.app.name)}
    />
  );
}
```

Works zero-config against the default public index.

## Framework integration

### React

```tsx
import { SingulJS } from 'singul-integrations';

<SingulJS authToken="..." onAppSelected={(d) => console.log(d)} />
```

### Next.js

The component touches `window` for the auth handoff, so render it client-side:

```tsx
'use client';
import { SingulJS } from 'singul-integrations';
```

Or import dynamically:

```tsx
import dynamic from 'next/dynamic';
const SingulJS = dynamic(
  () => import('singul-integrations').then((m) => m.SingulJS),
  { ssr: false }
);
```

### Vue

```vue
<template>
  <SingulJS :auth-token="token" @app-selected="onPick" />
</template>

<script>
import { SingulJS } from 'singul-integrations/vue';
export default { components: { SingulJS } /* ... */ };
</script>
```

## Common patterns

### Drawer with predefined search

```tsx
<Drawer open={open} onClose={onClose} PaperProps={{ sx: { width: 560 } }}>
  <SingulJS
    authToken="..."
    inline
    layout="grid"
    gridColumns={2}
    initialFilterQuery={category}     // e.g. "siem", "edr"
    placeholder={`Search ${category}...`}
    preventDefault                    // handle selection yourself
    onAppSelected={(d) => { onClose(); /* open auth flow */ }}
  />
</Drawer>
```

See `src/components/shared/AppSearchDrawer.tsx` for a complete drawer + auth handoff example.

### Imperative search

```tsx
const ref = useRef<SingulJSHandle>(null);
<button onClick={() => ref.current?.search('slack')}>Find Slack</button>
<SingulJS ref={ref} authToken="..." inline />
```

### Multi-select

```tsx
const [picked, setPicked] = useState<AlgoliaSearchApp[]>([]);

<SingulJS
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
<SingulJS
  authToken={user.token}
  apiKey={user.apiKey}
  apiBaseUrl="https://your-backend.example.com"
  algoliaAppId="YOUR_APP_ID"
  algoliaApiKey="YOUR_SEARCH_KEY"
  algoliaIndexName="your-index"
/>
```

When `apiKey` is set, status dots are populated: 🟢 validated · 🟡 configured · 🔵 selected · ⚫ inactive.

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
| `apiKey` | `string` | — | Bearer token; enables status dots |
| `apiBaseUrl` | `string` | `"https://shuffler.io"` | API base URL |
| `authPath` | `string` | `"/api/v1/apps/authentication"` | Authenticated-apps path |
| `appAuthPath` | `string` | `"/appauth"` | OAuth handoff path |
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
| `customStyles` | `CustomStyles` | Per-slot style overrides — see [`singul.helpers.ts`](./singul.helpers.ts) |
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
interface SingulJSHandle {
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
git tag singul-v0.1.0 && git push origin singul-v0.1.0
```

`.github/workflows/publish-singul.yml` then:
1. Resolves version from the tag (`singul-v0.1.0` → `0.1.0`)
2. Materializes `package.json` from `package.tpl.json`
3. `npm run build` (tsup → ESM + CJS + `.d.ts`)
4. `npm publish --access public --provenance`

Requires the `NPM_TOKEN` repo secret. Trigger manually from the Actions tab with `dry_run: true` to only produce the `.tgz`.

### Local test

```bash
cd src/Singul-Integrations-Library
cp package.tpl.json package.json
npm install && npm run build && npm pack
```
