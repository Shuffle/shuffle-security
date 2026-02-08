import { useState, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Collapse,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Mail,
  Radar,
  Search,
  Ticket,
  LayoutGrid,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import { SingulJS } from '@/lib/singul-local';
import type { AlgoliaSearchApp, SingulJSHandle } from '@/lib/singul-local';
import { API_CONFIG } from '@/config/api';
import { getIngestionCategory, type IngestionCategory } from '@/lib/ingestionDetection';

// Extended category type for the Sources page (includes 'other')
type SourceCategory = IngestionCategory | 'other';

// Category definitions
const CATEGORIES: {
  id: SourceCategory;
  label: string;
  description: string;
  searchTerm: string;
  icon: typeof Mail;
}[] = [
  { id: 'email', label: 'Email', description: 'Inboxes & mail servers', searchTerm: 'email', icon: Mail },
  { id: 'siem', label: 'SIEM', description: 'Log aggregation & analytics', searchTerm: 'siem', icon: Radar },
  { id: 'edr', label: 'EDR', description: 'Endpoint detection & response', searchTerm: 'edr', icon: Search },
  { id: 'cases', label: 'Cases', description: 'Ticketing & case management', searchTerm: 'cases', icon: Ticket },
  { id: 'other', label: 'Other', description: 'Any other tools & integrations', searchTerm: '', icon: LayoutGrid },
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

// ─── CategorySection ────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: typeof CATEGORIES[number];
  stepIndex: number;
  totalSteps: number;
  selectedApps: AlgoliaSearchApp[];
  onAppsChange: (apps: AlgoliaSearchApp[]) => void;
  allSelectedApps: AlgoliaSearchApp[];
  isOpen: boolean;
  onToggleOpen: () => void;
  sectionRef?: React.Ref<HTMLDivElement>;
}

const CategorySection = ({
  category,
  stepIndex,
  totalSteps,
  selectedApps,
  onAppsChange,
  allSelectedApps,
  isOpen,
  onToggleOpen,
  sectionRef,
}: CategorySectionProps) => {
  const singulRef = useRef<SingulJSHandle>(null);
  const [singulKey, setSingulKey] = useState(0);

  const Icon = category.icon;
  const hasSelections = selectedApps.length > 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <Box
      ref={sectionRef}
      sx={{ display: 'flex', gap: 0 }}
    >
      {/* ── Vertical stepper rail ── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 44,
          flexShrink: 0,
          pt: 0.25,
        }}
      >
        {/* Step circle */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            backgroundColor: isOpen
              ? 'rgba(255, 102, 0, 0.15)'
              : hasSelections
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(255, 255, 255, 0.06)',
            border: '2px solid',
            borderColor: isOpen
              ? 'rgba(255, 102, 0, 0.5)'
              : hasSelections
                ? 'rgba(34, 197, 94, 0.4)'
                : 'rgba(255, 255, 255, 0.12)',
            transition: 'all 0.3s ease',
            zIndex: 1,
          }}
        >
          {hasSelections && !isOpen ? (
            <CheckCircle2 size={18} color="#22c55e" />
          ) : (
            <Icon size={18} color={isOpen ? '#FF6600' : 'rgba(255, 255, 255, 0.45)'} />
          )}
        </Box>
        {/* Connector line */}
        {!isLast && (
          <Box
            sx={{
              width: 2,
              flex: 1,
              minHeight: 16,
              backgroundColor: hasSelections
                ? 'rgba(34, 197, 94, 0.3)'
                : 'rgba(255, 255, 255, 0.08)',
              transition: 'background-color 0.3s ease',
            }}
          />
        )}
      </Box>

      {/* ── Content area ── */}
      <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 2 }}>
        {/* Clickable header */}
        <Box
          onClick={() => {
            if (isOpen) setSingulKey(k => k + 1);
            onToggleOpen();
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 0.75,
            px: 1.5,
            ml: 1,
            cursor: 'pointer',
            borderRadius: 2,
            transition: 'background-color 0.2s ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
            },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                color: isOpen ? '#FF6600' : hasSelections ? '#22c55e' : 'white',
                fontWeight: 600,
                fontSize: '0.95rem',
                lineHeight: 1.3,
                transition: 'color 0.2s ease',
              }}
            >
              {category.label}
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.75rem',
                lineHeight: 1.3,
              }}
            >
              {category.description}
            </Typography>
          </Box>

          {/* Status chip + avatars */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            {hasSelections && (
              <Chip
                icon={<CheckCircle2 size={14} />}
                label={`${selectedApps.length} selected`}
                size="small"
                sx={{
                  height: 24,
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  '& .MuiChip-icon': { color: '#22c55e' },
                }}
              />
            )}

            {!isOpen && hasSelections && (
              <Box sx={{ display: 'flex' }}>
                {selectedApps.slice(0, 3).map((app, idx) => (
                  <Box
                    key={app.objectID}
                    component="img"
                    src={app.image_url}
                    alt={app.name}
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      objectFit: 'contain',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '2px solid rgba(33, 33, 33, 0.9)',
                      ml: idx > 0 ? -0.75 : 0,
                      p: 0.25,
                    }}
                  />
                ))}
                {selectedApps.length > 3 && (
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '2px solid rgba(33, 33, 33, 0.9)',
                      ml: -0.75,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.6)' }}>
                      +{selectedApps.length - 3}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={18} color="rgba(255, 255, 255, 0.35)" />
            </motion.div>
          </Box>
        </Box>

        {/* Expandable content */}
        <Collapse in={isOpen}>
          <Box
            sx={{
              ml: 1,
              mt: 1.5,
              p: 2.5,
              borderRadius: 3,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              transition: 'border-color 0.3s ease',
            }}
          >
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
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

// ─── UnifiedSourceSetup ─────────────────────────────────────────────────────

interface UnifiedSourceSetupProps {
  selectedApps: AlgoliaSearchApp[];
  onAppsChange: (apps: AlgoliaSearchApp[]) => void;
}

export const UnifiedSourceSetup = ({
  selectedApps,
  onAppsChange,
}: UnifiedSourceSetupProps) => {
  // Only one category open at a time (accordion)
  const [openCategory, setOpenCategory] = useState<string | null>('email');

  // Refs for scrolling to sections
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToSection = useCallback((id: string) => {
    setTimeout(() => {
      const el = sectionRefs.current[id];
      if (!el) return;
      const scrollParent = el.closest('main') || el.closest('[style*="overflow"]') || el.parentElement?.closest('div[class*="MuiBox"]');
      if (scrollParent) {
        const elTop = el.getBoundingClientRect().top - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop;
        scrollParent.scrollTo({ top: elTop - 80, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 200);
  }, []);

  const toggleCategory = (id: string) => {
    const willOpen = openCategory !== id;
    setOpenCategory(prev => (prev === id ? null : id));
    if (willOpen) scrollToSection(id);
  };

  // Categorize selected apps
  const categorizedApps = useMemo(() => {
    const result: Record<SourceCategory, AlgoliaSearchApp[]> = {
      email: [],
      siem: [],
      edr: [],
      cases: [],
      other: [],
    };

    selectedApps.forEach(app => {
      const category = getIngestionCategory(app.name, app.categories);
      if (category) {
        result[category].push(app);
      } else {
        result.other.push(app);
      }
    });

    return result;
  }, [selectedApps]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ color: 'white', fontWeight: 700, mb: 1 }}
        >
          Select Your Sources
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 0 }}
        >
          Choose the tools you use in each category. You'll configure credentials in the next step.
        </Typography>
      </Box>

      {/* Category Sections — vertical stepper */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {CATEGORIES.map((category, idx) => (
          <CategorySection
            key={category.id}
            category={category}
            stepIndex={idx}
            totalSteps={CATEGORIES.length}
            selectedApps={categorizedApps[category.id]}
            allSelectedApps={selectedApps}
            onAppsChange={onAppsChange}
            isOpen={openCategory === category.id}
            onToggleOpen={() => toggleCategory(category.id)}
            sectionRef={(el) => { sectionRefs.current[category.id] = el; }}
          />
        ))}
      </Box>
    </Box>
  );
};
