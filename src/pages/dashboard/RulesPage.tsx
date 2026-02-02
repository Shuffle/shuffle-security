import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SecurityIcon from '@mui/icons-material/Security';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'sonner';
import { deleteFile, getFileDownloadUrl, formatFileSize, ShuffleFile, createAndUploadFile } from '@/services/files';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getApiUrl, API_CONFIG } from '@/config/api';

const SIGMA_NAMESPACE = 'sigma';

interface DetectionInfo {
  id: string;
  file_id: string;
  name: string;
  title?: string;
  description?: string;
  status?: string;
  level?: string;
  author?: string;
  created_at?: number;
  updated_at?: number;
  tags?: string[];
  logsource?: {
    category?: string;
    product?: string;
  };
  [key: string]: any;
}

const SIGMA_TEMPLATE = `title: New Detection Rule
id: 
status: experimental
level: medium
description: |
  Describe what this rule detects
author: Your Name
date: ${new Date().toISOString().split('T')[0]}
references:
  - https://example.com/reference
tags:
  - attack.execution
  - attack.t1059
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    CommandLine|contains:
      - 'suspicious_string'
  condition: selection
falsepositives:
  - Legitimate administrative activity
`;

const RulesPage = () => {
  const [files, setFiles] = useState<ShuffleFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<ShuffleFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Create/Edit dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<ShuffleFile | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleContent, setRuleContent] = useState(SIGMA_TEMPLATE);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDetections = async () => {
    setIsLoading(true);
    try {
      const token = API_CONFIG.apiKey || localStorage.getItem('session_token');
      const response = await fetch(getApiUrl('/api/v1/detections/Sigma'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch detections: ${response.status}`);
      }

      const data = await response.json();
      const detections: DetectionInfo[] = data.detection_info || [];
      
      // Map detection_info to ShuffleFile-like structure for compatibility
      const mappedFiles: ShuffleFile[] = detections.map((d) => ({
        id: d.file_id || d.id || d.name,
        filename: d.title || d.name || 'Untitled',
        filesize: 0,
        created_at: d.created_at || Math.floor(Date.now() / 1000),
        updated_at: d.updated_at || d.created_at || Math.floor(Date.now() / 1000),
        namespace: SIGMA_NAMESPACE,
        labels: [
          ...(d.level ? [d.level] : []),
          ...(d.status ? [d.status] : []),
          ...(d.logsource?.product ? [d.logsource.product] : []),
        ],
        org_id: '',
        workflow_id: '',
        md5_sum: '',
        status: d.status || '',
        description: d.description || '',
        ...d, // Include all original detection fields
      }));

      setFiles(mappedFiles);
    } catch (error) {
      console.error('Failed to fetch Sigma detections:', error);
      toast.error('Failed to load Sigma detections');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetections();
  }, []);

  const filteredFiles = files.filter((file) =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewFile = async (file: ShuffleFile) => {
    setSelectedFile(file);
    setIsViewDialogOpen(true);
    setIsContentLoading(true);
    
    try {
      const url = getFileDownloadUrl(file.id);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('shuffle_api_key')}`,
        },
      });
      
      if (response.ok) {
        const content = await response.text();
        setFileContent(content);
      } else {
        setFileContent('Failed to load file content');
      }
    } catch (error) {
      console.error('Failed to fetch file content:', error);
      setFileContent('Error loading file content');
    } finally {
      setIsContentLoading(false);
    }
  };

  const handleDeleteFile = async (file: ShuffleFile) => {
    if (!confirm(`Are you sure you want to delete "${file.filename}"?`)) {
      return;
    }

    try {
      const result = await deleteFile(file.id);
      if (result.success) {
        toast.success(`Deleted ${file.filename}`);
        fetchDetections();
      } else {
        toast.error('Failed to delete file');
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of Array.from(uploadedFiles)) {
      try {
        const result = await createAndUploadFile(file, SIGMA_NAMESPACE, ['sigma', 'detection']);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to upload ${file.name}:`, result.reason);
        }
      } catch (error) {
        failCount++;
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }

    setIsUploading(false);
    
    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
      fetchDetections();
    }
    if (failCount > 0) {
      toast.error(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`);
    }

    // Reset the input
    event.target.value = '';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOpenCreateDialog = () => {
    setEditingFile(null);
    setRuleName('');
    setRuleContent(SIGMA_TEMPLATE);
    setIsCreateDialogOpen(true);
  };

  const handleEditFile = async (file: ShuffleFile) => {
    setEditingFile(file);
    setRuleName(file.filename.replace(/\.(yml|yaml|sigma)$/i, ''));
    setIsCreateDialogOpen(true);
    
    try {
      const token = API_CONFIG.apiKey || localStorage.getItem('session_token');
      const response = await fetch(getApiUrl(`/api/v1/files/${file.id}/content`), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const content = await response.text();
        setRuleContent(content);
      } else {
        toast.error('Failed to load rule content');
        setRuleContent(SIGMA_TEMPLATE);
      }
    } catch (error) {
      console.error('Failed to fetch file content:', error);
      toast.error('Failed to load rule content');
      setRuleContent(SIGMA_TEMPLATE);
    }
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (!ruleContent.trim()) {
      toast.error('Please enter rule content');
      return;
    }

    setIsSaving(true);

    try {
      const token = API_CONFIG.apiKey || localStorage.getItem('session_token');
      
      if (editingFile) {
        // Update existing file using PUT /api/v1/files/{fileid}/edit
        const response = await fetch(getApiUrl(`/api/v1/files/${editingFile.id}/edit`), {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: ruleContent,
            filename: ruleName.endsWith('.yml') ? ruleName : `${ruleName}.yml`,
          }),
        });

        if (response.ok) {
          toast.success('Rule updated successfully');
          setIsCreateDialogOpen(false);
          fetchDetections();
        } else {
          const data = await response.json().catch(() => ({}));
          toast.error(data.reason || 'Failed to update rule');
        }
      } else {
        // Create new file
        const filename = ruleName.endsWith('.yml') ? ruleName : `${ruleName}.yml`;
        const blob = new Blob([ruleContent], { type: 'text/yaml' });
        const file = new File([blob], filename, { type: 'text/yaml' });

        const result = await createAndUploadFile(file, SIGMA_NAMESPACE, ['sigma', 'detection']);
        
        if (result.success) {
          toast.success('Rule created successfully');
          setIsCreateDialogOpen(false);
          fetchDetections();
        } else {
          toast.error(result.reason || 'Failed to save rule');
        }
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
      toast.error('Failed to save rule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <SecurityIcon sx={{ color: 'hsl(var(--primary))', fontSize: 28 }} />
            <Typography variant="h4" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Detection Rules
            </Typography>
          </Box>
          <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Manage Sigma detection rules for threat hunting and alerting
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchDetections}
            disabled={isLoading}
            sx={{
              height: 36,
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              '&:hover': {
                borderColor: 'hsl(var(--border))',
                backgroundColor: 'hsl(var(--muted))',
              },
            }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            component="label"
            startIcon={isUploading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
            disabled={isUploading}
            sx={{
              height: 36,
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              '&:hover': {
                borderColor: 'hsl(var(--border))',
                backgroundColor: 'hsl(var(--muted))',
              },
            }}
          >
            Upload
            <input
              type="file"
              hidden
              multiple
              accept=".yml,.yaml,.sigma"
              onChange={handleUpload}
            />
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
            sx={{
              height: 36,
              backgroundColor: 'hsl(var(--primary))',
              '&:hover': {
                backgroundColor: 'hsl(var(--primary) / 0.9)',
              },
            }}
          >
            Create Rule
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search rules..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{
            width: 320,
            '& .MuiOutlinedInput-root': {
              height: 36,
              backgroundColor: 'hsl(var(--muted))',
              '& fieldset': {
                borderColor: 'hsl(var(--border))',
              },
              '&:hover fieldset': {
                borderColor: 'hsl(var(--border))',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'hsl(var(--primary))',
              },
            },
            '& .MuiOutlinedInput-input': {
              color: 'hsl(var(--foreground))',
              '&::placeholder': {
                color: 'hsl(var(--muted-foreground))',
                opacity: 1,
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ 
          backgroundColor: 'hsl(var(--card))', 
          border: '1px solid hsl(var(--border))',
          minWidth: 140,
        }}>
          <CardContent sx={{ py: 2, px: 3, '&:last-child': { pb: 2 } }}>
            <Typography variant="h4" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
              {files.length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Total Rules
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Table */}
      <Card sx={{ 
        backgroundColor: 'hsl(var(--card))', 
        border: '1px solid hsl(var(--border))',
        borderRadius: 2,
      }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} sx={{ color: 'hsl(var(--primary))' }} />
          </Box>
        ) : filteredFiles.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'hsl(var(--muted-foreground))', mb: 2 }} />
            <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>
              {searchQuery ? 'No rules match your search' : 'No Sigma rules uploaded yet'}
            </Typography>
            {!searchQuery && (
              <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mt: 1 }}>
                Upload .yml or .yaml files to get started
              </Typography>
            )}
          </Box>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Filename</TableHead>
                <TableHead className="text-muted-foreground font-medium">Size</TableHead>
                <TableHead className="text-muted-foreground font-medium">Labels</TableHead>
                <TableHead className="text-muted-foreground font-medium">Created</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow key={file.id} className="border-b border-border">
                  <TableCell className="font-medium text-foreground">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <SecurityIcon sx={{ color: 'hsl(var(--primary))', fontSize: 18 }} />
                      {file.filename}
                    </Box>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(file.filesize)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {file.labels?.map((label) => (
                        <Chip
                          key={label}
                          label={label}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.75rem',
                            backgroundColor: 'hsl(var(--muted))',
                            color: 'hsl(var(--muted-foreground))',
                            border: '1px solid hsl(var(--border))',
                          }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(file.created_at)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title="View">
                        <IconButton
                          size="small"
                          onClick={() => handleViewFile(file)}
                          sx={{ color: 'hsl(var(--muted-foreground))' }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleEditFile(file)}
                          sx={{ color: 'hsl(var(--muted-foreground))' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          component="a"
                          href={getFileDownloadUrl(file.id)}
                          target="_blank"
                          sx={{ color: 'hsl(var(--muted-foreground))' }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteFile(file)}
                          sx={{ color: 'hsl(var(--destructive))' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* View Dialog */}
      <Dialog
        open={isViewDialogOpen}
        onClose={() => setIsViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid hsl(var(--border))',
          color: 'hsl(var(--foreground))',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <SecurityIcon sx={{ color: 'hsl(var(--primary))' }} />
          {selectedFile?.filename}
        </DialogTitle>
        <DialogContent sx={{ p: 0, mt: 0 }}>
          {isContentLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} sx={{ color: 'hsl(var(--primary))' }} />
            </Box>
          ) : (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 3,
                backgroundColor: 'hsl(var(--muted))',
                color: 'hsl(var(--foreground))',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: 500,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {fileContent}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid hsl(var(--border))', px: 3, py: 2 }}>
          <Button
            onClick={() => setIsViewDialogOpen(false)}
            sx={{ color: 'hsl(var(--foreground))' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid hsl(var(--border))',
          color: 'hsl(var(--foreground))',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <AddIcon sx={{ color: 'hsl(var(--primary))' }} />
          {editingFile ? 'Edit Sigma Rule' : 'Create Sigma Rule'}
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Rule Name"
            placeholder="e.g., suspicious_powershell_execution"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            fullWidth
            size="small"
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'hsl(var(--muted))',
                '& fieldset': {
                  borderColor: 'hsl(var(--border))',
                },
                '&:hover fieldset': {
                  borderColor: 'hsl(var(--border))',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'hsl(var(--primary))',
                },
              },
              '& .MuiOutlinedInput-input': {
                color: 'hsl(var(--foreground))',
              },
              '& .MuiInputLabel-root': {
                color: 'hsl(var(--muted-foreground))',
              },
            }}
          />
          <Box>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 1 }}>
              Rule Content (YAML)
            </Typography>
            <TextField
              multiline
              rows={20}
              value={ruleContent}
              onChange={(e) => setRuleContent(e.target.value)}
              fullWidth
              placeholder="Enter Sigma rule YAML..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'hsl(var(--muted))',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  '& fieldset': {
                    borderColor: 'hsl(var(--border))',
                  },
                  '&:hover fieldset': {
                    borderColor: 'hsl(var(--border))',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'hsl(var(--primary))',
                  },
                },
                '& .MuiOutlinedInput-input': {
                  color: 'hsl(var(--foreground))',
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid hsl(var(--border))', px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={() => setIsCreateDialogOpen(false)}
            sx={{ color: 'hsl(var(--muted-foreground))' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRule}
            disabled={isSaving || !ruleName.trim() || !ruleContent.trim()}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              backgroundColor: 'hsl(var(--primary))',
              '&:hover': {
                backgroundColor: 'hsl(var(--primary) / 0.9)',
              },
            }}
          >
            {editingFile ? 'Update Rule' : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RulesPage;
