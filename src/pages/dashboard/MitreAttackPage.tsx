import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { toast } from 'sonner';

// MITRE ATT&CK Tactics
const TACTICS = [
  { id: 'TA0043', name: 'Reconnaissance', description: 'Gathering information to plan future operations' },
  { id: 'TA0042', name: 'Resource Development', description: 'Establishing resources to support operations' },
  { id: 'TA0001', name: 'Initial Access', description: 'Trying to get into your network' },
  { id: 'TA0002', name: 'Execution', description: 'Trying to run malicious code' },
  { id: 'TA0003', name: 'Persistence', description: 'Trying to maintain their foothold' },
  { id: 'TA0004', name: 'Privilege Escalation', description: 'Trying to gain higher-level permissions' },
  { id: 'TA0005', name: 'Defense Evasion', description: 'Trying to avoid being detected' },
  { id: 'TA0006', name: 'Credential Access', description: 'Trying to steal account names and passwords' },
  { id: 'TA0007', name: 'Discovery', description: 'Trying to figure out your environment' },
  { id: 'TA0008', name: 'Lateral Movement', description: 'Trying to move through your environment' },
  { id: 'TA0009', name: 'Collection', description: 'Trying to gather data of interest' },
  { id: 'TA0011', name: 'Command and Control', description: 'Trying to communicate with compromised systems' },
  { id: 'TA0010', name: 'Exfiltration', description: 'Trying to steal data' },
  { id: 'TA0040', name: 'Impact', description: 'Trying to manipulate, interrupt, or destroy systems and data' },
];

// Sample techniques for demonstration
const SAMPLE_TECHNIQUES: Record<string, Array<{ id: string; name: string; description: string }>> = {
  'TA0001': [
    { id: 'T1566', name: 'Phishing', description: 'Adversaries may send phishing messages to gain access' },
    { id: 'T1190', name: 'Exploit Public-Facing Application', description: 'Adversaries may attempt to exploit a weakness in an Internet-facing host' },
    { id: 'T1133', name: 'External Remote Services', description: 'Adversaries may leverage external-facing remote services' },
    { id: 'T1078', name: 'Valid Accounts', description: 'Adversaries may obtain and abuse credentials of existing accounts' },
  ],
  'TA0002': [
    { id: 'T1059', name: 'Command and Scripting Interpreter', description: 'Adversaries may abuse command and script interpreters' },
    { id: 'T1204', name: 'User Execution', description: 'An adversary may rely upon specific actions by a user' },
    { id: 'T1053', name: 'Scheduled Task/Job', description: 'Adversaries may abuse task scheduling functionality' },
  ],
  'TA0003': [
    { id: 'T1547', name: 'Boot or Logon Autostart Execution', description: 'Adversaries may configure system settings to automatically execute a program' },
    { id: 'T1136', name: 'Create Account', description: 'Adversaries may create an account to maintain access' },
    { id: 'T1543', name: 'Create or Modify System Process', description: 'Adversaries may create or modify system-level processes' },
  ],
  'TA0004': [
    { id: 'T1548', name: 'Abuse Elevation Control Mechanism', description: 'Adversaries may circumvent mechanisms designed to control elevated privileges' },
    { id: 'T1134', name: 'Access Token Manipulation', description: 'Adversaries may modify access tokens' },
  ],
  'TA0005': [
    { id: 'T1070', name: 'Indicator Removal', description: 'Adversaries may delete or modify artifacts generated on a host system' },
    { id: 'T1036', name: 'Masquerading', description: 'Adversaries may attempt to manipulate features of their artifacts' },
    { id: 'T1027', name: 'Obfuscated Files or Information', description: 'Adversaries may attempt to make an executable or file difficult to discover' },
  ],
  'TA0006': [
    { id: 'T1110', name: 'Brute Force', description: 'Adversaries may use brute force techniques to gain access to accounts' },
    { id: 'T1555', name: 'Credentials from Password Stores', description: 'Adversaries may search for common password storage locations' },
    { id: 'T1003', name: 'OS Credential Dumping', description: 'Adversaries may attempt to dump credentials' },
  ],
};

