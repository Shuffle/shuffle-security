import { createTheme } from '@mui/material/styles';

const getCommon = () => ({
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' as const },
  },
  shape: { borderRadius: 8 },
});

const getComponents = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';
  const border = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const cardBg = isDark
    ? 'linear-gradient(145deg, #262626 0%, #1f1f1f 100%)'
    : 'linear-gradient(145deg, #ffffff 0%, #f8f8f8 100%)';
  const drawerBg = 'hsl(var(--sidebar-background))';
  const tooltipBg = isDark ? '#111111' : '#ffffff';
  const tooltipColor = isDark ? '#ffffff' : '#1a1a1a';
  const tableHeadBg = isDark ? 'rgba(33, 33, 33, 0.5)' : 'rgba(245, 245, 245, 0.8)';
  const appBarBg = isDark ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)';

  return {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '10px 24px', fontWeight: 600 },
        containedPrimary: {
          background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
          boxShadow: '0 4px 14px rgba(255, 102, 0, 0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg, #FF8533 0%, #FF9955 100%)',
            boxShadow: '0 6px 20px rgba(255, 102, 0, 0.35)',
          },
        },
        outlined: {
          borderColor: 'rgba(255, 102, 0, 0.5)',
          '&:hover': {
            borderColor: '#FF6600',
            backgroundColor: 'rgba(255, 102, 0, 0.08)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: cardBg, borderRadius: 12, border: `1px solid ${border}` },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiAppBar: {
      styleOverrides: { root: { backgroundColor: appBarBg, backdropFilter: 'blur(12px)' } },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: drawerBg, borderRight: '1px solid hsl(var(--sidebar-border))' } },
    },
    MuiDialog: {
      styleOverrides: { paper: { backgroundImage: cardBg, border: `1px solid ${border}` } },
    },
    MuiMenu: {
      styleOverrides: { paper: { backgroundImage: cardBg, border: `1px solid ${border}` } },
    },
    MuiPopover: {
      styleOverrides: { paper: { backgroundImage: cardBg, border: `1px solid ${border}` } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${border}` },
        head: { fontWeight: 600, backgroundColor: tableHeadBg },
      },
    },
    MuiTooltip: {
      defaultProps: {
        // Tooltips render via a Popper portal at MUI's default tooltip
        // z-index (1500). Drawers / Dialogs in this app frequently sit
        // above that (we use 9999 for in-Dialog popovers per project
        // convention), which left tooltips rendering UNDER the panel
        // that owns the trigger. Bumping the popper z-index here fixes
        // every tooltip globally without per-call overrides.
        slotProps: {
          popper: { sx: { zIndex: 10000 } },
        },
      },
      styleOverrides: {
        tooltip: {
          backgroundColor: tooltipBg,
          color: tooltipColor,
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          fontSize: '0.75rem',
          maxWidth: 280,
        },
        arrow: { color: tooltipBg },
      },
    },
  };
};

export const createMuiTheme = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';
  return createTheme({
    ...getCommon(),
    palette: {
      mode,
      primary: { main: '#FF6600', light: '#FF8533', dark: '#CC5200', contrastText: '#ffffff' },
      secondary: { main: '#64748b', light: '#94a3b8', dark: '#475569' },
      error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
      warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
      success: { main: '#22c55e', light: '#4ade80', dark: '#16a34a' },
      info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
      background: {
        default: isDark ? '#1a1a1a' : '#fafafa',
        paper: isDark ? '#212121' : '#ffffff',
      },
      text: {
        primary: isDark ? '#ffffff' : '#1a1a1a',
        secondary: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
        disabled: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
      },
      divider: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    },
    components: getComponents(mode),
  });
};

// Default export for backward compat
export const muiTheme = createMuiTheme('dark');
