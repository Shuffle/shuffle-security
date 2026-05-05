/**
 * React hook for fetching custom fields with React Query caching.
 * Data is cached for 5 minutes and shared across all components.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDatastoreByCategory, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';

type FieldType = 'text' | 'number' | 'select' | 'date' | 'boolean';

export interface CustomField {
  name: string;
  key: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  description?: string;
}

const QUERY_KEY = ['customFields'];
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

const fetchCustomFields = async (): Promise<CustomField[]> => {
  const response = await getDatastoreByCategory(DATASTORE_CATEGORIES.CUSTOM_FIELDS);
  if (response.success && response.data) {
    return response.data.map(item => {
      try {
        return JSON.parse(item.value) as CustomField;
      } catch {
        return { name: item.key, key: item.key, type: 'text' as FieldType, required: false };
      }
    });
  }
  throw new Error(response.error || 'Failed to fetch custom fields');
};

export const useCustomFields = () => {
  const queryClient = useQueryClient();

  const { data: fields = [], isLoading: loading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCustomFields,
    staleTime: STALE_TIME,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  return {
    fields,
    loading,
    error: error?.message ?? null,
    refetch: invalidate,
  };
};
