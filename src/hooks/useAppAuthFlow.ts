/**
 * useAppAuthFlow — Shared hook for the search→authenticate flow.
 * Encapsulates fetching auth entries, saving credentials, and testing connections.
 * Used by AddAppModal, AppSearchDrawer, and anywhere else that needs app auth.
 */

import { useState, useCallback } from 'react';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
import type { AppAuthState, ApiAuthEntry } from '@/components/onboarding/AppAuthConfig';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';

export function useAppAuthFlow() {
  const [selectedApp, setSelectedApp] = useState<AlgoliaSearchApp | null>(null);
  const [authState, setAuthState] = useState<AppAuthState>({
    systemId: '',
    status: 'pending',
    credentials: {},
  });
  const [authenticatedApps, setAuthenticatedApps] = useState<ApiAuthEntry[]>([]);
  const [authLoading, setAuthLoading] = useState(false);

  const fetchAuthForApp = useCallback(async (appName: string) => {
    if (!API_CONFIG.apiKey) return;
    setAuthLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/v1/apps/authentication'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (response.ok) {
        const result = await response.json();
        const authData = result.data || result;
        if (Array.isArray(authData)) {
          const appEntries = authData.filter(
            (a: ApiAuthEntry) => a.app?.name?.toLowerCase() === appName.toLowerCase()
          );
          setAuthenticatedApps(appEntries);
        }
      }
    } catch (err) {
      console.error('Failed to fetch auth entries:', err);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const selectApp = useCallback((app: AlgoliaSearchApp) => {
    setSelectedApp(app);
    setAuthState({ systemId: app.objectID, status: 'pending', credentials: {} });
    fetchAuthForApp(app.name);
  }, [fetchAuthForApp]);

  const clearSelection = useCallback(() => {
    setSelectedApp(null);
    setAuthState({ systemId: '', status: 'pending', credentials: {} });
    setAuthenticatedApps([]);
  }, []);

  const handleAuthChange = useCallback((_appId: string, credentials: Record<string, string>) => {
    setAuthState(prev => ({ ...prev, credentials }));
  }, []);

  const handleTestConnection = useCallback(async (systemId: string, authenticationId?: string) => {
    if (!selectedApp) return;
    setAuthState(prev => ({ ...prev, status: 'testing' }));

    try {
      const requestBody: Record<string, string | boolean> = {
        action: 'test_api',
        app: selectedApp.name.toLowerCase(),
        skip_workflow: true,
      };
      if (authenticationId) requestBody.authentication_id = authenticationId;

      const response = await fetch(getApiUrl('/api/v1/apps/categories/run'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
          'Accept-Encoding': 'identity',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      const validActions = ['done', 'app_validation'];
      const isValid = response.ok && validActions.includes(result.action) && result.success === true;

      await fetchAuthForApp(selectedApp.name);

      setAuthState(prev => ({
        ...prev,
        status: isValid ? 'connected' : 'error',
        successMessage: isValid ? 'Connection verified' : undefined,
        errorMessage: isValid ? undefined : (result.reason || 'Connection failed. Please check your credentials.'),
      }));
    } catch (err) {
      setAuthState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Connection test failed.',
      }));
    }
  }, [selectedApp, fetchAuthForApp]);

  const handleSaveAuth = useCallback(async (appId: string, credentials: Record<string, string>): Promise<boolean> => {
    if (!selectedApp) return false;

    const fields = Object.entries(credentials)
      .filter(([key, value]) => key?.trim() && value?.trim())
      .map(([key, value]) => ({ key, value }));

    const payload = {
      label: `Auth for ${selectedApp.name.replace(/_/g, ' ')}`,
      app: {
        name: selectedApp.name,
        id: selectedApp.objectID,
        app_version: '1.0.0',
      },
      fields,
      active: true,
    };

    try {
      const response = await fetch(getApiUrl('/api/v1/apps/authentication'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok && result.success !== false) {
        await fetchAuthForApp(selectedApp.name);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [selectedApp, fetchAuthForApp]);

  return {
    selectedApp,
    authState,
    authenticatedApps,
    authLoading,
    selectApp,
    clearSelection,
    handleAuthChange,
    handleTestConnection,
    handleSaveAuth,
  };
}
