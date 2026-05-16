/**
 * Look up the integration logo for an incident source.
 *
 * Thin wrapper around the canonical `resolveApp` helper so every surface
 * (incident detail, lists, drawers, kanban, etc.) renders the exact same
 * source-app image as the rest of the product (Apps drawer, Integrations
 * bar, agent system, etc.). No duplicated fetch logic.
 */
import { useEffect, useState } from 'react';
import { resolveApp } from '@/Shuffle-MCPs/resolveApp';

/**
 * Sources that are NOT real integrations and therefore must not trigger any
 * logo lookup. Without this guard, querying for "Manual" returns a top hit
 * (currently AWS) and we end up showing the wrong brand on manually-created
 * incidents. Matched after normalization (lowercase + strip spaces/_/-).
 */
const NON_APP_SOURCES = new Set([
  'manual',
  'manualentry',
  'unknown',
  'custom',
  'customentry',
  'shuffle',
  'shufflesecurity',
  'system',
  'user',
  'other',
  'none',
]);

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
    if (!normalized || NON_APP_SOURCES.has(normalized)) {
      setImage(null);
      return;
    }
    let cancelled = false;
    setImage(null);
    resolveApp(source)
      .then((resolved) => {
        if (cancelled) return;
        setImage(resolved?.image || null);
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });
    return () => {
      cancelled = true;
    };
    // crossOrgId is accepted for API compatibility with previous callers,
    // but `resolveApp` already coordinates auth/apps/Algolia for the
    // active org via the shared caches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, crossOrgId]);

  return image;
};
