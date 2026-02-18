/**
 * InfrastructurePage — Visual map of security tool categories and data flows.
 * Uses @xyflow/react for an interactive node-based diagram.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import { setDatastoreItem, getDatastoreItem, DATASTORE_CATEGORIES } from '@/services/datastore';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Position,
  Handle,
  Connection,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
  reconnectEdge,
  
  BaseEdge,
  EdgeLabelRenderer,
  useViewport,
  type EdgeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, Avatar, IconButton, Drawer, Tooltip, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  LayoutGrid,
  Server,
  Network,
  Shield,
  MessageSquare,
  Mail,
  Crosshair,
  HardDrive,
  KeyRound,
  Zap,
  ArrowRight,
  ChevronRight,
  Activity,
  Download,
  Cloud,
  X,
} from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { IntegrationStatus } from '@/components/layout/IntegrationStatus';
import { AddAppModal } from '@/components/infrastructure/AddAppModal';

// ── Tool Category Definitions ──────────────────────────────────────────────────

interface ToolCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string; // HSL var
  examples: string[];
  subcategories: { label: string; description: string }[];
  dataIn: string[];
  dataOut: string[];
  useCases: string[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'case_management',
    label: 'Case Management',
    description: 'Central hub for incident tracking, task assignment, and case lifecycle management.',
    icon: <LayoutGrid size={22} />,
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
    icon: <Server size={22} />,
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
    icon: <Network size={22} />,
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
    icon: <Shield size={22} />,
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
    icon: <MessageSquare size={22} />,
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
    icon: <Mail size={22} />,
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
    icon: <Crosshair size={22} />,
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
    label: 'Asset Management',
    description: 'IT asset inventory, CMDB, and vulnerability management for contextualized response.',
    icon: <HardDrive size={22} />,
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
    icon: <KeyRound size={22} />,
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
    icon: <Cloud size={22} />,
    color: '--infra-cloud',
    examples: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Oracle Cloud', 'DigitalOcean', 'Linode'],
    subcategories: [
      { label: 'CSPM', description: 'Cloud Security Posture Management — misconfig detection' },
      { label: 'CWPP', description: 'Cloud Workload Protection for containers and serverless' },
      { label: 'Cloud IAM', description: 'Cloud-native identity, roles, and permission policies' },
      { label: 'DevSecOps', description: 'CI/CD security scanning, IaC checks, and code analysis' },
    ],
    dataIn: ['Detection rules from SIEM', 'IOC feeds from Threat Intel', 'Policy updates from IAM'],
    dataOut: ['CloudTrail/audit logs to SIEM', 'Resource inventory to Asset Management', 'Identity events to IAM'],
    useCases: [
      'Stream cloud audit logs to SIEM for correlation',
      'Auto-remediate misconfigured resources (e.g. open S3 buckets)',
      'Sync cloud IAM roles and policies with central identity provider',
      'Inventory cloud assets for vulnerability management',
    ],
  },
];

// ── Data flow edge definitions ─────────────────────────────────────────────────

export type FlowPhase = 'ingest' | 'response' | 'correlation';

export const FLOW_PHASES: { id: FlowPhase; label: string; subtitle: string; step: number; color: string }[] = [
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

const DATA_FLOWS: { source: string; target: string; label: string; animated?: boolean; description: string; phase: FlowPhase }[] = [
  // e-0
  { phase: 'ingest', source: 'siem', target: 'case_management', label: 'Alerts', animated: true,
    description: 'SIEM-generated alerts are the primary trigger for new cases. Automating this flow ensures no critical detection goes uninvestigated and reduces mean time to respond (MTTR).' },
  // e-1
  { phase: 'ingest', source: 'network', target: 'siem', label: 'Flow logs',
    description: 'Network flow logs (NetFlow, DNS, proxy) give the SIEM east-west and north-south visibility. Without them, lateral movement and C2 traffic go undetected.' },
  // e-2
  { phase: 'ingest', source: 'edr', target: 'siem', label: 'Telemetry',
    description: 'Endpoint telemetry (process trees, file hashes, registry changes) enriches SIEM detections with host-level context, enabling accurate correlation rules.' },
  // e-3
  { phase: 'ingest', source: 'iam', target: 'siem', label: 'Auth logs',
    description: 'Authentication and authorization logs reveal credential abuse, impossible travel, privilege escalation, and brute-force attempts across the identity layer.' },
  // e-4
  { phase: 'ingest', source: 'email', target: 'case_management', label: 'Phishing reports',
    description: 'User-reported phishing emails create cases for triage. Automating intake with deduplication and auto-enrichment drastically cuts analyst workload.' },
  // e-5
  { phase: 'correlation', source: 'threat_intel', target: 'case_management', label: 'Enrichment', animated: true,
    description: 'Threat intelligence enriches cases with reputation scores, malware families, threat actor attribution, and related IOCs — giving analysts immediate context.' },
  // e-6
  { phase: 'response', source: 'threat_intel', target: 'network', label: 'IOC feeds',
    description: 'Pushing IOC feeds (malicious IPs, domains) to network tools enables proactive blocking at the perimeter before threats reach endpoints.' },
  // e-7
  { phase: 'response', source: 'threat_intel', target: 'edr', label: 'Hash feeds',
    description: 'File hash feeds allow EDR solutions to block or quarantine known-malicious binaries on endpoints in real time, preventing execution.' },
  // e-8
  { phase: 'response', source: 'case_management', target: 'communication', label: 'Notifications', animated: true,
    description: 'Automated notifications keep stakeholders informed of incident status, escalations, and required actions — critical for SLA compliance and coordination.' },
  // e-9
  { phase: 'response', source: 'case_management', target: 'iam', label: 'Disable accounts',
    description: 'When a compromised account is identified, automated disablement through IAM stops the attacker from maintaining access while the investigation continues.' },
  // e-10
  { phase: 'response', source: 'case_management', target: 'edr', label: 'Containment',
    description: 'Network isolation or process killing on compromised endpoints contains the threat, preventing lateral movement while preserving forensic evidence.' },
  // e-11
  { phase: 'correlation', source: 'asset_management', target: 'case_management', label: 'Asset context',
    description: 'Asset context (owner, criticality, business unit, OS) helps analysts prioritize cases and understand blast radius during an incident.' },
  // e-12
  { phase: 'correlation', source: 'email', target: 'threat_intel', label: 'Phishing IOCs',
    description: 'Extracting IOCs from phishing emails (sender domains, URLs, attachments) and feeding them into threat intel platforms helps detect broader campaigns.' },
  // e-13
  { phase: 'ingest', source: 'cloud', target: 'siem', label: 'Audit logs', animated: true,
    description: 'Cloud audit logs (CloudTrail, Activity Log, Audit Logs) provide visibility into API calls, configuration changes, and access patterns across cloud environments.' },
  // e-14
  { phase: 'ingest', source: 'cloud', target: 'asset_management', label: 'Resource inventory',
    description: 'Auto-syncing cloud resources into asset management ensures the CMDB stays current, preventing blind spots in vulnerability management and incident response.' },
  // e-15
  { phase: 'correlation', source: 'cloud', target: 'iam', label: 'Identity events',
    description: 'Cloud identity events (role changes, permission grants, federation configs) feed IAM monitoring to detect privilege escalation in cloud environments.' },
  // e-16
  { phase: 'correlation', source: 'threat_intel', target: 'cloud', label: 'IOC feeds',
    description: 'Pushing IOC feeds to cloud-native security tools (GuardDuty, Sentinel, SCC) enables detection of known-malicious activity within cloud workloads.' },
  // e-17
  { phase: 'response', source: 'case_management', target: 'cloud', label: 'Cloud response',
    description: 'Automated response actions in cloud environments — revoking keys, isolating instances, modifying security groups — contain threats before they spread across cloud infrastructure.' },
  // e-18
  { phase: 'response', source: 'case_management', target: 'network', label: 'Block rules',
    description: 'Pushing firewall block rules from cases to network devices enables immediate perimeter-level containment of malicious IPs, domains, and traffic patterns.' },
  // e-19
  { phase: 'response', source: 'case_management', target: 'email', label: 'Quarantine',
    description: 'Quarantining or purging malicious emails from mailboxes during an active investigation prevents additional users from falling victim to the same campaign.' },
  // e-20 — NEW: EDR → Case Management (direct alert path)
  { phase: 'ingest', source: 'edr', target: 'case_management', label: 'EDR alerts', animated: true,
    description: 'EDR-generated alerts (malware detections, suspicious process executions, ransomware behavior) are forwarded directly to Case Management to open or update incidents, bypassing the SIEM for faster response on high-confidence endpoint detections.' },
];

// ── Category-to-app mapping ────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  case_management: ['cases', 'case management', 'ticketing', 'itsm', 'service desk', 'thehive', 'servicenow', 'jira'],
  siem: ['siem', 'splunk', 'sentinel', 'elastic', 'qradar', 'log management', 'wazuh', 'chronicle'],
  network: ['network', 'firewall', 'palo alto', 'fortinet', 'suricata', 'zeek', 'ids', 'ips', 'ndr'],
  edr: ['edr', 'endpoint', 'crowdstrike', 'sentinelone', 'defender', 'carbon black', 'xdr'],
  communication: ['communication', 'chat', 'messaging', 'slack', 'teams', 'pagerduty', 'opsgenie', 'notification'],
  email: ['email', 'mail', 'phishing', 'microsoft 365', 'google workspace', 'exchange', 'gmail', 'smtp'],
  threat_intel: ['threat intel', 'intelligence', 'misp', 'virustotal', 'otx', 'recorded future', 'ioc', 'abuse'],
  asset_management: ['asset', 'cmdb', 'inventory', 'qualys', 'tenable', 'vulnerability', 'snipe'],
  iam: ['iam', 'identity', 'access', 'okta', 'azure ad', 'cyberark', 'jumpcloud', 'ldap', 'active directory'],
  
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'google cloud', 'oracle cloud', 'digitalocean', 'cloud provider'],
};

function matchAppToCategory(appName: string, appCategories: string[]): string | null {
  const searchText = [appName, ...appCategories].join(' ').toLowerCase();
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => searchText.includes(kw))) return catId;
  }
  return null;
}

interface MatchedApp {
  name: string;
  image: string;
  hasValidAuth?: boolean;
}

// ── Orthogonal path builder (only H/V segments with rounded corners) ────────

function expandToOrthogonal(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  // Filter out any null/undefined entries
  const valid = points.filter((p): p is { x: number; y: number } => p != null && typeof p.x === 'number' && typeof p.y === 'number');
  if (valid.length < 2) return valid;
  const expanded: Array<{ x: number; y: number }> = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const prev = expanded[expanded.length - 1];
    const curr = valid[i];
    if (Math.abs(prev.x - curr.x) > 1 && Math.abs(prev.y - curr.y) > 1) {
      expanded.push({ x: curr.x, y: prev.y });
    }
    expanded.push(curr);
  }
  return expanded;
}

function buildOrthogonalPath(
  points: Array<{ x: number; y: number }>,
  borderRadius: number = 12,
): string {
  const expanded = expandToOrthogonal(points);
  if (expanded.length < 2) return '';
  if (expanded.length === 2) {
    return `M ${expanded[0].x} ${expanded[0].y} L ${expanded[1].x} ${expanded[1].y}`;
  }

  let path = `M ${expanded[0].x} ${expanded[0].y}`;
  for (let i = 1; i < expanded.length - 1; i++) {
    const prev = expanded[i - 1];
    const curr = expanded[i];
    const next = expanded[i + 1];
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len1 === 0 || len2 === 0) { path += ` L ${curr.x} ${curr.y}`; continue; }
    const r = Math.min(borderRadius, len1 / 2, len2 / 2);
    const bx = curr.x - (dx1 / len1) * r, by = curr.y - (dy1 / len1) * r;
    const ax = curr.x + (dx2 / len2) * r, ay = curr.y + (dy2 / len2) * r;
    path += ` L ${bx} ${by} Q ${curr.x} ${curr.y} ${ax} ${ay}`;
  }
  path += ` L ${expanded[expanded.length - 1].x} ${expanded[expanded.length - 1].y}`;
  return path;
}

// ── Custom Gradient Edge with waypoint support ─────────────────────────────────

const GradientEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const reactFlowInstance = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<{ type: 'waypoint' | 'midpoint' | 'hpair' | 'vpair'; index: number } | null>(null);
  const isVisible = hovered || !!data?.isEdgeHovered;
  const isSelected = !!data?.isEdgeSelected;
  const waypoints: Array<{ x: number; y: number }> = (data?.waypoints || []).filter((p: any) => p != null && typeof p?.x === 'number' && typeof p?.y === 'number');
  const onWaypointsChange: ((wp: Array<{ x: number; y: number }>) => void) | undefined = data?.onWaypointsChange;

  // Build path through waypoints (filter out any null/undefined entries)
  const allPoints = [
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ].filter((p): p is { x: number; y: number } => p != null && typeof p?.x === 'number' && typeof p?.y === 'number');

  // Always use orthogonal path for consistency between rendered edge and handles
  const edgePath = buildOrthogonalPath(allPoints);

  // Label position: midpoint of all points
  const labelX = allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length;
  const labelY = allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length;

  // Compute midpoint handles: one on EVERY rendered H/V segment of the orthogonal path
  const expandedPoints = expandToOrthogonal(allPoints);
  const segmentMidpoints = useMemo(() => {
    let logIdx = 0;
    return expandedPoints.slice(0, -1)
      .map((p, i) => {
        const next = expandedPoints[i + 1];
        if (logIdx < allPoints.length - 1) {
          const ap = allPoints[logIdx + 1];
          if (ap && Math.abs(p.x - ap.x) < 1 && Math.abs(p.y - ap.y) < 1) {
            logIdx++;
          }
        }
        const isHorizontal = Math.abs(p.y - next.y) < 1;
        const segLen = Math.abs(next.x - p.x) + Math.abs(next.y - p.y);
        return {
          x: (p.x + next.x) / 2,
          y: (p.y + next.y) / 2,
          isHorizontal,
          segStart: p,
          segEnd: next,
          wpInsertIdx: logIdx,
          segLen,
        };
      })
      // Skip only zero-length segments (degenerate points), show handles on all real segments
      .filter(seg => seg.segLen > 2);
  }, [allPoints, expandedPoints]);

  const sourceColor = data?.sourceColor || 'hsl(var(--primary))';
  const targetColor = data?.targetColor || 'hsl(var(--primary))';
  const gradientId = `gradient-${id}`;

  // Use refs for drag handler to avoid stale closures
  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;
  const segmentMidpointsRef = useRef(segmentMidpoints);
  segmentMidpointsRef.current = segmentMidpoints;
  const onWaypointsChangeRef = useRef(onWaypointsChange);
  onWaypointsChangeRef.current = onWaypointsChange;

  // Drag handling
  useEffect(() => {
    if (!draggingIdx) return;
    const onMouseMove = (e: MouseEvent) => {
      const pos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const currentWp = waypointsRef.current;
      const onChange = onWaypointsChangeRef.current;

      if (draggingIdx.type === 'waypoint') {
        const newWp = [...currentWp];
        newWp[draggingIdx.index] = { x: Math.round(pos.x / 10) * 10, y: Math.round(pos.y / 10) * 10 };
        onChange?.(newWp);
      } else if (draggingIdx.type === 'midpoint') {
        const seg = segmentMidpointsRef.current[draggingIdx.index];
        if (!seg) return;
        const snapped = { x: Math.round(pos.x / 10) * 10, y: Math.round(pos.y / 10) * 10 };
        const newWp = [...currentWp];
        const wpInsertIdx = seg.wpInsertIdx;
        if (seg.isHorizontal) {
          const corner1 = { x: seg.segStart.x, y: snapped.y };
          const corner2 = { x: seg.segEnd.x, y: snapped.y };
          newWp.splice(wpInsertIdx, 0, corner1, corner2);
          onChange?.(newWp);
          setDraggingIdx({ type: 'hpair', index: wpInsertIdx });
        } else {
          const corner1 = { x: snapped.x, y: seg.segStart.y };
          const corner2 = { x: snapped.x, y: seg.segEnd.y };
          newWp.splice(wpInsertIdx, 0, corner1, corner2);
          onChange?.(newWp);
          setDraggingIdx({ type: 'vpair', index: wpInsertIdx });
        }
      } else if (draggingIdx.type === 'hpair') {
        const snappedY = Math.round(pos.y / 10) * 10;
        const newWp = [...currentWp];
        if (newWp[draggingIdx.index] && newWp[draggingIdx.index + 1]) {
          newWp[draggingIdx.index] = { ...newWp[draggingIdx.index], y: snappedY };
          newWp[draggingIdx.index + 1] = { ...newWp[draggingIdx.index + 1], y: snappedY };
          onChange?.(newWp);
        }
      } else if (draggingIdx.type === 'vpair') {
        const snappedX = Math.round(pos.x / 10) * 10;
        const newWp = [...currentWp];
        if (newWp[draggingIdx.index] && newWp[draggingIdx.index + 1]) {
          newWp[draggingIdx.index] = { ...newWp[draggingIdx.index], x: snappedX };
          newWp[draggingIdx.index + 1] = { ...newWp[draggingIdx.index + 1], x: snappedX };
          onChange?.(newWp);
        }
      }
    };
    const onMouseUp = () => {
      setDraggingIdx(null);
      // Clean up redundant waypoints: remove collinear points and near-duplicates
      const wp = waypointsRef.current;
      if (wp.length > 0) {
        const source = { x: sourceX, y: sourceY };
        const target = { x: targetX, y: targetY };
        const all = [source, ...wp, target];
        const cleaned: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < wp.length; i++) {
          const prev = i === 0 ? source : cleaned[cleaned.length - 1] || source;
          const curr = wp[i];
          const next = i < wp.length - 1 ? wp[i + 1] : target;
          if (!curr) continue;
          // Skip if collinear horizontally (all share same y)
          if (Math.abs(prev.y - curr.y) < 2 && Math.abs(curr.y - next.y) < 2) continue;
          // Skip if collinear vertically (all share same x)
          if (Math.abs(prev.x - curr.x) < 2 && Math.abs(curr.x - next.x) < 2) continue;
          // Skip near-duplicate of previous
          if (cleaned.length > 0) {
            const last = cleaned[cleaned.length - 1];
            if (Math.abs(last.x - curr.x) < 2 && Math.abs(last.y - curr.y) < 2) continue;
          }
          cleaned.push(curr);
        }
        if (cleaned.length !== wp.length) {
          onWaypointsChangeRef.current?.(cleaned);
        }
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingIdx, reactFlowInstance]);

  // Double-click waypoint to remove it
  const handleWaypointDoubleClick = (wpIdx: number) => {
    const newWp = waypoints.filter((_, i) => i !== wpIdx);
    onWaypointsChange?.(newWp);
  };

  return (
    <>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      {/* Invisible wider path for easier hover/click target */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ pointerEvents: 'stroke' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: data?.useGradient ? `url(#${gradientId})` : style.stroke,
          strokeWidth: isVisible ? 3 : (style.strokeWidth || 2),
          transition: 'stroke-width 0.15s ease',
        }}
        markerEnd={markerEnd}
      />
      {/* Label on hover */}
      {label && isVisible && (
        <EdgeLabelRenderer>
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              background: 'hsl(var(--background))',
              opacity: 0.95,
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Waypoint drag handles (visible only when edge is selected) */}
      {isSelected && (
        <EdgeLabelRenderer>
          {/* Existing waypoint handles — drag to move, double-click to remove */}
          {waypoints.map((wp, i) => (
            <div
              key={`wp-${i}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setDraggingIdx({ type: 'waypoint', index: i });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleWaypointDoubleClick(i);
              }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${wp.x}px,${wp.y}px)`,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'hsl(var(--primary))',
                border: '2px solid hsl(var(--background))',
                cursor: 'grab',
                pointerEvents: 'all',
                zIndex: 20,
                boxShadow: '0 0 6px hsla(var(--primary) / 0.5)',
              }}
            />
          ))}
          {/* Segment midpoint handles — drag to insert a new waypoint */}
          {segmentMidpoints.map((mp, i) => (
            <div
              key={`mid-${i}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setDraggingIdx({ type: 'midpoint', index: i });
              }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${mp.x}px,${mp.y}px)`,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'hsla(var(--primary) / 0.5)',
                border: '2px solid hsl(var(--primary))',
                cursor: 'grab',
                pointerEvents: 'all',
                zIndex: 19,
                opacity: 0.7,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLDivElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.target as HTMLDivElement).style.opacity = '0.7'; }}
            />
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = { gradient: GradientEdge };

// ── Custom Node Component ──────────────────────────────────────────────────────

interface CategoryNodeData {
  category: ToolCategory;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  isSelected: boolean;
  isHovered: boolean;
  isEdgeUpdating: boolean;
  edgeUpdateHandleType: 'source' | 'target' | null;
  matchedApps: MatchedApp[];
  [key: string]: unknown;
}

const CategoryNode = ({ data }: { data: CategoryNodeData }) => {
  const { category, onSelect, onHover, isSelected, isHovered, isEdgeUpdating, edgeUpdateHandleType, matchedApps } = data;
  const colorVar = category.color;
  const highlighted = isSelected || isHovered;
  const hasApps = matchedApps.length > 0;

  return (
    <>
      {/* Each side has both source and target handles, both pinned to the exact center of their side */}
      {(['Top', 'Bottom', 'Left', 'Right'] as const).map(side => {
        // When dragging source end, RF needs a target handle to drop on (and vice versa)
        const showTarget = isEdgeUpdating && edgeUpdateHandleType === 'source';
        const showSource = isEdgeUpdating && edgeUpdateHandleType === 'target';

        // Force handles to the exact geometric center of each side.
        // Compute size-aware margin offsets so ReactFlow's bounding-rect
        // edge-attachment calculation always lands on the true center.
        const targetSize = showTarget ? 16 : 10;
        const sourceSize = showSource ? 16 : 10;
        const isVerticalSide = side === 'Top' || side === 'Bottom';
        const targetCenterStyle: React.CSSProperties = isVerticalSide
          ? { left: '50%', marginLeft: -targetSize / 2 }
          : { top: '50%', marginTop: -targetSize / 2 };
        const sourceCenterStyle: React.CSSProperties = isVerticalSide
          ? { left: '50%', marginLeft: -sourceSize / 2 }
          : { top: '50%', marginTop: -sourceSize / 2 };

        return (
          <React.Fragment key={side}>
            <Handle
              type="target"
              position={Position[side]}
              id={`${side.toLowerCase()}-target`}
              className="infra-handle"
              style={{
                ...targetCenterStyle,
                width: showTarget ? 16 : 10,
                height: showTarget ? 16 : 10,
                borderRadius: '50%',
                background: `hsl(var(${colorVar}))`,
                border: showTarget ? `3px solid hsl(var(${colorVar}))` : '2px solid hsl(var(--background))',
                opacity: showTarget ? 1 : 0,
                transition: 'all 0.15s ease',
                boxShadow: showTarget ? `0 0 8px hsla(var(${colorVar}) / 0.5)` : 'none',
                zIndex: showTarget ? 10 : 0,
                pointerEvents: showTarget ? 'auto' : 'none',
              }}
            />
            <Handle
              type="source"
              position={Position[side]}
              id={`${side.toLowerCase()}-source`}
              className="infra-handle"
              style={{
                ...sourceCenterStyle,
                width: showSource ? 16 : 10,
                height: showSource ? 16 : 10,
                borderRadius: '50%',
                background: `hsl(var(${colorVar}))`,
                border: showSource ? `3px solid hsl(var(${colorVar}))` : '2px solid hsl(var(--background))',
                opacity: showSource ? 1 : 0,
                transition: 'all 0.15s ease',
                boxShadow: showSource ? `0 0 8px hsla(var(${colorVar}) / 0.5)` : 'none',
                zIndex: showSource ? 10 : 0,
                pointerEvents: showSource ? 'auto' : 'none',
              }}
            />
          </React.Fragment>
        );
      })}

      <Box
        onClick={() => onSelect(category.id)}
        onMouseEnter={() => onHover(category.id)}
        onMouseLeave={() => onHover(null)}
        sx={{
          width: 200,
          p: 2,
          borderRadius: 3,
          border: highlighted
            ? `2px solid hsl(var(${colorVar}))`
            : hasApps
              ? `1px solid hsla(var(${colorVar}) / 0.4)`
              : '1px solid hsl(var(--border))',
          bgcolor: highlighted
            ? `hsla(var(${colorVar}) / 0.08)`
            : hasApps
              ? `hsla(var(${colorVar}) / 0.04)`
              : 'hsl(var(--card))',
          opacity: hasApps ? 1 : 0.45,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            opacity: 1,
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 24px hsla(var(${colorVar}) / 0.15)`,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `hsla(var(${colorVar}) / 0.12)`,
            color: `hsl(var(${colorVar}))`,
            flexShrink: 0,
          }}>
            {category.icon}
          </Box>
          <Typography sx={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: hasApps ? `hsl(var(${colorVar}))` : 'hsl(var(--muted-foreground))',
          }}>
            {category.label}
          </Typography>
        </Box>

        {/* Matched app icons */}
        {hasApps && (
          <Box sx={{
            display: 'flex',
            gap: 0.5,
            flexWrap: 'wrap',
            pt: 1,
            borderTop: `1px solid hsla(var(${colorVar}) / 0.15)`,
          }}>
            {matchedApps.slice(0, 5).map(app => (
              <Tooltip key={app.name} title={app.name} placement="top" arrow>
                <Avatar
                  src={app.image}
                  sx={{
                    width: 22,
                    height: 22,
                    fontSize: '0.6rem',
                    bgcolor: 'hsl(var(--muted))',
                    '& img': { objectFit: 'contain', p: 0.25 },
                  }}
                >
                  {app.name.charAt(0).toUpperCase()}
                </Avatar>
              </Tooltip>
            ))}
            {matchedApps.length > 5 && (
              <Avatar sx={{
                width: 22,
                height: 22,
                fontSize: '0.55rem',
                bgcolor: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
              }}>
                +{matchedApps.length - 5}
              </Avatar>
            )}
          </Box>
        )}
      </Box>
    </>
  );
};

const nodeTypes = { category: CategoryNode };

// ── Layout positions ───────────────────────────────────────────────────────────

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  cloud:            { x: 0,    y: 0 },
  iam:              { x: 290,  y: 0 },
  edr:              { x: 570,  y: 0 },
  network:          { x: 860,  y: 20 },
  email:            { x: 1120, y: 0 },
  asset_management: { x: 0,    y: 270 },
  siem:             { x: 430,  y: 270 },
  threat_intel:     { x: 840,  y: 270 },
  case_management:  { x: 640,  y: 520 },
  communication:    { x: 640,  y: 830 },
};

const DEFAULT_HANDLES: Record<string, { sourceHandle: string; targetHandle: string }> = {
  'e-0': { sourceHandle: 'right-source', targetHandle: 'top-target' },
  'e-1': { sourceHandle: 'bottom-source', targetHandle: 'top-target' },
  'e-2': { sourceHandle: 'bottom-source', targetHandle: 'top-target' },
  'e-3': { sourceHandle: 'bottom-source', targetHandle: 'top-target' },
  'e-4': { sourceHandle: 'bottom-source', targetHandle: 'right-target' },
  'e-5': { sourceHandle: 'left-source', targetHandle: 'top-target' },
  'e-6': { sourceHandle: 'top-source', targetHandle: 'left-target' },
  'e-7': { sourceHandle: 'top-source', targetHandle: 'right-target' },
  'e-8': { sourceHandle: 'bottom-source', targetHandle: 'top-target' },
  'e-9': { sourceHandle: 'left-source', targetHandle: 'top-target' },
  'e-10': { sourceHandle: 'left-source', targetHandle: 'top-target' },
  'e-11': { sourceHandle: 'bottom-source', targetHandle: 'top-target' },
  'e-12': { sourceHandle: 'bottom-source', targetHandle: 'right-target' },
  'e-13': { sourceHandle: 'right-source', targetHandle: 'top-target' },
  'e-14': { sourceHandle: 'bottom-source', targetHandle: 'top-target' },
  'e-15': { sourceHandle: 'right-source', targetHandle: 'left-target' },
  'e-16': { sourceHandle: 'top-source', targetHandle: 'top-target' },
  'e-17': { sourceHandle: 'left-source', targetHandle: 'top-target' },
  'e-18': { sourceHandle: 'left-source', targetHandle: 'top-target' },
  'e-19': { sourceHandle: 'bottom-source', targetHandle: 'right-target' },
  'e-20': { sourceHandle: 'bottom-source', targetHandle: 'top-target' },
};

const DEFAULT_WAYPOINTS: Record<string, Array<{ x: number; y: number }>> = {
  'e-17': [{ x: 620, y: 572.5 }, { x: 620, y: 570 }, { x: -90, y: 570 }, { x: -90, y: -80 }, { x: 100, y: -80 }],
  'e-9': [{ x: -90, y: 572.5 }, { x: -90, y: -80 }, { x: 380, y: -80 }],
  'e-16': [{ x: 940, y: 230 }, { x: 1080, y: -200 }],
  'e-3': [{ x: 390, y: 170 }, { x: 530, y: 170 }],
  'e-13': [{ x: 240, y: 37 }, { x: 240, y: 170 }, { x: 380, y: 170 }],
  'e-1': [{ x: 960, y: 170 }],
  'e-18': [{ x: -90, y: 572.5 }, { x: -90, y: -80 }, { x: 660, y: -80 }],
  'e-10': [{ x: -90, y: 572.5 }, { x: -90, y: -80 }, { x: 670, y: -80 }],
  'e-12': [{ x: 1220, y: 320 }, { x: 1044, y: 320 }],
  'e-19': [{ x: 740, y: 720 }, { x: 1380, y: 720 }, { x: 1380, y: 52.5 }],
  'e-4': [{ x: 1220, y: 570 }, { x: 924, y: 570 }],
  'e-11': [{ x: 100, y: 430 }, { x: 730, y: 430 }],
  'e-6': [{ x: 940, y: 230 }, { x: 1080, y: 50 }, { x: 1080, y: -200 }, { x: 810, y: -200 }, { x: 810, y: 50 }, { x: 846, y: 50 }],
  'e-2': [{ x: 670, y: 170 }, { x: 530, y: 170 }],
  'e-7': [{ x: 940, y: 230 }, { x: 1080, y: 230 }, { x: 1080, y: -200 }, { x: 810, y: -200 }, { x: 810, y: 52.5 }],
};




/** Look up a tool category's color CSS variable and icon by ID. Reusable across the app. */
export const getToolCategoryMeta = (categoryId: string): { color: string; icon: React.ReactNode; label: string } | null => {
  const cat = TOOL_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return null;
  return { color: cat.color, icon: cat.icon, label: cat.label };
};

// ── Flow state helpers ─────────────────────────────────────────────────────────

type FlowState = 'disabled' | 'missing_config' | 'enabled';

/**
 * disabled      — one or both categories have no apps configured at all
 * missing_config — both categories have apps configured (Enabled requires an explicit per-flow test)
 * enabled       — reserved for future explicit per-flow test verification
 */
const getFlowState = (
  sourceConfigured: boolean,
  targetConfigured: boolean,
): FlowState => {
  if (sourceConfigured && targetConfigured) return 'missing_config';
  return 'disabled';
};

const FLOW_STATE_BADGE: Record<FlowState, { label: string; color: string; bg: string; border: string }> = {
  disabled: {
    label: 'Disabled',
    color: 'hsla(var(--muted-foreground) / 0.7)',
    bg: 'hsla(var(--muted-foreground) / 0.08)',
    border: 'hsla(var(--muted-foreground) / 0.2)',
  },
  missing_config: {
    label: 'Misconfigured',
    color: 'hsl(45 93% 47%)',
    bg: 'hsla(45 93% 47% / 0.1)',
    border: 'hsla(45 93% 47% / 0.3)',
  },
  enabled: {
    label: 'Enabled',
    color: 'hsl(142 71% 45%)',
    bg: 'hsla(142 71% 45% / 0.1)',
    border: 'hsla(142 71% 45% / 0.3)',
  },
};

// ── Shared Data Flow Card ──────────────────────────────────────────────────────

const DataFlowCard = ({
  flow,
  edgeId,
  enabled,
  flowState = 'disabled',
  highlighted = false,
  variant = 'full',
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  flow: (typeof DATA_FLOWS)[number];
  edgeId: string;
  enabled: boolean;
  flowState?: FlowState;
  highlighted?: boolean;
  variant?: 'full' | 'compact';
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) => {
  const sourceCat = TOOL_CATEGORIES.find(c => c.id === flow.source);
  const targetCat = TOOL_CATEGORIES.find(c => c.id === flow.target);
  const flowColor = sourceCat?.color || '--primary';

  if (variant === 'compact') {
    return (
      <Box
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          ml: 1,
          mb: 0.5,
          borderRadius: 1.5,
          border: highlighted ? `1px solid hsla(var(${flowColor}) / 0.4)` : '1px solid transparent',
          bgcolor: highlighted ? `hsla(var(${flowColor}) / 0.08)` : 'transparent',
          cursor: 'pointer',
          opacity: flowState === 'disabled' ? 0.4 : 1,
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: highlighted ? `hsla(var(${flowColor}) / 0.12)` : 'hsla(var(--muted-foreground) / 0.06)',
            borderColor: highlighted ? `hsla(var(${flowColor}) / 0.5)` : 'hsl(var(--border))',
            opacity: flowState === 'disabled' ? 0.65 : 1,
          },
        }}
      >
        <Box sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: flowState === 'enabled' ? `hsl(var(${flowColor}))` : FLOW_STATE_BADGE[flowState].color,
          flexShrink: 0,
        }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: flowState === 'enabled' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
            {flow.label}
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            → {targetCat?.label || flow.target}
          </Typography>
        </Box>
        {flowState !== 'enabled' && (
          <Typography sx={{ fontSize: '0.6rem', color: FLOW_STATE_BADGE[flowState].color, bgcolor: FLOW_STATE_BADGE[flowState].bg, border: `1px solid ${FLOW_STATE_BADGE[flowState].border}`, px: 0.75, py: 0.25, borderRadius: 0.75, flexShrink: 0 }}>
            {FLOW_STATE_BADGE[flowState].label}
          </Typography>
        )}
        {targetCat && (
          <Box sx={{ color: flowState === 'enabled' ? `hsl(var(${targetCat.color}))` : 'hsl(var(--muted-foreground))', display: 'flex', '& svg': { width: 14, height: 14 }, opacity: 0.6 }}>
            {targetCat.icon}
          </Box>
        )}
      </Box>
    );
  }

  const badge = FLOW_STATE_BADGE[flowState];

  // Full variant
  return (
    <Box
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        mb: 1.5,
        p: 2,
        borderRadius: 2,
        border: flowState === 'enabled'
          ? `1px solid hsla(var(${flowColor}) / 0.2)`
          : '1px solid hsl(var(--border))',
        bgcolor: 'hsl(var(--card))',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        opacity: flowState === 'disabled' ? 0.45 : 1,
        '&:hover': flowState === 'enabled' ? {
          bgcolor: `hsla(var(${flowColor}) / 0.06)`,
          borderColor: `hsla(var(${flowColor}) / 0.4)`,
        } : {
          bgcolor: 'hsla(var(--muted-foreground) / 0.06)',
          opacity: 0.7,
        },
      }}
    >
      {/* Title row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography sx={{
          fontSize: '0.82rem',
          fontWeight: 600,
          color: flowState === 'enabled' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          flex: 1,
        }}>
          {flow.label}
        </Typography>
        <Typography sx={{ fontSize: '0.6rem', color: badge.color, bgcolor: badge.bg, border: `1px solid ${badge.border}`, px: 0.75, py: 0.25, borderRadius: 0.75, flexShrink: 0, fontWeight: 600 }}>
          {badge.label}
        </Typography>
      </Box>

      {/* Source → Target chips */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        {sourceCat && (
          <Chip
            icon={<Box sx={{ display: 'flex', color: flowState === 'enabled' ? `hsl(var(${sourceCat.color}))` : 'hsl(var(--muted-foreground))', '& svg': { width: 12, height: 12 } }}>{sourceCat.icon}</Box>}
            label={sourceCat.label}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.65rem',
              bgcolor: flowState === 'enabled' ? `hsla(var(${sourceCat.color}) / 0.08)` : 'hsla(var(--muted-foreground) / 0.06)',
              color: flowState === 'enabled' ? `hsl(var(${sourceCat.color}))` : 'hsl(var(--muted-foreground))',
              border: flowState === 'enabled' ? `1px solid hsla(var(${sourceCat.color}) / 0.2)` : '1px solid hsl(var(--border))',
              fontWeight: 600,
              '& .MuiChip-icon': { ml: 0.5 },
            }}
          />
        )}
        <ArrowRight size={12} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
        {targetCat && (
          <Chip
            icon={<Box sx={{ display: 'flex', color: flowState === 'enabled' ? `hsl(var(${targetCat.color}))` : 'hsl(var(--muted-foreground))', '& svg': { width: 12, height: 12 } }}>{targetCat.icon}</Box>}
            label={targetCat.label}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.65rem',
              bgcolor: flowState === 'enabled' ? `hsla(var(${targetCat.color}) / 0.08)` : 'hsla(var(--muted-foreground) / 0.06)',
              color: flowState === 'enabled' ? `hsl(var(${targetCat.color}))` : 'hsl(var(--muted-foreground))',
              border: flowState === 'enabled' ? `1px solid hsla(var(${targetCat.color}) / 0.2)` : '1px solid hsl(var(--border))',
              fontWeight: 600,
              '& .MuiChip-icon': { ml: 0.5 },
            }}
          />
        )}
      </Box>

      {/* Description */}
      <Typography sx={{
        fontSize: '0.73rem',
        color: flowState === 'enabled' ? 'hsl(var(--muted-foreground))' : 'hsla(var(--muted-foreground) / 0.6)',
        lineHeight: 1.55,
      }}>
        {flow.description}
      </Typography>
    </Box>
  );
};


// ── All Data Flows Drawer ──────────────────────────────────────────────────────

const PHASE_ICONS: Record<FlowPhase, React.ReactNode> = {
  ingest: <Download size={16} />,
  response: <Zap size={16} />,
  correlation: <Activity size={16} />,
};

const AllDataFlowsDrawer = ({
  open,
  onClose,
  onSelectFlow,
  onSelectCategory,
  activeCategories,
  configuredCategories,
  highlightEdgeIdx,
  enabledFlows,
  initialFilter,
}: {
  open: boolean;
  onClose: () => void;
  onSelectFlow: (edgeIdx: number) => void;
  onSelectCategory: (categoryId: string) => void;
  activeCategories: Set<string>;
  configuredCategories: Set<string>;
  highlightEdgeIdx: number | null;
  enabledFlows: Set<string>;
  initialFilter?: FlowState | null;
}) => {
  const [activeFilter, setActiveFilter] = useState<FlowState | null>(null);

  // Sync filter when drawer opens with a pre-selected filter
  useEffect(() => {
    if (open) setActiveFilter(initialFilter ?? null);
  }, [open, initialFilter]);

  // Compute flow state for each flow
  const flowsWithState = useMemo(() => DATA_FLOWS.map((flow, idx) => {
    const edgeId = `e-${idx}`;
    const isManuallyEnabled = enabledFlows.has(edgeId);
    const base = getFlowState(configuredCategories.has(flow.source), configuredCategories.has(flow.target));
    const state: FlowState = isManuallyEnabled && base === 'missing_config' ? 'enabled' : base;
    return { flow, idx, state };
  }), [configuredCategories, enabledFlows]);

  // Group flows by phase, applying filter
  const groupedByPhase = useMemo(() => {
    const groups: Record<FlowPhase, { flow: (typeof DATA_FLOWS)[number]; idx: number; state: FlowState }[]> = {
      ingest: [],
      response: [],
      correlation: [],
    };
    flowsWithState.forEach(({ flow, idx, state }) => {
      if (activeFilter && state !== activeFilter) return;
      groups[flow.phase].push({ flow, idx, state });
    });
    return groups;
  }, [flowsWithState, activeFilter]);

  const filteredTotal = useMemo(() => flowsWithState.filter(f => !activeFilter || f.state === activeFilter).length, [flowsWithState, activeFilter]);

  // Filter pill button
  const FilterPill = ({ state, label, color }: { state: FlowState; label: string; color: string }) => {
    const count = flowsWithState.filter(f => f.state === state).length;
    const isActive = activeFilter === state;
    return (
      <Box
        onClick={() => setActiveFilter(isActive ? null : state)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.4,
          borderRadius: 1.5,
          border: `1px solid ${isActive ? color : 'hsl(var(--border))'}`,
          bgcolor: isActive ? `${color}22` : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          '&:hover': { borderColor: color, bgcolor: `${color}14` },
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.68rem', color: isActive ? color : 'hsl(var(--muted-foreground))', fontWeight: isActive ? 700 : 500 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: isActive ? color : 'hsl(var(--muted-foreground))', fontWeight: 700, ml: 0.25 }}>
          {count}
        </Typography>
      </Box>
    );
  };

  return (
    <Drawer
      anchor="right"
      variant="persistent"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 440 },
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: '1px solid hsl(var(--border))',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3,
        py: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: '1px solid hsl(var(--border))',
      }}>
        <Box sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'hsla(var(--primary) / 0.12)',
          color: 'hsl(var(--primary))',
        }}>
          <Activity size={22} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', color: 'hsl(var(--foreground))' }}>
            All Data Flows
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            {activeFilter ? `${filteredTotal} of ${DATA_FLOWS.length}` : DATA_FLOWS.length} connections
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Phase guide intro + filter pills */}
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid hsl(var(--border))', bgcolor: 'hsla(var(--muted) / 0.3)' }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6, mb: 1.25 }}>
          Data flows are organised into <strong style={{ color: 'hsl(var(--foreground))' }}>3 phases</strong> — work through them in order to build a fully automated security stack.
        </Typography>
        {/* Filter pills */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.6rem', color: 'hsl(var(--muted-foreground))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', mr: 0.25 }}>Filter:</Typography>
          <FilterPill state="enabled" label="Enabled" color="hsl(142 71% 45%)" />
          <FilterPill state="missing_config" label="Misconfigured" color="hsl(45 93% 47%)" />
          <FilterPill state="disabled" label="Disabled" color="hsla(var(--muted-foreground) / 0.6)" />
          {activeFilter && (
            <Box
              onClick={() => setActiveFilter(null)}
              sx={{ ml: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.25 }}
            >
              <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--primary))' }}>Clear</Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Flow list grouped by phase */}
      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        {FLOW_PHASES.map((phase) => {
          const flows = groupedByPhase[phase.id];
          if (!flows.length) return null;

          return (
            <Box key={phase.id} sx={{ mb: 3 }}>
              {/* Phase header */}
              <Box sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                mb: 1.5,
                p: 1.5,
                borderRadius: 2,
                border: `1px solid hsla(var(${phase.color}) / 0.25)`,
                bgcolor: `hsla(var(${phase.color}) / 0.06)`,
              }}>
                {/* Step badge */}
                <Box sx={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: `hsl(var(${phase.color}))`,
                  color: 'hsl(var(--background))',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  flexShrink: 0,
                  mt: 0.1,
                }}>
                  {phase.step}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                    <Box sx={{ color: `hsl(var(${phase.color}))`, display: 'flex' }}>
                      {PHASE_ICONS[phase.id]}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: `hsl(var(${phase.color}))` }}>
                      {phase.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', ml: 'auto', flexShrink: 0 }}>
                      {flows.length} flow{flows.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                    {phase.subtitle}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ ml: 0.5 }}>
                {flows.map(({ flow, idx, state }) => (
                  <DataFlowCard
                    key={idx}
                    flow={flow}
                    edgeId={`e-${idx}`}
                    enabled={activeCategories.has(flow.source) && activeCategories.has(flow.target)}
                    flowState={state}
                    highlighted={highlightEdgeIdx === idx}
                    variant="compact"
                    onClick={() => { onClose(); onSelectFlow(idx); }}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
        {filteredTotal === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>No flows match this filter.</Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};



const EdgeDetailDrawer = ({
  flow,
  edgeIdx,
  open,
  onClose,
  onSelectCategory,
  onViewAllFlows,
  activeCategories,
  configuredCategories,
  categoryApps,
  enabledFlows,
  onToggleEnabled,
}: {
  flow: (typeof DATA_FLOWS)[number] | null;
  edgeIdx: number | null;
  open: boolean;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
  onViewAllFlows: (fromEdgeIdx: number) => void;
  activeCategories: Set<string>;
  configuredCategories: Set<string>;
  categoryApps: Record<string, MatchedApp[]>;
  enabledFlows: Set<string>;
  onToggleEnabled: (edgeId: string) => void;
}) => {
  if (!flow) return null;
  const edgeId = edgeIdx !== null ? `e-${edgeIdx}` : '';
  const isManuallyEnabled = enabledFlows.has(edgeId);

  const sourceCat = getToolCategoryMeta(flow.source);
  const targetCat = getToolCategoryMeta(flow.target);
  const headerColor = sourceCat?.color || '--primary';

  const sourceConfigured = configuredCategories.has(flow.source);
  const targetConfigured = configuredCategories.has(flow.target);
  const sourceActive = activeCategories.has(flow.source);
  const targetActive = activeCategories.has(flow.target);
  const baseFlowState = getFlowState(sourceConfigured, targetConfigured);
  const flowState: FlowState = isManuallyEnabled && baseFlowState === 'missing_config' ? 'enabled' : baseFlowState;
  const badge = FLOW_STATE_BADGE[flowState];

  // Check if at least one side has a validated app
  const sourceApps = categoryApps[flow.source] || [];
  const targetApps = categoryApps[flow.target] || [];
  const hasValidApp = sourceApps.some(a => a.hasValidAuth) || targetApps.some(a => a.hasValidAuth);
  const canEnable = baseFlowState === 'missing_config' && hasValidApp;

  return (
    <Drawer
      anchor="right"
      variant="persistent"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 440 },
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: '1px solid hsl(var(--border))',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        },
      }}
    >
      {/* Back to All Data Flows */}
      <Box
        onClick={() => edgeIdx !== null && onViewAllFlows(edgeIdx)}
        sx={{
          px: 3,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          cursor: 'pointer',
          borderBottom: '1px solid hsl(var(--border))',
          transition: 'background 0.15s ease',
          '&:hover': { bgcolor: 'hsla(var(--primary) / 0.06)' },
        }}
      >
        <ChevronRight size={14} style={{ color: 'hsl(var(--primary))', transform: 'rotate(180deg)' }} />
        <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>
          All Data Flows
        </Typography>
      </Box>

      {/* Header */}
      <Box sx={{
        px: 3,
        py: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: '1px solid hsl(var(--border))',
      }}>
        <Box sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `hsla(var(${headerColor}) / 0.12)`,
          color: `hsl(var(${headerColor}))`,
        }}>
          {sourceCat?.icon || <ArrowRight size={22} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
            {flow.label}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            Data Flow Connection
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Status */}
      <Box sx={{
        px: 3,
        py: 2,
        borderBottom: '1px solid hsl(var(--border))',
        bgcolor: `${badge.bg}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
      }}>
        <Box sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: badge.color,
          mt: '5px',
          flexShrink: 0,
          boxShadow: flowState === 'enabled' ? `0 0 6px ${badge.color}` : 'none',
        }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: badge.color, lineHeight: 1.3 }}>
            {badge.label}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
            {flowState === 'enabled'
              ? 'Both endpoints are configured and the flow has been verified.'
              : flowState === 'missing_config'
              ? 'Both categories are configured but this flow has not been tested yet.'
              : 'One or both categories have no apps configured yet.'}
          </Typography>
          {/* Enable / Revert buttons */}
          {flowState === 'enabled' ? (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'hsl(142 71% 45%)', fontWeight: 600 }}>
                ✓ Manually marked as Enabled
              </Typography>
              <Button
                size="small"
                onClick={() => onToggleEnabled(edgeId)}
                sx={{
                  color: 'hsl(var(--muted-foreground))',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  px: 1.5,
                  py: 0.25,
                  borderRadius: 1,
                  textTransform: 'none',
                  border: '1px solid hsla(var(--muted-foreground) / 0.25)',
                  '&:hover': { bgcolor: 'hsla(var(--muted-foreground) / 0.1)', borderColor: 'hsl(var(--muted-foreground))' },
                }}
              >
                Mark as Misconfigured
              </Button>
            </Box>
          ) : canEnable ? (
            <Box sx={{ mt: 1.5 }}>
              <Button
                size="small"
                onClick={() => onToggleEnabled(edgeId)}
                sx={{
                  bgcolor: 'hsl(142 71% 45%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  px: 2,
                  py: 0.5,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'hsl(142 71% 38%)' },
                }}
              >
                Mark as Enabled
              </Button>
            </Box>
          ) : null}
        </Box>
      </Box>

      {/* Flow direction */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid hsl(var(--border))' }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
          Connection Path
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          {sourceCat && (
            <Chip
              icon={<Box sx={{ display: 'flex', color: sourceActive ? `hsl(var(${sourceCat.color}))` : 'hsl(var(--muted-foreground))' }}>{sourceCat.icon}</Box>}
              label={sourceCat.label}
              size="small"
              onClick={() => onSelectCategory(flow.source)}
              sx={{
                bgcolor: sourceActive ? `hsla(var(${sourceCat.color}) / 0.1)` : 'hsla(var(--muted-foreground) / 0.08)',
                color: sourceActive ? `hsl(var(${sourceCat.color}))` : 'hsl(var(--muted-foreground))',
                fontWeight: 600,
                fontSize: '0.8rem',
                border: sourceActive
                  ? `1px solid hsla(var(${sourceCat.color}) / 0.25)`
                  : '1px solid hsla(var(--muted-foreground) / 0.2)',
                cursor: 'pointer',
                '&:hover': { bgcolor: sourceActive ? `hsla(var(${sourceCat.color}) / 0.2)` : 'hsla(var(--muted-foreground) / 0.15)' },
              }}
            />
          )}
          <ArrowRight size={16} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
          {targetCat && (
            <Chip
              icon={<Box sx={{ display: 'flex', color: targetActive ? `hsl(var(${targetCat.color}))` : 'hsl(var(--muted-foreground))' }}>{targetCat.icon}</Box>}
              label={targetCat.label}
              size="small"
              onClick={() => onSelectCategory(flow.target)}
              sx={{
                bgcolor: targetActive ? `hsla(var(${targetCat.color}) / 0.1)` : 'hsla(var(--muted-foreground) / 0.08)',
                color: targetActive ? `hsl(var(${targetCat.color}))` : 'hsl(var(--muted-foreground))',
                fontWeight: 600,
                fontSize: '0.8rem',
                border: targetActive
                  ? `1px solid hsla(var(${targetCat.color}) / 0.25)`
                  : '1px solid hsla(var(--muted-foreground) / 0.2)',
                cursor: 'pointer',
                '&:hover': { bgcolor: targetActive ? `hsla(var(${targetCat.color}) / 0.2)` : 'hsla(var(--muted-foreground) / 0.15)' },
              }}
            />
          )}
        </Box>
      </Box>

      {/* Description */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
          Why This Matters
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', lineHeight: 1.7 }}>
          {flow.description}
        </Typography>
      </Box>
    </Drawer>
  );
};


