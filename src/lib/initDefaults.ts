/**
 * Auto-initialize default Threat Feeds and IOC Types for an org
 * if they haven't been set up yet. Call once when /incidents loads.
 */

import { getDatastoreByCategory, setDatastoreItems, DATASTORE_CATEGORIES } from '@/services/datastore';
import { DEFAULT_THREAT_FEEDS } from '@/hooks/useThreatFeeds';
import { DEFAULT_IOC_TYPES, DEFAULT_ENABLED_IOCS } from '@/hooks/useIOCTypes';

let _initialized = false;

export const ensureDefaultsInitialized = async () => {
  if (_initialized) return;
  _initialized = true;

  try {
    const [feedsRes, iocsRes] = await Promise.all([
      getDatastoreByCategory(DATASTORE_CATEGORIES.THREAT_FEEDS),
      getDatastoreByCategory(DATASTORE_CATEGORIES.IOCS),
    ]);

    const tasks: Promise<any>[] = [];

    // Initialize threat feeds if empty
    if (!feedsRes.success || !feedsRes.data || feedsRes.data.length === 0) {
      const feedItems = DEFAULT_THREAT_FEEDS.map(feed => ({
        key: feed.id,
        value: feed,
      }));
      tasks.push(setDatastoreItems(feedItems, DATASTORE_CATEGORIES.THREAT_FEEDS));
    }

    // Initialize IOC types if empty
    if (!iocsRes.success || !iocsRes.data || iocsRes.data.length === 0) {
      const iocItems = DEFAULT_IOC_TYPES.map(ioc => ({
        key: ioc.name,
        value: { ...ioc, enabled: ioc.enabled ?? DEFAULT_ENABLED_IOCS.has(ioc.name) },
      }));
      tasks.push(setDatastoreItems(iocItems, DATASTORE_CATEGORIES.IOCS));
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  } catch {
    // Non-critical — defaults will be used in-memory as fallback
    _initialized = false;
  }
};
