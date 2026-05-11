/**
 * AppSearchDrawer — Reusable drawer for searching apps.
 * Selecting an app opens the AppDetailDrawer for full configuration.
 */

import { useState } from 'react';
import { Box, Typography, IconButton, Drawer, Avatar, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { motion, AnimatePresence } from 'framer-motion';
import { ShuffleMCP, AppDetailDrawer } from '@/Shuffle-MCPs';
import type { AppSelectedEvent } from '@/Shuffle-MCPs';
import { API_CONFIG } from '@/Shuffle-MCPs/api';
import { ShufflePipelinesBanner } from '@/Shuffle-MCPs/ShufflePipelinesBanner';
import { IntegrationStatus } from '@/Shuffle-MCPs/IntegrationStatus';

// Singul styles — compact dark theme
const singulStyles = {
  container: { width: '100%' },
  inputWrapper: {
    backgroundColor: 'hsl(var(--background-elevated))',
    borderRadius: '12px',
    border: '1px solid hsl(var(--border))',
  },
  input: {
    backgroundColor: 'transparent',
    color: 'hsl(var(--foreground))',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '14px',
  },
  searchIcon: { color: 'hsl(var(--muted-foreground))' },
  spinner: {
    borderColor: 'hsl(var(--border))',
    borderTopColor: 'hsl(var(--primary))',
  },
  resultsContainer: { marginTop: '12px', gap: '10px' },
  dropdownItem: {
    backgroundColor: 'hsl(var(--input))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '12px',
    padding: '14px',
    color: 'hsl(var(--foreground))',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dropdownItemHover: {
    borderColor: 'hsl(var(--primary) / 0.5)',
    backgroundColor: 'hsl(var(--accent) / 0.08)',
  },
  selectedItem: {
    backgroundColor: 'hsl(var(--primary) / 0.1)',
    borderColor: 'hsl(var(--primary))',
  },
  appIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'hsl(var(--muted))',
    objectFit: 'contain' as const,
    padding: '4px',
  },
  appName: { fontSize: '13px', fontWeight: 600, color: 'hsl(var(--foreground))' },
  appDescription: {
    fontSize: '11px',
    color: 'hsl(var(--muted-foreground))',
    lineHeight: 1.4,
  },
  appCategory: {
    marginTop: '6px',
    padding: '2px 8px',
    backgroundColor: 'hsl(var(--muted))',
    color: 'hsl(var(--muted-foreground))',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    borderRadius: '4px',
    display: 'inline-block',
    width: 'fit-content',
  },
  checkbox: { border: '2px solid hsl(var(--border))' },
  checkboxChecked: { backgroundColor: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))' },
  emptyState: {
    padding: '24px',
    color: 'hsl(var(--muted-foreground))',
    textAlign: 'center' as const,
    fontSize: '13px',
    backgroundColor: 'hsl(var(--muted))',
    borderRadius: '12px',
    border: '1px solid hsl(var(--border))',
    gridColumn: '1 / -1',
  },
};

