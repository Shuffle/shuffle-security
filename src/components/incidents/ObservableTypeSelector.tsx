import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Popper,
  Paper,
  Typography,
  Chip,
  InputAdornment,
  ClickAwayListener,
  Divider,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import BuildIcon from '@mui/icons-material/Build';
import { IOC_CATEGORIES, IOCType, IOCCategory } from '@/hooks/useIOCTypes';
import { useDatastore } from '@/hooks/useDatastore';
import { DATASTORE_CATEGORIES } from '@/services/datastore';

interface ObservableTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  iocTypes: IOCType[];
  onTypeCreated?: () => void;
}

export const ObservableTypeSelector = ({
  value,
  onChange,
  iocTypes,
  onTypeCreated,
}: ObservableTypeSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { addItem } = useDatastore({ category: DATASTORE_CATEGORIES.IOCS });

  // Filter and group types
  const filteredTypes = useMemo(() => {
    if (!searchQuery.trim()) return iocTypes;
    const query = searchQuery.toLowerCase();
    return iocTypes.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  }, [iocTypes, searchQuery]);

  // Group by category
  const groupedTypes = useMemo(() => {
    const groups: Record<string, IOCType[]> = {};
    
    // Sort by category order
    const categoryOrder = IOC_CATEGORIES.map(c => c.id);
    const sorted = [...filteredTypes].sort((a, b) => {
      const catA = a.category || 'other';
      const catB = b.category || 'other';
      const orderA = categoryOrder.indexOf(catA as IOCCategory);
      const orderB = categoryOrder.indexOf(catB as IOCCategory);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    
    for (const type of sorted) {
      const cat = type.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(type);
    }
    return groups;
  }, [filteredTypes]);

  // Check if search query matches any existing type
  const exactMatch = useMemo(() => {
    return iocTypes.some(t => t.name.toLowerCase() === searchQuery.toLowerCase());
  }, [iocTypes, searchQuery]);

  const canCreate = searchQuery.trim() && !exactMatch;

  const getCategoryInfo = (categoryId: string) => {
    return IOC_CATEGORIES.find(c => c.id === categoryId) || { id: categoryId, label: categoryId, color: '#6b7280' };
  };

  const handleSelect = (typeName: string) => {
    onChange(typeName);
    setOpen(false);
    setSearchQuery('');
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    
    const newType: IOCType = {
      name: searchQuery.trim(),
      category: 'other',
      description: 'Custom observable type',
      needsPattern: true,
    };
    
    await addItem(newType.name, newType);
    onChange(newType.name);
    setOpen(false);
    setSearchQuery('');
    setIsCreating(false);
    onTypeCreated?.();
  };

  const handleOpen = () => {
    setOpen(true);
    // Focus input after open
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Get display label for selected type
  const selectedType = iocTypes.find(t => t.name === value);

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={anchorRef} sx={{ position: 'relative' }}>
        {/* Trigger */}
        <Box
          onClick={handleOpen}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 1,
            border: '1px solid',
            borderColor: open ? 'primary.main' : 'rgba(255,255,255,0.15)',
            bgcolor: 'rgba(0,0,0,0.2)',
            cursor: 'pointer',
            minWidth: 140,
            '&:hover': { borderColor: 'rgba(255,255,255,0.3)' },
          }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            {value || 'Select type...'}
          </Typography>
          {selectedType?.needsPattern && (
            <BuildIcon sx={{ fontSize: 14, color: 'warning.main' }} />
          )}
        </Box>

        {/* Dropdown */}
        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1400, width: anchorRef.current?.offsetWidth || 280, minWidth: 280 }}
        >
          <Paper
            sx={{
              mt: 0.5,
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              maxHeight: 400,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Search Input */}
            <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <TextField
                inputRef={inputRef}
                size="small"
                placeholder="Search or create type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canCreate) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(0,0,0,0.2)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  },
                }}
              />
            </Box>

            {/* Create New Option */}
            {canCreate && (
              <Box sx={{ p: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Button
                  fullWidth
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleCreate}
                  disabled={isCreating}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    color: '#22c55e',
                    bgcolor: 'rgba(34, 197, 94, 0.1)',
                    '&:hover': { bgcolor: 'rgba(34, 197, 94, 0.2)' },
                  }}
                >
                  Create "{searchQuery.trim()}"
                </Button>
              </Box>
            )}

            {/* Grouped Options */}
            <Box sx={{ overflow: 'auto', maxHeight: 320 }}>
              {IOC_CATEGORIES.map((category) => {
                const typesInCategory = groupedTypes[category.id];
                if (!typesInCategory || typesInCategory.length === 0) return null;
                
                return (
                  <Box key={category.id}>
                    {/* Category Header */}
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        bgcolor: 'rgba(255,255,255,0.02)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: category.color }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: category.color }}>
                        {category.label}
                      </Typography>
                      <Chip label={typesInCategory.length} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                    </Box>
                    
                    {/* Types */}
                    {typesInCategory.map((type) => (
                      <Box
                        key={type.name}
                        onClick={() => handleSelect(type.name)}
                        sx={{
                          px: 1.5,
                          py: 1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          bgcolor: value === type.name ? 'rgba(255, 102, 0, 0.1)' : 'transparent',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: value === type.name ? 600 : 400, flex: 1 }}>
                          {type.name}
                        </Typography>
                        {type.needsPattern && (
                          <BuildIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                        )}
                        {type.description && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.disabled',
                              maxWidth: 120,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {type.description}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                );
              })}
              
              {filteredTypes.length === 0 && !canCreate && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No types found
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};