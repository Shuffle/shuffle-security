import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';

export interface ShuffleFile {
  id: string;
  filename: string;
  filesize: number;
  created_at: number;
  updated_at: number;
  status: string;
  md5_sum?: string;
  sha256_sum?: string;
  org_id: string;
  workflow_id: string;
  namespace?: string;
  labels?: string[];
  description?: string;
}

interface CreateFileResponse {
  success: boolean;
  id?: string;
  reason?: string;
}

interface UploadFileResponse {
  success: boolean;
  id?: string;
  reason?: string;
}

/**
 * Get the organization ID from localStorage
 */
const getOrgId = (): string => {
  try {
    const userInfo = localStorage.getItem('shuffle_user_info');
    if (userInfo) {
      const parsed = JSON.parse(userInfo);
      return parsed.active_org?.id || '';
    }
  } catch {
    console.error('Failed to get org ID');
  }
  return '';
};

/**
 * Create a file entry (required before uploading)
 */
export const createFile = async (
  filename: string,
  namespace?: string,
  labels?: string[]
): Promise<CreateFileResponse> => {
  try {
    const orgId = getOrgId();
    const response = await fetch(getApiUrl('/api/v1/files/create'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename,
        org_id: orgId,
        workflow_id: 'global',
        namespace: namespace || 'incidents',
        labels: labels || [],
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Failed to create file:', error);
    return { success: false, reason: 'Network error' };
  }
};

/**
 * Upload file content to a created file ID
 */
export const uploadFile = async (
  fileId: string,
  file: File
): Promise<UploadFileResponse> => {
  try {
    const formData = new FormData();
    formData.append('shuffle_file', file);

    const response = await fetch(getApiUrl(`/api/v1/files/${fileId}/upload`), {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeader(),
      body: formData,
    });

    return await response.json();
  } catch (error) {
    console.error('Failed to upload file:', error);
    return { success: false, reason: 'Network error' };
  }
};

/**
 * Create and upload a file in one operation
 */
export const createAndUploadFile = async (
  file: File,
  namespace?: string,
  labels?: string[]
): Promise<{ success: boolean; file?: ShuffleFile; reason?: string }> => {
  // Step 1: Create file entry
  const createResult = await createFile(file.name, namespace, labels);
  if (!createResult.success || !createResult.id) {
    return { success: false, reason: createResult.reason || 'Failed to create file entry' };
  }

  // Step 2: Upload file content
  const uploadResult = await uploadFile(createResult.id, file);
  if (!uploadResult.success) {
    return { success: false, reason: uploadResult.reason || 'Failed to upload file' };
  }

  // Return the file info
  return {
    success: true,
    file: {
      id: createResult.id,
      filename: file.name,
      filesize: file.size,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
      status: 'active',
      org_id: getOrgId(),
      workflow_id: 'global',
      namespace: namespace || 'incidents',
      labels,
    },
  };
};

/**
 * List all files
 */
export const listFiles = async (namespace?: string): Promise<ShuffleFile[]> => {
  try {
    let url = '/api/v1/files';
    if (namespace) {
      url += `?namespace=${encodeURIComponent(namespace)}`;
    }

    const response = await fetch(getApiUrl(url), {
      credentials: 'include',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to list files:', error);
    return [];
  }
};

/**
 * Get file metadata
 */
export const getFileMeta = async (fileId: string): Promise<ShuffleFile | null> => {
  try {
    const response = await fetch(getApiUrl(`/api/v1/files/${fileId}`), {
      credentials: 'include',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get file meta:', error);
    return null;
  }
};

/**
 * Get file download URL
 */
export const getFileDownloadUrl = (fileId: string): string => {
  return getApiUrl(`/api/v1/files/${fileId}/content`);
};

/**
 * Delete a file
 */
export const deleteFile = async (fileId: string): Promise<{ success: boolean }> => {
  try {
    const response = await fetch(getApiUrl(`/api/v1/files/${fileId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeader(),
    });

    return await response.json();
  } catch (error) {
    console.error('Failed to delete file:', error);
    return { success: false };
  }
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
