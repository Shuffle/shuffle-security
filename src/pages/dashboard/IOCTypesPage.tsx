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
  MenuItem,
  LinearProgress,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
} from '@mui/material';
import { motion } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useDatastore } from '@/hooks/useDatastore';
import { DEFAULT_IOC_TYPES, IOCType, IOC_CATEGORIES, IOCCategory, DEFAULT_ENABLED_IOCS } from '@/hooks/useIOCTypes';
import { DATASTORE_CATEGORIES } from '@/services/datastore';

const CATEGORY = DATASTORE_CATEGORIES.IOCS;

const IOCTypesPage = () => {
  const { items, isLoading, error, fetchItems, addItem, removeItem } = useDatastore({ category: CATEGORY });
  const [iocTypes, setIocTypes] = useState<IOCType[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<IOCType | null>(null);
  const [formData, setFormData] = useState<Partial<IOCType>>({ name: '', regex: '', description: '', category: 'other', needsPattern: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'todo'>('all');
  
  // Regex tester state
  const [testValue, setTestValue] = useState('');
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Auto-initialize defaults if org has no IOC types
  useEffect(() => {
    const autoInitialize = async () => {
      if (isLoading) return;
      if (items.length === 0) {
        const initKey = 'shuffle_ioc_defaults_checked';
        if (sessionStorage.getItem(initKey)) return;
        
        sessionStorage.setItem(initKey, 'true');
        
        setIsInitializing(true);
        setInitProgress(50); // Show progress immediately
        
        // Use bulk API for faster initialization
        const { setDatastoreItems } = await import('@/services/datastore');
        const bulkItems = DEFAULT_IOC_TYPES.map(ioc => ({
          key: ioc.name,
          value: ioc,
        }));
        await setDatastoreItems(bulkItems, CATEGORY);
        
        setInitProgress(100);
        setIsInitializing(false);
        await fetchItems();
      }
    };
    
    autoInitialize();
  }, [items, isLoading, fetchItems]);

  useEffect(() => {
    const parsed: IOCType[] = items.map(item => {
      try {
        const obj = JSON.parse(item.value) as IOCType;
        // Fix double-escaped regex patterns from datastore
        if (obj.regex && obj.regex.includes('\\\\')) {
          console.warn(`[IOC] Fixing double-escaped regex for ${obj.name}: ${obj.regex}`);
          obj.regex = obj.regex.replace(/\\\\/g, '\\');
        }
        return obj;
      } catch {
        return { name: item.key, regex: item.value, description: '' };
      }
    });
    if (parsed.length > 0) {
      console.log('[IOC] Sample parsed regex:', parsed[0].name, parsed[0].regex);
    }
    setIocTypes(parsed);
  }, [items]);

  const handleInitDefaults = async () => {
    setIsInitializing(true);
    setInitProgress(50); // Show progress immediately
    
    // Use bulk API for faster initialization
    const { setDatastoreItems } = await import('@/services/datastore');
    const bulkItems = DEFAULT_IOC_TYPES.map(ioc => ({
      key: ioc.name,
      value: ioc,
    }));
    await setDatastoreItems(bulkItems, CATEGORY);
    
    setInitProgress(100);
    setIsInitializing(false);
    await fetchItems();
  };

  const handleOpenDialog = (type?: IOCType) => {
    if (type) {
      setEditingType(type);
      setFormData(type);
    } else {
      setEditingType(null);
      setFormData({ name: '', regex: '', description: '', category: 'common', needsPattern: false });
    }
    setTestValue('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    
    if (editingType && editingType.name !== formData.name) {
      await removeItem(editingType.name);
    }
    // If regex is provided, auto-clear needsPattern
    const dataToSave = { ...formData };
    if (dataToSave.regex && dataToSave.regex.trim()) {
      dataToSave.needsPattern = false;
    }
    await addItem(formData.name, dataToSave as IOCType);
    setDialogOpen(false);
    setFormData({ name: '', regex: '', description: '', category: 'common', needsPattern: false });
  };

  const handleDelete = async (name: string) => {
    await removeItem(name);
  };

  const handleToggleEnabled = async (type: IOCType) => {
    const updated = { ...type, enabled: !type.enabled };
    await addItem(type.name, updated);
  };

  const enabledCount = useMemo(() => iocTypes.filter(t => t.enabled).length, [iocTypes]);

  // Test regex pattern
  const testRegex = (pattern: string, value: string): boolean | null => {
    if (!pattern || !value) return null;
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return null;
    }
  };

  // Test all patterns against a value
  const handleTestAll = () => {
    if (!testValue.trim()) return;
    const results: Record<string, boolean | null> = {};
    for (const type of filteredAndSortedTypes) {
      if (type.regex) {
        results[type.name] = testRegex(type.regex, testValue);
      }
    }
    setTestResults(results);
  };

  // Count TODO items
  const todoCount = useMemo(() => iocTypes.filter(t => t.needsPattern).length, [iocTypes]);

  // Filter and sort IOC types
  const filteredAndSortedTypes = useMemo(() => {
    let filtered = iocTypes;
    
    // Apply TODO filter
    if (filterMode === 'todo') {
      filtered = filtered.filter(t => t.needsPattern);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query)
      );
    }
    
    // Sort: "common" category first, then alphabetically within categories
    const categoryOrder = IOC_CATEGORIES.map(c => c.id);
    return [...filtered].sort((a, b) => {
      const catA = a.category || 'other';
      const catB = b.category || 'other';
      const orderA = categoryOrder.indexOf(catA as IOCCategory);
      const orderB = categoryOrder.indexOf(catB as IOCCategory);
      
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [iocTypes, searchQuery, filterMode]);

  // Group by category for section headers
  const groupedTypes = useMemo(() => {
    const groups: Record<string, IOCType[]> = {};
    for (const type of filteredAndSortedTypes) {
      const cat = type.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(type);
    }
    return groups;
  }, [filteredAndSortedTypes]);

  const getCategoryInfo = (categoryId: string) => {
    return IOC_CATEGORIES.find(c => c.id === categoryId) || { id: categoryId, label: categoryId, color: '#6b7280' };
  };

  // Dialog regex test result
  const dialogTestResult = useMemo(() => {
    if (!testValue || !formData.regex) return null;
    return testRegex(formData.regex, testValue);
  }, [testValue, formData.regex]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {/* Auto-ingestion note */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 2, py: 1.5, borderRadius: 2, bgcolor: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.18)' }}>
        <Typography variant="body2" sx={{ color: '#fb923c', fontWeight: 500 }}>
          Automatic observable ingestion is not yet fully enabled. IOC types defined here will be used for manual tagging. Automated extraction is coming soon.
        </Typography>
      </Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>IOC Types</Typography>
          {isLoading && <CircularProgress size={20} />}
          <Chip label={`${iocTypes.length} types`} size="small" variant="outlined" />
          <Chip label={`${enabledCount} enabled`} size="small" sx={{ bgcolor: 'hsl(var(--severity-low) / 0.12)', color: 'hsl(var(--severity-low))' }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {/* TODO Filter Toggle */}
          <ToggleButtonGroup
            value={filterMode}
            exclusive
            onChange={(_, val) => val && setFilterMode(val)}
            size="small"
            sx={{ height: 36 }}
          >
            <ToggleButton value="all" sx={{ px: 2, textTransform: 'none', height: 36 }}>
              All
            </ToggleButton>
            <ToggleButton 
              value="todo" 
              sx={{ 
                px: 2, 
                textTransform: 'none',
                gap: 0.5,
                height: 36,
                '&.Mui-selected': {
                  bgcolor: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.25)' },
                },
              }}
            >
              <BuildIcon sx={{ fontSize: 16 }} />
              TODO ({todoCount})
            </ToggleButton>
          </ToggleButtonGroup>
          
          <TextField
            size="small"
            placeholder="Search IOC types..."
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
          {iocTypes.length === 0 && !isLoading && !isInitializing && (
            <Button variant="outlined" onClick={handleInitDefaults} disabled={isInitializing} sx={{ height: 36 }}>
              Initialize Defaults
            </Button>
          )}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} sx={{ height: 36 }}>
            Add IOC Type
          </Button>
        </Box>
      </Box>

      {/* Initialization Progress */}
      {isInitializing && (
        <Card sx={{ mb: 3, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">
              Initializing {DEFAULT_IOC_TYPES.length} default IOC types...
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={initProgress} sx={{ height: 6, borderRadius: 1 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            {Math.round(initProgress)}% complete
          </Typography>
        </Card>
      )}

      {/* Regex Tester Bar */}
      <Card sx={{ mb: 2, p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
            Test patterns:
          </Typography>
          <TextField
            size="small"
            placeholder="Enter a value to test against all patterns..."
            value={testValue}
            onChange={(e) => {
              setTestValue(e.target.value);
              setTestResults({});
            }}
            fullWidth
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                bgcolor: 'rgba(0,0,0,0.2)',
                fontFamily: 'monospace',
              } 
            }}
          />
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<PlayArrowIcon />}
            onClick={handleTestAll}
            disabled={!testValue.trim()}
            sx={{ whiteSpace: 'nowrap', height: 36 }}
          >
            Test All
          </Button>
          {Object.keys(testResults).length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                label={`${Object.values(testResults).filter(v => v === true).length} match`}
                size="small"
                sx={{ bgcolor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
              />
            </Box>
          )}
        </Box>
      </Card>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 60 }}>Enabled</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Regex Pattern</TableCell>
                  <TableCell>Description</TableCell>
                  {Object.keys(testResults).length > 0 && <TableCell>Test</TableCell>}
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {IOC_CATEGORIES.map(category => {
                  const typesInCategory = groupedTypes[category.id];
                  if (!typesInCategory || typesInCategory.length === 0) return null;
                  
                  return [
                    // Category header row
                    <TableRow key={`header-${category.id}`} sx={{ bgcolor: 'hsl(var(--muted) / 0.3)' }}>
                      <TableCell colSpan={Object.keys(testResults).length > 0 ? 7 : 6} sx={{ py: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: category.color }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: category.color }}>
                            {category.label}
                          </Typography>
                          <Chip label={typesInCategory.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                        </Box>
                      </TableCell>
                    </TableRow>,
                    // Types in category
                    ...typesInCategory.map((type) => (
                      <TableRow key={type.name} hover sx={{ opacity: type.enabled ? 1 : 0.5 }}>
                        <TableCell sx={{ py: 0.5 }}>
                          <Switch
                            size="small"
                            checked={!!type.enabled}
                            onChange={() => handleToggleEnabled(type)}
                            color="success"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={type.name} size="small" sx={{ fontWeight: 500 }} />
                            {type.needsPattern && (
                              <Tooltip title="Needs custom regex pattern (TODO)" arrow>
                                <BuildIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={getCategoryInfo(type.category || 'other').label} 
                            size="small" 
                            variant="outlined"
                            sx={{ 
                              fontSize: '0.7rem',
                              borderColor: getCategoryInfo(type.category || 'other').color,
                              color: getCategoryInfo(type.category || 'other').color,
                            }} 
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {type.regex || <Typography component="span" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>No pattern</Typography>}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {type.description || '-'}
                          </Typography>
                        </TableCell>
                        {Object.keys(testResults).length > 0 && (
                          <TableCell>
                            {testResults[type.name] === true && (
                              <Tooltip title="Pattern matches test value" arrow>
                                <CheckCircleIcon sx={{ fontSize: 20, color: '#22c55e' }} />
                              </Tooltip>
                            )}
                            {testResults[type.name] === false && (
                              <Tooltip title="Pattern does not match" arrow>
                                <CancelIcon sx={{ fontSize: 20, color: '#ef4444' }} />
                              </Tooltip>
                            )}
                            {testResults[type.name] === undefined && type.regex && (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                            )}
                          </TableCell>
                        )}
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleOpenDialog(type)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDelete(type.name)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  ];
                })}
                {filteredAndSortedTypes.length === 0 && !isLoading && !isInitializing && (
                  <TableRow>
                    <TableCell colSpan={Object.keys(testResults).length > 0 ? 6 : 5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {filterMode === 'todo' 
                          ? 'No IOC types need patterns. All done!' 
                          : searchQuery 
                            ? 'No IOC types match your search.' 
                            : 'No IOC types configured. Click "Initialize Defaults" to add common indicator types.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingType ? 'Edit IOC Type' : 'Add IOC Type'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              placeholder="e.g., ip, hash_md5, domain"
            />
            <TextField
              select
              label="Category"
              value={formData.category || 'other'}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as IOCCategory })}
              fullWidth
            >
              {IOC_CATEGORIES.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cat.color }} />
                    {cat.label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Regex Pattern"
              value={formData.regex || ''}
              onChange={(e) => setFormData({ ...formData, regex: e.target.value })}
              fullWidth
              placeholder="Optional - e.g., ^[a-fA-F0-9]{32}$"
              helperText={formData.regex ? "Adding a pattern will auto-clear the TODO flag" : "Leave empty if no validation pattern is needed"}
              multiline
              rows={2}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            />
            
            {/* Inline Regex Tester */}
            {formData.regex && (
              <Box sx={{ 
                p: 2, 
                borderRadius: 1, 
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: dialogTestResult === true ? 'success.main' : dialogTestResult === false ? 'error.main' : 'divider',
              }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Test your pattern
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder="Enter test value..."
                    value={testValue}
                    onChange={(e) => setTestValue(e.target.value)}
                    fullWidth
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                      } 
                    }}
                  />
                  {dialogTestResult === true && (
                    <Chip 
                      icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} 
                      label="Match" 
                      size="small"
                      sx={{ bgcolor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                    />
                  )}
                  {dialogTestResult === false && (
                    <Chip 
                      icon={<CancelIcon sx={{ fontSize: 16 }} />} 
                      label="No match" 
                      size="small"
                      sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                    />
                  )}
                </Box>
              </Box>
            )}
            
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              placeholder="Optional description"
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="checkbox"
                id="needsPattern"
                checked={formData.needsPattern || false}
                onChange={(e) => setFormData({ ...formData, needsPattern: e.target.checked })}
                disabled={!!formData.regex?.trim()}
              />
              <label 
                htmlFor="needsPattern" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  cursor: formData.regex?.trim() ? 'not-allowed' : 'pointer',
                  opacity: formData.regex?.trim() ? 0.5 : 1,
                }}
              >
                <BuildIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                <Typography variant="body2">Mark as TODO (needs custom pattern in future)</Typography>
              </label>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default IOCTypesPage;