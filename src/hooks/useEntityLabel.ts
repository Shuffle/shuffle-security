import { useLocation } from 'react-router-dom';
import { useMemo, useEffect, useCallback, useSyncExternalStore } from 'react';
import { getDatastoreItem, setDatastoreItem, DATASTORE_CATEGORIES } from '@/services/datastore';

export const ENTITY_OPTIONS = [
  { value: 'incidents', singular: 'Incident', plural: 'Incidents', path: '/incidents' },
  { value: 'alerts', singular: 'Alert', plural: 'Alerts', path: '/alerts' },
  { value: 'tickets', singular: 'Ticket', plural: 'Tickets', path: '/tickets' },
  { value: 'jobs', singular: 'Job', plural: 'Jobs', path: '/jobs' },
] as const;

export type EntityValue = (typeof ENTITY_OPTIONS)[number]['value'];

const LOCAL_CACHE_KEY = 'shuffle-entity-label';
const LOCAL_AUTOMATION_KEY = 'shuffle-show-automation';
const LOCAL_SIDEBAR_TABS_KEY = 'shuffle-sidebar-tabs';
const DATASTORE_KEY = 'org_settings';
const DEFAULT: EntityValue = 'incidents';

// Sidebar tab keys that can be toggled (Incidents always visible)
export const SIDEBAR_TAB_OPTIONS = [
  { key: 'threat_feeds', label: 'Threat Feeds' },
  { key: 'ioc_types', label: 'IOC Types' },
  { key: 'templates', label: 'Templates' },
  { key: 'custom_fields', label: 'Custom Fields' },
  { key: 'detection', label: 'Detection' },
  { key: 'automation', label: 'Automation' },
  { key: 'documentation', label: 'Documentation' },
] as const;

export type SidebarTabKey = (typeof SIDEBAR_TAB_OPTIONS)[number]['key'];

// All tabs visible by default
const DEFAULT_SIDEBAR_TABS: Record<SidebarTabKey, boolean> = {
  threat_feeds: true,
  ioc_types: true,
  templates: true,
  custom_fields: true,
  detection: true,
  automation: true,
  documentation: true,
};

// Shared external store so all consumers react to changes instantly
const listeners = new Set<() => void>();
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot(): EntityValue {
  return (localStorage.getItem(LOCAL_CACHE_KEY) as EntityValue) || DEFAULT;
}
function getAutomationSnapshot(): boolean {
  const val = localStorage.getItem(LOCAL_AUTOMATION_KEY);
  return val === null ? true : val === 'true';
}

let _fetchedFromServer = false;

/** Load org setting from datastore and sync to local cache */
export async function loadEntityPreference() {
  try {
    const result = await getDatastoreItem(DATASTORE_KEY, DATASTORE_CATEGORIES.CONFIGURATION);
    if (result.success && result.item?.value) {
      const data = typeof result.item.value === 'string' ? JSON.parse(result.item.value) : result.item.value;
      const val = data?.entity_label;
      if (val && ENTITY_OPTIONS.some(o => o.value === val)) {
        localStorage.setItem(LOCAL_CACHE_KEY, val);
      }
      if (data?.show_automation !== undefined) {
        localStorage.setItem(LOCAL_AUTOMATION_KEY, String(data.show_automation));
      }
      listeners.forEach(cb => cb());
    }
    _fetchedFromServer = true;
  } catch {
    // keep local cache
  }
}

/** Save preference to both local cache and org datastore */
export async function setEntityPreference(value: EntityValue) {
  localStorage.setItem(LOCAL_CACHE_KEY, value);
  listeners.forEach(cb => cb());

  try {
    // Read existing org_settings, merge, and save
    let existing: Record<string, unknown> = {};
    try {
      const result = await getDatastoreItem(DATASTORE_KEY, DATASTORE_CATEGORIES.CONFIGURATION);
      if (result.success && result.item?.value) {
        existing = typeof result.item.value === 'string' ? JSON.parse(result.item.value) : result.item.value;
      }
    } catch { /* empty */ }
    await setDatastoreItem(DATASTORE_KEY, { ...existing, entity_label: value }, DATASTORE_CATEGORIES.CONFIGURATION);
  } catch {
    // local cache is already set, datastore save failed silently
  }
}

export function getEntityPreference(): EntityValue {
  return getSnapshot();
}

/** Save automation visibility preference */
export async function setShowAutomation(show: boolean) {
  localStorage.setItem(LOCAL_AUTOMATION_KEY, String(show));
  listeners.forEach(cb => cb());

  try {
    let existing: Record<string, unknown> = {};
    try {
      const result = await getDatastoreItem(DATASTORE_KEY, DATASTORE_CATEGORIES.CONFIGURATION);
      if (result.success && result.item?.value) {
        existing = typeof result.item.value === 'string' ? JSON.parse(result.item.value) : result.item.value;
      }
    } catch { /* empty */ }
    await setDatastoreItem(DATASTORE_KEY, { ...existing, show_automation: show }, DATASTORE_CATEGORIES.CONFIGURATION);
  } catch { /* local cache is already set */ }
}

/** Hook to read automation visibility preference */
export function useShowAutomation(): boolean {
  const value = useSyncExternalStore(subscribe, getAutomationSnapshot);

  useEffect(() => {
    if (!_fetchedFromServer) loadEntityPreference();
  }, []);

  return value;
}

/** Returns the preferred entity labels and base path.
 *  If currently on an alias route (/alerts, /tickets, /jobs), uses that route's labels instead. */
export function useEntityLabel() {
  const { pathname } = useLocation();
  const preference = useSyncExternalStore(subscribe, getSnapshot);

  // Load from server on first mount
  useEffect(() => {
    if (!_fetchedFromServer) loadEntityPreference();
  }, []);

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

  useEffect(() => {
    if (!_fetchedFromServer) loadEntityPreference();
  }, []);

  return useMemo(() => {
    const pref = ENTITY_OPTIONS.find(o => o.value === preference) || ENTITY_OPTIONS[0];
    return { singular: pref.singular, plural: pref.plural, basePath: pref.path, value: pref.value };
  }, [preference]);
}
