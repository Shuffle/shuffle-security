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
} from '@mui/material';
import { motion } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import BuildIcon from '@mui/icons-material/Build';
import { useDatastore } from '@/hooks/useDatastore';
import { DEFAULT_IOC_TYPES, IOCType, IOC_CATEGORIES, IOCCategory } from '@/hooks/useIOCTypes';
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

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Auto-initialize defaults if org has no IOC types - use comprehensive list from useIOCTypes
  useEffect(() => {
    const autoInitialize = async () => {
      if (isLoading) return;
      if (items.length === 0) {
        // Check sessionStorage to avoid repeated initialization attempts in same session
        const initKey = 'shuffle_ioc_defaults_checked';
        if (sessionStorage.getItem(initKey)) return;
        
        sessionStorage.setItem(initKey, 'true');
        
        setIsInitializing(true);
        setInitProgress(0);
        
        // Initialize ALL default IOC types from the comprehensive list
        const total = DEFAULT_IOC_TYPES.length;
        for (let i = 0; i < total; i++) {
          await addItem(DEFAULT_IOC_TYPES[i].name, DEFAULT_IOC_TYPES[i]);
          setInitProgress(((i + 1) / total) * 100);
        }
        
        setIsInitializing(false);
        await fetchItems();
      }
    };
    
    autoInitialize();
  }, [items, isLoading, addItem, fetchItems]);

  useEffect(() => {
    const parsed: IOCType[] = items.map(item => {
      try {
        return JSON.parse(item.value) as IOCType;
      } catch {
        return { name: item.key, regex: item.value, description: '' };
      }
    });
    setIocTypes(parsed);
  }, [items]);

  // Initialize ALL defaults from comprehensive list
  const handleInitDefaults = async () => {
    setIsInitializing(true);
    setInitProgress(0);
    
    const total = DEFAULT_IOC_TYPES.length;
    for (let i = 0; i < total; i++) {
      await addItem(DEFAULT_IOC_TYPES[i].name, DEFAULT_IOC_TYPES[i]);
      setInitProgress(((i + 1) / total) * 100);
    }
    
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
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    
    if (editingType && editingType.name !== formData.name) {
      await removeItem(editingType.name);
    }
    await addItem(formData.name, formData as IOCType);
    setDialogOpen(false);
    setFormData({ name: '', regex: '', description: '', category: 'common', needsPattern: false });
  };

  const handleDelete = async (name: string) => {
    await removeItem(name);
  };

  // Filter and sort IOC types
  const filteredAndSortedTypes = useMemo(() => {
    let filtered = iocTypes;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = iocTypes.filter(t => 
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
  }, [iocTypes, searchQuery]);

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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>IOC Types</Typography>
          {isLoading && <CircularProgress size={20} />}
          <Chip label={`${iocTypes.length} types`} size="small" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
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
            }}
            sx={{ minWidth: 220 }}
          />
          {iocTypes.length === 0 && !isLoading && !isInitializing && (
            <Button variant="outlined" onClick={handleInitDefaults} disabled={isInitializing}>
              Initialize Defaults
            </Button>
          )}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
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

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Regex Pattern</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {IOC_CATEGORIES.map(category => {
                  const typesInCategory = groupedTypes[category.id];
                  if (!typesInCategory || typesInCategory.length === 0) return null;
                  
                  return [
                    // Category header row
                    <TableRow key={`header-${category.id}`} sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                      <TableCell colSpan={5} sx={{ py: 1 }}>
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
                      <TableRow key={type.name} hover>
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
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {searchQuery ? 'No IOC types match your search.' : 'No IOC types configured. Click "Initialize Defaults" to add common indicator types.'}
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
              helperText="Leave empty if no validation pattern is needed"
              multiline
              rows={2}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            />
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
              />
              <label htmlFor="needsPattern" style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
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