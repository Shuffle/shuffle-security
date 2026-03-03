/**
 * UsecasesPage — Card grid overview of all data flows grouped by Phase 1/2/3.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Select as MuiSelect,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Search, ArrowRight, Download, Zap, Activity, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  FLOW_PHASES,
  TOOL_CATEGORIES,
  type FlowPhase,
  type Usecase,
} from '@/config/usecases';
import { useUsecases, type UsecaseDrift } from '@/hooks/useUsecases';
import UsecaseAlluvialDiagram from '@/components/usecases/UsecaseAlluvialDiagram';

const categoryLabel = (id: string) =>
  TOOL_CATEGORIES.find((c) => c.id === id)?.label || id;

const phaseIcon = (phase: FlowPhase) => {
  if (phase === 'ingest') return <Download size={14} />;
  if (phase === 'response') return <Zap size={14} />;
  return <Activity size={14} />;
};

export default function UsecasesPage() {
  usePageMeta({ title: 'Usecases', description: 'Overview of all security data flows grouped by implementation phase.' });

  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<FlowPhase | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const navigate = useNavigate();
  const { usecases, apiLoaded, getDrift } = useUsecases();

  // Collect unique tags across all usecases
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    usecases.forEach((u) => u.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [usecases]);

  const filtered = useMemo(() => {
    let list = usecases;
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
  }, [search, phaseFilter, categoryFilter, tagFilter, usecases]);

  // Group by phase in order
  const grouped = useMemo(() => {
    const phases = phaseFilter === 'all' ? FLOW_PHASES : FLOW_PHASES.filter((p) => p.id === phaseFilter);
    return phases.map((p) => ({
      ...p,
      flows: filtered.filter((f) => f.phase === p.id),
    })).filter((g) => g.flows.length > 0);
  }, [filtered, phaseFilter]);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: 'hsl(var(--foreground))' }}>
        Usecases
      </Typography>
      <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
        All data flows across your security stack — grouped by implementation phase.
      </Typography>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search usecases…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            width: 280,
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

        <FormControl size="small" sx={{ minWidth: 160 }}>
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

        <FormControl size="small" sx={{ minWidth: 140 }}>
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

        <ToggleButtonGroup
          exclusive
          size="small"
          value={phaseFilter}
          onChange={(_, v) => v && setPhaseFilter(v)}
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              color: 'hsl(var(--muted-foreground))',
              borderColor: 'hsl(var(--border))',
              fontSize: '0.8rem',
              px: 1.5,
              '&.Mui-selected': {
                bgcolor: 'hsl(var(--accent))',
                color: 'hsl(var(--accent-foreground))',
              },
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          {FLOW_PHASES.map((p) => (
            <ToggleButton key={p.id} value={p.id}>
              {p.step}. {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Featured: SIEM to Ticket alluvial diagram */}
      {(phaseFilter === 'all' || phaseFilter === 'ingest') && (
        <Card
          variant="outlined"
          sx={{
            bgcolor: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            mb: 5,
            p: { xs: 2, md: 3 },
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip
              label="Featured"
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.65rem',
                height: 20,
                bgcolor: 'hsl(var(--primary) / 0.12)',
                color: 'hsl(var(--primary))',
              }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              SIEM to Ticket
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mb: 2, maxWidth: 600 }}>
            SIEM alerts flow through Shuffle to automatically create and enrich tickets in your case management tools.
          </Typography>
          <UsecaseAlluvialDiagram sourceCategory="siem" targetCategory="case_management" />
        </Card>
      )}

      {/* Grouped card grid */}
      {grouped.map((group) => (
        <Box key={group.id} sx={{ mb: 5 }}>
          {/* Phase header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
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
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
              gap: 2,
            }}
          >
            {group.flows.map((flow) => (
              <UsecaseCard key={flow.id} flow={flow} drift={getDrift(flow.id)} apiLoaded={apiLoaded} onClick={() => navigate(`/infrastructure/flows/${flow.id}`)} />
            ))}
          </Box>
        </Box>
      ))}

      {filtered.length === 0 && (
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', textAlign: 'center', py: 8 }}>
          No usecases match your search.
        </Typography>
      )}
    </Box>
  );
}

function UsecaseCard({ flow, drift, apiLoaded, onClick }: { flow: Usecase; drift?: UsecaseDrift; apiLoaded: boolean; onClick: () => void }) {
  const sourceCat = categoryLabel(flow.source);
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
      <CardActionArea onClick={onClick} sx={{ p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: '100%' }}>
        {/* Label + sync icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, width: '100%' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', flexGrow: 1 }}>
            {flow.label}
          </Typography>
          {syncIcon}
        </Box>

        {/* Source → Target */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            {sourceCat}
          </Typography>
          <ArrowRight size={12} style={{ color: 'hsl(var(--muted-foreground))' }} />
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            {targetCat}
          </Typography>
        </Box>

        {/* Description (truncated) */}
        <Typography
          variant="body2"
          sx={{
            color: 'hsl(var(--muted-foreground))',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            mb: 1.5,
            flexGrow: 1,
          }}
        >
          {flow.description}
        </Typography>

        {/* Tags */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {flow.tags.slice(0, 3).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: 'hsl(var(--muted) / 0.5)',
                color: 'hsl(var(--muted-foreground))',
              }}
            />
          ))}
        </Box>
      </CardActionArea>
    </Card>
  );
}
