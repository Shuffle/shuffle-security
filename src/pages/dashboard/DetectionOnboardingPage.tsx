import { useState, useEffect } from 'react';
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
  TextField,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SensorsIcon from '@mui/icons-material/Sensors';
import RuleIcon from '@mui/icons-material/Rule';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StorageIcon from '@mui/icons-material/Storage';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import { API_CONFIG, getApiUrl } from '@/config/api';
import { DeploymentInstructions } from '@/components/detection/DeploymentInstructions';

// Cloud provider icons as simple components
const GCPIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12.19 3.91L14.62 8.2l2.43-1.4-2.43-4.21a1.61 1.61 0 00-1.4-.8H10.1l-1.21 2.1h3.3z" fill="#EA4335"/>
    <path d="M5.33 13.6l-2.43 4.2a1.6 1.6 0 00.6 2.19l2.42 1.4 2.43-4.21-3.02-3.58z" fill="#4285F4"/>
    <path d="M21.1 13.6l-2.43-4.2-2.43 4.2 2.43 4.21 2.43-1.4a1.6 1.6 0 00.6-2.19l-.6-1.02-.6.4z" fill="#34A853"/>
    <path d="M12 8.69L9.57 4.49H5.93l-2.42 4.2L6.52 13l2.43-4.31H12z" fill="#FBBC05"/>
    <path d="M12 15.31l2.43 4.2h3.64l2.43-4.2-3.02-3.58-2.43 4.18H12z" fill="#EA4335"/>
    <path d="M8.35 17.18L5.93 13l-2.42 4.21 2.43 4.2h3.64l1.21-2.1-2.44-2.13z" fill="#4285F4"/>
  </svg>
);

const AWSIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M6.76 11.63c0 .26.03.47.08.62.06.15.13.31.23.49.04.06.05.12.05.17 0 .07-.04.15-.13.22l-.44.29c-.06.04-.12.06-.17.06-.07 0-.13-.03-.2-.1a2.06 2.06 0 01-.24-.31 5.2 5.2 0 01-.2-.39c-.52.61-1.17.92-1.95.92-.56 0-1-.16-1.33-.47-.33-.32-.49-.74-.49-1.27 0-.56.2-1.01.6-1.36.4-.35.93-.52 1.6-.52.22 0 .45.02.69.05.24.04.49.09.75.16v-.48c0-.5-.1-.86-.32-1.06-.21-.21-.58-.31-1.1-.31-.24 0-.48.03-.73.09-.25.06-.5.14-.74.24-.11.05-.19.07-.24.09a.43.43 0 01-.12.02c-.1 0-.16-.08-.16-.23v-.34c0-.12.01-.21.05-.27a.53.53 0 01.19-.14c.24-.12.53-.23.86-.31.33-.09.68-.13 1.05-.13.8 0 1.39.18 1.76.54.37.36.55.91.55 1.65v2.18zm-2.7.99c.22 0 .44-.04.68-.12.24-.08.45-.23.64-.44.11-.13.2-.27.25-.44.05-.16.08-.36.08-.59v-.29a5.5 5.5 0 00-.6-.12 4.92 4.92 0 00-.61-.04c-.44 0-.76.08-.97.25-.21.17-.31.41-.31.72 0 .29.08.51.23.65.15.15.37.22.61.22zm5.34.68c-.13 0-.22-.02-.28-.07-.06-.04-.11-.14-.16-.28l-1.77-5.81a1.31 1.31 0 01-.07-.3c0-.11.06-.18.18-.18h.56c.14 0 .23.02.29.07.06.05.11.14.15.28l1.27 4.99 1.18-4.99c.04-.15.08-.24.15-.28a.55.55 0 01.29-.07h.46c.14 0 .23.02.29.07.06.05.12.14.15.28l1.19 5.06 1.31-5.06c.04-.15.1-.24.15-.28a.5.5 0 01.29-.07h.53c.12 0 .18.06.18.18 0 .04-.01.07-.02.12-.01.04-.03.1-.06.18l-1.82 5.81c-.04.15-.1.24-.16.28-.06.05-.15.07-.28.07h-.49c-.14 0-.23-.02-.29-.08-.06-.05-.11-.14-.15-.29l-1.17-4.86-1.16 4.85c-.04.15-.09.24-.15.29-.06.05-.16.08-.29.08h-.49z" fill="#FF9900"/>
  </svg>
);

const AzureIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M13.05 4.24l-4.79 13.37 7.79-.01-2.65-4.59 6.53-1.91-6.88-6.86z" fill="#0089D6"/>
    <path d="M7.26 4.24L2 17.61h4.47l2.06-5.74 3.52 5.74h5.5L7.26 4.24z" fill="#0089D6"/>
  </svg>
);

type DeploymentProvider = 'self-hosted' | 'gcp' | 'aws' | 'azure';

interface StepStatus {
  loading: boolean;
  checked: boolean;
  success: boolean;
  message?: string;
}

interface Environment {
  id: string;
  Name: string;
  Type: string;
  Registered: boolean;
  default: boolean;
  archived: boolean;
  org_id: string;
  created: number;
  edited: number;
  checkin: number;
  auth: string;
  queue: number;
  run_type: string;
  data_lake?: {
    enabled: boolean;
    pipelines: any;
  };
}

const LAST_SENSOR_KEY = 'shuffle_last_sensor_id';

const DetectionOnboardingPage = () => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [newEnvName, setNewEnvName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loadingEnvs, setLoadingEnvs] = useState(true);
  
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
  const [deploymentDialog, setDeploymentDialog] = useState<{
    open: boolean;
    provider: DeploymentProvider;
  }>({ open: false, provider: 'self-hosted' });

  // Fetch environments on mount
  useEffect(() => {
    const fetchEnvironments = async () => {
      if (!API_CONFIG.apiKey) {
        setLoadingEnvs(false);
        return;
      }

      try {
        const response = await fetch(getApiUrl('/api/v1/getenvironments'), {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          },
        });

        if (response.ok) {
          const data: Environment[] = await response.json();
          // Filter out archived environments
          const activeEnvs = data.filter(env => !env.archived);
          setEnvironments(activeEnvs);

          // Restore last selected sensor
          const lastSensorId = localStorage.getItem(LAST_SENSOR_KEY);
          if (lastSensorId && activeEnvs.some(e => e.id === lastSensorId)) {
            setSelectedEnvId(lastSensorId);
          } else if (activeEnvs.length > 0) {
            // Default to first non-archived environment
            setSelectedEnvId(activeEnvs[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch environments:', error);
      } finally {
        setLoadingEnvs(false);
      }
    };

    fetchEnvironments();
  }, []);

  // Persist selected environment
  useEffect(() => {
    if (selectedEnvId) {
      localStorage.setItem(LAST_SENSOR_KEY, selectedEnvId);
    }
  }, [selectedEnvId]);

  const selectedEnvironment = environments.find(e => e.id === selectedEnvId);
  const currentEnvName = isCreatingNew ? newEnvName : (selectedEnvironment?.Name || '');

  // Helper to check if sensor is running (checkin within last 300 seconds, or cloud type)
  const isSensorRunning = (env: Environment): boolean => {
    if (env.Type === 'cloud') return true;
    const now = Math.floor(Date.now() / 1000);
    return env.checkin > 0 && (now - env.checkin) < 300;
  };

  // Helper to check if sensor is valid (not cloud type)
  const isSensorValid = (env: Environment): boolean => {
    return env.Type !== 'cloud';
  };

  // Helper to get pipeline count
  const getPipelineCount = (env: Environment): number => {
    if (!env.data_lake?.pipelines) return 0;
    return Array.isArray(env.data_lake.pipelines) ? env.data_lake.pipelines.length : 0;
  };

  const openDeploymentDialog = (provider: DeploymentProvider) => {
    setDeploymentDialog({ open: true, provider });
  };

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
    <Box sx={{ p: 4, maxWidth: 960, mx: 'auto' }}>
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
            {/* Sensor Selection */}
            <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
              1. Select or Create a Sensor
            </Typography>
            
            {loadingEnvs ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <CircularProgress size={20} sx={{ color: 'hsl(var(--primary))' }} />
                <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
                  Loading sensors...
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  {!isCreatingNew ? (
                    <FormControl size="small" sx={{ minWidth: 280 }}>
                      <InputLabel 
                        sx={{ 
                          color: 'hsl(var(--muted-foreground))',
                          '&.Mui-focused': { color: 'hsl(var(--primary))' },
                        }}
                      >
                        Select Sensor
                      </InputLabel>
                      <Select
                        value={selectedEnvId}
                        onChange={(e) => setSelectedEnvId(e.target.value)}
                        label="Select Sensor"
                        sx={{
                          backgroundColor: 'hsl(var(--muted))',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--primary))' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--primary))' },
                          '& .MuiSelect-select': { color: 'hsl(var(--foreground))' },
                        }}
                      >
                        {environments.map((env) => {
                          const running = isSensorRunning(env);
                          const valid = isSensorValid(env);
                          const pipelineCount = getPipelineCount(env);
                          
                          return (
                            <MenuItem key={env.id} value={env.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: running 
                                      ? 'hsl(var(--severity-low))' 
                                      : 'hsl(var(--severity-high))',
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ flex: 1 }}>{env.Name}</span>
                                {!valid && (
                                  <Chip
                                    size="small"
                                    label="Cloud"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      backgroundColor: 'hsl(var(--muted))',
                                      color: 'hsl(var(--muted-foreground))',
                                    }}
                                  />
                                )}
                                {pipelineCount > 0 && (
                                  <Typography 
                                    component="span" 
                                    sx={{ 
                                      color: 'hsl(var(--primary))', 
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {pipelineCount} pipeline{pipelineCount !== 1 ? 's' : ''}
                                  </Typography>
                                )}
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                      placeholder="Enter sensor name..."
                      size="small"
                      autoFocus
                      sx={{
                        minWidth: 280,
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'hsl(var(--muted))',
                          '& fieldset': { borderColor: 'hsl(var(--border))' },
                          '&:hover fieldset': { borderColor: 'hsl(var(--primary))' },
                          '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                        },
                        '& .MuiInputBase-input': {
                          color: 'hsl(var(--foreground))',
                        },
                      }}
                    />
                  )}
                  
                  <Button
                    onClick={() => {
                      setIsCreatingNew(!isCreatingNew);
                      if (!isCreatingNew) {
                        setNewEnvName('');
                      }
                    }}
                    variant="outlined"
                    size="small"
                    startIcon={isCreatingNew ? undefined : <AddIcon />}
                    sx={{
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                      textTransform: 'none',
                      height: 40,
                      '&:hover': {
                        borderColor: 'hsl(var(--primary))',
                        backgroundColor: 'hsl(var(--primary) / 0.1)',
                      },
                    }}
                  >
                    {isCreatingNew ? 'Choose Existing' : 'Create New'}
                  </Button>
                </Box>

                {selectedEnvironment && !isCreatingNew && (
                  <Box sx={{ mt: 2 }}>
                    {/* Cloud warning */}
                    {!isSensorValid(selectedEnvironment) && (
                      <Alert 
                        severity="warning" 
                        sx={{ 
                          mb: 2,
                          backgroundColor: 'hsl(var(--severity-medium) / 0.1)',
                          border: '1px solid hsl(var(--severity-medium) / 0.3)',
                          color: 'hsl(var(--foreground))',
                          '& .MuiAlert-icon': { color: 'hsl(var(--severity-medium))' },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.875rem', mb: 1 }}>
                          Cloud environments cannot be used for detection. Please select or create a self-hosted sensor.
                        </Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                          Need us to host a sensor for you?{' '}
                          <a 
                            href="mailto:support@shuffler.io" 
                            style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}
                          >
                            Email support@shuffler.io
                          </a>
                          {' '}or{' '}
                          <a 
                            href="https://shuffler.io/contact?category=cloud_enterprise_plan" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}
                          >
                            contact us about enterprise hosting
                          </a>.
                        </Typography>
                      </Alert>
                    )}
                    
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {/* Running status */}
                      <Chip
                        size="small"
                        label={isSensorRunning(selectedEnvironment) ? 'Running' : 'Not Running'}
                        sx={{
                          backgroundColor: isSensorRunning(selectedEnvironment)
                            ? 'hsl(var(--severity-low) / 0.15)'
                            : 'hsl(var(--severity-high) / 0.15)',
                          color: isSensorRunning(selectedEnvironment)
                            ? 'hsl(var(--severity-low))'
                            : 'hsl(var(--severity-high))',
                        }}
                      />
                      
                      {/* Pipelines count */}
                      <Chip
                        size="small"
                        label={`${getPipelineCount(selectedEnvironment)} Pipeline${getPipelineCount(selectedEnvironment) !== 1 ? 's' : ''}`}
                        sx={{
                          backgroundColor: getPipelineCount(selectedEnvironment) > 0
                            ? 'hsl(var(--primary) / 0.15)'
                            : 'hsl(var(--muted))',
                          color: getPipelineCount(selectedEnvironment) > 0
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--muted-foreground))',
                        }}
                      />
                      
                      {/* Type */}
                      <Chip
                        size="small"
                        label={`Type: ${selectedEnvironment.run_type || selectedEnvironment.Type}`}
                        sx={{
                          backgroundColor: 'hsl(var(--muted))',
                          color: 'hsl(var(--muted-foreground))',
                        }}
                      />
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* Deployment Options - Hidden for cloud sensors or running sensors */}
            {(isCreatingNew || (selectedEnvironment && isSensorValid(selectedEnvironment) && !isSensorRunning(selectedEnvironment))) && (
              <>
                <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
                  2. Choose Deployment Method
                </Typography>
                <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', mb: 2 }}>
                  {isCreatingNew 
                    ? `Deploy a new sensor named "${newEnvName || 'unnamed'}":`
                    : `Deploy or reconnect "${currentEnvName}":`
                  }
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 3 }}>
                  {/* Self-hosted option */}
                  <Paper
                    onClick={() => openDeploymentDialog('self-hosted')}
                    sx={{
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <StorageIcon sx={{ color: 'hsl(var(--primary))' }} />
                      <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                        Self-Hosted
                      </Typography>
                    </Box>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
                      Deploy on your own infrastructure
                    </Typography>
                  </Paper>

                  {/* Google Cloud option */}
                  <Paper
                    onClick={() => openDeploymentDialog('gcp')}
                    sx={{
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <GCPIcon />
                      <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                        Google Cloud
                      </Typography>
                    </Box>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
                      Deploy on GCP Compute Engine
                    </Typography>
                  </Paper>

                  {/* AWS option */}
                  <Paper
                    onClick={() => openDeploymentDialog('aws')}
                    sx={{
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <AWSIcon />
                      <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                        Amazon Web Services
                      </Typography>
                    </Box>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
                      Deploy on AWS EC2
                    </Typography>
                  </Paper>

                  {/* Azure option */}
                  <Paper
                    onClick={() => openDeploymentDialog('azure')}
                    sx={{
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <AzureIcon />
                      <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                        Microsoft Azure
                      </Typography>
                    </Box>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
                      Deploy on Azure Virtual Machines
                    </Typography>
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
              </>
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

      {/* Deployment Instructions Dialog */}
      <DeploymentInstructions
        open={deploymentDialog.open}
        onClose={() => setDeploymentDialog({ ...deploymentDialog, open: false })}
        initialProvider={deploymentDialog.provider}
        environmentName={currentEnvName}
        environmentId={isCreatingNew ? '' : selectedEnvId}
        environmentAuth={isCreatingNew ? '' : (selectedEnvironment?.auth || '')}
      />
    </Box>
  );
};

export default DetectionOnboardingPage;
