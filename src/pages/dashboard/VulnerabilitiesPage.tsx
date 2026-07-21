import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, IconButton, Avatar } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, RefreshCw, Search, Zap, ArrowRight, Wrench, Sparkles, AlertTriangle, Globe, LogIn, Loader2, MonitorCheck } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useVulnerabilities, Vulnerability, VulnSeverity, VulnCategory } from '@/hooks/useVulnerabilities';
import { useAppAuth } from '@/Shuffle-MCPs/useAppAuth';
import { isVulnScannerApp } from '@/Shuffle-MCPs/ingestionDetection';
import { askAI } from '@/services/ai';
import { toast } from '@/lib/toast';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { useWorkflows } from '@/hooks/useWorkflows';
import { VulnerabilityAutomationBanner } from '@/components/vulnerabilities/VulnerabilityAutomationBanner';
import { IngestionSourcesRow } from '@/components/ingestion/IngestionSourcesRow';
import { AddVulnerabilityDialog } from '@/components/vulnerabilities/AddVulnerabilityDialog';

const SEVERITY_COLORS: Record<VulnSeverity, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-500 border-green-500/20',
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const SEVERITY_DOT_COLORS: Record<VulnSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
  info: 'bg-blue-500',
};

const CATEGORY_LABELS: Record<VulnCategory, string> = {
  software_cve: 'Software / CVE',
  user_identity: 'User / Identity',
  cloud_misconfig: 'Cloud Misconfig',
  code_dependency: 'Code / Deps',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  accepted: 'Accepted',
};

const VulnerabilitiesPage = () => {
  usePageMeta({ title: 'Vulnerabilities', description: 'Track and manage vulnerabilities across assets and users' });
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdmin = useIsAdmin();
  if (authLoading) return null;
  if (!isAuthenticated) return <PublicVulnerabilitiesView />;
  return <AuthenticatedVulnerabilitiesView />;
};

