// OCSF Device Inventory Info Schema (class_uid: 6002)
// Structure for security asset management

export const DEVICE_TYPES = [
  { id: 0, label: 'Unknown' },
  { id: 1, label: 'Server' },
  { id: 2, label: 'Desktop' },
  { id: 3, label: 'Laptop' },
  { id: 4, label: 'Tablet' },
  { id: 5, label: 'Mobile' },
  { id: 6, label: 'Virtual' },
  { id: 7, label: 'IOT' },
  { id: 8, label: 'Browser' },
  { id: 9, label: 'Firewall' },
  { id: 10, label: 'Switch' },
  { id: 11, label: 'Hub' },
  { id: 12, label: 'Router' },
  { id: 13, label: 'IDS' },
  { id: 14, label: 'IPS' },
  { id: 15, label: 'Load Balancer' },
  { id: 99, label: 'Other' },
] as const;

export const RISK_LEVELS = [
  { id: 0, label: 'Info' },
  { id: 1, label: 'Low' },
  { id: 2, label: 'Medium' },
  { id: 3, label: 'High' },
  { id: 4, label: 'Critical' },
  { id: 99, label: 'Other' },
] as const;

export interface OCSFDeviceInventory {
  // Required
  hostname: string;
  type_id: number;

  // Recommended
  ip?: string;
  uid?: string;
  risk_level_id?: number;
  risk_score?: string;
  last_seen_time?: string;
  first_seen_time?: string;
  instance_uid?: string;
  interface_name?: string;
  interface_uid?: string;

  // Optional
  mac?: string;
  name?: string;
  owner?: { name?: string; email?: string; uid?: string };
  type?: string;
  risk_level?: string;
  agent_list?: Array<{ name?: string; uid?: string; version?: string }>;
  autoscale_uid?: string;
  boot_time?: string;
  created_time?: string;
  desc?: string;
  domain?: string;
  eid?: string;
  hypervisor?: string;
  iccid?: string;
  imei?: string;
  model?: string;
  modified_time?: string;
  os_machine_uuid?: string;
  region?: string;
  subnet?: string;

  // Shuffle extensions
  metadata?: {
    uid?: string;
    extensions?: {
      custom_attributes?: {
        comments?: Array<{ author: string; timestamp: string; text: string }>;
        [key: string]: unknown;
      };
    };
  };
}

export const generateAssetUid = (): string =>
  `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
