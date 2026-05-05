import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Chip,
  Dialog,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import { 
  ShuffleFile, 
  createAndUploadFile, 
  deleteFile, 
  getFileDownloadUrl, 
  formatFileSize 
} from '@/services/files';
import { getAuthHeader } from '@/Shuffle-MCPs/api';
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
  hideAddButton?: boolean;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

const isImageFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext || '');
};

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext || '')) {
    return <ImageIcon sx={{ fontSize: 16 }} />;
  }
  if (ext === 'pdf') {
    return <PictureAsPdfIcon sx={{ fontSize: 16 }} />;
  }
  return <InsertDriveFileIcon sx={{ fontSize: 16 }} />;
};

// Hook to load image blob URL with auth
const useImagePreview = (fileId: string, isImage: boolean) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    
    const url = getFileDownloadUrl(fileId);
    fetch(url, {
      credentials: 'include',
      headers: { ...getAuthHeader() },
    })
      .then(res => res.blob())
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [fileId, isImage]);

  return blobUrl;
};

// Image thumbnail component with preview
const ImageThumbnail = ({ 
  attachment, 
  onDelete, 
  onDownload 
}: { 
  attachment: FileAttachment; 
  onDelete: () => void; 
  onDownload: () => void;
}) => {
  const blobUrl = useImagePreview(attachment.id, true);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          width: 64,
          height: 64,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
          flexShrink: 0,
          '&:hover .overlay': { opacity: 1 },
        }}
        onClick={() => blobUrl && setShowPreview(true)}
      >
        {blobUrl ? (
          <img 
            src={blobUrl} 
            alt={attachment.filename}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
          }}>
            <CircularProgress size={16} sx={{ color: 'text.secondary' }} />
          </Box>
        )}
        
        {/* Hover overlay */}
        <Box 
          className="overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            opacity: 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            sx={{ color: 'white', p: 0.5 }}
          >
            <DownloadIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            sx={{ color: 'error.main', p: 0.5 }}
          >
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Full preview dialog */}
      <Dialog 
        open={showPreview} 
        onClose={() => setShowPreview(false)}
        maxWidth="lg"
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
          }
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => setShowPreview(false)}
            sx={{
              position: 'absolute',
              top: -40,
              right: 0,
              color: 'white',
              bgcolor: 'rgba(0,0,0,0.5)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {blobUrl && (
            <img 
              src={blobUrl} 
              alt={attachment.filename}
              style={{ 
                maxWidth: '90vw', 
                maxHeight: '80vh', 
                borderRadius: 8,
              }}
            />
          )}
        </Box>
      </Dialog>
    </>
  );
};

export const FileAttachments = ({
  attachments,
  onChange,
  namespace = 'incidents',
  labels = [],
  compact = false,
  hideAddButton = false,
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

  const handleDownload = async (attachment: FileAttachment) => {
    try {
      const url = getFileDownloadUrl(attachment.id);
      const res = await fetch(url, {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleOpen = async (attachment: FileAttachment) => {
    try {
      const url = getFileDownloadUrl(attachment.id);
      const res = await fetch(url, {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error('Open failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      toast.error('Failed to open file');
    }
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
            onClick={() => handleOpen(attachment)}
            sx={{
              bgcolor: 'hsl(var(--muted) / 0.5)',
              '&:hover': { bgcolor: 'hsl(var(--muted) / 0.8)' },
              '& .MuiChip-icon': { color: 'text.secondary' },
            }}
          />
        ))}
        
        {!hideAddButton && (
          <Tooltip title="Attach file">
            <IconButton
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              sx={{
                color: 'text.secondary',
                border: '1px dashed hsl(var(--border))',
                borderRadius: 1,
                '&:hover': { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' },
              }}
            >
              {uploading ? (
                <CircularProgress size={16} sx={{ color: 'text.secondary' }} />
              ) : (
                <AttachFileIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
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
      
      {/* File list - split into images and other files */}
      {attachments.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {/* Image grid */}
          {attachments.filter(a => isImageFile(a.filename)).length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              {attachments
                .filter(a => isImageFile(a.filename))
                .map((attachment) => (
                  <ImageThumbnail
                    key={attachment.id}
                    attachment={attachment}
                    onDelete={() => handleDelete(attachment)}
                    onDownload={() => handleDownload(attachment)}
                  />
                ))}
            </Box>
          )}

          {/* Non-image files */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {attachments
              .filter(a => !isImageFile(a.filename))
              .map((attachment) => (
                <Box
                  key={attachment.id}
                  onClick={() => handleOpen(attachment)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'hsl(var(--muted) / 0.35)',
                    border: '1px solid hsl(var(--border))',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'hsl(var(--muted) / 0.55)' },
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
                      onClick={(e) => { e.stopPropagation(); handleDownload(attachment); }}
                      sx={{ color: 'text.secondary' }}
                    >
                      <DownloadIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small" 
                      onClick={(e) => { e.stopPropagation(); handleDelete(attachment); }}
                      sx={{ 
                        color: 'text.disabled',
                        '&:hover': { color: 'hsl(var(--destructive))' },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
          </Box>
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
          border: '1px dashed hsl(var(--border))',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: uploading ? 'hsl(var(--border))' : 'hsl(var(--primary))',
            bgcolor: uploading ? 'transparent' : 'hsl(var(--primary) / 0.05)',
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
