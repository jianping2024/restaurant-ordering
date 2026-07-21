import type { MenuCategory, MenuItem } from '@/types';

export type CustomerMenuCatalog = {
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
};

const CACHE_SCHEMA_VERSION = 1;
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const STORAGE_KEY_PREFIX = 'mesa:customer-menu-catalog';

type CacheEntry = {
  version: number;
  restaurantId: string;
  fetchedAt: number;
  catalog: CustomerMenuCatalog;
};

const memoryByRestaurantId = new Map<string, CacheEntry>();
const inFlightByRestaurantId = new Map<string, Promise<CustomerMenuCatalog>>();

function storageKey(restaurantId: string): string {
  return `${STORAGE_KEY_PREFIX}:v${CACHE_SCHEMA_VERSION}:${restaurantId}`;
}

function isFresh(entry: CacheEntry, ttlMs: number): boolean {
  return Date.now() - entry.fetchedAt < ttlMs;
}

function readStorage(restaurantId: string): CacheEntry | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed.version !== CACHE_SCHEMA_VERSION) return null;
    if (parsed.restaurantId !== restaurantId) return null;
    if (!parsed.catalog?.menuItems || !parsed.catalog?.menuCategories) return null;
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

function commitEntry(restaurantId: string, catalog: CustomerMenuCatalog): CustomerMenuCatalog {
  const entry: CacheEntry = {
    version: CACHE_SCHEMA_VERSION,
    restaurantId,
    fetchedAt: Date.now(),
    catalog,
  };
  memoryByRestaurantId.set(restaurantId, entry);
  writeStorage(entry);
  return catalog;
}

/** Seed client cache from SSR or a successful network fetch (idempotent). */
export function seedCustomerMenuCatalogCache(
  restaurantId: string,
  catalog: CustomerMenuCatalog,
): void {
  commitEntry(restaurantId, catalog);
}

/** Read memory or localStorage without network. */
export function peekCustomerMenuCatalogCache(
  restaurantId: string,
  ttlMs = DEFAULT_TTL_MS,
): CustomerMenuCatalog | null {
  const mem = memoryByRestaurantId.get(restaurantId);
  if (mem && isFresh(mem, ttlMs)) return mem.catalog;

  const stored = readStorage(restaurantId);
  if (!stored || !isFresh(stored, ttlMs)) return null;
  memoryByRestaurantId.set(restaurantId, stored);
  return stored.catalog;
}

async function fetchCatalogFromApi(slug: string): Promise<CustomerMenuCatalog> {
  const res = await fetch(`/api/restaurants/${encodeURIComponent(slug)}/customer/menu-catalog`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('menu_catalog_fetch_failed');
  const data = (await res.json()) as CustomerMenuCatalog;
  if (!Array.isArray(data.menuItems) || !Array.isArray(data.menuCategories)) {
    throw new Error('menu_catalog_invalid_body');
  }
  return data;
}

/**
 * Ensure catalog is available — memory/localStorage first, then one shared GET.
 * Used by staff overlay and optional client refresh on customer menu.
 */
export function ensureCustomerMenuCatalog(params: {
  restaurantId: string;
  slug: string;
  seed?: CustomerMenuCatalog | null;
  ttlMs?: number;
  forceRefresh?: boolean;
}): Promise<CustomerMenuCatalog> {
  const ttlMs = params.ttlMs ?? DEFAULT_TTL_MS;

  if (params.seed) {
    seedCustomerMenuCatalogCache(params.restaurantId, params.seed);
  }

  if (!params.forceRefresh) {
    const cached = peekCustomerMenuCatalogCache(params.restaurantId, ttlMs);
    if (cached) return Promise.resolve(cached);
  }

  const running = inFlightByRestaurantId.get(params.restaurantId);
  if (running) return running;

  const promise = fetchCatalogFromApi(params.slug)
    .then((catalog) => commitEntry(params.restaurantId, catalog))
    .finally(() => {
      inFlightByRestaurantId.delete(params.restaurantId);
    });

  inFlightByRestaurantId.set(params.restaurantId, promise);
  return promise;
}

/**
 * Customer menu entry: show cache immediately (SWR), always reconcile once in background.
 */
export function reconcileCustomerMenuCatalogOnEntry(params: {
  restaurantId: string;
  slug: string;
}): {
  initial: CustomerMenuCatalog | null;
  ready: Promise<CustomerMenuCatalog>;
} {
  const initial = peekCustomerMenuCatalogCache(params.restaurantId);
  const ready = fetchCatalogFromApi(params.slug)
    .then((catalog) => commitEntry(params.restaurantId, catalog))
    .catch(() => {
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
