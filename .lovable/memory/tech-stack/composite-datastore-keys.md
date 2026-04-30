---
name: Composite datastore keys
description: Use src/utils/compositeKey.ts for any datastore key that combines a type + value
type: feature
---

The Shuffle datastore is flat key/value, but many features key rows by a
`(type, value)` pair (ignored observables, IOC comments, mention preferences,
etc.). All such code MUST go through `src/utils/compositeKey.ts` instead of
hand-rolling a separator.

## Why this exists

`normalizeDatastoreKey` in `src/services/datastore.ts` greedily strips every
`::` segment down to the LAST one (originally to remove a legacy
`orgId::category::` prefix). That silently destroys legitimate composite
keys: a write of `domain::dashboard.stripe.com` is persisted as just
`dashboard.stripe.com`, so a later `isIgnored("domain", "dashboard.stripe.com")`
lookup never matches and the row appears un-ignored on reload. This caused
"hide observable doesn't stick across page loads" until we switched to a
separator the normalizer leaves alone.

## API

- `canonicalCompositeKey(type, value)` — `${type}::${value}` lowercased; use
  for Set membership, Map keys, equality checks. NEVER send this to the API.
- `encodeCompositeKey(type, value)` — `${type}||${value}` lowercased; what we
  PERSIST. The `||` separator is invisible to `normalizeDatastoreKey`.
- `decodeCompositeKey(storedKey)` — `{ type, value }`. Tolerates legacy `::`
  rows, new `||` rows, and value-only rows (where the type was lost).
- `toCanonicalCompositeKey(storedKey)` — convenience: decode then canonicalize.

## Rules

- Always store the `(type, value)` in the JSON payload too. Treat the JSON as
  source of truth on read; the key is just an index. This is what lets us
  recover from legacy rows where the type segment was stripped.
- Local lookup maps must be keyed by `canonicalCompositeKey`, never by the
  stored key, so lookups by raw `(type, value)` from the UI just work.
