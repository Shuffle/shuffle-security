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

// Default threat feed URLs (curated from MISP default feeds)
export const DEFAULT_THREAT_FEEDS: ThreatFeed[] = [
  {
    id: 'sslbl_abuse',
    url: 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv',
    name: 'SSL Blacklist (abuse.ch)',
    description: 'SSL certificate blacklist from abuse.ch – malicious SSL connections',
    enabled: true,
  },
  {
    id: 'feodo_ipblocklist',
    url: 'https://feodotracker.abuse.ch/downloads/ipblocklist.csv',
    name: 'Feodo IP Blocklist (abuse.ch)',
    description: 'Botnet C&C server IPs tracked by Feodo Tracker',
    enabled: true,
  },
  {
    id: 'malware_bazaar',
    url: 'https://bazaar.abuse.ch/export/txt/md5/recent/',
    name: 'Malware Bazaar (abuse.ch)',
    description: 'Recent malware sample hashes from MalwareBazaar',
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
    id: 'circl_osint',
    url: 'https://www.circl.lu/doc/misp/feed-osint',
    name: 'CIRCL OSINT Feed',
    description: 'CIRCL curated OSINT feed in MISP format',
    enabled: true,
  },
  {
    id: 'openphish',
    url: 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt',
    name: 'OpenPhish URL List',
    description: 'Curated list of active phishing URLs from OpenPhish',
    enabled: true,
  },
  {
    id: 'blocklist_de',
    url: 'https://lists.blocklist.de/lists/all.txt',
    name: 'Blocklist.de',
    description: 'IPs reported for attacks on services (SSH, mail, web, etc.)',
    enabled: true,
  },
  {
    id: 'ipsum_level3',
    url: 'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/3.txt',
    name: 'IPsum Level 3',
    description: 'Aggregated malicious IP feed – low false positive rate',
    enabled: true,
  },
  {
    id: 'phishtank',
    url: 'https://data.phishtank.com/data/online-valid.csv',
    name: 'PhishTank Online Valid',
    description: 'Verified active phishing URLs from PhishTank community',
    enabled: true,
  },
  {
    id: 'emergingthreats_compromised',
    url: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
    name: 'Emerging Threats Compromised IPs',
    description: 'Known compromised IP addresses from Emerging Threats',
    enabled: true,
  },
  {
    id: 'threatview_domain_high_confidence',
    url: 'https://threatview.io/Downloads/DOMAIN-High-Confidence-Feed.txt',
    name: 'ThreatView High-Confidence Domains',
    description: 'High-confidence malicious domains curated by ThreatView',
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
