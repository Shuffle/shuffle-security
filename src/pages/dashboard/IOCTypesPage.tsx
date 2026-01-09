import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { motion } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useDatastore } from '@/hooks/useDatastore';

const CATEGORY = 'shuffle-cases iocs';

interface IOCType {
  name: string;
  regex: string;
  description?: string;
}

const defaultIOCTypes: IOCType[] = [
  { name: 'IPv4', regex: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$', description: 'IPv4 address' },
  { name: 'IPv6', regex: '^(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}$', description: 'IPv6 address' },
  { name: 'Domain', regex: '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$', description: 'Domain name' },
  { name: 'Email', regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', description: 'Email address' },
  { name: 'MD5', regex: '^[a-fA-F0-9]{32}$', description: 'MD5 hash' },
  { name: 'SHA256', regex: '^[a-fA-F0-9]{64}$', description: 'SHA256 hash' },
  { name: 'URL', regex: '^https?:\\/\\/[^\\s]+$', description: 'URL' },
];

const IOCTypesPage = () => {
  const { items, isLoading, error, fetchItems, addItem, removeItem } = useDatastore({ category: CATEGORY });
  const [iocTypes, setIocTypes] = useState<IOCType[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<IOCType | null>(null);
  const [formData, setFormData] = useState<IOCType>({ name: '', regex: '', description: '' });

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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

  const handleInitDefaults = async () => {
    for (const ioc of defaultIOCTypes) {
      await addItem(ioc.name, ioc);
    }
    await fetchItems();
  };

  const handleOpenDialog = (type?: IOCType) => {
    if (type) {
      setEditingType(type);
      setFormData(type);
    } else {
      setEditingType(null);
      setFormData({ name: '', regex: '', description: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.regex) return;
    
    if (editingType && editingType.name !== formData.name) {
      await removeItem(editingType.name);
    }
    await addItem(formData.name, formData);
    setDialogOpen(false);
    setFormData({ name: '', regex: '', description: '' });
  };

  const handleDelete = async (name: string) => {
    await removeItem(name);
  };

  const testRegex = (regex: string, value: string): boolean => {
    try {
      return new RegExp(regex).test(value);
    } catch {
      return false;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>IOC Types</Typography>
          {isLoading && <CircularProgress size={20} />}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {iocTypes.length === 0 && !isLoading && (
            <Button variant="outlined" onClick={handleInitDefaults}>
              Initialize Defaults
            </Button>
          )}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add IOC Type
          </Button>
        </Box>
      </Box>

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
                  <TableCell>Regex Pattern</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {iocTypes.map((type) => (
                  <TableRow key={type.name} hover>
                    <TableCell>
                      <Chip label={type.name} size="small" sx={{ fontWeight: 500 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {type.regex}
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
                ))}
                {iocTypes.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No IOC types configured. Click "Initialize Defaults" to add common types.</Typography>
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
              placeholder="e.g., IPv4, MD5, Domain"
            />
            <TextField
              label="Regex Pattern"
              value={formData.regex}
              onChange={(e) => setFormData({ ...formData, regex: e.target.value })}
              fullWidth
              placeholder="e.g., ^[a-fA-F0-9]{32}$"
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name || !formData.regex}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default IOCTypesPage;
