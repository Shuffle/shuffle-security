/**
 * UsecasesPage — Card grid overview of all data flows grouped by Phase 1/2/3.
 *
 * Self-contained / portable: this file inlines the usecase registry, API helpers,
 * auth/workflow fetching, and page-specific UI logic so it can be moved as one file.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useParams } from 'react-router-dom';

import {
  Box,
  Typography,
  Card,
  CardActionArea,
  Avatar,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Select as MuiSelect,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
} from '@mui/material';
import { Search, ArrowRight, ArrowLeft, Download, Zap, Activity, CheckCircle2, Circle, AlertTriangle, Network, Clock, Power, PowerOff, FileJson, X, ExternalLink, Flame, PlayCircle, BookOpen, LayoutGrid, Server, Shield, MessageSquare, Mail, Crosshair, HardDrive, KeyRound, Cloud, Sparkles } from 'lucide-react';
// ── Flow phases ────────────────────────────────────────────────────────────────

export type FlowPhase = 'ingest' | 'response' | 'correlation';

export const FLOW_PHASES: {
  id: FlowPhase;
  label: string;
  subtitle: string;
  step: number;
  color: string;
}[] = [
  {
    id: 'ingest',
    step: 1,
    label: 'Ingest & Tool Setup',
    subtitle: 'Connect your tools and get data flowing in. Start here.',
    color: '--infra-siem',
  },
  {
    id: 'response',
    step: 2,
    label: 'Agents & Response Actions',
    subtitle: 'Automate containment, notifications, and remediation.',
    color: '--infra-edr',
  },
  {
    id: 'correlation',
    step: 3,
    label: 'Context & Correlation',
    subtitle: 'Enrich alerts with intelligence, assets, and identity data.',
    color: '--infra-threat-intel',
  },
];

// ── Tool category definitions ──────────────────────────────────────────────────

export interface ToolCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string; // HSL CSS var name
  examples: string[];
  subcategories: { label: string; description: string }[];
  dataIn: string[];
  dataOut: string[];
  useCases: string[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'case_management',
    label: 'Cases',
    description: 'Central hub for incident tracking, task assignment, and case lifecycle management.',
    icon: React.createElement(LayoutGrid, { size: 22 }),
    color: '--infra-case-mgmt',
    examples: ['Shuffle Cases', 'TheHive', 'ServiceNow', 'Jira', 'PagerDuty', 'Cortex XSOAR'],
    subcategories: [
      { label: 'Incident Management', description: 'Tracking, triage, and lifecycle of security incidents' },
      { label: 'Task Orchestration', description: 'Automated task assignment and SLA tracking' },
      { label: 'Playbook Execution', description: 'Standardized response workflows and runbooks' },
    ],
    dataIn: ['Alerts from SIEM', 'Enrichment from Threat Intel', 'User context from IAM'],
    dataOut: ['Tasks to Communication', 'Status to SIEM', 'Metrics to reporting'],
    useCases: [
      'Auto-create cases from SIEM alerts above threshold',
      'Assign cases to analysts based on schedule',
      'Track SLA compliance and escalation',
      'Aggregate related alerts into single incident',
    ],
  },
  {
    id: 'siem',
    label: 'SIEM',
    description: 'Security Information & Event Management — log aggregation, correlation, and alert generation.',
    icon: React.createElement(Server, { size: 22 }),
    color: '--infra-siem',
    examples: ['Splunk', 'Microsoft Sentinel', 'Elastic SIEM', 'QRadar', 'Wazuh', 'Chronicle'],
    subcategories: [
      { label: 'Log Management', description: 'Centralized log collection, parsing, and retention' },
      { label: 'Correlation Engine', description: 'Cross-source event correlation and alert generation' },
      { label: 'UEBA', description: 'User & Entity Behavior Analytics for anomaly detection' },
    ],
    dataIn: ['Logs from Network', 'Events from EDR', 'Auth logs from IAM'],
    dataOut: ['Alerts to Case Management', 'Logs to Threat Intel', 'Events to AI/LLM'],
    useCases: [
      'Correlate events across sources to detect multi-stage attacks',
      'Generate alerts based on Sigma/YARA detection rules',
      'Forward normalized logs for AI-based anomaly detection',
      'Provide search context for incident investigation',
    ],
  },
  {
    id: 'network',
    label: 'Network',
    description: 'Network monitoring, traffic analysis, and firewall management.',
    icon: React.createElement(Network, { size: 22 }),
    color: '--infra-network',
    examples: ['Palo Alto', 'Fortinet', 'Suricata', 'Zeek', 'Cisco ASA', 'pfSense'],
    subcategories: [
      { label: 'Firewall', description: 'Perimeter and internal traffic filtering and policy enforcement' },
      { label: 'IDS/IPS', description: 'Intrusion detection and prevention systems' },
      { label: 'NDR', description: 'Network Detection & Response for traffic analysis' },
      { label: 'WAF', description: 'Web Application Firewall for application-layer protection' },
    ],
    dataIn: ['IOC watchlists from Threat Intel', 'Block rules from Case Management'],
    dataOut: ['Flow logs to SIEM', 'Alerts to Case Management', 'Packet data to EDR'],
    useCases: [
      'Auto-block malicious IPs from threat intel feeds',
      'Stream NetFlow data to SIEM for correlation',
      'Isolate network segments during active incident',
      'Detect lateral movement via traffic anomalies',
    ],
  },
  {
    id: 'edr',
    label: 'EDR',
    description: 'Endpoint Detection & Response — real-time endpoint monitoring and automated containment.',
    icon: React.createElement(Shield, { size: 22 }),
    color: '--infra-edr',
    examples: ['CrowdStrike', 'SentinelOne', 'Microsoft Defender', 'Carbon Black', 'Cortex XDR', 'Trellix'],
    subcategories: [
      { label: 'Antivirus / EPP', description: 'Endpoint protection platforms and malware prevention' },
      { label: 'XDR', description: 'Extended Detection & Response across endpoints, cloud, and network' },
      { label: 'MDM', description: 'Mobile Device Management for endpoint compliance' },
    ],
    dataIn: ['IOC hashes from Threat Intel', 'Containment orders from Case Management'],
    dataOut: ['Endpoint telemetry to SIEM', 'Alerts to Case Management', 'Process trees to AI/LLM'],
    useCases: [
      'Isolate compromised endpoints automatically',
      'Scan endpoints for known IOC file hashes',
      'Collect forensic artifacts during investigation',
      'Push detection rules from Sigma to endpoint agents',
      'Forward high-confidence EDR alerts directly to Case Management, skipping SIEM for faster response',
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Team messaging and notification channels for real-time incident coordination.',
    icon: React.createElement(MessageSquare, { size: 22 }),
    color: '--infra-communication',
    examples: ['Slack', 'Microsoft Teams', 'PagerDuty', 'Opsgenie', 'Discord', 'Webex'],
    subcategories: [
      { label: 'ChatOps', description: 'Incident coordination via team messaging platforms' },
      { label: 'On-Call / Paging', description: 'Escalation and on-call rotation management' },
      { label: 'Notifications', description: 'Multi-channel alerting (SMS, email, push)' },
    ],
    dataIn: ['Alerts from Case Management', 'Status updates from SIEM'],
    dataOut: ['Acknowledgements to Case Management', 'Escalations to IAM'],
    useCases: [
      'Send real-time alerts to SOC channel on critical incidents',
      'Page on-call analyst via PagerDuty integration',
      'Create war-room channel for major incidents',
      'Post daily summary of open cases',
    ],
  },
  {
    id: 'email',
    label: 'Email',
    description: 'Email security, phishing analysis, and automated mailbox triage.',
    icon: React.createElement(Mail, { size: 22 }),
    color: '--infra-email',
    examples: ['Microsoft 365', 'Google Workspace', 'Sublime Security', 'Abnormal Security', 'Proofpoint', 'Mimecast'],
    subcategories: [
      { label: 'Email Gateway', description: 'Inbound/outbound filtering, spam, and malware blocking' },
      { label: 'Phishing Protection', description: 'AI-driven phishing detection and user reporting' },
      { label: 'DLP', description: 'Data Loss Prevention for email-borne sensitive data' },
    ],
    dataIn: ['Threat signatures from Threat Intel', 'User reports from Communication'],
    dataOut: ['Phishing IOCs to Threat Intel', 'Suspicious emails to Case Management', 'Headers to AI/LLM'],
    useCases: [
      'Auto-analyze reported phishing emails',
      'Extract and enrich URLs/attachments from suspicious mail',
      'Quarantine emails matching known IOC patterns',
      'Send disposition feedback to reporters',
    ],
  },
  {
    id: 'threat_intel',
    label: 'Threat Intel',
    description: 'Threat intelligence platforms for IOC enrichment, feed management, and adversary tracking.',
    icon: React.createElement(Crosshair, { size: 22 }),
    color: '--infra-threat-intel',
    examples: ['MISP', 'VirusTotal', 'AlienVault OTX', 'Recorded Future', 'Mandiant', 'AbuseIPDB'],
    subcategories: [
      { label: 'IOC Enrichment', description: 'Automated lookups for IPs, domains, hashes, and URLs' },
      { label: 'Feed Management', description: 'Curation and distribution of threat intelligence feeds' },
      { label: 'Adversary Tracking', description: 'Campaign and threat actor attribution (MITRE ATT&CK)' },
    ],
    dataIn: ['IOCs from Email', 'Observables from Case Management', 'Hashes from EDR'],
    dataOut: ['Enrichment to Case Management', 'IOC feeds to Network/EDR', 'Context to AI/LLM'],
    useCases: [
      'Auto-enrich IPs, domains, and hashes in cases',
      'Maintain and distribute curated IOC watchlists',
      'Score threat severity using multiple intel sources',
      'Map indicators to MITRE ATT&CK techniques',
    ],
  },
  {
    id: 'asset_management',
    label: 'Assets',
    description: 'Endpoints, cloud resources, and CMDB inventory with vulnerability and configuration context for incident response.',
    icon: React.createElement(HardDrive, { size: 22 }),
    color: '--infra-asset-mgmt',
    examples: ['ServiceNow CMDB', 'Qualys', 'Tenable', 'Snipe-IT', 'Rapid7', 'Lansweeper'],
    subcategories: [
      { label: 'CMDB', description: 'Configuration Management Database for asset inventory' },
      { label: 'Vulnerability Management', description: 'Scanning, prioritization, and remediation tracking' },
      { label: 'Software Inventory', description: 'Tracking installed software and license compliance' },
    ],
    dataIn: ['Scan results from EDR', 'Vulnerability feeds from Threat Intel'],
    dataOut: ['Asset context to Case Management', 'Owner info to IAM', 'Risk scores to SIEM'],
    useCases: [
      'Auto-lookup asset owner and criticality during triage',
      'Correlate vulnerabilities with active threats',
      'Prioritize patching based on exploit availability',
      'Provide asset inventory for compliance reporting',
    ],
  },
  {
    id: 'iam',
    label: 'IAM',
    description: 'Identity & Access Management — user lifecycle, authentication, and privilege control.',
    icon: React.createElement(KeyRound, { size: 22 }),
    color: '--infra-iam',
    examples: ['Okta', 'Azure AD', 'CyberArk', 'JumpCloud', 'Duo', 'OneLogin'],
    subcategories: [
      { label: 'SSO / Federation', description: 'Single Sign-On and identity federation across services' },
      { label: 'PAM', description: 'Privileged Access Management for elevated credentials and sessions' },
      { label: 'MFA', description: 'Multi-Factor Authentication enforcement and management' },
      { label: 'GRC', description: 'Governance, Risk & Compliance — policy and audit management' },
    ],
    dataIn: ['Disable requests from Case Management', 'Risk signals from SIEM'],
    dataOut: ['Auth logs to SIEM', 'User context to Case Management', 'Session data to AI/LLM'],
    useCases: [
      'Auto-disable compromised user accounts',
      'Force MFA re-enrollment after credential breach',
      'Revoke sessions for users flagged by AI anomaly detection',
      'Provide identity context for incident triage',
    ],
  },
  {
    id: 'cloud',
    label: 'Cloud',
    description: 'Cloud providers with bundled security services — logging, IAM, networking, and compute.',
    icon: React.createElement(Cloud, { size: 22 }),
    color: '--infra-cloud',
    examples: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Oracle Cloud', 'DigitalOcean', 'Linode'],
    subcategories: [
      { label: 'CSPM', description: 'Cloud Security Posture Management — misconfig detection' },
      { label: 'CWPP', description: 'Cloud Workload Protection for containers and serverless' },
      { label: 'Cloud IAM', description: 'Cloud-native identity, roles, and permission policies' },
      { label: 'DevSecOps', description: 'CI/CD security scanning, IaC checks, and code analysis' },
    ],
    dataIn: ['Detection rules from SIEM', 'IOC feeds from Threat Intel', 'Policy updates from IAM'],
    dataOut: ['CloudTrail/audit logs to SIEM', 'Resource inventory to Assets', 'Identity events to IAM'],
    useCases: [
      'Stream cloud audit logs to SIEM for correlation',
      'Auto-remediate misconfigured resources (e.g. open S3 buckets)',
      'Sync cloud IAM roles and policies with central identity provider',
      'Inventory cloud assets for vulnerability management',
    ],
  },
];

// ── Usecase (data-flow edge) definition ────────────────────────────────────────

export interface Usecase {
  id: string;
  source: string;
  target: string;
  label: string;
  description: string;
  agenticDescription: string;
  phase: FlowPhase;
  tags: string[];
  animated?: boolean;
  /** Label sent to POST /api/v2/workflows/generate */
  automationLabel?: string;
  /** Category sent with the generate call */
  automationCategory?: string;
  /** Onboarding area this usecase belongs to */
  automationArea?: 'automatic_ingestion' | 'forward_updates' | 'threat_intel' | 'notifications' | 'response' | 'correlation' | 'assign_escalate';
  /** Runtime status (filled by API / hook) */
  status?: 'enabled' | 'disabled' | 'misconfigured';
  /** True if this flow requires manual verification (e.g. log forwarding can't be auto-detected) */
  manualVerification?: boolean;
  /** Importance ranking 0–100; 100 = highest priority (most-used). */
  priority?: number;
  /** Optional video URL (YouTube, Vimeo, mp4) showcasing the usecase. */
  video?: string;
  /** Optional blogpost / article URL with deeper context. */
  blogpost?: string;
  /** Optional reference image URL (architecture diagram, screenshot). */
  referenceImage?: string;
  /** Optional custom action — a one-click CTA that overrides the default "create workflow" flow.
   *  Use for usecases best fulfilled by an in-app navigation (e.g. opening /monitors?add_host=true)
   *  rather than generating a Shuffle workflow. */
  customAction?: {
    /** Button label shown on the usecase detail page (e.g. "Add Monitor"). */
    label: string;
    /** In-app route. Use this OR `url`. Internal routes use react-router navigation. */
    href?: string;
    /** External URL. Opens in a new tab. */
    url?: string;
    /** Optional helper text rendered next to the CTA. */
    description?: string;
  };
}

