// Shim for the legacy `theme.jsx` from Shuffle Core. The host app already
// installs a full MUI theme via `ShuffleCoreThemeProvider`; this helper
// just returns a compatible theme object so legacy components that call
// `getTheme(themeMode, brandColor)` keep working without a hook.
import { createTheme } from '@mui/material';

export const getTheme = (themeMode: 'light' | 'dark' = 'dark', brandColor: string = '#FF6600') =>
  createTheme({
    palette: {
      mode: themeMode === 'light' ? 'light' : 'dark',
      primary: { main: brandColor },
      secondary: { main: brandColor },
    },
  });

export default getTheme;
