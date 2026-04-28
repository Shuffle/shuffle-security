<div align="center">

<img src="https://security.shuffler.io/mcp/agent-icon.png" alt="Shuffle MCPs" width="96" />

# Shuffle MCPs

Turn 3,000+ SaaS tools into MCP servers your agents can use. One search, one click, authenticated.

[![npm](https://img.shields.io/npm/v/@shuffleio/shuffle-mcps.svg)](https://www.npmjs.com/package/@shuffleio/shuffle-mcps)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://www.npmjs.com/package/@shuffleio/shuffle-mcps)
[![upstream](https://img.shields.io/badge/upstream-Shuffle%2Fsingul.js-orange)](https://github.com/Shuffle/singul.js)

</div>

---

<table align="center">
  <tr>
    <td align="center" width="50%">
      <img src="https://security.shuffler.io/mcp/search-preview.png" alt="Search 3,000+ integrations" width="380" style="border-radius: 12px;" />
      <br/><sub><b>1. Search any of 3,000+ tools</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="https://security.shuffler.io/mcp/app-detail-preview.png" alt="Authenticate and use as MCP" width="380" style="border-radius: 12px;" />
      <br/><sub><b>2. Authenticate — your agent uses it instantly</b></sub>
    </td>
  </tr>
</table>

&nbsp;

> **See it live:** [security.shuffler.io/apps](https://security.shuffler.io/apps) uses this package in production to power its 3,000+ integration picker.

> **No SDK required.** Once a tool is authenticated in Shuffle, it is live as an MCP server immediately — call it from any agent over plain HTTP. This npm package is the optional UI layer for embedding the search-and-connect flow inside your own product.

## Try it in 30 seconds

Authenticate any tool at [shuffler.io](https://shuffler.io), grab your API key, and call it:

```bash
curl https://shuffler.io/api/v1/apps/YOUR_APP/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "tool_name": "YOUR_APP",
      "input": { "text": "send a hi message to #general on slack" }
    }
  }'
```

That is the MCP. Any agent, any language, no install. Full API reference: [shuffler.io/docs/API](https://shuffler.io/docs/API).

## When to use this package

Install `shuffle-mcps` when you want to **embed** the search, authenticate, and manage flow inside your own React/Vue/Next.js app — onboarding wizards, integration drawers, app pickers. If your agent is just calling MCPs, you do not need this; use the HTTP API directly.

## Install

```bash
npm install shuffle-mcps
```

Peer deps: `react >= 18`, `react-dom >= 18`, `algoliasearch >= 5`.

## Quick start

```tsx
import { SingulJS } from 'shuffle-mcps';

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

When `apiKey` is set, the component also fetches the user's **private apps** from `/api/v1/apps` and merges them into the search results, with an **All / Public / Private** filter shown above the list. Status dots appear too: validated, configured, selected, inactive.

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
| `apiKey` | `string` | Bearer token. Enables status dots and merges your private apps from `/api/v1/apps`. |
| `showSourceFilter` | `boolean` | Toggle the All / Public / Private filter. Default `true`. |
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
