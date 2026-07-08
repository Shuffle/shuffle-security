// Helpers for the "authoritative tenants" stamp we attach to an incident
// payload during a Move-to-Tenant operation. The stamp lets the UI recognise
// ghost copies that get auto-recovered from datastore history in tenants the
// incident was explicitly moved out of.
//
// Stamp shape (stored on incident.metadata.extensions.custom_attributes):
//   _tenants: string[]              -> tenants this incident should live in
//   _tenants_removed: string[]      -> tenants explicitly removed (cumulative)
//   _tenants_updated_at: number     -> ms epoch of last authoritative write

export interface TenantStamp {
  tenants: string[];
  removed: string[];
  updatedAt: number;
}

/**
 * Extract the tenant stamp from any incident-shaped value. Accepts either a
 * parsed OCSF object or the wrapping datastore item; returns null when the
 * payload has not been stamped yet.
 */
export const readTenantStamp = (input: unknown): TenantStamp | null => {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, any>;
  // Support either a raw OCSF payload or something with .rawOCSF.
  const ocsf = (obj.rawOCSF && typeof obj.rawOCSF === 'object') ? obj.rawOCSF : obj;
  const custom = ocsf?.metadata?.extensions?.custom_attributes;
  if (!custom) return null;
  const tenants = Array.isArray(custom._tenants) ? custom._tenants.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0) : null;
  if (!tenants) return null;
  const removed = Array.isArray(custom._tenants_removed) ? custom._tenants_removed.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0) : [];
  const updatedAt = typeof custom._tenants_updated_at === 'number' ? custom._tenants_updated_at : 0;
  return { tenants, removed, updatedAt };
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
