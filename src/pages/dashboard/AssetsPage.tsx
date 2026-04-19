import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import { Search, Plus, RefreshCw, MonitorSmartphone, Server, Monitor, Smartphone, Laptop, Tablet, Wifi, HardDrive } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMultiDatastore } from '@/hooks/useMultiDatastore';
import { setDatastoreItem, DatastoreItem } from '@/services/datastore';
import { ASSET_CATEGORIES, ASSET_CATEGORY_BY_ID, LEGACY_ASSETS_KEY, AssetCategory } from '@/config/assetCategories';
import { CreateAssetDialog } from '@/components/assets/CreateAssetDialog';
import { OCSFDeviceInventory, DEVICE_TYPES, RISK_LEVELS } from '@/config/ocsfAssetSchema';
import { toast } from 'sonner';

// ── Helpers ─────────────────────────────────────────────────────────────────
const ALL_TAB = 'all';

const deviceIcon = (typeId: number, size = 18) => {
  switch (typeId) {
    case 1: return <Server size={size} />;
    case 2: return <Monitor size={size} />;
    case 3: return <Laptop size={size} />;
    case 4: return <Tablet size={size} />;
    case 5: return <Smartphone size={size} />;
    case 6: return <HardDrive size={size} />;
    case 9: case 10: case 11: case 12: case 13: case 14: case 15:
      return <Wifi size={size} />;
    default: return <MonitorSmartphone size={size} />;
  }
};

const riskColor = (id?: number): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  switch (id) {
    case 4: return 'error';
    case 3: case 2: return 'warning';
    case 1: return 'success';
    default: return 'default';
  }
};

interface ParsedAsset {
  key: string;
  categoryId: string;
  raw: unknown;
  // Best-effort normalized fields for the unified table
  name: string;
  identifier?: string; // IP, ARN, region, repo URL, etc.
  type?: string;
  risk?: string;
  riskId?: number;
  owner?: string;
  lastSeen?: string;
  createdTs: number;
  // OCSF device passthrough (only present for endpoints/mobile/compute)
  device?: OCSFDeviceInventory;
}

