/**
 * AppSearchDrawer — Reusable drawer for searching apps.
 * Selecting an app opens the AppDetailDrawer for full configuration.
 */

import { useState } from 'react';
import { Box, Typography, IconButton, Drawer } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { motion, AnimatePresence } from 'framer-motion';
import { SingulJS } from '@/lib/singul-local';
import type { AppSelectedEvent } from '@/lib/singul-local';
import { API_CONFIG } from '@/config/api';
import AppDetailDrawer from '@/components/shared/AppDetailDrawer';
import { ShufflePipelinesBanner } from '@/components/usecases/UsecaseAlluvialDiagram';

// Singul styles — compact dark theme
const singulStyles = {
  container: { width: '100%' },
  inputWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  input: {
    backgroundColor: 'transparent',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '14px',
  },
  searchIcon: { color: 'rgba(255, 255, 255, 0.4)' },
  spinner: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderTopColor: '#FF6600',
  },
  resultsContainer: { marginTop: '12px', gap: '10px' },
  dropdownItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '14px',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dropdownItemHover: {
    borderColor: 'rgba(255, 102, 0, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedItem: {
    backgroundColor: 'rgba(255, 102, 0, 0.1)',
    borderColor: '#FF6600',
  },
  appIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    objectFit: 'contain' as const,
    padding: '4px',
  },
  appName: { fontSize: '13px', fontWeight: 600, color: 'white' },
  appDescription: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 1.4,
  },
  appCategory: {
    marginTop: '6px',
    padding: '2px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    borderRadius: '4px',
    display: 'inline-block',
    width: 'fit-content',
  },
  checkbox: { border: '2px solid rgba(255, 255, 255, 0.2)' },
  checkboxChecked: { backgroundColor: '#FF6600', borderColor: '#FF6600' },
  emptyState: {
    padding: '24px',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center' as const,
    fontSize: '13px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    gridColumn: '1 / -1',
  },
};

interface AppSearchDrawerProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  title?: string;
  subtitle?: string;
  anchor?: 'left' | 'right';
  width?: number;
  /** Show the Shuffle Pipelines banner above search results */
  showPipelinesBanner?: boolean;
}

export default function AppSearchDrawer({
  open,
  onClose,
  initialQuery = '',
  title = 'Add Integration',
  subtitle = 'Search and configure a tool',
  anchor = 'right',
  width = 560,
  showPipelinesBanner = false,
}: AppSearchDrawerProps) {
  const [detailAppName, setDetailAppName] = useState<string | null>(null);

  const handleClose = () => {
    setDetailAppName(null);
    onClose();
  };

  const handleAppSelected = (detail: AppSelectedEvent) => {
    setDetailAppName(detail.app.name);
  };

  return (
    <>
      <Drawer
        anchor={anchor}
        open={open && detailAppName === null}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width,
            maxWidth: '100vw',
            background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
            borderLeft: anchor === 'right' ? '1px solid hsl(var(--border))' : 'none',
            borderRight: anchor === 'left' ? '1px solid hsl(var(--border))' : 'none',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid hsl(var(--border))',
            flexShrink: 0,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
              {title}
            </Typography>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
              {subtitle}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--foreground))' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Search body */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, minHeight: '70vh' }}>
          {showPipelinesBanner && <ShufflePipelinesBanner />}
          <AnimatePresence mode="wait">
            <motion.div
              key="search"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <SingulJS
                authToken={API_CONFIG.apiKey || ''}
                apiKey={API_CONFIG.apiKey || undefined}
                apiBaseUrl={API_CONFIG.baseUrl}
                placeholder="Search integrations..."
                layout="grid"
                gridColumns={2}
                inline={true}
                initialQuery={initialQuery}
                hitsPerPage={12}
                showDescription={false}
                showCategories={true}
                showCheckbox={false}
                multiSelect={false}
                preventDefault={true}
                onAppSelected={handleAppSelected}
                customStyles={singulStyles}
              />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Drawer>

      {/* App detail drawer — opens when an app is selected from search */}
      <AppDetailDrawer
        open={open && detailAppName !== null}
        onClose={() => setDetailAppName(null)}
        appName={detailAppName}
        anchor={anchor}
        width={width}
      />
    </>
  );
}
