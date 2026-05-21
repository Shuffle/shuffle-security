/**
 * Standard host-injected props passed to every Shuffle-Core component the
 * consumer mounts in multiple places (e.g. Forms, Dashboards). Mirrors the
 * legacy Shuffle convention so a single context object can be threaded through
 * any surface.
 *
 * All fields are optional so components remain usable standalone; concrete
 * components decide which ones they actually read.
 */
export interface ShuffleCoreHostProps {
  /** True when rendered during SSR (skip window/document access). */
  serverside?: boolean;
  /** True once the host has finished hydrating auth + org info. */
  isLoaded?: boolean;
  /** True when the active user session is authenticated. */
  isLoggedIn?: boolean;
  /** Backend API base URL. Overrides `getApiUrl()` defaults when provided. */
  globalUrl?: string;
  /** Userdata returned by `GET /api/v1/getinfo` (active_org, support, etc.). */
  userdata?: any;
  /** Optional theme mode forwarded through composed Shuffle surfaces. */
  theme?: 'light' | 'dark' | 'system';
  /** Legacy theme alias forwarded through composed Shuffle surfaces. */
  colorMode?: 'light' | 'dark' | 'auto';
}
