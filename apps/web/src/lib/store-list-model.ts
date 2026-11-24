/**
 * Sole model behind the searchable store list (multi-store plan §8.1–8.2), shared by the
 * store picker page and the top-bar store switcher. Pure + client-safe; no auth here —
 * entries come from `listAuthorizedRestaurantsForUser`.
 */
import { isRestaurantSuspended, storeMatchesSearch } from '@mesa/shared';
import type { AuthorizedRestaurant } from '@/lib/permissions/restaurant-access-rules';

/** Store switch data for a page — present only when the account can enter ≥2 stores. */
export type StoreSwitchData = { stores: AuthorizedRestaurant[]; userId: string };

/** Picker switches from cards to the searchable list above this many stores. */
export const STORE_PICKER_CARD_MAX = 6;
/** «最近进过» keeps at most this many stores. */
export const RECENT_STORES_MAX = 5;

export function storeDisplayName(store: AuthorizedRestaurant): string {
  return store.name?.trim() || store.slug;
}

export function storeIsSuspended(store: AuthorizedRestaurant): boolean {
  return isRestaurantSuspended(store.suspended_at);
}

export type StoreListGroup =
  | { kind: 'results'; items: AuthorizedRestaurant[] }
  | { kind: 'favorites'; items: AuthorizedRestaurant[] }
  | { kind: 'recent'; items: AuthorizedRestaurant[] }
  | { kind: 'all'; items: AuthorizedRestaurant[] };

function byCityThenName(a: AuthorizedRestaurant, b: AuthorizedRestaurant): number {
  // Unknown city sorts last.
  if (!a.city !== !b.city) return a.city ? -1 : 1;
  return (
    a.city.localeCompare(b.city, 'pt') ||
    storeDisplayName(a).localeCompare(storeDisplayName(b), 'pt')
  );
}

/**
 * Groups in display order. With a query: one «results» group (city/name order). Without:
 * favorites (by `favoritedAt`, oldest first) → recent (≤5, not already favorited) → all
 * (by city, then name).
 */
export function buildStoreListGroups(
  stores: readonly AuthorizedRestaurant[],
  input: { query: string; recentIds: readonly string[] },
): StoreListGroup[] {
  const matched = stores.filter((s) =>
    storeMatchesSearch({ name: storeDisplayName(s), city: s.city, slug: s.slug }, input.query),
  );
  if (input.query.trim()) {
    return [{ kind: 'results', items: matched.slice().sort(byCityThenName) }];
  }
  const favorites = matched
    .filter((s) => s.favoritedAt)
    .sort((a, b) => (a.favoritedAt ?? '').localeCompare(b.favoritedAt ?? ''));
  const byId = new Map(matched.map((s) => [s.id, s]));
  const recent = input.recentIds
    .map((id) => byId.get(id))
    .filter((s): s is AuthorizedRestaurant => !!s && !s.favoritedAt)
    .slice(0, RECENT_STORES_MAX);
  const groups: StoreListGroup[] = [];
  if (favorites.length) groups.push({ kind: 'favorites', items: favorites });
  if (recent.length) groups.push({ kind: 'recent', items: recent });
  groups.push({ kind: 'all', items: matched.slice().sort(byCityThenName) });
  return groups;
}

/** Recent list after entering `id`: it moves to the front, capped at `RECENT_STORES_MAX`. */
export function nextRecentStoreIds(previous: readonly string[], id: string): string[] {
  return [id, ...previous.filter((x) => x !== id)].slice(0, RECENT_STORES_MAX);
}

/** Per-account browser key for «最近进过» (UX only, never auth). */
export function recentStoresStorageKey(userId: string): string {
  return `mesa-recent-stores:${userId}`;
}
