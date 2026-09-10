import { coerceCartPrice } from '@/lib/cart-totals';
import type { CartItem, MenuItem } from '@/types';

/**
 * Sole pure cart-line qty write for guest menu + sushi menu.
 * nextQty ≤ 0 removes the line; otherwise upserts one CartItem.
 */
export function upsertCartItemQty(
  prev: readonly CartItem[],
  item: MenuItem,
  nextQty: number,
): CartItem[] {
  if (!Number.isFinite(nextQty) || nextQty <= 0) {
    return prev.filter((c) => c.menuItemId !== item.id);
  }
  const existing = prev.find((c) => c.menuItemId === item.id);
  if (!existing) {
    return [
      ...prev,
      {
        menuItemId: item.id,
        name_pt: item.name_pt,
        name_en: item.name_en,
        name_zh: item.name_zh,
        price: coerceCartPrice(item.price),
        emoji: item.emoji,
        qty: nextQty,
        note: '',
        notePresetKeys: item.note_preset_keys || [],
      },
    ];
  }
  return prev.map((c) => (c.menuItemId === item.id ? { ...c, qty: nextQty } : c));
}
