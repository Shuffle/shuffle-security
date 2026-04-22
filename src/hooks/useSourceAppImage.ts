/**
 * Look up the integration logo for an incident source.
 *
 * Mirrors the logic used inside IncidentDetailPage so the simplified view and
 * any other surface (lists, drawers, kanban, etc.) display the exact same
 * source-app image with no duplicated fetch code.
 *
 * Resolution order:
 *   1. Authenticated apps (`/api/v1/apps/authentication`) — preferred so
 *      the logo matches what the user has actually wired up.
 *   2. Algolia public app catalog — fallback for sources the user has not
 *      authenticated yet (e.g. a freshly-arrived demo incident from a tool
 *      they have not connected). Without this, brand-new sources render
 *      with a blank avatar.
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

    const fallbackToAlgolia = async () => {
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        const searchName = source.replace(/_/g, ' ');
        const res = await client.search({
          requests: [{ indexName: 'appsearch', query: searchName, hitsPerPage: 10 }],
        });
        if (cancelled) return;
        const hits = ((res as any)?.results?.[0]?.hits || []) as any[];
        const match = hits.find((h) => {
          const name = (h.name || '').toLowerCase().replace(/[\s_-]/g, '');
          return name === normalized;
        }) || hits[0];
        if (match?.image_url) setImage(match.image_url);
      } catch {
        /* ignore — image is optional */
      }
    };

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
          if (match?.app?.large_image) {
            setImage(match.app.large_image);
            return;
          }
        }
        // No authenticated match — try the public Algolia catalog.
        fallbackToAlgolia();
      })
      .catch(() => {
        // Auth fetch failed — still try the public catalog.
        fallbackToAlgolia();
      });
    return () => {
      cancelled = true;
    };
  }, [source, crossOrgId]);

  return image;
};
