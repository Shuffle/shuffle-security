/**
 * Auto-initialize default IOC Types for an org if they haven't been set up yet.
 * Call once when /incidents loads.
 *
 * NOTE: Threat Feeds are intentionally NOT auto-seeded here. The Threat Feeds
 * page must always reflect the real contents of the datastore — defaults are
 * only inserted when the user explicitly clicks "Reset to Defaults".
 */

import { getDatastoreByCategory, setDatastoreItems, DATASTORE_CATEGORIES } from '@/services/datastore';
import { DEFAULT_IOC_TYPES, DEFAULT_ENABLED_IOCS } from '@/hooks/useIOCTypes';

let _initialized = false;

export const ensureDefaultsInitialized = async () => {
  if (_initialized) return;
  _initialized = true;

  try {
    const iocsRes = await getDatastoreByCategory(DATASTORE_CATEGORIES.IOCS);

    // Initialize IOC types if empty
    if (!iocsRes.success || !iocsRes.data || iocsRes.data.length === 0) {
      const iocItems = DEFAULT_IOC_TYPES.map(ioc => ({
        key: ioc.name,
        value: { ...ioc, enabled: ioc.enabled ?? DEFAULT_ENABLED_IOCS.has(ioc.name) },
      }));
      await setDatastoreItems(iocItems, DATASTORE_CATEGORIES.IOCS);
    }
  } catch {
    // Non-critical — defaults will be used in-memory as fallback
    _initialized = false;
  }
};