const MitreAttackPage = () => {
  const [selectedTactic, setSelectedTactic] = useState<string>('TA0001');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredTactics = TACTICS.filter(
    (tactic) =>
      tactic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tactic.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const techniques = SAMPLE_TECHNIQUES[selectedTactic] || [];

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success('MITRE ATT&CK data refreshed');
    }, 500);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <AccountTreeIcon sx={{ color: 'hsl(var(--primary))', fontSize: 28 }} />
            <Typography variant="h4" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              MITRE ATT&CK
            </Typography>
          </Box>
          <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Browse and map adversary tactics, techniques, and procedures
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isLoading}
            sx={{
              height: 36,
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              '&:hover': {
                borderColor: 'hsl(var(--border))',
                backgroundColor: 'hsl(var(--muted))',
              },
            }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            endIcon={<OpenInNewIcon />}
            component="a"
            href="https://attack.mitre.org/"
            target="_blank"
            sx={{
              height: 36,
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              '&:hover': {
                borderColor: 'hsl(var(--border))',
                backgroundColor: 'hsl(var(--muted))',
              },
            }}
          >
            MITRE ATT&CK
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search tactics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{
            width: 320,
            '& .MuiOutlinedInput-root': {
              height: 36,
              backgroundColor: 'hsl(var(--muted))',
              '& fieldset': {
                borderColor: 'hsl(var(--border))',
              },
              '&:hover fieldset': {
                borderColor: 'hsl(var(--border))',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'hsl(var(--primary))',
              },
            },
            '& .MuiOutlinedInput-input': {
              color: 'hsl(var(--foreground))',
              '&::placeholder': {
                color: 'hsl(var(--muted-foreground))',
                opacity: 1,
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ 
          backgroundColor: 'hsl(var(--card))', 
          border: '1px solid hsl(var(--border))',
          minWidth: 140,
        }}>
          <CardContent sx={{ py: 2, px: 3, '&:last-child': { pb: 2 } }}>
            <Typography variant="h4" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
              {TACTICS.length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Tactics
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ 
          backgroundColor: 'hsl(var(--card))', 
          border: '1px solid hsl(var(--border))',
          minWidth: 140,
        }}>
          <CardContent sx={{ py: 2, px: 3, '&:last-child': { pb: 2 } }}>
            <Typography variant="h4" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
              {Object.values(SAMPLE_TECHNIQUES).flat().length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Techniques
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tactics Tabs */}
      <Card sx={{ 
        backgroundColor: 'hsl(var(--card))', 
        border: '1px solid hsl(var(--border))',
        borderRadius: 2,
        mb: 3,
      }}>
        <Box sx={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <Tabs
            value={selectedTactic}
            onChange={(_, value) => setSelectedTactic(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                color: 'hsl(var(--muted-foreground))',
                textTransform: 'none',
                minHeight: 48,
                '&.Mui-selected': {
                  color: 'hsl(var(--primary))',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'hsl(var(--primary))',
              },
            }}
          >
            {filteredTactics.map((tactic) => (
              <Tab
                key={tactic.id}
                value={tactic.id}
                label={
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {tactic.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                      {tactic.id}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>

        {/* Selected Tactic Details */}
        <Box sx={{ p: 3 }}>
          {TACTICS.find((t) => t.id === selectedTactic) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ color: 'hsl(var(--foreground))', mb: 1 }}>
                {TACTICS.find((t) => t.id === selectedTactic)?.name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                {TACTICS.find((t) => t.id === selectedTactic)?.description}
              </Typography>
            </Box>
          )}

          {/* Techniques Grid */}
          <Typography variant="subtitle2" sx={{ color: 'hsl(var(--foreground))', mb: 2 }}>
            Techniques ({techniques.length})
          </Typography>
          
          {techniques.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>
                No techniques loaded for this tactic
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
              {techniques.map((technique) => (
                <Card
                  key={technique.id}
                  sx={{
                    backgroundColor: 'hsl(var(--muted))',
                    border: '1px solid hsl(var(--border))',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                    '&:hover': {
                      borderColor: 'hsl(var(--primary))',
                    },
                  }}
                  onClick={() => window.open(`https://attack.mitre.org/techniques/${technique.id}/`, '_blank')}
                >
                  <CardContent sx={{ py: 2, px: 3, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
                        {technique.name}
                      </Typography>
                      <Chip
                        label={technique.id}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          backgroundColor: 'hsl(var(--primary) / 0.15)',
                          color: 'hsl(var(--primary))',
                          border: 'none',
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
                      {technique.description}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </Card>
    </Box>
  );
};

export default MitreAttackPage;
