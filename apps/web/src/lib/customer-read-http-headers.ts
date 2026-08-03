/**
 * Sole HTTP Cache-Control for customer read APIs (session / menu-catalog / guest-notice).
 * Freshness for catalog/notice lives in app caches
 * (`loadCustomerMenuCatalog`, `ensureCustomerMenuCatalog`, guest-notice client TTL) — not browser HTTP cache.
 * Client fetches use `cache: 'no-store'` to match.
 */
export const CUSTOMER_READ_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
} as const;