// ── API usecase types (from /api/v1/workflows/usecases) ────────────────────────

export interface ApiUsecaseItem {
  name: string;
  items?: Record<string, any>;
}

export interface ApiUsecase {
  name: string;
  priority?: number;
  type: string;       // source category label/id (e.g. "SIEM", "siem")
  last?: string;      // legacy target category (e.g. "cases")
  destination?: string; // exported JSON target label (e.g. "Case Management")
  source_id?: string;
  target_id?: string;
  disabled?: boolean;
  tags?: string[];
  agentic_description?: string;
  automation_label?: string;
  automation_category?: string;
  automation_area?: string;
  manual_verification?: boolean;
  custom_action?: {
    label: string;
    href?: string;
    url?: string;
    description?: string;
  };
  description?: string;
  video?: string;
  blogpost?: string;
  reference_image?: string;
  items?: ApiUsecaseItem;
}

export interface ApiUsecaseCategory {
  name: string;       // e.g. "1. Collect", "2. Enrich"
  color?: string;
  list: ApiUsecase[];
}

/**
 * Map API category names to our FlowPhase.
 * The API uses numbered prefixes like "1. Collect".
 */
export function apiCategoryToPhase(categoryName: string): FlowPhase {
  const lower = categoryName.toLowerCase();
  if (lower.includes('collect') || lower.includes('ingest') || lower.includes('1.')) return 'ingest';
  if (lower.includes('respond') || lower.includes('response') || lower.includes('action') || lower.includes('3.')) return 'response';
  // Default: correlation/enrich
  return 'correlation';
}

/**
 * Normalize API type/last fields to our category IDs.
 * The API may use "cases" while we use "case_management", etc.
 */
export function normalizeCategory(apiCategory: string): string {
  if (!apiCategory) return '';
  const map: Record<string, string> = {
    cases: 'case_management',
    case: 'case_management',
    'case management': 'case_management',
    case_management: 'case_management',
    communication: 'communication',
    chat: 'communication',
    siem: 'siem',
    edr: 'edr',
    endpoint: 'edr',
    email: 'email',
    network: 'network',
    firewall: 'network',
    threat_intel: 'threat_intel',
    'threat intel': 'threat_intel',
    intel: 'threat_intel',
    iam: 'iam',
    identity: 'iam',
    cloud: 'cloud',
    asset_management: 'asset_management',
    'asset management': 'asset_management',
    assets: 'asset_management',
    cmdb: 'asset_management',
  };
  return map[apiCategory.toLowerCase()] || apiCategory.toLowerCase();
}

// ── Default usecases (migrated from InfrastructurePage DATA_FLOWS) ─────────────

