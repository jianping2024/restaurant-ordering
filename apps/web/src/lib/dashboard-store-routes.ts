/**
 * Sole page + API path helpers for the store-scoped dashboard (multi-store plan §6.1).
 *
 * Current store = the URL slug. Dashboard pages live at `/dashboard/r/[slug]/…`; store
 * APIs live at `/api/restaurants/[slug]/…`. Everything else (nav registry, permission
 * map, path predicates) speaks **store-relative page paths**: `''` = overview,
 * `/menu`, `/settings/staff`, … (optionally with `?query`). Build hrefs only here.
 *
 * Pure — safe in middleware (Edge), server and client.
 */

/** Store-independent dashboard entry: resolves the account's store, else onboarding. */
export const DASHBOARD_ENTRY_PATH = '/dashboard';

/** Store picker (multi-store plan §8.1): store-less, like the entry. */
export const STORE_PICKER_PATH = '/dashboard/select-store';

const STORE_ROOT = '/dashboard/r';

/** Store-relative page path: `''` (overview) or `/segment[/…][?query]`. */
export type DashboardPagePath = string;

function normalizePage(page: DashboardPagePath): string {
  if (!page || page === '/') return '';
  return page.startsWith('/') || page.startsWith('?') ? page : `/${page}`;
}

/** `/dashboard/r/{slug}{page}` — the only way to build a dashboard page href. */
export function dashboardStoreHref(slug: string, page: DashboardPagePath = ''): string {
  return `${STORE_ROOT}/${encodeURIComponent(slug)}${normalizePage(page)}`;
}

/** `/api/restaurants/{slug}{path}` — the only way to build a store API URL. */
export function restaurantApiPath(slug: string, path: string): string {
  return `/api/restaurants/${encodeURIComponent(slug)}${normalizePage(path)}`;
}

export type DashboardStorePathParts = { slug: string; page: DashboardPagePath };

/** Split `/dashboard/r/{slug}{page}` (pathname, no query). Null for any other path. */
export function parseDashboardStorePath(pathname: string): DashboardStorePathParts | null {
  if (!pathname.startsWith(`${STORE_ROOT}/`)) return null;
  const rest = pathname.slice(STORE_ROOT.length + 1);
  const cut = rest.indexOf('/');
  const rawSlug = cut === -1 ? rest : rest.slice(0, cut);
  if (!rawSlug) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    return null;
  }
  const page = cut === -1 ? '' : rest.slice(cut).replace(/\/+$/, '');
  return { slug, page };
}

/** First path segments that are app namespaces, never a store slug. */
const NON_STORE_SEGMENTS = new Set(['api', 'auth', 'dashboard', 'setup', '_next']);

/**
 * Any store-scoped page (multi-store plan §6.1): dashboard `/dashboard/r/{slug}…` (with its
 * page), staff workbench `/{slug}/staff…` (not its login) and kitchen `/{slug}/kitchen…`
 * (`dashboardPage` null). Null for every other path. Middleware's sole store-page parse.
 */
export function parseStoreScopedPath(
  pathname: string,
): { slug: string; dashboardPage: DashboardPagePath | null } | null {
  const dashboard = parseDashboardStorePath(pathname);
  if (dashboard) return { slug: dashboard.slug, dashboardPage: dashboard.page };
  const match = /^\/([^/]+)\/(staff|kitchen)(?:\/([^/]*))?/.exec(pathname);
  if (!match || NON_STORE_SEGMENTS.has(match[1])) return null;
  if (match[2] === 'staff' && match[3] === 'login') return null;
  try {
    return { slug: decodeURIComponent(match[1]), dashboardPage: null };
  } catch {
    return null;
  }
}

/** Store-relative page of a dashboard pathname (null when not a store page). */
export function dashboardStorePage(pathname: string): DashboardPagePath | null {
  return parseDashboardStorePath(pathname)?.page ?? null;
}

/** True when `page` is `prefix` or below it (`''` matches only the overview). */
export function dashboardPageMatches(page: DashboardPagePath, prefix: DashboardPagePath): boolean {
  const bare = page.split('?')[0] ?? '';
  if (prefix === '') return bare === '';
  return bare === prefix || bare.startsWith(`${prefix}/`);
}
