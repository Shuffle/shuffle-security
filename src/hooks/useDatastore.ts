/**
 * React hook for Shuffle Datastore operations
 * Provides a convenient interface for components to interact with the datastore
 */

import { useState, useCallback } from 'react';
import {
  setDatastoreItem,
  setDatastoreItems,
  getDatastoreItem,
  getDatastoreByCategory,
  deleteDatastoreItem,
  DatastoreItem,
} from '@/services/datastore';

interface UseDatastoreOptions {
  category: string;
}

interface UseDatastoreReturn {
  items: DatastoreItem[];
  isLoading: boolean;
  error: string | null;
  fetchItems: () => Promise<void>;
  addItem: (key: string, value: string | object, skipRefresh?: boolean) => Promise<boolean>;
  addItems: (items: { key: string; value: string | object }[]) => Promise<boolean>;
  getItem: (key: string) => Promise<DatastoreItem | null>;
  removeItem: (key: string) => Promise<boolean>;
}

export const useDatastore = ({ category }: UseDatastoreOptions): UseDatastoreReturn => {
  const [items, setItems] = useState<DatastoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getDatastoreByCategory(category);
      if (response.success && response.data) {
        setItems(response.data);
      } else {
        setError(response.error || 'Failed to fetch items');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  const addItem = useCallback(async (key: string, value: string | object, skipRefresh = true): Promise<boolean> => {
    setError(null);
    try {
      const response = await setDatastoreItem(key, value, category);
      if (response.success) {
        // Only refresh if explicitly requested (default: skip for performance)
        if (!skipRefresh) {
          await fetchItems();
        }
        return true;
      } else {
        setError(response.error || 'Failed to add item');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [category, fetchItems]);

  const addItems = useCallback(async (newItems: { key: string; value: string | object }[]): Promise<boolean> => {
    setError(null);
    try {
      const response = await setDatastoreItems(newItems, category);
      if (response.success) {
        await fetchItems(); // Refresh the list
        return true;
      } else {
        setError(response.error || 'Failed to add items');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [category, fetchItems]);

  const getItem = useCallback(async (key: string): Promise<DatastoreItem | null> => {
    setError(null);
    try {
      const response = await getDatastoreItem(key, category);
      if (response.success && response.item) {
        return response.item;
      } else {
        setError(response.error || 'Failed to get item');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [category]);

  const removeItem = useCallback(async (key: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await deleteDatastoreItem(key, category);
      if (response.success) {
        await fetchItems(); // Refresh the list
        return true;
      } else {
        setError(response.error || 'Failed to delete item');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [category, fetchItems]);

  return {
    items,
    isLoading,
    error,
    fetchItems,
    addItem,
    addItems,
    getItem,
    removeItem,
  };
};
