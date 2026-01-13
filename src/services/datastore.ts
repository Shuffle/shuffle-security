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
}

export interface CategoryAutomation {
  id?: string;
  name: string;
  type?: 'workflow' | 'webhook' | 'ai_agent' | 'enrich' | 'send_message';
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
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(API_CONFIG.apiKey),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { success: false, error: `Failed to set datastore item: ${response.statusText}` };
  }

  return { success: true };
};

/**
 * Set multiple items in the datastore (bulk create)
 */
export const setDatastoreItems = async (
  items: { key: string; value: string | object }[],
  category: string
): Promise<DatastoreResponse> => {
  const orgId = getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  // Set items one by one since set_cache doesn't support bulk in v1
  for (const item of items) {
    const result = await setDatastoreItem(item.key, item.value, category);
    if (!result.success) {
      return result;
    }
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
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(API_CONFIG.apiKey),
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
 * Get all items in a category
 */
export const getDatastoreByCategory = async (
  category: string
): Promise<DatastoreResponse> => {
  const orgId = getOrgId();
  if (!orgId) {
    return { success: false, error: 'No organization ID found' };
  }

  const response = await fetch(
    getApiUrl(`/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(category)}`),
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(API_CONFIG.apiKey),
      },
    }
  );

  if (!response.ok) {
    return { success: false, error: `Failed to get datastore items: ${response.statusText}` };
  }

  const data = await response.json();
  // API returns items in 'keys' array and category config
  return { 
    success: true, 
    data: Array.isArray(data) ? data : data.keys || data.data || [],
    categoryConfig: data.category_config,
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
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(API_CONFIG.apiKey),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { success: false, error: `Failed to delete datastore item: ${response.statusText}` };
  }

  return { success: true };
};

// Category constants for consistency
export const DATASTORE_CATEGORIES = {
  INCIDENTS: 'shuffle-security_incidents',
  TEMPLATES: 'shuffle-security_templates',
  CONFIGURATION: 'shuffle-security_configuration',
  IOCS: 'shuffle-security_iocs',
  CUSTOM_FIELDS: 'shuffle-security_custom-fields',
  // Legacy - for migration purposes
  LEGACY_ALERTS: 'shuffle-security_alerts',
  LEGACY_CASES: 'shuffle-security_cases',
} as const;
