/**
 * Local Singul Library - React Component
 * This is a local copy for development. Changes here should be merged back to:
 * https://github.com/Shuffle/singul.js
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle } from 'react';
import { algoliasearch, SearchClient } from 'algoliasearch';
import type { AlgoliaSearchApp, AppSelectedEvent, SingulJSProps, AppAuthentication } from './singul.helpers';
import './singul.css';

const DEFAULT_ALGOLIA_APP_ID = 'JNSS5CFDZZ';
const DEFAULT_ALGOLIA_API_KEY = '33e4e3564f4f060e96e0531957bed552';
const DEFAULT_ALGOLIA_INDEX = 'appsearch';

export interface SingulJSHandle {
  search: (query: string) => void;
  clear: () => void;
}

export const SingulJS = React.forwardRef<SingulJSHandle, SingulJSProps>(({
  authToken,
  placeholder = 'Search apps...',
  layout = 'list',
  gridColumns = 3,
  showDescription = false,
  showCategories = false,
  showCheckbox = false,
  multiSelect = false,
  selectedApps = [],
  preventDefault = false,
  inline = false,
  initialQuery = '',
  initialFilterQuery,
  hitsPerPage = 15,
  apiKey,
  apiBaseUrl = 'https://shuffler.io',
  authPath = '/api/v1/apps/authentication',
  appAuthPath = '/appauth',
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
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [internalSelectedApps, setInternalSelectedApps] = useState<AlgoliaSearchApp[]>(selectedApps);
  const [authenticatedApps, setAuthenticatedApps] = useState<AppAuthentication[]>(externalAuthenticatedApps || []);
  const hasInitialized = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchClient = useRef<SearchClient | null>(null);

  // Fetch authenticated apps when apiKey is provided
  useEffect(() => {
    if (apiKey) {
      const fetchAuthenticatedApps = async () => {
        try {
          const response = await fetch(`${apiBaseUrl}${authPath}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          });
          if (response.ok) {
            const result = await response.json();
            // Handle both { success: true, data: [...] } and direct array response
            const authData = result.data || result;
            if (Array.isArray(authData)) {
              console.log('Loaded authenticated apps:', authData.length, authData.map(a => a.app?.name));
              setAuthenticatedApps(authData);
            }
          }
        } catch (error) {
          console.error('Failed to fetch authenticated apps:', error);
        }
      };
      fetchAuthenticatedApps();
    }
  }, [apiKey, apiBaseUrl]);

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
    searchClient.current = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
    
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
        indexName: 'appsearch',
        searchParams: {
          query: searchQuery || '', // Empty string gets top results
          hitsPerPage,
        },
      });

      const hits = searchResult.hits as AlgoliaSearchApp[];
      setResults(hits);
      setIsOpen(hits.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [hitsPerPage]);

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
  const selectApp = useCallback((app: AlgoliaSearchApp) => {
    const authUrl = `https://shuffler.io/appauth?app_id=${app.objectID}&auth=${authToken}&source=shuffle`;
    
    if (multiSelect) {
      const isAlreadySelected = internalSelectedApps.some((a) => a.objectID === app.objectID);
      const newSelection = isAlreadySelected
        ? internalSelectedApps.filter((a) => a.objectID !== app.objectID)
        : [...internalSelectedApps, app];
      
      setInternalSelectedApps(newSelection);
      onSelectionChange?.(newSelection);
    } else {
      onAppSelected?.({ app, authUrl });
      
      if (!preventDefault) {
        window.open(authUrl, '_blank');
      }
      
      setIsOpen(false);
      setQuery('');
      setResults([]);
    }
  }, [authToken, multiSelect, internalSelectedApps, onAppSelected, onSelectionChange, preventDefault]);

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

  // Merge pinned apps at the top of the results, deduped by normalized name
  const displayResults = useMemo(() => {
    if (!pinnedApps || pinnedApps.length === 0) return results;
    const norm = (n: string) => (n || '').toLowerCase().replace(/[\s_\-]+/g, '');
    const pinnedNames = new Set(pinnedApps.map(a => norm(a.name)));
    const filtered = results.filter(a => !pinnedNames.has(norm(a.name)));
    return [...pinnedApps, ...filtered];
  }, [pinnedApps, results]);

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
          onClick={() => selectApp(app)}
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
                  color: 'rgba(255, 255, 255, 0.3)',
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
    </div>
  );
});

SingulJS.displayName = 'SingulJS';

export default SingulJS;
