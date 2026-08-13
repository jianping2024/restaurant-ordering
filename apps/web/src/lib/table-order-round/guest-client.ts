import { mintBrowserUuid } from '@/lib/browser-uuid';
import { parseTableIdParam } from '@/lib/restaurant-tables';

/** localStorage key prefix: `${GUEST_CLIENT_STORAGE_PREFIX}_{restaurantId}_{tableId}` */
export const GUEST_CLIENT_STORAGE_PREFIX = 'mesa_guest_client_id';

export function guestClientStorageKey(restaurantId: string, tableId: string): string {
  return `${GUEST_CLIENT_STORAGE_PREFIX}_${restaurantId}_${tableId}`;
}

/** Parse a guest client UUID (same normalization as table_id). */
export function parseGuestClientId(raw: unknown): string | null {
  return parseTableIdParam(raw);
}


/** Mint or read stable guest client UUID in localStorage (once per restaurant+table). */
export function ensureGuestClientId(restaurantId: string, tableId: string): string {
  if (typeof window === 'undefined') return '';
  const key = guestClientStorageKey(restaurantId, tableId);
  try {
    const existing = parseGuestClientId(window.localStorage.getItem(key));
    if (existing) return existing;
  } catch {
    // ignore storage errors
  }
  const id = mintBrowserUuid();
  try {
    window.localStorage.setItem(key, id);
  } catch {
    // ignore
  }
  return id;
}