export const DEFAULT_USECASES: Usecase[] = [
  {
    id: 'siem_case_management_1', phase: 'ingest', source: 'siem', target: 'case_management',
    label: 'SIEM alerts', animated: true,
    tags: ['Alert', 'Detection', 'Logs'],
    description: 'SIEM-generated alerts are the primary trigger for new cases. Automating this flow ensures no critical detection goes uninvestigated and reduces mean time to respond (MTTR).',
    agenticDescription: 'An agent triages incoming alerts, deduplicates them against open cases, scores severity using threat intel context, and auto-assigns to the right analyst based on type and on-call schedule.',
    automationLabel: 'Ingest Tickets',
    automationCategory: 'cases',
    automationArea: 'automatic_ingestion',
  },
  {
    id: 'edr_case_management_1', phase: 'ingest', source: 'edr', target: 'case_management',
    label: 'EDR alerts', animated: true,
    tags: ['Alert', 'Detection'],
    description: 'EDR-generated alerts (malware detections, suspicious process executions, ransomware behavior) are forwarded directly to Case Management to open or update incidents, bypassing the SIEM for faster response on high-confidence endpoint detections.',
    agenticDescription: 'An agent evaluates EDR alert confidence, correlates with related endpoint events, determines if it belongs to an existing case, and either updates the case or creates a new one with a pre-filled investigation timeline.',
    automationLabel: 'Ingest Tickets',
    automationCategory: 'cases',
    automationArea: 'automatic_ingestion',
  },
  {
    id: 'email_case_management_1', phase: 'ingest', source: 'email', target: 'case_management',
    label: 'Email reports', animated: true,
    tags: ['Alert', 'Logs'],
    description: 'User-reported phishing emails create cases for triage. Automating intake with deduplication and auto-enrichment drastically cuts analyst workload.',
    agenticDescription: 'An agent parses reported emails, extracts and enriches all IOCs, determines phishing verdict using threat intel, and auto-closes low-risk reports while escalating confirmed campaigns.',
    automationLabel: 'Ingest Tickets',
    automationCategory: 'cases',
    automationArea: 'automatic_ingestion',
  },
  {
    id: 'network_siem_1', phase: 'ingest', source: 'network', target: 'siem',
    label: 'Flow logs',
    tags: ['Logs', 'Detection'],
    manualVerification: true,
    description: 'Network flow logs (NetFlow, DNS, proxy) give the SIEM east-west and north-south visibility. Without them, lateral movement and C2 traffic go undetected.',
    agenticDescription: 'An agent monitors ingested flow logs for anomalous patterns (beaconing, port scans, unusual data volumes), generates hypotheses, and creates enriched SIEM alerts with analyst-ready summaries.',
    automationArea: 'automatic_ingestion',
  },
  {
    id: 'edr_siem_1', phase: 'correlation', source: 'edr', target: 'siem',
    label: 'Telemetry',
    tags: ['Logs', 'Detection', 'Correlation'],
    manualVerification: true,
    description: 'Endpoint telemetry (process trees, file hashes, registry changes) enriches SIEM detections with host-level context, enabling accurate correlation rules.',
    agenticDescription: 'An agent cross-references endpoint telemetry with known attack patterns, surfaces hidden process chains, and annotates SIEM events with host risk scores before they reach an analyst.',
    automationArea: 'correlation',
  },
  {
    id: 'iam_siem_1', phase: 'correlation', source: 'iam', target: 'siem',
    label: 'Auth logs',
    tags: ['Logs', 'Detection', 'Correlation'],
    manualVerification: true,
    description: 'Authentication and authorization logs reveal credential abuse, impossible travel, privilege escalation, and brute-force attempts across the identity layer.',
    agenticDescription: 'An agent detects impossible travel, credential stuffing patterns, and privilege escalation attempts in auth logs, then creates SIEM alerts with user risk context and recommended actions.',
    automationArea: 'correlation',
  },
  {
    id: 'threat_intel_case_management_1', phase: 'correlation', source: 'threat_intel', target: 'case_management',
    label: 'Enrichment', animated: true,
    tags: ['Intel', 'Correlation', 'Context'],
    description: 'Threat intelligence enriches cases with reputation scores, malware families, threat actor attribution, and related IOCs — giving analysts immediate context.',
    agenticDescription: 'An agent autonomously enriches all observables in a case, maps findings to MITRE ATT&CK, identifies related campaigns, and updates case severity and recommended playbook based on findings.',
    automationLabel: 'Enable Threat feeds',
    automationCategory: 'cases',
    automationArea: 'threat_intel',
  },
  {
    id: 'threat_intel_network_1', phase: 'response', source: 'threat_intel', target: 'network',
    label: 'IOC feeds',
    tags: ['Intel', 'Response', 'Prevention'],
    description: 'Threat intel feeds pushed to network devices include IPs, domains, URLs, and ASNs for perimeter blocking, as well as MITRE ATT&CK techniques used to inform detection rule tuning on IDS/IPS and NDR sensors. Network controls act at layer 3–7, so indicator types must be network-observable.',
    agenticDescription: 'An agent curates and validates IOC feeds before pushing, deduplicates against existing block rules, removes expired indicators, and maps active techniques to IDS/IPS signatures — ensuring network policy stays accurate without manual review.',
    automationArea: 'threat_intel',
  },
  {
    id: 'threat_intel_edr_1', phase: 'response', source: 'threat_intel', target: 'edr',
    label: 'IOC feeds',
    tags: ['Intel', 'Response', 'Prevention', 'Detection'],
    description: 'Endpoint-targeted IOC feeds include file hashes (MD5/SHA256), process names, registry keys, certificate thumbprints, and parent-child process trees for behavioral blocking. MITRE ATT&CK technique mappings inform custom detection rules. Unlike network devices, EDR can act on host-observable artifacts invisible to the perimeter.',
    agenticDescription: 'An agent validates hash and behavioral indicator accuracy against multiple intel sources, maps techniques to EDR rule coverage gaps, prioritizes by threat severity, and generates a blocking report with rollback instructions.',
    automationArea: 'threat_intel',
  },
  {
    id: 'case_management_communication_1', phase: 'response', source: 'case_management', target: 'communication',
    label: 'Notifications', animated: true,
    tags: ['Response', 'Alert'],
    description: 'Automated notifications keep stakeholders informed of incident status, escalations, and required actions — critical for SLA compliance and coordination.',
    agenticDescription: 'An agent drafts context-aware incident summaries, determines the right audience and channel for each update, and adapts tone (technical vs. executive) based on the recipient.',
    automationLabel: 'Notifications',
    automationCategory: 'cases',
    automationArea: 'notifications',
  },
  {
    id: 'case_management_iam_1', phase: 'response', source: 'case_management', target: 'iam',
    label: 'Disable accounts',
    tags: ['Response', 'Containment'],
    description: 'When a compromised account is identified, automated disablement through IAM stops the attacker from maintaining access while the investigation continues.',
    agenticDescription: 'An agent validates the compromise signal, checks the user\'s business criticality, executes targeted disablement or session revocation, and documents the action with rollback steps in the case.',
    automationArea: 'response',
  },
  {
    id: 'case_management_edr_1', phase: 'response', source: 'case_management', target: 'edr',
    label: 'Containment',
    tags: ['Response', 'Containment'],
    description: 'Network isolation or process killing on compromised endpoints contains the threat, preventing lateral movement while preserving forensic evidence.',
    agenticDescription: 'An agent determines the right containment scope (process, network, host), triggers isolation, collects forensic artifacts autonomously, and creates a detailed timeline for the investigation.',
    automationArea: 'response',
  },
  {
    id: 'asset_management_case_management_1', phase: 'correlation', source: 'asset_management', target: 'case_management',
    label: 'Asset context',
    tags: ['Context', 'Correlation'],
    description: 'Asset context (owner, criticality, business unit, OS) helps analysts prioritize cases and understand blast radius during an incident.',
    agenticDescription: 'An agent automatically fetches asset owner, business criticality, and known vulnerabilities for every observable in a case, recalculates impact score, and suggests prioritization.',
    automationArea: 'correlation',
  },
  {
    id: 'asset_management_case_management_vuln_1', phase: 'correlation', source: 'asset_management', target: 'case_management',
    label: 'Vulnerability Correlation',
    tags: ['Context', 'Correlation', 'Vulnerability'],
    description: 'Correlate known vulnerabilities (CVEs, misconfigurations, missing patches) on affected assets with active incidents — surfacing exploitable weaknesses that elevate risk and guide containment priorities.',
    agenticDescription: 'An agent matches observables and affected hosts in a case against the vulnerability inventory, identifies exploitable CVEs aligned with the attack technique, recalculates incident severity, and recommends remediation or compensating controls.',
    automationArea: 'correlation',
  },
  {
    id: 'email_threat_intel_1', phase: 'correlation', source: 'email', target: 'threat_intel',
    label: 'Phishing IOCs',
    tags: ['Intel', 'Correlation', 'Logs'],
    description: 'Extracting IOCs from phishing emails (sender domains, URLs, attachments) and feeding them into threat intel platforms helps detect broader campaigns.',
    agenticDescription: 'An agent detonates suspicious attachments and URLs in a sandbox, extracts all IOCs, correlates with known campaigns, and auto-publishes confirmed indicators to the threat intel platform.',
    automationArea: 'threat_intel',
  },
  {
    id: 'cloud_siem_1', phase: 'ingest', source: 'cloud', target: 'siem',
    label: 'Audit logs',
    tags: ['Logs', 'Detection'],
    manualVerification: true,
    description: 'Cloud audit logs (CloudTrail, Activity Log, Audit Logs) provide visibility into API calls, configuration changes, and access patterns across cloud environments.',
    agenticDescription: 'An agent detects anomalous API call patterns, privilege escalation, and misconfiguration events in cloud audit logs, then generates prioritized SIEM alerts with remediation context.',
    automationArea: 'automatic_ingestion',
  },
  {
    id: 'cloud_iam_1', phase: 'correlation', source: 'cloud', target: 'iam',
    label: 'Identity events',
    tags: ['Logs', 'Correlation', 'Detection'],
    manualVerification: true,
    description: 'Cloud identity events (role changes, permission grants, federation configs) feed IAM monitoring to detect privilege escalation in cloud environments.',
    agenticDescription: 'An agent tracks excessive permission grants, detects role assumption chains indicating privilege escalation, and triggers automated least-privilege review recommendations in IAM.',
    automationArea: 'correlation',
  },
  {
    id: 'threat_intel_cloud_1', phase: 'correlation', source: 'threat_intel', target: 'cloud',
    label: 'IOC feeds',
    tags: ['Intel', 'Correlation', 'Detection'],
    description: 'Pushing IOC feeds to cloud-native security tools (GuardDuty, Sentinel, SCC) enables detection of known-malicious activity within cloud workloads.',
    agenticDescription: 'An agent maps threat intel IOCs to active cloud workloads, identifies which resources are communicating with known-malicious infrastructure, and auto-creates remediation tasks in cloud security tools.',
    automationArea: 'threat_intel',
  },
  {
    id: 'case_management_cloud_1', phase: 'response', source: 'case_management', target: 'cloud',
    label: 'Cloud response',
    tags: ['Response', 'Containment'],
    description: 'Automated response actions in cloud environments — revoking keys, isolating instances, modifying security groups — contain threats before they spread across cloud infrastructure.',
    agenticDescription: 'An agent validates cloud response actions against blast radius, executes targeted remediation (revoke key, modify SG, snapshot + terminate instance), and logs all changes with rollback instructions.',
    automationArea: 'response',
  },
  {
    id: 'case_management_network_1', phase: 'response', source: 'case_management', target: 'network',
    label: 'Block rules',
    tags: ['Response', 'Prevention', 'Containment'],
    description: 'Pushing firewall block rules from cases to network devices enables immediate perimeter-level containment of malicious IPs, domains, and traffic patterns.',
    agenticDescription: 'An agent validates block rule candidates against allowlists and business-critical services, pushes rules to the right network segments, and auto-expires them with case closure.',
    automationArea: 'response',
  },
  {
    id: 'case_management_email_1', phase: 'response', source: 'case_management', target: 'email',
    label: 'Quarantine',
    tags: ['Response', 'Containment'],
    description: 'Quarantining or purging malicious emails from mailboxes during an active investigation prevents additional users from falling victim to the same campaign.',
    agenticDescription: 'An agent searches all mailboxes for campaign variants, bulk-quarantines matching emails, notifies impacted users with safe-messaging guidance, and reports scope to the case.',
    automationArea: 'response',
  },
  {
    id: 'case_management_cases_forward_1', phase: 'response', source: 'case_management', target: 'case_management',
    label: 'Forward Tickets', animated: true,
    tags: ['Response', 'Sync'],
    description: 'Forward incident updates, status changes, and resolution notes to external ticketing systems, keeping all platforms in sync and ensuring stakeholders on other tools stay informed.',
    agenticDescription: 'An agent detects significant case updates (status changes, new findings, escalations) and pushes structured updates to connected ticketing systems, mapping fields and priorities to each platform\'s schema.',
    automationLabel: 'Forward Tickets',
    automationCategory: 'cases',
    automationArea: 'forward_updates',
  },
  {
    id: 'case_management_assign_escalate_1', phase: 'response', source: 'case_management', target: 'case_management',
    label: 'Assign & Escalate', animated: true,
    tags: ['Response', 'Assignment', 'Escalation'],
    description: 'Automatically assign incoming incidents to the right analyst based on on-call schedules, workload, and expertise. Escalate unacknowledged or aging incidents to the next tier to ensure SLA compliance.',
    agenticDescription: 'An agent evaluates incoming incidents against team schedules, analyst skill sets, and current workload, assigns ownership, and monitors for SLA breaches to trigger automatic escalation to the next responder or management.',
    automationLabel: 'Assign & Escalate',
    automationCategory: 'cases',
    automationArea: 'assign_escalate',
  },
  {
    id: 'case_management_asset_management_monitors_1', phase: 'response', source: 'case_management', target: 'asset_management',
    label: 'Add Monitors', animated: true,
    tags: ['Response', 'Monitoring', 'Endpoint'],
    description: 'Deploy host monitors to endpoints for real-time telemetry collection, compliance checks, and on-demand response action execution. Monitors enable direct interaction with hosts during investigations and continuous visibility into endpoint state.',
    agenticDescription: 'An agent identifies hosts missing monitor coverage, generates the appropriate deployment command for each platform, tracks rollout status, and verifies telemetry is flowing back into the platform after install.',
    automationLabel: 'Add Monitors',
    automationCategory: 'cases',
    automationArea: 'response',
    customAction: {
      label: 'Add Monitor',
      href: '/monitors?add_host=true',
      description: 'Open the monitor deployment dialog to register a new host.',
    },
  },
  {
    id: 'cloud_asset_management_1', phase: 'correlation', source: 'cloud', target: 'asset_management',
    label: 'Resource inventory',
    tags: ['Logs', 'Context'],
    manualVerification: true,
    description: 'Auto-syncing cloud resources into the asset inventory ensures the CMDB stays current, preventing blind spots in vulnerability management and incident response.',
    agenticDescription: 'An agent continuously reconciles cloud inventory with the CMDB, flags newly exposed resources, identifies shadow IT, and marks assets with missing security controls for immediate action.',
    automationArea: 'correlation',
  },
  {
    id: 'asset_management_siem_1', phase: 'ingest', source: 'asset_management', target: 'siem',
    label: 'Endpoint logs',
    tags: ['Logs', 'Detection', 'Alert'],
    manualVerification: true,
    description: 'Forwarding endpoint telemetry and asset logs (process events, file changes, network connections, vulnerability scan results) to the SIEM enriches correlation and enables asset-aware detections.',
    agenticDescription: 'An agent normalises endpoint telemetry from diverse agents, tags each event with asset criticality and owner from the CMDB, and forwards structured logs to the SIEM with context that tunes alert priority.',
    automationArea: 'automatic_ingestion',
  },
];

// ── Category-to-app keyword mapping ────────────────────────────────────────────

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  case_management: ['cases', 'case management', 'ticketing', 'itsm', 'service desk', 'thehive', 'servicenow', 'jira'],
  siem: ['siem', 'splunk', 'sentinel', 'elastic', 'qradar', 'log management', 'wazuh', 'chronicle'],
  network: ['network', 'firewall', 'palo alto', 'fortinet', 'suricata', 'zeek', 'ids', 'ips', 'ndr'],
  edr: ['edr', 'endpoint', 'crowdstrike', 'sentinelone', 'defender', 'carbon black', 'xdr'],
  communication: ['communication', 'chat', 'messaging', 'slack', 'teams', 'pagerduty', 'opsgenie', 'notification'],
  email: ['email', 'mail', 'phishing', 'microsoft 365', 'google workspace', 'exchange', 'gmail', 'smtp', 'outlook', 'office365', 'imap', 'proofpoint', 'mimecast', 'microsoft_graph', 'microsoft graph'],
  threat_intel: ['threat intel', 'intelligence', 'misp', 'virustotal', 'otx', 'recorded future', 'ioc', 'abuse'],
  asset_management: ['asset', 'cmdb', 'inventory', 'qualys', 'tenable', 'vulnerability', 'snipe'],
  iam: ['iam', 'identity', 'access', 'okta', 'azure ad', 'cyberark', 'jumpcloud', 'ldap', 'active directory'],
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'google cloud', 'oracle cloud', 'digitalocean', 'cloud provider'],
};

export function matchAppToCategory(appName: string, appCategories: string[]): string | null {
  const searchText = [appName, ...appCategories].join(' ').toLowerCase();
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => searchText.includes(kw))) return catId;
  }
  return null;
}

// ── Automation-area helpers ────────────────────────────────────────────────────

/**
 * Get all workflow labels for a given automation area.
 * Derived from the usecase registry instead of a separate hardcoded map.
 */
export function getAutomationLabels(area: string, usecases: Usecase[] = DEFAULT_USECASES): string[] {
  const labels = new Set<string>();
  for (const uc of usecases) {
    if (uc.automationArea === area && uc.automationLabel) {
      labels.add(uc.automationLabel);
    }
  }
  // Include webhook variant for ingestion
  if (area === 'automatic_ingestion') {
    for (const l of [...labels]) {
      labels.add(`${l}_webhook`);
    }
  }
  return [...labels];
}

/**
 * Get usecases filtered by automation area.
 */
export function getUsecasesByArea(area: string, usecases: Usecase[] = DEFAULT_USECASES): Usecase[] {
  return usecases.filter(uc => uc.automationArea === area);
}

/**
 * Get usecases filtered by phase.
 */
export function getUsecasesByPhase(phase: FlowPhase, usecases: Usecase[] = DEFAULT_USECASES): Usecase[] {
  return usecases.filter(uc => uc.phase === phase);
}

// ── Exportable JSON shape ─────────────────────────────────────────────────────
//
// A flat, portable representation of the usecase registry shaped as:
//   [{ name, description, color, list: [{ name, type, destination, running, disabled, ... }] }]
//
// Used by the "Export JSON" action on the Automations page. The same shape can
// also be used to seed/replace usecases from an external file.

export interface UsecaseJsonEntry {
  /** Display label (e.g. "SIEM alerts") */
  name: string;
  /** Source category label (e.g. "SIEM") */
  type: string;
  /** Target category label (e.g. "Case Management") */
  destination: string;
  /** True when an underlying workflow exists / is enabled */
  running: boolean;
  /** True when the usecase is hidden from regular users (no `animated` flag) */
  disabled: boolean;
  /** Stable ID — needed to round-trip back into the registry */
  id: string;
  /** Source / target raw category IDs (for re-import) */
  source_id: string;
  target_id: string;
  /** Free-form tags (Alert, Detection, Logs, …) */
  tags: string[];
  description: string;
  agentic_description: string;
  /** Workflow label sent to /api/v2/workflows/generate (when toggleable) */
  automation_label?: string;
  automation_category?: string;
  automation_area?: Usecase['automationArea'];
  /** Manual verification required (e.g. log forwarding) */
  manual_verification?: boolean;
  /** Importance ranking 0–100; 100 = highest priority. */
  priority?: number;
  /** Optional video URL. */
  video?: string;
  /** Optional blogpost / article URL. */
  blogpost?: string;
  /** Optional reference image URL. */
  reference_image?: string;
  /** Optional custom CTA — overrides the default workflow-generation flow. */
  custom_action?: {
    label: string;
    href?: string;
    url?: string;
    description?: string;
  };
}

