/**
 * React hook for fetching custom fields
 */

import { useState, useEffect, useCallback } from 'react';
import { getDatastoreByCategory, DATASTORE_CATEGORIES } from '@/services/datastore';

type FieldType = 'text' | 'number' | 'select' | 'date' | 'boolean';

export interface CustomField {
  name: string;
  key: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  description?: string;
}

export const useCustomFields = () => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDatastoreByCategory(DATASTORE_CATEGORIES.CUSTOM_FIELDS);
      if (response.success && response.data) {
        const parsed: CustomField[] = response.data.map(item => {
          try {
            return JSON.parse(item.value) as CustomField;
          } catch {
            return { name: item.key, key: item.key, type: 'text' as FieldType, required: false };
          }
        });
        setFields(parsed);
      } else {
        setError(response.error || 'Failed to fetch custom fields');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  return { fields, loading, error, refetch: fetchFields };
};
