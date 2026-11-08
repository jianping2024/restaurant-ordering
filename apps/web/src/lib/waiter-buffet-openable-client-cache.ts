/**
 * Staff「可开套餐」client cache — same ensure pattern as customer menu catalog:
 * paint from cache, compare buffet_config_version + current slot, full GET only on mismatch.
 */

import type { CheckoutEntrySignals } from '@/lib/buffet-checkout-entry';
import type { ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import { fetchWithDependencyTimeout } from '@/lib/dependency-unavailable';

export type WaiterOpenableCacheEntry = {
  version: number;
  slotKey: string;
  openableBuffetIds: string[];
  /** Adult/child prices for `openableBuffetIds`. Same snapshot as the ids. */
  pricesByBuffetId: Record<string, ResolvedBuffetPriceRow>;
  /** Active buffets' `min_guest_count` — sole floor source, same version as prices. */
  minGuestCountByBuffetId: Record<string, number>;
};

export type WaiterOpenableEnsureResult = {
  openableBuffetIds: string[];
  pricesByBuffetId: Record<string, ResolvedBuffetPriceRow>;
  minGuestCountByBuffetId: Record<string, number>;
  version: number;
  slotKey: string;
  checkoutEntry: CheckoutEntrySignals | null;
  unchanged: boolean;
};

/** Bumped when the cached snapshot shape changes (2: prices, 3: adult/child toggles, 4: minimums). */
const CACHE_SCHEMA_VERSION = 4;
const STORAGE_KEY_PREFIX = 'mesa:waiter-buffet-openable';

const memoryByRestaurantId = new Map<string, WaiterOpenableCacheEntry>();
const inFlightByKey = new Map<string, Promise<WaiterOpenableEnsureResult>>();

function storageKey(restaurantId: string): string {
  return `${STORAGE_KEY_PREFIX}:v${CACHE_SCHEMA_VERSION}:${restaurantId}`;
}

function flightKey(restaurantId: string, tableId: string | null): string {
  return `${restaurantId}:${tableId ?? ''}`;
}

function readStorage(restaurantId: string): WaiterOpenableCacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WaiterOpenableCacheEntry> & { schema?: number };
    if (parsed.schema !== CACHE_SCHEMA_VERSION) return null;
    if (!Number.isFinite(parsed.version) || typeof parsed.slotKey !== 'string') return null;
    if (!Array.isArray(parsed.openableBuffetIds)) return null;
    const pricesByBuffetId = parseCachedPrices(parsed.pricesByBuffetId);
    if (!pricesByBuffetId) return null;
    const minGuestCountByBuffetId = parseMinGuestCounts(parsed.minGuestCountByBuffetId);
    if (!minGuestCountByBuffetId) return null;
    const openableBuffetIds = parsed.openableBuffetIds
      .map(String)
      .filter((id) => pricesByBuffetId[id]);
    return {
      version: Number(parsed.version),
      slotKey: parsed.slotKey,
      openableBuffetIds,
      pricesByBuffetId,
      minGuestCountByBuffetId,
    };
  } catch {
    return null;
  }
}

function writeStorage(restaurantId: string, entry: WaiterOpenableCacheEntry): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey(restaurantId),
      JSON.stringify({ schema: CACHE_SCHEMA_VERSION, ...entry }),
    );
  } catch {
    // Quota / private mode — memory cache still works.
  }
}

export function peekWaiterOpenableCache(restaurantId: string): WaiterOpenableCacheEntry | null {
  const mem = memoryByRestaurantId.get(restaurantId);
  if (mem) return mem;
  const stored = readStorage(restaurantId);
  if (stored) memoryByRestaurantId.set(restaurantId, stored);
  return stored;
}

function commitWaiterOpenableCache(
  restaurantId: string,
  entry: WaiterOpenableCacheEntry,
): WaiterOpenableCacheEntry {
  memoryByRestaurantId.set(restaurantId, entry);
  writeStorage(restaurantId, entry);
  return entry;
}

type WaiterOpenableApiBody =
  | {
      unchanged: true;
      version: number;
      slot_key: string;
      checkout_entry?: unknown;
    }
  | {
      unchanged?: false;
      version: number;
      slot_key: string;
      buffet_ids: string[];
      prices: Record<string, ResolvedBuffetPriceRow>;
      min_guest_count: Record<string, number>;
      checkout_entry?: unknown;
    };

