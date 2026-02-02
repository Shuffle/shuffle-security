import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Button,
  Tabs,
  Tab,
  TextField,
  Alert,
  Tooltip,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useAuth } from '@/context/AuthContext';
import { API_CONFIG } from '@/config/api';

type Provider = 'self-hosted' | 'gcp' | 'aws' | 'azure';

interface DeploymentInstructionsProps {
  open: boolean;
  onClose: () => void;
  initialProvider?: Provider;
  environmentName?: string;
  environmentId?: string;
  environmentAuth?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
    {value === index && children}
  </Box>
);

export const DeploymentInstructions = ({
  open,
  onClose,
  initialProvider = 'self-hosted',
  environmentName = '',
  environmentId = '',
  environmentAuth = '',
}: DeploymentInstructionsProps) => {
  const { userInfo } = useAuth();
  const [activeTab, setActiveTab] = useState(
    initialProvider === 'self-hosted' ? 0 :
    initialProvider === 'gcp' ? 1 :
    initialProvider === 'aws' ? 2 : 3
  );
  const [copied, setCopied] = useState(false);

  // Get credentials for the command
  // AUTH comes from the environment's auth field, ORG from the user's active org
  const authKey = environmentAuth || '';
  const orgId = userInfo?.active_org?.id || '';
  const baseUrl = API_CONFIG.baseUrl || 'https://shuffler.io';
  const envName = environmentName || 'Production';

  const dockerCommand = `docker run -d \\
        --restart=always \\
        --name="shuffle-orborus" \\
        --pull=always \\
        --volume "/var/run/docker.sock:/var/run/docker.sock" \\
        -e AUTH="${authKey}" \\
        -e ENVIRONMENT_NAME="${envName}" \\
        -e ORG="${orgId}" \\
        -e SHUFFLE_SWARM_CONFIG=run \\
        -e BASE_URL="${baseUrl}" \\
        -v /tmp:/tmp \\
        ghcr.io/shuffle/shuffle-orborus:latest`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(dockerCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const vmProvisioningSteps = {
    gcp: {
      name: 'Google Cloud',
      consoleUrl: 'https://console.cloud.google.com/compute/instancesAdd',
      steps: [
        'Go to Google Cloud Console → Compute Engine → VM Instances',
        'Click "Create Instance"',
        'Choose a machine type (e2-medium or larger recommended)',
        'Select "Container Optimized OS" or Ubuntu as the boot disk',
        'Under Firewall, allow HTTP/HTTPS traffic if needed',
        'Click "Create" and wait for the VM to start',
        'SSH into the VM and run the docker command below',
      ],
    },
    aws: {
      name: 'Amazon Web Services',
      consoleUrl: 'https://console.aws.amazon.com/ec2/v2/home#LaunchInstances:',
      steps: [
        'Go to AWS Console → EC2 → Launch Instance',
        'Choose "Amazon Linux 2023" or "Ubuntu" AMI',
        'Select instance type (t3.medium or larger recommended)',
        'Configure security group to allow SSH (port 22)',
        'Launch the instance and download the key pair',
        'SSH into the instance: ssh -i your-key.pem ec2-user@<public-ip>',
        'Install Docker: sudo yum install docker -y && sudo systemctl start docker',
        'Run the docker command below',
      ],
    },
    azure: {
      name: 'Microsoft Azure',
      consoleUrl: 'https://portal.azure.com/#create/Microsoft.VirtualMachine',
      steps: [
        'Go to Azure Portal → Virtual Machines → Create',
        'Choose Ubuntu Server 22.04 LTS as the image',
        'Select a size (Standard_B2s or larger recommended)',
        'Configure SSH public key authentication',
        'Review and create the VM',
        'SSH into the VM using the public IP',
        'Install Docker: sudo apt update && sudo apt install docker.io -y',
        'Run the docker command below',
      ],
    },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <Typography sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          Deploy Detection Sensor
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon sx={{ color: 'hsl(var(--muted-foreground))' }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            borderBottom: '1px solid hsl(var(--border))',
            px: 2,
            '& .MuiTab-root': {
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'none',
              fontWeight: 500,
              '&.Mui-selected': {
                color: 'hsl(var(--primary))',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'hsl(var(--primary))',
            },
          }}
        >
          <Tab label="Self-Hosted" />
          <Tab label="Google Cloud" />
          <Tab label="AWS" />
          <Tab label="Azure" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Environment Name Display */}
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
              Sensor:
            </Typography>
            <Chip
              label={envName}
              sx={{
                backgroundColor: 'hsl(var(--primary) / 0.15)',
                color: 'hsl(var(--primary))',
                fontWeight: 600,
              }}
            />
          </Box>

          {/* Self-Hosted Tab */}
          <TabPanel value={activeTab} index={0}>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', mb: 2, fontSize: '0.875rem' }}>
              Run this command on any machine with Docker installed:
            </Typography>
            
            <Box
              sx={{
                position: 'relative',
                backgroundColor: 'hsl(var(--muted))',
                borderRadius: 1.5,
                border: '1px solid hsl(var(--border))',
                p: 2,
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                color: 'hsl(var(--foreground))',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                <IconButton
                  onClick={handleCopy}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    '&:hover': { backgroundColor: 'hsl(var(--accent))' },
                  }}
                >
                  {copied ? (
                    <CheckIcon sx={{ fontSize: 16, color: 'hsl(var(--severity-low))' }} />
                  ) : (
                    <ContentCopyIcon sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }} />
                  )}
                </IconButton>
              </Tooltip>
              {dockerCommand}
            </Box>

            {!authKey && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mt: 2,
                  backgroundColor: 'hsl(var(--severity-medium) / 0.1)',
                  border: '1px solid hsl(var(--severity-medium) / 0.3)',
                  color: 'hsl(var(--foreground))',
                  '& .MuiAlert-icon': { color: 'hsl(var(--severity-medium))' },
                }}
              >
                API key not found. Please ensure you're logged in with a valid API key.
              </Alert>
            )}
          </TabPanel>

          {/* Cloud Provider Tabs */}
          {(['gcp', 'aws', 'azure'] as const).map((provider, idx) => (
            <TabPanel key={provider} value={activeTab} index={idx + 1}>
              <Box sx={{ mb: 3 }}>
                <Button
                  variant="contained"
                  endIcon={<OpenInNewIcon />}
                  href={vmProvisioningSteps[provider].consoleUrl}
                  target="_blank"
                  sx={{
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    textTransform: 'none',
                    mb: 2,
                    '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)' },
                  }}
                >
                  Open {vmProvisioningSteps[provider].name} Console
                </Button>
              </Box>

              <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>
                Step 1: Create a VM
              </Typography>
              <Box
                component="ol"
                sx={{
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '0.875rem',
                  pl: 2.5,
                  mb: 3,
                  '& li': { mb: 1 },
                }}
              >
                {vmProvisioningSteps[provider].steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </Box>

              <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>
                Step 2: Run the Sensor
              </Typography>
              <Box
                sx={{
                  position: 'relative',
                  backgroundColor: 'hsl(var(--muted))',
                  borderRadius: 1.5,
                  border: '1px solid hsl(var(--border))',
                  p: 2,
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'hsl(var(--foreground))',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                  <IconButton
                    onClick={handleCopy}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      '&:hover': { backgroundColor: 'hsl(var(--accent))' },
                    }}
                  >
                    {copied ? (
                      <CheckIcon sx={{ fontSize: 16, color: 'hsl(var(--severity-low))' }} />
                    ) : (
                      <ContentCopyIcon sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }} />
                    )}
                  </IconButton>
                </Tooltip>
                {dockerCommand}
              </Box>

              {!authKey && (
                <Alert 
                  severity="warning" 
                  sx={{ 
                    mt: 2,
                    backgroundColor: 'hsl(var(--severity-medium) / 0.1)',
                    border: '1px solid hsl(var(--severity-medium) / 0.3)',
                    color: 'hsl(var(--foreground))',
                    '& .MuiAlert-icon': { color: 'hsl(var(--severity-medium))' },
                  }}
                >
                  API key not found. Please ensure you're logged in with a valid API key.
                </Alert>
              )}
            </TabPanel>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
