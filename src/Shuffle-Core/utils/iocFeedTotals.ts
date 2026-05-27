/**
 * Shared IOC feed total helpers — used by both the IOC feeds usecase
 * outcome block (IocFeedsOutcomeBlock in views/Usecases.tsx) and the
 * "IOCs Tracked" KPI tile in components/dashboard/DashboardOverview.tsx
 * so the two counts always agree.
 *
 * Discovers `ioc_<name>` datastore categories from the org's `list_cache`
 * config and sums each category's `total_amount`.
 */

const getStoredApiKey = (): string | null => {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('shuffle_api_key')
      : null;
  } catch { return null; }
};

export const defaultIocAuthHeader = (): Record<string, string> => {
  const key = getStoredApiKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
};

export const getActiveOrgId = (): string | null => {
  try {
    const info = typeof window !== 'undefined'
      ? window.localStorage.getItem('shuffle_user_info')
      : null;
    return info ? JSON.parse(info)?.active_org?.id ?? null : null;
  } catch { return null; }
};

export interface IocFetchOpts {
  /** Base API URL (e.g. props.globalUrl). */
  baseUrl: string;
  /** Auth header provider. Defaults to localStorage `shuffle_api_key`. */
  authHeader?: () => Record<string, string>;
}

const buildHeaders = (opts: IocFetchOpts) =>
  (opts.authHeader ?? defaultIocAuthHeader)();

const fetchCategoryTotal = async (
  opts: IocFetchOpts,
  orgId: string,
  category: string,
): Promise<number> => {
  try {
    const res = await fetch(
      `${opts.baseUrl}/api/v1/orgs/${orgId}/list_cache?category=${encodeURIComponent(category)}&top=1`,
      { credentials: 'include', headers: buildHeaders(opts) },
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const n = data?.total_amount ?? data?.total ?? data?.amount ?? 0;
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  } catch { return 0; }
};

export const discoverIocCategories = async (
  opts: IocFetchOpts,
  orgId: string,
): Promise<string[]> => {
  try {
    const res = await fetch(
      `${opts.baseUrl}/api/v1/orgs/${orgId}/list_cache?category=default&top=1`,
      { credentials: 'include', headers: buildHeaders(opts) },
    );
    const data = res.ok ? await res.json() : null;
    const raw: any[] = Array.isArray(data?.categories) ? data.categories : [];
    return Array.from(new Set(
      raw
        .map((c: any) => String(typeof c === 'string' ? c : (c?.name || c?.category || '')).trim())
        .filter((name) => name.startsWith('ioc_')),
    ));
  } catch { return []; }
};

export interface IocEntry { name: string; total: number; }

export const fetchIocEntries = async (opts: IocFetchOpts): Promise<IocEntry[]> => {
  const orgId = getActiveOrgId();
  if (!orgId) return [];
  const categories = await discoverIocCategories(opts, orgId);
  const totals = await Promise.all(
    categories.map(async (category) => ({
      name: category.replace(/^ioc_/, ''),
      total: await fetchCategoryTotal(opts, orgId, category),
    })),
  );
  return totals;
};

export const sumIocEntries = (entries: IocEntry[]): number =>
  entries.reduce((s, e) => s + e.total, 0);
