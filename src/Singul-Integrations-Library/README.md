# SingulJS

A standalone React component for searching, selecting, and authenticating against a catalog of 3,000+ SaaS integrations. Powers the integration drawer, onboarding flows, and app pickers.

> Local copy. Upstream: [github.com/Shuffle/singul.js](https://github.com/Shuffle/singul.js)

---

## Features

- Headless, fully prop-driven — no global state, no context, no platform imports
- Algolia-backed search across 3,000+ apps (defaults to Shuffle's public index, swappable)
- Optional auth-status badges (configured / validated) when an `apiKey` is provided
- Inline grid, inline list, or floating dropdown layouts
- Single- or multi-select with controlled or uncontrolled selection
- Pinned apps, custom render functions, full styling override
- Imperative `search()` / `clear()` via `ref`

## Install

Peer deps:
```bash
npm i react algoliasearch
```

Then import:
```tsx
import { SingulJS } from '@/lib/singul-local';
import type { AppSelectedEvent, AlgoliaSearchApp, SingulJSHandle } from '@/lib/singul-local';
```

---

## Quick start — bare search

```tsx
<SingulJS
  authToken="any-token"
  inline
  layout="grid"
  gridColumns={3}
  hitsPerPage={12}
  onAppSelected={(detail) => console.log('picked', detail.app.name)}
/>
```

That's it — search works against the default public Algolia index with zero backend.

---

## Use it inside a drawer (predefined search)

The most common pattern: open a drawer, pre-fill the query, let the user pick an app, then react.

```tsx
import { Drawer } from '@mui/material';
import { useState } from 'react';
import { SingulJS } from '@/lib/singul-local';

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
        // Predefined search: opens already filtered to "siem", "edr", etc.
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

For a richer pattern that also opens an authentication drawer after selection, see `src/components/shared/AppSearchDrawer.tsx` in this project.

### Imperative search (change query from outside)

```tsx
const ref = useRef<SingulJSHandle>(null);

<button onClick={() => ref.current?.search('slack')}>Find Slack</button>
<SingulJS ref={ref} authToken="..." inline />
```

---

## Pointing it at your own backend

If you have a Shuffle-compatible API for authenticated apps and OAuth handoff:

```tsx
<SingulJS
  authToken={user.token}
  apiKey={user.apiKey}
  apiBaseUrl="https://your-backend.example.com"
  authPath="/api/v1/apps/authentication"  // optional override
  appAuthPath="/appauth"                  // optional override
/>
```

When `apiKey` is set, the component fetches authenticated apps and renders status dots (green = validated, yellow = configured, blue = selected, gray = inactive).

## Pointing it at your own Algolia index

```tsx
<SingulJS
  authToken="..."
  algoliaAppId="YOUR_APP_ID"
  algoliaApiKey="YOUR_SEARCH_ONLY_KEY"
  algoliaIndexName="your-index"
/>
```

---

## Props

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
| `gridColumns` | `number \| { xs?: number; sm?: number; md?: number; lg?: number }` | `3` | Grid columns when `layout="grid"` |
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

### Algolia (override defaults)

| Prop | Type | Default | Description |
|---|---|---|---|
| `algoliaAppId` | `string` | Shuffle public ID | Algolia application ID |
| `algoliaApiKey` | `string` | Shuffle public key | Algolia search-only API key |
| `algoliaIndexName` | `string` | `"appsearch"` | Algolia index name |

### Styling

| Prop | Type | Description |
|---|---|---|
| `customStyles` | `CustomStyles` | Per-element style overrides — see `singul.helpers.ts` for the full slot list (container, inputWrapper, input, dropdown, dropdownItem, selectedItem, appIcon, appName, appCategory, checkbox, emptyState, etc.) |
| `className` | `string` | Extra class on the root container |

### Custom rendering

| Prop | Type | Description |
|---|---|---|
| `renderItem` | `(app, isSelected, onSelect, authState) => ReactNode` | Replace the default item renderer entirely |
| `renderEmptyState` | `() => ReactNode` | Replace the empty state |
| `renderLoadingState` | `() => ReactNode` | Replace the loading spinner |

### Events

| Prop | Type | Description |
|---|---|---|
| `onAppSelected` | `(detail: { app: AlgoliaSearchApp; authUrl: string }) => void` | Fired when a single app is selected (single-select mode) |
| `onSelectionChange` | `(apps: AlgoliaSearchApp[]) => void` | Fired when the selection set changes (multi-select mode) |
| `onSearchChange` | `(query: string) => void` | Fired on every keystroke |

### Imperative handle (`ref`)

| Method | Description |
|---|---|
| `search(query: string)` | Set the input value and run a search |
| `clear()` | Clear the input and show top results |

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
} from '@/lib/singul-local';
```

---

## Publishing (CI/CD)

This folder doubles as a publishable npm package. The source lives here so the host app can keep importing it via `@/lib/singul-local`, while CI bundles + ships it to npm as `@shuffle/singul.js`.

### Files in this folder

| File | Purpose |
|---|---|
| `SingulJS.tsx`, `singul.helpers.ts`, `singul.css`, `index.ts` | Library source — used by both the host app and the published package |
| `package.tpl.json` | Template for the published `package.json`. CI fills in `version` and writes `package.json` |
| `tsup.config.ts` | Bundler config for emitting ESM + CJS + `.d.ts` to `dist/` |
| `tsconfig.build.json` | Standalone tsconfig for the library build (host app's tsconfig excludes it) |
| `.npmignore` | Whitelist `dist/`, README, LICENSE only |

### How to publish

Tag a commit:
```bash
git tag singul-v0.1.0
git push origin singul-v0.1.0
```

The `.github/workflows/publish-singul.yml` workflow then:
1. Resolves the version from the tag (`singul-v0.1.0` → `0.1.0`)
2. Materializes `package.json` from `package.tpl.json` with that version
3. Runs `npm run build` (tsup) inside `src/lib/singul-local`
4. Runs `npm publish --access public --provenance`

You can also trigger the workflow manually from the Actions tab with a custom version, or with `dry_run: true` to only produce the `.tgz` artifact.

### Required secret

- `NPM_TOKEN` — npm automation token with publish rights to the `@shuffle` scope.

### Local test

```bash
cd src/lib/singul-local
cp package.tpl.json package.json
# edit version manually for local test
npm install
npm run build
npm pack
```

The resulting `shuffle-singul.js-X.Y.Z.tgz` is installable in any project with `npm i ./shuffle-singul.js-X.Y.Z.tgz`.
