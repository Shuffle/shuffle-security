import { useState, useEffect, useCallback } from 'react';
import { useDatastore } from './useDatastore';
import { DATASTORE_CATEGORIES } from '@/services/datastore';

export interface IOCType {
  name: string;
  regex?: string; // Optional - not all types need patterns
  description?: string;
  category?: 'hash' | 'network' | 'file' | 'user' | 'system' | 'other';
}

// Default IOC types with optional regex patterns
export const DEFAULT_IOC_TYPES: IOCType[] = [
  // Network
  { name: 'ip', regex: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$', description: 'IPv4 address', category: 'network' },
  { name: 'ipv6', regex: '^(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}$', description: 'IPv6 address', category: 'network' },
  { name: 'domain', regex: '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$', description: 'Domain name', category: 'network' },
  { name: 'url', regex: '^https?:\\/\\/[^\\s]+$', description: 'URL', category: 'network' },
  { name: 'email', regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', description: 'Email address', category: 'network' },
  
  // Hashes
  { name: 'hash_md5', regex: '^[a-fA-F0-9]{32}$', description: 'MD5 hash', category: 'hash' },
  { name: 'hash_sha1', regex: '^[a-fA-F0-9]{40}$', description: 'SHA1 hash', category: 'hash' },
  { name: 'hash_sha256', regex: '^[a-fA-F0-9]{64}$', description: 'SHA256 hash', category: 'hash' },
  { name: 'hash_sha512', regex: '^[a-fA-F0-9]{128}$', description: 'SHA512 hash', category: 'hash' },
  
  // Files
  { name: 'file_name', description: 'File name', category: 'file' },
  { name: 'file_path', description: 'File path', category: 'file' },
  { name: 'file_attachment', description: 'File attachment (uploaded file)', category: 'file' },
  
  // User/Identity
  { name: 'user', description: 'Username or user identifier', category: 'user' },
  { name: 'user_agent', description: 'User agent string', category: 'user' },
  
  // System
  { name: 'hostname', description: 'Hostname', category: 'system' },
  { name: 'mac_address', regex: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$', description: 'MAC address', category: 'system' },
  { name: 'process_name', description: 'Process name', category: 'system' },
  { name: 'registry_key', description: 'Windows registry key', category: 'system' },
  { name: 'port', regex: '^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$', description: 'Port number', category: 'system' },
  
  // Other
  { name: 'cve', regex: '^CVE-\\\\d{4}-\\\\d{4,}$', description: 'CVE identifier', category: 'other' },
  { name: 'asn', regex: '^AS\\\\d+$', description: 'Autonomous System Number', category: 'other' },
  { name: 'bitcoin_address', regex: '^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$', description: 'Bitcoin address', category: 'other' },
  { name: 'other', description: 'Other observable type', category: 'other' },
];

export const useIOCTypes = () => {
  const { items, isLoading, fetchItems, addItem } = useDatastore({ 
    category: DATASTORE_CATEGORIES.IOCS 
  });
  const [iocTypes, setIocTypes] = useState<IOCType[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Parse IOC types from datastore
  useEffect(() => {
    if (isLoading) return;
    
    if (items.length > 0) {
      const parsed: IOCType[] = items.map(item => {
        try {
          return JSON.parse(item.value) as IOCType;
        } catch {
          return { name: item.key, regex: item.value, description: '' };
        }
      });
      setIocTypes(parsed);
      setInitialized(true);
    } else if (!initialized) {
      // If no items and not yet initialized, use defaults
      setIocTypes(DEFAULT_IOC_TYPES);
      setInitialized(true);
    }
  }, [items, isLoading, initialized]);

  // Get observable type names for dropdowns
  const observableTypeNames = iocTypes.map(t => t.name);

  // Validate a value against an IOC type's regex
  const validateValue = useCallback((typeName: string, value: string): boolean => {
    const iocType = iocTypes.find(t => t.name === typeName);
    if (!iocType?.regex) return true; // No regex means any value is valid
    try {
      return new RegExp(iocType.regex).test(value);
    } catch {
      return true;
    }
  }, [iocTypes]);

  // Initialize defaults in datastore
  const initializeDefaults = useCallback(async () => {
    for (const ioc of DEFAULT_IOC_TYPES) {
      await addItem(ioc.name, ioc);
    }
    await fetchItems();
  }, [addItem, fetchItems]);

  return {
    iocTypes,
    isLoading,
    observableTypeNames,
    validateValue,
    initializeDefaults,
    // Group by category for better UI
    groupedTypes: {
      network: iocTypes.filter(t => t.category === 'network'),
      hash: iocTypes.filter(t => t.category === 'hash'),
      file: iocTypes.filter(t => t.category === 'file'),
      user: iocTypes.filter(t => t.category === 'user'),
      system: iocTypes.filter(t => t.category === 'system'),
      other: iocTypes.filter(t => t.category === 'other' || !t.category),
    },
  };
};

export default useIOCTypes;