export interface UsecaseCategoryJson {
  /** Phase label (e.g. "Ingest & Tool Setup") */
  name: string;
  description: string;
  /** Resolved CSS color string (HSL var reference, e.g. "hsl(var(--infra-siem))") */
  color: string;
  /** Phase ID — kept for round-trip imports */
  phase: FlowPhase;
  /** Phase order (1, 2, 3) */
  step: number;
  list: UsecaseJsonEntry[];
}

const labelFor = (categoryId: string): string =>
  TOOL_CATEGORIES.find(c => c.id === categoryId)?.label || categoryId;

/**
 * Convert the in-memory usecase registry into the portable JSON shape.
 *
 * @param usecases       The current (possibly API-enriched) usecase list.
 * @param enabledLabels  Optional set of `automationLabel`s known to have a
 *                       running workflow — used to populate `running: true`.
 */
/** Hardcoded hex equivalents of the FLOW_PHASES CSS variable colors,
 *  used in the exported JSON so consumers don't need our theme tokens. */
const PHASE_HEX_BY_ID: Record<FlowPhase, string> = {
  ingest: '#E7B008',      // --infra-siem        (45 93% 47%)
  response: '#EF4444',    // --infra-edr         (0 84% 60%)
  correlation: '#1AC4E6', // --infra-threat-intel (190 80% 50%)
};

export function getUsecasesJson(
  usecases: Usecase[] = DEFAULT_USECASES,
  enabledLabels?: Set<string>,
): UsecaseCategoryJson[] {
  return FLOW_PHASES.map(phase => ({
    name: phase.label,
    description: phase.subtitle,
    color: PHASE_HEX_BY_ID[phase.id],
    phase: phase.id,
    step: phase.step,
    list: usecases
      .filter(uc => uc.phase === phase.id)
      .map<UsecaseJsonEntry>(uc => ({
        name: uc.label,
        type: labelFor(uc.source),
        destination: labelFor(uc.target),
        running: !!(uc.automationLabel && enabledLabels?.has(uc.automationLabel)),
        disabled: uc.animated !== true,
        id: uc.id,
        source_id: uc.source,
        target_id: uc.target,
        tags: uc.tags,
        description: uc.description,
        agentic_description: uc.agenticDescription,
        ...(uc.automationLabel ? { automation_label: uc.automationLabel } : {}),
        ...(uc.automationCategory ? { automation_category: uc.automationCategory } : {}),
        ...(uc.automationArea ? { automation_area: uc.automationArea } : {}),
        ...(uc.manualVerification ? { manual_verification: true } : {}),
        ...(typeof uc.priority === 'number' ? { priority: uc.priority } : {}),
        ...(uc.video ? { video: uc.video } : {}),
        ...(uc.blogpost ? { blogpost: uc.blogpost } : {}),
        ...(uc.referenceImage ? { reference_image: uc.referenceImage } : {}),
        ...(uc.customAction ? { custom_action: uc.customAction } : {}),
      })),
  }));
}

// ============================================================================
// Inlined: API config
// ============================================================================
// Resolve the Shuffle backend base URL.
// Order:
//  1. VITE_SHUFFLE_API_URL env override
//  2. Lovable preview hosts -> tunnel.schemaless.org (dev backend with CORS+cookies)
//  3. window.location.origin (self-hosted: nginx proxies /api/* to the backend)
//  4. https://shuffler.io (SSR / fallback)
//
// NOTE: The host app can override this entirely by passing the `globalUrl`
// prop on <UsecasesPage />. This resolver only kicks in for standalone use.
const DEV_BACKEND = 'https://tunnel.schemaless.org';
const PROD_BACKEND = 'https://shuffler.io';

const resolveApiBaseUrl = () => {
  const envUrl =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SHUFFLE_API_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLovablePreview =
      host.includes('lovableproject.com') ||
      host.includes('lovable.app') ||
      host.includes('id-preview--');
    if (isLovablePreview) return DEV_BACKEND;
    return window.location.origin;
  }
  return PROD_BACKEND;
};

const DEFAULT_API_BASE_URL: string = resolveApiBaseUrl();

const getStoredApiKey = (): string | null => {
  try { return typeof window !== 'undefined' ? window.localStorage.getItem('shuffle_api_key') : null; }
  catch { return null; }
};

// ============================================================================
// Runtime config context — lets host apps inject `globalUrl` / `userdata` /
// `isLoggedIn` overrides via props on <UsecasesPage />. When no provider is
// present (standalone usage), defaults reproduce the previous behavior:
// API base resolved from env/host, auth via `shuffle_api_key` localStorage,
// and authentication probed via `/api/v1/getinfo`.
// ============================================================================
/**
 * Raw response body from `GET /api/v1/getinfo`. Host apps typically already
 * have this loaded and pass it down as `userdata`.
 */
export interface UsecasesUserData {
  success?: boolean;
  id?: string;
  username?: string;
  support?: boolean;
  active_org?: { id?: string; name?: string; [key: string]: any };
  orgs?: any[];
  region_url?: string;
  app_execution_limit?: number;
  app_execution_usage?: number;
  /** Optional API key — if present it's used as bearer token for requests. */
  api_key?: string;
  apikey?: string;
  [key: string]: any;
}

interface UsecasesPageConfig {
  baseUrl: string;
  /** Built from external `userdata.api_key` if provided, else from localStorage. */
  authHeader: () => Record<string, string>;
  /** When true, skip the internal getinfo probe and trust `externalUserInfo`. */
  hasExternalAuth: boolean;
  externalUserInfo: UsecasesUserData | null;
  externalIsAuthenticated: boolean;
  /** Mirrors the host app's `isLoaded` flag — currently informational. */
  isLoaded: boolean;
}

const DEFAULT_CONFIG: UsecasesPageConfig = {
  baseUrl: DEFAULT_API_BASE_URL,
  authHeader: () => {
    const key = getStoredApiKey();
    return key ? { Authorization: `Bearer ${key}` } : {};
  },
  hasExternalAuth: false,
  externalUserInfo: null,
  externalIsAuthenticated: false,
  isLoaded: true,
};

const UsecasesPageConfigContext = React.createContext<UsecasesPageConfig>(DEFAULT_CONFIG);

const useUsecasesConfig = () => React.useContext(UsecasesPageConfigContext);

// ============================================================================
// Scoped design tokens — injected once into <head> the first time the page
// mounts. Everything inside `.shuffle-usecases-scope` resolves the HSL
// variables this file relies on (background, card, border, primary, infra-*),
// so the page renders identically regardless of the host app's CSS.
// Toggle dark mode by adding `class="dark"` anywhere up the tree.
// ============================================================================
const SCOPE_CLASS = 'shuffle-usecases-scope';
const STYLE_TAG_ID = 'shuffle-usecases-scope-style';

const SCOPED_CSS = `
.${SCOPE_CLASS} {
  /* Light theme defaults */
  --background: 0 0% 98%;
  --foreground: 0 0% 9%;
  --card: 0 0% 100%;
  --muted-foreground: 0 0% 45%;
  --border: 0 0% 89%;

  --primary: 24 100% 50%;
  --primary-foreground: 0 0% 100%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;

  --infra-case-mgmt: 24 90% 55%;
  --infra-siem: 45 93% 47%;
  --infra-network: 210 100% 56%;
  --infra-edr: 0 84% 60%;
  --infra-communication: 142 71% 45%;
  --infra-email: 280 70% 60%;
  --infra-threat-intel: 190 80% 50%;
  --infra-asset-mgmt: 25 95% 53%;
  --infra-iam: 330 75% 55%;
  --infra-cloud: 200 75% 50%;

  /* Severity / status tokens (used for enabled/active indicators) */
  --severity-low: 142 71% 45%;
  --severity-medium: 45 93% 47%;
  --severity-high: 25 95% 53%;
  --severity-critical: 0 84% 60%;
  --severity-info: 210 100% 56%;

  /* Radius — used by MUI Card via the design tokens */
  --radius: 8px;

  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
}

/* MUI Card / Paper border-radius fallback for hosts that don't provide our MUI theme.
 * MUI's theme.shape.borderRadius drives outlined Cards; without our ThemeProvider
 * the cards render with sharp corners. Force the radius here so it matches in
 * standalone embedding too. */
.${SCOPE_CLASS} .MuiCard-root,
.${SCOPE_CLASS} .MuiPaper-rounded {
  border-radius: 8px;
}
.${SCOPE_CLASS} .MuiButtonBase-root.MuiCardActionArea-root {
  border-radius: inherit;
}

/* Dark theme rules.
 * Applies when the scope itself has .dark (forced via theme=dark), OR when an
 * ancestor has .dark AND the scope was not forced to .light. The :not(.light)
 * guard lets theme=light override an ambient .dark host. */
.${SCOPE_CLASS}.dark,
.dark .${SCOPE_CLASS}:not(.light) {
  --background: 0 0% 10%;
  --foreground: 0 0% 100%;
  --card: 0 0% 13%;
  --muted-foreground: 0 0% 50%;
  --border: 0 0% 20%;
}
`;

function useInjectScopedStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_TAG_ID)) return;
    const tag = document.createElement('style');
    tag.id = STYLE_TAG_ID;
    tag.textContent = SCOPED_CSS;
    document.head.appendChild(tag);
    // Intentionally never removed — page may unmount/remount; styles stay cheap.
  }, []);
}


/** Hook returning `apiUrl` and `authHeader` bound to the active config. */
function useApi() {
  const cfg = useUsecasesConfig();
  return React.useMemo(
    () => ({
      apiUrl: (endpoint: string) => `${cfg.baseUrl}${endpoint}`,
      authHeader: cfg.authHeader,
    }),
    [cfg.baseUrl, cfg.authHeader],
  );
}

// ============================================================================
// Inlined: minimal toast (was `sonner`)
// ============================================================================
const toast = {
  success: (msg: string, _opts?: { duration?: number }) => {
    if (typeof window !== 'undefined') console.info('[toast]', msg);
  },
  error: (msg: string, _opts?: { duration?: number }) => {
    if (typeof window !== 'undefined') console.error('[toast]', msg);
  },
};

// ============================================================================
// Inlined: page title helper
// ============================================================================
function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}

// ============================================================================
// Inlined: auth state query
// ============================================================================
interface OrgInterest {
  active?: boolean;
  name?: string;
  type?: string;
  [key: string]: any;
}
interface UserInfoLite {
  id?: string;
  username?: string;
  support?: boolean;
  interests?: OrgInterest[];
}
function useAuthLite() {
  const cfg = useUsecasesConfig();
  const { apiUrl, authHeader } = useApi();
  const [state, setState] = useState<{ userInfo: UserInfoLite | null; isAuthenticated: boolean }>({
    userInfo: null,
    isAuthenticated: false,
  });
  const refetch = React.useCallback(async () => {
    if (cfg.hasExternalAuth) return;
    try {
      const res = await fetch(apiUrl('/api/v1/getinfo'), {
        credentials: 'include',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const body = await res.json();
      if (body?.success !== true) return;
      setState({
        userInfo: {
          id: body.id,
          username: body.username,
          support: body.support === true,
          interests: Array.isArray(body.interests) ? body.interests : [],
        },
        isAuthenticated: true,
      });
    } catch {
      /* keep current */
    }
  }, [cfg.hasExternalAuth, apiUrl, authHeader]);
  useEffect(() => {
    // External host app provided auth — trust it, skip the getinfo probe.
    if (cfg.hasExternalAuth) {
      const ext = cfg.externalUserInfo as (UsecasesUserData & { interests?: OrgInterest[] }) | null;
      setState({
        userInfo: ext
          ? {
              id: ext.id,
              username: ext.username,
              support: ext.support === true,
              interests: Array.isArray(ext.interests) ? ext.interests : [],
            }
          : null,
        isAuthenticated: cfg.externalIsAuthenticated,
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/getinfo'), {
          credentials: 'include',
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (body?.success !== true || cancelled) return;
        setState({
          userInfo: {
            id: body.id,
            username: body.username,
            support: body.support === true,
            interests: Array.isArray(body.interests) ? body.interests : [],
          },
          isAuthenticated: true,
        });
      } catch {
        /* keep defaults */
      }
    })();
    return () => { cancelled = true; };
  }, [cfg.hasExternalAuth, cfg.externalIsAuthenticated, cfg.externalUserInfo, apiUrl, authHeader]);
  return { ...state, refetch };
}

// ============================================================================
// Inlined: workflows query
// ============================================================================
interface WorkflowSummary {
  id: string;
  name: string;
  tags?: string[];
  [key: string]: any;
}
function useWorkflowsLite() {
  const { apiUrl, authHeader } = useApi();
  const [data, setData] = useState<WorkflowSummary[]>([]);
  const fetchOnce = React.useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/v1/workflows'), {
        credentials: 'include',
        headers: { ...authHeader() },
      });
      if (!res.ok) return;
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body.workflows || []);
      setData(list);
    } catch {
      /* keep current */
    }
  }, [apiUrl, authHeader]);
  useEffect(() => { fetchOnce(); }, [fetchOnce]);
  return { data, refetch: fetchOnce };
}

