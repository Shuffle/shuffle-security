/**
 * Local Singul Library - React Component
 * This is a local copy for development. Changes here should be merged back to:
 * https://github.com/Shuffle/singul.js
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle } from 'react';
import { algoliasearch, SearchClient } from 'algoliasearch';
import { Tooltip } from '@mui/material';
import type { AlgoliaSearchApp, AppSelectedEvent, ShuffleMCPProps, AppAuthentication } from './shuffle-mcp.helpers';
import AppDetailDrawer from './AppDetailDrawer';
import './shuffle-mcp.css';
import { fetchApps } from './appsCache';

const DEFAULT_ALGOLIA_APP_ID = 'JNSS5CFDZZ';
const DEFAULT_ALGOLIA_API_KEY = '33e4e3564f4f060e96e0531957bed552';
const DEFAULT_ALGOLIA_INDEX = 'appsearch';
const EMPTY_SELECTED_APPS: AlgoliaSearchApp[] = [];

export interface ShuffleMCPHandle {
  search: (query: string) => void;
  clear: () => void;
}

export const ShuffleMCP = React.forwardRef<ShuffleMCPHandle, ShuffleMCPProps>(({
  authToken,
  orgId,
  placeholder = 'Search apps...',
  layout = 'list',
  gridColumns = 3,
  showDescription = false,
  showCategories = false,
  showCheckbox = false,
  multiSelect = false,
  selectedApps = EMPTY_SELECTED_APPS,
  preventDefault = false,
  inline = false,
  initialQuery = '',
  initialFilterQuery,
  hitsPerPage = 15,
  apiKey,
  apiBaseUrl = 'https://shuffler.io',
  authPath = '/api/v1/apps/authentication',
  appAuthPath = '/appauth',
  privateAppsPath = '/api/v1/apps',
  disablePrivateApps = false,
  showSourceFilter = true,
  singulBaseUrl = 'https://singul.io',
  hideAuthStatus = false,
  authenticatedApps: externalAuthenticatedApps,
  pinnedApps,
  algoliaAppId = DEFAULT_ALGOLIA_APP_ID,
  algoliaApiKey = DEFAULT_ALGOLIA_API_KEY,
  algoliaIndexName = DEFAULT_ALGOLIA_INDEX,
  customStyles = {},
  className = '',
  renderItem,
  renderEmptyState,
  renderLoadingState,
  onAppSelected,
  onSelectionChange,
  onSearchChange,
}, ref) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AlgoliaSearchApp[]>([]);
  const [privateApps, setPrivateApps] = useState<AlgoliaSearchApp[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'public' | 'private' | 'authenticated'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [internalSelectedApps, setInternalSelectedApps] = useState<AlgoliaSearchApp[]>(selectedApps);
  const [authenticatedApps, setAuthenticatedApps] = useState<AppAuthentication[]>(externalAuthenticatedApps || []);
  const [drawerApp, setDrawerApp] = useState<AlgoliaSearchApp | null>(null);
  const hasInitialized = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchClient = useRef<SearchClient | null>(null);

  // Fetch authenticated apps when apiKey is provided
  const fetchAuthenticatedApps = useCallback(async () => {
    if (!apiKey) return;
    try {
      const response = await fetch(`${apiBaseUrl}${authPath}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...(orgId ? { 'Org-Id': orgId } : {}),
        },
      });
      if (response.ok) {
        const result = await response.json();
        const authData = result.data || result;
        if (Array.isArray(authData)) {
          setAuthenticatedApps(authData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch authenticated apps:', error);
    }
  }, [apiKey, apiBaseUrl, authPath, orgId]);

  useEffect(() => {
    fetchAuthenticatedApps();
  }, [fetchAuthenticatedApps]);

  // Fetch the user's private apps from /api/v1/apps when apiKey is provided.
  // These get merged into search results so users can find their own apps too.
  useEffect(() => {
    if (disablePrivateApps) {
      setPrivateApps([]);
      return;
    }
    const fetchPrivateApps = async () => {
      try {
        const apps = await fetchApps({
          baseUrl: apiBaseUrl,
          path: privateAppsPath,
          apiKey: apiKey || null,
          orgId: orgId || null,
        });
        // Normalize to AlgoliaSearchApp shape, tagged as 'private' source.
        const normalized: AlgoliaSearchApp[] = apps.map((a: any) => ({
          name: a.name || '',
          description: a.description || '',
          objectID: a.id || a.objectID || `private-${a.name}`,
          creator: a.owner || a.creator || '',
          app_version: a.app_version || '1.0.0',
          image_url: a.large_image || a.image_url || '',
          time_edited: a.edited || 0,
          generated: !!a.generated,
          invalid: !!a.invalid,
          priority: a.priority || 0,
          actions: Array.isArray(a.actions) ? a.actions.length : (a.actions || 0),
          tags: a.tags || [],
          accessible_by: a.accessible_by || [],
          categories: a.categories || [],
          action_labels: a.action_labels || [],
          triggers: a.triggers || [],
          verified: !!a.verified,
          source: 'private',
        }));
        setPrivateApps(normalized);
      } catch (error) {
        console.error('Failed to fetch private apps:', error);
      }
    };
    fetchPrivateApps();
  }, [apiKey, apiBaseUrl, privateAppsPath, disablePrivateApps, orgId]);

  // Auto-select validated apps when they're loaded (validated = tests ran successfully)
  useEffect(() => {
    if (authenticatedApps.length > 0 && results.length > 0) {
      const validatedApps = authenticatedApps.filter(auth => auth.validation?.valid);
      const appsToAutoSelect = results.filter(app => 
        validatedApps.some(auth => auth.app.name.toLowerCase() === app.name.toLowerCase())
      );
      
      if (appsToAutoSelect.length > 0) {
        const newSelection = [...internalSelectedApps];
        appsToAutoSelect.forEach(app => {
          if (!newSelection.some(a => a.objectID === app.objectID)) {
            newSelection.push(app);
          }
        });
        if (newSelection.length !== internalSelectedApps.length) {
          setInternalSelectedApps(newSelection);
          onSelectionChange?.(newSelection);
        }
      }
    }
  }, [authenticatedApps, results]);

  // Sync external authenticatedApps
  useEffect(() => {
    if (externalAuthenticatedApps) {
      setAuthenticatedApps(externalAuthenticatedApps);
    }
  }, [externalAuthenticatedApps]);

  // Initialize Algolia client and run initial search
  useEffect(() => {
    searchClient.current = algoliasearch(algoliaAppId, algoliaApiKey);
    
    // Run initial search after client is ready
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const searchTerm = initialQuery || initialFilterQuery || '';
      setTimeout(() => {
        if (searchClient.current) {
          performSearch(searchTerm);
          onSearchChange?.(initialQuery); // Only report the visible query
        }
      }, 100);
    }
  }, []);

  // Sync external selectedApps
  useEffect(() => {
    setInternalSelectedApps(selectedApps);
  }, [selectedApps]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Check if an app is configured (found in authentication API with active: true)
  const isAppConfigured = useCallback((app: AlgoliaSearchApp) => {
    return authenticatedApps.some(
      auth => auth.app.name.toLowerCase() === app.name.toLowerCase() && auth.active === true
    );
  }, [authenticatedApps]);

  // Check if an app is validated/tested (validation.valid is true)
  const isAppValidated = useCallback((app: AlgoliaSearchApp) => {
    return authenticatedApps.some(
      auth => auth.app.name.toLowerCase() === app.name.toLowerCase() && auth.validation?.valid === true
    );
  }, [authenticatedApps]);

  // Get auth state for an app
  const getAppAuthState = useCallback((app: AlgoliaSearchApp) => {
    return {
      configured: isAppConfigured(app),
      validated: isAppValidated(app),
    };
  }, [isAppConfigured, isAppValidated]);

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchClient.current) {
      return;
    }

    setIsLoading(true);
    try {
      const searchResult = await searchClient.current.searchSingleIndex({
        indexName: algoliaIndexName,
        searchParams: {
          query: searchQuery || '', // Empty string gets top results
          hitsPerPage,
        },
      });

      const hits = (searchResult.hits as AlgoliaSearchApp[]).map(h => ({ ...h, source: 'public' as const }));
      setResults(hits);
      // Open dropdown if we got Algolia hits OR we have private apps to show
      setIsOpen(hits.length > 0 || privateApps.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      // Algolia rate-limit (429) or network error: don't blank out the dropdown
      // if we still have private apps to show from /api/v1/apps.
      console.error('Search failed:', error);
      setResults([]);
      setIsOpen(privateApps.length > 0);
    } finally {
      setIsLoading(false);
    }
  }, [hitsPerPage, algoliaIndexName, privateApps.length]);

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    search: (searchQuery: string) => {
      setQuery(searchQuery);
      onSearchChange?.(searchQuery);
      performSearch(searchQuery);
    },
    clear: () => {
      setQuery('');
      performSearch(''); // Show top results when cleared
    },
    getQuery: () => query,
  }), [performSearch, onSearchChange, query]);

  // Handle input change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    onSearchChange?.(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [performSearch, onSearchChange]);

  // Handle app selection
  const selectApp = useCallback((app: AlgoliaSearchApp, event?: React.MouseEvent) => {
    const handoffToken = apiKey || authToken || '';
    const authUrl = `${apiBaseUrl}${appAuthPath}?app_id=${app.objectID}&auth=${handoffToken}&source=shuffle${orgId ? `&org_id=${encodeURIComponent(orgId)}` : ''}`;

    if (multiSelect) {
      const isAlreadySelected = internalSelectedApps.some((a) => a.objectID === app.objectID);
      const newSelection = isAlreadySelected
        ? internalSelectedApps.filter((a) => a.objectID !== app.objectID)
        : [...internalSelectedApps, app];

      setInternalSelectedApps(newSelection);
      onSelectionChange?.(newSelection);
    } else {
      // If consumer wired up onAppSelected, defer entirely to them.
      if (onAppSelected) {
        onAppSelected({ app, authUrl, ctrlKey: event?.ctrlKey, metaKey: event?.metaKey });
        if (!preventDefault) {
          window.open(authUrl, '_blank');
        }
      } else if (!preventDefault) {
        // New default: open built-in side drawer with the app + its existing
        // authentications, instead of popping a new tab to shuffler.io.
        setDrawerApp(app);
      }

      setIsOpen(false);
    }
  }, [authToken, apiKey, apiBaseUrl, appAuthPath, orgId, multiSelect, internalSelectedApps, onAppSelected, onSelectionChange, preventDefault]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, displayResults.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && displayResults[selectedIndex]) {
          selectApp(displayResults[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, results, selectedIndex, selectApp]);

  // Check if app is selected
  const isAppSelected = useCallback((app: AlgoliaSearchApp) => {
    return internalSelectedApps.some((a) => a.objectID === app.objectID);
  }, [internalSelectedApps]);

  // Filter the user's private apps client-side by the current query.
  const filteredPrivateApps = useMemo(() => {
    if (privateApps.length === 0) return [];
    const q = query.trim().toLowerCase();
    if (!q) return privateApps;
    return privateApps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.categories || []).some(c => c.toLowerCase().includes(q))
    );
  }, [privateApps, query]);

  // Merge private + public apps, apply source filter, prepend pinned, dedupe by name.
  const displayResults = useMemo(() => {
    const norm = (n: string) => (n || '').toLowerCase().replace(/[\s_\-]+/g, '');

    let merged: AlgoliaSearchApp[];
    if (sourceFilter === 'public') {
      merged = results;
    } else if (sourceFilter === 'private') {
      merged = filteredPrivateApps;
    } else if (sourceFilter === 'authenticated') {
      const privateNames = new Set(filteredPrivateApps.map(a => norm(a.name)));
      const publicOnly = results.filter(a => !privateNames.has(norm(a.name)));
      merged = [...filteredPrivateApps, ...publicOnly].filter(isAppConfigured);
    } else {
      // 'all' — private apps first (your own tools win), then public, deduped by name
      const privateNames = new Set(filteredPrivateApps.map(a => norm(a.name)));
      const publicOnly = results.filter(a => !privateNames.has(norm(a.name)));
      merged = [...filteredPrivateApps, ...publicOnly];
    }

    if (!pinnedApps || pinnedApps.length === 0) return merged;
    const pinnedNames = new Set(pinnedApps.map(a => norm(a.name)));
    return [...pinnedApps, ...merged.filter(a => !pinnedNames.has(norm(a.name)))];
  }, [pinnedApps, results, filteredPrivateApps, sourceFilter, isAppConfigured]);

  // Get grid columns style
  const getGridColumnsStyle = useMemo(() => {
    if (layout !== 'grid') return {};
    
    const cols = typeof gridColumns === 'number' ? gridColumns : gridColumns.md || 3;
    return { '--singul-grid-columns': cols } as React.CSSProperties;
  }, [layout, gridColumns]);

  // Render individual app item
  const renderAppItem = (app: AlgoliaSearchApp, index: number) => {
    const selected = isAppSelected(app);
    const isHighlighted = index === selectedIndex;
    const authState = getAppAuthState(app);

    // Use custom render if provided
    if (renderItem) {
      return (
        <div
          key={app.objectID}
          onClick={(e) => selectApp(app, e)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {renderItem(app, selected, () => selectApp(app), authState)}
        </div>
      );
    }

    // Show both chips (configured/not configured AND tested/not tested)
    return (
      <div
        key={app.objectID}
        className={`singul-dropdown-item ${selected ? 'singul-selected' : ''} ${authState.validated ? 'singul-validated' : ''} ${authState.configured ? 'singul-configured' : ''}`}
        data-app-name={app.name}
        data-object-id={app.objectID}
        style={{
          ...customStyles.dropdownItem,
          ...(selected ? customStyles.selectedItem : {}),
        }}
        onClick={() => selectApp(app)}
      >
        <div className="singul-app-info" style={customStyles.appInfo}>
          {app.image_url && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={app.image_url}
                alt={app.name}
                className="singul-app-icon"
                style={customStyles.appIcon}
              />
              {/* Color-coded status dot: green=tested, yellow=configured, blue=activated/selected, gray=inactive */}
              {!hideAuthStatus && (
                <span
                  className={`singul-status-dot ${
                    authState.validated ? 'singul-dot-validated' :
                    authState.configured ? 'singul-dot-configured' :
                    selected ? 'singul-dot-activated' :
                    'singul-dot-inactive'
                  }`}
                />
              )}
            </div>
          )}
          <div className="singul-app-details" style={customStyles.appDetails}>
            <span className="singul-app-name" style={customStyles.appName}>
              {app.name.replace(/_/g, ' ')}
              {app.source === 'private' && (
                <Tooltip
                  title="Private apps are apps you have activated in your organization, or your own custom apps — not just from the public Algolia catalog."
                  arrow
                  enterDelay={100}
                  enterNextDelay={100}
                  placement="top"
                  slotProps={{ popper: { style: { zIndex: 10000 } } }}
                >
                  <span className="singul-private-badge">Private</span>
                </Tooltip>
              )}
            </span>
            {showDescription && app.description && (
              <span className="singul-app-description" style={customStyles.appDescription}>
                {app.description}
              </span>
            )}
            {showCategories && app.categories?.[0] && (
              <span className="singul-app-category" style={customStyles.appCategory}>
                {app.categories[0]}
              </span>
            )}
          </div>
          {showCheckbox && (
            <div
              className={`singul-checkbox ${selected ? 'singul-checked' : ''}`}
              style={selected ? customStyles.checkboxChecked : customStyles.checkbox}
            >
              {selected && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`singul-container ${inline ? 'singul-inline' : ''} ${className}`}
      style={customStyles.container}
    >
      <div className="singul-search-bar-container">
        <div className="singul-search-input-wrapper" style={customStyles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            className="singul-search-input"
            style={customStyles.input}
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (!inline && query.trim() && results.length > 0) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <div className="singul-search-icon" style={customStyles.searchIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          {isLoading && (
            <div className="singul-loading-spinner" style={customStyles.loadingSpinner}>
              {renderLoadingState ? (
                renderLoadingState()
              ) : (
                <div className="singul-spinner" style={customStyles.spinner} />
              )}
            </div>
          )}
        </div>

        {/* Source filter — only shown when private apps are loaded */}
        {showSourceFilter && privateApps.length > 0 && (
          <div className="singul-source-filter" role="tablist" aria-label="Filter by app source">
            {([
              { key: 'all', label: 'All', count: results.length + filteredPrivateApps.length, title: 'All available apps — both the public catalog and your private apps.' },
              { key: 'public', label: 'Public', count: results.length, title: 'Public apps from the Shuffle catalog (powered by Algolia).' },
              { key: 'private', label: 'Private', count: filteredPrivateApps.length, title: 'Private apps are apps you have activated in your organization, or your own custom apps — not just from the public Algolia catalog.' },
              { key: 'authenticated', label: 'Authenticated', count: [...filteredPrivateApps, ...results].filter((a, i, arr) => arr.findIndex(x => x.name?.toLowerCase() === a.name?.toLowerCase()) === i).filter(isAppConfigured).length, title: 'Apps you have authenticated and that are ready to use.' },
            ] as const).map(opt => (
              <Tooltip
                key={opt.key}
                title={opt.title}
                arrow
                enterDelay={100}
                enterNextDelay={100}
                placement="top"
                slotProps={{ popper: { style: { zIndex: 10000 } } }}
              >
                <span style={{ display: 'inline-flex' }}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceFilter === opt.key}
                    className={`singul-source-pill ${sourceFilter === opt.key ? 'singul-source-pill-active' : ''}`}
                    onClick={() => setSourceFilter(opt.key)}
                  >
                    {opt.label}
                    <span className="singul-source-count">{opt.count}</span>
                  </button>
                </span>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Inline Results Container */}
        {inline && (
          <div
            className={`singul-results-container ${layout === 'grid' ? 'singul-results-grid' : ''}`}
            style={{
              ...customStyles.resultsContainer,
              ...getGridColumnsStyle,
              ...(layout === 'grid' ? { display: 'grid' } : {}),
            }}
          >
            {displayResults.length > 0 ? (
              <>
                {displayResults.map((app, index) => renderAppItem(app, index))}
                <div className="singul-end-of-results" style={{
                  padding: '10px 16px',
                  color: 'hsl(var(--foreground) / 0.3)',
                  textAlign: 'center' as const,
                  fontSize: '11px',
                  gridColumn: '1 / -1',
                }}>
                  Can't find what you're looking for? Try a different search term.
                </div>
              </>
            ) : query.trim() ? (
              <div className="singul-empty-state" style={customStyles.emptyState}>
                {renderEmptyState ? (
                  renderEmptyState()
                ) : (
                  <>No integrations match "{query}". Try searching for a different app or category.</>
                )}
              </div>
            ) : (
              <div className="singul-empty-state" style={customStyles.emptyState}>
                Start typing to search integrations...
              </div>
            )}
          </div>
        )}

        {/* Dropdown Results (non-inline mode) */}
        {!inline && isOpen && (
          <div
            className={`singul-dropdown ${layout === 'grid' ? 'singul-dropdown-grid' : ''}`}
            style={{
              ...customStyles.dropdown,
              ...getGridColumnsStyle,
              ...(layout === 'grid' ? { display: 'grid' } : {}),
            }}
          >
            {displayResults.length > 0 ? (
              displayResults.map((app, index) => renderAppItem(app, index))
            ) : (
              <div className="singul-empty-state" style={customStyles.emptyState}>
                {renderEmptyState ? (
                  renderEmptyState()
                ) : (
                  <>No apps found for "{query}"</>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Built-in app config drawer — same drawer used by /incidents Add ingestion source */}
      {drawerApp && (
        <AppDetailDrawer
          open={true}
          appName={drawerApp.name}
          anchor="right"
          width={560}
          onClose={() => setDrawerApp(null)}
          onRefresh={fetchAuthenticatedApps}
        />
      )}
    </div>
  );
});

ShuffleMCP.displayName = 'ShuffleMCP';

export default ShuffleMCP;