const parseItem = (item: DatastoreItem, category: AssetCategory): ParsedAsset | null => {
  let value: Record<string, unknown> = {};
  try {
    value = typeof item.value === 'string' ? JSON.parse(item.value) : (item.value as Record<string, unknown>);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  // OCSF device shape
  const device = value as unknown as OCSFDeviceInventory;
  const isDevice = typeof device.hostname === 'string';

  const name =
    (device.hostname as string) ||
    (value.name as string) ||
    (value.title as string) ||
    (value.id as string) ||
    item.key;

  const identifier =
    (device.ip as string) ||
    (value.arn as string) ||
    (value.url as string) ||
    (value.email as string) ||
    (value.region as string) ||
    (value.uid as string) ||
    undefined;

  const createdTs = (device.created_time)
    ? new Date(device.created_time).getTime()
    : (item.created ? item.created * 1000 : 0);

  return {
    key: item.key,
    categoryId: category.id,
    raw: value,
    name,
    identifier,
    type: device.type || (value.type as string) || (value.kind as string),
    risk: device.risk_level || (value.risk_level as string),
    riskId: device.risk_level_id,
    owner: device.owner?.name || device.owner?.email || (value.owner as string),
    lastSeen: device.last_seen_time || (value.last_seen as string),
    createdTs,
    device: isDevice ? device : undefined,
  };
};

const AssetsPage = () => {
  usePageMeta({ title: 'Assets', description: 'Unified inventory across endpoints, cloud, identity, and code' });

  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Endpoints tab also reads the legacy key so existing assets keep showing up
  const categoryKeys = useMemo(
    () => Array.from(new Set([...ASSET_CATEGORIES.map(c => c.datastoreKey), LEGACY_ASSETS_KEY])),
    [],
  );

  const { states, isAnyLoading, refetch } = useMultiDatastore(categoryKeys);

  // Parse + bucket by category
  const parsedByCategory = useMemo(() => {
    const map: Record<string, ParsedAsset[]> = {};
    ASSET_CATEGORIES.forEach(c => {
      const state = states[c.datastoreKey];
      const items = state?.items || [];
      const parsed = items.map(it => parseItem(it, c)).filter(Boolean) as ParsedAsset[];
      map[c.id] = parsed;
    });
    // Merge legacy key into endpoints
    const legacy = states[LEGACY_ASSETS_KEY]?.items || [];
    const endpointsCat = ASSET_CATEGORY_BY_ID.endpoints;
    if (endpointsCat && legacy.length) {
      const legacyParsed = legacy.map(it => parseItem(it, endpointsCat)).filter(Boolean) as ParsedAsset[];
      const existing = new Set(map.endpoints.map(a => a.key));
      map.endpoints = [...map.endpoints, ...legacyParsed.filter(a => !existing.has(a.key))];
    }
    Object.values(map).forEach(arr => arr.sort((a, b) => b.createdTs - a.createdTs));
    return map;
  }, [states]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { [ALL_TAB]: 0 };
    let total = 0;
    ASSET_CATEGORIES.forEach(cat => {
      const n = parsedByCategory[cat.id]?.length || 0;
      c[cat.id] = n;
      total += n;
    });
    c[ALL_TAB] = total;
    return c;
  }, [parsedByCategory]);

  const visibleAssets = useMemo(() => {
    const base = activeTab === ALL_TAB
      ? ASSET_CATEGORIES.flatMap(cat => parsedByCategory[cat.id] || [])
      : (parsedByCategory[activeTab] || []);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.identifier?.toLowerCase().includes(q) ||
      a.type?.toLowerCase().includes(q) ||
      a.owner?.toLowerCase().includes(q),
    );
  }, [activeTab, parsedByCategory, search]);

  const handleCreateAsset = useCallback(async (asset: OCSFDeviceInventory) => {
    const key = asset.metadata?.uid || asset.uid || `asset-${Date.now()}`;
    // Route by device type to the appropriate datastore key
    const targetKey =
      asset.type_id === 4 || asset.type_id === 5 ? ASSET_CATEGORY_BY_ID.mobile.datastoreKey
      : asset.type_id === 1 ? ASSET_CATEGORY_BY_ID.compute.datastoreKey
      : ASSET_CATEGORY_BY_ID.endpoints.datastoreKey;

    const ok = await setDatastoreItem(targetKey, key, JSON.stringify(asset));
    if (ok) {
      toast.success('Asset added', { description: asset.hostname });
      await refetch(targetKey);
    } else {
      toast.error('Failed to add asset');
    }
  }, [refetch]);

  const formatTime = (ts?: string) => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const activeCategory: AssetCategory | null = activeTab === ALL_TAB ? null : ASSET_CATEGORY_BY_ID[activeTab];
  const ActiveIcon = activeCategory?.icon;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, lineHeight: 1.2 }}>Assets</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Unified inventory across endpoints, cloud, identity, and code
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh all sources">
            <IconButton size="small" onClick={() => refetch()} sx={{ height: 36, width: 36 }}>
              <RefreshCw size={16} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)} sx={{ height: 36 }}>
            Add Asset
          </Button>
        </Box>
      </Box>

      {/* Category tabs */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: '0.8rem', py: 1, px: 1.5 } }}
        >
          <Tab
            value={ALL_TAB}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <span>All</span>
                <Chip label={counts[ALL_TAB]} size="small" sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
              </Box>
            }
          />
          {ASSET_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const state = states[cat.datastoreKey];
            const loading = state?.isLoading;
            return (
              <Tab
                key={cat.id}
                value={cat.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {loading ? <CircularProgress size={12} /> : <Icon size={14} />}
                    <span>{cat.short}</span>
                    <Chip
                      label={counts[cat.id]}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                    />
                  </Box>
                }
              />
            );
          })}
        </Tabs>
      </Box>

      {/* Active category description */}
      {activeCategory && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary' }}>
          {ActiveIcon && <ActiveIcon size={14} />}
          <Typography variant="caption">{activeCategory.description}</Typography>
          {states[activeCategory.datastoreKey]?.error && (
            <Chip label="Source error" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
          )}
        </Box>
      )}

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          size="small"
          fullWidth
          placeholder={`Search ${activeTab === ALL_TAB ? 'all assets' : activeCategory?.label.toLowerCase()}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><Search size={16} /></InputAdornment>
            ),
          }}
          sx={{ maxWidth: 480 }}
        />
      </Box>

      {/* Loading initial */}
      {isAnyLoading && counts[ALL_TAB] === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Empty */}
      {!isAnyLoading && visibleAssets.length === 0 && (
        <Card variant="outlined" sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            {activeCategory ? (
              <>
                {ActiveIcon && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, color: 'text.secondary' }}>
                    <ActiveIcon size={42} />
                  </Box>
                )}
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  No {activeCategory.short.toLowerCase()} yet
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  Connect a source or push records to <code>{activeCategory.datastoreKey}</code>.
                </Typography>
              </>
            ) : (
              <>
                <MonitorSmartphone size={42} className="text-muted-foreground mb-3" />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>No assets yet</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  Add devices manually or let host monitors auto-register them.
                </Typography>
              </>
            )}
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
              Add Asset
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Asset list */}
      {visibleAssets.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Header row */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '40px 1.6fr 1fr 0.9fr 0.8fr 0.9fr 1fr',
              gap: 1,
              px: 2,
              py: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <span />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Name</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Identifier</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {activeTab === ALL_TAB ? 'Category' : 'Type'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Risk</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Owner</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Last Seen</Typography>
          </Box>

          {visibleAssets.map(asset => {
            const cat = ASSET_CATEGORY_BY_ID[asset.categoryId];
            const CatIcon = cat?.icon || MonitorSmartphone;
            const showCategory = activeTab === ALL_TAB;
            return (
              <Card
                key={`${asset.categoryId}:${asset.key}`}
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  transition: 'background-color 0.15s',
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1.6fr 1fr 0.9fr 0.8fr 0.9fr 1fr',
                    gap: 1,
                    px: 2,
                    py: 1.5,
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ color: 'text.secondary', display: 'flex', justifyContent: 'center' }}>
                    {asset.device ? deviceIcon(asset.device.type_id) : <CatIcon size={18} />}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asset.name}
                    </Typography>
                    {asset.device?.name && asset.device.name !== asset.name && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {asset.device.name}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.identifier || '—'}
                  </Typography>
                  {showCategory ? (
                    <Chip
                      icon={<CatIcon size={12} />}
                      label={cat?.short || asset.categoryId}
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 22, '& .MuiChip-icon': { ml: 0.75, mr: -0.25 } }}
                    />
                  ) : (
                    <Chip
                      label={asset.type || (asset.device ? DEVICE_TYPES.find(t => t.id === asset.device!.type_id)?.label : null) || '—'}
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 22 }}
                    />
                  )}
                  <Chip
                    label={asset.risk || (asset.device ? RISK_LEVELS.find(r => r.id === asset.device!.risk_level_id)?.label : null) || '—'}
                    size="small"
                    color={riskColor(asset.riskId)}
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.owner || '—'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {formatTime(asset.lastSeen)}
                  </Typography>
                </Box>
              </Card>
            );
          })}
        </Box>
      )}

      <CreateAssetDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateAsset}
      />
    </Box>
  );
};

export default AssetsPage;