// ============================================================================
// Inlined: usecases query
// ============================================================================
type DriftType = 'api_only' | 'local_only' | 'phase_mismatch' | 'description_added';
export interface UsecaseDrift {
  usecaseId: string;
  drifts: DriftType[];
  apiUsecase?: ApiUsecase;
  apiCategory?: string;
  localValue?: Usecase;
}

const ROUTE_ALIASES: Record<string, string[]> = {
  communication: ['email'],
  email: ['communication'],
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'usecase';

const getApiSource = (u: ApiUsecase) => normalizeCategory(u.source_id || u.type);
const getApiTarget = (u: ApiUsecase) =>
  normalizeCategory(u.target_id || u.last || u.destination || '');

const buildApiOnlyId = (u: ApiUsecase) =>
  `api_${getApiSource(u)}_${getApiTarget(u)}_${slugify(u.name)}`;

const LOCAL_ROUTE_MAP = (() => {
  const map = new Map<string, Usecase[]>();
  for (const uc of DEFAULT_USECASES) {
    const key = `${uc.source}→${uc.target}`;
    const existing = map.get(key) || [];
    existing.push(uc);
    map.set(key, existing);
  }
  return map;
})();

function getMatchingLocal(api: ApiUsecase, matched: Set<string>): Usecase | undefined {
  const candidates = [getApiSource(api), ...(ROUTE_ALIASES[getApiSource(api)] || [])];
  for (const src of candidates) {
    const locals = LOCAL_ROUTE_MAP.get(`${src}→${getApiTarget(api)}`) || [];
    const unmatched = locals.find((l) => !matched.has(l.id));
    if (unmatched) return unmatched;
  }
  return undefined;
}

function mapApiToFrontend(cat: ApiUsecaseCategory, api: ApiUsecase, local?: Usecase): Usecase {
  return {
    id: local?.id || buildApiOnlyId(api),
    source: getApiSource(api),
    target: getApiTarget(api),
    label: api.name || local?.label || 'Untitled usecase',
    description: api.description || local?.description || '',
    agenticDescription: local?.agenticDescription || api.agentic_description || api.description || '',
    phase: apiCategoryToPhase(cat.name),
    tags: api.tags || local?.tags || [],
    animated: typeof api.disabled === 'boolean' ? !api.disabled : (local ? local.animated : true),
    automationLabel: api.automation_label || local?.automationLabel,
    automationCategory: api.automation_category || local?.automationCategory,
    automationArea: (api.automation_area as Usecase['automationArea'] | undefined) || local?.automationArea,
    status: local?.status,
    manualVerification: typeof api.manual_verification === 'boolean' ? api.manual_verification : local?.manualVerification,
    priority: typeof api.priority === 'number' ? api.priority : local?.priority,
    video: api.video || local?.video,
    blogpost: api.blogpost || local?.blogpost,
    referenceImage: api.reference_image || local?.referenceImage,
    customAction: api.custom_action || local?.customAction,
  };
}

function buildBackendUsecases(cats: ApiUsecaseCategory[]) {
  const matched = new Set<string>();
  const usecases: Usecase[] = [];
  const drifts: UsecaseDrift[] = [];
  for (const cat of cats) {
    for (const api of cat.list || []) {
      if (!getApiSource(api) || !getApiTarget(api)) continue;
      const local = getMatchingLocal(api, matched);
      if (local) matched.add(local.id);
      const mapped = mapApiToFrontend(cat, api, local);
      const driftTypes: DriftType[] = [];
      if (!local) driftTypes.push('api_only');
      else {
        if (mapped.phase !== local.phase) driftTypes.push('phase_mismatch');
        if (api.description && !local.description) driftTypes.push('description_added');
      }
      usecases.push(mapped);
      drifts.push({ usecaseId: mapped.id, drifts: driftTypes, apiUsecase: api, apiCategory: cat.name, ...(local ? { localValue: local } : {}) });
    }
  }
  for (const local of DEFAULT_USECASES) {
    if (matched.has(local.id)) continue;
    drifts.push({ usecaseId: local.id, drifts: ['local_only'], localValue: local });
  }
  return { usecases, drifts };
}

function useUsecasesLite() {
  const [data, setData] = useState<{
    usecases: Usecase[];
    apiCategories: ApiUsecaseCategory[];
    drifts: UsecaseDrift[];
  }>({ usecases: DEFAULT_USECASES, apiCategories: [], drifts: [] });

  const { apiUrl, authHeader } = useApi();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/workflows/usecases'), {
          credentials: 'include',
          headers: { ...authHeader() },
        });
        if (!res.ok) return;
        const body = await res.json();
        const cats: ApiUsecaseCategory[] = Array.isArray(body) ? body : [];
        if (cancelled || cats.length === 0) return;
        const built = buildBackendUsecases(cats);
        setData({ usecases: built.usecases, apiCategories: cats, drifts: built.drifts });
      } catch {
        /* keep defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const driftMap = useMemo(() => {
    const m = new Map<string, UsecaseDrift>();
    for (const d of data.drifts) m.set(d.usecaseId, d);
    return m;
  }, [data.drifts]);

  return {
    usecases: data.usecases,
    apiLoaded: data.apiCategories.length > 0,
    getDrift: (id: string) => driftMap.get(id),
  };
}

// ============================================================================
// Helpers
// ============================================================================
const categoryLabel = (id: string) =>
  TOOL_CATEGORIES.find((c) => c.id === id)?.label || id;

const phaseIcon = (phase: FlowPhase) => {
  if (phase === 'ingest') return <Download size={14} />;
  if (phase === 'response') return <Zap size={14} />;
  return <Activity size={14} />;
};

const getToolCategoryMeta = (categoryId: string): { color: string; icon: React.ReactNode; label: string } | null => {
  const cat = TOOL_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return null;
  return { color: cat.color, icon: cat.icon, label: cat.label };
};

interface IntegrationItem {
  id: string;
  name: string;
  icon: string;
  /** Validated (tested) — highest priority */
  validated: boolean;
  /** Active auth entry */
  active: boolean;
}

