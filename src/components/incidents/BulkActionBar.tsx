import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, CheckCircle, X, XCircle } from 'lucide-react';
import { useState } from 'react';

interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => Promise<void>;
  onClose: () => Promise<void>;
  onClear: () => void;
}

export const BulkActionBar = ({ selectedCount, onDelete, onClose, onClear }: BulkActionBarProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    try {
      await onClose();
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1.5,
              borderRadius: 3,
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 600, 
                color: 'hsl(var(--foreground))',
                minWidth: 100,
              }}
            >
              {selectedCount} selected
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={isClosing ? <CircularProgress size={16} /> : <CheckCircle size={16} />}
                onClick={handleClose}
                disabled={isClosing || isDeleting}
                sx={{
                  height: 36,
                  borderColor: 'hsl(var(--border))',
                  color: '#22c55e',
                  '&:hover': {
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  },
                }}
              >
                Resolve
              </Button>
              
              <Button
                size="small"
                variant="outlined"
                startIcon={isDeleting ? <CircularProgress size={16} /> : <Trash2 size={16} />}
                onClick={handleDelete}
                disabled={isDeleting || isClosing}
                sx={{
                  height: 36,
                  borderColor: 'hsl(var(--border))',
                  color: '#ef4444',
                  '&:hover': {
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  },
                }}
              >
                Delete
              </Button>
            </Box>

            <Button
              size="small"
              onClick={onClear}
              sx={{
                minWidth: 'auto',
                p: 0.5,
                color: 'hsl(var(--muted-foreground))',
                '&:hover': {
                  color: 'hsl(var(--foreground))',
                  backgroundColor: 'transparent',
                },
              }}
            >
              <XCircle size={20} />
            </Button>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};