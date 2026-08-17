import type { MenuCategory, MenuItem } from '@/types';

export type CustomerMenuCatalog = {
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  /** Curated order of existing menu_item ids (may include unavailable). */
  recommendedItemIds: string[];
};

/** Full catalog payload from GET menu-catalog (version + body). */
export type CustomerMenuCatalogPayload = CustomerMenuCatalog & {
  version: number;
};

/** Conditional GET: same knownVersion → unchanged. */
export type CustomerMenuCatalogUnchanged = {
  version: number;
  unchanged: true;
};

export type CustomerMenuCatalogApiBody = CustomerMenuCatalogPayload | CustomerMenuCatalogUnchanged;

const CACHE_SCHEMA_VERSION = 3;
const STORAGE_KEY_PREFIX = 'mesa:customer-menu-catalog';

type CacheEntry = {
  version: number;
  restaurantId: string;
  /** Durable server menu_catalog_version — sole client freshness signal. */
  catalogVersion: number;
  catalog: CustomerMenuCatalog;
};

const memoryByRestaurantId = new Map<string, CacheEntry>();
const inFlightByRestaurantId = new Map<string, Promise<CustomerMenuCatalog>>();

function storageKey(restaurantId: string): string {
  return `${STORAGE_KEY_PREFIX}:v${CACHE_SCHEMA_VERSION}:${restaurantId}`;
}

function readStorage(restaurantId: string): CacheEntry | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed.version !== CACHE_SCHEMA_VERSION) return null;
    if (parsed.restaurantId !== restaurantId) return null;
    if (!Number.isFinite(parsed.catalogVersion)) return null;
    if (!parsed.catalog?.menuItems || !parsed.catalog?.menuCategories) return null;
    if (!Array.isArray(parsed.catalog.recommendedItemIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(entry: CacheEntry): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(entry.restaurantId), JSON.stringify(entry));
  } catch {
    // Quota or private mode — memory cache still works for the session.
  }
}

function commitEntry(
  restaurantId: string,
  catalogVersion: number,
  catalog: CustomerMenuCatalog,
): CustomerMenuCatalog {
  const entry: CacheEntry = {
    version: CACHE_SCHEMA_VERSION,
    restaurantId,
    catalogVersion,
    catalog,
  };
  memoryByRestaurantId.set(restaurantId, entry);
  writeStorage(entry);
  return catalog;
}

function readEntry(restaurantId: string): CacheEntry | null {
  const mem = memoryByRestaurantId.get(restaurantId);
  if (mem) return mem;
  const stored = readStorage(restaurantId);
  if (!stored) return null;
  memoryByRestaurantId.set(restaurantId, stored);
  return stored;
}

/** Seed client cache from SSR/demo when version is known. */
export function seedCustomerMenuCatalogCache(
  restaurantId: string,
  catalog: CustomerMenuCatalog,
  catalogVersion = 0,
): void {
  commitEntry(restaurantId, catalogVersion, catalog);
}

/** Read memory or localStorage without network (version-gated freshness is via ensure). */
export function peekCustomerMenuCatalogCache(restaurantId: string): CustomerMenuCatalog | null {
  return readEntry(restaurantId)?.catalog ?? null;
}

export function peekCustomerMenuCatalogVersion(restaurantId: string): number | null {
  const entry = readEntry(restaurantId);
  return entry ? entry.catalogVersion : null;
}

