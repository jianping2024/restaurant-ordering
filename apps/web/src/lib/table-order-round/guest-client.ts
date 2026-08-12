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
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
  try {
    window.localStorage.setItem(key, id);
  } catch {
    // ignore
  }
  return id;
}
