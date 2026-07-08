/**
 * Shuffle Datastore Service
 * 
 * Provides reusable functions for interacting with the Shuffle datastore API.
 * Uses the correct Shuffle cache API endpoints.
 */

import { API_CONFIG, getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

export interface DatastoreItem {
  key: string;
  value: string;
  category: string;
  created?: number;
  edited?: number;
  public_authorization?: string;
  enrichments?: Array<{ type: string; value?: string; data?: string }>;
}

export interface CategoryAutomation {
  id?: string;
  name: string;
  type?: 'workflow' | 'webhook' | 'ai_agent' | 'enrich' | 'send_message' | 'security_rules';
  trigger?: 'on_create' | 'on_edit' | 'on_delete';
  workflow_id?: string;
  webhook_url?: string;
  enabled: boolean;
  description?: string;
  options?: { key: string; value: string }[];
}

export interface CategoryConfig {
  id: string;
  org_id: string;
  category: string;
  automations: CategoryAutomation[] | null;
  settings: {
    timeout: number;
    public: boolean;
  };
}

export interface DatastoreResponse {
  success: boolean;
  data?: DatastoreItem[];
  categoryConfig?: CategoryConfig;
  cursor?: string;
  totalAmount?: number;
  error?: string;
  diagnostics?: DatastoreDiagnostics;
}

export interface DatastoreDiagnostics {
  operation: string;
  category?: string;
  orgId?: string | null;
  url?: string;
  cursor?: string;
  status?: number;
  statusText?: string;
  contentType?: string | null;
  responseShape?: 'array' | 'keys' | 'data' | 'unknown';
  itemCount?: number;
  totalAmount?: number | null;
  bodyPreview?: string;
  errorStage?: 'request' | 'response' | 'parse' | 'unknown';
  timestamp: string;
}

/**
 * Runtime-injected active org ID. AuthContext sets this synchronously when
 * /api/v1/getinfo resolves, so callers don't need to wait for the
 * `shuffle_user_info` localStorage write to land. Falls back to localStorage
 * for cases where the service is imported before AuthContext mounts.
 */
let _runtimeOrgId: string | null = null;

export const setRuntimeOrgId = (orgId: string | null) => {
  _runtimeOrgId = orgId || null;
};

/**
 * Get current org ID. Prefers the runtime value set by AuthContext, then
 * falls back to localStorage so legacy callers keep working.
 */
const getOrgId = (): string | null => {
  if (_runtimeOrgId) return _runtimeOrgId;
  try {
    const userInfo = localStorage.getItem('shuffle_user_info');
    if (userInfo) {
      const parsed = JSON.parse(userInfo);
      return parsed.active_org?.id || null;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
};

const normalizeDatastoreKey = (key: string): string => {
  if (!key?.includes('::')) return key;
  const parts = key.split('::').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : key;
};

const truncateResponsePreview = (value: string | null | undefined, maxLength = 280): string | undefined => {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
};

/**
 * Serialize a datastore value to a string for the API.
 * Validates JSON-shaped strings (parse+restringify) so we always send valid JSON.
 */
const serializeDatastoreValue = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(trimmed));
      } catch {
        return value;
      }
    }
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};


/**
 * Set a single item in the datastore
 */
export const setDatastoreItem = async (
  key: string,
  value: string | object,
  category: string,
  overrideOrgId?: string
): Promise<DatastoreResponse> => {
  const orgId = overrideOrgId || getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  const rawKey = normalizeDatastoreKey(key);
  // Use the v2 datastore endpoint as a single-item array. This is the same
  // endpoint the bulk writer uses; set_cache has been retired for incident
  // updates because it stringifies the payload differently and caused
  // double-encoded JSON to land in the datastore.
  //
  // IMPORTANT: pin the org_id INSIDE the payload item as well as on the
  // Org-Id header. The v2 endpoint reads org_id from the payload when
  // present; without it, the backend falls back to the session's active
  // org and the write silently lands in the wrong tenant.
  const payload = [{
    key: rawKey,
    value: serializeDatastoreValue(value),
    category,
    org_id: orgId,
    // Incident category is governed by automation/security rules that would
    // otherwise reject programmatic edits — bypass them for our own writes.
    ...(category === 'shuffle-security_incidents' ? { ignore_security_rules: true } : {}),
  }];

  // NOTE: pass `orgId` to getAuthHeader so its Org-Id matches the target
  // tenant. Spreading getAuthHeader() AFTER a manual 'Org-Id' would let the
  // session's active org overwrite the target and silently mis-route writes.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(orgId),
  };


  console.log(`[datastore.set] key=${rawKey} category=${category} orgId=${orgId}${overrideOrgId ? ' (override)' : ''}`);

  const response = await fetch(getApiUrl('/api/v2/datastore'), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { success: false, error: `Failed to set datastore item: ${response.statusText}` };
  }

  return { success: true };
};


