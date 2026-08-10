/**
 * Sole HTTP Cache-Control for customer read APIs (session / menu-catalog / guest-notice).
 * Catalog freshness: restaurants.menu_catalog_version + client ensure (knownVersion);
 * notice: guest-notice client TTL. Not browser HTTP cache.
 * Client fetches use `cache: 'no-store'` to match.
 */
export const CUSTOMER_READ_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
} as const;
