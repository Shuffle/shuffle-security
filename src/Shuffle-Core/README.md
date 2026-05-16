# Shuffle-Core

Standalone React surfaces extracted from the Shuffle Security app. Companion to
[`@shuffleio/shuffle-mcps`](../Shuffle-MCPs/README.md).

This package starts with the **Usecases** explorer (the entire `/usecases` and
`/usecases/:flowId` experience) and will grow to cover form control next.

## Install

```bash
npm install @shuffleio/shuffle-core
```

Peer deps: `react >= 18`, `react-dom >= 18`, `@mui/material >= 5`,
`lucide-react`, `react-router-dom`, `react-ga4`,
and `@shuffleio/shuffle-mcps` (used for the embedded app search drawer).

## Quick start

```tsx
import { Usecases } from '@shuffleio/shuffle-core';
import '@shuffleio/shuffle-core/shuffle-core.css';

export default function App() {
  return <Usecases />;
}
```

Mount inside your own router under whichever path you want — the component
reads `:flowId` from `useParams()` and `selected_object` from `useSearchParams()`
when running under `react-router-dom`.

## Exports

| Name | Description |
|---|---|
| `Usecases` (default) | The full Usecases explorer (card grid + detail view) |
| `UsecaseAlluvialDiagram` | Source-tools → Shuffle → destination-tools alluvial visualization |
| `usePageMeta` | Hook that sets `<title>`, OG tags, and JSON-LD for the current page |
| `toast` / `setToastImpl` | Tiny toast facade — swap in your own impl via `setToastImpl` |

## Status

Early scaffold — published from the Shuffle Security host app verbatim. Some
host-app peers (`@/context/AuthContext`, `@/lib/utils`, `@/config/usecases`)
are still imported and will be inlined or made injectable in a later pass.
