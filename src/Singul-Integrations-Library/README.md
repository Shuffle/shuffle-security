<div align="center">

[<img src="https://shuffler.io/images/logos/singul.svg" alt="Singul Logo" width="100"/>](https://singul.io)

# Singul Integrations Library

Search, select, and authenticate against 3,000+ SaaS integrations.

[![npm](https://img.shields.io/npm/v/singul-integrations.svg)](https://www.npmjs.com/package/singul-integrations)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

</div>

---

<img width="746" height="758" alt="image" src="https://github.com/user-attachments/assets/774a6c5e-a8aa-4a12-9931-a952147b0992" />

## Install

```bash
npm install singul-integrations
```

## Use

```tsx
import { SingulJS } from 'singul-integrations';

export default function App() {
  return (
    <SingulJS
      authToken="any-token"
      inline
      onAppSelected={(d) => console.log('picked', d.app.name)}
    />
  );
}
```

That's it. Works zero-config against the public Shuffle index.

## Common recipe: search → detail drawer

Set `preventDefault` and handle `onAppSelected` yourself to chain into your own auth or detail UI:

```tsx
<SingulJS
  authToken={token}
  inline
  preventDefault
  onAppSelected={(d) => openDetailDrawer(d.app)}
/>
```

A full two-drawer reference implementation lives in [`src/components/shared/AppSearchDrawer.tsx`](../components/shared/AppSearchDrawer.tsx).

## Docs

Full prop reference, framework setup (Next.js, Vue), styling, multi-select, custom backends, and publishing: see **[LIBRARY.md](./LIBRARY.md)**.
