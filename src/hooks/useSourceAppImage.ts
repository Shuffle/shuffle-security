/**
 * Look up the integration logo for an incident source.
 *
 * Mirrors the logic used inside IncidentDetailPage so the simplified view and
 * any other surface (lists, drawers, kanban, etc.) display the exact same
 * source-app image with no duplicated fetch code.
 */
import { useEffect, useState } from 'react';
import { getApiUrl, getAuthHeader } from '@/config/api';

export const useSourceAppImage = (
  source: string | undefined | null,
  crossOrgId?: string | null,
) => {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setImage(null);
      return;
    }
    const normalized = source.toLowerCase().replace(/[\s_-]/g, '');
    const headers: Record<string, string> = {
      ...getAuthHeader(),
      ...(crossOrgId ? { 'Org-Id': crossOrgId } : {}),
    };
    let cancelled = false;
    fetch(getApiUrl('/api/v1/apps/authentication'), {
      credentials: 'include',
      headers,
    })
      .then((r) => r.json())
      .then((result) => {
        if (cancelled) return;
        const authData = result.data || result;
        if (Array.isArray(authData)) {
          const match = authData.find((a: any) => {
            const appName = (a.app?.name || '').toLowerCase().replace(/[\s_-]/g, '');
            return appName === normalized;
          });
          if (match?.app?.large_image) setImage(match.app.large_image);
        }
      })
      .catch(() => {
        /* ignore — image is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [source, crossOrgId]);

  return image;
};
