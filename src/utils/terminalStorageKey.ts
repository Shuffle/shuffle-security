/**
 * Stable per-host key for terminal session history (`terminal_session_*`).
 *
 * Problem: the mini-popover (MonitorHostTable / VulnAssetsPage) keys by
 * `host.uuid`, but the full /monitors/:id/terminal page keys by whatever
 * identifier is in the URL (often the hostname). That meant the same host
 * had two unrelated history entries.
 *
 * Fix: every caller routes through `terminalStorageKey(alias)`. Once a host
 * identity (hostname + arch) has been registered for any alias (uuid OR
 * hostname), all aliases pointing to the same identity resolve to the same
 * canonical key: `terminal_session_h:<hostname>|<arch>`. Until an identity
 * is registered we fall back to `terminal_session_<alias>` so reads of
 * legacy entries still work.
 *
 * Reads should use `readStoredSession(alias)` which merges the canonical
 * store with the legacy uuid-based store so existing history is preserved
 * after upgrade.
 */

type Identity = { hostname?: string; arch?: string };

const norm = (s: string) => s.toLowerCase().trim();

const aliasToIdentity = new Map<string, Identity>();
const aliasToCanonical = new Map<string, string>();

export const registerHostIdentity = (alias: string, identity: Identity): void => {
  if (!alias || !identity?.hostname) return;
  const a = norm(alias);
  aliasToIdentity.set(a, identity);
  aliasToCanonical.delete(a);
  // Also register the hostname itself as an alias so URL lookups resolve.
  const h = norm(identity.hostname);
  aliasToIdentity.set(h, identity);
  aliasToCanonical.delete(h);
};

export const terminalStorageKey = (alias: string): string => {
  if (!alias) return 'terminal_session_';
  const a = norm(alias);
  const cached = aliasToCanonical.get(a);
  if (cached) return cached;
  const id = aliasToIdentity.get(a);
  if (id?.hostname) {
    const host = norm(id.hostname);
    const arch = id.arch ? norm(id.arch) : 'na';
    const key = `terminal_session_h:${host}|${arch}`;
    aliasToCanonical.set(a, key);
    return key;
  }
  return `terminal_session_${alias}`;
};

/**
 * Read merged session entries from the canonical key + legacy uuid key,
 * de-duplicated by entryId. Writes always go through `terminalStorageKey`.
 */
export const readStoredSession = (alias: string): any[] => {
  const out: any[] = [];
  const byEntryId = new Map<string, any>();
  const bySignature = new Map<string, any>(); // actionName::startedAt fallback
  const merge = (key: string) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(raw)) return;
      for (const e of raw) {
        const eid = e?.entryId ? String(e.entryId) : '';
        const sig = `${e?.actionName || ''}::${e?.startedAt || ''}`;
        // Same entryId across stores → merge in place.
        if (eid && byEntryId.has(eid)) {
          Object.assign(byEntryId.get(eid), e);
          continue;
        }
        // Same action+startedAt but different entryId shape (legacy cross-store
        // duplication) → merge into the existing record instead of duplicating.
        if (bySignature.has(sig) && e?.startedAt) {
          Object.assign(bySignature.get(sig), e);
          continue;
        }
        const row = { ...e };
        out.push(row);
        if (eid) byEntryId.set(eid, row);
        if (e?.startedAt) bySignature.set(sig, row);
      }
    } catch { /* ignore */ }
  };
  merge(terminalStorageKey(alias));
  const legacy = `terminal_session_${alias}`;
  if (legacy !== terminalStorageKey(alias)) merge(legacy);
  out.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  return out;
};
