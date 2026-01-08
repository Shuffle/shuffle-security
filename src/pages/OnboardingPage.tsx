import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { TicketingSystemSearch, TicketingSystem } from '@/components/onboarding/TicketingSystemSearch';
import { ToolAuthentication, ToolAuthState, AuthStatus } from '@/components/onboarding/ToolAuthentication';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const steps = ['Select Tools', 'Configure Authentication', 'Complete'];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedSystems, setSelectedSystems] = useState<TicketingSystem[]>([]);
  const [authStates, setAuthStates] = useState<Record<string, ToolAuthState>>({});

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      // Save to localStorage for sidebar indicator (temporary until backend)
      const connectedSystems = selectedSystems.filter(
        (s) => authStates[s.id]?.status === 'connected'
      );
      localStorage.setItem('connected_integrations', JSON.stringify(connectedSystems));
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
    // Simulate connection test
    setAuthStates((prev) => ({
      ...prev,
      [systemId]: {
        ...prev[systemId],
        status: 'testing' as AuthStatus,
      },
    }));

    // Simulate async test (replace with actual API call later)
    setTimeout(() => {
      const success = Math.random() > 0.3; // 70% success rate for demo
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
    if (activeStep === 0) return selectedSystems.length > 0;
    if (activeStep === 1) {
      // At least one system should be connected
      return selectedSystems.some((s) => authStates[s.id]?.status === 'connected');
    }
    return true;
  };

  const connectedCount = selectedSystems.filter(
    (s) => authStates[s.id]?.status === 'connected'
  ).length;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'hsl(var(--background))',
        py: 4,
      }}
    >
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2 }}>
            <svg width="40" height="40" viewBox="0 0 56 56" fill="none">
              <path
                d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z"
                fill="#FF6600"
              />
            </svg>
            <Typography variant="h4" sx={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}>
              Shuffle Cases
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Let's get you set up with your existing tools
          </Typography>
        </Box>

        {/* Stepper */}
        <Stepper
          activeStep={activeStep}
          sx={{
            mb: 4,
            '& .MuiStepLabel-label': {
              color: 'hsl(var(--muted-foreground))',
              '&.Mui-active': { color: 'hsl(var(--foreground))' },
              '&.Mui-completed': { color: 'hsl(var(--primary))' },
            },
            '& .MuiStepIcon-root': {
              color: 'hsl(var(--muted))',
              '&.Mui-active': { color: 'hsl(var(--primary))' },
              '&.Mui-completed': { color: 'hsl(var(--primary))' },
            },
          }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Content */}
        <Paper
          sx={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            p: 4,
            mb: 3,
          }}
        >
          {activeStep === 0 && (
            <TicketingSystemSearch
              selectedSystems={selectedSystems}
              onSelectionChange={setSelectedSystems}
            />
          )}

          {activeStep === 1 && (
            <ToolAuthentication
              systems={selectedSystems}
              authStates={authStates}
              onAuthChange={handleAuthChange}
              onTestConnection={handleTestConnection}
            />
          )}

          {activeStep === 2 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleOutlineIcon
                sx={{ fontSize: 80, color: 'hsl(var(--primary))', mb: 2 }}
              />
              <Typography variant="h5" sx={{ color: 'hsl(var(--foreground))', mb: 1 }}>
                You're All Set!
              </Typography>
              <Typography variant="body1" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
                {connectedCount} integration{connectedCount !== 1 ? 's' : ''} connected successfully.
                You can manage your integrations in the sidebar.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                {selectedSystems
                  .filter((s) => authStates[s.id]?.status === 'connected')
                  .map((system) => (
                    <Paper
                      key={system.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 2,
                        py: 1,
                        backgroundColor: 'hsl(var(--muted))',
                        border: '1px solid hsl(var(--severity-low))',
                        borderRadius: 1,
                      }}
                    >
                      <span>{system.icon}</span>
                      <Typography sx={{ color: 'hsl(var(--foreground))' }}>{system.name}</Typography>
                    </Paper>
                  ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            onClick={handleBack}
            disabled={activeStep === 0}
            sx={{ color: 'hsl(var(--muted-foreground))' }}
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {activeStep < steps.length - 1 && (
              <Button
                onClick={() => navigate('/dashboard/alerts')}
                sx={{ color: 'hsl(var(--muted-foreground))' }}
              >
                Skip for now
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceed()}
              sx={{
                backgroundColor: 'hsl(var(--primary))',
                '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)' },
              }}
            >
              {activeStep === steps.length - 1 ? 'Go to Dashboard' : 'Continue'}
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default OnboardingPage;
