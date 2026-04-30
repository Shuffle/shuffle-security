/**
 * Composite datastore key utilities.
 *
 * The Shuffle datastore is a flat key/value store, but many features use
 * composite keys to group related state (e.g. `domain::dashboard.stripe.com`,
 * `ip::1.2.3.4`, `user::alice@x.com`). This module is the single place that
 * decides how those keys are encoded for storage and decoded on read.
 *
 * Why a single util?
 * - Historically `normalizeDatastoreKey` greedily stripped every `::` segment
 *   down to the last one — intended to remove a legacy `orgId::category::`
 *   prefix, but it also mangled legitimate composite keys like
 *   `domain::dashboard.stripe.com` → `dashboard.stripe.com`. That broke
 *   round-tripping (write `domain::x`, read back `x`, lookup fails).
 * - We now use a `||` separator inside the stored ID instead of `::`, so
 *   `normalizeDatastoreKey`'s legacy stripping no longer touches us.
 * - Encoders/decoders live here so every feature (ignored observables, IOC
 *   comments, mention preferences, …) gets the same canonical behaviour.
 */

/** Separator used for the stored datastore key. Chosen to NOT collide with the
 *  legacy `::` separator that `normalizeDatastoreKey` strips. */
const STORAGE_SEP = '||';

/** Separator used for in-memory canonical keys (Sets, Maps, equality checks). */
const CANONICAL_SEP = '::';

/** Lowercase + trim a key part so equality is consistent regardless of input casing. */
const normalize = (s: string): string => (s || '').trim().toLowerCase();

/**
 * Build the canonical in-memory key for a (type, value) pair. Use this for
 * Set membership, Map lookups, etc. — never send this directly to the API.
 */
export const canonicalCompositeKey = (type: string, value: string): string =>
  `${normalize(type)}${CANONICAL_SEP}${normalize(value)}`;

/**
 * Encode a (type, value) pair into the form we PERSIST in the datastore.
 * Avoids `::` so the legacy key normalizer doesn't strip the type prefix.
 */
export const encodeCompositeKey = (type: string, value: string): string =>
  `${normalize(type)}${STORAGE_SEP}${normalize(value)}`;

/**
 * Decode a stored key back into `{ type, value }`. Tolerates both the new
 * `||` form and any legacy `::` records, plus single-segment keys (where the
 * type was lost to the legacy normalizer — caller decides what to do).
 */
export const decodeCompositeKey = (storedKey: string): { type: string; value: string } => {
  const k = (storedKey || '').toLowerCase();
  for (const sep of [STORAGE_SEP, CANONICAL_SEP]) {
    const idx = k.indexOf(sep);
    if (idx > 0) {
      return { type: k.slice(0, idx), value: k.slice(idx + sep.length) };
    }
  }
  // Legacy / unknown: no type segment present.
  return { type: '', value: k };
};

/**
 * Convert any stored key (potentially in legacy `::` form, or partially
 * normalized) into the canonical in-memory form. Used to build local
 * lookup sets from datastore list responses.
 */
export const toCanonicalCompositeKey = (storedKey: string): string => {
  const { type, value } = decodeCompositeKey(storedKey);
  return type ? `${type}${CANONICAL_SEP}${value}` : value;
};
