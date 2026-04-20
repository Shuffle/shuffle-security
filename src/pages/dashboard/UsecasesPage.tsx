/**
 * UsecasesPage — Card grid overview of all data flows grouped by Phase 1/2/3.
 */

import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
} from '@mui/material';
import { Search, ArrowRight, Download, Zap, Activity, CheckCircle2, Circle, AlertTriangle, Network, Clock } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  FLOW_PHASES,
  TOOL_CATEGORIES,
  type FlowPhase,
  type Usecase,
} from '@/config/usecases';
import { useUsecases, type UsecaseDrift } from '@/hooks/useUsecases';
import UsecaseAlluvialDiagram from '@/components/usecases/UsecaseAlluvialDiagram';
import { useAuth } from '@/context/AuthContext';

const categoryLabel = (id: string) =>
  TOOL_CATEGORIES.find((c) => c.id === id)?.label || id;

const phaseIcon = (phase: FlowPhase) => {
  if (phase === 'ingest') return <Download size={14} />;
  if (phase === 'response') return <Zap size={14} />;
  return <Activity size={14} />;
};

export default function UsecasesPage() {
  usePageMeta({ title: 'Automations', description: 'Overview of all security data flows grouped by implementation phase.' });

  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<FlowPhase | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const navigate = useNavigate();
  const { usecases, apiLoaded, getDrift } = useUsecases();
  const { userInfo, isAuthenticated } = useAuth();
  const isSupport = userInfo?.support === true;
  const [showAllAsSupport, setShowAllAsSupport] = useState(true);

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
            Automations
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            All data flows across your security stack — grouped by implementation phase.
          </Typography>
        </Box>
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
                ? `Support view — showing all ${usecases.length} automations (including ${usecases.filter(u => !u.animated).length} inactive hidden from users)`
                : `Viewing as normal user — showing ${usecases.filter(u => u.animated).length} active automations`
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
            More automations coming soon — we're actively building new integrations.
          </Typography>
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search automations…"
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
              <UsecaseCard key={flow.id} flow={flow} drift={getDrift(flow.id)} apiLoaded={apiLoaded} onClick={() => navigate(`/usecases/${flow.id}`)} />
            ))}
          </Box>
        </Box>
      ))}

      {filtered.length === 0 && (
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', textAlign: 'center', py: 8 }}>
          No automations match your search.
        </Typography>
      )}
    </Box>
  );
}

const ACTIVE_USECASE_IDS = ['siem_case_management_1', 'edr_case_management_1', 'email_case_management_1'];

function UsecaseCard({ flow, drift, apiLoaded, onClick }: { flow: Usecase; drift?: UsecaseDrift; apiLoaded: boolean; onClick: () => void }) {
  const sourceCat = categoryLabel(flow.source);
  const isComingSoon = !ACTIVE_USECASE_IDS.includes(flow.id);
  const targetCat = categoryLabel(flow.target);

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
        bgcolor: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': {
          borderColor: 'hsl(var(--primary) / 0.4)',
          boxShadow: '0 2px 12px hsl(var(--primary) / 0.08)',
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {/* Label + sync icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', flexGrow: 1, fontSize: '0.82rem' }}>
            {flow.label}
          </Typography>
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
    </Card>
  );
}
