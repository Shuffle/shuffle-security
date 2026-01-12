/**
 * Shuffle Datastore Service
 * 
 * Provides reusable functions for interacting with the Shuffle datastore API.
 * Supports CRUD operations with category-based organization.
 */

import { API_CONFIG, getAuthHeader } from '@/config/api';

export interface DatastoreItem {
  key: string;
  value: string;
  category: string;
  created?: number;
  edited?: number;
}

export interface DatastoreResponse {
  success: boolean;
  data?: DatastoreItem[];
  error?: string;
}

/**
 * Set a single item in the datastore
 */
export const setDatastoreItem = async (
  key: string,
  value: string | object,
  category: string
): Promise<DatastoreResponse> => {
  // API always expects a list, even for single items
  const payload = [{
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    category,
  }];

  const response = await fetch(`${API_CONFIG.baseUrl}/api/v2/datastore`, {
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
  const payload = items.map(item => ({
    key: item.key,
    value: typeof item.value === 'string' ? item.value : JSON.stringify(item.value),
    category,
  }));

  const response = await fetch(`${API_CONFIG.baseUrl}/api/v2/datastore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(API_CONFIG.apiKey),
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
  const response = await fetch(
    `${API_CONFIG.baseUrl}/api/v2/datastore/${encodeURIComponent(key)}?category=${category}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(API_CONFIG.apiKey),
      },
    }
  );

  if (!response.ok) {
    return { success: false, error: `Failed to get datastore item: ${response.statusText}` };
  }

  const data = await response.json();
  return { success: true, item: data };
};

/**
 * Get all items in a category
 */
export const getDatastoreByCategory = async (
  category: string
): Promise<DatastoreResponse> => {
  const response = await fetch(
    `${API_CONFIG.baseUrl}/api/v2/datastore/category/${category}`,
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
  // API returns items in 'keys' array, not 'data'
  return { success: true, data: Array.isArray(data) ? data : data.keys || data.data || [] };
};

/**
 * Delete a single item from the datastore
 */
export const deleteDatastoreItem = async (
  key: string,
  category: string
): Promise<DatastoreResponse> => {
  const response = await fetch(
    `${API_CONFIG.baseUrl}/api/v2/datastore/${encodeURIComponent(key)}?category=${category}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(API_CONFIG.apiKey),
      },
    }
  );

  if (!response.ok) {
    return { success: false, error: `Failed to delete datastore item: ${response.statusText}` };
  }

  return { success: true };
};

// Category constants for consistency
export const DATASTORE_CATEGORIES = {
  ALERTS: 'shuffle-security alerts',
  CASES: 'shuffle-security cases',
  TEMPLATES: 'shuffle-security templates',
  CONFIGURATION: 'shuffle-security configuration',
  IOCS: 'shuffle-security iocs',
  CUSTOM_FIELDS: 'shuffle-security custom-fields',
} as const;