interface ConnectionPathApp {
  name: string;
  icon: string;
  hasValidAuth?: boolean;
  isActiveOnly?: boolean;
}

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
  /** If provided, selecting an app calls this instead of opening AppDetailDrawer */
  onQuickSelect?: (app: { name: string; icon: string; categories: string[]; id: string | null }) => void;
  /** If provided, called before default behavior. Return true to prevent opening detail drawer. */
  onSelectOverride?: (app: { name: string; icon: string; categories: string[] }) => boolean;
  /** Called when the detail drawer closes, with the app name that was being configured */
  onDetailClose?: (appName: string) => void;
  /** When set, replaces Activate with "+ Add" in the detail drawer */
  onAddToCanvas?: (appInfo: { name: string; icon: string; algoliaId: string | null }) => void;
  /** When set, apps matching this category are sorted to the top in user's apps */
  priorityCategory?: string;
  /** Apps currently in the connection path diagram — shown first in the drawer */
  connectionPathApps?: ConnectionPathApp[];
  /** Apps to pin at the top of the ShuffleMCP search results (deduped by name). */
  pinnedApps?: Array<{ name: string; image_url: string; categories?: string[]; objectID?: string }>;
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
  onQuickSelect,
  onSelectOverride,
  onDetailClose,
  onAddToCanvas,
  priorityCategory,
  connectionPathApps,
  pinnedApps,
}: AppSearchDrawerProps) {
  const [detailAppName, setDetailAppName] = useState<string | null>(null);
  const [detailAppId, setDetailAppId] = useState<string | null>(null);

  const handleClose = () => {
    setDetailAppName(null);
    setDetailAppId(null);
    onClose();
  };

  const handleAppSelected = (detail: AppSelectedEvent) => {
    const algoliaId = (detail.app as any).objectID || null;
    const appInfo = {
      name: detail.app.name,
      icon: detail.app.image_url || '',
      categories: detail.app.categories || [],
      id: algoliaId,
    };
    if (onQuickSelect) {
      onQuickSelect(appInfo);
      onClose();
      return;
    }
    if (onSelectOverride?.(appInfo)) {
      return;
    }
    setDetailAppName(detail.app.name);
    setDetailAppId(algoliaId);
  };

  return (
    <>
      <Drawer
        anchor={anchor}
        open={open && detailAppName === null}
        onClose={handleClose}
        sx={{
          zIndex: 9999,
          '& .MuiDrawer-paper': {
            width,
            maxWidth: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
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
        <Box sx={{ flex: 1, boxSizing: 'border-box', overflow: 'hidden', p: 3, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {showPipelinesBanner && <ShufflePipelinesBanner />}

          {/* Your Apps — reuse IntegrationStatus */}
          {API_CONFIG.apiKey && (
            <Box sx={{ mb: 2.5 }}>
              <IntegrationStatus collapsed={false} showAll hideAddButton priorityCategory={priorityCategory} />
            </Box>
          )}

          {/* Connection path apps — shown first */}
          {connectionPathApps && connectionPathApps.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                In this usecase
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {connectionPathApps.map((app) => (
                  <Tooltip key={app.name} title={app.name.replace(/_/g, ' ')} arrow placement="bottom">
                    <Box
                      onClick={() => handleAppSelected({ app: { name: app.name, image_url: app.icon, categories: [] } } as any)}
                      sx={{
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                        '&:hover': { transform: 'scale(1.1)' },
                      }}
                    >
                      <Avatar
                        src={app.icon}
                        alt={app.name}
                        sx={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: 'hsl(var(--muted))' }}
                        variant="rounded"
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          backgroundColor: app.hasValidAuth ? 'hsl(var(--severity-low))' : app.isActiveOnly ? 'hsl(var(--destructive))' : 'hsl(var(--severity-medium))',
                          border: '1.5px solid hsl(var(--card))',
                        }}
                      />
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              '& .singul-container, & .singul-search-bar-container': {
                height: '100%',
                minHeight: 0,
              },
              '& .singul-search-bar-container': {
                display: 'flex',
                flexDirection: 'column',
              },
              '& .singul-results-container': {
                flex: 1,
                minHeight: 0,
                maxHeight: 'none',
                overflowY: 'auto',
              },
              '& .singul-results-grid': {
                gridAutoRows: '75px',
                gap: '12px',
              },
              '& .singul-results-grid .singul-dropdown-item': {
                minHeight: 75,
                maxHeight: 75,
                height: 75,
                padding: '14px 16px',
                alignItems: 'center',
                overflow: 'hidden',
              },
              '& .singul-results-grid .singul-app-info': {
                alignItems: 'center',
                gap: '12px',
              },
              '& .singul-results-grid .singul-app-icon': {
                width: 40,
                height: 40,
                borderRadius: 8,
                padding: 4,
              },
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key="search"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ height: '100%', minHeight: 0 }}
              >
                <ShuffleMCP
                  apiKey={API_CONFIG.apiKey || undefined}
                  apiBaseUrl={API_CONFIG.baseUrl}
                  placeholder={initialQuery ? `Search ${initialQuery} integrations...` : 'Search integrations...'}
                  layout="grid"
                  gridColumns={2}
                  inline={true}
                  initialFilterQuery={initialQuery}
                  hitsPerPage={12}
                  showDescription={false}
                  showCategories={true}
                  showCheckbox={false}
                  multiSelect={false}
                  preventDefault={true}
                  onAppSelected={handleAppSelected}
                  pinnedApps={pinnedApps?.map(p => ({
                    name: p.name,
                    image_url: p.image_url,
                    categories: p.categories || [],
                    objectID: p.objectID || `pinned-${p.name}`,
                    description: '',
                    creator: '',
                    app_version: '1.0.0',
                    time_edited: 0,
                    generated: false,
                    invalid: false,
                    priority: 0,
                    actions: 0,
                    tags: [],
                    accessible_by: [],
                    action_labels: [],
                    triggers: [],
                    verified: true,
                  }))}
                  customStyles={singulStyles}
                />
              </motion.div>
            </AnimatePresence>
          </Box>
        </Box>
      </Drawer>

      {/* App detail drawer — opens when an app is selected from search */}
      <AppDetailDrawer
        open={open && detailAppName !== null}
        onClose={() => {
          const name = detailAppName;
          setDetailAppName(null);
          setDetailAppId(null);
          if (name) onDetailClose?.(name);
        }}
        appName={detailAppName}
        appId={detailAppId}
        anchor={anchor}
        width={width}
        onRefresh={onClose}
        onAddToCanvas={onAddToCanvas}
      />
    </>
  );
}