const PublicVulnerabilitiesView = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const looksLikeId = /^(CVE-|GHSA-|PYSEC-|GO-|RUSTSEC-|MAL-|OSV-)/i.test(trimmed);
  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    navigate(`/vulnerabilities/${encodeURIComponent(trimmed)}`);
  };
  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/15 text-primary shrink-0">
          <Shield size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vulnerabilities</h1>
          <p className="text-sm text-muted-foreground">
            Look up any CVE, GHSA, or OSV advisory — public, no sign-in required.
          </p>
        </div>
      </div>

      <form onSubmit={handleLookup} className="rounded-lg border border-border bg-card p-5 space-y-3">
        <label htmlFor="vuln-id" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Vulnerability ID
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="vuln-id"
              autoFocus
              placeholder="e.g. CVE-2024-12345 or GHSA-xxxx-xxxx-xxxx"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-9 text-sm font-mono"
            />
          </div>
          <Button type="submit" size="sm" className="gap-1.5 h-9" disabled={!trimmed}>
            <ArrowRight size={14} />
            Open
          </Button>
        </div>
        {trimmed && !looksLikeId && (
          <p className="text-[0.7rem] text-muted-foreground">
            Tip: this doesn't look like a standard advisory ID — we'll still try to open it.
          </p>
        )}
        <p className="text-[0.7rem] text-muted-foreground flex items-center gap-1.5">
          <Globe size={11} />
          Powered by the public OSV.dev vulnerability database.
        </p>
      </form>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/15 text-primary shrink-0">
            <LogIn size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground mb-0.5">Track vulnerabilities in your environment</p>
            <p className="text-xs text-muted-foreground mb-3">
              Sign in to connect Shuffle to your hosts and see exactly which systems are affected by each advisory.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/login?view=%2Fvulnerabilities')}>
                <LogIn size={14} />
                Sign in
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate('/register')}>
                Create account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthenticatedVulnerabilitiesView = () => {
  const isAdmin = useIsAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [aiScanOpen, setAiScanOpen] = useState(false);
  const [aiScanLoading, setAiScanLoading] = useState(false);
  const [aiScanResult, setAiScanResult] = useState<string | null>(null);
  const [enablingAutomation, setEnablingAutomation] = useState(false);
  const [addVulnOpen, setAddVulnOpen] = useState(false);

  const { data: workflows, refetch: refetchWorkflows } = useWorkflows();
  const vulnComparisonWorkflow = (workflows || []).find(
    w => (w.name || '').toLowerCase() === 'vulnerability comparison'
  );
  const automationEnabled = !!vulnComparisonWorkflow;
  const navigate = useNavigate();

  const handleEnableAutomation = useCallback(async () => {
    setEnablingAutomation(true);
    try {
      const res = await fetch(getApiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Vulnerability Comparison' }),
      });
      if (!res.ok) throw new Error('Failed');
      await refetchWorkflows();
      toast.success('Vulnerability Comparison workflow enabled');
    } catch {
      toast.error('Failed to enable Vulnerability Comparison workflow');
    } finally {
      setEnablingAutomation(false);
    }
  }, [refetchWorkflows]);

  const handleDisableAutomation = useCallback(async () => {
    setEnablingAutomation(true);
    try {
      const res = await fetch(getApiUrl('/api/v2/workflows/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Vulnerability Comparison', action_name: 'remove' }),
      });
      if (!res.ok) throw new Error('Failed');
      await refetchWorkflows();
      toast.success('Vulnerability Comparison workflow disabled');
    } catch {
      toast.error('Failed to disable Vulnerability Comparison workflow');
    } finally {
      setEnablingAutomation(false);
    }
  }, [refetchWorkflows]);

  const { vulnerabilities, severityCounts, isLoading, isRefreshing, refresh } = useVulnerabilities();
  const { authenticatedApps } = useAppAuth();

  // Filter connected vuln scanner apps
  const connectedScanners = (authenticatedApps || []).filter(a => a.app?.name && isVulnScannerApp(a.app.name) && (a.active || a.validation?.valid));

  // Filtered vulnerabilities
  const filtered = vulnerabilities.filter(v => {
    if (searchQuery && !v.title.toLowerCase().includes(searchQuery.toLowerCase()) && !v.asset_name?.toLowerCase().includes(searchQuery.toLowerCase()) && !v.cve_id?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (severityFilter !== 'all' && v.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    return true;
  });

  const handleAiScan = useCallback(async () => {
    setAiScanLoading(true);
    setAiScanResult(null);
    setAiScanOpen(true);
    try {
      const resp = await askAI({
        query: 'Analyze my connected apps and infrastructure for potential vulnerabilities, misconfigurations, and identity issues. List each finding with severity (critical/high/medium/low), affected asset or user, and a short description. Format as a numbered list.',
      });
      if (resp.success && resp.result) {
        setAiScanResult(resp.result);
      } else {
        setAiScanResult(`AI scan failed: ${resp.error || 'Unknown error'}`);
      }
    } catch (err) {
      setAiScanResult('AI scan failed. Please try again.');
    } finally {
      setAiScanLoading(false);
    }
  }, []);

  const handleRemediate = () => {
    toast.info('Remediation workflows coming soon', {
      description: 'Automated remediation will let you run code on target machines to fix vulnerabilities.',
    });
  };


  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Vulnerability Automation banner — admin only */}
      <VulnerabilityAutomationBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={28} className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Vulnerabilities</h1>
            <p className="text-sm text-muted-foreground">Track and manage vulnerabilities across your assets and users</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => refresh()} disabled={isRefreshing}>
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <IngestionSourcesRow
            workflowLabel="Ingest Vulnerabilities"
            category="vulnerabilities"
            webhookLabel="Ingest Vulnerabilities_webhook"
            webhookWorkflowName="Vulnerability Ingestion Webhook"
            titleTooltip="Apps with authentication appear here. Verified apps show in green, unverified in yellow. Toggle them to control which tools automatically pull in vulnerabilities."
            addSubtitle="Search and authenticate a tool to ingest vulnerabilities from"
            onSourcesChanged={() => refresh()}
          />
          <Button size="sm" className="gap-1.5" onClick={() => navigate('/monitors?add_host=true')}>
            <MonitorCheck size={14} />
            Add Host Monitor
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => setAddVulnOpen(true)}>
                  <Plus size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Vulnerability</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>


      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as VulnSeverity[]).map(sev => (
          <div
            key={sev}
            className="rounded-lg border border-border bg-card p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${SEVERITY_DOT_COLORS[sev]}`} />
              <span className="text-sm text-muted-foreground capitalize">{sev}</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{severityCounts[sev]}</span>
          </div>
        ))}
      </div>



      {/* Filters + table — only show when there's data */}
      {vulnerabilities.length > 0 || isLoading ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vulns..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 w-[180px] text-sm"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="software_cve">Software / CVE</SelectItem>
                <SelectItem value="user_identity">User / Identity</SelectItem>
                <SelectItem value="cloud_misconfig">Cloud Misconfig</SelectItem>
                <SelectItem value="code_dependency">Code / Deps</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <VulnTable
            vulnerabilities={filtered}
            isLoading={isLoading}
            onRemediate={handleRemediate}
            emptyIcon={<Shield size={48} className="text-muted-foreground/50 mx-auto mb-4" />}
            emptyTitle="No vulnerabilities found"
            emptyDescription="Connect a vulnerability scanner or sync from a package page to populate this list."
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Shield size={48} className="text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-base font-medium text-foreground mb-1">No vulnerability data yet</h3>
          <p className="text-sm text-muted-foreground mb-1 max-w-md mx-auto">
            Connect a source to start ingesting vulnerability data.
          </p>
          <p className="text-xs text-muted-foreground/70 mb-4 max-w-sm mx-auto">
            Supported: VMS tools (Qualys, Tenable, Rapid7), GitHub, Docker, Asset & IAM platforms
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/monitors?add_host=true')}>
            <Plus size={14} />
            Add Source
          </Button>
        </div>
      )}

      <AddVulnerabilityDialog
        open={addVulnOpen}
        onOpenChange={setAddVulnOpen}
        onAdded={() => refresh()}
      />
    </div>
  );
};

