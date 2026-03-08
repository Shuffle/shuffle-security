/**
 * Shuffle Datastore Service
 * 
 * Provides reusable functions for interacting with the Shuffle datastore API.
 * Uses the correct Shuffle cache API endpoints.
 */

import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';

export interface DatastoreItem {
  key: string;
  value: string;
  category: string;
  created?: number;
  edited?: number;
  public_authorization?: string;
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
  error?: string;
}

/**
 * Get current org ID from user info in localStorage
 */
const getOrgId = (): string | null => {
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

/**
 * Set a single item in the datastore
 */
export const setDatastoreItem = async (
  key: string,
  value: string | object,
  category: string
): Promise<DatastoreResponse> => {
  const orgId = getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  const payload = {
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    category,
  };

  const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/set_cache`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
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
    value: typeof item.value === 'string' ? item.value : JSON.stringify(item.value),
    category,
  }));

  const response = await fetch(getApiUrl('/api/v2/datastore'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { success: false, error: `Failed to set datastore items: ${response.statusText}` };
  }

  return { success: true };
};

/**
 * Get a single item from the datastore
 */
export const getDatastoreItem = async (
  key: string,
  category: string
): Promise<DatastoreResponse & { item?: DatastoreItem }> => {
  const orgId = getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  const payload: Record<string, string> = {
    key,
    org_id: orgId,
  };
  
  if (category) {
    payload.category = category;
  }

  const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/get_cache`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
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
    getApiUrl(`/api/v1/orgs/${orgId}/cache/${key}?type=text&authorization=${authorization}`),
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
 * Get all items in a category with optional cursor-based pagination
 */
export const getDatastoreByCategory = async (
  category: string,
  cursor?: string
): Promise<DatastoreResponse> => {
  const orgId = getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  // Use higher limit for incidents, default 100 for others
  const limit = category === DATASTORE_CATEGORIES.INCIDENTS ? 1000 : 100;
  let url = `/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(category)}&top=${limit}`;
  if (cursor) {
    url += `&cursor=${encodeURIComponent(cursor)}`;
  }

  const response = await fetch(
    getApiUrl(url),
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    return { success: false, error: `Failed to get datastore items: ${response.statusText}` };
  }

  const data = await response.json();
  // API returns items in 'keys' array, category config, and cursor for pagination
  return { 
    success: true, 
    data: Array.isArray(data) ? data : data.keys || data.data || [],
    categoryConfig: data.category_config,
    cursor: data.cursor,
  };
};

/**
 * Delete a single item from the datastore
 */
export const deleteDatastoreItem = async (
  key: string,
  category: string
): Promise<DatastoreResponse> => {
  const orgId = getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  const payload: Record<string, string> = {
    key,
    org_id: orgId,
  };
  
  if (category) {
    payload.category = category;
  }

  const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/delete_cache`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
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
  TEMPLATES: 'shuffle-security_templates',
  CONFIGURATION: 'shuffle-security_configuration',
  IOCS: 'shuffle-security_ioc-config',
  CUSTOM_FIELDS: 'shuffle-security_custom-fields',
  THREAT_FEEDS: 'shuffle-security_threat-feeds',
  INFRASTRUCTURE: 'shuffle-security_infrastructure',
  // Legacy - for migration purposes
  LEGACY_ALERTS: 'shuffle-security_alerts',
  LEGACY_CASES: 'shuffle-security_cases',
} as const;
