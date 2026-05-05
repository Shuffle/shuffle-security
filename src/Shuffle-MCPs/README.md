<div align="center">

<img src="https://security.shuffler.io/mcp/agent-icon.png" alt="Shuffle MCPs" width="96" />

# Shuffle MCPs

Turn 3,000+ SaaS tools into MCP servers your agents can use. One search, one click, authenticated.

[![npm](https://img.shields.io/npm/v/@shuffleio/shuffle-mcps.svg)](https://www.npmjs.com/package/@shuffleio/shuffle-mcps)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://www.npmjs.com/package/@shuffleio/shuffle-mcps)

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
import { ShuffleMCP } from 'shuffle-mcps';

export default function App() {
  return (
    <ShuffleMCP
      apiKey="YOUR_SHUFFLE_API_KEY"
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
<ShuffleMCP
  apiKey={user.apiKey}
  inline
  preventDefault
  onAppSelected={(d) => openDetailDrawer(d.app)}
/>
```

Full two-drawer reference implementation: [`src/components/shared/AppSearchDrawer.tsx`](../components/shared/AppSearchDrawer.tsx).

### Predefined search

```tsx
<ShuffleMCP
  apiKey="..."
  inline
  initialFilterQuery="siem"
  placeholder="Search SIEM tools..."
/>
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

### Your own backend

```tsx
<ShuffleMCP
  apiKey={user.apiKey}
  apiBaseUrl="https://your-backend.example.com"
  algoliaAppId="YOUR_APP_ID"
  algoliaApiKey="YOUR_SEARCH_KEY"
/>
```

> **About `apiKey`:** this is the **current user's personal Shuffle API key**, not an org-level or service token. Your backend should look up the signed-in user's API key (wherever you store it — DB, session, etc.) and pass it through to this component. The component sends it as `Authorization: Bearer` on every API request and forwards it into the auth handoff URL as `&auth=`, so all reads and authentications happen as that user.

When `apiKey` is set, the component also fetches the user's **private apps** from `/api/v1/apps` and merges them into the search results, with an **All / Public / Private** filter shown above the list. Status dots appear too: validated, configured, selected, inactive.

## Common props

| Prop | Type | Description |
|---|---|---|
| `apiKey` | `string` | The **current user's** Shuffle API key. Your backend should fetch it from wherever you store the user's credentials and pass it in. Used as `Authorization: Bearer` on every request and forwarded into the auth handoff URL as `&auth=`. This is the canonical credential. |
| `~~authToken~~` | `string` | **Deprecated.** Use `apiKey`. Kept for back-compat — only used as the auth-URL token if `apiKey` is not set. |
| `orgId` | `string` | Optional Shuffle organization ID. When set, every API call (`/api/v1/apps/authentication`, `/api/v1/apps`) is sent with an `Org-Id: <orgId>` header, and the auth URL gets `&org_id=<orgId>` appended. Default: not sent. |
| `inline` | `boolean` | Inline results vs floating dropdown. |
| `layout` | `'list' \| 'grid'` | Result layout. Default `'list'`. |
| `initialFilterQuery` | `string` | Pre-filter without filling the input. |
| `preventDefault` | `boolean` | Skip the default click behavior (built-in drawer or `window.open(authUrl)`) so you can handle selection yourself. |
| `onAppSelected` | `(detail) => void` | Fires on single-select pick. If provided, the built-in drawer is **not** opened — you take over. |
| `multiSelect` | `boolean` | Allow selecting multiple apps. |
| `showSourceFilter` | `boolean` | Toggle the All / Public / Private filter. Default `true`. |
| `customStyles` | `CustomStyles` | Per-slot style overrides. |

### Default click behavior

When you do **not** pass `onAppSelected`, clicking an app opens a built-in right-side drawer that shows the app, its existing authentication entries (with Configured / Tested / Inactive chips), and a CTA that opens the Shuffle auth flow in a new tab. Pass `onAppSelected` to take over, or `preventDefault` to disable both.

### Org scoping

```tsx
<ShuffleMCP
  apiKey={user.apiKey}     // current user's Shuffle API key, fetched by your backend
  orgId={currentOrg.id}    // every request now scoped to this org
/>
```


Full prop reference, framework setup (Next.js, Vue), styling slots, custom rendering, and publishing: [**LIBRARY.md**](./LIBRARY.md).

## Imperative handle

```tsx
const ref = useRef<ShuffleMCPHandle>(null);
<ShuffleMCP ref={ref} apiKey="..." inline />

ref.current?.search('slack');
ref.current?.clear();
```

## Next.js

The component touches `window`, so render it client-side with `'use client'` or `next/dynamic({ ssr: false })`. See [LIBRARY.md](./LIBRARY.md#nextjs) for details.
