/**
 * AddAppModal — Two-phase modal for the Infrastructure page category drawer.
 * Phase 1: SingulJS search (same style as /onboarding/sources)
 * Phase 2: AppAuthCard for the selected app (same as /onboarding/authenticate)
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SingulJS } from '@/lib/singul-local';
import type { AlgoliaSearchApp, AppSelectedEvent } from '@/lib/singul-local';
import { AppAuthCard } from '@/components/onboarding/AppAuthConfig';
import type { AppAuthState, ApiAuthEntry } from '@/components/onboarding/AppAuthConfig';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';

// Singul styles — matches /onboarding/sources
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

interface AddAppModalProps {
  open: boolean;
  onClose: () => void;
  /** Initial search query (e.g. category label like "SIEM") */
  initialQuery: string;
  /** Category label for display */
  categoryLabel: string;
}

type Phase = 'search' | 'auth';

export const AddAppModal = ({ open, onClose, initialQuery, categoryLabel }: AddAppModalProps) => {
  const [phase, setPhase] = useState<Phase>('search');
  const [selectedApp, setSelectedApp] = useState<AlgoliaSearchApp | null>(null);

  // Auth state for the selected app
  const [authState, setAuthState] = useState<AppAuthState>({
    systemId: '',
    status: 'pending',
    credentials: {},
  });
  const [authenticatedApps, setAuthenticatedApps] = useState<ApiAuthEntry[]>([]);
  const [authLoading, setAuthLoading] = useState(false);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPhase('search');
      setSelectedApp(null);
      setAuthState({ systemId: '', status: 'pending', credentials: {} });
    }
  }, [open]);

  // Fetch existing auth entries for the selected app
  const fetchAuthForApp = async (appName: string) => {
    if (!API_CONFIG.apiKey) return;
    setAuthLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/v1/apps/authentication'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (response.ok) {
        const result = await response.json();
        const authData = result.data || result;
        if (Array.isArray(authData)) {
          // Filter to only this app's auth entries
          const appEntries = authData.filter(
            (a: ApiAuthEntry) => a.app?.name?.toLowerCase() === appName.toLowerCase()
          );
          setAuthenticatedApps(appEntries);
        }
      }
    } catch (err) {
      console.error('Failed to fetch auth entries:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAppSelected = (detail: AppSelectedEvent) => {
    setSelectedApp(detail.app);
    setAuthState({ systemId: detail.app.objectID, status: 'pending', credentials: {} });
    fetchAuthForApp(detail.app.name);
    setPhase('auth');
  };

  const handleBack = () => {
    setPhase('search');
    setSelectedApp(null);
  };

  const handleAuthChange = (_appId: string, credentials: Record<string, string>) => {
    setAuthState(prev => ({ ...prev, credentials }));
  };

  const handleTestConnection = async (systemId: string, authenticationId?: string) => {
    if (!selectedApp) return;
    setAuthState(prev => ({ ...prev, status: 'testing' }));

    try {
      const requestBody: Record<string, string | boolean> = {
        action: 'test_api',
        app: selectedApp.name.toLowerCase(),
        skip_workflow: true,
      };
      if (authenticationId) requestBody.authentication_id = authenticationId;

      const response = await fetch(getApiUrl('/api/v1/apps/categories/run'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
          'Accept-Encoding': 'identity',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      const validActions = ['done', 'app_validation'];
      const isValid = response.ok && validActions.includes(result.action) && result.success === true;

      // Refresh auth list
      await fetchAuthForApp(selectedApp.name);

      setAuthState(prev => ({
        ...prev,
        status: isValid ? 'connected' : 'error',
        successMessage: isValid ? 'Connection verified' : undefined,
        errorMessage: isValid ? undefined : (result.reason || 'Connection failed. Please check your credentials.'),
      }));
    } catch (err) {
      setAuthState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Connection test failed.',
      }));
    }
  };

  const handleSaveAuth = async (appId: string, credentials: Record<string, string>): Promise<boolean> => {
    if (!selectedApp) return false;

    const fields = Object.entries(credentials)
      .filter(([key, value]) => key?.trim() && value?.trim())
      .map(([key, value]) => ({ key, value }));

    const payload = {
      label: `Auth for ${selectedApp.name.replace(/_/g, ' ')}`,
      app: {
        name: selectedApp.name,
        id: selectedApp.objectID,
        app_version: '1.0.0',
      },
      fields,
      active: true,
    };

    try {
      const response = await fetch(getApiUrl('/api/v1/apps/authentication'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok && result.success !== false) {
        await fetchAuthForApp(selectedApp.name);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden border-0"
        style={{
          background: 'linear-gradient(180deg, #1a1a1a 0%, #111111 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
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
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          {phase === 'auth' && (
            <IconButton
              size="small"
              onClick={handleBack}
              sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' } }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}

          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
              {phase === 'search'
                ? `Add ${categoryLabel} Integration`
                : selectedApp?.name.replace(/_/g, ' ')}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
              {phase === 'search'
                ? `Search and select a ${categoryLabel.toLowerCase()} tool to configure`
                : 'Configure authentication'}
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          <AnimatePresence mode="wait">
            {phase === 'search' ? (
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
                  placeholder={`Search ${categoryLabel.toLowerCase()} integrations...`}
                  layout="grid"
                  gridColumns={3}
                  inline={true}
                  initialQuery={initialQuery}
                  hitsPerPage={9}
                  showDescription={true}
                  showCategories={true}
                  showCheckbox={false}
                  multiSelect={false}
                  preventDefault={false}
                  onAppSelected={handleAppSelected}
                  customStyles={singulStyles}
                />
              </motion.div>
            ) : (
              <motion.div
                key="auth"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {authLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={28} sx={{ color: '#FF6600' }} />
                  </Box>
                ) : selectedApp ? (
                  <AppAuthCard
                    app={selectedApp}
                    authState={authState}
                    isExpanded={true}
                    onToggle={() => {}}
                    onAuthChange={handleAuthChange}
                    onTestConnection={handleTestConnection}
                    onSaveAuth={handleSaveAuth}
                    apiAuthEntries={authenticatedApps}
                  />
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