/**
 * Set multiple items in the datastore (bulk create) using v2 API
 */
export const setDatastoreItems = async (
  items: { key: string; value: string | object }[],
  category: string
): Promise<DatastoreResponse> => {
  const orgId = getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  // Use v2 API for bulk operations - send as array
  const payload = items.map(item => ({
    key: item.key,
    value: serializeDatastoreValue(item.value),
    category,
    ...(category === 'shuffle-security_incidents' ? { ignore_security_rules: true } : {}),
  }));

  const response = await fetch(getApiUrl('/api/v2/datastore'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Org-Id': orgId,
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

   if (!response.ok) {
    const fallbackResults = await Promise.all(items.map(item =>
      setDatastoreItem(item.key, item.value, category)
    ));
    const failedWrites = fallbackResults.filter(result => !result.success);
    if (failedWrites.length > 0) {
      return {
        success: false,
        error: failedWrites[0]?.error || `Failed to set datastore items: ${response.statusText}`,
      };
    }
    return { success: true };
  }

  return { success: true };
};

/**
 * Get a single item from the datastore
 */
export const getDatastoreItem = async (
  key: string,
  category: string,
  overrideOrgId?: string
): Promise<DatastoreResponse & { item?: DatastoreItem }> => {
  const orgId = overrideOrgId || getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  const rawKey = normalizeDatastoreKey(key);
  const payload: Record<string, string> = {
    key: rawKey,
    org_id: orgId,
  };
  
  if (category) {
    payload.category = category;
  }

  // Always pin Org-Id header so the backend routes the read to the exact
  // tenant we asked for — do NOT rely on session default even when there is
  // no explicit override, because the URL path already carries this orgId.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Org-Id': orgId,
    ...getAuthHeader(),
  };

  console.log(`[datastore.get] key=${rawKey} category=${category} orgId=${orgId}${overrideOrgId ? ' (override)' : ''}`);

  const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/get_cache`), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // 404 means key doesn't exist - not an error, just empty
    if (response.status === 404) {
      return { success: true, item: undefined };
    }
    return { success: false, error: `Failed to get datastore item: ${response.statusText}` };
  }


  const data = await response.json();
  
  // API returns success: false if key not found
  if (data.success === false && !data.value) {
    return { success: true, item: undefined };
  }
  
  return { success: true, item: data };
};

/**
 * Get a single item from the datastore using public authorization (no login required)
 */
export const getDatastoreItemPublic = async (
  key: string,
  orgId: string,
  authorization: string,
): Promise<DatastoreResponse & { item?: DatastoreItem }> => {
  const response = await fetch(
    getApiUrl(`/api/v1/orgs/${orgId}/cache/${key}?authorization=${authorization}`),
    { method: 'GET' },
  );

  if (!response.ok) {
    if (response.status === 404) {
      return { success: true, item: undefined };
    }
    return { success: false, error: `Failed to get public datastore item: ${response.statusText}` };
  }

  const data = await response.json();
  if (data.success === false && !data.value) {
    return { success: true, item: undefined };
  }
  return { success: true, item: data };
};

/**
 * Try to extract valid datastore items from a response body string,
 * even if the HTTP status was non-2xx (some backend servers return 400 with valid data).
 */
const tryExtractItemsFromBody = (rawBody: string): { items: DatastoreItem[]; categoryConfig?: CategoryConfig; cursor?: string; totalAmount?: number; shape: DatastoreDiagnostics['responseShape'] } | null => {
  try {
    const data = rawBody ? JSON.parse(rawBody) : null;
    if (!data || typeof data !== 'object') return null;

    const items = Array.isArray(data) ? data : data.keys || data.data || [];
    if (!Array.isArray(items) || items.length === 0) return null;

    // Basic validation: at least one item should have a key
    if (!items.some((i: any) => i && typeof i === 'object' && typeof i.key === 'string')) return null;

    const shape: DatastoreDiagnostics['responseShape'] = Array.isArray(data)
      ? 'array'
      : Array.isArray(data?.keys) ? 'keys'
      : Array.isArray(data?.data) ? 'data'
      : 'unknown';

    return {
      items,
      categoryConfig: data.category_config,
      cursor: data.cursor,
      totalAmount: data.total_amount,
      shape,
    };
  } catch {
    return null;
  }
};

/**
 * Get all items in a category with optional cursor-based pagination
 */
export const getDatastoreByCategory = async (
  category: string,
  cursor?: string,
  limit?: number
): Promise<DatastoreResponse> => {
  const orgId = getOrgId();
  if (!orgId) {
    return {
      success: false,
      error: 'No organization ID found',
      diagnostics: {
        operation: 'list',
        category,
        orgId: null,
        cursor,
        errorStage: 'request',
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Default page size is 100. Incidents specifically cap at 50 because their
  // payloads are far larger than other categories — pagination via cursor
  // handles the rest.
  const effectiveLimit = limit ?? (category === DATASTORE_CATEGORIES.INCIDENTS ? 50 : 100);
  let url = `/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(category)}&top=${effectiveLimit}`;
  if (cursor) {
    url += `&cursor=${encodeURIComponent(cursor)}`;
  }

  const requestUrl = getApiUrl(url);
  const baseDiagnostics: DatastoreDiagnostics = {
    operation: 'list',
    category,
    orgId,
    url: requestUrl,
    cursor,
    timestamp: new Date().toISOString(),
  };

  let response: Response;

  try {
    response = await fetch(
      requestUrl,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      }
    );
  } catch (error) {
    // Network error — retry once
    try {
      response = await fetch(
        requestUrl,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
    } catch (retryError) {
      return {
        success: false,
        error: retryError instanceof Error ? retryError.message : 'Failed to request datastore items',
        diagnostics: {
          ...baseDiagnostics,
          errorStage: 'request',
        },
      };
    }
  }

  const contentType = response.headers.get('content-type');
  const rawBody = await response.text();

  if (!response.ok) {
    // Some backend servers return 400 but still include valid data in the body.
    // Try to extract items before treating as a hard failure.
    const extracted = tryExtractItemsFromBody(rawBody);
    if (extracted && extracted.items.length > 0) {
      console.warn(`[Datastore] ${response.status} response for category=${category} but body contained ${extracted.items.length} valid items — treating as success`);
      return {
        success: true,
        data: extracted.items,
        categoryConfig: extracted.categoryConfig,
        cursor: extracted.cursor,
        totalAmount: extracted.totalAmount,
        diagnostics: {
          ...baseDiagnostics,
          status: response.status,
          statusText: response.statusText,
          contentType,
          responseShape: extracted.shape,
          itemCount: extracted.items.length,
          totalAmount: extracted.totalAmount ?? null,
        },
      };
    }

    // No valid data in body — retry once for transient server errors
    if (response.status >= 400 && response.status < 500) {
      try {
        const retryResponse = await fetch(
          requestUrl,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader(),
            },
          }
        );
        const retryBody = await retryResponse.text();
        const retryExtracted = tryExtractItemsFromBody(retryBody);
        if (retryResponse.ok || (retryExtracted && retryExtracted.items.length > 0)) {
          const items = retryExtracted?.items || [];
          console.warn(`[Datastore] Retry succeeded for category=${category} (status=${retryResponse.status}, items=${items.length})`);
          return {
            success: true,
            data: items,
            categoryConfig: retryExtracted?.categoryConfig,
            cursor: retryExtracted?.cursor,
            totalAmount: retryExtracted?.totalAmount,
            diagnostics: {
              ...baseDiagnostics,
              status: retryResponse.status,
              statusText: retryResponse.statusText,
              contentType: retryResponse.headers.get('content-type'),
              responseShape: retryExtracted?.shape || 'unknown',
              itemCount: items.length,
              totalAmount: retryExtracted?.totalAmount ?? null,
            },
          };
        }
      } catch { /* retry failed, fall through to error */ }
    }

    return {
      success: false,
      error: `Failed to get datastore items: ${response.status} ${response.statusText}`.trim(),
      diagnostics: {
        ...baseDiagnostics,
        status: response.status,
        statusText: response.statusText,
        contentType,
        bodyPreview: truncateResponsePreview(rawBody),
        errorStage: 'response',
      },
    };
  }

  try {
    const data = rawBody ? JSON.parse(rawBody) : {};
    const responseShape: DatastoreDiagnostics['responseShape'] = Array.isArray(data)
      ? 'array'
      : Array.isArray(data?.keys)
        ? 'keys'
        : Array.isArray(data?.data)
          ? 'data'
          : 'unknown';
    const items = Array.isArray(data) ? data : data.keys || data.data || [];
    const totalAmount = data.total_amount ?? data.total ?? data.amount;

    return {
      success: true,
      data: items,
      categoryConfig: data.category_config,
      cursor: data.cursor,
      totalAmount,
      diagnostics: {
        ...baseDiagnostics,
        status: response.status,
        statusText: response.statusText,
        contentType,
        responseShape,
        itemCount: Array.isArray(items) ? items.length : 0,
        totalAmount: totalAmount ?? null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? `Failed to parse datastore response: ${error.message}` : 'Failed to parse datastore response',
      diagnostics: {
        ...baseDiagnostics,
        status: response.status,
        statusText: response.statusText,
        contentType,
        bodyPreview: truncateResponsePreview(rawBody),
        errorStage: 'parse',
      },
    };
  }
};

/**
 * Delete a single item from the datastore
 */
export const deleteDatastoreItem = async (
  key: string,
  category: string,
  overrideOrgId?: string
): Promise<DatastoreResponse> => {
  const orgId = overrideOrgId || getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  const rawKey = normalizeDatastoreKey(key);
  const payload: Record<string, string> = {
    key: rawKey,
    org_id: orgId,
  };
  
  if (category) {
    payload.category = category;
  }

  // Always pin Org-Id header — the URL path already carries this orgId,
  // never let the backend fall back to the session's active org for a
  // destructive operation.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Org-Id': orgId,
    ...getAuthHeader(),
  };

  console.log(`[datastore.delete] key=${rawKey} category=${category} orgId=${orgId}${overrideOrgId ? ' (override)' : ''}`);

  const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/delete_cache`), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { success: false, error: `Failed to delete datastore item: ${response.statusText}` };
  }

  return { success: true };
};

