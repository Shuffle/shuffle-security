import { ArrowRight as ArrowForwardIcon, ArrowLeft as ArrowBackIcon, CheckCircle as CheckCircleOutlineIcon, Hand as WavingHandIcon, Link as LinkIcon, Key as VpnKeyIcon, Rocket as RocketLaunchIcon } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { TicketingSystemSearch } from '@/components/onboarding/TicketingSystemSearch';
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';
import { UnifiedSourceSetup } from '@/components/onboarding/UnifiedSourceSetup';
import type { AlgoliaSearchApp } from '@/Shuffle-MCPs';
import { AppAuthConfig, AppAuthState, AuthStatus } from '@/Shuffle-MCPs/AppAuthConfig';
import { AutomationConfig, EnrichmentState } from '@/components/onboarding/AutomationConfig';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { setDatastoreItem, getDatastoreItem } from '@/Shuffle-MCPs/datastore';
import {
  isEmailApp, isIngestionApp, isThreatIntelApp,
} from '@/Shuffle-MCPs/ingestionDetection';
import { findIngestTicketsWorkflow, findForwardTicketsWorkflow, extractWorkflowAppNames } from '@/Shuffle-MCPs/ingestionDetection';
import { trackOnboardingStep, trackPredefinedEvent, GA_EVENTS } from '@/lib/analytics';
import { refreshAllIntegrationStatus } from '@/Shuffle-MCPs/IntegrationStatus';
import { usePageMeta } from '@/hooks/usePageMeta';

// Datastore category for onboarding config (using shuffle-security_ prefix for consistency)
const ONBOARDING_CONFIG_CATEGORY = 'shuffle-security_onboarding';
const SELECTED_TOOLS_KEY = 'selected_tools';
const AUTOMATION_CONFIG_KEY = 'automation_config';

// Type for authenticated apps from API
interface ApiAuthEntry {
  id?: string;
  label?: string;
  app: {
    id: string;
    name: string;
    large_image?: string;
  };
  active?: boolean;
  validation?: {
    valid: boolean;
    error?: string;
    last_valid?: number;
  };
}

// Helper to process auth data and invalidate entries older than 30 days
const processAuthData = (authData: ApiAuthEntry[]): ApiAuthEntry[] => {
  const thirtyDaysAgoMs = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  return authData.map(entry => {
    if (entry.validation?.valid === true && entry.validation?.last_valid) {
      const lastValidMs = entry.validation.last_valid > 1e12 
        ? entry.validation.last_valid 
        : entry.validation.last_valid * 1000;
      
      if (lastValidMs < thirtyDaysAgoMs) {
        // Invalidate entries older than 30 days
        return {
          ...entry,
          validation: {
            ...entry.validation,
            valid: false,
            error: 'Validation expired (older than 30 days)',
          },
        };
      }
    }
    return entry;
  });
};

// All possible steps (Welcome is conditional)
const ALL_STEPS = [
  { key: 'welcome', label: 'Welcome', icon: <WavingHandIcon />, path: '/onboarding' },
  { key: 'sources', label: 'Sources', icon: <LinkIcon />, path: '/onboarding/sources' },
  { key: 'authenticate', label: 'Authenticate', icon: <VpnKeyIcon />, path: '/onboarding/authenticate' },
  { key: 'automate', label: 'Automate', icon: <RocketLaunchIcon />, path: '/onboarding/automate' },
];

