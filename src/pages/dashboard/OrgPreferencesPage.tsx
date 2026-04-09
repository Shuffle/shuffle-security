import {
  Box,
  Typography,
  Paper,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  ENTITY_OPTIONS,
  setEntityPreference,
  useEntityPreference,
  useShowAutomation,
  setShowAutomation,
  SIDEBAR_TAB_OPTIONS,
  useSidebarTabs,
  setSidebarTabVisibility,
  SidebarTabKey,
} from '@/hooks/useEntityLabel';

const TerminologySelector = () => {
  const { value } = useEntityPreference();
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {ENTITY_OPTIONS.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.plural}
          onClick={() => setEntityPreference(opt.value)}
          variant={value === opt.value ? 'filled' : 'outlined'}
          sx={{
            fontWeight: value === opt.value ? 600 : 400,
            bgcolor: value === opt.value ? 'hsl(var(--primary))' : 'transparent',
            color: value === opt.value ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
            borderColor: 'hsl(var(--border))',
            '&:hover': {
              bgcolor: value === opt.value ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.1)',
            },
          }}
        />
      ))}
    </Box>
  );
};

const SidebarTabsSelector = () => {
  const tabs = useSidebarTabs();

  const handleToggle = (key: SidebarTabKey) => {
    setSidebarTabVisibility({ ...tabs, [key]: !tabs[key] });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {SIDEBAR_TAB_OPTIONS.map((opt) => (
        <FormControlLabel
          key={opt.key}
          control={
            <Switch
              checked={tabs[opt.key]}
              onChange={() => handleToggle(opt.key)}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: 'hsl(var(--primary))',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: 'hsl(var(--primary))',
                },
              }}
            />
          }
          label={
            <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))' }}>
              {opt.label}
            </Typography>
          }
          sx={{ ml: 0 }}
        />
      ))}
    </Box>
  );
};

const OrgPreferencesPage = () => {
  const showAutomation = useShowAutomation();

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: 'hsl(var(--foreground))' }}>
        Org Preferences
      </Typography>
      <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
        Configure organization-wide settings that apply to all users
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Terminology */}
        <Paper
          sx={{
            p: 2.5,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Terminology
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Choose what to call your security work items across the platform
            </Typography>
          </Box>
          <TerminologySelector />
        </Paper>

        {/* Automation Pipeline */}
        <Paper
          sx={{
            p: 2.5,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Automation Pipeline
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Display ingest/forward sources and automation controls on the main page
            </Typography>
          </Box>
          <Chip
            label={showAutomation ? 'Enabled' : 'Disabled'}
            onClick={() => setShowAutomation(!showAutomation)}
            variant="filled"
            sx={{
              fontWeight: 600,
              bgcolor: showAutomation ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
              color: showAutomation ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
              '&:hover': {
                bgcolor: showAutomation ? 'hsl(var(--primary) / 0.9)' : 'hsl(var(--muted) / 0.8)',
              },
            }}
          />
        </Paper>

        {/* Sidebar Tabs */}
        <Paper
          sx={{
            p: 2.5,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Sidebar Navigation
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Show or hide sections in the left sidebar. The main incidents tab is always visible.
            </Typography>
          </Box>
          <SidebarTabsSelector />
        </Paper>
      </Box>
    </Box>
  );
};

export default OrgPreferencesPage;
