<div align="center">

[<img src="https://shuffler.io/images/logos/singul.svg" alt="Singul Logo" width="100"/>](https://singul.io)

# Singul Integrations Library

Search, select, and authenticate against 3,000+ SaaS integrations.

[![npm](https://img.shields.io/npm/v/singul-integrations.svg)](https://www.npmjs.com/package/singul-integrations)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![upstream](https://img.shields.io/badge/upstream-Shuffle%2Fsingul.js-orange)](https://github.com/Shuffle/singul.js)

</div>

---

<div align="center">
  <img width="746" alt="Singul search preview" src="https://github.com/user-attachments/assets/774a6c5e-a8aa-4a12-9931-a952147b0992" />
</div>

A headless React component for app discovery, selection, and OAuth handoff. Powers integration drawers, onboarding flows, and app pickers. Works zero-config against Shuffle's public Algolia index, or point it at your own.

## Install

```bash
npm install singul-integrations
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
      onAppSelected={(d) => console.log('picked', d.app.name)}
    />
  );
}
```

## Recipes

### Search → detail drawer

The most common pattern. Set `preventDefault` and handle `onAppSelected` to chain into your own auth or detail UI:

```tsx
<SingulJS
  authToken={token}
  inline
  preventDefault
  onAppSelected={(d) => openDetailDrawer(d.app)}
/>
```

Full two-drawer reference implementation: [`src/components/shared/AppSearchDrawer.tsx`](../components/shared/AppSearchDrawer.tsx).

### Predefined search

```tsx
<SingulJS
  authToken="..."
  inline
  initialFilterQuery="siem"
  placeholder="Search SIEM tools..."
/>
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

### Your own backend

```tsx
<SingulJS
  authToken={user.token}
  apiKey={user.apiKey}
  apiBaseUrl="https://your-backend.example.com"
  algoliaAppId="YOUR_APP_ID"
  algoliaApiKey="YOUR_SEARCH_KEY"
/>
```

When `apiKey` is set, status dots appear: validated, configured, selected, inactive.

## Common props

| Prop | Type | Description |
|---|---|---|
| `authToken` | `string` | Required. Forwarded into the auth URL. |
| `inline` | `boolean` | Inline results vs floating dropdown. |
| `layout` | `'list' \| 'grid'` | Result layout. Default `'list'`. |
| `initialFilterQuery` | `string` | Pre-filter without filling the input. |
| `preventDefault` | `boolean` | Skip default `window.open(authUrl)` so you can handle selection. |
| `onAppSelected` | `(detail) => void` | Fires on single-select pick. |
| `multiSelect` | `boolean` | Allow selecting multiple apps. |
| `apiKey` | `string` | Bearer token. Enables status dots. |
| `customStyles` | `CustomStyles` | Per-slot style overrides. |

Full prop reference, framework setup (Next.js, Vue), styling slots, custom rendering, and publishing: [**LIBRARY.md**](./LIBRARY.md).

## Imperative handle

```tsx
const ref = useRef<SingulJSHandle>(null);
<SingulJS ref={ref} authToken="..." inline />

ref.current?.search('slack');
ref.current?.clear();
```

## Next.js

The component touches `window`, so render it client-side with `'use client'` or `next/dynamic({ ssr: false })`. See [LIBRARY.md](./LIBRARY.md#nextjs) for details.
