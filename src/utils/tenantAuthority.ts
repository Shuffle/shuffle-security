// Helpers for the "authoritative tenants" stamp we attach to an incident
// payload during a Move-to-Tenant operation. The stamp lets the UI recognise
// ghost copies that the datastore backend auto-recovers from history in
// tenants the incident was explicitly moved out of.
//
// Stamp shape (stored on incident.metadata.extensions.custom_attributes):
//   _tenants: string[]              -> tenants this incident should live in
//   _tenants_removed: string[]      -> tenants explicitly removed (cumulative)
//   _tenants_updated_at: number     -> ms epoch of last authoritative write
//   _tenant_tombstone: boolean      -> when true, this copy is a placeholder
//                                     left behind in a removed tenant purely
//                                     to prevent auto-recovery of history

export interface TenantStamp {
  tenants: string[];
  removed: string[];
  updatedAt: number;
}

const getCustomAttrs = (input: unknown): Record<string, any> | null => {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, any>;
  const ocsf = (obj.rawOCSF && typeof obj.rawOCSF === 'object') ? obj.rawOCSF : obj;
  const custom = ocsf?.metadata?.extensions?.custom_attributes;
  return custom && typeof custom === 'object' ? custom : null;
};

/**
 * Extract the tenant stamp from any incident-shaped value. Accepts either a
 * parsed OCSF object or the wrapping datastore item; returns null when the
 * payload has not been stamped yet.
 */
export const readTenantStamp = (input: unknown): TenantStamp | null => {
  const custom = getCustomAttrs(input);
  if (!custom) return null;
  const tenants = Array.isArray(custom._tenants) ? custom._tenants.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0) : null;
  if (!tenants) return null;
  const removed = Array.isArray(custom._tenants_removed) ? custom._tenants_removed.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0) : [];
  const updatedAt = typeof custom._tenants_updated_at === 'number' ? custom._tenants_updated_at : 0;
  return { tenants, removed, updatedAt };
};

/**
 * True when this specific copy is a tombstone we wrote to keep the row
 * present in a removed tenant (so datastore-history auto-recovery cannot
 * resurrect the old value). Tombstones must always be filtered from
 * presence, counts, and detail views.
 */
export const isTenantTombstone = (input: unknown): boolean => {
  const custom = getCustomAttrs(input);
  return !!custom && custom._tenant_tombstone === true;
};

/**
 * Given a set of candidate copies (one per tenant), return the authoritative
 * stamp — the one with the newest updatedAt. Falls back to null when no copy
 * carries a stamp yet, in which case callers should treat every copy as
 * present (legacy behaviour).
 */
export const pickAuthoritativeStamp = (
  copies: Array<{ orgId: string; value: unknown }>,
): TenantStamp | null => {
  let best: TenantStamp | null = null;
  for (const c of copies) {
    const s = readTenantStamp(c.value);
    if (!s) continue;
    if (!best || s.updatedAt > best.updatedAt) best = s;
  }
  return best;
};

/**
 * True when a tenant is explicitly excluded by the given stamp — meaning any
 * copy discovered there should be treated as a ghost (auto-recovered) and
 * hidden from tenant counts, presence banners, and dropdowns.
 */
export const isTenantGhost = (orgId: string, stamp: TenantStamp | null): boolean => {
  if (!stamp) return false;
  if (stamp.tenants.includes(orgId)) return false;
  // Only treat as ghost if we explicitly know it was removed. Unknown tenants
  // (never mentioned in either list) are conservatively left alone.
  return stamp.removed.includes(orgId);
};

/**
 * Build a stamped tombstone payload from a source incident value. The
 * tombstone is a minimal placeholder that carries the authoritative tenant
 * stamp and the `_tenant_tombstone` flag, so the datastore keeps a row
 * present in a removed tenant (defeating history auto-recovery) while the
 * UI filters it everywhere.
 */
export const buildTombstonePayload = (
  sourceValue: unknown,
  stamp: { tenants: string[]; removed: string[]; updatedAt: number },
): Record<string, any> => {
  const base: Record<string, any> =
    sourceValue && typeof sourceValue === 'object' ? { ...(sourceValue as Record<string, any>) } : {};
  const metaBase = { ...(base.metadata || {}) };
  const extBase = { ...(metaBase.extensions || {}) };
  const custBase = { ...(extBase.custom_attributes || {}) };
  custBase._tenants = stamp.tenants;
  custBase._tenants_removed = stamp.removed;
  custBase._tenants_updated_at = stamp.updatedAt;
  custBase._tenant_tombstone = true;
  extBase.custom_attributes = custBase;
  metaBase.extensions = extBase;
  base.metadata = metaBase;
  return base;
};

