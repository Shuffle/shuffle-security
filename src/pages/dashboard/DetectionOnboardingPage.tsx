import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Chip,
  Collapse,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SensorsIcon from '@mui/icons-material/Sensors';
import RuleIcon from '@mui/icons-material/Rule';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloudIcon from '@mui/icons-material/Cloud';
import StorageIcon from '@mui/icons-material/Storage';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { API_CONFIG, getApiUrl } from '@/config/api';

interface StepStatus {
  loading: boolean;
  checked: boolean;
  success: boolean;
  message?: string;
}

const DetectionOnboardingPage = () => {
  const [sensorStatus, setSensorStatus] = useState<StepStatus>({
    loading: false,
    checked: false,
    success: false,
  });
  const [rulesStatus, setRulesStatus] = useState<StepStatus>({
    loading: false,
    checked: false,
    success: false,
  });
  const [testStatus, setTestStatus] = useState<StepStatus>({
    loading: false,
    checked: false,
    success: false,
  });
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  // Check if sensors/pipelines are installed
  const checkSensors = async () => {
    setSensorStatus({ loading: true, checked: false, success: false });
    
    try {
      // TODO: Replace with actual sensor check API
      const response = await fetch(getApiUrl('/api/v1/workflows'), {
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Check if any detection pipelines exist
        const hasPipelines = Array.isArray(data) && data.some((w: any) => 
          w.tags?.includes('detection') || w.usecase === 'detection'
        );
        
        setSensorStatus({
          loading: false,
          checked: true,
          success: hasPipelines,
          message: hasPipelines 
            ? 'Detection pipelines are configured' 
            : 'No detection pipelines found',
        });
      } else {
        setSensorStatus({
          loading: false,
          checked: true,
          success: false,
          message: 'Failed to check sensor status',
        });
      }
    } catch (error) {
      setSensorStatus({
        loading: false,
        checked: true,
        success: false,
        message: 'Error checking sensors',
      });
    }
    
    // Auto-expand next step
    if (!sensorStatus.success) {
      setExpandedStep(2);
    }
  };

  // Check if detection rules are enabled
  const checkRules = async () => {
    setRulesStatus({ loading: true, checked: false, success: false });
    
    try {
      const response = await fetch(getApiUrl('/api/v1/detections/Sigma'), {
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const rules = data.detections || [];
        const enabledRules = rules.filter((r: any) => r.status === 'enabled' || r.active);
        
        setRulesStatus({
          loading: false,
          checked: true,
          success: enabledRules.length > 0,
          message: enabledRules.length > 0
            ? `${enabledRules.length} rules enabled`
            : 'No rules enabled yet',
        });
      } else {
        setRulesStatus({
          loading: false,
          checked: true,
          success: false,
          message: 'Failed to check rules status',
        });
      }
    } catch (error) {
      setRulesStatus({
        loading: false,
        checked: true,
        success: false,
        message: 'Error checking rules',
      });
    }
    
    setExpandedStep(3);
  };

  // Test detection rules
  const testRules = async (type: 'manual' | 'realworld') => {
    setTestStatus({ loading: true, checked: false, success: false });
    
    // Simulate test - TODO: implement actual test logic
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setTestStatus({
      loading: false,
      checked: true,
      success: true,
      message: type === 'manual' 
        ? 'Manual test completed successfully' 
        : 'Real-world test queued',
    });
  };

  const getStepIcon = (step: number, status: StepStatus) => {
    if (status.loading) {
      return <CircularProgress size={24} sx={{ color: 'hsl(var(--primary))' }} />;
    }
    if (status.checked && status.success) {
      return <CheckCircleIcon sx={{ color: 'hsl(var(--severity-low))', fontSize: 28 }} />;
    }
    if (status.checked && !status.success) {
      return <RadioButtonUncheckedIcon sx={{ color: 'hsl(var(--severity-medium))', fontSize: 28 }} />;
    }
    return (
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid hsl(var(--border))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--muted-foreground))',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}
      >
        {step}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            mb: 1,
          }}
        >
          Detection Setup
        </Typography>
        <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>
          Get your detection pipelines running in three simple steps
        </Typography>
      </Box>

      {/* Step 1: Check Sensors */}
      <Paper
        sx={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          mb: 2,
          overflow: 'hidden',
        }}
      >
        <Box
          onClick={() => setExpandedStep(expandedStep === 1 ? null : 1)}
          sx={{
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'pointer',
            '&:hover': { backgroundColor: 'hsl(var(--muted) / 0.3)' },
          }}
        >
          {getStepIcon(1, sensorStatus)}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SensorsIcon sx={{ color: 'hsl(var(--primary))', fontSize: 20 }} />
              <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Install a Sensor
              </Typography>
              {sensorStatus.checked && (
                <Chip
                  size="small"
                  label={sensorStatus.success ? 'Connected' : 'Not Found'}
                  sx={{
                    backgroundColor: sensorStatus.success
                      ? 'hsl(var(--severity-low) / 0.15)'
                      : 'hsl(var(--severity-medium) / 0.15)',
                    color: sensorStatus.success
                      ? 'hsl(var(--severity-low))'
                      : 'hsl(var(--severity-medium))',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                  }}
                />
              )}
            </Box>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mt: 0.5 }}>
              Deploy a detection pipeline to collect and analyze security events
            </Typography>
          </Box>
          {expandedStep === 1 ? (
            <ExpandLessIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />
          ) : (
            <ExpandMoreIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />
          )}
        </Box>

        <Collapse in={expandedStep === 1}>
          <Box sx={{ px: 3, pb: 3, pt: 1 }}>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mb: 3 }}>
              Choose how you want to deploy your detection sensor:
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              {/* Self-hosted option */}
              <Paper
                sx={{
                  flex: 1,
                  p: 2.5,
                  backgroundColor: 'hsl(var(--muted) / 0.3)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    backgroundColor: 'hsl(var(--muted) / 0.5)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <StorageIcon sx={{ color: 'hsl(var(--primary))' }} />
                  <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    Self-Hosted
                  </Typography>
                </Box>
                <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mb: 2 }}>
                  Deploy on your own infrastructure for full control
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: 'hsl(var(--primary))',
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                    },
                  }}
                >
                  View Instructions
                </Button>
              </Paper>

              {/* Cloud option */}
              <Paper
                sx={{
                  flex: 1,
                  p: 2.5,
                  backgroundColor: 'hsl(var(--primary) / 0.08)',
                  border: '1px solid hsl(var(--primary) / 0.3)',
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    backgroundColor: 'hsl(var(--primary) / 0.12)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <CloudIcon sx={{ color: 'hsl(var(--primary))' }} />
                  <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    Cloud Deploy
                  </Typography>
                  <Chip
                    size="small"
                    label="Recommended"
                    sx={{
                      backgroundColor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary-foreground))',
                      fontWeight: 500,
                      fontSize: '0.7rem',
                      height: 20,
                    }}
                  />
                </Box>
                <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mb: 2 }}>
                  One-click deployment with managed infrastructure
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  sx={{
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: 'hsl(var(--primary) / 0.9)',
                    },
                  }}
                >
                  Deploy Now
                </Button>
              </Paper>
            </Box>

            <Button
              onClick={checkSensors}
              disabled={sensorStatus.loading}
              variant="outlined"
              sx={{
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                textTransform: 'none',
                '&:hover': {
                  borderColor: 'hsl(var(--primary))',
                  backgroundColor: 'hsl(var(--primary) / 0.1)',
                },
              }}
            >
              {sensorStatus.loading ? 'Checking...' : 'Check Connection'}
            </Button>

            {sensorStatus.checked && !sensorStatus.success && (
              <Alert 
                severity="info" 
                sx={{ 
                  mt: 2, 
                  backgroundColor: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  '& .MuiAlert-icon': { color: 'hsl(var(--primary))' },
                }}
              >
                No sensors detected yet. Deploy one using the options above, then check again.
              </Alert>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Step 2: Enable Rules */}
      <Paper
        sx={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          mb: 2,
          overflow: 'hidden',
          opacity: sensorStatus.success ? 1 : 0.6,
        }}
      >
        <Box
          onClick={() => setExpandedStep(expandedStep === 2 ? null : 2)}
          sx={{
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'pointer',
            '&:hover': { backgroundColor: 'hsl(var(--muted) / 0.3)' },
          }}
        >
          {getStepIcon(2, rulesStatus)}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <RuleIcon sx={{ color: 'hsl(var(--primary))', fontSize: 20 }} />
              <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Enable Detection Rules
              </Typography>
              {rulesStatus.checked && (
                <Chip
                  size="small"
                  label={rulesStatus.message}
                  sx={{
                    backgroundColor: rulesStatus.success
                      ? 'hsl(var(--severity-low) / 0.15)'
                      : 'hsl(var(--severity-medium) / 0.15)',
                    color: rulesStatus.success
                      ? 'hsl(var(--severity-low))'
                      : 'hsl(var(--severity-medium))',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                  }}
                />
              )}
            </Box>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mt: 0.5 }}>
              Configure Sigma rules to detect threats in your environment
            </Typography>
          </Box>
          {expandedStep === 2 ? (
            <ExpandLessIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />
          ) : (
            <ExpandMoreIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />
          )}
        </Box>

        <Collapse in={expandedStep === 2}>
          <Box sx={{ px: 3, pb: 3, pt: 1 }}>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mb: 3 }}>
              Browse and enable detection rules from our Sigma rule library, or create your own custom rules.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                component={Link}
                to="/detection/sigma"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: 'hsl(var(--primary) / 0.9)',
                  },
                }}
              >
                Browse Rules
              </Button>
              <Button
                onClick={checkRules}
                disabled={rulesStatus.loading}
                variant="outlined"
                sx={{
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    backgroundColor: 'hsl(var(--primary) / 0.1)',
                  },
                }}
              >
                {rulesStatus.loading ? 'Checking...' : 'Check Status'}
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Step 3: Test Rules */}
      <Paper
        sx={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          overflow: 'hidden',
          opacity: rulesStatus.success ? 1 : 0.6,
        }}
      >
        <Box
          onClick={() => setExpandedStep(expandedStep === 3 ? null : 3)}
          sx={{
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'pointer',
            '&:hover': { backgroundColor: 'hsl(var(--muted) / 0.3)' },
          }}
        >
          {getStepIcon(3, testStatus)}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <PlayArrowIcon sx={{ color: 'hsl(var(--primary))', fontSize: 20 }} />
              <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Test Your Rules
              </Typography>
              {testStatus.checked && (
                <Chip
                  size="small"
                  label={testStatus.success ? 'Tested' : 'Not Tested'}
                  sx={{
                    backgroundColor: testStatus.success
                      ? 'hsl(var(--severity-low) / 0.15)'
                      : 'hsl(var(--severity-medium) / 0.15)',
                    color: testStatus.success
                      ? 'hsl(var(--severity-low))'
                      : 'hsl(var(--severity-medium))',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                  }}
                />
              )}
            </Box>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mt: 0.5 }}>
              Verify your detection rules are working correctly
            </Typography>
          </Box>
          {expandedStep === 3 ? (
            <ExpandLessIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />
          ) : (
            <ExpandMoreIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />
          )}
        </Box>

        <Collapse in={expandedStep === 3}>
          <Box sx={{ px: 3, pb: 3, pt: 1 }}>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mb: 3 }}>
              Choose how you want to test your detection rules:
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Manual test */}
              <Paper
                sx={{
                  flex: 1,
                  p: 2.5,
                  backgroundColor: 'hsl(var(--muted) / 0.3)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1.5,
                }}
              >
                <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 1 }}>
                  Manual Test
                </Typography>
                <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mb: 2 }}>
                  Trigger a test event to verify rule detection
                </Typography>
                <Button
                  onClick={() => testRules('manual')}
                  disabled={testStatus.loading}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: 'hsl(var(--primary))',
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                    },
                  }}
                >
                  Run Test
                </Button>
              </Paper>

              {/* Real-world test */}
              <Paper
                sx={{
                  flex: 1,
                  p: 2.5,
                  backgroundColor: 'hsl(var(--muted) / 0.3)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1.5,
                }}
              >
                <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 1 }}>
                  Real-World Test
                </Typography>
                <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mb: 2 }}>
                  Monitor live events for rule matches
                </Typography>
                <Button
                  onClick={() => testRules('realworld')}
                  disabled={testStatus.loading}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: 'hsl(var(--primary))',
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                    },
                  }}
                >
                  Start Monitoring
                </Button>
              </Paper>
            </Box>

            {testStatus.checked && testStatus.success && (
              <Alert 
                severity="success" 
                sx={{ 
                  mt: 3, 
                  backgroundColor: 'hsl(var(--severity-low) / 0.1)',
                  border: '1px solid hsl(var(--severity-low) / 0.3)',
                  color: 'hsl(var(--foreground))',
                  '& .MuiAlert-icon': { color: 'hsl(var(--severity-low))' },
                }}
              >
                {testStatus.message}
              </Alert>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Quick Links */}
      <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid hsl(var(--border))' }}>
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mb: 2 }}>
          Quick Links
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            component={Link}
            to="/detection/sigma"
            variant="text"
            size="small"
            sx={{ color: 'hsl(var(--primary))', textTransform: 'none' }}
          >
            Sigma Rules →
          </Button>
          <Button
            component={Link}
            to="/detection/mitre"
            variant="text"
            size="small"
            sx={{ color: 'hsl(var(--primary))', textTransform: 'none' }}
          >
            MITRE ATT&CK →
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default DetectionOnboardingPage;
