import { useState, useEffect } from 'react';
import { Box, Container, Typography, Button, Chip, Stack, Tooltip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { TicketingSystemSearch } from '@/components/onboarding/TicketingSystemSearch';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
import { AppAuthConfig, AppAuthState, AuthStatus } from '@/components/onboarding/AppAuthConfig';
import { EnrichmentConfig, EnrichmentState } from '@/components/onboarding/EnrichmentConfig';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { API_CONFIG, getApiUrl } from '@/config/api';
import { setDatastoreItem, getDatastoreItem } from '@/services/datastore';
import { deduplicateAuthApps } from '@/lib/utils';

// Datastore category for onboarding config
const ONBOARDING_CONFIG_CATEGORY = 'singul-onboarding-config';
const SELECTED_TOOLS_KEY = 'selected_tools';
const AUTOMATION_CONFIG_KEY = 'automation_config';

// Type for authenticated apps from API
interface ApiAuthEntry {
  app: {
    id: string;
    name: string;
    large_image?: string;
  };
  active?: boolean;
  validation?: {
    valid: boolean;
    error?: string;
  };
}

const steps = [
  { label: 'Select Tools', icon: <IntegrationInstructionsIcon />, path: '/onboarding/tools' },
  { label: 'Authentication', icon: <VpnKeyIcon />, path: '/onboarding/authenticate' },
  { label: 'Automate', icon: <AutoFixHighIcon />, path: '/onboarding/automate' },
  { label: 'Complete', icon: <RocketLaunchIcon />, path: '/onboarding/complete' },
];

// Map paths to step indices
const pathToStep: Record<string, number> = {
  '/onboarding': 0,
  '/onboarding/tools': 0,
  '/onboarding/authenticate': 1,
  '/onboarding/automate': 2,
  '/onboarding/complete': 3,
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Derive initial step from URL
  const getStepFromPath = () => pathToStep[location.pathname] ?? 0;
  
  const [activeStep, setActiveStep] = useState(getStepFromPath);
  const [selectedApps, setSelectedApps] = useState<AlgoliaSearchApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('email');
  const [authStates, setAuthStates] = useState<Record<string, AppAuthState>>({});
  const [authenticatedApps, setAuthenticatedApps] = useState<ApiAuthEntry[]>([]);
  const [enrichmentState, setEnrichmentState] = useState<EnrichmentState>({
    automatic_ingestion: { enabled: true, config: {} },
    integration_search: { enabled: true, config: {} },
    threat_list: { enabled: true, config: {} },
    email_notify: { enabled: true, config: {} },
    chat_notify: { enabled: true, config: {} },
  });

  // Sync URL when step changes
  useEffect(() => {
    const targetPath = steps[activeStep].path;
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [activeStep, location.pathname, navigate]);

  // Sync step when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const stepFromPath = getStepFromPath();
    if (stepFromPath !== activeStep) {
      setActiveStep(stepFromPath);
    }
  }, [location.pathname]);
  
  // Load saved config from datastore on mount
  useEffect(() => {
    const loadSavedConfig = async () => {
      if (!API_CONFIG.apiKey) return;
      
      try {
        // Load selected tools
        const toolsResponse = await getDatastoreItem(SELECTED_TOOLS_KEY, ONBOARDING_CONFIG_CATEGORY);
        if (toolsResponse.success && toolsResponse.item?.value) {
          const savedTools = typeof toolsResponse.item.value === 'string' 
            ? JSON.parse(toolsResponse.item.value) 
            : toolsResponse.item.value;
          if (Array.isArray(savedTools) && savedTools.length > 0) {
            setSelectedApps(savedTools);
          }
        }
        
        // Load automation config
        const automationResponse = await getDatastoreItem(AUTOMATION_CONFIG_KEY, ONBOARDING_CONFIG_CATEGORY);
        if (automationResponse.success && automationResponse.item?.value) {
          const savedConfig = typeof automationResponse.item.value === 'string'
            ? JSON.parse(automationResponse.item.value)
            : automationResponse.item.value;
          if (savedConfig && typeof savedConfig === 'object') {
            setEnrichmentState(prev => ({ ...prev, ...savedConfig }));
          }
        }
      } catch (error) {
        console.error('Failed to load saved config:', error);
      }
    };
    
    loadSavedConfig();
  }, []);

  // Fetch authenticated apps from API
  useEffect(() => {
    const fetchAuthenticatedApps = async () => {
      if (!API_CONFIG.apiKey) return;
      
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/api/v1/apps/authentication`, {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          },
        });
        if (response.ok) {
          const result = await response.json();
          const authData = result.data || result;
          if (Array.isArray(authData)) {
            setAuthenticatedApps(authData);
          }
        }
      } catch (error) {
        console.error('Failed to fetch authenticated apps:', error);
      }
    };
    
    fetchAuthenticatedApps();
  }, []);

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      const connectedApps = selectedApps.filter(
        (app) => authStates[app.objectID]?.status === 'connected'
      );
      localStorage.setItem('connected_integrations', JSON.stringify(connectedApps));
      navigate('/incidents');
    } else {
      // Navigate immediately (optimistic)
      setActiveStep((prev) => prev + 1);
      
      // When moving from step 0 (Select Tools) to step 1 (Authentication)
      // Run API calls in background
      if (activeStep === 0 && selectedApps.length > 0) {
        // Save selected tools to datastore (fire and forget)
        setDatastoreItem(SELECTED_TOOLS_KEY, selectedApps, ONBOARDING_CONFIG_CATEGORY)
          .catch(error => console.error('Failed to save tools:', error));
        
        // Generate workflow for ingest (fire and forget)
        const appNames = selectedApps.map(app => app.name).join(',');
        fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            label: 'Ingest Tickets',
            app_name: appNames,
            category: 'cases',
          }),
        }).catch(error => console.error('Failed to generate workflow:', error));
      }
      
      // When moving from step 2 (Automate) to step 3 (Complete)
      // Save the automation configuration
      if (activeStep === 2) {
        setDatastoreItem(AUTOMATION_CONFIG_KEY, enrichmentState, ONBOARDING_CONFIG_CATEGORY)
          .then(() => console.log('Automation config saved'))
          .catch(error => console.error('Failed to save automation config:', error));
      }
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleAuthChange = (systemId: string, credentials: Record<string, string>) => {
    setAuthStates((prev) => ({
      ...prev,
      [systemId]: {
        systemId,
        status: 'pending' as AuthStatus,
        credentials,
      },
    }));
  };

  const handleTestConnection = async (systemId: string, authenticationId?: string) => {
    // Find the app info
    const app = selectedApps.find(a => a.objectID === systemId);
    if (!app) return;

    setAuthStates((prev) => ({
      ...prev,
      [systemId]: {
        ...prev[systemId],
        status: 'testing' as AuthStatus,
      },
    }));

    try {
      // Build request body with optional authentication_id
      const requestBody: Record<string, string> = {
        action: 'test_api',
        app: app.name.toLowerCase(),
      };
      
      if (authenticationId) {
        requestBody.authentication_id = authenticationId;
      }

      // Call API to test the connection
      const response = await fetch(getApiUrl('/api/v1/apps/categories/run'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      
      // Validate all three conditions for success:
      // 1. action === "done"
      // 2. success === true
      // 3. result contains valid status (parsed from JSON string)
      let isValid = false;
      let errorMessage = 'Failed to connect. Please check your credentials.';
      let successMessage = '';
      let parsedStatus = '';
      
      if (response.ok && result.action === 'done' && result.success === true) {
        try {
          // Parse the result field which is a JSON string
          const resultData = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
          // Check if status exists in the parsed result
          if (resultData && resultData.status) {
            parsedStatus = resultData.status;
            // Consider success if status indicates OK (common patterns: 200, ok, success, healthy, etc.)
            const statusLower = String(parsedStatus).toLowerCase();
            const isGoodStatus = statusLower === 'ok' || 
                                 statusLower === 'success' || 
                                 statusLower === 'healthy' ||
                                 statusLower === 'connected' ||
                                 statusLower === '200' ||
                                 Number(parsedStatus) === 200;
            
            if (isGoodStatus) {
              isValid = true;
              successMessage = `Connection verified • Status: ${parsedStatus}`;
            } else {
              // Include reason from parsed result if available
              const reason = resultData.reason ? ` • ${resultData.reason}` : '';
              errorMessage = `Connection failed • Status: ${parsedStatus}${reason}`;
            }
          } else {
            errorMessage = 'Invalid response: missing status in result';
          }
        } catch (parseError) {
          console.error('Failed to parse result:', parseError);
          errorMessage = 'Invalid response format from server';
        }
      } else {
        // Build error message from response
        if (result.action !== 'done') {
          errorMessage = `Unexpected action: ${result.action || 'unknown'}`;
        } else if (result.success !== true) {
          // Try to parse the result field for detailed error info
          let parsedReason = '';
          try {
            if (result.result) {
              const resultData = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
              if (resultData.reason) {
                parsedReason = resultData.reason;
              } else if (resultData.status) {
                parsedReason = `Status: ${resultData.status}`;
              }
            }
          } catch (e) {
            // If parsing fails, use result as-is if it's a string
            if (typeof result.result === 'string') {
              parsedReason = result.result;
            }
          }
          errorMessage = parsedReason || result.reason || result.error || 'Connection test failed';
        }
      }
      
      setAuthStates((prev) => ({
        ...prev,
        [systemId]: {
          ...prev[systemId],
          status: isValid ? 'connected' : 'error',
          errorMessage: isValid ? undefined : errorMessage,
          successMessage: isValid ? successMessage : undefined,
        },
      }));

      // Refresh authenticated apps list to update validation status
      if (isValid) {
        const authResponse = await fetch(`${API_CONFIG.baseUrl}/api/v1/apps/authentication`, {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          },
        });
        if (authResponse.ok) {
          const authData = await authResponse.json();
          if (authData.data) {
            setAuthenticatedApps(authData.data);
          }
        }
      }
    } catch (error) {
      console.error('Test connection failed:', error);
      setAuthStates((prev) => ({
        ...prev,
        [systemId]: {
          ...prev[systemId],
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Connection test failed. Please try again.',
        },
      }));
    }
  };

  const handleSaveAuth = async (appId: string, credentials: Record<string, string>): Promise<boolean> => {
    // Find the app info
    const app = selectedApps.find(a => a.objectID === appId);
    if (!app) return false;

    // Build fields array from credentials, filtering out empty keys
    const fields = Object.entries(credentials)
      .filter(([key, value]) => key && key.trim() !== '' && value && value.trim() !== '')
      .map(([key, value]) => ({
        key,
        value,
      }));

    const payload = {
      label: `Auth for ${app.name.replace(/_/g, ' ')}`,
      app: {
        name: app.name,
        id: app.objectID,
        app_version: '1.0.0',
      },
      fields,
      active: true,
    };

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/v1/apps/authentication`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Refresh authenticated apps list
        const authResponse = await fetch(`${API_CONFIG.baseUrl}/api/v1/apps/authentication`, {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          },
        });
        if (authResponse.ok) {
          const authData = await authResponse.json();
          if (authData.data) {
            setAuthenticatedApps(authData.data);
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save authentication:', error);
      return false;
    }
  };

  const canProceed = () => {
    if (activeStep === 0) return selectedApps.length > 0;
    if (activeStep === 1) {
      return selectedApps.some((app) => authStates[app.objectID]?.status === 'connected');
    }
    return true;
  };

  const connectedCount = selectedApps.filter(
    (app) => authStates[app.objectID]?.status === 'connected'
  ).length;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        backgroundColor: 'hsl(0 0% 10%)',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Background effects - matching landing page */}
      <Box
        sx={{
          position: 'fixed',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150%',
          height: '80%',
          background: 'radial-gradient(ellipse at center, rgba(255, 102, 0, 0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(255, 102, 0, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 102, 0, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Fixed Header with Step Indicator */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: 'hsla(0, 0%, 10%, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          py: 3,
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          {/* Step Indicator */}
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', overflow: 'hidden' }}>
            <Stack 
              direction="row" 
              spacing={{ xs: 1, sm: 2 }}
              sx={{ 
                flexWrap: 'nowrap',
                justifyContent: 'center',
                maxWidth: '100%',
              }}
            >
              {steps.map((step, index) => (
                <Box
                  key={step.label}
                  onClick={() => setActiveStep(index)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1.5 },
                    cursor: 'pointer',
                    flexShrink: 0,
                    '&:hover': {
                      '& .step-label': {
                        color: index === activeStep ? 'white' : 'rgba(255, 255, 255, 0.7)',
                      },
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: { xs: 32, sm: 40 },
                      height: { xs: 32, sm: 40 },
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        index < activeStep
                          ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                          : index === activeStep
                          ? 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)'
                          : 'rgba(255, 255, 255, 0.05)',
                      border: '2px solid',
                      borderColor:
                        index <= activeStep ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.3s ease',
                      color: index <= activeStep ? 'white' : 'rgba(255, 255, 255, 0.4)',
                      boxShadow: index === activeStep ? '0 0 20px rgba(255, 102, 0, 0.4)' : 'none',
                      flexShrink: 0,
                    }}
                  >
                    {index < activeStep ? <CheckCircleOutlineIcon sx={{ fontSize: { xs: 14, sm: 18 } }} /> : step.icon}
                  </Box>
                  <Typography
                    className="step-label"
                    variant="body2"
                    sx={{
                      color: index === activeStep ? 'white' : 'rgba(255, 255, 255, 0.4)',
                      fontWeight: index === activeStep ? 600 : 400,
                      display: { xs: 'none', md: 'block' },
                      transition: 'color 0.2s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.label}
                  </Typography>
                  {index < steps.length - 1 && (
                    <Box
                      sx={{
                        width: { xs: 16, sm: 40 },
                        height: 2,
                        background:
                          index < activeStep
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 1,
                        display: { xs: 'block', md: 'block' },
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Scrollable Content Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 1, pt: { xs: 12, sm: 14 }, pb: 10, width: '100%' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 1, sm: 2 }, px: { xs: 2, sm: 3 }, width: '100%', maxWidth: '100%' }}>
          {/* Content Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Box
              sx={{
                background: 'rgba(33, 33, 33, 0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                p: { xs: 2, sm: 3, md: 4 },
                minHeight: 400,
                width: '100%',
                maxWidth: '100%',
                overflow: 'hidden',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
                >
                  {activeStep === 0 && (
                    <TicketingSystemSearch
                      selectedApps={selectedApps}
                      onAppsChange={setSelectedApps}
                      searchQuery={searchQuery}
                      onSearchQueryChange={setSearchQuery}
                    />
                  )}

                  {activeStep === 1 && (
                    <AppAuthConfig
                      apps={selectedApps}
                      authStates={authStates}
                      authenticatedApps={authenticatedApps}
                      onAuthChange={handleAuthChange}
                      onTestConnection={handleTestConnection}
                      onSaveAuth={handleSaveAuth}
                    />
                  )}

                  {activeStep === 2 && (
                    <EnrichmentConfig
                      enrichmentState={enrichmentState}
                      onEnrichmentChange={setEnrichmentState}
                      onSave={(state) => {
                        setDatastoreItem(AUTOMATION_CONFIG_KEY, state, ONBOARDING_CONFIG_CATEGORY)
                          .catch(error => console.error('Failed to save automation config:', error));
                      }}
                      authenticatedApps={authenticatedApps}
                      selectedApps={selectedApps}
                    />
                  )}

                  {activeStep === 3 && (() => {
                    // Deduplicate apps using the shared utility
                    const dedupedApps = deduplicateAuthApps(authenticatedApps);
                    const validCount = dedupedApps.filter(a => a.hasValidAuth).length;
                    // Sort: valid first, then alphabetically
                    const sortedApps = [...dedupedApps].sort((a, b) => {
                      if (a.hasValidAuth && !b.hasValidAuth) return -1;
                      if (!a.hasValidAuth && b.hasValidAuth) return 1;
                      return a.app.name.localeCompare(b.app.name);
                    });

                    const automationItems = [
                      { key: 'automatic_ingestion', label: 'Ingestion', icon: '📥' },
                      { key: 'threat_intel', label: 'Threat Intel', icon: '🛡️' },
                      { key: 'email_notify', label: 'Email', icon: '📧' },
                      { key: 'chat_notify', label: 'Chat', icon: '💬' },
                    ];

                    return (
                      <Box sx={{ py: 4 }}>
                        {/* Success Header */}
                        <Box sx={{ textAlign: 'center', mb: 5 }}>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                          >
                            <Box
                              sx={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 3,
                                boxShadow: '0 0 40px rgba(34, 197, 94, 0.4)',
                              }}
                            >
                              <CheckCircleOutlineIcon sx={{ fontSize: 44, color: 'white' }} />
                            </Box>
                          </motion.div>
                          <Typography
                            variant="h4"
                            sx={{ color: 'white', fontWeight: 700, mb: 1, fontSize: { xs: '1.5rem', sm: '2rem' } }}
                          >
                            You're All Set!
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{ color: 'rgba(255, 255, 255, 0.6)', maxWidth: 400, mx: 'auto' }}
                          >
                            Your security automation is configured and ready to go.
                          </Typography>
                        </Box>

                        {/* Two Column Layout */}
                        <Box sx={{ 
                          display: 'grid', 
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                          gap: 3,
                        }}>
                          {/* Connected Apps Section */}
                          <Box
                            sx={{
                              background: 'rgba(0, 0, 0, 0.2)',
                              borderRadius: 3,
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              p: 3,
                            }}
                          >
                            <Typography
                              sx={{ color: 'white', fontWeight: 600, mb: 2, fontSize: '1rem' }}
                            >
                              Connected Apps ({validCount}/{sortedApps.length})
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                              {sortedApps.length > 0 ? (
                                sortedApps.map((dedupedApp) => (
                                  <Tooltip 
                                    key={dedupedApp.app.id} 
                                    title={
                                      <Box sx={{ textAlign: 'left', p: 0.5, minWidth: 140 }}>
                                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                          {dedupedApp.app.name.replace(/_/g, ' ')}
                                        </Typography>
                                        <Box sx={{ mt: 0.5 }}>
                                          {dedupedApp.instances.map((inst, idx) => (
                                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                                              <Box sx={{ 
                                                width: 6, height: 6, borderRadius: '50%',
                                                backgroundColor: inst.isValidated ? '#22c55e' : '#f59e0b',
                                              }} />
                                              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>
                                                {inst.label}
                                              </Typography>
                                            </Box>
                                          ))}
                                        </Box>
                                      </Box>
                                    }
                                    placement="top"
                                  >
                                    <Box
                                      sx={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {dedupedApp.bestImage ? (
                                        <Box
                                          component="img"
                                          src={dedupedApp.bestImage}
                                          alt={dedupedApp.app.name}
                                          sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            objectFit: 'contain',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            p: 0.5,
                                          }}
                                        />
                                      ) : (
                                        <Box
                                          sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.875rem',
                                            color: 'white',
                                            fontWeight: 600,
                                          }}
                                        >
                                          {dedupedApp.app.name.charAt(0).toUpperCase()}
                                        </Box>
                                      )}
                                      <Box
                                        sx={{
                                          position: 'absolute',
                                          bottom: -2,
                                          right: -2,
                                          width: 12,
                                          height: 12,
                                          borderRadius: '50%',
                                          backgroundColor: dedupedApp.hasValidAuth ? '#22c55e' : '#f59e0b',
                                          border: '2px solid rgba(33, 33, 33, 0.9)',
                                        }}
                                      />
                                    </Box>
                                  </Tooltip>
                                ))
                              ) : (
                                <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.875rem' }}>
                                  No apps connected yet
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          {/* Automation Status Section - Mini visualization */}
                          <Box
                            sx={{
                              background: 'rgba(0, 0, 0, 0.2)',
                              borderRadius: 3,
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              p: 3,
                            }}
                          >
                            <Typography
                              sx={{ color: 'white', fontWeight: 600, mb: 2, fontSize: '1rem' }}
                            >
                              Automation
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {automationItems.map(({ key, label, icon }) => {
                                const isEnabled = enrichmentState[key]?.enabled;
                                return (
                                  <Tooltip key={key} title={`${label}: ${isEnabled ? 'Enabled' : 'Disabled'}`} placement="top">
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        px: 1.5,
                                        py: 0.75,
                                        borderRadius: 2,
                                        backgroundColor: isEnabled 
                                          ? 'rgba(34, 197, 94, 0.15)' 
                                          : 'rgba(156, 163, 175, 0.1)',
                                        border: '1px solid',
                                        borderColor: isEnabled 
                                          ? 'rgba(34, 197, 94, 0.3)' 
                                          : 'rgba(156, 163, 175, 0.2)',
                                        opacity: isEnabled ? 1 : 0.5,
                                      }}
                                    >
                                      <Typography sx={{ fontSize: '1rem' }}>{icon}</Typography>
                                      <Typography
                                        sx={{
                                          color: isEnabled ? '#22c55e' : '#9ca3af',
                                          fontSize: '0.75rem',
                                          fontWeight: 500,
                                        }}
                                      >
                                        {label}
                                      </Typography>
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* Fixed Footer with Navigation */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: 'hsla(0, 0%, 10%, 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {activeStep > 0 ? (
              <Button
                onClick={handleBack}
                startIcon={<ArrowBackIcon />}
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  '&:hover': { color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                }}
              >
                Back
              </Button>
            ) : (
              <Box />
            )}
            <Stack direction="row" spacing={2}>
              {activeStep < steps.length - 1 && (
                <Button
                  onClick={() => navigate('/incidents')}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&:hover': { color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                  }}
                >
                  Skip for now
                </Button>
              )}
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!canProceed()}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                  boxShadow: '0 4px 14px rgba(255, 102, 0, 0.25)',
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #FF8533 0%, #FF9955 100%)',
                    boxShadow: '0 6px 20px rgba(255, 102, 0, 0.35)',
                  },
                  '&.Mui-disabled': {
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                {activeStep === steps.length - 1 ? 'Go to Dashboard' : 'Continue'}
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default OnboardingPage;
