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

// Cloud provider icons
const GCPIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.159-.247 10.848l.006-.007-.007.007a6.62 6.62 0 0 0 5.28 2.63H17.9a6.96 6.96 0 0 0 5.21-2.324 6.94 6.94 0 0 0 .9-8.648 9.343 9.343 0 0 0-11.82-9.4zm0 1.866a7.51 7.51 0 0 1 7.127 5.142l.358 1.067 1.03.435a5.104 5.104 0 0 1-.68 9.483l-.293.064H8.003a4.78 4.78 0 0 1-3.865-1.916 4.737 4.737 0 0 1 .197-5.953l.645-.697-.337-.836a7.463 7.463 0 0 1-.459-2.594A7.51 7.51 0 0 1 12.19 4.246z"/>
  </svg>
);

const AWSIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.256-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.415-.287-.806-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z"/>
  </svg>
);

const AzureIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7L6.105 8.677 0 19.253h5.505v.014L13.23 2.7z"/>
  </svg>
);

const ServerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
    <line x1="6" x2="6.01" y1="6" y2="6"/>
    <line x1="6" x2="6.01" y1="18" y2="18"/>
  </svg>
);

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

// Step item component for better readability
const StepItem = ({ number, children }: { number: number; children: React.ReactNode }) => (
  <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
    <Box
      sx={{
        minWidth: 24,
        height: 24,
        borderRadius: '50%',
        backgroundColor: 'hsl(var(--primary) / 0.15)',
        color: 'hsl(var(--primary))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {number}
    </Box>
    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', lineHeight: 1.6 }}>
      {children}
    </Typography>
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

  const selfHostedSteps = [
    'Log into your VM or server via SSH',
    'Ensure Docker is installed and running',
    'Copy and run the command below',
  ];

  const vmProvisioningSteps = {
    gcp: {
      name: 'Google Cloud',
      icon: <GCPIcon />,
      consoleUrl: 'https://console.cloud.google.com/compute/instancesAdd',
      steps: [
        'Go to Compute Engine → VM Instances',
        'Click "Create Instance"',
        'Choose e2-medium or larger',
        'Select Container Optimized OS or Ubuntu',
        'Allow HTTP/HTTPS traffic if needed',
        'Click "Create" and wait for startup',
        'SSH into the VM',
      ],
    },
    aws: {
      name: 'Amazon Web Services',
      icon: <AWSIcon />,
      consoleUrl: 'https://console.aws.amazon.com/ec2/v2/home#LaunchInstances:',
      steps: [
        'Go to EC2 → Launch Instance',
        'Choose Amazon Linux 2023 or Ubuntu AMI',
        'Select t3.medium or larger',
        'Configure security group for SSH (port 22)',
        'Launch and download the key pair',
        'SSH: ssh -i your-key.pem ec2-user@<ip>',
        'Install Docker: sudo yum install docker -y && sudo systemctl start docker',
      ],
    },
    azure: {
      name: 'Microsoft Azure',
      icon: <AzureIcon />,
      consoleUrl: 'https://portal.azure.com/#create/Microsoft.VirtualMachine',
      steps: [
        'Go to Virtual Machines → Create',
        'Choose Ubuntu Server 22.04 LTS',
        'Select Standard_B2s or larger',
        'Configure SSH public key authentication',
        'Review and create the VM',
        'SSH into the VM using the public IP',
        'Install Docker: sudo apt update && sudo apt install docker.io -y',
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
              minHeight: 48,
              gap: 0.75,
              '&.Mui-selected': {
                color: 'hsl(var(--primary))',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'hsl(var(--primary))',
            },
          }}
        >
          <Tab icon={<ServerIcon />} iconPosition="start" label="Self-Hosted" />
          <Tab icon={<GCPIcon />} iconPosition="start" label="Google Cloud" />
          <Tab icon={<AWSIcon />} iconPosition="start" label="AWS" />
          <Tab icon={<AzureIcon />} iconPosition="start" label="Azure" />
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
            <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>
              Deploy the Sensor
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              {selfHostedSteps.map((step, i) => (
                <StepItem key={i} number={i + 1}>{step}</StepItem>
              ))}
            </Box>
            
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Button
                  variant="contained"
                  startIcon={vmProvisioningSteps[provider].icon}
                  endIcon={<OpenInNewIcon />}
                  href={vmProvisioningSteps[provider].consoleUrl}
                  target="_blank"
                  sx={{
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    textTransform: 'none',
                    '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)' },
                  }}
                >
                  Open {vmProvisioningSteps[provider].name} Console
                </Button>
              </Box>

              <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>
                Create a VM
              </Typography>
              <Box sx={{ mb: 3 }}>
                {vmProvisioningSteps[provider].steps.map((step, i) => (
                  <StepItem key={i} number={i + 1}>{step}</StepItem>
                ))}
              </Box>

              <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>
                Run the Sensor
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
