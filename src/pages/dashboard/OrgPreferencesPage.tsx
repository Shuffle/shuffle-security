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
import { TaskStatusesEditor } from '@/components/settings/TaskStatusesEditor';

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
    const updated = { ...tabs, [key]: !tabs[key] };
    // If disabling a parent, disable all its children too
    if (!updated[key]) {
      SIDEBAR_TAB_OPTIONS.forEach(opt => {
        if (opt.parent === key) {
          updated[opt.key] = false;
        }
      });
    }
    setSidebarTabVisibility(updated);
  };

  // Group items: top-level parents (null parent or 'incidents') with their children
  const sections = [
    {
      title: 'Dashboard',
      alwaysVisible: false,
      key: 'dashboard' as SidebarTabKey,
      children: [],
    },
    {
      title: 'Incidents',
      alwaysVisible: true,
      key: null as SidebarTabKey | null,
      children: SIDEBAR_TAB_OPTIONS.filter(o => o.parent === 'incidents'),
    },
    {
      title: 'Detection',
      alwaysVisible: false,
      key: 'detection' as SidebarTabKey,
      children: SIDEBAR_TAB_OPTIONS.filter(o => o.parent === 'detection'),
    },
    {
      title: 'Automation',
      alwaysVisible: false,
      key: 'automation' as SidebarTabKey,
      children: [],
    },
    {
      title: 'Vulnerabilities',
      alwaysVisible: false,
      key: 'vulnerabilities' as SidebarTabKey,
      children: [],
    },
    {
      title: 'Documentation',
      alwaysVisible: false,
      key: 'documentation' as SidebarTabKey,
      children: [],
    },
  ];

  const switchSx = {
    '& .MuiSwitch-switchBase.Mui-checked': {
      color: 'hsl(var(--primary))',
    },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
      backgroundColor: 'hsl(var(--primary))',
    },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
      {sections.map((section) => {
        const parentDisabled = section.key ? !tabs[section.key] : false;

        return (
          <Box key={section.title}>
            {/* Parent row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: parentDisabled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                }}
              >
                {section.title}
              </Typography>
              {section.alwaysVisible ? (
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
                  Always visible
                </Typography>
              ) : section.key ? (
                <Switch
                  checked={tabs[section.key]}
                  onChange={() => handleToggle(section.key!)}
                  size="small"
                  sx={switchSx}
                />
              ) : null}
            </Box>

            {/* Children */}
            {section.children.length > 0 && (
              <Box sx={{ ml: 2.5, mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {section.children.map((child) => (
                  <FormControlLabel
                    key={child.key}
                    disabled={parentDisabled}
                    control={
                      <Switch
                        checked={!parentDisabled && tabs[child.key]}
                        onChange={() => handleToggle(child.key)}
                        size="small"
                        disabled={parentDisabled}
                        sx={switchSx}
                      />
                    }
                    label={
                      <Typography
                        variant="body2"
                        sx={{
                          color: parentDisabled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                          opacity: parentDisabled ? 0.5 : 1,
                        }}
                      >
                        {child.label}
                      </Typography>
                    }
                    sx={{ ml: 0 }}
                  />
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

const OrgPreferencesPage = () => {
  const showAutomation = useShowAutomation();

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: 'hsl(var(--foreground))' }}>
        Tenant Preferences
      </Typography>
      <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
        Configure tenant-wide settings that apply to all users
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
            flexDirection: 'column',
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

        {/* Task Statuses (kanban lanes) */}
        <Paper
          sx={{
            p: 2.5,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Task Statuses
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Configure the kanban lanes for incident tasks. Drag to reorder, click the swatch to recolor.
              The "Done" lane is required and represents completed tasks.
            </Typography>
          </Box>
          <TaskStatusesEditor />
        </Paper>
      </Box>
    </Box>
  );
};

export default OrgPreferencesPage;
