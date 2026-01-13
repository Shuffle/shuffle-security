import { useState, useEffect, useCallback } from 'react';
import { useDatastore } from './useDatastore';
import { DATASTORE_CATEGORIES } from '@/services/datastore';

export interface IOCType {
  name: string;
  regex?: string; // Optional - not all types need patterns
  description?: string;
  category?: 'hash' | 'network' | 'file' | 'user' | 'system' | 'tool' | 'ttp' | 'other';
}

// Default IOC types organized by Pyramid of Pain levels
// Level 1: Hash Values (Trivial) - Easy to change, but useful for exact matching
// Level 2: IP Addresses (Easy) - Can be changed, but often tied to infrastructure
// Level 3: Domain Names (Simple) - Slightly harder to change than IPs
// Level 4: Network/Host Artifacts (Annoying) - Behavioral patterns that require effort to modify
// Level 5: Tools (Challenging) - Specific malware/tools that require development to change
// Level 6: TTPs (Tough!) - Tactics, Techniques, Procedures - hardest to change

export const DEFAULT_IOC_TYPES: IOCType[] = [
  // === LEVEL 1: HASH VALUES (Trivial) ===
  { name: 'hash_md5', regex: '^[a-fA-F0-9]{32}$', description: 'MD5 hash (32 hex chars)', category: 'hash' },
  { name: 'hash_sha1', regex: '^[a-fA-F0-9]{40}$', description: 'SHA1 hash (40 hex chars)', category: 'hash' },
  { name: 'hash_sha256', regex: '^[a-fA-F0-9]{64}$', description: 'SHA256 hash (64 hex chars)', category: 'hash' },
  { name: 'hash_sha512', regex: '^[a-fA-F0-9]{128}$', description: 'SHA512 hash (128 hex chars)', category: 'hash' },
  { name: 'hash_ssdeep', description: 'SSDeep fuzzy hash', category: 'hash' },
  { name: 'hash_imphash', regex: '^[a-fA-F0-9]{32}$', description: 'PE Import hash', category: 'hash' },
  { name: 'hash_tlsh', description: 'TLSH locality-sensitive hash', category: 'hash' },
  
  // === LEVEL 2: IP ADDRESSES (Easy) ===
  { name: 'ip', regex: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$', description: 'IPv4 address', category: 'network' },
  { name: 'ipv6', regex: '^(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}$', description: 'IPv6 address', category: 'network' },
  { name: 'ip_range', description: 'IP CIDR range (e.g., 192.168.1.0/24)', category: 'network' },
  { name: 'asn', regex: '^AS\\d+$', description: 'Autonomous System Number', category: 'network' },
  
  // === LEVEL 3: DOMAIN NAMES (Simple) ===
  { name: 'domain', regex: '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$', description: 'Domain name', category: 'network' },
  { name: 'subdomain', description: 'Subdomain pattern', category: 'network' },
  { name: 'url', regex: '^https?:\\/\\/[^\\s]+$', description: 'Full URL', category: 'network' },
  { name: 'uri_path', description: 'URI path pattern', category: 'network' },
  { name: 'email', regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', description: 'Email address', category: 'network' },
  { name: 'email_subject', description: 'Email subject line pattern', category: 'network' },
  
  // === LEVEL 4: NETWORK/HOST ARTIFACTS (Annoying) ===
  // Network artifacts
  { name: 'user_agent', description: 'HTTP User-Agent string', category: 'network' },
  { name: 'http_header', description: 'Specific HTTP header pattern', category: 'network' },
  { name: 'ssl_cert_hash', description: 'SSL/TLS certificate hash', category: 'network' },
  { name: 'ssl_cert_serial', description: 'SSL certificate serial number', category: 'network' },
  { name: 'ja3_hash', regex: '^[a-fA-F0-9]{32}$', description: 'JA3 TLS fingerprint', category: 'network' },
  { name: 'ja3s_hash', regex: '^[a-fA-F0-9]{32}$', description: 'JA3S server fingerprint', category: 'network' },
  { name: 'jarm_hash', description: 'JARM TLS server fingerprint', category: 'network' },
  { name: 'port', regex: '^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$', description: 'Port number', category: 'network' },
  
  // Host/File artifacts
  { name: 'file_name', description: 'File name', category: 'file' },
  { name: 'file_path', description: 'Full file path', category: 'file' },
  { name: 'file_extension', description: 'File extension', category: 'file' },
  { name: 'file_size', description: 'File size (bytes)', category: 'file' },
  { name: 'file_attachment', description: 'Uploaded file attachment', category: 'file' },
  { name: 'directory', description: 'Directory path', category: 'file' },
  
  // System artifacts
  { name: 'hostname', description: 'Hostname', category: 'system' },
  { name: 'mac_address', regex: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$', description: 'MAC address', category: 'system' },
  { name: 'process_name', description: 'Process name', category: 'system' },
  { name: 'process_path', description: 'Full process path', category: 'system' },
  { name: 'process_cmdline', description: 'Command line arguments', category: 'system' },
  { name: 'service_name', description: 'Windows/Linux service name', category: 'system' },
  { name: 'scheduled_task', description: 'Scheduled task name', category: 'system' },
  { name: 'registry_key', description: 'Windows registry key', category: 'system' },
  { name: 'registry_value', description: 'Windows registry value', category: 'system' },
  { name: 'mutex', description: 'Mutex name', category: 'system' },
  { name: 'named_pipe', description: 'Named pipe', category: 'system' },
  { name: 'event_id', description: 'Windows Event ID', category: 'system' },
  
  // === LEVEL 5: TOOLS (Challenging) ===
  { name: 'malware_family', description: 'Malware family name', category: 'tool' },
  { name: 'malware_variant', description: 'Malware variant identifier', category: 'tool' },
  { name: 'tool_name', description: 'Attack tool name (e.g., Mimikatz, Cobalt Strike)', category: 'tool' },
  { name: 'yara_rule', description: 'YARA rule name', category: 'tool' },
  { name: 'sigma_rule', description: 'Sigma detection rule', category: 'tool' },
  { name: 'snort_rule', description: 'Snort/Suricata rule', category: 'tool' },
  
  // === LEVEL 6: TTPs (Tough!) ===
  { name: 'mitre_tactic', regex: '^TA\\d{4}$', description: 'MITRE ATT&CK Tactic ID', category: 'ttp' },
  { name: 'mitre_technique', regex: '^T\\d{4}(\\.\\d{3})?$', description: 'MITRE ATT&CK Technique ID', category: 'ttp' },
  { name: 'mitre_subtechnique', regex: '^T\\d{4}\\.\\d{3}$', description: 'MITRE ATT&CK Sub-technique', category: 'ttp' },
  { name: 'attack_pattern', description: 'Attack pattern description', category: 'ttp' },
  { name: 'kill_chain_phase', description: 'Cyber Kill Chain phase', category: 'ttp' },
  
  // === USER/IDENTITY ===
  { name: 'user', description: 'Username or user identifier', category: 'user' },
  { name: 'user_email', description: 'User email address', category: 'user' },
  { name: 'user_sid', description: 'Windows Security Identifier (SID)', category: 'user' },
  { name: 'user_guid', description: 'User GUID/UUID', category: 'user' },
  { name: 'group_name', description: 'User group or role name', category: 'user' },
  
  // === THREAT INTEL REFERENCES ===
  { name: 'cve', regex: '^CVE-\\d{4}-\\d{4,}$', description: 'CVE vulnerability ID', category: 'other' },
  { name: 'cwe', regex: '^CWE-\\d+$', description: 'CWE weakness ID', category: 'other' },
  { name: 'capec', regex: '^CAPEC-\\d+$', description: 'CAPEC attack pattern ID', category: 'other' },
  { name: 'threat_actor', description: 'Threat actor/APT group name', category: 'other' },
  { name: 'campaign', description: 'Attack campaign name', category: 'other' },
  { name: 'bitcoin_address', regex: '^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$', description: 'Bitcoin wallet address', category: 'other' },
  { name: 'ethereum_address', regex: '^0x[a-fA-F0-9]{40}$', description: 'Ethereum wallet address', category: 'other' },
  { name: 'monero_address', description: 'Monero wallet address', category: 'other' },
  
  // === GENERIC ===
  { name: 'other', description: 'Other indicator type', category: 'other' },
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
    // Group by category for better UI (Pyramid of Pain levels)
    groupedTypes: {
      hash: iocTypes.filter(t => t.category === 'hash'),
      network: iocTypes.filter(t => t.category === 'network'),
      file: iocTypes.filter(t => t.category === 'file'),
      system: iocTypes.filter(t => t.category === 'system'),
      tool: iocTypes.filter(t => t.category === 'tool'),
      ttp: iocTypes.filter(t => t.category === 'ttp'),
      user: iocTypes.filter(t => t.category === 'user'),
      other: iocTypes.filter(t => t.category === 'other' || !t.category),
    },
  };
};

export default useIOCTypes;
