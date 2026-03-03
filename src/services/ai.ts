/**
 * Generic AI conversation utility.
 * Calls the Shuffle AI backend at POST /api/v1/conversation.
 */

import { getApiUrl, getAuthHeader } from '@/config/api';

export interface AIConversationOptions {
  query: string;
  outputFormat?: 'raw' | 'json';
}

export interface AIConversationResponse {
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * Send a query to the Shuffle AI conversation endpoint.
 */
export const askAI = async ({
  query,
  outputFormat = 'raw',
}: AIConversationOptions): Promise<AIConversationResponse> => {
  try {
    const res = await fetch(getApiUrl('/api/v1/conversation'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        output_format: outputFormat,
        query,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `AI request failed: ${res.status} ${res.statusText}` };
    }

    const data = await res.json();
    return { success: true, result: typeof data === 'string' ? data : (data.result || data.response || JSON.stringify(data)) };
  } catch (error) {
    console.error('AI conversation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
