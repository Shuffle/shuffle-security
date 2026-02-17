/**
 * InfrastructurePage — Visual map of security tool categories and data flows.
 * Uses @xyflow/react for an interactive node-based diagram.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Position,
  Handle,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Typography, Chip, Avatar, IconButton, Drawer, Tooltip } from '@mui/material';
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
  Brain,
  Zap,
  ArrowRight,
  ChevronRight,
  Activity,
  Cloud,
} from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { IntegrationStatus } from '@/components/layout/IntegrationStatus';

// ── Tool Category Definitions ──────────────────────────────────────────────────

interface ToolCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string; // HSL var
  examples: string[];
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
    color: '--primary',
    examples: ['Shuffle Cases', 'TheHive', 'ServiceNow', 'Jira'],
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
    color: '--severity-medium',
    examples: ['Splunk', 'Microsoft Sentinel', 'Elastic SIEM', 'QRadar'],
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
    color: '--severity-info',
    examples: ['Palo Alto', 'Fortinet', 'Suricata', 'Zeek'],
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
    color: '--severity-critical',
    examples: ['CrowdStrike', 'SentinelOne', 'Microsoft Defender', 'Carbon Black'],
    dataIn: ['IOC hashes from Threat Intel', 'Containment orders from Case Management'],
    dataOut: ['Endpoint telemetry to SIEM', 'Alerts to Case Management', 'Process trees to AI/LLM'],
    useCases: [
      'Isolate compromised endpoints automatically',
      'Scan endpoints for known IOC file hashes',
      'Collect forensic artifacts during investigation',
      'Push detection rules from Sigma to endpoint agents',
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Team messaging and notification channels for real-time incident coordination.',
    icon: <MessageSquare size={22} />,
    color: '--severity-low',
    examples: ['Slack', 'Microsoft Teams', 'PagerDuty', 'Opsgenie'],
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
    color: '--accent',
    examples: ['Microsoft 365', 'Google Workspace', 'Sublime Security', 'Abnormal Security'],
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
    color: '--severity-medium',
    examples: ['MISP', 'VirusTotal', 'AlienVault OTX', 'Recorded Future'],
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
    color: '--muted-foreground',
    examples: ['ServiceNow CMDB', 'Qualys', 'Tenable', 'Snipe-IT'],
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
    color: '--severity-critical',
    examples: ['Okta', 'Azure AD', 'CyberArk', 'JumpCloud'],
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
    id: 'ai_llm',
    label: 'AI / LLM',
    description: 'AI-powered analysis, automated triage, and natural language investigation assistance.',
    icon: <Brain size={22} />,
    color: '--primary',
    examples: ['OpenAI', 'Anthropic', 'Google Gemini', 'Shuffle AI'],
    dataIn: ['Logs from SIEM', 'Process trees from EDR', 'Email headers from Email'],
    dataOut: ['Triage recommendations to Case Management', 'Summaries to Communication', 'Detection suggestions to SIEM'],
    useCases: [
      'Auto-triage alerts with severity and confidence scoring',
      'Generate natural language incident summaries',
      'Suggest remediation steps based on similar past incidents',
      'Analyze malware behavior from sandbox reports',
    ],
  },
  {
    id: 'cloud',
    label: 'Cloud',
    description: 'Cloud providers with bundled security services — logging, IAM, networking, and compute.',
    icon: <Cloud size={22} />,
    color: '--severity-info',
    examples: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Oracle Cloud'],
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

const DATA_FLOWS: { source: string; target: string; label: string; animated?: boolean }[] = [
  { source: 'siem', target: 'case_management', label: 'Alerts', animated: true },
  { source: 'network', target: 'siem', label: 'Flow logs' },
  { source: 'edr', target: 'siem', label: 'Telemetry' },
  { source: 'iam', target: 'siem', label: 'Auth logs' },
  { source: 'email', target: 'case_management', label: 'Phishing reports' },
  { source: 'threat_intel', target: 'case_management', label: 'Enrichment', animated: true },
  { source: 'threat_intel', target: 'network', label: 'IOC feeds' },
  { source: 'threat_intel', target: 'edr', label: 'Hash feeds' },
  { source: 'case_management', target: 'communication', label: 'Notifications', animated: true },
  { source: 'case_management', target: 'iam', label: 'Disable accounts' },
  { source: 'case_management', target: 'edr', label: 'Containment' },
  { source: 'asset_management', target: 'case_management', label: 'Asset context' },
  { source: 'email', target: 'threat_intel', label: 'Phishing IOCs' },
  { source: 'ai_llm', target: 'case_management', label: 'Triage & summaries', animated: true },
  { source: 'siem', target: 'ai_llm', label: 'Log analysis' },
  { source: 'edr', target: 'ai_llm', label: 'Process trees' },
  { source: 'cloud', target: 'siem', label: 'Audit logs', animated: true },
  { source: 'cloud', target: 'asset_management', label: 'Resource inventory' },
  { source: 'cloud', target: 'iam', label: 'Identity events' },
  { source: 'threat_intel', target: 'cloud', label: 'IOC feeds' },
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
  ai_llm: ['ai', 'llm', 'openai', 'anthropic', 'gemini', 'gpt', 'machine learning', 'chatgpt'],
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
}

// ── Custom Node Component ──────────────────────────────────────────────────────

interface CategoryNodeData {
  category: ToolCategory;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  isSelected: boolean;
  isHovered: boolean;
  matchedApps: MatchedApp[];
  [key: string]: unknown;
}

const CategoryNode = ({ data }: { data: CategoryNodeData }) => {
  const { category, onSelect, onHover, isSelected, isHovered, matchedApps } = data;
  const colorVar = category.color;
  const highlighted = isSelected || isHovered;
  const hasApps = matchedApps.length > 0;

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: 'transparent', border: 'none', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: 'transparent', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'transparent', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: 'transparent', border: 'none', width: 8, height: 8 }} />

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
        <Typography sx={{
          fontSize: '0.62rem',
          color: 'hsl(var(--muted-foreground))',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          mb: hasApps ? 1 : 0,
        }}>
          {category.description}
        </Typography>

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
  // Row 1: Data sources
  network:          { x: 0,   y: 0 },
  edr:              { x: 260, y: 0 },
  email:            { x: 520, y: 0 },
  iam:              { x: 780, y: 0 },
  cloud:            { x: 1040, y: 0 },
  // Row 2: Processing layer
  siem:             { x: 60,  y: 220 },
  threat_intel:     { x: 380, y: 220 },
  asset_management: { x: 700, y: 220 },
  // Row 3: Action & orchestration
  case_management:  { x: 220, y: 440 },
  ai_llm:           { x: 540, y: 440 },
  // Row 4: Output
  communication:    { x: 380, y: 640 },
};

// ── Detail Drawer ──────────────────────────────────────────────────────────────

const CategoryDetailDrawer = ({
  category,
  open,
  onClose,
}: {
  category: ToolCategory | null;
  open: boolean;
  onClose: () => void;
}) => {
  if (!category) return null;
  const colorVar = category.color;

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

      <Box sx={{ p: 3, overflowY: 'auto' }}>
        {/* Examples */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
            Common Tools
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {category.examples.map(ex => (
              <Chip
                key={ex}
                avatar={<Avatar src={`https://shuffler.io/images/apps/${ex.toLowerCase().replace(/\s+/g, '_')}.png`} sx={{ width: 18, height: 18, '& img': { objectFit: 'contain' } }} />}
                label={ex}
                size="small"
                sx={{
                  height: 26,
                  fontSize: '0.72rem',
                  bgcolor: `hsla(var(${colorVar}) / 0.08)`,
                  color: 'hsl(var(--foreground))',
                  border: `1px solid hsla(var(${colorVar}) / 0.2)`,
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Data In */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
            Data In
          </Typography>
          {category.dataIn.map((d, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <ArrowRight size={12} style={{ color: `hsl(var(${colorVar}))`, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--foreground))' }}>{d}</Typography>
            </Box>
          ))}
        </Box>

        {/* Data Out */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
            Data Out
          </Typography>
          {category.dataOut.map((d, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <ChevronRight size={12} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--foreground))' }}>{d}</Typography>
            </Box>
          ))}
        </Box>

        {/* Use Cases */}
        <Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
            How We Use It
          </Typography>
          {category.useCases.map((uc, i) => (
            <Box key={i} sx={{
              display: 'flex',
              gap: 1.5,
              mb: 1.5,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
            }}>
              <Box sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `hsla(var(${colorVar}) / 0.1)`,
                color: `hsl(var(${colorVar}))`,
                flexShrink: 0,
                fontSize: '0.65rem',
                fontWeight: 700,
                mt: 0.1,
              }}>
                {i + 1}
              </Box>
              <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--foreground))', lineHeight: 1.55 }}>
                {uc}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Drawer>
  );
};

// ── Page Component ─────────────────────────────────────────────────────────────

const InfrastructurePage = () => {
  usePageMeta({ title: 'Infrastructure', description: 'Security tool integrations and data flow visualization' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [categoryApps, setCategoryApps] = useState<Record<string, MatchedApp[]>>({});

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

        dedupedApps.forEach(({ app, bestImage }) => {
          const catId = matchAppToCategory(app.name, app.categories || []);
          if (!catId) return;
          if (!mapped[catId]) mapped[catId] = [];
          mapped[catId].push({ name: app.name, image: bestImage || app.large_image || '' });
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

  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const handleHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  const initialNodes: Node[] = useMemo(() =>
    TOOL_CATEGORIES.map(cat => ({
      id: cat.id,
      type: 'category',
      position: NODE_POSITIONS[cat.id] || { x: 0, y: 0 },
      data: {
        category: cat,
        onSelect: handleSelect,
        onHover: handleHover,
        isSelected: selectedId === cat.id,
        isHovered: hoveredId === cat.id,
        matchedApps: categoryApps[cat.id] || [],
      },
    })),
    [handleSelect, handleHover, selectedId, hoveredId, categoryApps]
  );

  const initialEdges: Edge[] = useMemo(() =>
    DATA_FLOWS.map((flow, idx) => {
      const isConnected = activeId && (flow.source === activeId || flow.target === activeId);
      return {
        id: `e-${idx}`,
        source: flow.source,
        target: flow.target,
        label: flow.label,
        animated: isConnected ? true : (flow.animated || false),
        type: 'smoothstep',
        style: {
          stroke: activeId
            ? (isConnected ? activeColor : 'hsla(var(--muted-foreground) / 0.1)')
            : 'hsla(var(--muted-foreground) / 0.3)',
          strokeWidth: isConnected ? 2.5 : 1,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        },
        labelStyle: {
          fontSize: 10,
          fontWeight: isConnected ? 600 : 500,
          fill: isConnected ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          opacity: activeId && !isConnected ? 0.2 : 0.8,
        },
        labelBgStyle: {
          fill: 'hsl(var(--background))',
          fillOpacity: 0.85,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isConnected ? activeColor : 'hsla(var(--muted-foreground) / 0.3)',
        },
      };
    }),
    [activeId, activeColor]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const selectedCategory = selectedId
    ? TOOL_CATEGORIES.find(c => c.id === selectedId) || null
    : null;

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
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsla(var(--muted-foreground) / 0.1)" />
          <Controls showInteractive={false} />
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
      </Box>

      {/* Detail drawer */}
      <CategoryDetailDrawer
        category={selectedCategory}
        open={!!selectedCategory}
        onClose={() => setSelectedId(null)}
      />
    </Box>
  );
};

export default InfrastructurePage;
