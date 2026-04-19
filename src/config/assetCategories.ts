// Asset category catalog — each category maps to its own datastore key
// so sources can be loaded in parallel and stay isolated from each other.
import {
  Monitor,
  Smartphone,
  Server,
  Boxes,
  Database,
  Network,
  Zap,
  Activity,
  KeyRound,
  Users,
  ShieldCheck,
  UsersRound,
  GitBranch,
  Cloud,
  Globe,
  FileLock2,
  type LucideIcon,
} from 'lucide-react';

export interface AssetCategory {
  id: string;
  label: string;
  short: string;
  description: string;
  datastoreKey: string;
  icon: LucideIcon;
  group: 'Compute' | 'Infra' | 'Identity' | 'Code & SaaS';
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  // Compute & endpoints
  { id: 'endpoints',     label: 'Computer Endpoints',  short: 'Endpoints',  description: 'Laptops, desktops, workstations',                  datastoreKey: 'shuffle-security_assets_endpoints',     icon: Monitor,     group: 'Compute' },
  { id: 'mobile',        label: 'Mobile Devices',      short: 'Mobile',     description: 'Phones and tablets',                                datastoreKey: 'shuffle-security_assets_mobile',        icon: Smartphone,  group: 'Compute' },
  { id: 'compute',       label: 'Compute Instances',   short: 'Compute',    description: 'EC2, GCE, Azure VMs',                               datastoreKey: 'shuffle-security_assets_compute',       icon: Server,      group: 'Compute' },
  { id: 'containers',    label: 'Container Platforms', short: 'Containers', description: 'Kubernetes, ECS, GKE clusters and workloads',      datastoreKey: 'shuffle-security_assets_containers',    icon: Boxes,       group: 'Compute' },
  { id: 'serverless',    label: 'Serverless Functions',short: 'Serverless', description: 'Lambda, Cloud Functions, Azure Functions',          datastoreKey: 'shuffle-security_assets_serverless',    icon: Zap,         group: 'Compute' },

  // Infra & data
  { id: 'storage',       label: 'Storage & Databases', short: 'Storage',    description: 'S3, RDS, Postgres, Mongo, buckets',                 datastoreKey: 'shuffle-security_assets_storage',       icon: Database,    group: 'Infra' },
  { id: 'networks',      label: 'Virtual Networks',    short: 'VPCs',       description: 'VPCs, subnets, peering, gateways',                  datastoreKey: 'shuffle-security_assets_networks',      icon: Network,     group: 'Infra' },
  { id: 'monitoring',    label: 'Monitoring & Logging',short: 'Monitoring', description: 'CloudWatch, Datadog, log groups, dashboards',       datastoreKey: 'shuffle-security_assets_monitoring',    icon: Activity,    group: 'Infra' },
  { id: 'kms',           label: 'Key Management',      short: 'KMS',        description: 'KMS keys, Vault secrets, certificates',             datastoreKey: 'shuffle-security_assets_kms',           icon: KeyRound,    group: 'Infra' },

  // Identity
  { id: 'identity_users',  label: 'Identity Users',  short: 'Users',  description: 'IAM, Okta, Entra, Workspace users',               datastoreKey: 'shuffle-security_assets_identity-users',  icon: Users,       group: 'Identity' },
  { id: 'identity_roles',  label: 'Identity Roles',  short: 'Roles',  description: 'IAM roles, service roles, assumable roles',       datastoreKey: 'shuffle-security_assets_identity-roles',  icon: ShieldCheck, group: 'Identity' },
  { id: 'identity_groups', label: 'Identity Groups', short: 'Groups', description: 'Directory groups, IAM groups, Okta groups',        datastoreKey: 'shuffle-security_assets_identity-groups', icon: UsersRound,  group: 'Identity' },

  // Code & SaaS
  { id: 'code_repos',    label: 'Code Repositories',   short: 'Repos',      description: 'GitHub, GitLab, Bitbucket repositories',           datastoreKey: 'shuffle-security_assets_code-repos',    icon: GitBranch,   group: 'Code & SaaS' },
  { id: 'saas_apps',     label: 'SaaS Applications',   short: 'SaaS',       description: 'Connected SaaS apps (Slack, M365, Salesforce…)',   datastoreKey: 'shuffle-security_assets_saas-apps',     icon: Cloud,       group: 'Code & SaaS' },
  { id: 'domains',       label: 'Domains & DNS',       short: 'Domains',    description: 'Owned domains, DNS records, certificates',          datastoreKey: 'shuffle-security_assets_domains',       icon: Globe,       group: 'Code & SaaS' },
  { id: 'secrets',       label: 'Secrets & Certificates', short: 'Secrets', description: 'API keys, TLS certs, SSH keys',                     datastoreKey: 'shuffle-security_assets_secrets',       icon: FileLock2,   group: 'Code & SaaS' },
];

export const ASSET_CATEGORY_BY_ID: Record<string, AssetCategory> = Object.fromEntries(
  ASSET_CATEGORIES.map(c => [c.id, c]),
);

export const ASSET_CATEGORY_BY_KEY: Record<string, AssetCategory> = Object.fromEntries(
  ASSET_CATEGORIES.map(c => [c.datastoreKey, c]),
);

// Endpoints maps to the existing legacy `shuffle-security_assets` category for back-compat.
// Stores newly-typed assets under per-category keys; legacy items show in the Endpoints tab.
export const LEGACY_ASSETS_KEY = 'shuffle-security_assets';