// --- VulnTable sub-component ---

interface VulnTableProps {
  vulnerabilities: Vulnerability[];
  isLoading: boolean;
  onRemediate: () => void;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}

const VulnTable = ({ vulnerabilities, isLoading, onRemediate, emptyIcon, emptyTitle, emptyDescription }: VulnTableProps) => {
  const navigate = useNavigate();
  const openDetail = (id: string, e?: React.MouseEvent) => {
    // Strip "::hostname" expansion suffix to get the canonical OSV id used as datastore key.
    const baseId = String(id).split('::')[0];
    const url = `/vulnerabilities/${encodeURIComponent(baseId)}`;
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) { window.open(url, '_blank'); return; }
    navigate(url);
  };
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <RefreshCw size={24} className="animate-spin text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading vulnerabilities...</p>
      </div>
    );
  }

  if (vulnerabilities.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        {emptyIcon}
        <h3 className="text-base font-medium text-foreground mb-1">{emptyTitle}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">{emptyDescription}</p>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus size={14} />
          Connect Scanner
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-[140px]">Category</TableHead>
            <TableHead className="w-[150px]">Asset / User</TableHead>
            <TableHead className="w-[100px]">Source</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[110px]">First Seen</TableHead>
            <TableHead className="w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vulnerabilities.map(vuln => (
            <TableRow
              key={vuln.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={(e) => openDetail(vuln.id, e)}
              onAuxClick={(e) => e.button === 1 && window.open(`/vulnerabilities/${encodeURIComponent(String(vuln.id).split('::')[0])}`, '_blank')}
            >
              <TableCell>
                <Badge variant="outline" className={`text-xs capitalize ${SEVERITY_COLORS[vuln.severity]}`}>
                  {vuln.severity}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{vuln.title}</span>
                  {vuln.cve_id && <span className="text-xs text-muted-foreground font-mono">{vuln.cve_id}</span>}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[vuln.category] || vuln.category}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-foreground">{vuln.asset_name || vuln.asset_id || '—'}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{vuln.source || '—'}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{STATUS_LABELS[vuln.status] || vuln.status}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {vuln.first_seen ? new Date(vuln.first_seen).toLocaleDateString() : '—'}
                </span>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onRemediate}>
                        <Wrench size={12} />
                        Remediate
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Run automated remediation on this vulnerability</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default VulnerabilitiesPage;
