import { useState, useEffect } from 'react';
import { Box, Container, Typography, Button, Chip, Stack } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
import { API_CONFIG } from '@/config/api';

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
  { label: 'Select Tools', icon: <IntegrationInstructionsIcon /> },
  { label: 'Authentication', icon: <VpnKeyIcon /> },
  { label: 'Automate', icon: <AutoFixHighIcon /> },
  { label: 'Complete', icon: <RocketLaunchIcon /> },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedApps, setSelectedApps] = useState<AlgoliaSearchApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('email');
  const [authStates, setAuthStates] = useState<Record<string, AppAuthState>>({});
  const [authenticatedApps, setAuthenticatedApps] = useState<ApiAuthEntry[]>([]);
  const [enrichmentState, setEnrichmentState] = useState<EnrichmentState>({
    threat_list: { enabled: true, config: {} },
    ai_triage: { enabled: true, config: {} },
    email_notify: { enabled: true, config: {} },
    slack_notify: { enabled: true, config: {} },
    auto_assign: { enabled: true, config: {} },
  });

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
      setActiveStep((prev) => prev + 1);
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

  const handleTestConnection = async (systemId: string) => {
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
      // Call Singul API to test the connection
      const response = await fetch(`${API_CONFIG.singulBaseUrl}/api/test_api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app: app.name.toLowerCase(),
        }),
      });

      const result = await response.json();
      
      // Check if the response indicates success
      const success = response.ok && result.success !== false;
      
      setAuthStates((prev) => ({
        ...prev,
        [systemId]: {
          ...prev[systemId],
          status: success ? 'connected' : 'error',
          errorMessage: success ? undefined : (result.reason || result.error || 'Failed to connect. Please check your credentials.'),
        },
      }));

      // Refresh authenticated apps list to update validation status
      if (success) {
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
        <Container maxWidth="lg">
          {/* Step Indicator */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Stack direction="row" spacing={2}>
              {steps.map((step, index) => (
                <Box
                  key={step.label}
                  onClick={() => setActiveStep(index)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: 'pointer',
                    '&:hover': {
                      '& .step-label': {
                        color: index === activeStep ? 'white' : 'rgba(255, 255, 255, 0.7)',
                      },
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
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
                    }}
                  >
                    {index < activeStep ? <CheckCircleOutlineIcon sx={{ fontSize: 18 }} /> : step.icon}
                  </Box>
                  <Typography
                    className="step-label"
                    variant="body2"
                    sx={{
                      color: index === activeStep ? 'white' : 'rgba(255, 255, 255, 0.4)',
                      fontWeight: index === activeStep ? 600 : 400,
                      display: { xs: 'none', sm: 'block' },
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {step.label}
                  </Typography>
                  {index < steps.length - 1 && (
                    <Box
                      sx={{
                        width: 40,
                        height: 2,
                        background:
                          index < activeStep
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 1,
                        display: { xs: 'none', md: 'block' },
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
      <Box sx={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1, pt: 18, pb: 10 }}>
        <Container maxWidth="lg" sx={{ py: 4 }}>
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
                p: { xs: 3, md: 5 },
                minHeight: 400,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
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
                    />
                  )}

                  {activeStep === 3 && (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      >
                        <Box
                          sx={{
                            width: 100,
                            height: 100,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 4,
                            boxShadow: '0 0 40px rgba(34, 197, 94, 0.4)',
                          }}
                        >
                          <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'white' }} />
                        </Box>
                      </motion.div>
                      <Typography
                        variant="h4"
                        sx={{ color: 'white', fontWeight: 700, mb: 2 }}
                      >
                        You're All Set!
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4, maxWidth: 400, mx: 'auto' }}
                      >
                        {connectedCount} integration{connectedCount !== 1 ? 's' : ''} connected.
                        You can manage your integrations anytime from the sidebar.
                      </Typography>
                      <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                        {selectedApps
                          .filter((app) => authStates[app.objectID]?.status === 'connected')
                          .map((app) => (
                            <Chip
                              key={app.objectID}
                              label={app.name.replace(/_/g, ' ')}
                              avatar={
                                app.image_url ? (
                                  <Box
                                    component="img"
                                    src={app.image_url}
                                    alt={app.name}
                                    sx={{ width: 24, height: 24, borderRadius: '50%' }}
                                  />
                                ) : undefined
                              }
                              sx={{
                                background: 'rgba(34, 197, 94, 0.1)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                color: '#22c55e',
                                fontWeight: 500,
                              }}
                            />
                          ))}
                      </Stack>
                    </Box>
                  )}
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
            <Button
              onClick={handleBack}
              disabled={activeStep === 0}
              startIcon={<ArrowBackIcon />}
              sx={{
                color: 'rgba(255, 255, 255, 0.5)',
                '&:hover': { color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.2)' },
              }}
            >
              Back
            </Button>
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
