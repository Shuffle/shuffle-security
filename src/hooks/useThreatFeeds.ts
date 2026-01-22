import { useState, useEffect, useCallback } from 'react';
import { useDatastore } from './useDatastore';
import { DATASTORE_CATEGORIES } from '@/services/datastore';

export interface ThreatFeed {
  id: string;
  url: string;
  name: string;
  description?: string;
  enabled: boolean;
}

// Default threat feed URLs
export const DEFAULT_THREAT_FEEDS: ThreatFeed[] = [
  {
    id: 'sslbl_abuse',
    url: 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv',
    name: 'SSL Blacklist (abuse.ch)',
    description: 'SSL certificate blacklist from abuse.ch',
    enabled: true,
  },
  {
    id: 'alienvault_reputation',
    url: 'https://reputation.alienvault.com/reputation.generic',
    name: 'AlienVault Reputation',
    description: 'Generic IP reputation data from AlienVault OTX',
    enabled: true,
  },
  {
    id: 'bambenek_dga',
    url: 'https://osint.bambenekconsulting.com/feeds/dga-feed-high.csv',
    name: 'Bambenek DGA Feed',
    description: 'High confidence DGA domain feed from Bambenek Consulting',
    enabled: true,
  },
];

export const useThreatFeeds = () => {
  const { items, isLoading, fetchItems, addItem, removeItem } = useDatastore({ 
    category: DATASTORE_CATEGORIES.THREAT_FEEDS 
  });
  const [threatFeeds, setThreatFeeds] = useState<ThreatFeed[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Parse threat feeds from datastore
  useEffect(() => {
    if (isLoading) return;
    
    if (items.length > 0) {
      const parsed: ThreatFeed[] = items.map(item => {
        try {
          return JSON.parse(item.value) as ThreatFeed;
        } catch {
          return { id: item.key, url: item.value, name: item.key, enabled: true };
        }
      });
      setThreatFeeds(parsed);
      setInitialized(true);
    } else if (!initialized) {
      // If no items and not yet initialized, use defaults
      setThreatFeeds(DEFAULT_THREAT_FEEDS);
      setInitialized(true);
    }
  }, [items, isLoading, initialized]);

  // Add or update a threat feed
  const saveFeed = useCallback(async (feed: ThreatFeed) => {
    await addItem(feed.id, feed);
    await fetchItems();
  }, [addItem, fetchItems]);

  // Remove a threat feed
  const deleteFeed = useCallback(async (id: string) => {
    await removeItem(id);
    await fetchItems();
  }, [removeItem, fetchItems]);

  // Initialize defaults in datastore using bulk API
  const initializeDefaults = useCallback(async () => {
    const { setDatastoreItems, DATASTORE_CATEGORIES } = await import('@/services/datastore');
    const items = DEFAULT_THREAT_FEEDS.map(feed => ({
      key: feed.id,
      value: feed,
    }));
    await setDatastoreItems(items, DATASTORE_CATEGORIES.THREAT_FEEDS);
    await fetchItems();
  }, [fetchItems]);

  // Toggle feed enabled state
  const toggleFeed = useCallback(async (id: string) => {
    const feed = threatFeeds.find(f => f.id === id);
    if (feed) {
      await saveFeed({ ...feed, enabled: !feed.enabled });
    }
  }, [threatFeeds, saveFeed]);

  return {
    threatFeeds,
    isLoading,
    saveFeed,
    deleteFeed,
    toggleFeed,
    initializeDefaults,
    refetch: fetchItems,
  };
};

export default useThreatFeeds;