function IntegrationStatusLite({ filterApps, singleLine = false }: { filterApps?: string[]; singleLine?: boolean }) {
  const { apiUrl, authHeader } = useApi();
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...authHeader() },
        });

        const items = new Map<string, IntegrationItem>();

        if (res.ok) {
          const authData = await res.json();
          const authList = Array.isArray(authData) ? authData : (authData?.data || []);
          for (const entry of Array.isArray(authList) ? authList : []) {
            const app = entry?.app;
            if (!app?.name) continue;
            const key = String(app.name).toLowerCase();
            const validated = entry?.validation?.valid === true;
            const active = entry?.active === true;
            const existing = items.get(key);
            if (!existing) {
              items.set(key, {
                id: app.id || key,
                name: app.name,
                icon: app.large_image || app.image || '',
                validated,
                active,
              });
            } else {
              existing.validated = existing.validated || validated;
              existing.active = existing.active || active;
              if (!existing.icon && (app.large_image || app.image)) {
                existing.icon = app.large_image || app.image;
              }
            }
          }
        }

        const sorted = Array.from(items.values()).sort((a, b) => {
          if (a.validated !== b.validated) return a.validated ? -1 : 1;
          if (a.active !== b.active) return a.active ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        if (!cancelled) setIntegrations(sorted);
      } catch {
        /* keep [] */
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = filterApps?.length
    ? integrations.filter((item) => filterApps.some((name) => name.toLowerCase() === item.name.toLowerCase()))
    : integrations;

  if (isLoading) {
    return <CircularProgress size={20} sx={{ color: 'hsl(var(--muted-foreground))' }} />;
  }

  if (visible.length === 0) {
    return (
      <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', px: 1, py: 0.75 }}>
        No apps selected
      </Typography>
    );
  }

  const renderIcon = (integration: IntegrationItem) => {
    // Self-contained styles — explicit hex colors so they render identically
    // in the standalone build (host CSS may not define --severity-* tokens),
    // and explicit borderRadius/objectFit on the image so host CSS resets
    // can't override them.
    // - validated  → green (#22c55e)
    // - active     → amber (#f59e0b)
    // - otherwise  → muted, slightly faded
    const GREEN = '#22c55e';
    const AMBER = '#f59e0b';
    const dotColor = integration.validated ? GREEN : integration.active ? AMBER : null;
    const borderColor = integration.validated
      ? 'rgba(34, 197, 94, 0.45)'
      : integration.active
        ? 'rgba(245, 158, 11, 0.45)'
        : 'hsl(var(--border))';
    const bgColor = integration.validated
      ? 'rgba(34, 197, 94, 0.10)'
      : integration.active
        ? 'rgba(245, 158, 11, 0.10)'
        : 'hsl(var(--card))';
    const isReady = integration.validated || integration.active;

    return (
      <Tooltip
        key={integration.id}
        title={`${integration.name}${integration.validated ? ' (validated)' : integration.active ? ' (configured)' : ' (not configured)'}`}
        placement="top"
        arrow
      >
        <Box
          sx={{
            position: 'relative',
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: '50% !important',
            border: `1px solid ${borderColor}`,
            // overflow visible so the status dot can sit outside the circle
            overflow: 'visible',
            bgcolor: bgColor,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isReady ? 1 : 0.45,
            filter: isReady ? 'none' : 'grayscale(1)',
            transition: 'transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease',
            '&:hover': {
              transform: 'scale(1.1)',
              opacity: 1,
              filter: 'none',
              zIndex: 2,
            },
          }}
        >
          {/* Image clip layer: fills the circle entirely, host CSS can't override */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50% !important',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
            }}
          >
            {integration.icon ? (
              <Box
                component="img"
                src={integration.icon}
                alt={integration.name}
                loading="lazy"
                sx={{
                  display: 'block',
                  width: '100% !important',
                  height: '100% !important',
                  maxWidth: 'none !important',
                  maxHeight: 'none !important',
                  objectFit: 'cover',
                  borderRadius: '50% !important',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                  bgcolor: 'hsl(var(--muted))',
                }}
              >
                {integration.name.slice(0, 1).toUpperCase()}
              </Box>
            )}
          </Box>
          {/* Status dot — sits OUTSIDE the circle, high z-index so nothing hides it */}
          {dotColor && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: '50% !important',
                backgroundColor: `${dotColor} !important`,
                boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 4px ${dotColor}66`,
                zIndex: 3,
                pointerEvents: 'none',
              }}
            />
          )}
        </Box>
      </Tooltip>
    );
  };

  if (singleLine) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: 1,
          px: 0.5,
          // extra vertical padding so the status dot (bottom: -2) isn't clipped
          py: '6px',
          overflowX: 'hidden',
          overflowY: 'visible',
          minWidth: 0,
          maskImage: 'linear-gradient(to right, black calc(100% - 32px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 32px), transparent)',
        }}
      >
        {visible.map(renderIcon)}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 0.5, py: 0.5 }}>
      {visible.map(renderIcon)}
    </Box>
  );
}

function UsecaseDetailContent({
  flowId,
  hideBackNav = false,
  hidePrevNext = false,
  onNavigateUsecase,
  usecases,
  isEnabled = false,
  canToggle = false,
  isAuthenticated = true,
  onToggled,
}: {
  flowId: string | undefined;
  hideBackNav?: boolean;
  hidePrevNext?: boolean;
  onNavigateUsecase?: (flowId: string) => void;
  usecases: Usecase[];
  /** Whether this automation currently has a running workflow */
  isEnabled?: boolean;
  /** Whether the Enable/Disable button should be shown (auth + automationLabel) */
  canToggle?: boolean;
  /** Whether the viewer is logged in — drives the guest CTA banner */
  isAuthenticated?: boolean;
  /** Called after a successful toggle so the parent can refetch workflows */
  onToggled?: () => void;
}) {
  const navigate = useNavigate();
  const { apiUrl, authHeader } = useApi();
  const flow = usecases.find((item) => item.id === flowId);
  const [categoryAppNames, setCategoryAppNames] = useState<Record<string, string[]>>({});
  const [toggling, setToggling] = useState(false);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
  const effectiveEnabled = optimisticEnabled !== null ? optimisticEnabled : isEnabled;

  const handleToggle = async () => {
    if (!flow?.automationLabel || toggling) return;
    const willBeEnabled = !effectiveEnabled;
    setToggling(true);
    setOptimisticEnabled(willBeEnabled);
    try {
      const res = await fetch(apiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: flow.automationLabel,
          ...(flow.automationCategory ? { category: flow.automationCategory } : {}),
          ...(willBeEnabled ? {} : { action_name: 'remove' }),
        }),
      });
      let body: any = null;
      try { body = await res.json(); } catch { /* ignore */ }
      const reason = typeof body?.reason === 'string' ? body.reason : '';
      const ok = res.ok && body?.success !== false;
      if (!ok) throw new Error(reason || `Request failed (${res.status})`);
      toast.success(willBeEnabled ? `${flow.label} enabled` : `${flow.label} disabled`);
      onToggled?.();
      setTimeout(() => setOptimisticEnabled(null), 1500);
    } catch (err: any) {
      setOptimisticEnabled(null);
      toast.error(err?.message || 'Failed to update automation', { duration: 6000 });
    } finally {
      setToggling(false);
    }
  };


  useEffect(() => {
    let cancelled = false;

    const fetchApps = async () => {
      try {
        const [authRes, appsRes] = await Promise.all([
          fetch(apiUrl('/api/v1/apps/authentication'), { credentials: 'include', headers: { ...authHeader() } }),
          fetch(apiUrl('/api/v1/apps'), { credentials: 'include', headers: { ...authHeader() } }),
        ]);

        const mapped: Record<string, Set<string>> = {};
        const addApp = (name: string, categories: string[]) => {
          const categoryId = matchAppToCategory(name, categories);
          if (!categoryId) return;
          if (!mapped[categoryId]) mapped[categoryId] = new Set();
          mapped[categoryId].add(name);
        };

        if (authRes.ok) {
          const authData = await authRes.json();
          const authList = Array.isArray(authData) ? authData : (authData?.data || []);
          for (const entry of Array.isArray(authList) ? authList : []) {
            const app = entry?.app;
            if (app?.name) addApp(app.name, app.categories || []);
          }
        }

        if (appsRes.ok) {
          const appsData = await appsRes.json();
          for (const app of Array.isArray(appsData) ? appsData : []) {
            if (app?.activated && app?.name) addApp(app.name, app.categories || []);
          }
        }

        if (!cancelled) {
          setCategoryAppNames(
            Object.fromEntries(Object.entries(mapped).map(([key, value]) => [key, Array.from(value).sort()]))
          );
        }
      } catch {
        if (!cancelled) setCategoryAppNames({});
      }
    };

    fetchApps();
    return () => { cancelled = true; };
  }, []);

  if (!flow) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1.1rem', color: 'hsl(var(--muted-foreground))', mb: 2 }}>
          Automation not found
        </Typography>
        <Button onClick={() => (onNavigateUsecase ? onNavigateUsecase('') : navigate('/usecases'))} sx={{ textTransform: 'none', color: 'hsl(var(--primary))' }}>
          ← Back to automations
        </Button>
      </Box>
    );
  }

  const sourceCat = getToolCategoryMeta(flow.source);
  const targetCat = getToolCategoryMeta(flow.target);
  const phaseInfo = FLOW_PHASES.find((phase) => phase.id === flow.phase) || FLOW_PHASES[0];
  const sourceDetails = TOOL_CATEGORIES.find((item) => item.id === flow.source);
  const targetDetails = TOOL_CATEGORIES.find((item) => item.id === flow.target);
  const currentIndex = usecases.findIndex((item) => item.id === flow.id);
  const prevFlow = currentIndex > 0 ? usecases[currentIndex - 1] : null;
  const nextFlow = currentIndex < usecases.length - 1 ? usecases[currentIndex + 1] : null;
  const goToUsecase = (id: string) => {
    if (onNavigateUsecase) onNavigateUsecase(id);
    else {
      const target = usecases.find((u) => u.id === id);
      const seg = target?.label || id;
      navigate(`/usecases/${encodeURIComponent(seg)}`);
    }
  };

  // Self-contained color tokens with fallbacks so the standalone build
  // (where host CSS may not define --card/--border/etc.) still renders
  // proper surfaces and accent colors instead of going transparent/flat.
  const CARD_BG = 'hsl(var(--card, 0 0% 13%))';
  const CARD_BORDER = '1px solid hsl(var(--border, 0 0% 20%))';
  const FG = 'hsl(var(--foreground, 0 0% 100%))';
  const MUTED = 'hsl(var(--muted-foreground, 0 0% 60%))';
  const PRIMARY = 'hsl(var(--primary, 24 100% 50%))';
  // Resolve a category color token (e.g. "--infra-siem") to an actual hsl()
  // string with a sensible fallback (Shuffle orange) so badges/icons retain
  // their accent color even when the host page lacks design tokens.
  const accent = (token?: string) => `hsl(var(${token || '--primary'}, 24 100% 50%))`;
  const accentBg = (token: string | undefined, alpha: number) =>
    `hsla(var(${token || '--primary'}, 24 100% 50%) / ${alpha})`;

  return (
    <Box sx={{ maxWidth: 860, width: '100%', mx: 'auto', pb: 4, color: FG }}>
      {!hideBackNav && (
        <Button onClick={() => navigate('/usecases')} startIcon={<ArrowLeft size={14} />} sx={{ mb: 2, textTransform: 'none', color: MUTED }}>
          Automations
        </Button>
      )}

      {!isAuthenticated && (
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 2,
            border: '1px solid hsla(24, 100%, 50%, 0.4)',
            background: 'linear-gradient(135deg, hsla(24, 100%, 50%, 0.18) 0%, hsla(24, 100%, 50%, 0.06) 60%, hsla(24, 100%, 50%, 0.02) 100%)',
            p: { xs: 2, md: 2.5 },
            mb: 3,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'hsla(24, 100%, 50%, 0.18)',
              color: PRIMARY,
            }}
          >
            <Sparkles size={22} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: FG, mb: 0.25 }}>
              Try “{flow.label}” in your own environment
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: MUTED, lineHeight: 1.5 }}>
              Create a free account to enable this automation in one click — no credit card, setup in under 2 minutes.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
            <Button
              component={Link}
              to={`/register?returnUrl=${encodeURIComponent(`/usecases/${encodeURIComponent(flow.label)}`)}`}
              variant="contained"
              disableElevation
              endIcon={<ArrowRight size={16} />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                px: 2,
                py: 1,
                bgcolor: PRIMARY,
                color: 'hsl(var(--primary-foreground, 0 0% 100%))',
                '&:hover': { bgcolor: 'hsla(24, 100%, 50%, 0.9)' },
                whiteSpace: 'nowrap',
              }}
            >
              Get started free
            </Button>
            <Button
              component={Link}
              to={`/login?returnUrl=${encodeURIComponent(`/usecases/${encodeURIComponent(flow.label)}`)}`}
              variant="text"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: MUTED,
                '&:hover': { color: FG, bgcolor: 'transparent' },
              }}
            >
              Sign in
            </Button>
          </Box>
        </Box>
      )}

      <Box sx={{ p: 3, borderRadius: 2, border: CARD_BORDER, bgcolor: CARD_BG, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
          <Box sx={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: accentBg(sourceCat?.color, 0.12), color: accent(sourceCat?.color), flexShrink: 0 }}>
            {sourceCat?.icon || <ArrowRight size={22} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: FG, lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                {flow.label}
              </Typography>
              {canToggle && flow.automationLabel && (
                <Button
                  size="small"
                  variant="contained"
                  disableElevation
                  onClick={handleToggle}
                  disabled={toggling}
                  startIcon={
                    toggling ? (
                      <CircularProgress size={12} sx={{ color: 'inherit' }} />
                    ) : effectiveEnabled ? (
                      <PowerOff size={14} />
                    ) : (
                      <Power size={14} />
                    )
                  }
                  sx={{
                    flexShrink: 0,
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    minHeight: 0,
                    py: 0.6,
                    px: 1.25,
                    bgcolor: effectiveEnabled
                      ? 'hsl(var(--destructive, 0 84% 60%))'
                      : 'hsl(var(--primary, 24 100% 50%))',
                    color: effectiveEnabled
                      ? 'hsl(var(--destructive-foreground, 0 0% 100%))'
                      : 'hsl(var(--primary-foreground, 0 0% 100%))',
                    '&:hover': {
                      bgcolor: effectiveEnabled
                        ? 'hsla(0, 84%, 60%, 0.9)'
                        : 'hsla(24, 100%, 50%, 0.9)',
                    },
                  }}
                >
                  {effectiveEnabled ? 'Disable' : 'Enable'}
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, px: 1, py: 0.35, borderRadius: 1, bgcolor: accentBg(phaseInfo.color, 0.12), color: accent(phaseInfo.color), border: `1px solid ${accentBg(phaseInfo.color, 0.25)}` }}>
                Step {phaseInfo.step}: {phaseInfo.label}
              </Typography>
              {flow.manualVerification && (
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, px: 1, py: 0.35, borderRadius: 1, bgcolor: 'hsla(45, 93%, 47%, 0.1)', color: 'hsl(45, 93%, 47%)', border: '1px solid hsla(45, 93%, 47%, 0.25)' }}>
                  Manual Verification
                </Typography>
              )}
              {typeof flow.priority === 'number' && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.68rem', fontWeight: 700, px: 1, py: 0.35, borderRadius: 1, bgcolor: 'hsla(24, 100%, 50%, 0.1)', color: PRIMARY, border: '1px solid hsla(24, 100%, 50%, 0.25)' }}>
                  <Flame size={11} />
                  Priority {flow.priority}
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: '0.88rem', color: MUTED, lineHeight: 1.7 }}>
              {flow.description || 'No description available.'}
            </Typography>
            {flow.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                {flow.tags.map((tag) => (
                  <Typography key={tag} sx={{ fontSize: '0.7rem', px: 0.9, py: 0.35, borderRadius: 1, bgcolor: 'hsla(0, 0%, 60%, 0.08)', color: MUTED, border: '1px solid hsla(0, 0%, 60%, 0.18)', fontWeight: 600 }}>
                    {tag}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 3, borderRadius: 2, border: CARD_BORDER, bgcolor: CARD_BG, mb: 3 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
          Connection Path
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
          {[{ title: 'Source', meta: sourceCat, details: sourceDetails, appNames: categoryAppNames[flow.source] || [] }, { title: 'Destination', meta: targetCat, details: targetDetails, appNames: categoryAppNames[flow.target] || [] }].map((endpoint, index) => (
            <Box key={endpoint.title} sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
                {endpoint.title}
              </Typography>
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: accentBg(endpoint.meta?.color, 0.06), border: `1px solid ${accentBg(endpoint.meta?.color, 0.15)}`, mb: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: accentBg(endpoint.meta?.color, 0.12), color: accent(endpoint.meta?.color), flexShrink: 0 }}>
                    {endpoint.meta?.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: accent(endpoint.meta?.color) }}>
                      {endpoint.meta?.label || 'Unknown'}
                    </Typography>
                    {endpoint.details && (
                      <Typography sx={{ fontSize: '0.72rem', color: MUTED, lineHeight: 1.5 }}>
                        {endpoint.details.description.split('—')[0].trim()}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.64rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.75 }}>
                Your Tools
              </Typography>
              <IntegrationStatusLite filterApps={endpoint.appNames} />
            </Box>
          ))}
        </Box>
      </Box>

      {(flow.referenceImage || flow.video || flow.blogpost) && (
        <Box sx={{ p: 3, borderRadius: 2, border: CARD_BORDER, bgcolor: CARD_BG, mb: 3 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
            Resources
          </Typography>
          {flow.referenceImage && (
            <Box component="a" href={flow.referenceImage} target="_blank" rel="noopener noreferrer" sx={{ display: 'block', mb: (flow.video || flow.blogpost) ? 2 : 0, borderRadius: 1.5, overflow: 'hidden', border: CARD_BORDER }}>
              <Box component="img" src={flow.referenceImage} alt={`${flow.label} reference`} loading="lazy" sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: 420, objectFit: 'contain' }} />
            </Box>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {flow.video && (
              <Button href={flow.video} target="_blank" rel="noopener noreferrer" startIcon={<PlayCircle size={16} />} sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 600, color: PRIMARY, border: '1px solid hsla(24, 100%, 50%, 0.3)', bgcolor: 'hsla(24, 100%, 50%, 0.06)' }}>
                Watch video
              </Button>
            )}
            {flow.blogpost && (
              <Button href={flow.blogpost} target="_blank" rel="noopener noreferrer" startIcon={<BookOpen size={16} />} sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 600, color: FG, border: CARD_BORDER, bgcolor: 'hsla(0, 0%, 60%, 0.04)' }}>
                Read blogpost
              </Button>
            )}
          </Box>
        </Box>
      )}

      {!hidePrevNext && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 2 }}>
          {prevFlow ? (
            <Button onClick={() => goToUsecase(prevFlow.id)} startIcon={<ArrowLeft size={14} />} sx={{ textTransform: 'none', color: MUTED }}>
              {prevFlow.label}
            </Button>
          ) : <Box />}
          {nextFlow ? (
            <Button onClick={() => goToUsecase(nextFlow.id)} endIcon={<ArrowRight size={14} />} sx={{ textTransform: 'none', color: MUTED }}>
              {nextFlow.label}
            </Button>
          ) : <Box />}
        </Box>
      )}
    </Box>
  );
}

/**
 * Public props. All optional — when omitted, the page works standalone.
 *
 * Pass these to integrate with a host SPA that already manages auth/config:
 *   <UsecasesPage userdata={userdata} globalUrl={globalUrl} isLoaded isLoggedIn />
 */
export interface UsecasesPageProps {
  /** Override the API base URL (e.g. "https://shuffler.io"). */
  globalUrl?: string;
  /**
   * Raw `/api/v1/getinfo` response body from the host app. When provided
   * the inlined getinfo probe is skipped and this object is used directly
   * (id, username, support, api_key, …).
   */
  userdata?: UsecasesUserData | null;
  /**
   * Whether the host app's getinfo call has finished. While `false`, the
   * page treats auth state as "still resolving" and does NOT fall back to
   * its own getinfo probe — preventing duplicate requests.
   */
  isLoaded?: boolean;
  /**
   * Whether getinfo says the user is logged in. When `isLoaded` is `true`,
   * this fully overrides authentication state. Defaults to `!!userdata`.
   */
  isLoggedIn?: boolean;
  /**
   * Force the color theme of the page. Defaults to `'system'` (follows
   * `prefers-color-scheme` and any ancestor `.dark` class). Pass `'dark'`
   * or `'light'` to lock it.
   */
  theme?: 'light' | 'dark' | 'system';
}

function UsecasesPageInner() {
  usePageTitle('Usecases');

  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<FlowPhase | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const navigate = useNavigate();
  const { apiUrl, authHeader } = useApi();
  const { usecases, apiLoaded, getDrift } = useUsecasesLite();
  const { userInfo, isAuthenticated, refetch: refetchAuth } = useAuthLite();
  const { data: workflows = [], refetch: refetchWorkflows } = useWorkflowsLite();
  const isSupport = userInfo?.support === true;
  const [showAllAsSupport, setShowAllAsSupport] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams<{ flowId?: string }>();

  // Drawer is driven by the route segment /usecases/:flowId where the segment
  // is the URL-encoded usecase label (human-readable name). We resolve it back
  // to a flow id by matching against `flow.label`.
  const drawerLabel = routeParams.flowId ? decodeURIComponent(routeParams.flowId) : null;
  const drawerFlowId = useMemo(() => {
    if (!drawerLabel) return null;
    const match = usecases.find(u => u.label === drawerLabel);
    return match ? match.id : null;
  }, [drawerLabel, usecases]);

  const setDrawerFlowId = (id: string | null) => {
    if (!id) {
      navigate({ pathname: '/usecases', search: searchParams.toString() ? `?${searchParams.toString()}` : '' });
      return;
    }
    const flow = usecases.find(u => u.id === id);
    const name = flow?.label || id;
    // Fire-and-forget API call — response intentionally ignored per product spec.
    try {
      fetch(apiUrl(`/api/v1/workflows/usecases/${encodeURIComponent(name)}`), {
        credentials: 'include',
        headers: { ...authHeader() },
      })
        .then(() => { refetchAuth(); })
        .catch(() => { /* ignore */ });
    } catch { /* ignore */ }
    navigate({
      pathname: `/usecases/${encodeURIComponent(name)}`,
      search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    });
  };

  // Map: automationLabel -> whether at least one workflow exists for it.
  // Match by workflow name OR tag containing the label (case-insensitive).
  const enabledLabels = useMemo(() => {
    const set = new Set<string>();
    for (const wf of workflows) {
      const name = (wf.name || '').toLowerCase();
      const tags = (wf.tags || []).map(t => String(t).toLowerCase());
      for (const uc of usecases) {
        if (!uc.automationLabel) continue;
        const lbl = uc.automationLabel.toLowerCase();
        if (name === lbl || name.includes(lbl) || tags.includes(lbl) || tags.some(t => t.includes(lbl))) {
          set.add(uc.automationLabel);
        }
      }
    }
    return set;
  }, [workflows, usecases]);

  // Set of usecase names the user has shown interest in (from /getinfo `.interests`).
  // Names are URL-encoded in the API; we decode them so we can compare against `flow.label`.
  const interestNames = useMemo(() => {
    const set = new Set<string>();
    for (const i of userInfo?.interests || []) {
      if (i?.type !== 'usecase' || !i?.active || !i?.name) continue;
      try { set.add(decodeURIComponent(i.name)); } catch { set.add(i.name); }
    }
    return set;
  }, [userInfo?.interests]);

  // Export the current usecase registry (with live `running` state) as JSON.
  const handleExportJson = () => {
    try {
      const json = getUsecasesJson(usecases, enabledLabels);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `automations-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Usecases exported');
    } catch (err) {
      console.error('[UsecasesPage] export failed', err);
      toast.error('Failed to export usecases');
    }
  };

  // Collect unique tags across all usecases
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    usecases.forEach((u) => u.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [usecases]);

  const filtered = useMemo(() => {
    let list = usecases;

    // Hide inactive (non-animated) usecases for authenticated non-support users.
    // Guests see everything so the page doesn't look empty before sign-up.
    if (isAuthenticated && !(isSupport && showAllAsSupport)) {
      list = list.filter((u) => u.animated === true);
    }

    // Always hide "Logs" usecases (even for guests) — not a primary entry point.
    if (!(isSupport && showAllAsSupport)) {
      list = list.filter((u) => !/log/i.test(u.label));
    }

    if (phaseFilter !== 'all') {
      list = list.filter((u) => u.phase === phaseFilter);
    }
    if (categoryFilter !== 'all') {
      list = list.filter((u) => u.source === categoryFilter || u.target === categoryFilter);
    }
    if (tagFilter !== 'all') {
      list = list.filter((u) => u.tags.includes(tagFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.label.toLowerCase().includes(q) ||
          u.description.toLowerCase().includes(q) ||
          u.tags.some((t) => t.toLowerCase().includes(q)) ||
          categoryLabel(u.source).toLowerCase().includes(q) ||
          categoryLabel(u.target).toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, phaseFilter, categoryFilter, tagFilter, usecases, isAuthenticated, isSupport, showAllAsSupport]);

  // Group by phase in order
  const grouped = useMemo(() => {
    const phases = phaseFilter === 'all' ? FLOW_PHASES : FLOW_PHASES.filter((p) => p.id === phaseFilter);
    return phases.map((p) => ({
      ...p,
      flows: filtered.filter((f) => f.phase === p.id),
    })).filter((g) => g.flows.length > 0);
  }, [filtered, phaseFilter]);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1200, width: '100%', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: 'hsl(var(--foreground))', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            Usecases
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            All data flows across your security stack — grouped by implementation phase.
          </Typography>
        </Box>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {isSupport && (
            <Box
              component="button"
              onClick={handleExportJson}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                '&:hover': {
                  bgcolor: 'hsl(var(--muted))',
                  borderColor: 'hsl(var(--primary) / 0.4)',
                  boxShadow: '0 2px 8px hsl(var(--primary) / 0.1)',
                },
              }}
            >
              <FileJson size={16} />
              Export JSON
            </Box>
          )}
          {(() => {
            // Always link to security.shuffler.io/infrastructure in a new window.
            // Outside of security.shuffler.io itself, restrict visibility to support users.
            const onSecurityHost = typeof window !== 'undefined' && window.location.hostname === 'security.shuffler.io';
            if (!onSecurityHost && !isSupport) return null;
            const tooltip = onSecurityHost
              ? 'Open Infrastructure'
              : 'Support-only: opens security.shuffler.io/infrastructure in a new tab';
            return (
              <Tooltip title={tooltip} placement="bottom" arrow>
                <Box
                  component="a"
                  href="https://security.shuffler.io/infrastructure"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderRadius: 1.5,
                    border: '1px solid hsl(var(--border))',
                    bgcolor: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      bgcolor: 'hsl(var(--muted))',
                      borderColor: 'hsl(var(--primary) / 0.4)',
                      boxShadow: '0 2px 8px hsl(var(--primary) / 0.1)',
                    },
                  }}
                >
                  <Network size={16} />
                  Infrastructure
                  <ExternalLink size={14} style={{ opacity: 0.5 }} />
                </Box>
              </Tooltip>
            );
          })()}
        </Box>
      </Box>

      {/* Selected apps — same format as the AppSearchDrawer's "Your Apps" row */}
      {isAuthenticated && (
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.7rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 1,
              px: 1,
            }}
          >
            Selected apps
          </Typography>
          <Box
            sx={{
              p: 1,
              borderRadius: 1.5,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <IntegrationStatusLite singleLine />
            </Box>
            <Button
              component={Link}
              to="/apps?tab=all_apps"
              size="small"
              variant="outlined"
              startIcon={<Search size={14} />}
              sx={{
                flexShrink: 0,
                textTransform: 'none',
                borderColor: 'hsl(var(--border, 0 0% 20%))',
                color: 'hsl(var(--foreground, 0 0% 100%)) !important',
                bgcolor: 'transparent',
                '&:hover': {
                  borderColor: 'hsl(var(--primary, 24 100% 50%))',
                  // Use a translucent primary tint instead of --accent (which is
                  // solid orange in this theme and would clash with the text).
                  bgcolor: 'hsla(24, 100%, 50%, 0.12)',
                  color: 'hsl(var(--foreground, 0 0% 100%)) !important',
                },
                '&:hover .MuiButton-startIcon': {
                  color: 'hsl(var(--foreground, 0 0% 100%))',
                },
              }}
            >
              Find apps
            </Button>
          </Box>
        </Box>
      )}

      {/* Banner */}
      {isSupport ? (
        <Box sx={{
          mb: 3, px: 2, py: 1.5, borderRadius: 1,
          bgcolor: 'hsl(45 93% 47% / 0.1)',
          border: '1px solid hsl(45 93% 47% / 0.3)',
          display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={14} style={{ color: 'hsl(45 93% 47%)' }} />
            <Typography variant="body2" sx={{ color: 'hsl(45 93% 47%)', fontWeight: 500 }}>
              {showAllAsSupport
                ? `Support view — showing all ${usecases.length} usecases (including ${usecases.filter(u => !u.animated).length} inactive hidden from users)`
                : `Viewing as normal user — showing ${usecases.filter(u => u.animated).length} active usecases`
              }
            </Typography>
          </Box>
          <Chip
            label={showAllAsSupport ? 'View as user' : 'View as support'}
            size="small"
            onClick={() => setShowAllAsSupport(!showAllAsSupport)}
            sx={{
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.7rem',
              bgcolor: showAllAsSupport ? 'hsl(var(--primary) / 0.15)' : 'hsl(45 93% 47% / 0.2)',
              color: showAllAsSupport ? 'hsl(var(--primary))' : 'hsl(45 93% 47%)',
              '&:hover': { bgcolor: showAllAsSupport ? 'hsl(var(--primary) / 0.25)' : 'hsl(45 93% 47% / 0.3)' },
            }}
          />
        </Box>
      ) : (
        <Box sx={{
          mb: 3, p: { xs: 2, md: 2.5 }, borderRadius: 2,
          bgcolor: 'hsl(var(--primary) / 0.06)',
          border: '1px solid hsl(var(--primary) / 0.18)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Zap size={16} style={{ color: 'hsl(var(--primary))' }} />
            <Typography variant="body2" sx={{ color: 'hsl(var(--primary))', fontWeight: 700, fontSize: '0.85rem' }}>
              One-click automations for Incidents, AI Agents & Enrichment
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.82rem', lineHeight: 1.6, mb: 1.5 }}>
            Every usecase below is a pre-built workflow you can enable in one click — no YAML, no glue code.
            Pick the tools you already use and Shuffle wires up the integration for you.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {[
              { label: 'Detect', desc: 'Catch what matters' },
              { label: 'Collect', desc: 'Pull data into incidents' },
              { label: 'Enrich', desc: 'Add context with AI & threat intel' },
              { label: 'Respond', desc: 'Act in seconds, with approval' },
            ].map((pillar) => (
              <Box
                key={pillar.label}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.6,
                  px: 1, py: 0.4, borderRadius: 1,
                  bgcolor: 'hsl(var(--primary) / 0.1)',
                  border: '1px solid hsl(var(--primary) / 0.2)',
                }}
              >
                <Typography sx={{ color: 'hsl(var(--primary))', fontWeight: 700, fontSize: '0.72rem' }}>
                  {pillar.label}
                </Typography>
                <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.72rem' }}>
                  · {pillar.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Grouped card grid */}
      {grouped.map((group) => (
        <Box key={group.id} sx={{ mb: 6 }}>
          {/* Phase header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, pt: 5 }}>
            <Chip
              label={group.step}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                height: 22,
                minWidth: 22,
                bgcolor: `hsl(var(${group.color}) / 0.15)`,
                color: `hsl(var(${group.color}))`,
              }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {group.label}
            </Typography>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              — {group.subtitle}
            </Typography>
          </Box>

          {/* Cards grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: 1.5,
            }}
          >
            {group.flows.map((flow) => (
              <UsecaseCard
                key={flow.id}
                flow={flow}
                drift={getDrift(flow.id)}
                apiLoaded={apiLoaded}
                isEnabled={!!flow.automationLabel && enabledLabels.has(flow.automationLabel)}
                canToggle={isAuthenticated && !!flow.automationLabel}
                isAuthenticated={isAuthenticated}
                onToggled={refetchWorkflows}
                onClick={() => setDrawerFlowId(flow.id)}
              />
            ))}
          </Box>
        </Box>
      ))}

      {filtered.length === 0 && (
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', textAlign: 'center', py: 8 }}>
          No usecases match your search.
        </Typography>
      )}

      {/* Right-hand drawer rendering the EXACT same component as /usecases/:id */}
      <Drawer
        anchor="right"
        open={drawerFlowId !== null}
        onClose={() => setDrawerFlowId(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 720, md: 900 },
            maxWidth: '100vw',
            // Explicit fallback so the drawer is never transparent in the
            // standalone build (host CSS may not define --background).
            backgroundColor: '#1a1a1a',
            bgcolor: 'hsl(var(--background, 0 0% 10%))',
            color: 'hsl(var(--foreground, 0 0% 100%))',
            backgroundImage: 'none',
          },
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3, py: 2,
          borderBottom: '1px solid hsl(var(--border, 0 0% 20%))',
          position: 'sticky', top: 0, zIndex: 2,
          backgroundColor: '#1a1a1a',
          bgcolor: 'hsl(var(--background, 0 0% 10%))',
        }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Automation
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {drawerFlowId && (
              <Button
                onClick={() => { const id = drawerFlowId; navigate(`/usecases/${encodeURIComponent(usecases.find(u => u.id === id)?.label || id || '')}/details`); }}
                endIcon={<ExternalLink size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'hsl(var(--primary))',
                  border: '1px solid hsla(var(--primary) / 0.3)',
                  bgcolor: 'hsla(var(--primary) / 0.06)',
                  px: 1.5,
                  '&:hover': { bgcolor: 'hsla(var(--primary) / 0.12)', borderColor: 'hsl(var(--primary))' },
                }}
              >
                Open full page
              </Button>
            )}
            <IconButton onClick={() => setDrawerFlowId(null)} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              <X size={18} />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {(() => {
            const drawerFlow = drawerFlowId ? usecases.find(u => u.id === drawerFlowId) : null;
            const drawerEnabled = !!drawerFlow?.automationLabel && enabledLabels.has(drawerFlow.automationLabel);
            const drawerCanToggle = isAuthenticated && !!drawerFlow?.automationLabel;
            return (
              <UsecaseDetailContent
                flowId={drawerFlowId ?? undefined}
                hideBackNav
                onNavigateUsecase={(id) => setDrawerFlowId(id || null)}
                usecases={usecases}
                isEnabled={drawerEnabled}
                canToggle={drawerCanToggle}
                isAuthenticated={isAuthenticated}
                onToggled={refetchWorkflows}
              />
            );
          })()}
        </Box>
      </Drawer>
    </Box>
  );
}

const ACTIVE_USECASE_IDS = [
  'siem_case_management_1',
  'edr_case_management_1',
  'email_case_management_1',
  'threat_intel_case_management_1',
  'asset_management_case_management_vuln_1',
  'case_management_cases_forward_1',
  'case_management_asset_management_monitors_1',
];

function UsecaseCard({
  flow,
  drift,
  apiLoaded,
  isEnabled,
  canToggle,
  isAuthenticated = true,
  onToggled,
  onClick,
}: {
  flow: Usecase;
  drift?: UsecaseDrift;
  apiLoaded: boolean;
  isEnabled: boolean;
  canToggle: boolean;
  isAuthenticated?: boolean;
  onToggled?: () => void;
  onClick: () => void;
}) {
  const sourceCat = categoryLabel(flow.source);
  const isComingSoon = !ACTIVE_USECASE_IDS.includes(flow.id);
  const targetCat = categoryLabel(flow.target);
  const [toggling, setToggling] = useState(false);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
  const effectiveEnabled = optimisticEnabled !== null ? optimisticEnabled : isEnabled;
  const { apiUrl, authHeader } = useApi();

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!flow.automationLabel || toggling) return;
    const willBeEnabled = !effectiveEnabled;
    setToggling(true);
    setOptimisticEnabled(willBeEnabled);
    try {
      const res = await fetch(apiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: flow.automationLabel,
          ...(flow.automationCategory ? { category: flow.automationCategory } : {}),
          ...(willBeEnabled ? {} : { action_name: 'remove' }),
        }),
      });
      let body: any = null;
      try { body = await res.json(); } catch { /* ignore */ }
      const reason = typeof body?.reason === 'string' ? body.reason : '';
      const ok = res.ok && body?.success !== false;
      if (!ok) {
        throw new Error(reason || `Request failed (${res.status})`);
      }
      toast.success(willBeEnabled ? `${flow.label} enabled` : `${flow.label} disabled`);
      onToggled?.();
      // Clear optimistic after a short delay so refetch can land
      setTimeout(() => setOptimisticEnabled(null), 1500);
    } catch (err: any) {
      setOptimisticEnabled(null);
      const msg = err?.message || 'Failed to update automation';
      toast.error(msg, { duration: 6000 });
    } finally {
      setToggling(false);
    }
  };


  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        bgcolor: 'hsl(var(--card))',
        borderColor: effectiveEnabled ? 'hsl(var(--severity-low) / 0.4)' : 'hsl(var(--border))',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': {
          borderColor: 'hsl(var(--primary) / 0.4)',
          boxShadow: '0 2px 12px hsl(var(--primary) / 0.08)',
        },
        '&:hover .uc-toggle-btn': {
          opacity: 1,
          pointerEvents: 'auto',
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ px: 2, py: '14.5px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {/* Label + sync icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', flexGrow: 1, fontSize: '0.82rem' }}>
            {flow.label}
          </Typography>
          {effectiveEnabled && (
            <Tooltip title="Automation enabled" placement="top" arrow>
              <Box sx={{ display: 'inline-flex' }}>
                <Power size={13} style={{ color: 'hsl(var(--severity-low))' }} />
              </Box>
            </Tooltip>
          )}
          {isComingSoon && (
            <Tooltip title="Coming soon" placement="top" arrow>
              <Box sx={{ display: 'inline-flex' }}>
                <Clock size={13} style={{ color: 'hsl(45 93% 47%)' }} />
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* Source → Target */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>
            {sourceCat}
          </Typography>
          <ArrowRight size={10} style={{ color: 'hsl(var(--muted-foreground))' }} />
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>
            {targetCat}
          </Typography>
        </Box>
      </CardActionArea>

      {/* Hover-revealed Enable/Disable button (or Sign-up CTA for guests) */}
      {(canToggle || (!isAuthenticated && flow.automationLabel)) && (
        <Box
          className="uc-toggle-btn"
          sx={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.15s ease',
          }}
        >
          {canToggle ? (
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={handleToggle}
              disabled={toggling}
              startIcon={
                toggling ? (
                  <CircularProgress size={12} sx={{ color: 'inherit' }} />
                ) : effectiveEnabled ? (
                  <PowerOff size={12} />
                ) : (
                  <Power size={12} />
                )
              }
              sx={{
                textTransform: 'none',
                fontSize: '0.7rem',
                fontWeight: 600,
                minHeight: 0,
                py: 0.4,
                px: 1,
                bgcolor: effectiveEnabled ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                color: effectiveEnabled ? 'hsl(var(--destructive-foreground))' : 'hsl(var(--primary-foreground))',
                '&:hover': {
                  bgcolor: effectiveEnabled ? 'hsl(var(--destructive) / 0.9)' : 'hsl(var(--primary) / 0.9)',
                },
              }}
            >
              {effectiveEnabled ? 'Disable' : 'Enable'}
            </Button>
          ) : (
            <Button
              component={Link}
              to={`/register?returnUrl=${encodeURIComponent(`/usecases/${encodeURIComponent(flow.label)}`)}`}
              size="small"
              variant="contained"
              disableElevation
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              startIcon={<Power size={12} />}
              sx={{
                textTransform: 'none',
                fontSize: '0.7rem',
                fontWeight: 600,
                minHeight: 0,
                py: 0.4,
                px: 1,
                bgcolor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
              }}
            >
              Enable
            </Button>
          )}
        </Box>
      )}
    </Card>
  );
}

