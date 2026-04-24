import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  InputAdornment,
  Switch,
  Tooltip,
  Alert,
  MenuItem,
} from '@mui/material';
import { motion } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useThreatFeeds, ThreatFeed, DEFAULT_THREAT_FEEDS } from '@/hooks/useThreatFeeds';
import { useIOCTypes } from '@/hooks/useIOCTypes';
import { getDatastoreItem, setDatastoreItem, DATASTORE_CATEGORIES } from '@/services/datastore';
import { toast } from 'sonner';

// Datastore keys for onboarding config
const ONBOARDING_CONFIG_CATEGORY = 'shuffle-security_onboarding';
const AUTOMATION_CONFIG_KEY = 'automation_config';

const ThreatFeedsPage = () => {
  const { threatFeeds: feeds, isLoading, saveFeed, deleteFeed, toggleFeed, initializeDefaults, refetch } = useThreatFeeds();
  const { iocTypes } = useIOCTypes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<ThreatFeed | null>(null);
  const [formData, setFormData] = useState<Partial<ThreatFeed>>({ 
    name: '', 
    url: '', 
    description: '', 
    enabled: true 
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState<boolean | null>(null);

  // Fetch automation status from onboarding config
  useEffect(() => {
    const fetchAutomationStatus = async () => {
      try {
        const response = await getDatastoreItem(AUTOMATION_CONFIG_KEY, ONBOARDING_CONFIG_CATEGORY);
        if (response.success && response.item?.value) {
          const config = typeof response.item.value === 'string'
            ? JSON.parse(response.item.value)
            : response.item.value;
          setAutomationEnabled(config?.threat_intel?.enabled ?? null);
        }
      } catch (error) {
        console.error('Failed to fetch automation status:', error);
      }
    };
    fetchAutomationStatus();
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-initialize defaults if no feeds exist
  useEffect(() => {
    const autoInitialize = async () => {
      if (isLoading) return;
      if (feeds.length === 0) {
        const initKey = 'shuffle_threat_feeds_checked';
        if (sessionStorage.getItem(initKey)) return;
        
        sessionStorage.setItem(initKey, 'true');
        setIsInitializing(true);
        await initializeDefaults();
        setIsInitializing(false);
      }
    };
    
    autoInitialize();
  }, [feeds, isLoading, initializeDefaults]);

  const handleOpenDialog = (feed?: ThreatFeed) => {
    if (feed) {
      setEditingFeed(feed);
      setFormData(feed);
    } else {
      setEditingFeed(null);
      setFormData({ name: '', url: '', description: '', enabled: true });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.url) return;
    
    const feedToSave: ThreatFeed = {
      id: editingFeed?.id || `feed_${Date.now()}`,
      name: formData.name,
      url: formData.url,
      description: formData.description || '',
      type: formData.type || undefined,
      enabled: formData.enabled ?? true,
    };

    if (editingFeed && editingFeed.id !== feedToSave.id) {
      await deleteFeed(editingFeed.id);
    }
    
    await saveFeed(feedToSave);
    setDialogOpen(false);
    setFormData({ name: '', url: '', description: '', enabled: true });
  };

  const handleDelete = async (id: string) => {
    await deleteFeed(id);
  };

  const handleResetDefaults = async () => {
    setIsInitializing(true);
    try {
      // Bulk-delete every existing feed in parallel, then re-seed defaults.
      // Using deleteDatastoreItems avoids the per-call refetch that
      // useDatastore.removeItem triggers, so the wipe is instant.
      const { deleteDatastoreItems, DATASTORE_CATEGORIES: DSC } =
        await import('@/services/datastore');
      if (feeds.length > 0) {
        await deleteDatastoreItems(feeds.map(f => f.id), DSC.THREAT_FEEDS);
      }
      await initializeDefaults();
    } finally {
      setIsInitializing(false);
    }
  };

  // Filter feeds by search query
  const filteredFeeds = useMemo(() => {
    if (!searchQuery.trim()) return feeds;
    const query = searchQuery.toLowerCase();
    return feeds.filter(f => 
      f.name.toLowerCase().includes(query) ||
      f.url.toLowerCase().includes(query) ||
      f.description?.toLowerCase().includes(query)
    );
  }, [feeds, searchQuery]);

  const enabledCount = useMemo(() => feeds.filter(f => f.enabled).length, [feeds]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <RssFeedIcon sx={{ fontSize: 28, color: 'hsl(var(--primary))' }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>Threat Feeds</Typography>
          {isLoading && <CircularProgress size={20} />}
          <Chip label={`${feeds.length} feeds`} size="small" variant="outlined" />
          <Chip 
            label={`${enabledCount} active`} 
            size="small" 
            sx={{ 
              bgcolor: enabledCount > 0 ? 'hsl(var(--severity-low) / 0.15)' : 'transparent',
              color: enabledCount > 0 ? 'hsl(var(--severity-low))' : 'text.secondary',
              borderColor: enabledCount > 0 ? 'hsl(var(--severity-low))' : undefined,
            }} 
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search feeds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: { height: 36 },
            }}
            sx={{ minWidth: 220 }}
          />
          <Tooltip title="Refresh feeds">
            <IconButton onClick={() => refetch()} sx={{ height: 36, width: 36 }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {feeds.length > 0 && (
            <Tooltip title="Remove all current feeds and restore the curated default list">
              <span>
                <Button 
                  variant="outlined" 
                  onClick={handleResetDefaults} 
                  disabled={isInitializing}
                  sx={{ height: 36 }}
                >
                  Reset to Defaults
                </Button>
              </span>
            </Tooltip>
          )}
          {feeds.length === 0 && !isLoading && !isInitializing && (
            <Button 
              variant="outlined" 
              onClick={initializeDefaults} 
              disabled={isInitializing} 
              sx={{ height: 36 }}
            >
              Initialize Defaults
            </Button>
          )}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} sx={{ height: 36 }}>
            Add Feed
          </Button>
        </Box>
      </Box>

      {/* Automation Status Alert */}
      {automationEnabled !== null && (
        <Alert 
          severity={automationEnabled ? 'success' : 'warning'}
          icon={automationEnabled ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
          sx={{ 
            mb: 2, 
            alignItems: 'center',
            '& .MuiAlert-icon': { 
              color: automationEnabled ? 'hsl(var(--severity-low))' : undefined,
              alignItems: 'center',
              display: 'flex',
              padding: 0,
              marginRight: 1.5,
            },
            '& .MuiAlert-message': { width: '100%', padding: 0, display: 'flex', alignItems: 'center' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Threat Intel Automation: {automationEnabled ? 'Active' : 'Inactive'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {automationEnabled 
                ? '— Incidents will be automatically enriched with threat intelligence from enabled feeds.'
                : '— Enable to automatically enrich incidents with threat intelligence.'}
            </Typography>
            <Button
              size="small"
              variant={automationEnabled ? 'outlined' : 'contained'}
              onClick={async () => {
                try {
                  const response = await getDatastoreItem(AUTOMATION_CONFIG_KEY, ONBOARDING_CONFIG_CATEGORY);
                  let config: any = {};
                  if (response.success && response.item?.value) {
                    config = typeof response.item.value === 'string'
                      ? JSON.parse(response.item.value)
                      : response.item.value;
                  }
                  const newEnabled = !automationEnabled;
                  config.threat_intel = { ...config.threat_intel, enabled: newEnabled };
                  await setDatastoreItem(AUTOMATION_CONFIG_KEY, config, ONBOARDING_CONFIG_CATEGORY);
                  setAutomationEnabled(newEnabled);
                } catch (error) {
                  console.error('Failed to toggle threat intel:', error);
                }
              }}
              sx={{ 
                whiteSpace: 'nowrap',
                ml: 0.5,
              ...(automationEnabled ? {
                  borderColor: 'success.main',
                  color: 'success.main',
                } : {
                  bgcolor: 'warning.main',
                  color: 'warning.contrastText',
                  '&:hover': { bgcolor: 'warning.dark' },
                }),
              }}
            >
              {automationEnabled ? 'Disable' : 'Enable'}
            </Button>
          </Box>
        </Alert>
      )}

      {/* Info Card */}
      <Card sx={{ mb: 2, p: 2, bgcolor: 'hsl(var(--primary) / 0.05)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Threat feeds are external intelligence sources that provide indicators of compromise (IOCs) such as malicious IPs, domains, and file hashes. 
          Enable feeds to automatically enrich incidents with threat intelligence data.
        </Typography>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Enabled</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredFeeds.map((feed) => (
                  <TableRow key={feed.id} hover sx={{ opacity: feed.enabled ? 1 : 0.6 }}>
                    <TableCell>
                      <Switch
                        checked={feed.enabled}
                        onChange={() => toggleFeed(feed.id)}
                        size="small"
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: 'success.main',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: 'success.main',
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RssFeedIcon sx={{ fontSize: 16, color: feed.enabled ? 'hsl(var(--primary))' : 'text.disabled' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {feed.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {feed.type ? (
                        <Chip
                          label={feed.type}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            fontFamily: 'JetBrains Mono, monospace',
                            borderColor: 'hsl(var(--primary) / 0.4)',
                            color: 'hsl(var(--primary))',
                            bgcolor: 'hsl(var(--primary) / 0.06)',
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                          auto
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: 'monospace', 
                            fontSize: '0.75rem', 
                            maxWidth: 400, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {feed.url}
                        </Typography>
                        <Tooltip title="Open in new tab">
                          <IconButton 
                            size="small" 
                            onClick={() => window.open(feed.url, '_blank')}
                            sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                          >
                            <OpenInNewIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {feed.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenDialog(feed)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(feed.id)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredFeeds.length === 0 && !isLoading && !isInitializing && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {searchQuery ? 'No feeds match your search' : 'No threat feeds configured'}
                      </Typography>
                      {!searchQuery && (
                        <Button 
                          variant="text" 
                          onClick={initializeDefaults} 
                          sx={{ mt: 1 }}
                        >
                          Load default feeds
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFeed ? 'Edit Threat Feed' : 'Add Threat Feed'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Name"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            fullWidth
            placeholder="e.g., Abuse.ch SSL Blacklist"
          />
          <TextField
            label="URL"
            value={formData.url || ''}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            fullWidth
            placeholder="https://example.com/feed.csv"
            helperText="URL to the threat feed data (CSV, JSON, or text format)"
          />
          <TextField
            label="Description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            multiline
            rows={2}
            placeholder="Optional description of the feed contents"
          />
          <TextField
            select
            label="IOC Type"
            value={formData.type || ''}
            onChange={(e) => setFormData({ ...formData, type: e.target.value || undefined })}
            fullWidth
            helperText="The IOC type this feed contains. Leave empty to auto-detect per row."
          >
            <MenuItem value="">
              <em>Auto-detect (mixed feed)</em>
            </MenuItem>
            {iocTypes.map((t) => (
              <MenuItem key={t.name} value={t.name}>
                <Box component="span" sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                  {t.name}
                </Box>
                {t.description && (
                  <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                    — {t.description}
                  </Typography>
                )}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch
              checked={formData.enabled ?? true}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            />
            <Typography variant="body2">Enable this feed</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={!formData.name || !formData.url}
          >
            {editingFeed ? 'Save Changes' : 'Add Feed'}
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default ThreatFeedsPage;
