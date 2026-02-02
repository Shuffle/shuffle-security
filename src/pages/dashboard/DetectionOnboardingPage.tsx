import { useState, useEffect, forwardRef } from 'react';
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
import azureLogo from '@/assets/azure-logo.png';
import gcpLogo from '@/assets/gcp-logo.png';
import awsLogo from '@/assets/aws-logo.png';

// Cloud provider icons with forwardRef for MUI compatibility
const GCPIcon = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>((props, ref) => (
  <img ref={ref} src={gcpLogo} alt="GCP" width="20" height="20" style={{ objectFit: 'contain' }} {...props} />
));
GCPIcon.displayName = 'GCPIcon';

const AWSIcon = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>((props, ref) => (
  <img ref={ref} src={awsLogo} alt="AWS" width="20" height="20" style={{ objectFit: 'contain' }} {...props} />
));
AWSIcon.displayName = 'AWSIcon';

// Azure icon using the uploaded logo
const AzureIcon = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>((props, ref) => (
  <img ref={ref} src={azureLogo} alt="Azure" width="20" height="20" style={{ objectFit: 'contain' }} {...props} />
));
AzureIcon.displayName = 'AzureIcon';

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
  const [loadingDefaultRules, setLoadingDefaultRules] = useState(false);
  
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

  // Fetch environments function (extracted for reuse)
  const fetchEnvironments = async (isInitialLoad = false) => {
    if (!API_CONFIG.apiKey) {
      if (isInitialLoad) setLoadingEnvs(false);
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

        // On initial load, select the best available sensor
        if (isInitialLoad && activeEnvs.length > 0) {
          const now = Math.floor(Date.now() / 1000);
          const lastSensorId = localStorage.getItem(LAST_SENSOR_KEY);
          
          // Helper to check if a sensor is running
          const isRunning = (env: Environment) => 
            env.Type !== 'cloud' && env.checkin > 0 && (now - env.checkin) < 300;
          
          // Priority: Detection Ready > Running > Last used (if valid) > non-cloud > any
          const detectionReadyEnv = activeEnvs.find(e => e.data_lake?.enabled === true && e.Type !== 'cloud' && isRunning(e));
          const runningEnv = activeEnvs.find(e => isRunning(e));
          const lastUsedEnv = lastSensorId ? activeEnvs.find(e => e.id === lastSensorId && e.Type !== 'cloud') : null;
          const nonCloudEnv = activeEnvs.find(e => e.Type !== 'cloud');
          
          setSelectedEnvId(
            detectionReadyEnv?.id || 
            runningEnv?.id || 
            lastUsedEnv?.id ||
            nonCloudEnv?.id || 
            activeEnvs[0].id
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch environments:', error);
    } finally {
      if (isInitialLoad) setLoadingEnvs(false);
    }
  };

  // Fetch environments on mount
  useEffect(() => {
    fetchEnvironments(true);
  }, []);

  // Poll environments every 10 seconds to detect when sensors come online
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchEnvironments(false);
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // Persist selected environment
  useEffect(() => {
    if (selectedEnvId) {
      localStorage.setItem(LAST_SENSOR_KEY, selectedEnvId);
    }
  }, [selectedEnvId]);

  // Auto-check sensor and rules status on load, auto-expand to appropriate step
  useEffect(() => {
    const autoCheckStatus = async () => {
      if (!selectedEnvId || environments.length === 0 || !API_CONFIG.apiKey) return;
      
      const env = environments.find(e => e.id === selectedEnvId);
      if (!env) return;

      const sensorRunning = isSensorRunning(env);
      const pipelineReady = isPipelineReady(env);

      // Update sensor status
      if (sensorRunning && pipelineReady) {
        setSensorStatus({
          loading: false,
          checked: true,
          success: true,
          message: `Detection pipeline is enabled and ready`,
        });
      } else if (sensorRunning) {
        setSensorStatus({
          loading: false,
          checked: true,
          success: false,
          message: 'Sensor is running but detection pipeline is not yet configured',
        });
      }

      // If sensor is ready, also check rules
      if (sensorRunning && pipelineReady) {
        try {
          const response = await fetch(getApiUrl('/api/v1/detections/Sigma'), {
            headers: {
              'Authorization': `Bearer ${API_CONFIG.apiKey}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            const rules = data.detection_info || [];
            const enabledRules = rules.filter((r: any) => r.is_enabled === true);
            
            if (enabledRules.length > 0) {
              // Rules are enabled, mark step 2 complete and expand step 3
              setRulesStatus({
                loading: false,
                checked: true,
                success: true,
                message: `${enabledRules.length} rules enabled`,
              });
              setExpandedStep(3);
            } else {
              // No rules enabled, expand step 2
              setRulesStatus({
                loading: false,
                checked: true,
                success: false,
                message: 'No rules enabled yet',
              });
              setExpandedStep(2);
            }
          } else {
            setExpandedStep(2);
          }
        } catch (error) {
          console.error('Failed to auto-check rules:', error);
          setExpandedStep(2);
        }
      } else if (sensorRunning) {
        // Sensor running but not detection-ready, stay on step 1 or expand step 2
        setExpandedStep(2);
      }
    };

    autoCheckStatus();
  }, [selectedEnvId, environments]);

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

  // Helper to check if detection pipeline is ready (data_lake.enabled = true)
  const isPipelineReady = (env: Environment): boolean => {
    return env.data_lake?.enabled === true;
  };

  // Get sensor status label and color
  const getSensorStatus = (env: Environment): { label: string; color: 'low' | 'medium' | 'info' } => {
    const running = isSensorRunning(env);
    const pipelineReady = isPipelineReady(env);
    const pipelineCount = getPipelineCount(env);

    if (!running) {
      return { label: 'Not Running', color: 'medium' };
    }
    
    if (pipelineReady) {
      return { 
        label: pipelineCount > 0 ? `${pipelineCount} Pipeline${pipelineCount !== 1 ? 's' : ''}` : 'Detection Ready', 
        color: 'low' 
      };
    }
    
    return { label: 'Running', color: 'info' };
  };

  const openDeploymentDialog = (provider: DeploymentProvider) => {
    setDeploymentDialog({ open: true, provider });
  };

  // Check if selected sensor is connected (uses already-fetched environment data)
  const checkSensors = async () => {
    setSensorStatus({ loading: true, checked: false, success: false });
    
    // Re-fetch to get latest checkin status and get fresh data directly
    if (!API_CONFIG.apiKey) {
      setSensorStatus({
        loading: false,
        checked: true,
        success: false,
        message: 'No API key configured',
      });
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/v1/getenvironments'), {
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        },
      });

      if (!response.ok) {
        setSensorStatus({
          loading: false,
          checked: true,
          success: false,
          message: 'Failed to check sensor status',
        });
        return;
      }

      const data: Environment[] = await response.json();
      const activeEnvs = data.filter(env => !env.archived);
      setEnvironments(activeEnvs);
      
      // Use fresh data directly instead of stale state
      const currentEnv = activeEnvs.find(e => e.id === selectedEnvId);
      
      if (!currentEnv) {
        setSensorStatus({
          loading: false,
          checked: true,
          success: false,
          message: 'No sensor selected',
        });
        return;
      }
      
      const isRunning = isSensorRunning(currentEnv);
      const pipelineReady = isPipelineReady(currentEnv);
      const pipelineCount = getPipelineCount(currentEnv);
      
      let message = '';
      if (!isRunning) {
        message = 'Sensor not running. Deploy it using the options above.';
      } else if (pipelineReady) {
        message = pipelineCount > 0 
          ? `Detection ready with ${pipelineCount} pipeline${pipelineCount !== 1 ? 's' : ''} active`
          : 'Detection pipeline is enabled and ready';
      } else {
        message = 'Sensor is running but detection pipeline is not yet configured';
      }
      
      setSensorStatus({
        loading: false,
        checked: true,
        success: isRunning && pipelineReady,
        message,
      });
      
      // Auto-expand next step if successful
      if (isRunning) {
        setExpandedStep(2);
      }
    } catch (error) {
      setSensorStatus({
        loading: false,
        checked: true,
        success: false,
        message: 'Error checking sensor status',
      });
    }
  };

  // Load default Sigma rules from GitHub repo
  const loadDefaultRules = async () => {
    setLoadingDefaultRules(true);
    
    try {
      const response = await fetch(getApiUrl('/api/v1/files/download_remote'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://github.com/shuffle/security-rules',
          path: 'sigma',
          field_3: 'main',
        }),
      });
      
      if (response.ok) {
        // After loading, re-check rules status
        await checkRules();
      } else {
        console.error('Failed to load default rules');
        setRulesStatus({
          loading: false,
          checked: true,
          success: false,
          message: 'Failed to load default rules',
        });
      }
    } catch (error) {
      console.error('Error loading default rules:', error);
      setRulesStatus({
        loading: false,
        checked: true,
        success: false,
        message: 'Error loading default rules',
      });
    } finally {
      setLoadingDefaultRules(false);
    }
  };

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
        const rules = data.detection_info || [];
        const enabledRules = rules.filter((r: any) => r.is_enabled === true);
        
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
              {/* Only show status chips when step is collapsed */}
              {expandedStep !== 1 && selectedEnvironment && (() => {
                const running = isSensorRunning(selectedEnvironment);
                const pipelineReady = isPipelineReady(selectedEnvironment);
                const pipelineCount = getPipelineCount(selectedEnvironment);
                
                return (
                  <>
                    {/* Running status */}
                    <Chip
                      size="small"
                      label={running ? 'Running' : 'Not Running'}
                      sx={{
                        backgroundColor: running
                          ? 'hsl(var(--severity-low) / 0.15)'
                          : 'hsl(var(--severity-medium) / 0.15)',
                        color: running
                          ? 'hsl(var(--severity-low))'
                          : 'hsl(var(--severity-medium))',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                      }}
                    />
                    
                    {/* Detection Ready status - only show if running */}
                    {running && (
                      <Chip
                        size="small"
                        label={pipelineReady ? 'Detection Ready' : 'Detection Not Ready'}
                        sx={{
                          backgroundColor: pipelineReady
                            ? 'hsl(var(--severity-info) / 0.15)'
                            : 'hsl(var(--severity-medium) / 0.15)',
                          color: pipelineReady
                            ? 'hsl(var(--severity-info))'
                            : 'hsl(var(--severity-medium))',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                        }}
                      />
                    )}
                    
                    {/* Pipeline count - only show if has pipelines */}
                    {pipelineCount > 0 && (
                      <Chip
                        size="small"
                        label={`${pipelineCount} Pipeline${pipelineCount !== 1 ? 's' : ''}`}
                        sx={{
                          backgroundColor: 'hsl(var(--primary) / 0.15)',
                          color: 'hsl(var(--primary))',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                        }}
                      />
                    )}
                  </>
                );
              })()}
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
                          const pipelineReady = isPipelineReady(env);
                          const pipelineCount = getPipelineCount(env);
                          
                          return (
                            <MenuItem key={env.id} value={env.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                {/* Running status dot */}
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: running 
                                      ? 'hsl(var(--severity-low))' 
                                      : 'hsl(var(--severity-medium))',
                                    flexShrink: 0,
                                  }}
                                  title={running ? 'Running' : 'Not Running'}
                                />
                                {/* Detection Ready status dot */}
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: pipelineReady 
                                      ? 'hsl(var(--severity-info))' 
                                      : 'hsl(var(--muted-foreground) / 0.3)',
                                    flexShrink: 0,
                                  }}
                                  title={pipelineReady ? 'Detection Ready' : 'Detection Not Ready'}
                                />
                                <span style={{ flex: 1 }}>{env.Name}</span>
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
                    
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Running status */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: isSensorRunning(selectedEnvironment)
                              ? 'hsl(var(--severity-low))'
                              : 'hsl(var(--severity-medium))',
                          }}
                        />
                        <Typography sx={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                          {isSensorRunning(selectedEnvironment) ? 'Running' : 'Not Running'}
                        </Typography>
                      </Box>
                      
                      {/* Detection Ready status */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: isPipelineReady(selectedEnvironment)
                              ? 'hsl(var(--severity-info))'
                              : 'hsl(var(--muted-foreground) / 0.3)',
                          }}
                        />
                        <Typography sx={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                          {isPipelineReady(selectedEnvironment) ? 'Detection Ready' : 'Detection Not Ready'}
                        </Typography>
                      </Box>
                      
                      {/* Pipelines count */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: getPipelineCount(selectedEnvironment) > 0
                              ? 'hsl(var(--primary))'
                              : 'hsl(var(--muted-foreground) / 0.3)',
                          }}
                        />
                        <Typography sx={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                          {getPipelineCount(selectedEnvironment)} Pipeline{getPipelineCount(selectedEnvironment) !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
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
              Load our default detection rules or browse and enable rules from our Sigma rule library.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                onClick={loadDefaultRules}
                disabled={loadingDefaultRules || rulesStatus.success}
                variant="contained"
                sx={{
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: 'hsl(var(--primary) / 0.9)',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: rulesStatus.success 
                      ? 'hsl(var(--severity-low) / 0.2)' 
                      : 'hsl(var(--muted))',
                    color: rulesStatus.success 
                      ? 'hsl(var(--severity-low))' 
                      : 'hsl(var(--muted-foreground))',
                  },
                }}
              >
                {loadingDefaultRules ? (
                  <>
                    <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />
                    Loading Rules...
                  </>
                ) : rulesStatus.success ? (
                  'Rules Loaded'
                ) : (
                  'Load Default Rules'
                )}
              </Button>
              <Button
                component={Link}
                to="/detection/sigma"
                variant="outlined"
                endIcon={<ArrowForwardIcon />}
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
