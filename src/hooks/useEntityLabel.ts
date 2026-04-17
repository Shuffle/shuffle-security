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
const LOCAL_TASK_STATUSES_KEY = 'shuffle-task-statuses';
const DATASTORE_KEY = 'org_settings';
const DEFAULT: EntityValue = 'incidents';

// ---------------------------------------------------------------------------
// Task statuses (kanban lanes on /incidents-simple/<id>)
// ---------------------------------------------------------------------------
// Stored as an ordered list. The `done` lane is special (it represents
// `task.completed === true`) and must always exist — it can be renamed/recolored
// but not removed. Other lanes can be added/removed/renamed by the org.

export interface TaskStatusOption {
  /** Stable key used by the kanban routing logic. The first non-`done` key
   *  is treated as the default "todo" lane and the others act as in-progress
   *  variants. `done` is a reserved special key that maps to `completed`. */
  key: string;
  label: string;
  /** Tailwind/HSL hex — used for the lane header dot and hover ring. */
  color: string;
}

export const DEFAULT_TASK_STATUSES: TaskStatusOption[] = [
  { key: 'todo', label: 'To Do', color: '#3b82f6' },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'done', label: 'Done', color: '#22c55e' },
];

// Sidebar tab keys that can be toggled (Incidents always visible)
export const SIDEBAR_TAB_OPTIONS = [
  // Incidents children
  { key: 'threat_feeds', label: 'Threat Feeds', parent: 'incidents' },
  { key: 'ioc_types', label: 'IOC Types', parent: 'incidents' },
  { key: 'templates', label: 'Templates', parent: 'incidents' },
  { key: 'custom_fields', label: 'Custom Fields', parent: 'incidents' },
  // Detection (top-level toggle + children)
  { key: 'detection', label: 'Detection', parent: null },
  { key: 'detection_rules', label: 'Rules', parent: 'detection' },
  { key: 'detection_pipelines', label: 'Pipelines', parent: 'detection' },
  { key: 'detection_mitre', label: 'ATT&CK', parent: 'detection' },
  // Standalone top-level items
  { key: 'dashboard', label: 'Dashboard', parent: null },
  { key: 'automation', label: 'Automation', parent: null },
  { key: 'vulnerabilities', label: 'Vulnerabilities', parent: null },
  { key: 'documentation', label: 'Documentation', parent: null },
] as const;

export type SidebarTabKey = (typeof SIDEBAR_TAB_OPTIONS)[number]['key'];

// All tabs visible by default
const DEFAULT_SIDEBAR_TABS: Record<SidebarTabKey, boolean> = {
  threat_feeds: true,
  ioc_types: true,
  templates: true,
  custom_fields: true,
  detection: true,
  detection_rules: true,
  detection_pipelines: true,
  detection_mitre: true,
  dashboard: true,
  automation: true,
  vulnerabilities: true,
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
let _cachedSidebarTabs: Record<SidebarTabKey, boolean> = DEFAULT_SIDEBAR_TABS;
let _cachedSidebarTabsRaw: string | null = null;

function getSidebarTabsSnapshot(): Record<SidebarTabKey, boolean> {
  const raw = localStorage.getItem(LOCAL_SIDEBAR_TABS_KEY);
  if (raw === _cachedSidebarTabsRaw) return _cachedSidebarTabs;
  _cachedSidebarTabsRaw = raw;
  try {
    if (raw) {
      _cachedSidebarTabs = { ...DEFAULT_SIDEBAR_TABS, ...JSON.parse(raw) };
    } else {
      _cachedSidebarTabs = DEFAULT_SIDEBAR_TABS;
    }
  } catch {
    _cachedSidebarTabs = DEFAULT_SIDEBAR_TABS;
  }
  return _cachedSidebarTabs;
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
      if (data?.sidebar_tabs !== undefined) {
        localStorage.setItem(LOCAL_SIDEBAR_TABS_KEY, JSON.stringify(data.sidebar_tabs));
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

/** Save sidebar tab visibility */
export async function setSidebarTabVisibility(tabs: Record<SidebarTabKey, boolean>) {
  localStorage.setItem(LOCAL_SIDEBAR_TABS_KEY, JSON.stringify(tabs));
  listeners.forEach(cb => cb());

  try {
    let existing: Record<string, unknown> = {};
    try {
      const result = await getDatastoreItem(DATASTORE_KEY, DATASTORE_CATEGORIES.CONFIGURATION);
      if (result.success && result.item?.value) {
        existing = typeof result.item.value === 'string' ? JSON.parse(result.item.value) : result.item.value;
      }
    } catch { /* empty */ }
    await setDatastoreItem(DATASTORE_KEY, { ...existing, sidebar_tabs: tabs }, DATASTORE_CATEGORIES.CONFIGURATION);
  } catch { /* local cache is already set */ }
}

/** Hook to read sidebar tab visibility */
export function useSidebarTabs(): Record<SidebarTabKey, boolean> {
  const value = useSyncExternalStore(subscribe, getSidebarTabsSnapshot);

  useEffect(() => {
    if (!_fetchedFromServer) loadEntityPreference();
  }, []);

  return value;
}
