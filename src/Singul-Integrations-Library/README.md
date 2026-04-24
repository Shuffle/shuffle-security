<div align="center">

<img src="https://singul.io/logo.png" alt="Singul" width="120" />

# Singul Integrations Library

**Search, select, and authenticate against 3,000+ SaaS integrations.**

[![npm](https://img.shields.io/npm/v/singul-integrations.svg)](https://www.npmjs.com/package/singul-integrations)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

</div>

---

## Install

```bash
npm install singul-integrations
```

## Use

```tsx
import { SingulJS } from 'singul-integrations';

<SingulJS authToken="..." inline onAppSelected={(d) => console.log(d.app.name)} />
```

## Props (essentials)

| Prop | Description |
|---|---|
| `authToken` | **Required.** Token forwarded to auth handoff. |
| `inline` | Render results inline vs. floating dropdown. |
| `layout` | `"list"` \| `"grid"` |
| `initialFilterQuery` | Predefined search (e.g. `"siem"`) without filling the input. |
| `multiSelect` + `selectedApps` + `onSelectionChange` | Controlled multi-select. |
| `apiKey` + `apiBaseUrl` | Enable auth-status dots from your backend. |
| `algoliaAppId` / `algoliaApiKey` / `algoliaIndexName` | Point at your own index. |
| `customStyles` / `renderItem` | Full visual override. |

Full prop list, types, and event signatures: see [`index.ts`](./index.ts) and [`singul.helpers.ts`](./singul.helpers.ts).

## Imperative

```ts
ref.current?.search('slack');
ref.current?.clear();
```

## Next.js

Render client-side: add `'use client'`, or `dynamic(() => import('singul-integrations'), { ssr: false })`.

## Publishing

Tag `singul-vX.Y.Z` → CI builds from `package.tpl.json` and publishes to npm. Requires `NPM_TOKEN`.
