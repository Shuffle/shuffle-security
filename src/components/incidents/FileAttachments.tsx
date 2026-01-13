import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Chip,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { 
  ShuffleFile, 
  createAndUploadFile, 
  deleteFile, 
  getFileDownloadUrl, 
  formatFileSize 
} from '@/services/files';
import { API_CONFIG } from '@/config/api';
import { toast } from 'sonner';

interface FileAttachment {
  id: string;
  filename: string;
  filesize: number;
  uploadedAt?: number;
}

interface FileAttachmentsProps {
  attachments: FileAttachment[];
  onChange: (attachments: FileAttachment[]) => void;
  namespace?: string;
  labels?: string[];
  compact?: boolean;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return <ImageIcon sx={{ fontSize: 16 }} />;
  }
  if (ext === 'pdf') {
    return <PictureAsPdfIcon sx={{ fontSize: 16 }} />;
  }
  return <InsertDriveFileIcon sx={{ fontSize: 16 }} />;
};

export const FileAttachments = ({
  attachments,
  onChange,
  namespace = 'incidents',
  labels = [],
  compact = false,
}: FileAttachmentsProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: FileAttachment[] = [];

    for (const file of Array.from(files)) {
      const result = await createAndUploadFile(file, namespace, labels);
      if (result.success && result.file) {
        newAttachments.push({
          id: result.file.id,
          filename: result.file.filename,
          filesize: result.file.filesize,
          uploadedAt: Date.now(),
        });
        toast.success(`Uploaded ${file.name}`);
      } else {
        toast.error(`Failed to upload ${file.name}: ${result.reason}`);
      }
    }

    if (newAttachments.length > 0) {
      onChange([...attachments, ...newAttachments]);
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachment: FileAttachment) => {
    const result = await deleteFile(attachment.id);
    if (result.success) {
      onChange(attachments.filter(a => a.id !== attachment.id));
      toast.success(`Deleted ${attachment.filename}`);
    } else {
      toast.error('Failed to delete file');
    }
  };

  const handleDownload = (attachment: FileAttachment) => {
    const url = getFileDownloadUrl(attachment.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename;
    link.target = '_blank';
    // Add auth header via fetch and blob
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
      },
    })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        toast.error('Failed to download file');
      });
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          multiple
        />
        
        {attachments.map((attachment) => (
          <Chip
            key={attachment.id}
            icon={getFileIcon(attachment.filename)}
            label={attachment.filename}
            size="small"
            onDelete={() => handleDelete(attachment)}
            onClick={() => handleDownload(attachment)}
            sx={{
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              '& .MuiChip-icon': { color: 'text.secondary' },
            }}
          />
        ))}
        
        <Tooltip title="Attach file">
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            sx={{
              color: 'text.secondary',
              border: '1px dashed rgba(255,255,255,0.2)',
              borderRadius: 1,
              '&:hover': { borderColor: '#ff6600', color: '#ff6600' },
            }}
          >
            {uploading ? (
              <CircularProgress size={16} sx={{ color: 'text.secondary' }} />
            ) : (
              <AttachFileIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        multiple
      />
      
      {/* File list */}
      {attachments.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {attachments.map((attachment) => (
            <Box
              key={attachment.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Box sx={{ color: 'text.secondary' }}>
                {getFileIcon(attachment.filename)}
              </Box>
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {attachment.filename}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {formatFileSize(attachment.filesize)}
                </Typography>
              </Box>
              
              <Tooltip title="Download">
                <IconButton 
                  size="small" 
                  onClick={() => handleDownload(attachment)}
                  sx={{ color: 'text.secondary' }}
                >
                  <DownloadIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Delete">
                <IconButton 
                  size="small" 
                  onClick={() => handleDelete(attachment)}
                  sx={{ 
                    color: 'text.disabled',
                    '&:hover': { color: '#ef4444' },
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}
      
      {/* Upload button */}
      <Box
        onClick={() => !uploading && fileInputRef.current?.click()}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          p: 2,
          borderRadius: 1,
          border: '1px dashed rgba(255,255,255,0.15)',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: uploading ? 'rgba(255,255,255,0.15)' : '#ff6600',
            bgcolor: uploading ? 'transparent' : 'rgba(255, 102, 0, 0.05)',
          },
        }}
      >
        {uploading ? (
          <CircularProgress size={20} sx={{ color: 'text.secondary' }} />
        ) : (
          <>
            <AttachFileIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Click to attach files
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};

export default FileAttachments;
