// Shim for the legacy `context/ContextApi.jsx` from Shuffle Core. The host
// app drives theming/brand through `ShuffleCoreThemeProvider` and auth via
// `@/context/AuthContext`; this Context just supplies sensible defaults for
// legacy components (Billing, LicencePopup, ...) that still read it.
import { createContext } from 'react';

export interface ShuffleCoreContextValue {
  themeMode: 'light' | 'dark';
  brandColor: string;
  supportEmail: string;
}

export const Context = createContext<ShuffleCoreContextValue>({
  themeMode: 'dark',
  brandColor: '#FF6600',
  supportEmail: 'support@shuffler.io',
});

export default Context;
