# 📦 Singul-Integrations-Library

> **Standalone React library** — published to npm as `singul-integrations`
> Search, select, and authenticate against a catalog of **3,000+ SaaS integrations**.
> Powers integration drawers, onboarding flows, app pickers, MCP setup, and OAuth handoff.

[![npm](https://img.shields.io/npm/v/singul-integrations.svg)](https://www.npmjs.com/package/singul-integrations)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![upstream](https://img.shields.io/badge/upstream-Shuffle%2Fsingul.js-orange)](https://github.com/Shuffle/singul.js)

This folder is **self-contained**. The host app consumes it via the path alias `@/Singul-Integrations-Library`, and CI publishes the same folder to npm as `singul-integrations` via `.github/workflows/publish-singul.yml`.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Framework integration](#framework-integration)
  - [React](#react-integration)
  - [Next.js](#nextjs-integration)
  - [Vue](#vue-integration)
- [Common patterns](#common-patterns)
  - [Drawer with predefined search](#drawer-with-predefined-search)
  - [Imperative search via ref](#imperative-search-via-ref)
  - [Multi-select with controlled state](#multi-select-with-controlled-state)
  - [Pointing at your own backend](#pointing-at-your-own-backend)
  - [Pointing at your own Algolia index](#pointing-at-your-own-algolia-index)
- [Component properties](#component-properties)
  - [Required](#required)
  - [Search input](#search-input)
  - [Layout](#layout)
  - [Display options](#display-options)
  - [Selection](#selection)
  - [Backend / authentication](#backend--authentication)
  - [Algolia](#algolia)
  - [Styling](#styling)
  - [Custom rendering](#custom-rendering)
- [Events](#events)
- [Imperative handle (ref)](#imperative-handle-ref)
- [Types](#types)
- [Troubleshooting](#troubleshooting)
- [Publishing (CI/CD)](#publishing-cicd)

---

## Features

- 🪶 **Headless and prop-driven** — no global state, no context, no platform imports
- 🔎 **Algolia-backed search** across 3,000+ apps (defaults to Shuffle's public index, swappable)
- 🟢 **Auth-status badges** (configured / validated) when an `apiKey` is provided
- 📐 **Inline grid, inline list, or floating dropdown** layouts
- ✅ **Single- or multi-select** with controlled or uncontrolled selection
- 📌 **Pinned apps**, custom render functions, full styling override
- 🎯 **Imperative API** (`search()` / `clear()`) via `ref`
- ⚡ **Tiny** — only `react` + `algoliasearch` as dependencies

---

## Installation

```bash
npm install singul-integrations
# or
yarn add singul-integrations
# or
pnpm add singul-integrations
```

Peer dependencies: `react >= 18`, `react-dom >= 18`, `algoliasearch >= 5`.

> **Inside this monorepo:** import directly from the source folder via the path alias — no install needed.
> ```ts
> import { SingulJS } from '@/Singul-Integrations-Library';
> ```

---

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
      onAppSelected={(detail) => console.log('picked', detail.app.name)}
    />
  );
}
```

That's it — search works against the default public Algolia index with zero backend.

---

## Framework integration

### React integration

```tsx
import { SingulJS } from 'singul-integrations';

const AUTH_TOKEN = 'replace-with-your-token';
const CUSTOM_STYLES = { container: { width: '400px' } };

export default function App() {
  return (
    <div>
      <h1>Singul Search</h1>
      <SingulJS
        authToken={AUTH_TOKEN}
        customStyles={CUSTOM_STYLES}
        onAppSelected={(detail) => console.log('selected', detail)}
      />
    </div>
  );
}
```

### Next.js integration

The component touches `window` for the auth handoff, so render it on the client only:

```tsx
'use client';

import { SingulJS } from 'singul-integrations';

const AUTH_TOKEN = 'replace-with-your-token';
const CUSTOM_STYLES = { container: { width: '400px' } };

export default function Page() {
  return (
    <div>
      <h1>Singul Search</h1>
      <SingulJS
        authToken={AUTH_TOKEN}
        customStyles={CUSTOM_STYLES}
        onAppSelected={(detail) => console.log('selected', detail)}
      />
    </div>
  );
}
```

If you prefer dynamic import:

```tsx
import dynamic from 'next/dynamic';

const SingulJS = dynamic(
  () => import('singul-integrations').then((m) => m.SingulJS),
  { ssr: false }
);
```

### Vue integration

A Vue wrapper is published as `singul-integrations/vue` (mirrors the React API as `@app-selected` / `@selection-change` / `@search-change`):

```vue
<template>
  <SingulJS
    :auth-token="authToken"
    :custom-styles="customStyles"
    @app-selected="handleAppSelected"
  />
</template>

<script>
import { SingulJS } from 'singul-integrations/vue';

export default {
  name: 'IntegrationsSearch',
  components: { SingulJS },
  data() {
    return {
      authToken: 'replace-with-your-token',
      customStyles: { container: { width: '400px' } },
    };
  },
  methods: {
    handleAppSelected(detail) {
      console.log('selected app', detail);
    },
  },
};
</script>
```

---

## Common patterns

### Drawer with predefined search

The most common pattern: open a drawer, pre-fill the query, let the user pick an app, then react.

```tsx
import { Drawer } from '@mui/material';
import { SingulJS } from 'singul-integrations';

export function IntegrationDrawer({ open, onClose, category }: {
  open: boolean;
  onClose: () => void;
  category: string; // e.g. "siem", "edr", "email"
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 560 } }}>
      <SingulJS
        authToken="user-token"
        inline
        layout="grid"
        gridColumns={2}
        // Predefined search — opens already filtered to "siem", "edr", etc.
        initialFilterQuery={category}
        placeholder={`Search ${category} integrations...`}
        hitsPerPage={12}
        preventDefault
        onAppSelected={(detail) => {
          console.log('Selected', detail.app.name, '→', detail.authUrl);
          onClose();
        }}
      />
    </Drawer>
  );
}
```

For a richer pattern that also opens an authentication drawer after selection, see `src/components/shared/AppSearchDrawer.tsx` in this repo.

### Imperative search via ref

```tsx
import { useRef } from 'react';
import { SingulJS } from 'singul-integrations';
import type { SingulJSHandle } from 'singul-integrations';

const ref = useRef<SingulJSHandle>(null);

<button onClick={() => ref.current?.search('slack')}>Find Slack</button>
<SingulJS ref={ref} authToken="..." inline />
```

### Multi-select with controlled state

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

### Pointing at your own backend

If you have a Shuffle-compatible API for authenticated apps and OAuth handoff:

```tsx
<SingulJS
  authToken={user.token}
  apiKey={user.apiKey}
  apiBaseUrl="https://your-backend.example.com"
  authPath="/api/v1/apps/authentication" // optional override
  appAuthPath="/appauth"                 // optional override
/>
```

When `apiKey` is set, the component fetches authenticated apps and renders status dots:

| Dot | Meaning |
|---|---|
| 🟢 Green | Authentication validated (test ran successfully) |
| 🟡 Yellow | Configured, not yet validated |
| 🔵 Blue | Currently selected |
| ⚫ Gray | Inactive |

### Pointing at your own Algolia index

```tsx
<SingulJS
  authToken="..."
  algoliaAppId="YOUR_APP_ID"
  algoliaApiKey="YOUR_SEARCH_ONLY_KEY"
  algoliaIndexName="your-index"
/>
```

---

## Component properties

### Required

| Prop | Type | Description |
|---|---|---|
| `authToken` | `string` | Token forwarded into the OAuth/auth URL. Pass any string if you do not use the auth handoff. |

### Search input

| Prop | Type | Default | Description |
|---|---|---|---|
| `placeholder` | `string` | `"Search apps..."` | Input placeholder |
| `initialQuery` | `string` | `""` | Initial query — populates the input AND runs the search |
| `initialFilterQuery` | `string` | — | Runs an initial search WITHOUT filling the input (good for "predefined" filters) |
| `hitsPerPage` | `number` | `15` | Results per Algolia search |

### Layout

| Prop | Type | Default | Description |
|---|---|---|---|
| `layout` | `'list' \| 'grid'` | `'list'` | Result layout |
| `gridColumns` | `number \| { xs?, sm?, md?, lg? }` | `3` | Grid columns when `layout="grid"` |
| `inline` | `boolean` | `false` | When `true`, results render inline. When `false`, results render as a floating dropdown |

### Display options

| Prop | Type | Default | Description |
|---|---|---|---|
| `showDescription` | `boolean` | `false` | Show app description under name |
| `showCategories` | `boolean` | `false` | Show first category as a chip |
| `showCheckbox` | `boolean` | `false` | Show selection checkbox on each item |
| `hideAuthStatus` | `boolean` | `false` | Hide the colored status dot |

### Selection

| Prop | Type | Default | Description |
|---|---|---|---|
| `multiSelect` | `boolean` | `false` | Allow selecting multiple apps |
| `selectedApps` | `AlgoliaSearchApp[]` | `[]` | Controlled selection |
| `preventDefault` | `boolean` | `false` | Prevent the default `window.open(authUrl)` after select. Use this if you want to handle selection yourself |
| `pinnedApps` | `AlgoliaSearchApp[]` | — | Apps to render at the top of results, deduped by name |

### Backend / authentication

| Prop | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | Bearer token for fetching authenticated apps. When set, status dots are populated |
| `apiBaseUrl` | `string` | `"https://shuffler.io"` | Base URL for backend API calls |
| `authPath` | `string` | `"/api/v1/apps/authentication"` | Path appended to `apiBaseUrl` to fetch authenticated apps |
| `appAuthPath` | `string` | `"/appauth"` | Path appended to `apiBaseUrl` for OAuth/auth handoff |
| `singulBaseUrl` | `string` | `"https://singul.io"` | Base URL for Singul API |
| `authenticatedApps` | `AppAuthentication[]` | — | Manually provide authenticated apps (used when `apiKey` is not set) |

### Algolia

| Prop | Type | Default | Description |
|---|---|---|---|
| `algoliaAppId` | `string` | Shuffle public ID | Algolia application ID |
| `algoliaApiKey` | `string` | Shuffle public key | Algolia search-only API key |
| `algoliaIndexName` | `string` | `"appsearch"` | Algolia index name |

### Styling

| Prop | Type | Description |
|---|---|---|
| `customStyles` | `CustomStyles` | Per-element style overrides — see [`singul.helpers.ts`](./singul.helpers.ts) for the full slot list (container, inputWrapper, input, dropdown, dropdownItem, selectedItem, appIcon, appName, appCategory, checkbox, emptyState, etc.) |
| `className` | `string` | Extra class on the root container |

### Custom rendering

| Prop | Type | Description |
|---|---|---|
| `renderItem` | `(app, isSelected, onSelect, authState) => ReactNode` | Replace the default item renderer entirely |
| `renderEmptyState` | `() => ReactNode` | Replace the empty state |
| `renderLoadingState` | `() => ReactNode` | Replace the loading spinner |

---

## Events

| Event | Type | Fired when |
|---|---|---|
| `onAppSelected` | `(detail: { app: AlgoliaSearchApp; authUrl: string }) => void` | A single app is selected (single-select mode) |
| `onSelectionChange` | `(apps: AlgoliaSearchApp[]) => void` | The selection set changes (multi-select mode) |
| `onSearchChange` | `(query: string) => void` | Every keystroke in the search input |

> In Vue these become `@app-selected`, `@selection-change`, `@search-change`.

---

## Imperative handle (ref)

```ts
interface SingulJSHandle {
  search: (query: string) => void;  // set the input value and run a search
  clear: () => void;                 // clear the input and show top results
}
```

---

## Types

```ts
import type {
  SingulJSProps,
  SingulJSHandle,
  AlgoliaSearchApp,
  AppSelectedEvent,
  AppAuthentication,
  CustomStyles,
} from 'singul-integrations';
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| **Empty results / no apps shown** | Algolia credentials misconfigured | Verify `algoliaAppId` / `algoliaApiKey` / `algoliaIndexName`. Defaults work out of the box against Shuffle's public index. |
| **`window is not defined` in Next.js** | Server-side rendering | Add `'use client'` to the page, or import via `next/dynamic` with `{ ssr: false }`. |
| **Status dots never appear** | `apiKey` not provided OR backend unreachable | Pass `apiKey`. Check `apiBaseUrl + authPath` returns `{ data: [...] }` or a raw array of `AppAuthentication`. |
| **Auth window opens to the wrong URL** | `apiBaseUrl` / `appAuthPath` not configured | Override both — the auth URL is `${apiBaseUrl}${appAuthPath}?app_id=...&auth=...&source=shuffle`. |
| **Selection click does not call my handler** | `preventDefault` is `false` so the default `window.open` runs | Set `preventDefault` to handle selection yourself. |
| **Double-render in React 18 dev** | StrictMode | Expected — only affects dev mode. |
| **Cannot import in Vite project** | Missing peer dep | Install `algoliasearch`. |

---

## Publishing (CI/CD)

This folder doubles as a publishable npm package. The source lives here so the host app can keep importing it via `@/Singul-Integrations-Library`, while CI bundles + ships it to npm as `singul-integrations`.

### Files in this folder

| File | Purpose |
|---|---|
| `SingulJS.tsx`, `singul.helpers.ts`, `singul.css`, `index.ts` | Library source — used by both the host app and the published package |
| `package.tpl.json` | Template for the published `package.json`. CI fills in `version` and writes `package.json` |
| `tsup.config.ts` | Bundler config for emitting ESM + CJS + `.d.ts` to `dist/` |
| `tsconfig.build.json` | Standalone tsconfig for the library build (host app's tsconfig excludes it) |
| `.npmignore` | Whitelist `dist/`, README, LICENSE only |
| `LIBRARY.md` | Boundary rules — no app-specific imports allowed in this folder |

### How to publish

Tag a commit:
```bash
git tag singul-v0.1.0
git push origin singul-v0.1.0
```

The `.github/workflows/publish-singul.yml` workflow then:
1. Resolves the version from the tag (`singul-v0.1.0` → `0.1.0`)
2. Materializes `package.json` from `package.tpl.json` with that version
3. Runs `npm run build` (tsup) inside `src/Singul-Integrations-Library`
4. Runs `npm publish --access public --provenance`

You can also trigger the workflow manually from the Actions tab with a custom version, or with `dry_run: true` to only produce the `.tgz` artifact.

### Required secret

- `NPM_TOKEN` — npm automation token with publish rights.

### Local test

```bash
cd src/Singul-Integrations-Library
cp package.tpl.json package.json
# edit version manually for local test
npm install
npm run build
npm pack
```

The resulting `singul-integrations-X.Y.Z.tgz` is installable in any project with `npm i ./singul-integrations-X.Y.Z.tgz`.
