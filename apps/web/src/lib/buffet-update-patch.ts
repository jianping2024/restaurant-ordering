import type { MutationError } from '@/lib/dashboard-api-shared';
import { isAllowedMenuVatRate } from '@/lib/menu-vat-rate';
import type { Buffet } from '@/types';

/** Fields a dashboard PATCH may change on one buffet — never restaurant_id / id / timestamps. */
export type BuffetUpdatePatch = Partial<
  Pick<Buffet, 'name' | 'is_active' | 'vat_rate' | 'description' | 'min_guest_count'>
>;

const BUFFET_PATCH_KEYS = new Set(['name', 'is_active', 'vat_rate', 'description', 'min_guest_count']);

/** 套餐最少人数上限（含），同 DB CHECK `buffets_min_guest_count_range`。 */
export const BUFFET_MIN_GUEST_COUNT_MAX = 99;

/** 套餐描述上限（字符数 = `Array.from(s).length`，同 PG `char_length`）。 */
export const BUFFET_DESCRIPTION_MAX_CHARS = 40;

/** Sole description normalize: trim; empty → null. */
export function normalizeBuffetDescription(raw: string): string | null {
  return raw.trim() || null;
}

/**
 * Sole whitelist for `PATCH /api/dashboard/buffet` `{ resource: 'buffet', patch }`:
 * unknown keys or a wrong type reject the whole patch (400).
 */
export function parseBuffetUpdatePatch(
  raw: unknown,
): { ok: true; patch: BuffetUpdatePatch } | MutationError {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'invalid_buffet_patch', status: 400 };
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return { error: 'invalid_buffet_patch', status: 400 };

  const patch: BuffetUpdatePatch = {};
  for (const [key, value] of entries) {
    if (!BUFFET_PATCH_KEYS.has(key)) return { error: 'invalid_buffet_patch', status: 400 };
    if (key === 'name') {
      if (typeof value !== 'string' || !value.trim()) return { error: 'name_required', status: 400 };
      patch.name = value.trim();
    } else if (key === 'is_active') {
      if (typeof value !== 'boolean') return { error: 'invalid_buffet_patch', status: 400 };
      patch.is_active = value;
    } else if (key === 'vat_rate') {
      if (typeof value !== 'number' || !isAllowedMenuVatRate(value)) {
        return { error: 'invalid_vat_rate', status: 400 };
      }
      patch.vat_rate = value;
    } else if (key === 'min_guest_count') {
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > BUFFET_MIN_GUEST_COUNT_MAX
      ) {
        return { error: 'invalid_min_guest_count', status: 400 };
      }
      patch.min_guest_count = value;
    } else {
      if (value !== null && typeof value !== 'string') {
        return { error: 'invalid_buffet_patch', status: 400 };
      }
      const description = typeof value === 'string' ? normalizeBuffetDescription(value) : null;
      if (description && Array.from(description).length > BUFFET_DESCRIPTION_MAX_CHARS) {
        return { error: 'description_too_long', status: 400 };
      }
      patch.description = description;
    }
  }
  return { ok: true, patch };
}
