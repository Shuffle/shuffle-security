/**
 * Local Singul Library - Helpers
 * This is a local copy for development. Changes here should be merged back to:
 * https://github.com/Shuffle/singul.js
 */

export interface AlgoliaSearchApp {
  name: string;
  description: string;
  objectID: string;
  creator: string;
  app_version: string;
  image_url: string;
  time_edited: number;
  generated: boolean;
  invalid: boolean;
  priority: number;
  actions: number;
  tags: string[];
  accessible_by: string[];
  categories: string[];
  action_labels: string[];
  triggers: string[];
  verified: boolean;
}

export interface AppSelectedEvent {
  app: AlgoliaSearchApp;
  authUrl: string;
}

export interface CustomStyles {
  // Container & Input
  container?: React.CSSProperties;
  inputWrapper?: React.CSSProperties;
  input?: React.CSSProperties;
  searchIcon?: React.CSSProperties;
  loadingSpinner?: React.CSSProperties;
  spinner?: React.CSSProperties;
  
  // Dropdown
  dropdown?: React.CSSProperties;
  dropdownItem?: React.CSSProperties;
  dropdownItemHover?: React.CSSProperties;
  selectedItem?: React.CSSProperties;
  
  // App Info
  appInfo?: React.CSSProperties;
  appIcon?: React.CSSProperties;
  appDetails?: React.CSSProperties;
  appName?: React.CSSProperties;
  appDescription?: React.CSSProperties;
  appCategory?: React.CSSProperties;
  appTags?: React.CSSProperties;
  
  // Grid Layout
  gridContainer?: React.CSSProperties;
  gridItem?: React.CSSProperties;
  gridItemHover?: React.CSSProperties;
  
  // States
  emptyState?: React.CSSProperties;
  loadingState?: React.CSSProperties;
  errorState?: React.CSSProperties;
  resultsContainer?: React.CSSProperties;
  
  // Selection
  checkbox?: React.CSSProperties;
  checkboxChecked?: React.CSSProperties;
}

export interface AppAuthentication {
  app: {
    id: string;
    name: string;
    large_image: string;
  };
  fields: Array<{ key: string; value: string }>;
  id: string;
  label: string;
  /** Whether this authentication entry is active */
  active?: boolean;
  validation: {
    /** Whether the authentication has been validated (tests ran successfully) */
    valid: boolean;
    error?: string;
  };
}

export interface SingulJSProps {
  // Required
  authToken: string;
  
  // Search Input
  placeholder?: string;
  
  // Layout
  layout?: 'list' | 'grid';
  gridColumns?: number | { xs?: number; sm?: number; md?: number; lg?: number };
  
  // Display Options
  showDescription?: boolean;
  showCategories?: boolean;
  showTags?: boolean;
  showCheckbox?: boolean;
  
  // Selection
  multiSelect?: boolean;
  selectedApps?: AlgoliaSearchApp[];
  preventDefault?: boolean;
  
  // Display Mode
  /** When true, results show inline on the page instead of as a dropdown */
  inline?: boolean;
  /** Initial search query to run on mount */
  initialQuery?: string;
  /** Search query to run on mount without filling the input (placeholder-style filter) */
  initialFilterQuery?: string;
  /** Number of results per search (default: 15) */
  hitsPerPage?: number;
  
  // Authentication
  /** API key for fetching authenticated apps from /api/v1/apps/authentication */
  apiKey?: string;
  /** Base URL for Shuffle API calls (default: https://shuffler.io) */
  apiBaseUrl?: string;
  /** Base URL for Singul API calls (default: https://singul.io) */
  singulBaseUrl?: string;
  /** Manually provided authenticated apps (used when apiKey is not provided) */
  authenticatedApps?: AppAuthentication[];
  /** Hide the auth status chips (Configured/Not configured, Tested/Not tested) */
  hideAuthStatus?: boolean;
  /** Apps to pin at the top of the results (prepended, deduped by name). */
  pinnedApps?: AlgoliaSearchApp[];

  // Styling
  customStyles?: CustomStyles;
  className?: string;
  
  // Custom Rendering
  renderItem?: (app: AlgoliaSearchApp, isSelected: boolean, onSelect: () => void, authState: { configured: boolean; validated: boolean }) => React.ReactNode;
  renderEmptyState?: () => React.ReactNode;
  renderLoadingState?: () => React.ReactNode;
  
  // Events
  onAppSelected?: (detail: AppSelectedEvent) => void;
  onSelectionChange?: (apps: AlgoliaSearchApp[]) => void;
  onSearchChange?: (query: string) => void;
}