function parseWaiterOpenableApiBody(raw: unknown): WaiterOpenableApiBody {
  if (!raw || typeof raw !== 'object') throw new Error('buffet_openable_invalid_body');
  const row = raw as Record<string, unknown>;
  const version = Number(row.version);
  const slotKey = typeof row.slot_key === 'string' ? row.slot_key : '';
  if (!Number.isFinite(version) || !slotKey) throw new Error('buffet_openable_invalid_version');
  if (row.unchanged === true) {
    return { unchanged: true, version, slot_key: slotKey, checkout_entry: row.checkout_entry };
  }
  if (!Array.isArray(row.buffet_ids)) throw new Error('buffet_openable_invalid_ids');
  const prices = parseCachedPrices(row.prices);
  if (!prices) throw new Error('buffet_openable_invalid_prices');
  const minGuestCount = parseMinGuestCounts(row.min_guest_count);
  if (!minGuestCount) throw new Error('buffet_openable_invalid_min_guest_count');
  const buffetIds = row.buffet_ids.map(String).filter((id) => prices[id]);
  return {
    version,
    slot_key: slotKey,
    buffet_ids: buffetIds,
    prices,
    min_guest_count: minGuestCount,
    checkout_entry: row.checkout_entry,
  };
}

function parseMinGuestCounts(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [buffetId, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return null;
    out[buffetId] = n;
  }
  return out;
}

function parseCachedPrices(raw: unknown): Record<string, ResolvedBuffetPriceRow> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const prices: Record<string, ResolvedBuffetPriceRow> = {};
  for (const [buffetId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    const adult = Number(row.adult_price);
    const child = Number(row.child_price);
    if (!Number.isFinite(adult) || !Number.isFinite(child)) return null;
    prices[buffetId] = {
      adult_price: adult,
      child_price: child,
      rule_id: typeof row.rule_id === 'string' ? row.rule_id : null,
      time_slot_id: typeof row.time_slot_id === 'string' ? row.time_slot_id : null,
      adult_enabled: row.adult_enabled !== false,
      child_enabled: row.child_enabled !== false,
    };
  }
  return prices;
}

async function fetchOpenableFromApi(
  slug: string,
  tableId: string | null,
  known: { version: number; slotKey: string } | null,
): Promise<WaiterOpenableApiBody> {
  const url = new URL(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/buffet`,
    window.location.origin,
  );
  if (tableId) url.searchParams.set('table_id', tableId);
  if (known) {
    url.searchParams.set('knownVersion', String(known.version));
    url.searchParams.set('knownSlotKey', known.slotKey);
  }
  const res = await fetchWithDependencyTimeout(url.toString(), { credentials: 'include' });
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw new Error('buffet_openable_fetch_failed');
  return parseWaiterOpenableApiBody(data);
}

/**
 * Ensure openable list is current — compare buffet_config_version + slot, full GET only on mismatch.
 * Sole network path for staff openable ids (board / detail / open-table form).
 */
export function ensureWaiterOpenable(params: {
  restaurantId: string;
  slug: string;
  tableId?: string | null;
  forceRefresh?: boolean;
}): Promise<WaiterOpenableEnsureResult> {
  const tableId = params.tableId ?? null;
  const key = flightKey(params.restaurantId, tableId);
  const running = inFlightByKey.get(key);
  if (running && !params.forceRefresh) return running;

  const known = params.forceRefresh ? null : peekWaiterOpenableCache(params.restaurantId);

  const promise = fetchOpenableFromApi(
    params.slug,
    tableId,
    known ? { version: known.version, slotKey: known.slotKey } : null,
  )
    .then((body) => {
      const checkoutEntry =
        (body.checkout_entry as CheckoutEntrySignals | null | undefined) ?? null;
      if (body.unchanged === true) {
        const cached = peekWaiterOpenableCache(params.restaurantId);
        if (!cached) throw new Error('buffet_openable_unchanged_without_cache');
        commitWaiterOpenableCache(params.restaurantId, {
          version: body.version,
          slotKey: body.slot_key,
          openableBuffetIds: cached.openableBuffetIds,
          pricesByBuffetId: cached.pricesByBuffetId,
          minGuestCountByBuffetId: cached.minGuestCountByBuffetId,
        });
        return {
          openableBuffetIds: cached.openableBuffetIds,
          pricesByBuffetId: cached.pricesByBuffetId,
          minGuestCountByBuffetId: cached.minGuestCountByBuffetId,
          version: body.version,
          slotKey: body.slot_key,
          checkoutEntry,
          unchanged: true,
        };
      }
      const entry = commitWaiterOpenableCache(params.restaurantId, {
        version: body.version,
        slotKey: body.slot_key,
        openableBuffetIds: body.buffet_ids,
        pricesByBuffetId: body.prices,
        minGuestCountByBuffetId: body.min_guest_count,
      });
      return {
        openableBuffetIds: entry.openableBuffetIds,
        pricesByBuffetId: entry.pricesByBuffetId,
        minGuestCountByBuffetId: entry.minGuestCountByBuffetId,
        version: entry.version,
        slotKey: entry.slotKey,
        checkoutEntry,
        unchanged: false,
      };
    })
    .finally(() => {
      inFlightByKey.delete(key);
    });

  inFlightByKey.set(key, promise);
  return promise;
}
