import { useState, useEffect, useCallback, useMemo } from 'react';
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
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ComputerIcon from '@mui/icons-material/Computer';
import { Monitor, Server, Smartphone, Laptop, Tablet, Wifi, Shield, HardDrive } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useDatastore } from '@/hooks/useDatastore';
import { DATASTORE_CATEGORIES, setDatastoreItem } from '@/services/datastore';
import { CreateAssetDialog } from '@/components/assets/CreateAssetDialog';
import { OCSFDeviceInventory, DEVICE_TYPES, RISK_LEVELS } from '@/config/ocsfAssetSchema';
import { toast } from 'sonner';

// ── Icon helper ──────────────────────────────────────────────────────────────
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
    default: return <ComputerIcon sx={{ fontSize: size }} />;
  }
};

// ── Risk chip color ──────────────────────────────────────────────────────────
const riskColor = (id?: number): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  switch (id) {
    case 4: return 'error';
    case 3: return 'warning';
    case 2: return 'warning';
    case 1: return 'success';
    default: return 'default';
  }
};

// ── Parsed asset row ─────────────────────────────────────────────────────────
interface AssetRow {
  key: string;
  data: OCSFDeviceInventory;
  createdTs: number;
}

const parseAsset = (item: { key: string; value: string; created?: number }): AssetRow | null => {
  try {
    const data = JSON.parse(item.value) as OCSFDeviceInventory;
    if (!data.hostname) return null;
    const createdTs = data.created_time
      ? new Date(data.created_time).getTime()
      : (item.created ? item.created * 1000 : 0);
    return { key: item.key, data, createdTs };
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const AssetsPage = () => {
  usePageMeta({ title: 'Assets', description: 'Manage and monitor your security assets' });

  const { items, isLoading, hasFetched, fetchItems } = useDatastore({ category: DATASTORE_CATEGORIES.ASSETS });
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!hasFetched) fetchItems();
  }, [hasFetched, fetchItems]);

  const assets = useMemo(() => {
    const parsed = items.map(parseAsset).filter(Boolean) as AssetRow[];
    parsed.sort((a, b) => b.createdTs - a.createdTs);
    if (!search.trim()) return parsed;
    const q = search.toLowerCase();
    return parsed.filter(a =>
      a.data.hostname.toLowerCase().includes(q) ||
      a.data.ip?.toLowerCase().includes(q) ||
      a.data.name?.toLowerCase().includes(q) ||
      a.data.domain?.toLowerCase().includes(q) ||
      a.data.type?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const handleCreateAsset = useCallback(async (asset: OCSFDeviceInventory) => {
    const key = asset.metadata?.uid || asset.uid || `asset-${Date.now()}`;
    const ok = await setDatastoreItem(DATASTORE_CATEGORIES.ASSETS, key, JSON.stringify(asset));
    if (ok) {
      toast.success('Asset added', { description: asset.hostname });
      await fetchItems();
    } else {
      toast.error('Failed to add asset');
    }
  }, [fetchItems]);

  const formatTime = (ts?: string) => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Shield size={28} className="text-primary" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.2 }}>Assets</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Manage and monitor devices across your environment
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => fetchItems()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Add Asset
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search by hostname, IP, name, domain…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
          }}
          sx={{ maxWidth: 480 }}
        />
      </Box>

      {/* Loading */}
      {isLoading && !hasFetched && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Empty state */}
      {hasFetched && assets.length === 0 && !isLoading && (
        <Card variant="outlined" sx={{ textAlign: 'center', py: 10 }}>
          <CardContent>
            <ComputerIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>No assets yet</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Add devices manually or let host monitors auto-register them.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Add Asset
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Asset list */}
      {assets.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Header row */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '40px 1.5fr 1fr 0.8fr 0.8fr 0.8fr 1fr',
              gap: 1,
              px: 2,
              py: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}></Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Hostname</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>IP</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Type</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Risk</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Owner</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Last Seen</Typography>
          </Box>

          {assets.map(asset => (
            <Card
              key={asset.key}
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
                  gridTemplateColumns: '40px 1.5fr 1fr 0.8fr 0.8fr 0.8fr 1fr',
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  alignItems: 'center',
                }}
              >
                <Box sx={{ color: 'text.secondary', display: 'flex', justifyContent: 'center' }}>
                  {deviceIcon(asset.data.type_id)}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {asset.data.hostname}
                  </Typography>
                  {asset.data.name && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {asset.data.name}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {asset.data.ip || '—'}
                </Typography>
                <Chip
                  label={asset.data.type || DEVICE_TYPES.find(t => t.id === asset.data.type_id)?.label || 'Unknown'}
                  size="small"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />
                <Chip
                  label={asset.data.risk_level || RISK_LEVELS.find(r => r.id === asset.data.risk_level_id)?.label || 'Info'}
                  size="small"
                  color={riskColor(asset.data.risk_level_id)}
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />
                <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {asset.data.owner?.name || asset.data.owner?.email || '—'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {formatTime(asset.data.last_seen_time)}
                </Typography>
              </Box>
            </Card>
          ))}
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