// ── Detail Drawer ──────────────────────────────────────────────────────────────

const CategoryDetailDrawer = ({
  category,
  matchedApps,
  open,
  onClose,
  onEdgeHover,
  onEdgeClick,
  onViewAllFlows,
  activeCategories,
  configuredCategories,
}: {
  category: ToolCategory | null;
  matchedApps: MatchedApp[];
  open: boolean;
  onClose: () => void;
  onEdgeHover: (edgeId: string | null) => void;
  onEdgeClick: (edgeIdx: number) => void;
  onViewAllFlows: () => void;
  activeCategories: Set<string>;
  configuredCategories: Set<string>;
}) => {
  const navigate = useNavigate();
  const hasApps = matchedApps.length > 0;
  const [expanded, setExpanded] = React.useState(!hasApps);
  const [showSearch, setShowSearch] = React.useState(false);

  if (!category) return null;
  const colorVar = category.color;

  // Find all branches connected to this category
  const connectedFlows = DATA_FLOWS.map((flow, idx) => {
    const isSource = flow.source === category.id;
    const isTarget = flow.target === category.id;
    if (!isSource && !isTarget) return null;
    const otherCatId = isSource ? flow.target : flow.source;
    const otherCat = TOOL_CATEGORIES.find(c => c.id === otherCatId);
    return { flow, idx, isSource, otherCat };
  }).filter(Boolean) as { flow: (typeof DATA_FLOWS)[number]; idx: number; isSource: boolean; otherCat: ToolCategory | undefined }[];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 440 },
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          borderLeft: '1px solid hsl(var(--border))',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3,
        py: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: '1px solid hsl(var(--border))',
      }}>
        <Box sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `hsla(var(${colorVar}) / 0.12)`,
          color: `hsl(var(${colorVar}))`,
        }}>
          {category.icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', color: 'hsl(var(--foreground))' }}>
            {category.label}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
            {category.description}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
        {/* Your Apps — filtered IntegrationStatus for this category */}
        {matchedApps.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <IntegrationStatus
              collapsed={false}
              filterApps={matchedApps.map(a => a.name)}
              onAddClick={() => setShowSearch(true)}
            />
          </Box>
        )}

        {/* Add App Modal — shown when Plus is clicked or no apps yet */}
        {!hasApps && (
          <Box sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 1,
              }}
            >
              Find & Add Apps
            </Typography>
            <Box
              onClick={() => setShowSearch(true)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.5,
                borderRadius: 2,
                border: '1px dashed hsl(var(--border))',
                cursor: 'pointer',
                color: 'hsl(var(--muted-foreground))',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--foreground))',
                  bgcolor: 'hsl(var(--accent))',
                },
              }}
            >
              <X size={14} style={{ transform: 'rotate(45deg)' }} />
              <Typography sx={{ fontSize: '0.82rem' }}>
                Search for {category.label} tools...
              </Typography>
            </Box>
          </Box>
        )}

        {/* Add App Modal */}
        <AddAppModal
          open={showSearch}
          onClose={() => setShowSearch(false)}
          initialQuery={category.label}
          categoryLabel={category.label}
        />


        {!hasApps && <Box sx={{ mb: 3, border: '1px solid hsl(var(--border))', borderRadius: 2, overflow: 'hidden' }}>
              {/* Collapsible header */}
              <Box
                onClick={() => setExpanded(v => !v)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                  bgcolor: expanded ? `hsla(var(${colorVar}) / 0.06)` : 'transparent',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: `hsla(var(${colorVar}) / 0.08)` },
                }}
              >
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Common Tools &amp; Sub-categories
                </Typography>
                <Box sx={{ color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </Box>
              </Box>
              {/* Collapsible content */}
              {expanded && (
                <Box sx={{ px: 2, pt: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {/* Common Tools */}
                  <Box>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                      Common Tools
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {category.examples.slice(0, 6).map(ex => (
                        <Chip
                          key={ex}
                          avatar={<Avatar src={`https://shuffler.io/images/apps/${ex.toLowerCase().replace(/\s+/g, '_')}.png`} sx={{ width: 18, height: 18, '& img': { objectFit: 'contain' } }} />}
                          label={ex}
                          size="small"
                          clickable
                          onClick={() => navigate(`/apps/${ex.toLowerCase().replace(/\s+/g, '_')}`)}
                          sx={{
                            height: 26,
                            fontSize: '0.72rem',
                            bgcolor: `hsla(var(${colorVar}) / 0.08)`,
                            color: 'hsl(var(--foreground))',
                            border: `1px solid hsla(var(${colorVar}) / 0.2)`,
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: `hsla(var(${colorVar}) / 0.18)`,
                              borderColor: `hsla(var(${colorVar}) / 0.4)`,
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Sub-categories */}
                  {category.subcategories.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                        Sub-categories
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {category.subcategories.map(sub => (
                          <Box
                            key={sub.label}
                            sx={{
                              px: 1.5,
                              py: 1,
                              borderRadius: 1.5,
                              bgcolor: `hsla(var(${colorVar}) / 0.06)`,
                              border: `1px solid hsla(var(${colorVar}) / 0.15)`,
                            }}
                          >
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: `hsl(var(${colorVar}))` }}>
                              {sub.label}
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', mt: 0.25 }}>
                              {sub.description}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>}

        {/* Data Flows — branch-based "How to use" */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Data Flows
            </Typography>
            <Chip
              label="View All"
              size="small"
              icon={<Activity size={11} />}
              onClick={onViewAllFlows}
              sx={{
                height: 22,
                fontSize: '0.65rem',
                bgcolor: 'hsla(var(--primary) / 0.08)',
                color: 'hsl(var(--primary))',
                border: '1px solid hsla(var(--primary) / 0.2)',
                cursor: 'pointer',
                '& .MuiChip-icon': { color: 'hsl(var(--primary))' },
                '&:hover': { bgcolor: 'hsla(var(--primary) / 0.16)' },
              }}
            />
          </Box>
          {connectedFlows.map(({ flow, idx }) => {
            const edgeId = `e-${idx}`;
            const isEnabled = activeCategories.has(flow.source) && activeCategories.has(flow.target);
            const flowState = getFlowState(configuredCategories.has(flow.source), configuredCategories.has(flow.target));
            return (
              <DataFlowCard
                key={edgeId}
                flow={flow}
                edgeId={edgeId}
                enabled={isEnabled}
                flowState={flowState}
                variant="full"
                onClick={() => onEdgeClick(idx)}
                onMouseEnter={() => onEdgeHover(edgeId)}
                onMouseLeave={() => onEdgeHover(null)}
              />
            );
          })}
        </Box>
      </Box>
    </Drawer>
  );
};

// ── Helper Lines Renderer ──────────────────────────────────────────────────────

const HelperLinesRenderer = ({ horizontal, vertical }: { horizontal?: number; vertical?: number }) => {
  const { x, y, zoom } = useViewport();
  if (horizontal === undefined && vertical === undefined) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {horizontal !== undefined && (
        <line
          x1="0"
          x2="100%"
          y1={horizontal * zoom + y}
          y2={horizontal * zoom + y}
          stroke="hsl(var(--primary))"
          strokeWidth={1}
          strokeDasharray="6 3"
          opacity={0.7}
        />
      )}
      {vertical !== undefined && (
        <line
          x1={vertical * zoom + x}
          x2={vertical * zoom + x}
          y1="0"
          y2="100%"
          stroke="hsl(var(--primary))"
          strokeWidth={1}
          strokeDasharray="6 3"
          opacity={0.7}
        />
      )}
    </svg>
  );
};

// ── Page Component ─────────────────────────────────────────────────────────────

const POSITION_CACHE_KEY = 'infrastructure_node_positions';
const HANDLE_CACHE_KEY = 'infrastructure_edge_handles';
const WAYPOINT_CACHE_KEY = 'infrastructure_edge_waypoints';
const ENABLED_FLOWS_CACHE_KEY = 'infrastructure_enabled_flows';

type WaypointOverrides = Record<string, Array<{ x: number; y: number }>>;
type HandleOverrides = Record<string, { sourceHandle?: string; targetHandle?: string }>;

const InfrastructureContent = () => {
  usePageMeta({ title: 'Infrastructure', description: 'Security tool integrations and data flow visualization' });
  const reactFlowInstance = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdgeIdx, setSelectedEdgeIdx] = useState<number | null>(null);
  const [showAllFlows, setShowAllFlows] = useState(false);
  const [allFlowsFilter, setAllFlowsFilter] = useState<FlowState | null>(null);
  const [lastViewedEdgeIdx, setLastViewedEdgeIdx] = useState<number | null>(null);
  const [categoryApps, setCategoryApps] = useState<Record<string, MatchedApp[]>>({});
  const [savedHandles, setSavedHandles] = useState<HandleOverrides>({});
  const [savedWaypoints, setSavedWaypoints] = useState<WaypointOverrides>({});
  const [enabledFlows, setEnabledFlows] = useState<Set<string>>(new Set());
  const [updatingEdgeNodes, setUpdatingEdgeNodes] = useState<{ source: string; target: string; draggedEnd: 'source' | 'target' } | null>(null);
  const updatingEdgeNodesRef = useRef<{ source: string; target: string; draggedEnd: 'source' | 'target' } | null>(null);
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }> | null>(null);
  const [positionsLoaded, setPositionsLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [helperLines, setHelperLines] = useState<{ horizontal?: number; vertical?: number }>({});

  // Load saved positions and handle overrides from datastore on mount
  useEffect(() => {
    const loadData = async () => {
      try {
      const [posResult, handleResult, waypointResult, enabledResult] = await Promise.all([
        getDatastoreItem(POSITION_CACHE_KEY, DATASTORE_CATEGORIES.INFRASTRUCTURE),
        getDatastoreItem(HANDLE_CACHE_KEY, DATASTORE_CATEGORIES.INFRASTRUCTURE),
        getDatastoreItem(WAYPOINT_CACHE_KEY, DATASTORE_CATEGORIES.INFRASTRUCTURE),
        getDatastoreItem(ENABLED_FLOWS_CACHE_KEY, DATASTORE_CATEGORIES.INFRASTRUCTURE),
      ]);
      if (posResult.success && posResult.item?.value) {
        const parsed = typeof posResult.item.value === 'string' ? JSON.parse(posResult.item.value) : posResult.item.value;
        if (parsed && typeof parsed === 'object') setSavedPositions(parsed);
      }
      if (handleResult.success && handleResult.item?.value) {
        const parsed = typeof handleResult.item.value === 'string' ? JSON.parse(handleResult.item.value) : handleResult.item.value;
        if (parsed && typeof parsed === 'object') setSavedHandles(parsed);
      }
      if (waypointResult.success && waypointResult.item?.value) {
        const parsed = typeof waypointResult.item.value === 'string' ? JSON.parse(waypointResult.item.value) : waypointResult.item.value;
        if (parsed && typeof parsed === 'object') setSavedWaypoints(parsed);
      }
      if (enabledResult.success && enabledResult.item?.value) {
        const parsed = typeof enabledResult.item.value === 'string' ? JSON.parse(enabledResult.item.value) : enabledResult.item.value;
        if (Array.isArray(parsed)) setEnabledFlows(new Set(parsed));
      }
      } catch (e) {
        console.warn('Failed to load infrastructure config:', e);
      } finally {
        setPositionsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Toggle a flow between enabled and misconfigured, persisted to datastore
  const toggleFlowEnabled = useCallback((edgeId: string) => {
    setEnabledFlows(prev => {
      const next = new Set(prev);
      if (next.has(edgeId)) {
        next.delete(edgeId);
      } else {
        next.add(edgeId);
      }
      setDatastoreItem(ENABLED_FLOWS_CACHE_KEY, Array.from(next), DATASTORE_CATEGORIES.INFRASTRUCTURE)
        .catch(e => console.warn('Failed to save enabled flows:', e));
      return next;
    });
  }, []);
  const persistPositions = useCallback((positions: Record<string, { x: number; y: number }>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDatastoreItem(POSITION_CACHE_KEY, positions, DATASTORE_CATEGORIES.INFRASTRUCTURE)
        .catch(e => console.warn('Failed to save positions:', e));
    }, 1000);
  }, []);

  // Save handle overrides to datastore
  const handleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistHandles = useCallback((handles: HandleOverrides) => {
    if (handleSaveTimer.current) clearTimeout(handleSaveTimer.current);
    handleSaveTimer.current = setTimeout(() => {
      setDatastoreItem(HANDLE_CACHE_KEY, handles, DATASTORE_CATEGORIES.INFRASTRUCTURE)
        .catch(e => console.warn('Failed to save handle overrides:', e));
    }, 500);
  }, []);

  // Save waypoint overrides to datastore
  const waypointSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistWaypoints = useCallback((waypoints: WaypointOverrides) => {
    if (waypointSaveTimer.current) clearTimeout(waypointSaveTimer.current);
    waypointSaveTimer.current = setTimeout(() => {
      setDatastoreItem(WAYPOINT_CACHE_KEY, waypoints, DATASTORE_CATEGORIES.INFRASTRUCTURE)
        .catch(e => console.warn('Failed to save waypoints:', e));
    }, 500);
  }, []);

  // Fetch authenticated apps and map to categories
  useEffect(() => {
    const fetchApps = async () => {
      if (!API_CONFIG.apiKey) return;
      try {
        const response = await fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (!response.ok) return;
        const result = await response.json();
        const authData: AuthAppEntry[] = result.data || result;
        if (!Array.isArray(authData)) return;

        const dedupedApps = deduplicateAuthApps(authData);
        const mapped: Record<string, MatchedApp[]> = {};

        dedupedApps.forEach(({ app, bestImage, hasValidAuth }) => {
          const catId = matchAppToCategory(app.name, app.categories || []);
          if (!catId) return;
          if (!mapped[catId]) mapped[catId] = [];
          mapped[catId].push({ name: app.name, image: bestImage || app.large_image || '', hasValidAuth });
        });

        setCategoryApps(mapped);
      } catch (e) {
        console.error('Failed to fetch apps for infrastructure:', e);
      }
    };
    fetchApps();
  }, []);

  const activeId = selectedId || hoveredId;

  // Find the color var for the active category
  const activeCat = activeId ? TOOL_CATEGORIES.find(c => c.id === activeId) : null;
  const activeColor = activeCat ? `hsl(var(${activeCat.color}))` : 'hsl(var(--primary))';

  // Categories that have apps configured (any auth entry)
  const activeCategories = useMemo(() => {
    const set = new Set<string>();
    for (const [catId, apps] of Object.entries(categoryApps)) {
      if (apps.length > 0) set.add(catId);
    }
    return set;
  }, [categoryApps]);


  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
    setSelectedEdgeIdx(null);
  }, []);

  const handleHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  // Use saved positions if available, else default
  const getNodePosition = useCallback((catId: string) => {
    if (savedPositions && savedPositions[catId]) return savedPositions[catId];
    return NODE_POSITIONS[catId] || { x: 0, y: 0 };
  }, [savedPositions]);

  // Build initial nodes only on first load (positions + initial categoryApps)
  const initialNodes: Node[] = useMemo(() =>
    TOOL_CATEGORIES.map(cat => ({
      id: cat.id,
      type: 'category',
      position: getNodePosition(cat.id),
      draggable: true,
      data: {
        category: cat,
        onSelect: handleSelect,
        onHover: handleHover,
        isSelected: false,
        isHovered: false,
        matchedApps: categoryApps[cat.id] || [],
      },
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positionsLoaded]
  );

  const initialEdges: Edge[] = useMemo(() =>
    DATA_FLOWS.map((flow, idx) => {
      const sourceActive = activeCategories.has(flow.source);
      const targetActive = activeCategories.has(flow.target);
      const edgeId = `e-${idx}`;
      const isManuallyEnabled = enabledFlows.has(edgeId);
      // Effective state: manually enabled overrides missing_config → enabled
      const baseFlowState = getFlowState(sourceActive, targetActive);
      const flowState: FlowState = isManuallyEnabled && baseFlowState === 'missing_config' ? 'enabled' : baseFlowState;
      const bothActive = flowState === 'enabled';

      const isSelected = selectedEdgeIdx === idx;
      // When a branch is selected, ignore hover on other edges
      const isEdgeHovered = selectedEdgeIdx !== null ? isSelected : hoveredEdgeId === edgeId;
      // Highlight on hover/select
      const isConnected = isEdgeHovered || (activeId && (flow.source === activeId || flow.target === activeId));
      const isFullyHighlighted = isConnected && bothActive;

      const hasAnyFocus = selectedEdgeIdx !== null || activeId || hoveredEdgeId;

      // Get category colors for gradient
      const srcCat = TOOL_CATEGORIES.find(c => c.id === flow.source);
      const tgtCat = TOOL_CATEGORIES.find(c => c.id === flow.target);
      const srcColor = srcCat ? `hsl(var(${srcCat.color}))` : 'hsl(var(--primary))';
      const tgtColor = tgtCat ? `hsl(var(${tgtCat.color}))` : 'hsl(var(--primary))';

      // Determine stroke color — enabled edges always show gradient, hover also shows gradient
      const isEnabled = flowState === 'enabled' && bothActive;
      let stroke: string;
      let useGradient = false;
      if (isEdgeHovered) {
        // Always show gradient on hover regardless of state
        useGradient = true;
        stroke = srcColor;
      } else if (isFullyHighlighted) {
        useGradient = true;
        stroke = activeColor;
      } else if (hasAnyFocus && !isConnected) {
        // Something else is focused — dim this edge regardless of enabled state
        stroke = 'hsla(var(--muted-foreground) / 0.06)';
      } else if (isEnabled) {
        // Enabled edges show their real gradient color when nothing else is focused
        useGradient = true;
        stroke = srcColor;
      } else if (isConnected && !bothActive) {
        // Dimmed highlight for non-enabled connected edges
        stroke = flowState === 'missing_config' ? 'hsl(45 93% 47%)' : 'hsla(var(--muted-foreground) / 0.4)';
      } else if (bothActive) {
        useGradient = true;
        stroke = srcColor;
      } else if (flowState === 'missing_config') {
        stroke = 'hsl(45 93% 47%)';
      } else {
        stroke = 'hsla(var(--muted-foreground) / 0.38)';
      }

      // Stroke dash pattern: enabled and hovered edges are solid; others get dashes
      const strokeDasharray: string | undefined = (isEnabled || isEdgeHovered) ? undefined : '3 5';

      // Apply saved handle overrides or use defaults
      const handleOverride = savedHandles[edgeId];
      const sourceHandle = handleOverride?.sourceHandle || 'bottom-source';
      const targetHandle = handleOverride?.targetHandle || 'top-target';

      return {
        id: edgeId,
        source: flow.source,
        target: flow.target,
        sourceHandle,
        targetHandle,
        label: flow.label,
        animated: !!isConnected || isEnabled,
        reconnectable: true,
        zIndex: isConnected ? 10 : 0,
        type: 'gradient',
        data: {
          useGradient,
          sourceColor: useGradient ? srcColor : stroke,
          targetColor: useGradient ? tgtColor : stroke,
          isEdgeHovered,
          isEdgeSelected: isSelected,
          waypoints: savedWaypoints[edgeId] || [],
          onWaypointsChange: (newWaypoints: Array<{ x: number; y: number }>) => {
            setSavedWaypoints(prev => {
              const updated = { ...prev, [edgeId]: newWaypoints };
              if (newWaypoints.length === 0) delete updated[edgeId];
              persistWaypoints(updated);
              return updated;
            });
          },
        },
        style: {
          stroke,
          strokeWidth: isFullyHighlighted ? 2.5 : (bothActive ? 1.5 : 1),
          strokeDasharray,
          opacity: 1,
          transition: 'stroke 0.2s, stroke-width 0.2s',
          cursor: 'pointer',
        },
        labelStyle: {
          fontSize: isEdgeHovered ? 12 : 10,
          fontWeight: isFullyHighlighted ? 600 : 500,
          fill: isFullyHighlighted
            ? 'hsl(var(--foreground))'
            : 'hsl(var(--muted-foreground))',
          opacity: hasAnyFocus && !isConnected ? 0.15 : 0.8,
        },
        labelBgStyle: {
          fill: 'hsl(var(--background))',
          fillOpacity: 0.85,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: useGradient ? tgtColor : stroke,
        },
      };
    }),
    [activeId, activeColor, activeCategories, enabledFlows, hoveredEdgeId, selectedEdgeIdx, savedHandles, savedWaypoints, persistWaypoints]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync initial nodes on first load only
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);

  // When saved positions change (reset or loaded), update positions without resetting data
  useEffect(() => {
    if (savedPositions) {
      setNodes(prev => prev.map(node => ({
        ...node,
        position: savedPositions[node.id] || NODE_POSITIONS[node.id] || node.position,
      })));
    }
  }, [savedPositions, setNodes]);

  // Update node data (hover/select/apps) WITHOUT resetting positions
  useEffect(() => {
    setNodes(prev => prev.map(node => ({
      ...node,
      data: {
        ...node.data,
        onSelect: handleSelect,
        onHover: handleHover,
        isSelected: selectedId === node.id,
        isHovered: hoveredId === node.id,
        isEdgeUpdating: updatingEdgeNodes
          ? (updatingEdgeNodes.draggedEnd === 'source'
              ? node.id === updatingEdgeNodes.target
              : node.id === updatingEdgeNodes.source)
          : false,
        edgeUpdateHandleType: updatingEdgeNodes?.draggedEnd || null,
        matchedApps: categoryApps[node.id] || [],
      },
    })));
  }, [selectedId, hoveredId, categoryApps, updatingEdgeNodes, handleSelect, handleHover, setNodes]);

  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  // Alignment snap threshold (px in flow coordinates)
  const SNAP_THRESHOLD = 5;
  const NODE_W = 160; // approx node width for center calc
  const NODE_H = 80;  // approx node height for center calc

  // Max distance (in the perpendicular axis) for two nodes to be considered
  // "in the same row" or "in the same column". Keeps snapping scoped so that
  // dragging horizontally only highlights row-mates, not nodes in other rows.
  const ROW_COL_PROXIMITY = 200;

  const handleNodeDrag = useCallback((_event: any, draggedNode: any) => {
    const allNodes = reactFlowInstance.getNodes();
    const lines: { horizontal?: number; vertical?: number } = {};
    const dragCX = draggedNode.position.x + NODE_W / 2;
    const dragCY = draggedNode.position.y + NODE_H / 2;

    for (const n of allNodes) {
      if (n.id === draggedNode.id) continue;
      const cx = n.position.x + NODE_W / 2;
      const cy = n.position.y + NODE_H / 2;

      // Horizontal alignment — only snap to nodes roughly in the same row
      // (their X distance doesn't matter, but Y must already be close)
      const yDiff = Math.abs(dragCY - cy);
      if (yDiff < SNAP_THRESHOLD && Math.abs(dragCY - cy) < ROW_COL_PROXIMITY) {
        lines.horizontal = cy;
        draggedNode.position.y = cy - NODE_H / 2;
      }

      // Vertical alignment — only snap to nodes roughly in the same column
      const xDiff = Math.abs(dragCX - cx);
      if (xDiff < SNAP_THRESHOLD && Math.abs(dragCX - cx) < ROW_COL_PROXIMITY) {
        lines.vertical = cx;
        draggedNode.position.x = cx - NODE_W / 2;
      }
    }
    setHelperLines(lines);
  }, [reactFlowInstance]);

  // Persist positions when a node drag ends
  const handleNodeDragStop = useCallback((_event: any, _node: any) => {
    setHelperLines({});
    const currentNodes = reactFlowInstance.getNodes();
    const positions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach(n => {
      positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
    });
    setSavedPositions(positions);
    persistPositions(positions);
  }, [reactFlowInstance, persistPositions]);

  // Track reconnection state for visual feedback
  const edgeUpdateSuccessful = useRef(true);

  const onEdgeUpdateStart = useCallback((_: any, edge: Edge, handleType: 'source' | 'target') => {
    console.log('[EdgeUpdateStart] edge:', edge.id, 'handleType:', handleType, 'source:', edge.source, 'target:', edge.target);
    edgeUpdateSuccessful.current = false;
    const info = { source: edge.source, target: edge.target, draggedEnd: handleType };
    updatingEdgeNodesRef.current = info;
    setUpdatingEdgeNodes(info);
  }, []);

  // Allow all connections during edge update — our onEdgeUpdate normalizes direction
  const isValidConnection = useCallback((connection: Connection) => {
    if (!updatingEdgeNodes) return true;
    const { source, target } = updatingEdgeNodes;
    const valid = (
      connection.source === source || connection.source === target ||
      connection.target === source || connection.target === target
    );
    console.log('[isValidConnection]', JSON.parse(JSON.stringify(connection)), 'valid:', valid);
    return valid;
  }, [updatingEdgeNodes]);

  // Handle edge reconnection — only allow reconnecting to same source/target nodes (different handles)
  const onEdgeUpdate = useCallback((oldEdge: Edge, newConnection: Connection) => {
    console.log('[EdgeUpdate] oldEdge:', { id: oldEdge.id, source: oldEdge.source, target: oldEdge.target, sourceHandle: oldEdge.sourceHandle, targetHandle: oldEdge.targetHandle });
    console.log('[EdgeUpdate] newConnection:', JSON.parse(JSON.stringify(newConnection)));
    console.log('[EdgeUpdate] draggedEnd:', updatingEdgeNodesRef.current?.draggedEnd);
    edgeUpdateSuccessful.current = true;

    // Determine which end was being dragged (use ref for synchronous access)
    const draggedEnd = updatingEdgeNodesRef.current?.draggedEnd as 'source' | 'target' | undefined;

    // Normalize: ensure source and target nodes stay the same, only handles change
    let sourceNode = oldEdge.source;
    let targetNode = oldEdge.target;
    let newSourceHandle = oldEdge.sourceHandle || 'bottom-source';
    let newTargetHandle = oldEdge.targetHandle || 'top-target';

    if (draggedEnd === 'target') {
      // RF reports handleType 'target' when the source end is being dragged
      if (newConnection.source === sourceNode) {
        const handleSide = (newConnection.sourceHandle || '').replace(/-source|-target/, '');
        newSourceHandle = `${handleSide}-source`;
        console.log('[EdgeUpdate] source match via newConnection.source, handleSide:', handleSide);
      } else if (newConnection.target === sourceNode) {
        const handleSide = (newConnection.targetHandle || '').replace(/-source|-target/, '');
        newSourceHandle = `${handleSide}-source`;
        console.log('[EdgeUpdate] source match via newConnection.target, handleSide:', handleSide);
      } else {
        console.log('[EdgeUpdate] REJECTED: dragged source end but neither newConnection.source nor .target matches sourceNode', sourceNode);
        return;
      }
    } else {
      if (newConnection.target === targetNode) {
        const handleSide = (newConnection.targetHandle || '').replace(/-source|-target/, '');
        newTargetHandle = `${handleSide}-target`;
        console.log('[EdgeUpdate] target match via newConnection.target, handleSide:', handleSide);
      } else if (newConnection.source === targetNode) {
        const handleSide = (newConnection.sourceHandle || '').replace(/-source|-target/, '');
        newTargetHandle = `${handleSide}-target`;
        console.log('[EdgeUpdate] target match via newConnection.source, handleSide:', handleSide);
      } else {
        console.log('[EdgeUpdate] REJECTED: dragged target end but neither newConnection.source nor .target matches targetNode', targetNode);
        return;
      }
    }

    console.log('[EdgeUpdate] ACCEPTED:', { sourceNode, targetNode, newSourceHandle, newTargetHandle });

    const normalizedConnection: Connection = {
      source: sourceNode,
      target: targetNode,
      sourceHandle: newSourceHandle,
      targetHandle: newTargetHandle,
    };

    setEdges((els) => reconnectEdge(oldEdge, normalizedConnection, els));
    setSavedHandles(prev => {
      const updated = {
        ...prev,
        [oldEdge.id]: {
          sourceHandle: newSourceHandle,
          targetHandle: newTargetHandle,
        },
      };
      persistHandles(updated);
      return updated;
    });
  }, [setEdges, persistHandles]);

  const onEdgeUpdateEnd = useCallback((_: MouseEvent | TouchEvent, edge: Edge) => {
    console.log('[EdgeUpdateEnd] edgeUpdateSuccessful:', edgeUpdateSuccessful.current, 'edge:', edge.id);
    setUpdatingEdgeNodes(null);
    updatingEdgeNodesRef.current = null;
    if (!edgeUpdateSuccessful.current) {
      console.log('[EdgeUpdateEnd] Update failed — snapping back');
    }
  }, []);




  // Reset everything to defaults: positions, handles, waypoints
  const handleResetPositions = useCallback(() => {
    setSavedPositions({ ...NODE_POSITIONS });
    setSavedHandles({ ...DEFAULT_HANDLES });
    setSavedWaypoints({ ...DEFAULT_WAYPOINTS });
    // Move nodes back to default positions
    setNodes(prev => prev.map(node => ({
      ...node,
      position: NODE_POSITIONS[node.id] || node.position,
    })));
    // Persist defaults
    Promise.all([
      setDatastoreItem(POSITION_CACHE_KEY, JSON.stringify(NODE_POSITIONS), DATASTORE_CATEGORIES.INFRASTRUCTURE),
      setDatastoreItem(HANDLE_CACHE_KEY, JSON.stringify(DEFAULT_HANDLES), DATASTORE_CATEGORIES.INFRASTRUCTURE),
      setDatastoreItem(WAYPOINT_CACHE_KEY, JSON.stringify(DEFAULT_WAYPOINTS), DATASTORE_CATEGORIES.INFRASTRUCTURE),
    ]).catch(e => console.warn('Failed to reset:', e));
    // Refit after nodes update
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.25, duration: 300 }), 50);
  }, [reactFlowInstance, setNodes]);

  const selectedCategory = selectedId
    ? TOOL_CATEGORIES.find(c => c.id === selectedId) || null
    : null;

  if (!positionsLoaded) {
    return (
      <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>Loading infrastructure…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 48px)', position: 'relative' }}>
      {/* Fullscreen flow canvas */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        '& .react-flow__attribution': { display: 'none' },
        '& .react-flow__controls': {
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        },
        '& .react-flow__controls-button': {
          bgcolor: 'hsl(var(--card))',
          borderBottom: '1px solid hsl(var(--border))',
          color: 'hsl(var(--foreground))',
          '&:hover': { bgcolor: 'hsl(var(--muted))' },
          '& svg': { fill: 'hsl(var(--foreground))' },
        },
        '& .react-flow__minimap': {
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'hsl(var(--card))',
        },
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onEdgesChange={onEdgesChange}
          snapToGrid
          snapGrid={[2, 2]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.3}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
          onPaneClick={() => { setSelectedId(null); setSelectedEdgeIdx(null); }}
          nodesConnectable={false}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onEdgeClick={(_, edge) => {
            const idx = parseInt(edge.id.replace('e-', ''), 10);
            setSelectedEdgeIdx(prev => prev === idx ? null : idx);
            setSelectedId(null);
          }}
          edgesUpdatable
          edgeUpdaterRadius={25}
          onEdgeUpdateStart={onEdgeUpdateStart}
          onEdgeUpdate={onEdgeUpdate}
          onEdgeUpdateEnd={onEdgeUpdateEnd}
          isValidConnection={isValidConnection}
          connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 2.5, strokeDasharray: '6 3' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsla(var(--muted-foreground) / 0.1)" />
          {/* Alignment helper lines rendered in flow-space via viewport transform */}
          <HelperLinesRenderer horizontal={helperLines.horizontal} vertical={helperLines.vertical} />
          <Controls showInteractive={false} />
          {/* Layout buttons */}
          <Box sx={{
            position: 'absolute',
            bottom: 10,
            left: 60,
            zIndex: 5,
            display: 'flex',
            gap: 0.75,
          }}>
            <Button
              size="small"
              onClick={handleResetPositions}
              sx={{
                minWidth: 'auto',
                px: 1.5,
                py: 0.5,
                fontSize: '0.7rem',
                bgcolor: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                '&:hover': { bgcolor: 'hsl(var(--muted))' },
              }}
            >
              Reset View
            </Button>
          </Box>
          <MiniMap
            nodeColor={() => 'hsl(var(--primary))'}
            maskColor="hsla(var(--background) / 0.8)"
            style={{ width: 120, height: 80 }}
          />
        </ReactFlow>
      </Box>

      {/* Floating header bar */}
      <Box sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 10,
        px: 3,
        py: 2,
        borderRadius: 3,
        bgcolor: 'hsla(var(--card) / 0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid hsl(var(--border))',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <Activity size={20} style={{ color: 'hsl(var(--primary))' }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
            Infrastructure
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', flexShrink: 0, display: { xs: 'none', md: 'block' } }}>
          Click any node to see details and data flows
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IntegrationStatus collapsed={false} />
        <Tooltip title="Export positions & connections as JSON" arrow>
          <IconButton
            size="small"
            onClick={() => {
              const currentNodes = reactFlowInstance.getNodes();
              const positions: Record<string, { x: number; y: number; label: string }> = {};
              currentNodes.forEach(n => {
                const cat = TOOL_CATEGORIES.find(c => c.id === n.id);
                positions[n.id] = {
                  x: Math.round(n.position.x),
                  y: Math.round(n.position.y),
                  label: cat?.label || n.id,
                };
              });
              const connections = DATA_FLOWS.map(f => ({
                source: f.source,
                target: f.target,
                label: f.label,
                source_label: TOOL_CATEGORIES.find(c => c.id === f.source)?.label || f.source,
                target_label: TOOL_CATEGORIES.find(c => c.id === f.target)?.label || f.target,
              }));
              const exportData = {
                positions,
                handles: savedHandles,
                waypoints: savedWaypoints,
                connections,
                exported_at: new Date().toISOString(),
              };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'infrastructure-layout.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
          >
            <Download size={18} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Detail drawers */}
      <CategoryDetailDrawer
        category={selectedCategory}
        matchedApps={selectedCategory ? (categoryApps[selectedCategory.id] || []) : []}
        open={!!selectedCategory}
        onClose={() => setSelectedId(null)}
        onEdgeHover={(edgeId) => setHoveredEdgeId(edgeId)}
        onEdgeClick={(edgeIdx) => {
          setSelectedId(null);
          setSelectedEdgeIdx(edgeIdx);
        }}
        onViewAllFlows={() => {
          setSelectedId(null);
          setLastViewedEdgeIdx(null);
          setShowAllFlows(true);
        }}
        activeCategories={activeCategories}
        configuredCategories={activeCategories}
      />

      {/* Edge state legend — bottom-right overlay */}
        <Box sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        bgcolor: 'hsla(var(--card) / 0.92)',
        border: '1px solid hsl(var(--border))',
        borderRadius: 2,
        px: 1.5,
        py: 1.25,
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
      }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.25 }}>
          Connection State
        </Typography>
        {/* Enabled */}
        {(() => {
          const count = DATA_FLOWS.filter((_, i) => {
            const edgeId = `e-${i}`;
            const base = getFlowState(activeCategories.has(DATA_FLOWS[i].source), activeCategories.has(DATA_FLOWS[i].target));
            return (enabledFlows.has(edgeId) && base === 'missing_config') ? true : base === 'enabled';
          }).length + DATA_FLOWS.filter((_, i) => enabledFlows.has(`e-${i}`) && getFlowState(activeCategories.has(DATA_FLOWS[i].source), activeCategories.has(DATA_FLOWS[i].target)) === 'missing_config').length;
          const enabledCount = DATA_FLOWS.filter((_, i) => {
            const edgeId = `e-${i}`;
            const base = getFlowState(activeCategories.has(DATA_FLOWS[i].source), activeCategories.has(DATA_FLOWS[i].target));
            return enabledFlows.has(edgeId) && base === 'missing_config';
          }).length;
          return (
            <Tooltip title="Both categories have apps configured and the data flow has been explicitly verified. Click to filter." placement="right" arrow>
              <Box onClick={() => { setAllFlowsFilter('enabled'); setShowAllFlows(true); }} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', borderRadius: 1, px: 0.5, py: 0.25, transition: 'background 0.15s', '&:hover': { bgcolor: 'hsla(142 71% 45% / 0.08)' } }}>
                <svg width="28" height="8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="28" y2="4" stroke="hsl(142 71% 45%)" strokeWidth="2" />
                  <polygon points="22,1 28,4 22,7" fill="hsl(142 71% 45%)" />
                </svg>
                <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--foreground))' }}>Enabled</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(142 71% 45%)', ml: 'auto', minWidth: 16, textAlign: 'right' }}>{enabledCount}</Typography>
              </Box>
            </Tooltip>
          );
        })()}
        {/* Misconfigured */}
        {(() => {
          const count = DATA_FLOWS.filter((_, i) => {
            const edgeId = `e-${i}`;
            const base = getFlowState(activeCategories.has(DATA_FLOWS[i].source), activeCategories.has(DATA_FLOWS[i].target));
            return base === 'missing_config' && !enabledFlows.has(edgeId);
          }).length;
          return (
            <Tooltip title="Both categories have apps configured, but the flow has not been verified yet. Click to filter." placement="right" arrow>
              <Box onClick={() => { setAllFlowsFilter('missing_config'); setShowAllFlows(true); }} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', borderRadius: 1, px: 0.5, py: 0.25, transition: 'background 0.15s', '&:hover': { bgcolor: 'hsla(45 93% 47% / 0.08)' } }}>
                <svg width="28" height="8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="28" y2="4" stroke="hsl(45 93% 47%)" strokeWidth="1.5" strokeDasharray="3 5" />
                  <polygon points="22,1 28,4 22,7" fill="hsl(45 93% 47%)" />
                </svg>
                <Typography sx={{ fontSize: '0.68rem', color: 'hsl(45 93% 47%)' }}>Misconfigured</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(45 93% 47%)', ml: 'auto', minWidth: 16, textAlign: 'right' }}>{count}</Typography>
              </Box>
            </Tooltip>
          );
        })()}
        {/* Disabled */}
        {(() => {
          const count = DATA_FLOWS.filter((_, i) => getFlowState(activeCategories.has(DATA_FLOWS[i].source), activeCategories.has(DATA_FLOWS[i].target)) === 'disabled').length;
          return (
            <Tooltip title="One or both categories have no apps configured. Click to filter." placement="right" arrow>
              <Box onClick={() => { setAllFlowsFilter('disabled'); setShowAllFlows(true); }} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', borderRadius: 1, px: 0.5, py: 0.25, transition: 'background 0.15s', '&:hover': { bgcolor: 'hsla(var(--muted-foreground) / 0.08)' } }}>
                <svg width="28" height="8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="28" y2="4" stroke="hsla(var(--muted-foreground) / 0.5)" strokeWidth="1.5" strokeDasharray="3 5" />
                  <polygon points="22,1 28,4 22,7" fill="hsla(var(--muted-foreground) / 0.5)" />
                </svg>
                <Typography sx={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>Disabled</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', ml: 'auto', minWidth: 16, textAlign: 'right' }}>{count}</Typography>
              </Box>
            </Tooltip>
          );
        })()}
      </Box>
      <AllDataFlowsDrawer
        open={showAllFlows}
        onClose={() => { setShowAllFlows(false); setAllFlowsFilter(null); }}
        onSelectFlow={(edgeIdx) => {
          setShowAllFlows(false);
          setAllFlowsFilter(null);
          setSelectedEdgeIdx(edgeIdx);
        }}
        onSelectCategory={(catId) => {
          setShowAllFlows(false);
          setAllFlowsFilter(null);
          setSelectedId(catId);
        }}
        activeCategories={activeCategories}
        configuredCategories={activeCategories}
        highlightEdgeIdx={lastViewedEdgeIdx}
        enabledFlows={enabledFlows}
        initialFilter={allFlowsFilter}
      />
      <EdgeDetailDrawer
        flow={selectedEdgeIdx !== null ? DATA_FLOWS[selectedEdgeIdx] || null : null}
        edgeIdx={selectedEdgeIdx}
        open={selectedEdgeIdx !== null}
        onClose={() => setSelectedEdgeIdx(null)}
        activeCategories={activeCategories}
        configuredCategories={activeCategories}
        categoryApps={categoryApps}
        enabledFlows={enabledFlows}
        onToggleEnabled={toggleFlowEnabled}
        onSelectCategory={(catId) => {
          setSelectedEdgeIdx(null);
          setSelectedId(catId);
        }}
        onViewAllFlows={(fromEdgeIdx) => {
          setLastViewedEdgeIdx(fromEdgeIdx);
          setSelectedEdgeIdx(null);
          setShowAllFlows(true);
        }}
      />
    </Box>
  );
};

const InfrastructurePage = () => (
  <ReactFlowProvider>
    <InfrastructureContent />
  </ReactFlowProvider>
);

export default InfrastructurePage;