/**
 * Delete multiple items from the datastore (bulk delete)
 */
export const deleteDatastoreItems = async (
  keys: string[],
  category: string
): Promise<{ success: boolean; deleted: number; failed: string[]; error?: string }> => {
  const orgId = getOrgId();
  if (!orgId) {
    return { success: false, deleted: 0, failed: keys, error: 'No organization ID found' };
  }

  const results = await Promise.allSettled(
    keys.map(key => deleteDatastoreItem(key, category))
  );

  const failed: string[] = [];
  let deleted = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      deleted++;
    } else {
      failed.push(keys[index]);
    }
  });

  return {
    success: failed.length === 0,
    deleted,
    failed,
  };
};

// Category constants for consistency
export const DATASTORE_CATEGORIES = {
  INCIDENTS: 'shuffle-security_incidents',
  ASSETS: 'shuffle-security_assets',
  TEMPLATES: 'shuffle-security_templates',
  CONFIGURATION: 'shuffle-security_configuration',
  IOCS: 'shuffle-security_ioc-config',
  CUSTOM_FIELDS: 'shuffle-security_custom-fields',
  THREAT_FEEDS: 'shuffle-security_threat-feeds',
  INFRASTRUCTURE: 'shuffle-security_infrastructure',
  USERS: 'shuffle-security_users',
  REPORTS: 'shuffle-security_reports',
  // Legacy - for migration purposes
  LEGACY_ALERTS: 'shuffle-security_alerts',
  LEGACY_CASES: 'shuffle-security_cases',
} as const;
