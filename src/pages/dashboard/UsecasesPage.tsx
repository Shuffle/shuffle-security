/**
 * UsecasesPage — Card grid overview of all data flows grouped by Phase 1/2/3.
 *
 * Self-contained / portable: this file intentionally avoids project-specific
 * hooks (`@/hooks/*`), context (`@/context/*`), api config (`@/config/api`),
 * and the `sonner` toast library so it can be lifted into other platforms
 * with minimal changes. All those concerns are inlined below.
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
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
import { Search, ArrowRight, Download, Zap, Activity, CheckCircle2, Circle, AlertTriangle, Network, Clock, Power, PowerOff, FileJson, X, ExternalLink } from 'lucide-react';
import {
  FLOW_PHASES,
  TOOL_CATEGORIES,
  DEFAULT_USECASES,
  getUsecasesJson,
  apiCategoryToPhase,
  normalizeCategory,
  type FlowPhase,
  type Usecase,
  type ApiUsecase,
  type ApiUsecaseCategory,
} from '@/config/usecases';
import { UsecaseDetailContent } from '@/pages/dashboard/DataFlowDetailPage';
import { IntegrationStatus } from '@/components/layout/IntegrationStatus';

// ============================================================================
// Inlined: API config (was @/config/api)
// ============================================================================
const API_BASE_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SHUFFLE_API_URL) ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://shuffler.io');

const getStoredApiKey = (): string | null => {
  try { return typeof window !== 'undefined' ? window.localStorage.getItem('shuffle_api_key') : null; }
  catch { return null; }
};

const apiUrl = (endpoint: string): string => `${API_BASE_URL}${endpoint}`;

const authHeader = (): Record<string, string> => {
  const key = getStoredApiKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
};

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
// Inlined: usePageMeta (was @/hooks/usePageMeta) — title-only
// ============================================================================
function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}

// ============================================================================
// Inlined: useAuth (was @/context/AuthContext)
// ============================================================================
interface UserInfoLite {
  id?: string;
  username?: string;
  support?: boolean;
}
function useAuthLite() {
  const { data } = useQuery<{ userInfo: UserInfoLite | null; isAuthenticated: boolean }>({
    queryKey: ['usecases-page-auth'],
    queryFn: async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/getinfo'), {
          credentials: 'include',
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
        });
        if (!res.ok) return { userInfo: null, isAuthenticated: false };
        const body = await res.json();
        if (body?.success !== true) return { userInfo: null, isAuthenticated: false };
        return {
          userInfo: { id: body.id, username: body.username, support: body.support === true },
          isAuthenticated: true,
        };
      } catch {
        return { userInfo: null, isAuthenticated: false };
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
  return {
    userInfo: data?.userInfo ?? null,
    isAuthenticated: data?.isAuthenticated ?? false,
  };
}

// ============================================================================
// Inlined: useWorkflows (was @/hooks/useWorkflows)
// ============================================================================
interface WorkflowSummary {
  id: string;
  name: string;
  tags?: string[];
  [key: string]: any;
}
function useWorkflowsLite() {
  return useQuery<WorkflowSummary[]>({
    queryKey: ['usecases-page-workflows'],
    queryFn: async () => {
      const res = await fetch(apiUrl('/api/v1/workflows'), {
        credentials: 'include',
        headers: { ...authHeader() },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.workflows || []);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ============================================================================
// Inlined: useUsecases (was @/hooks/useUsecases)
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
  const query = useQuery({
    queryKey: ['usecases-page-usecases'],
    queryFn: async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/workflows/usecases'), {
          credentials: 'include',
          headers: { ...authHeader() },
        });
        if (!res.ok) return { usecases: DEFAULT_USECASES, apiCategories: [] as ApiUsecaseCategory[], drifts: [] as UsecaseDrift[] };
        const data = await res.json();
        const cats: ApiUsecaseCategory[] = Array.isArray(data) ? data : [];
        if (cats.length === 0) return { usecases: DEFAULT_USECASES, apiCategories: [], drifts: [] };
        const built = buildBackendUsecases(cats);
        return { usecases: built.usecases, apiCategories: cats, drifts: built.drifts };
      } catch {
        return { usecases: DEFAULT_USECASES, apiCategories: [] as ApiUsecaseCategory[], drifts: [] as UsecaseDrift[] };
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const usecases = query.data?.usecases ?? DEFAULT_USECASES;
  const apiCategories = query.data?.apiCategories ?? [];
  const drifts = query.data?.drifts ?? [];
  const driftMap = useMemo(() => {
    const m = new Map<string, UsecaseDrift>();
    for (const d of drifts) m.set(d.usecaseId, d);
    return m;
  }, [drifts]);
  return {
    usecases,
    apiLoaded: apiCategories.length > 0,
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

export default function UsecasesPage() {
  usePageTitle('Usecases');

  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<FlowPhase | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const navigate = useNavigate();
  const { usecases, apiLoaded, getDrift } = useUsecasesLite();
  const { userInfo, isAuthenticated } = useAuthLite();
  const { data: workflows = [], refetch: refetchWorkflows } = useWorkflowsLite();
  const isSupport = userInfo?.support === true;
  const [showAllAsSupport, setShowAllAsSupport] = useState(true);
  const [drawerFlowId, setDrawerFlowId] = useState<string | null>(null);

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

    // Hide inactive (non-animated) usecases for non-support users
    if (!(isSupport && showAllAsSupport)) {
      list = list.filter((u) => u.animated === true);
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
  }, [search, phaseFilter, categoryFilter, tagFilter, usecases, isSupport, showAllAsSupport]);

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
          <Box
            component={Link}
            to="/infrastructure"
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
            <ArrowRight size={14} style={{ opacity: 0.5 }} />
          </Box>
        </Box>
      </Box>

      {/* Selected apps — same format as the AppSearchDrawer's "Your Apps" row */}
      {getStoredApiKey() && (
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
              <IntegrationStatus collapsed={false} showAll hideAddButton hideHeader />
            </Box>
            <Button
              component={Link}
              to="/apps"
              size="small"
              variant="outlined"
              startIcon={<Search size={14} />}
              sx={{
                flexShrink: 0,
                textTransform: 'none',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                '&:hover': {
                  borderColor: 'hsl(var(--primary))',
                  bgcolor: 'hsl(var(--accent))',
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
          mb: 3, px: 2, py: 1.5, borderRadius: 1,
          bgcolor: 'hsl(var(--primary) / 0.06)',
          border: '1px solid hsl(var(--primary) / 0.15)',
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <Zap size={14} style={{ color: 'hsl(var(--primary))' }} />
          <Typography variant="body2" sx={{ color: 'hsl(var(--primary))', fontWeight: 500 }}>
            More usecases coming soon — we're actively building new integrations.
          </Typography>
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search usecases…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            width: { xs: '100%', sm: 280 },
            '& .MuiOutlinedInput-root': {
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              '& fieldset': { borderColor: 'hsl(var(--border))' },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 200 } }}>
          <InputLabel sx={{ color: 'hsl(var(--muted-foreground))' }}>Phase</InputLabel>
          <MuiSelect
            value={phaseFilter}
            label="Phase"
            onChange={(e) => setPhaseFilter(e.target.value as FlowPhase | 'all')}
            sx={{
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              '& fieldset': { borderColor: 'hsl(var(--border))' },
              '& .MuiSelect-icon': { color: 'hsl(var(--muted-foreground))' },
            }}
          >
            <MenuItem value="all">All Phases</MenuItem>
            {FLOW_PHASES.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.step}. {p.label}</MenuItem>
            ))}
          </MuiSelect>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 160 } }}>
          <InputLabel sx={{ color: 'hsl(var(--muted-foreground))' }}>Category</InputLabel>
          <MuiSelect
            value={categoryFilter}
            label="Category"
            onChange={(e) => setCategoryFilter(e.target.value)}
            sx={{
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              '& fieldset': { borderColor: 'hsl(var(--border))' },
              '& .MuiSelect-icon': { color: 'hsl(var(--muted-foreground))' },
            }}
          >
            <MenuItem value="all">All Categories</MenuItem>
            {TOOL_CATEGORIES.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>{cat.label}</MenuItem>
            ))}
          </MuiSelect>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 140 } }}>
          <InputLabel sx={{ color: 'hsl(var(--muted-foreground))' }}>Type</InputLabel>
          <MuiSelect
            value={tagFilter}
            label="Type"
            onChange={(e) => setTagFilter(e.target.value)}
            sx={{
              bgcolor: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              '& fieldset': { borderColor: 'hsl(var(--border))' },
              '& .MuiSelect-icon': { color: 'hsl(var(--muted-foreground))' },
            }}
          >
            <MenuItem value="all">All Types</MenuItem>
            {allTags.map((tag) => (
              <MenuItem key={tag} value={tag}>{tag}</MenuItem>
            ))}
          </MuiSelect>
        </FormControl>
      </Box>

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
            bgcolor: 'hsl(var(--background))',
            backgroundImage: 'none',
          },
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3, py: 2,
          borderBottom: '1px solid hsl(var(--border))',
          position: 'sticky', top: 0, zIndex: 2,
          bgcolor: 'hsl(var(--background))',
        }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Automation
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {drawerFlowId && (
              <Button
                onClick={() => { const id = drawerFlowId; setDrawerFlowId(null); navigate(`/usecases/${id}`); }}
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
          <UsecaseDetailContent
            flowId={drawerFlowId ?? undefined}
            hideBackNav
            onNavigateUsecase={(id) => setDrawerFlowId(id || null)}
          />
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
  onToggled,
  onClick,
}: {
  flow: Usecase;
  drift?: UsecaseDrift;
  apiLoaded: boolean;
  isEnabled: boolean;
  canToggle: boolean;
  onToggled?: () => void;
  onClick: () => void;
}) {
  const sourceCat = categoryLabel(flow.source);
  const isComingSoon = !ACTIVE_USECASE_IDS.includes(flow.id);
  const targetCat = categoryLabel(flow.target);
  const [toggling, setToggling] = useState(false);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
  const effectiveEnabled = optimisticEnabled !== null ? optimisticEnabled : isEnabled;

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

  // Determine sync status
  const isSynced = drift && drift.drifts.length === 0; // matched with no drift
  const isLocalOnly = !drift || drift.drifts.includes('local_only');
  const hasDrift = drift && drift.drifts.length > 0 && !isLocalOnly;

  const syncIcon = !apiLoaded ? null : isSynced ? (
    <Tooltip title="Synced with API" placement="top" arrow>
      <Box sx={{ display: 'inline-flex' }}>
        <CheckCircle2 size={14} style={{ color: 'hsl(var(--severity-low))' }} />
      </Box>
    </Tooltip>
  ) : hasDrift ? (
    <Tooltip title={`Drift detected: ${drift!.drifts.join(', ')}`} placement="top" arrow>
      <Box sx={{ display: 'inline-flex' }}>
        <AlertTriangle size={14} style={{ color: 'hsl(var(--severity-medium))' }} />
      </Box>
    </Tooltip>
  ) : (
    <Tooltip title="Not found in API" placement="top" arrow>
      <Box sx={{ display: 'inline-flex' }}>
        <Circle size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
      </Box>
    </Tooltip>
  );

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
          {!isComingSoon && syncIcon}
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

      {/* Hover-revealed Enable/Disable button */}
      {canToggle && (
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
        </Box>
      )}
    </Card>
  );
}