/** Drop memory + localStorage for one restaurant (or all Mesa catalog keys). */
export function clearCustomerMenuCatalogCache(restaurantId?: string): void {
  if (restaurantId) {
    memoryByRestaurantId.delete(restaurantId);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(storageKey(restaurantId));
      } catch {
        /* ignore */
      }
    }
    return;
  }
  memoryByRestaurantId.clear();
  if (typeof localStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isCustomerMenuCatalogUnchanged(
  body: CustomerMenuCatalogApiBody,
): body is CustomerMenuCatalogUnchanged {
  return 'unchanged' in body && body.unchanged === true;
}

export function parseCustomerMenuCatalogApiBody(data: unknown): CustomerMenuCatalogApiBody {
  if (!data || typeof data !== 'object') throw new Error('menu_catalog_invalid_body');
  const row = data as Record<string, unknown>;
  const version = Number(row.version);
  if (!Number.isFinite(version)) throw new Error('menu_catalog_invalid_version');
  if (row.unchanged === true) return { version, unchanged: true };
  if (
    !Array.isArray(row.menuItems) ||
    !Array.isArray(row.menuCategories) ||
    !Array.isArray(row.recommendedItemIds)
  ) {
    throw new Error('menu_catalog_invalid_body');
  }
  if (row.recommendedItemIds.some((id) => typeof id !== 'string')) {
    throw new Error('menu_catalog_invalid_body');
  }
  return {
    version,
    menuItems: row.menuItems as MenuItem[],
    menuCategories: row.menuCategories as MenuCategory[],
    recommendedItemIds: row.recommendedItemIds as string[],
  };
}

async function fetchCatalogFromApi(
  slug: string,
  knownVersion: number | null,
  forceRefresh: boolean,
): Promise<CustomerMenuCatalogApiBody> {
  const params = new URLSearchParams();
  if (!forceRefresh && knownVersion != null) {
    params.set('knownVersion', String(knownVersion));
  }
  const qs = params.toString();
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/customer/menu-catalog${qs ? `?${qs}` : ''}`,
    {
      credentials: 'include',
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error('menu_catalog_fetch_failed');
  return parseCustomerMenuCatalogApiBody(await res.json());
}

/**
 * Ensure catalog is current — compare server menu_catalog_version, full GET only on mismatch.
 * Sole network path for customer + staff-assisted catalog.
 */
export function ensureCustomerMenuCatalog(params: {
  restaurantId: string;
  slug: string;
  seed?: CustomerMenuCatalog | null;
  seedVersion?: number;
  forceRefresh?: boolean;
}): Promise<CustomerMenuCatalog> {
  if (params.seed) {
    seedCustomerMenuCatalogCache(params.restaurantId, params.seed, params.seedVersion ?? 0);
  }

  const running = inFlightByRestaurantId.get(params.restaurantId);
  if (running && !params.forceRefresh) return running;

  const knownVersion = params.forceRefresh
    ? null
    : peekCustomerMenuCatalogVersion(params.restaurantId);

  const promise = fetchCatalogFromApi(params.slug, knownVersion, Boolean(params.forceRefresh))
    .then((body) => {
      if (isCustomerMenuCatalogUnchanged(body)) {
        const cached = peekCustomerMenuCatalogCache(params.restaurantId);
        if (!cached) throw new Error('menu_catalog_unchanged_without_cache');
        commitEntry(params.restaurantId, body.version, cached);
        return cached;
      }
      return commitEntry(params.restaurantId, body.version, {
        menuItems: body.menuItems,
        menuCategories: body.menuCategories,
        recommendedItemIds: body.recommendedItemIds,
      });
    })
    .finally(() => {
      inFlightByRestaurantId.delete(params.restaurantId);
    });

  inFlightByRestaurantId.set(params.restaurantId, promise);
  return promise;
}

/**
 * Customer menu entry / attention resume: show cache immediately, then version-reconcile.
 * Sole path is {@link ensureCustomerMenuCatalog}.
 */
export function reconcileCustomerMenuCatalogOnEntry(params: {
  restaurantId: string;
  slug: string;
  seed?: CustomerMenuCatalog | null;
  seedVersion?: number;
}): {
  initial: CustomerMenuCatalog | null;
  ready: Promise<CustomerMenuCatalog>;
} {
  if (params.seed) {
    seedCustomerMenuCatalogCache(params.restaurantId, params.seed, params.seedVersion ?? 0);
  }
  const initial = peekCustomerMenuCatalogCache(params.restaurantId);
  const ready = ensureCustomerMenuCatalog({
    restaurantId: params.restaurantId,
    slug: params.slug,
  }).catch(() => {
    if (initial) return initial;
    throw new Error('menu_catalog_fetch_failed');
  });
  return { initial, ready };
}

/** Warm catalog while table detail is visible (replaces full menu page prefetch). */
export function warmCustomerMenuCatalog(params: {
  restaurantId: string;
  slug: string;
}): void {
  void ensureCustomerMenuCatalog(params).catch(() => {});
}
