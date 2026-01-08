import { useState } from 'react';
import { Box, Container, Typography, Button, Chip, Stack } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TicketingSystemSearch } from '@/components/onboarding/TicketingSystemSearch';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
import { ToolAuthentication, ToolAuthState, AuthStatus } from '@/components/onboarding/ToolAuthentication';
import { EnrichmentConfig, EnrichmentState } from '@/components/onboarding/EnrichmentConfig';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

const steps = [
  { label: 'Select Tools', icon: <IntegrationInstructionsIcon /> },
  { label: 'Authentication', icon: <VpnKeyIcon /> },
  { label: 'Enrichment', icon: <AutoFixHighIcon /> },
  { label: 'Complete', icon: <RocketLaunchIcon /> },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedApps, setSelectedApps] = useState<AlgoliaSearchApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('email');
  const [authStates, setAuthStates] = useState<Record<string, ToolAuthState>>({});
  const [enrichmentState, setEnrichmentState] = useState<EnrichmentState>({
    threat_list: { enabled: true, config: {} },
    ai_triage: { enabled: true, config: {} },
    email_notify: { enabled: true, config: {} },
    slack_notify: { enabled: true, config: {} },
    auto_assign: { enabled: true, config: {} },
  });

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      const connectedApps = selectedApps.filter(
        (app) => authStates[app.objectID]?.status === 'connected'
      );
      localStorage.setItem('connected_integrations', JSON.stringify(connectedApps));
      navigate('/dashboard/alerts');
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

  const handleTestConnection = (systemId: string) => {
    setAuthStates((prev) => ({
      ...prev,
      [systemId]: {
        ...prev[systemId],
        status: 'testing' as AuthStatus,
      },
    }));

    setTimeout(() => {
      const success = Math.random() > 0.3;
      setAuthStates((prev) => ({
        ...prev,
        [systemId]: {
          ...prev[systemId],
          status: success ? 'connected' : 'error',
          errorMessage: success ? undefined : 'Failed to connect. Please check your credentials.',
        },
      }));
    }, 1500);
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
        pb: 8,
      }}
    >
      {/* Background effects - matching landing page */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150%',
          height: '80%',
          background: 'radial-gradient(ellipse at center, rgba(255, 102, 0, 0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
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
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', py: 6 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 3 }}>
              <svg width="48" height="48" viewBox="0 0 56 56" fill="none">
                <path
                  d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z"
                  fill="#FF6600"
                />
              </svg>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Shuffle Cases
              </Typography>
            </Box>
            <Chip
              label="⚡ Quick Setup • Connect your tools in minutes"
              sx={{
                py: 2.5,
                px: 1,
                fontSize: '0.9rem',
                background: 'rgba(255, 102, 0, 0.1)',
                border: '1px solid rgba(255, 102, 0, 0.3)',
                color: '#FF6600',
              }}
            />
          </Box>
        </motion.div>

        {/* Step Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
            <Stack direction="row" spacing={2}>
              {steps.map((step, index) => (
                <Box
                  key={step.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
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
                    {index < activeStep ? <CheckCircleOutlineIcon fontSize="small" /> : step.icon}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: index === activeStep ? 'white' : 'rgba(255, 255, 255, 0.4)',
                      fontWeight: index === activeStep ? 600 : 400,
                      display: { xs: 'none', sm: 'block' },
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
        </motion.div>

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
              mb: 4,
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
                  <ToolAuthentication
                    apps={selectedApps}
                    authStates={authStates}
                    onAuthChange={handleAuthChange}
                    onTestConnection={handleTestConnection}
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

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
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
                  onClick={() => navigate('/dashboard/alerts')}
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
        </motion.div>
      </Container>
    </Box>
  );
};

export default OnboardingPage;
