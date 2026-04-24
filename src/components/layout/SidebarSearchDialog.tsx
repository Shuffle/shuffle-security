/**
 * SidebarSearchDialog — Ctrl+K powered search popup for the sidebar.
 * Searches apps via Algolia + correlations via /api/v2/correlations + workflows via /api/v1/workflows + local nav items.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { algoliasearch } from 'algoliasearch';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Box, Typography, InputBase, CircularProgress } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RadarIcon from '@mui/icons-material/Radar';
import DescriptionIcon from '@mui/icons-material/Description';
import TuneIcon from '@mui/icons-material/Tune';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import SettingsIcon from '@mui/icons-material/Settings';
import { Network, Braces, Waypoints, Link2, Workflow, Activity, BookOpen, LayoutDashboard, Shield, HardDrive, Radar, Users } from 'lucide-react';
import AgentIcon from '@/components/agent/AgentIcon';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { useWorkflows } from '@/hooks/useWorkflows';
import type { AlgoliaSearchApp } from '@/Shuffle-MCP/singul.helpers';

const ALGOLIA_APP_ID = 'JNSS5CFDZZ';
const ALGOLIA_API_KEY = '33e4e3564f4f060e96e0531957bed552';

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);

interface NavResult {
  type: 'nav';
  label: string;
  path: string;
  icon: React.ReactNode;
  indent?: boolean;
}

interface AppResult {
  type: 'app';
  app: AlgoliaSearchApp;
}

interface CorrelationItem {
  key: string;
  amount: number;
  ref: string[];
}

interface CorrelationResult {
  type: 'correlation';
  correlation: CorrelationItem;
}

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
}

interface WorkflowResult {
  type: 'workflow';
  workflow: WorkflowItem;
}

type SearchResult = NavResult | AppResult | CorrelationResult | WorkflowResult;

const navItems: NavResult[] = [
  { type: 'nav', label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={16} /> },
  { type: 'nav', label: 'Incidents', path: '/incidents', icon: <WarningAmberIcon sx={{ fontSize: 18 }} /> },
  { type: 'nav', label: 'Templates', path: '/templates', icon: <DescriptionIcon sx={{ fontSize: 16 }} />, indent: true },
  { type: 'nav', label: 'Custom Fields', path: '/incidents/custom-fields', icon: <TuneIcon sx={{ fontSize: 16 }} />, indent: true },
  { type: 'nav', label: 'Monitors', path: '/monitors', icon: <Radar size={16} /> },
  { type: 'nav', label: 'Detection', path: '/detection', icon: <RadarIcon sx={{ fontSize: 18 }} /> },
  { type: 'nav', label: 'Rules', path: '/detection/sigma', icon: <Braces size={16} />, indent: true },
  { type: 'nav', label: 'Pipelines', path: '/detection/pipelines', icon: <Network size={16} />, indent: true },
  { type: 'nav', label: 'ATT&CK', path: '/detection/mitre', icon: <Waypoints size={16} />, indent: true },
  { type: 'nav', label: 'Threat Feeds', path: '/incidents/threat-feeds', icon: <RssFeedIcon sx={{ fontSize: 16 }} />, indent: true },
  { type: 'nav', label: 'IOC Types', path: '/incidents/ioc-types', icon: <FingerprintIcon sx={{ fontSize: 16 }} />, indent: true },
  { type: 'nav', label: 'Vulnerabilities', path: '/vulnerabilities', icon: <Shield size={16} />, indent: true },
  { type: 'nav', label: 'Assets', path: '/assets', icon: <HardDrive size={16} />, indent: true },
  { type: 'nav', label: 'Response Actions', path: '/incidents/response-actions', icon: <Shield size={16} />, indent: true },
  { type: 'nav', label: 'Users', path: '/users', icon: <Users size={16} />, indent: true },
  { type: 'nav', label: 'Agent', path: '/agent', icon: <AgentIcon size={16} /> },
  { type: 'nav', label: 'Automation', path: '/usecases', icon: <Activity size={16} /> },
  { type: 'nav', label: 'Documentation', path: '/docs', icon: <BookOpen size={16} /> },
  { type: 'nav', label: 'Settings', path: '/settings', icon: <SettingsIcon sx={{ fontSize: 16 }} /> },
  { type: 'nav', label: 'Tenants', path: '/organizations', icon: <LayoutDashboard size={16} /> },
];

const NOISE_KEYS = new Set([
  'new', 'in_progress', 'resolved', 'escalated', 'closed', 'open', 'pending',
  'critical', 'high', 'medium', 'low', 'informational', 'info', 'warning', 'error',
  'unknown', 'none', 'null', 'undefined', 'true', 'false',
]);

interface SidebarSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SidebarSearchDialog = ({ open, onOpenChange }: SidebarSearchDialogProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { data: allWorkflows = [] } = useWorkflows();
  const [appResults, setAppResults] = useState<AlgoliaSearchApp[]>([]);
  const [correlationResults, setCorrelationResults] = useState<CorrelationItem[]>([]);
  const [workflowResults, setWorkflowResults] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [correlationsLoading, setCorrelationsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const appDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const corrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter workflows locally by query
  useEffect(() => {
    if (!query.trim()) {
      setWorkflowResults([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allWorkflows.filter(
      (w) => w.name?.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q)
    );
    setWorkflowResults(filtered.slice(0, 6));
  }, [query, allWorkflows]);

  // Filter nav items by query
  const filteredNav: NavResult[] = query.trim()
    ? navItems.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
    : navItems;

  // Combined results: nav first, then workflows, then correlations, then apps
  const results: SearchResult[] = [
    ...filteredNav,
    ...workflowResults.map((w) => ({ type: 'workflow' as const, workflow: w })),
    ...correlationResults.map((c) => ({ type: 'correlation' as const, correlation: c })),
    ...appResults.map((app) => ({ type: 'app' as const, app })),
  ];

  // Search Algolia
  const searchApps = useCallback(async (q: string) => {
    if (!q.trim()) {
      setAppResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await client.searchSingleIndex({
        indexName: 'appsearch',
        searchParams: { query: q, hitsPerPage: 8 },
      });
      setAppResults(res.hits as AlgoliaSearchApp[]);
    } catch {
      setAppResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search correlations
  const searchCorrelations = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setCorrelationResults([]);
      return;
    }
    setCorrelationsLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/v2/correlations'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          type: 'datastore',
          key: q.trim(),
          category: 'shuffle-security_incidents',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const correlationData = Array.isArray(data) ? data : (data.correlations || data.data || []);
        const filtered = correlationData.filter(
          (c: CorrelationItem) => !NOISE_KEYS.has(c.key.toLowerCase())
        );
        setCorrelationResults(filtered.slice(0, 8));
      } else {
        setCorrelationResults([]);
      }
    } catch {
      setCorrelationResults([]);
    } finally {
      setCorrelationsLoading(false);
    }
  }, []);

  // Debounced app search (200ms) — only when dialog is open
  useEffect(() => {
    if (!open) return;
    if (appDebounceRef.current) clearTimeout(appDebounceRef.current);
    appDebounceRef.current = setTimeout(() => searchApps(query), 200);
    return () => { if (appDebounceRef.current) clearTimeout(appDebounceRef.current); };
  }, [query, searchApps, open]);

  // Debounced correlation search (400ms) — only when dialog is open
  useEffect(() => {
    if (!open) return;
    if (corrDebounceRef.current) clearTimeout(corrDebounceRef.current);
    corrDebounceRef.current = setTimeout(() => searchCorrelations(query), 400);
    return () => { if (corrDebounceRef.current) clearTimeout(corrDebounceRef.current); };
  }, [query, searchCorrelations, open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setAppResults([]);
      setCorrelationResults([]);
      setWorkflowResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'nav') {
      navigate(result.path);
    } else if (result.type === 'app') {
      navigate(`/apps?app=${result.app.name}`);
    } else if (result.type === 'workflow') {
      // Open workflow in Shuffle Automation
      window.open(`https://shuffler.io/workflows/${result.workflow.id}`, '_blank');
    } else if (result.type === 'correlation') {
      const incidentRef = result.correlation.ref?.find((r) => r.includes('shuffle-security_incidents'));
      if (incidentRef) {
        // Ref format: "shuffle-security_incidents|<key>" — extract key after the pipe
        const key = incidentRef.includes('|') 
          ? incidentRef.split('|').pop() 
          : incidentRef.split('/').pop();
        if (key) {
          navigate(`/incidents/${key}`);
        }
      }
    }
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const isAnyLoading = loading || correlationsLoading;

  // Compute global indices for each section
  const workflowStartIdx = filteredNav.length;
  const correlationStartIdx = workflowStartIdx + workflowResults.length;
  const appStartIdx = correlationStartIdx + correlationResults.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-0"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          width: 520,
          minWidth: 520,
          maxWidth: 520,
          minHeight: 400,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search input */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.5,
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <SearchIcon sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 20 }} />
          <InputBase
            inputRef={inputRef}
            placeholder="Search pages, workflows, apps, correlations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth
            sx={{
              color: 'hsl(var(--foreground))',
              fontSize: '0.9rem',
              '& input::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 1 },
            }}
          />
          {isAnyLoading && <CircularProgress size={16} sx={{ color: 'hsl(var(--primary))' }} />}
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'hsl(var(--muted-foreground))',
              fontFamily: 'monospace',
              border: '1px solid hsl(var(--border))',
              borderRadius: 0.5,
              px: 0.75,
              py: 0.25,
              flexShrink: 0,
            }}
          >
            ESC
          </Typography>
        </Box>

        {/* Results */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {/* Nav section */}
          {filteredNav.length > 0 && (
            <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 1, px: 1, mb: 0.5 }}>
                Pages
              </Typography>
              {filteredNav.map((item, idx) => {
                const globalIdx = idx;
                return (
                  <Box
                    key={item.path}
                    onClick={() => handleSelect(item)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      pl: item.indent ? 3.5 : 1.5,
                      py: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: selectedIndex === globalIdx ? 'hsl(var(--muted))' : 'transparent',
                      '&:hover': { backgroundColor: 'hsl(var(--muted))', opacity: 0.9 },
                    }}
                  >
                    <Box sx={{ color: 'hsl(var(--muted-foreground))', display: 'flex' }}>{item.icon}</Box>
                    <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>{item.label}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Workflows section */}
          {workflowResults.length > 0 && (
            <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 1, px: 1, mb: 0.5 }}>
                Workflows
              </Typography>
              {workflowResults.map((wf, idx) => {
                const globalIdx = workflowStartIdx + idx;
                return (
                  <Box
                    key={wf.id}
                    onClick={() => handleSelect({ type: 'workflow', workflow: wf })}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: selectedIndex === globalIdx ? 'hsl(var(--muted))' : 'transparent',
                      '&:hover': { backgroundColor: 'hsl(var(--muted))', opacity: 0.9 },
                    }}
                  >
                    <Box sx={{ color: 'hsl(var(--muted-foreground))', display: 'flex' }}>
                      <Workflow size={16} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wf.name}
                      </Typography>
                      {wf.description && (
                        <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {wf.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Correlations section */}
          {correlationResults.length > 0 && (
            <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 1, px: 1, mb: 0.5 }}>
                Correlations
              </Typography>
              {correlationResults.map((corr, idx) => {
                const globalIdx = correlationStartIdx + idx;
                const refCount = corr.ref?.length || 0;
                return (
                  <Box
                    key={`${corr.key}-${idx}`}
                    onClick={() => handleSelect({ type: 'correlation', correlation: corr })}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: selectedIndex === globalIdx ? 'hsl(var(--muted))' : 'transparent',
                      '&:hover': { backgroundColor: 'hsl(var(--muted))', opacity: 0.9 },
                    }}
                  >
                    <Box sx={{ color: 'hsl(var(--muted-foreground))', display: 'flex' }}>
                      <Link2 size={16} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {corr.key}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>
                        {refCount} ref{refCount !== 1 ? 's' : ''}
                      </Typography>
                      {corr.amount > 1 && (
                        <Typography sx={{ fontSize: '0.6rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>
                          ×{corr.amount}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Correlations loading indicator */}
          {correlationsLoading && correlationResults.length === 0 && query.trim().length >= 2 && (
            <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 1, px: 1, mb: 0.5 }}>
                Correlations
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1 }}>
                <CircularProgress size={14} sx={{ color: 'hsl(var(--muted-foreground))' }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>Searching...</Typography>
              </Box>
            </Box>
          )}

          {/* Apps section */}
          {appResults.length > 0 && (
            <Box sx={{ px: 1.5, pt: 1.5, pb: 1.5 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 1, px: 1, mb: 0.5 }}>
                Integrations
              </Typography>
              {appResults.map((app, idx) => {
                const globalIdx = appStartIdx + idx;
                return (
                  <Box
                    key={app.objectID}
                    onClick={() => handleSelect({ type: 'app', app })}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: selectedIndex === globalIdx ? 'hsl(var(--muted))' : 'transparent',
                      '&:hover': { backgroundColor: 'hsl(var(--muted))', opacity: 0.9 },
                    }}
                  >
                    {app.image_url ? (
                      <img
                        src={app.image_url}
                        alt={app.name}
                        style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain', backgroundColor: 'rgba(255,255,255,0.05)', padding: 2 }}
                      />
                    ) : (
                      <Box sx={{ width: 20, height: 20, borderRadius: 0.5, backgroundColor: 'hsl(var(--muted))' }} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', textTransform: 'capitalize' }}>
                        {app.name.replace(/_/g, ' ')}
                      </Typography>
                    </Box>
                    {app.categories?.[0] && (
                      <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', flexShrink: 0 }}>
                        {app.categories[0]}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Empty state */}
          {query.trim() && filteredNav.length === 0 && appResults.length === 0 && correlationResults.length === 0 && workflowResults.length === 0 && !isAnyLoading && (
            <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
              <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
                No results for "{query}"
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};