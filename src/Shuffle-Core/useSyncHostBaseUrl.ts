/**
 * useSyncHostBaseUrl — top-level Shuffle-MCPs components call this with the
 * host-injected `globalUrl` from `ShuffleHostProps`. The hook registers the
 * URL with `setHostBaseUrl` so EVERY internal fetch (including hooks like
 * `useAppLookup` and helpers like `appsCache`, which talk to `getApiUrl()`)
 * automatically targets the host's backend instead of the bundled default.
 *
 * Safe to call multiple times — the latest non-empty value wins, and
 * unmounting does NOT clear the override (so deeper components keep working
 * after a top-level remount).
 */
import { useEffect } from 'react';
import { setHostBaseUrl } from './api';

export const useSyncHostBaseUrl = (globalUrl: string | undefined | null) => {
  useEffect(() => {
    if (!globalUrl) return;
    setHostBaseUrl(globalUrl);
  }, [globalUrl]);
};