const OnboardingPage = () => {

  usePageMeta({
    title: 'Onboarding',
    description: 'Set up your Shuffle Security workspace. Connect data sources, authenticate apps, and enable automation.',
    url: '/onboarding',
  });
  const navigate = useNavigate();
  const location = useLocation();
  
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<AlgoliaSearchApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('email');
  const [authStates, setAuthStates] = useState<Record<string, AppAuthState>>({});
  const [authenticatedApps, setAuthenticatedApps] = useState<ApiAuthEntry[]>([]);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [selectedToolsLoaded, setSelectedToolsLoaded] = useState(false);
  const [enrichmentState, setEnrichmentState] = useState<EnrichmentState>({
    automatic_ingestion: { enabled: true, config: {} },
    integration_search: { enabled: true, config: {} },
    threat_intel: { enabled: true, config: {} },
    email_notify: { enabled: true, config: {} },
    chat_notify: { enabled: true, config: {} },
  });
  const [workflowAppNames, setWorkflowAppNames] = useState<Set<string> | undefined>(undefined);
  const [forwardWorkflowAppNames, setForwardWorkflowAppNames] = useState<Set<string> | undefined>(undefined);

  // Per-org localStorage key for welcome completion
  const getWelcomeCompletedKey = () => {
    try {
      const userInfo = localStorage.getItem('shuffle_user_info');
      if (userInfo) {
        const parsed = JSON.parse(userInfo);
        const orgId = parsed.active_org?.id;
        if (orgId) return `shuffle_onboarding_welcome_done_${orgId}`;
      }
    } catch { /* ignore */ }
    return 'shuffle_onboarding_welcome_done';
  };

  const isWelcomeCompleted = () => localStorage.getItem(getWelcomeCompletedKey()) === 'true';
  const markWelcomeCompleted = () => localStorage.setItem(getWelcomeCompletedKey(), 'true');

  // Compute whether to show Welcome (hide if any app is configured OR already completed)
  const hasConfiguredApps = authenticatedApps.some(a => a.active);
  const [welcomeDone, setWelcomeDone] = useState(() => isWelcomeCompleted());

  const hideWelcome = hasConfiguredApps || welcomeDone;

  // Compute dynamic steps
  const steps = useMemo(() => {
    if (hideWelcome) {
      return ALL_STEPS.filter(s => s.key !== 'welcome');
    }
    return ALL_STEPS;
  }, [hideWelcome]);

  // Build path-to-key and key-to-path mappings
  const pathToKey = useMemo(() => {
    const map: Record<string, string> = {};
    steps.forEach(s => { map[s.path] = s.key; });
    // /onboarding always maps to first step
    map['/onboarding'] = steps[0]?.key || 'sources';
    return map;
  }, [steps]);

  // Derive active step KEY from URL (stable, not index-based)
  const getKeyFromPath = (pathname: string) => pathToKey[pathname] || steps[0]?.key || 'sources';

  const [activeStepKey, setActiveStepKey] = useState(() => getKeyFromPath(location.pathname));

  // Derived index for rendering (computed, never set directly)
  const activeStep = useMemo(() => {
    const idx = steps.findIndex(s => s.key === activeStepKey);
    return idx >= 0 ? idx : 0;
  }, [activeStepKey, steps]);

  // Single useEffect: sync URL ↔ step key without circular fighting
  useEffect(() => {
    const currentStep = steps.find(s => s.key === activeStepKey);
    if (currentStep && location.pathname !== currentStep.path) {
      // Step key changed → update URL
      navigate(currentStep.path, { replace: true });
    } else if (!currentStep || location.pathname !== currentStep.path) {
      // URL changed (browser back/forward) → update key
      const keyFromPath = getKeyFromPath(location.pathname);
      if (keyFromPath !== activeStepKey) {
        setActiveStepKey(keyFromPath);
      }
    }
  }, [activeStepKey, location.pathname]);

  // Redirect /onboarding to first real step when Welcome is hidden
  useEffect(() => {
    if (authLoaded && hideWelcome && location.pathname === '/onboarding') {
      navigate(steps[0].path, { replace: true });
    }
  }, [authLoaded, hideWelcome]);

  // Mark welcome done when auth loads and apps are configured
  useEffect(() => {
    if (authLoaded && hasConfiguredApps && !welcomeDone) {
      markWelcomeCompleted();
      setWelcomeDone(true);
    }
  }, [authLoaded, hasConfiguredApps]);

  // Load saved config from datastore on mount
  useEffect(() => {
    const loadSavedConfig = async () => {
      
      try {
        // Load selected tools
        const toolsResponse = await getDatastoreItem(SELECTED_TOOLS_KEY, ONBOARDING_CONFIG_CATEGORY);
        if (toolsResponse.success && toolsResponse.item?.value) {
          const savedTools = typeof toolsResponse.item.value === 'string' 
            ? JSON.parse(toolsResponse.item.value) 
            : toolsResponse.item.value;
          if (Array.isArray(savedTools) && savedTools.length > 0) {
            setSelectedApps(savedTools);
          }
        }
        
        // Load automation config
        const automationResponse = await getDatastoreItem(AUTOMATION_CONFIG_KEY, ONBOARDING_CONFIG_CATEGORY);
        if (automationResponse.success && automationResponse.item?.value) {
          const savedConfig = typeof automationResponse.item.value === 'string'
            ? JSON.parse(automationResponse.item.value)
            : automationResponse.item.value;
          if (savedConfig && typeof savedConfig === 'object') {
            setEnrichmentState(prev => ({ ...prev, ...savedConfig }));
          }
        }
      } catch (error) {
        console.error('Failed to load saved config:', error);
      } finally {
        setSelectedToolsLoaded(true);
      }
    };
    
    loadSavedConfig();
  }, []);

  useEffect(() => {
    if (!selectedToolsLoaded) return;

    setDatastoreItem(SELECTED_TOOLS_KEY, selectedApps, ONBOARDING_CONFIG_CATEGORY)
      .catch(error => console.error('Failed to persist selected tools:', error));
  }, [selectedToolsLoaded, selectedApps]);

  // Fetch authenticated apps from API
  const fetchAuthenticatedApps = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl('/api/v1/apps/authentication'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });
      if (response.ok) {
        const result = await response.json();
        const authData = result.data || result;
        if (Array.isArray(authData)) {
          const processed = processAuthData(authData);
          const { deduplicateAuthApps, backfillAppImages } = await import('@/lib/utils');
          const deduped = deduplicateAuthApps(processed);
          await backfillAppImages(deduped);
          const imageMap = new Map<string, string>();
          deduped.forEach(d => {
            if (d.bestImage) imageMap.set(d.app.name.toLowerCase().replace(/[\s_\-]+/g, '_'), d.bestImage);
          });
          processed.forEach(entry => {
            if (!entry.app.large_image) {
              const norm = entry.app.name.toLowerCase().replace(/[\s_\-]+/g, '_');
              const img = imageMap.get(norm);
              if (img) entry.app.large_image = img;
            }
          });
          setAuthenticatedApps(processed);
        }
      }
    } catch (error) {
      console.error('Failed to fetch authenticated apps:', error);
    } finally {
      setAuthLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchAuthenticatedApps();
  }, [fetchAuthenticatedApps]);

  // Fetch workflows to derive ingestion enabled state (workflows are the source of truth)
  useEffect(() => {
    const fetchWorkflows = async () => {
      
      try {
        const response = await fetch(getApiUrl('/api/v1/workflows'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (response.ok) {
          const data = await response.json();
          const workflowList = Array.isArray(data) ? data : (data.workflows || []);
          const ingestWorkflow = findIngestTicketsWorkflow(workflowList);
          if (ingestWorkflow) {
            setWorkflowAppNames(extractWorkflowAppNames(ingestWorkflow));
          }
          const forwardWorkflow = findForwardTicketsWorkflow(workflowList);
          if (forwardWorkflow) {
            setForwardWorkflowAppNames(extractWorkflowAppNames(forwardWorkflow));
          }
        }
      } catch (error) {
        console.error('Failed to fetch workflows:', error);
      }
    };
    fetchWorkflows();
  }, []);

  // Sync enrichmentState.automatic_ingestion.enabled with workflow existence
  useEffect(() => {
    if (workflowAppNames && workflowAppNames.size > 0) {
      setEnrichmentState(prev => {
        if (prev.automatic_ingestion?.enabled) return prev; // already enabled
        return {
          ...prev,
          automatic_ingestion: { ...prev.automatic_ingestion, enabled: true },
        };
      });
    }
  }, [workflowAppNames]);

  const handleNext = async () => {
    if (activeStep === steps.length - 1) {
      const connectedApps = selectedApps.filter(
        (app) => authStates[app.objectID]?.status === 'connected'
      );
      localStorage.setItem('connected_integrations', JSON.stringify(connectedApps));
      trackPredefinedEvent(GA_EVENTS.ONBOARDING_COMPLETE, undefined, connectedApps.length);

      // Generate the ingestion workflow and webhook workflow in parallel
      const appNames = selectedApps.map(app => app.name).join(',');
      await Promise.allSettled([
        fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'Ingest Tickets',
            app_name: appNames,
            category: 'cases',
          }),
        }),
        fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'Ingest Tickets_webhook',
          }),
        }),
      ]);

      navigate('/dashboard?autoSync=1');
    } else {
      const nextStep = activeStep + 1;
      trackOnboardingStep(nextStep, steps[nextStep].label);
      setActiveStepKey(steps[nextStep].key);
      
      // Mark welcome as completed when leaving it
      if (steps[activeStep].key === 'welcome') {
        markWelcomeCompleted();
        setWelcomeDone(true);
      }
      
      const currentKey = steps[activeStep].key;
      
      // When moving from Sources to Authentication
      if (currentKey === 'sources' && selectedApps.length > 0) {
        setDatastoreItem(SELECTED_TOOLS_KEY, selectedApps, ONBOARDING_CONFIG_CATEGORY)
          .catch(error => console.error('Failed to save tools:', error));
        
        const appNames = selectedApps.map(app => app.name).join(',');
        fetch(getApiUrl('/api/v2/workflows/generate'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            label: 'Ingest Tickets',
            app_name: appNames,
            category: 'cases',
          }),
        }).catch(error => console.error('Failed to generate workflow:', error));
      }
      
      // When moving from Automate to Summary
      if (currentKey === 'automate') {
        setDatastoreItem(AUTOMATION_CONFIG_KEY, enrichmentState, ONBOARDING_CONFIG_CATEGORY)
          .then(() => console.log('Automation config saved'))
          .catch(error => console.error('Failed to save automation config:', error));
      }
    }
  };

  const handleBack = () => {
    setActiveStepKey(steps[activeStep - 1].key);
  };

  const handleAuthChange = (systemId: string, credentials: Record<string, string>) => {
    setAuthStates((prev) => ({
      ...prev,
      [systemId]: {
        systemId,
        status: 'pending' as AuthStatus,
        credentials,
      },
    }));
  };

  const handleTestConnection = async (systemId: string, authenticationId?: string) => {
    // Find the app info from selected apps, or fall back to authenticated apps
    // (inline auth on Automate page uses ConnectedApp.id which may not be in selectedApps)
    const app = selectedApps.find(a => a.objectID === systemId);
    const authApp = !app ? authenticatedApps.find(a => a.app?.id === systemId || a.app?.name === systemId) : null;
    const appName = app?.name?.toLowerCase() || authApp?.app?.name?.toLowerCase() || systemId;

    setAuthStates((prev) => ({
      ...prev,
      [systemId]: {
        ...prev[systemId],
        status: 'testing' as AuthStatus,
      },
    }));

    try {
      // Build request body with optional authentication_id
      const requestBody: Record<string, string | boolean> = {
        action: 'test_api',
        app: appName,
        skip_workflow: true,
      };
      
      if (authenticationId) {
        requestBody.authentication_id = authenticationId;
      }

      // Call API to test the connection
      // Note: Accept-Encoding: identity helps avoid HTTP/2 compression errors with some proxies
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
      
      // Validate all three conditions for success:
      // 1. action === "done"
      // 2. success === true
      // 3. result contains valid status (parsed from JSON string)
      let isValid = false;
      let errorMessage = 'Failed to connect. Please check your credentials.';
      let successMessage = '';
      let warningMessage = '';
      let parsedStatus = '';
      let errorCode: number | undefined; // Track 401/403 for credential errors
      let workflowId = result.workflow_id || '';
      let executionId = result.execution_id || '';
      
      // Helper to parse result or raw_response field
      const parseResultData = (data: any) => {
        // Try result field first, then fall back to raw_response
        const rawData = data.result || data.raw_response;
        if (!rawData) return null;
        try {
          return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        } catch {
          return null;
        }
      };

      // Helper to get human-readable error descriptions for HTTP status codes
      const getStatusDescription = (status: number | string): string => {
        const statusDescriptions: Record<number, string> = {
          400: 'Bad Request – The request was malformed or missing required parameters',
          401: 'Unauthorized – Invalid or expired API key/credentials',
          403: 'Forbidden – Access denied. Check your permissions',
          404: 'Not Found – The API endpoint or resource doesn\'t exist',
          405: 'Method Not Allowed – This HTTP method is not supported',
          408: 'Request Timeout – The server took too long to respond',
          429: 'Too Many Requests – Rate limit exceeded. Try again later',
          500: 'Internal Server Error – Something went wrong on the server',
          502: 'Bad Gateway – The server received an invalid response',
          503: 'Service Unavailable – The service is temporarily down',
          504: 'Gateway Timeout – The server didn\'t respond in time',
        };
        const num = Number(status);
        if (statusDescriptions[num]) return statusDescriptions[num];
        if (num >= 400 && num < 500) return 'Client Error – Check your request parameters';
        if (num >= 500 && num < 600) return 'Server Error – The remote service may be unavailable';
        return '';
      };

      // Accept both 'done' and 'app_validation' as valid action types
      const validActions = ['done', 'app_validation'];
      if (response.ok && validActions.includes(result.action) && result.success === true) {
        try {
          // Parse the result field (or raw_response as fallback)
          const resultData = parseResultData(result);
          
          // Generic check for "error" field in response body (e.g., Slack returns 200 OK with error in body)
          const hasErrorInBody = resultData && (
            resultData.error !== undefined || 
            resultData.ok === false ||
            (typeof resultData === 'object' && 'error' in resultData)
          );
          
          if (hasErrorInBody) {
            // API returned 200 but has error in body - this is a cautionary success
            const errorDetail = resultData.error || resultData.reason || 'unknown error in response';
            isValid = true; // Still mark as valid since HTTP was successful
            successMessage = `Connection likely working, but API returned an error: ${typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail)}`;
            // Set a warning flag for UI to show cautionary styling
            warningMessage = 'The API responded successfully but included an error field. This may indicate partial functionality or incorrect credentials.';
          } else if (resultData && resultData.status) {
            // Check if status exists in the parsed result
            parsedStatus = resultData.status;
            // Consider success if status indicates OK (common patterns: 200, ok, success, healthy, etc.)
            const statusLower = String(parsedStatus).toLowerCase();
            const statusNum = Number(parsedStatus);

            // Check for explicit failure statuses first (4xx, 5xx HTTP codes)
            const isErrorStatus = (statusNum >= 400 && statusNum < 600) ||
                                  statusLower === 'error' ||
                                  statusLower === 'failed' ||
                                  statusLower === 'unauthorized' ||
                                  statusLower === 'forbidden';
            
            // Track credential errors (401/403) for special handling
            const isCredentialError = statusNum === 401 || statusNum === 403 ||
                                      statusLower === 'unauthorized' || statusLower === 'forbidden';
            if (isCredentialError) {
              errorCode = statusNum || (statusLower === 'unauthorized' ? 401 : 403);
            }
            
            const isGoodStatus = !isErrorStatus && (
                                 statusLower === 'ok' || 
                                 statusLower === 'success' || 
                                 statusLower === 'healthy' ||
                                 statusLower === 'connected' ||
                                 statusLower === '200' ||
                                 statusNum === 200);
            
            if (isErrorStatus) {
              // Explicit failure - include human-readable description and reason from parsed result
              const statusDesc = getStatusDescription(parsedStatus);
              const reason = resultData.reason ? ` • ${resultData.reason}` : '';
              errorMessage = statusDesc 
                ? `${statusDesc}${reason}`
                : `Connection failed • Status: ${parsedStatus}${reason}`;
            } else if (isGoodStatus) {
              isValid = true;
              successMessage = `Connection verified • Status: ${parsedStatus}`;
            } else {
              // Unknown status - treat as error to be safe
              const statusDesc = getStatusDescription(parsedStatus);
              const reason = resultData.reason ? ` • ${resultData.reason}` : '';
              errorMessage = statusDesc 
                ? `${statusDesc}${reason}`
                : `Connection failed • Unexpected status: ${parsedStatus}${reason}`;
            }
          } else if (resultData && resultData.success !== undefined) {
            // Fallback: check success field in parsed data
            if (resultData.success === true) {
              isValid = true;
              successMessage = 'Connection verified';
            } else {
              const reason = resultData.reason ? ` • ${resultData.reason}` : '';
              errorMessage = `Connection failed – The API returned an error${reason}`;
            }
          } else {
            errorMessage = 'Connection failed – The response was missing expected fields. The API may have changed or be misconfigured.';
          }
        } catch (parseError) {
          console.error('Failed to parse result:', parseError);
          errorMessage = 'Connection failed – Unable to parse the server response. The API may be returning an unexpected format.';
        }
      } else {
        // Build error message from response
        // FIRST: Check top-level status field (e.g., {"success":false,"status":401,...})
        if (result.status !== undefined) {
          const topLevelStatus = result.status;
          const statusNum = Number(topLevelStatus);
          const statusLower = String(topLevelStatus).toLowerCase();
          
          // Track credential errors (401/403) for special handling
          const isTopLevelCredentialError = statusNum === 401 || statusNum === 403 ||
                                            statusLower === 'unauthorized' || statusLower === 'forbidden';
          if (isTopLevelCredentialError) {
            errorCode = statusNum || (statusLower === 'unauthorized' ? 401 : 403);
          }
          
          const statusDesc = getStatusDescription(topLevelStatus);
          // Try to get more details from output.error if present
          const outputError = result.output?.error?.message || result.output?.error?.code || '';
          const reason = outputError ? ` • ${outputError}` : '';
          errorMessage = statusDesc 
            ? `${statusDesc}${reason}`
            : `Connection failed • Status: ${topLevelStatus}${reason}`;
        } else if (!validActions.includes(result.action)) {
          errorMessage = `Connection failed – Received unexpected response type "${result.action || 'unknown'}". This may indicate a configuration issue.`;
        } else if (result.success !== true) {
          // Try to parse the result field (or raw_response) for detailed error info
          let parsedReason = '';
          const resultData = parseResultData(result);
          if (resultData) {
            if (resultData.reason) {
              parsedReason = resultData.reason;
            } else if (resultData.status) {
              // Apply human-readable description for status codes in error path too
              const statusDesc = getStatusDescription(resultData.status);
              parsedReason = statusDesc || `Status: ${resultData.status}`;
              
              // Also check for credential errors in parsed data
              const nestedStatusNum = Number(resultData.status);
              if (nestedStatusNum === 401 || nestedStatusNum === 403) {
                errorCode = nestedStatusNum;
              }
            }
          } else if (typeof result.result === 'string') {
            // If parsing fails, use result as-is if it's a string
            parsedReason = result.result;
          } else if (typeof result.raw_response === 'string') {
            parsedReason = result.raw_response;
          }
          errorMessage = parsedReason || result.reason || result.error || 'Connection failed – The test was unsuccessful. Please verify your credentials and try again.';
        }
      }
      
      // Refresh authenticated apps list before updating UI state
      // Validation happens in background, so API response is the source of truth
      let refreshedAuthData: typeof authenticatedApps = [];
      try {
        const authResponse = await fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (authResponse.ok) {
          const authResult = await authResponse.json();
          const authData = authResult.data || authResult;
          if (Array.isArray(authData)) {
            refreshedAuthData = processAuthData(authData);
            setAuthenticatedApps(refreshedAuthData);
            refreshAllIntegrationStatus();
          }
        }
      } catch (refreshError) {
        console.error('Failed to refresh auth status:', refreshError);
      }

      // Check if the specific tested auth is now valid in the refreshed data
      const testedAuthEntry = refreshedAuthData.find(auth => auth.id === authenticationId);
      const isNowValid = testedAuthEntry?.validation?.valid === true;

      // Track auth test result
      const finalSuccess = isValid || isNowValid;
      trackPredefinedEvent(
        finalSuccess ? GA_EVENTS.ONBOARDING_AUTH_TEST_SUCCESS : GA_EVENTS.ONBOARDING_AUTH_TEST_FAILURE,
        appName,
        errorCode,
      );

      // Update UI state based on both test result and refreshed data
      setAuthStates((prev) => ({
        ...prev,
        [systemId]: {
          ...prev[systemId],
          status: finalSuccess ? 'connected' : 'error',
          errorMessage: finalSuccess ? undefined : errorMessage,
          successMessage: finalSuccess ? (successMessage || 'Connection verified') : undefined,
          warningMessage: finalSuccess ? warningMessage : undefined,
          workflowId: finalSuccess ? undefined : workflowId,
          executionId: finalSuccess ? undefined : executionId,
          errorCode: finalSuccess ? undefined : errorCode,
        },
      }));
    } catch (error) {
      console.error('Test connection failed:', error);
      
      // Wait a few seconds for background validation to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Refresh auth list to check if background validation succeeded
      let refreshedAuthData: typeof authenticatedApps = [];
      try {
        const authResponse = await fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (authResponse.ok) {
          const authResult = await authResponse.json();
          const authData = authResult.data || authResult;
          if (Array.isArray(authData)) {
            refreshedAuthData = processAuthData(authData);
            setAuthenticatedApps(refreshedAuthData);
            refreshAllIntegrationStatus();
          }
        }
      } catch (refreshError) {
        console.error('Failed to refresh auth status:', refreshError);
      }

      // Check if the specific tested auth is now valid despite the fetch error
      const testedAuthEntry = refreshedAuthData.find(auth => auth.id === authenticationId);
      const isNowValid = testedAuthEntry?.validation?.valid === true;

      setAuthStates((prev) => ({
        ...prev,
        [systemId]: {
          ...prev[systemId],
          status: isNowValid ? 'connected' : 'error',
          errorMessage: isNowValid ? undefined : (error instanceof Error ? error.message : 'Connection test failed. Please try again.'),
          successMessage: isNowValid ? 'Connection verified (background validation)' : undefined,
        },
      }));
    }
  };

  const handleSaveAuth = async (appId: string, credentials: Record<string, string>): Promise<boolean> => {
    // Find the app info
    const app = selectedApps.find(a => a.objectID === appId);
    if (!app) return false;

    // Build fields array from credentials, filtering out empty keys
    const fields = Object.entries(credentials)
      .filter(([key, value]) => key && key.trim() !== '' && value && value.trim() !== '')
      .map(([key, value]) => ({
        key,
        value,
      }));

    const payload = {
      label: `Auth for ${app.name.replace(/_/g, ' ')}`,
      app: {
        name: app.name,
        id: app.objectID,
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

      if (response.ok) {
        // Refresh authenticated apps list
        const authResponse = await fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        if (authResponse.ok) {
          const authData = await authResponse.json();
          if (authData.data) {
            setAuthenticatedApps(processAuthData(authData.data));
            refreshAllIntegrationStatus();
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save authentication:', error);
      return false;
    }
  };

  const canProceed = () => {
    const currentKey = steps[activeStep]?.key;
    if (currentKey === 'welcome') return selectedChallenge !== null;
    if (currentKey === 'sources') return selectedApps.length > 0;
    if (currentKey === 'tools') return true; // optional
    if (currentKey === 'authenticate') {
      return selectedApps.some((app) => {
        const state = authStates[app.objectID];
        if (state?.status === 'connected') return true;
        const hasConfiguredAuth = authenticatedApps.some(
          auth => auth.app?.name === app.name && auth.active
        );
        return hasConfiguredAuth;
      });
    }
    return true;
  };

  const connectedCount = selectedApps.filter(
    (app) => authStates[app.objectID]?.status === 'connected'
  ).length;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        backgroundColor: 'hsl(var(--background))',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Background effects - matching landing page */}
      <Box
        sx={{
          position: 'fixed',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150%',
          height: '80%',
          background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(hsl(var(--primary) / 0.02) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary) / 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Fixed Header with Step Indicator */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: 'hsl(var(--background) / 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid hsl(var(--border))',
          py: 3,
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          {/* Step Indicator */}
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', overflow: 'hidden' }}>
            <Stack 
              direction="row" 
              spacing={{ xs: 1, sm: 2 }}
              sx={{ 
                flexWrap: 'nowrap',
                justifyContent: 'center',
                maxWidth: '100%',
              }}
            >
              {steps.map((step, index) => (
                <Box
                  key={step.label}
                  onClick={() => setActiveStepKey(step.key)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1.5 },
                    cursor: 'pointer',
                    flexShrink: 0,
                    '&:hover': {
                      '& .step-label': {
                        color: index === activeStep ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                      },
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: { xs: 32, sm: 40 },
                      height: { xs: 32, sm: 40 },
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        index < activeStep
                          ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                          : index === activeStep
                          ? 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 100%)'
                          : 'hsl(var(--muted))',
                      border: '2px solid',
                      borderColor:
                        index <= activeStep ? 'transparent' : 'hsl(var(--border))',
                      transition: 'all 0.3s ease',
                      color: index <= activeStep ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                      boxShadow: index === activeStep ? '0 0 20px hsl(var(--primary) / 0.4)' : 'none',
                      flexShrink: 0,
                    }}
                  >
                    {index < activeStep ? <CheckCircleOutlineIcon style={{ fontSize: { xs: 14, sm: 18 } }} /> : step.icon}
                  </Box>
                  <Typography
                    className="step-label"
                    variant="body2"
                    sx={{
                      color: index === activeStep ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                      fontWeight: index === activeStep ? 600 : 400,
                      display: { xs: 'none', md: 'block' },
                      transition: 'color 0.2s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.label}
                  </Typography>
                  {index < steps.length - 1 && (
                    <Box
                      sx={{
                        width: { xs: 16, sm: 40 },
                        height: 2,
                        background:
                          index < activeStep
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : 'hsl(var(--border))',
                        borderRadius: 1,
                        display: { xs: 'block', md: 'block' },
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Scrollable Content Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 1, pt: { xs: 12, sm: 14 }, pb: 10, width: '100%' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 1, sm: 2 }, px: { xs: 2, sm: 3 }, width: '100%', maxWidth: '100%' }}>
          {/* Content Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Box
              sx={{
                backgroundColor: 'background.paper',
                backdropFilter: 'blur(20px)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 4,
                p: { xs: 2, sm: 3, md: 4 },
                minHeight: 400,
                width: '100%',
                maxWidth: '100%',
                overflow: 'hidden',
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
                >
                  {steps[activeStep]?.key === 'welcome' && (
                    <WelcomeStep
                      selectedChallenge={selectedChallenge}
                      onSelect={(challengeId) => {
                        setSelectedChallenge(challengeId);
                        // Auto-advance to next step after selection
                        setTimeout(() => {
                          const nextStep = activeStep + 1;
                          if (nextStep < steps.length) {
                            trackOnboardingStep(nextStep, steps[nextStep].label);
                            setActiveStepKey(steps[nextStep].key);
                            markWelcomeCompleted();
                            setWelcomeDone(true);
                          }
                        }, 400);
                      }}
                    />
                  )}

                  {steps[activeStep]?.key === 'sources' && (
                    <UnifiedSourceSetup
                      selectedApps={selectedApps}
                      onAppsChange={setSelectedApps}
                    />
                  )}

                  {steps[activeStep]?.key === 'tools' && (
                    <TicketingSystemSearch
                      selectedApps={selectedApps}
                      onAppsChange={setSelectedApps}
                      searchQuery={searchQuery}
                      onSearchQueryChange={setSearchQuery}
                    />
                  )}

                  {steps[activeStep]?.key === 'authenticate' && (() => {
                    // If user landed here directly (e.g. from dashboard) without
                    // going through Sources, derive the apps list from the
                    // activated authenticated apps so they can configure auth
                    // for the apps they've already enabled in /apps.
                    const appsForAuth: AlgoliaSearchApp[] = selectedApps.length > 0
                      ? selectedApps
                      : authenticatedApps
                          .filter(a => a.active)
                          .reduce<AlgoliaSearchApp[]>((acc, entry) => {
                            const id = entry.app?.id;
                            const name = entry.app?.name;
                            if (!id || !name) return acc;
                            if (acc.some(a => a.objectID === id || a.name === name)) return acc;
                            acc.push({
                              name,
                              description: '',
                              objectID: id,
                              creator: '',
                              app_version: '',
                              image_url: entry.app?.large_image || '',
                              time_edited: 0,
                              generated: false,
                              invalid: false,
                              priority: 0,
                              actions: 0,
                              tags: [],
                              accessible_by: [],
                              categories: [],
                              action_labels: [],
                              triggers: [],
                              verified: false,
                            });
                            return acc;
                          }, []);
                    return (
                      <AppAuthConfig
                        apps={appsForAuth}
                        authStates={authStates}
                        authenticatedApps={authenticatedApps}
                        onAuthChange={handleAuthChange}
                        onTestConnection={handleTestConnection}
                        onSaveAuth={handleSaveAuth}
                        onRefreshAuth={fetchAuthenticatedApps}
                      />
                    );
                  })()}

                  {steps[activeStep]?.key === 'automate' && (
                    <AutomationConfig
                      enrichmentState={enrichmentState}
                      onEnrichmentChange={setEnrichmentState}
                      onSave={(state) => {
                        setDatastoreItem(AUTOMATION_CONFIG_KEY, state, ONBOARDING_CONFIG_CATEGORY)
                          .catch(error => console.error('Failed to save automation config:', error));
                      }}
                      authenticatedApps={authenticatedApps}
                      selectedApps={selectedApps}
                      workflowAppNames={workflowAppNames}
                      forwardWorkflowAppNames={forwardWorkflowAppNames}
                      authStates={authStates}
                      apiAuthEntries={authenticatedApps}
                      onAuthChange={handleAuthChange}
                      onTestConnection={handleTestConnection}
                      onSaveAuth={handleSaveAuth}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* Fixed Footer with Navigation */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: 'hsl(var(--background) / 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid hsl(var(--border))',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {activeStep < steps.length - 1 ? (
              <Button
                component={Link}
                to="/dashboard"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': { color: 'text.primary', backgroundColor: 'action.hover' },
                }}
              >
                Skip for now
              </Button>
            ) : (
              <Box />
            )}
            <Stack direction="row" spacing={2}>
              {activeStep > 0 && (
                <Button
                  onClick={handleBack}
                  startIcon={<ArrowBackIcon />}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'text.primary', backgroundColor: 'action.hover' },
                  }}
                >
                  Back
                </Button>
              )}
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!canProceed()}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 100%)',
                  boxShadow: '0 4px 14px hsl(var(--primary) / 0.25)',
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, hsl(var(--primary-glow)) 0%, hsl(var(--primary-glow)) 100%)',
                    boxShadow: '0 6px 20px hsl(var(--primary) / 0.35)',
                  },
                  '&.Mui-disabled': {
                    background: 'hsl(var(--muted))',
                    color: 'hsl(var(--muted-foreground))',
                  },
                }}
              >
                {activeStep === steps.length - 1 ? 'Finish Setup' : 'Continue'}
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default OnboardingPage;
