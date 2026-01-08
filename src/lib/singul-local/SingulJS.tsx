/**
 * Local Singul Library - React Component
 * This is a local copy for development. Changes here should be merged back to:
 * https://github.com/Shuffle/singul.js
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle } from 'react';
import { algoliasearch, SearchClient } from 'algoliasearch';
import type { AlgoliaSearchApp, AppSelectedEvent, SingulJSProps, AppAuthentication } from './singul.helpers';
import './singul.css';

const ALGOLIA_APP_ID = 'JNSS5CFDZZ';
const ALGOLIA_API_KEY = 'c8f882473ff42d41158430be09ec2b4e';

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
  hitsPerPage = 15,
  apiKey,
  apiBaseUrl = 'https://shuffler.io',
  authenticatedApps: externalAuthenticatedApps,
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
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchClient = useRef<SearchClient | null>(null);

  // Fetch authenticated apps when apiKey is provided
  useEffect(() => {
    if (apiKey) {
      const fetchAuthenticatedApps = async () => {
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/apps/authentication`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              setAuthenticatedApps(data);
            }
          }
        } catch (error) {
          console.error('Failed to fetch authenticated apps:', error);
        }
      };
      fetchAuthenticatedApps();
    }
  }, [apiKey, apiBaseUrl]);

  // Auto-select authenticated apps when they're loaded
  useEffect(() => {
    if (authenticatedApps.length > 0 && results.length > 0) {
      const validAuthApps = authenticatedApps.filter(auth => auth.validation?.valid);
      const appsToAutoSelect = results.filter(app => 
        validAuthApps.some(auth => auth.app.name.toLowerCase() === app.name.toLowerCase())
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
      setTimeout(() => {
        if (searchClient.current) {
          performSearch(initialQuery);
          onSearchChange?.(initialQuery);
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

  // Check if an app is authenticated (valid)
  const isAppAuthenticated = useCallback((app: AlgoliaSearchApp) => {
    return authenticatedApps.some(
      auth => auth.app.name.toLowerCase() === app.name.toLowerCase() && auth.validation?.valid
    );
  }, [authenticatedApps]);

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
    const authUrl = `https://shuffler.io/appauth?app_id=${app.objectID}&auth=${authToken}`;
    
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
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          selectApp(results[selectedIndex]);
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
    const authenticated = isAppAuthenticated(app);

    // Use custom render if provided
    if (renderItem) {
      return (
        <div
          key={app.objectID}
          onClick={() => selectApp(app)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {renderItem(app, selected, () => selectApp(app), authenticated)}
        </div>
      );
    }

    return (
      <div
        key={app.objectID}
        className={`singul-dropdown-item ${selected ? 'singul-selected' : ''} ${authenticated ? 'singul-authenticated' : ''}`}
        style={{
          ...customStyles.dropdownItem,
          ...(selected ? customStyles.selectedItem : {}),
        }}
        onClick={() => selectApp(app)}
      >
        <div className="singul-app-info" style={customStyles.appInfo}>
          {app.image_url && (
            <div style={{ position: 'relative' }}>
              <img
                src={app.image_url}
                alt={app.name}
                className="singul-app-icon"
                style={customStyles.appIcon}
              />
              {authenticated && (
                <div className="singul-auth-badge" title="Already authenticated">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          )}
          <div className="singul-app-details" style={customStyles.appDetails}>
            <span className="singul-app-name" style={customStyles.appName}>
              {app.name.replace(/_/g, ' ')}
              {authenticated && (
                <span className="singul-auth-label">Connected</span>
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
            {results.length > 0 ? (
              results.map((app, index) => renderAppItem(app, index))
            ) : query.trim() ? (
              <div className="singul-empty-state" style={customStyles.emptyState}>
                {renderEmptyState ? (
                  renderEmptyState()
                ) : (
                  <>No apps found for "{query}"</>
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
            {results.length > 0 ? (
              results.map((app, index) => renderAppItem(app, index))
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
