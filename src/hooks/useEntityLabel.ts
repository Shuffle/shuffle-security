import { useLocation } from 'react-router-dom';
import { useMemo, useSyncExternalStore } from 'react';

export const ENTITY_OPTIONS = [
  { value: 'incidents', singular: 'Incident', plural: 'Incidents', path: '/incidents' },
  { value: 'alerts', singular: 'Alert', plural: 'Alerts', path: '/alerts' },
  { value: 'tickets', singular: 'Ticket', plural: 'Tickets', path: '/tickets' },
  { value: 'jobs', singular: 'Job', plural: 'Jobs', path: '/jobs' },
] as const;

export type EntityValue = (typeof ENTITY_OPTIONS)[number]['value'];

const STORAGE_KEY = 'shuffle-entity-label';
const DEFAULT: EntityValue = 'incidents';

// Shared external store so all consumers react to changes
const listeners = new Set<() => void>();
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot(): EntityValue {
  return (localStorage.getItem(STORAGE_KEY) as EntityValue) || DEFAULT;
}

export function setEntityPreference(value: EntityValue) {
  localStorage.setItem(STORAGE_KEY, value);
  listeners.forEach(cb => cb());
}

export function getEntityPreference(): EntityValue {
  return getSnapshot();
}

/** Returns the preferred entity labels and base path. 
 *  If currently on an alias route (/alerts, /tickets, /jobs), uses that route's labels instead. */
export function useEntityLabel() {
  const { pathname } = useLocation();
  const preference = useSyncExternalStore(subscribe, getSnapshot);

  return useMemo(() => {
    // If the current route matches an alias, use that alias's labels
    const routeMatch = ENTITY_OPTIONS.find(o => pathname.startsWith(o.path) && o.value !== 'incidents');
    if (routeMatch) {
      return { singular: routeMatch.singular, plural: routeMatch.plural, basePath: routeMatch.path };
    }
    // Otherwise use the stored preference
    const pref = ENTITY_OPTIONS.find(o => o.value === preference) || ENTITY_OPTIONS[0];
    return { singular: pref.singular, plural: pref.plural, basePath: pref.path };
  }, [pathname, preference]);
}

/** Returns just the stored preference (for sidebar/nav, not route-dependent) */
export function useEntityPreference() {
  const preference = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => {
    const pref = ENTITY_OPTIONS.find(o => o.value === preference) || ENTITY_OPTIONS[0];
    return { singular: pref.singular, plural: pref.plural, basePath: pref.path, value: pref.value };
  }, [preference]);
}
