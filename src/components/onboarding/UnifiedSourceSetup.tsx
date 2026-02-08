import { useState, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  IconButton,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Mail,
  Radar,
  Search,
  Ticket,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import { SingulJS } from '@/lib/singul-local';
import type { AlgoliaSearchApp, SingulJSHandle } from '@/lib/singul-local';
import { API_CONFIG } from '@/config/api';
import { AppAuthCard, type AppAuthState, type ApiAuthEntry } from '@/components/onboarding/AppAuthConfig';
import { getIngestionCategory, type IngestionCategory } from '@/lib/ingestionDetection';

// Category definitions
const CATEGORIES: {
  id: IngestionCategory;
  label: string;
  description: string;
  searchTerm: string;
  icon: typeof Mail;
}[] = [
  { id: 'email', label: 'Email', description: 'Inboxes & mail servers', searchTerm: 'email', icon: Mail },
  { id: 'siem', label: 'SIEM', description: 'Log aggregation & analytics', searchTerm: 'siem', icon: Radar },
  { id: 'edr', label: 'EDR', description: 'Endpoint detection & response', searchTerm: 'edr', icon: Search },
  { id: 'cases', label: 'Cases', description: 'Ticketing & case management', searchTerm: 'cases', icon: Ticket },
];

// Shared Singul custom styles
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

interface CategorySectionProps {
  category: typeof CATEGORIES[number];
  selectedApps: AlgoliaSearchApp[];
  onAppsChange: (apps: AlgoliaSearchApp[]) => void;
  allSelectedApps: AlgoliaSearchApp[];
  authStates: Record<string, AppAuthState>;
  authenticatedApps: ApiAuthEntry[];
  onAuthChange: (appId: string, credentials: Record<string, string>) => void;
  onTestConnection: (appId: string, authenticationId?: string) => void;
  onSaveAuth: (appId: string, credentials: Record<string, string>) => Promise<boolean>;
  isOpen: boolean;
  onToggleOpen: () => void;
}

const CategorySection = ({
  category,
  selectedApps,
  onAppsChange,
  allSelectedApps,
  authStates,
  authenticatedApps,
  onAuthChange,
  onTestConnection,
  onSaveAuth,
  isOpen,
  onToggleOpen,
}: CategorySectionProps) => {
  const singulRef = useRef<SingulJSHandle>(null);
  const [expandedAuth, setExpandedAuth] = useState<string | false>(false);
  const [singulKey, setSingulKey] = useState(0);

  // Filter authenticated apps relevant to this category's selected apps
  const getApiAuthEntries = (app: AlgoliaSearchApp): ApiAuthEntry[] => {
    return authenticatedApps.filter(
      auth => auth.app?.name?.toLowerCase() === app.name.toLowerCase()
    );
  };

  // Count validated apps in this category
  const validatedCount = selectedApps.filter(app => {
    const entries = getApiAuthEntries(app);
    return entries.some(e => e.validation?.valid === true);
  }).length;

  const Icon = category.icon;

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: selectedApps.length > 0
          ? validatedCount === selectedApps.length && selectedApps.length > 0
            ? 'rgba(34, 197, 94, 0.3)'
            : 'rgba(255, 102, 0, 0.3)'
          : 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        overflow: 'hidden',
        transition: 'border-color 0.3s ease',
      }}
    >
      {/* Category Header - always visible */}
      <Box
        onClick={() => {
          if (isOpen) {
            // When closing, bump key so SingulJS remounts with default search on reopen
            setSingulKey(k => k + 1);
          }
          onToggleOpen();
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2.5,
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          },
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: isOpen ? 'rgba(255, 102, 0, 0.15)' : 'rgba(255, 255, 255, 0.06)',
            border: '2px solid',
            borderColor: isOpen ? 'rgba(255, 102, 0, 0.4)' : 'rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.3s ease',
          }}
        >
          <Icon size={20} color={isOpen ? '#FF6600' : 'rgba(255, 255, 255, 0.5)'} />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{ color: 'white', fontWeight: 600, lineHeight: 1.3 }}
          >
            {category.label}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block' }}
          >
            {category.description}
          </Typography>
        </Box>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          {selectedApps.length > 0 && (
            <Chip
              icon={validatedCount === selectedApps.length ? <CheckCircle2 size={14} /> : undefined}
              label={`${validatedCount}/${selectedApps.length}`}
              size="small"
              sx={{
                height: 26,
                backgroundColor: validatedCount === selectedApps.length
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(255, 152, 0, 0.15)',
                color: validatedCount === selectedApps.length ? '#22c55e' : '#ff9800',
                fontWeight: 600,
                fontSize: '0.75rem',
                '& .MuiChip-icon': {
                  color: '#22c55e',
                },
              }}
            />
          )}

          {/* Selected app avatars (collapsed preview) */}
          {!isOpen && selectedApps.length > 0 && (
            <Box sx={{ display: 'flex', ml: 0.5 }}>
              {selectedApps.slice(0, 4).map((app, idx) => (
                <Box
                  key={app.objectID}
                  component="img"
                  src={app.image_url}
                  alt={app.name}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    objectFit: 'contain',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '2px solid rgba(33, 33, 33, 0.9)',
                    ml: idx > 0 ? -1 : 0,
                    p: 0.25,
                  }}
                />
              ))}
              {selectedApps.length > 4 && (
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: '2px solid rgba(33, 33, 33, 0.9)',
                    ml: -1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)' }}>
                    +{selectedApps.length - 4}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={20} color="rgba(255, 255, 255, 0.4)" />
          </motion.div>
        </Box>
      </Box>

      {/* Expandable Content */}
      <Collapse in={isOpen}>
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          {/* Search */}
          <SingulJS
            key={singulKey}
            ref={singulRef}
            authToken="demo-token"
            apiKey={API_CONFIG.apiKey || undefined}
            apiBaseUrl={API_CONFIG.baseUrl}
            placeholder={`Search ${category.label.toLowerCase()} integrations...`}
            layout="grid"
            gridColumns={3}
            inline={true}
            initialQuery={category.searchTerm}
            hitsPerPage={6}
            showDescription={true}
            showCategories={true}
            showCheckbox={true}
            multiSelect={true}
            preventDefault={true}
            selectedApps={allSelectedApps}
            onSelectionChange={onAppsChange}
            customStyles={singulStyles}
          />

          {/* Auth cards for selected apps in this category */}
          {selectedApps.length > 0 && (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontWeight: 500,
                  fontSize: '0.8rem',
                }}
              >
                Authentication ({selectedApps.length})
              </Typography>
              {selectedApps.map(app => {
                const authState = authStates[app.objectID] || {
                  systemId: app.objectID,
                  status: 'pending' as const,
                  credentials: {},
                };
                const apiAuthEntries = getApiAuthEntries(app);

                return (
                  <AppAuthCard
                    key={app.objectID}
                    app={app}
                    authState={authState}
                    isExpanded={expandedAuth === app.objectID}
                    onToggle={() => setExpandedAuth(expandedAuth === app.objectID ? false : app.objectID)}
                    onAuthChange={onAuthChange}
                    onTestConnection={onTestConnection}
                    onSaveAuth={onSaveAuth}
                    apiAuthEntries={apiAuthEntries}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

interface UnifiedSourceSetupProps {
  selectedApps: AlgoliaSearchApp[];
  onAppsChange: (apps: AlgoliaSearchApp[]) => void;
  authStates: Record<string, AppAuthState>;
  authenticatedApps: ApiAuthEntry[];
  onAuthChange: (appId: string, credentials: Record<string, string>) => void;
  onTestConnection: (appId: string, authenticationId?: string) => void;
  onSaveAuth: (appId: string, credentials: Record<string, string>) => Promise<boolean>;
}

export const UnifiedSourceSetup = ({
  selectedApps,
  onAppsChange,
  authStates,
  authenticatedApps,
  onAuthChange,
  onTestConnection,
  onSaveAuth,
}: UnifiedSourceSetupProps) => {
  // Track which categories are open (all open by default)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    email: true,
    siem: true,
    edr: true,
    cases: true,
  });

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Categorize selected apps
  const categorizedApps = useMemo(() => {
    const result: Record<IngestionCategory, AlgoliaSearchApp[]> = {
      email: [],
      siem: [],
      edr: [],
      cases: [],
    };

    selectedApps.forEach(app => {
      const category = getIngestionCategory(app.name, app.categories);
      if (category) {
        result[category].push(app);
      }
    });

    return result;
  }, [selectedApps]);

  // Overall progress
  const totalSelected = selectedApps.length;
  const totalValidated = selectedApps.filter(app => {
    return authenticatedApps.some(
      auth => auth.app?.name?.toLowerCase() === app.name.toLowerCase() &&
        auth.validation?.valid === true
    );
  }).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          sx={{ color: 'white', fontWeight: 700, mb: 1 }}
        >
          Connect & Configure Sources
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 2 }}
        >
          Search for integrations in each category, then configure authentication — all in one place.
        </Typography>
        {totalSelected > 0 && (
          <Chip
            label={`${totalValidated}/${totalSelected} authenticated`}
            size="small"
            sx={{
              background: totalValidated === totalSelected
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(255, 152, 0, 0.15)',
              color: totalValidated === totalSelected ? '#22c55e' : '#ff9800',
              fontWeight: 600,
            }}
          />
        )}
      </Box>

      {/* Category Sections */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {CATEGORIES.map(category => (
          <CategorySection
            key={category.id}
            category={category}
            selectedApps={categorizedApps[category.id]}
            allSelectedApps={selectedApps}
            onAppsChange={onAppsChange}
            authStates={authStates}
            authenticatedApps={authenticatedApps}
            onAuthChange={onAuthChange}
            onTestConnection={onTestConnection}
            onSaveAuth={onSaveAuth}
            isOpen={openCategories[category.id] ?? false}
            onToggleOpen={() => toggleCategory(category.id)}
          />
        ))}
      </Box>
    </Box>
  );
};