/**
 * Default export — wraps `UsecasesPageInner` with a config provider so host
 * apps can pass `userdata` / `globalUrl` / `isLoaded` / `isLoggedIn` props
 * exactly like the legacy Shuffle Frontend route:
 *
 *   <Route exact path="/usecases" element={
 *     <UsecasesPage userdata={userdata} globalUrl={globalUrl} isLoaded isLoggedIn />
 *   } />
 *
 * When called with no props the page falls back to standalone behavior
 * (env / hostname-derived API URL, `localStorage.shuffle_api_key` auth, and
 * an internal `/api/v1/getinfo` probe).
 */
export default function UsecasesPage(props: UsecasesPageProps = {}) {
  useInjectScopedStyles();
  const { globalUrl, userdata, isLoaded, isLoggedIn, theme = 'system' } = props;

  // Resolve the theme class applied directly on the scope wrapper. 'system'
  // means "do nothing" — let the host app's `.dark` ancestor (or none) decide.
  const themeClass =
    theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : '';

  // Detect whether the host app is driving auth/config. As soon as ANY of the
  // four props is supplied, we treat the host as the source of truth and
  // suppress the inlined getinfo probe — even while `isLoaded` is still false
  // (host's getinfo is in flight).
  const hostManaged =
    globalUrl !== undefined ||
    userdata !== undefined ||
    isLoaded !== undefined ||
    isLoggedIn !== undefined;

  const config = React.useMemo<UsecasesPageConfig>(() => {
    const baseUrl = (globalUrl && globalUrl.replace(/\/+$/, '')) || DEFAULT_API_BASE_URL;
    const externalUserInfo = userdata ?? null;
    const externalApiKey = userdata?.api_key || userdata?.apikey || null;

    // Auth state mirrors the host: only authenticated once getinfo finished
    // (`isLoaded === true`) AND `isLoggedIn` is true (or, if `isLoggedIn` was
    // omitted, `userdata` is present).
    const loaded = isLoaded !== false; // default true when undefined
    const loggedIn =
      typeof isLoggedIn === 'boolean' ? isLoggedIn : !!userdata;
    const externalIsAuthenticated = hostManaged ? loaded && loggedIn : false;

    return {
      baseUrl,
      authHeader: () => {
        // Prefer the host's API key (if surfaced via userdata.api_key); else
        // fall back to the standalone localStorage key. Cookie auth still
        // works either way via `credentials: 'include'`.
        const key = externalApiKey || getStoredApiKey();
        return key ? { Authorization: `Bearer ${key}` } : {};
      },
      hasExternalAuth: hostManaged,
      externalUserInfo,
      externalIsAuthenticated,
      isLoaded: loaded,
    };
  }, [globalUrl, userdata, isLoaded, isLoggedIn, hostManaged]);

  return (
    <UsecasesPageConfigContext.Provider value={config}>
      <div className={themeClass ? `${SCOPE_CLASS} ${themeClass}` : SCOPE_CLASS}>
        <UsecasesPageInner />
      </div>
    </UsecasesPageConfigContext.Provider>
  );
}
