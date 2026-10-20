import { restaurantLocalNowParts } from '@/lib/restaurant-business-hours';
import type { BuffetTimeSlot, MenuItem } from '@/types';

/** Slot fields the menu rule reads (same table as buffet pricing). */
export type MenuTimeSlot = Pick<
  BuffetTimeSlot,
  'id' | 'name' | 'start_time' | 'end_time' | 'weekdays' | 'sort_order'
>;

function timeToMinutes(dbTime: string): number {
  const [h, m] = dbTime.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes from `t` to the slot window (0 inside). Mirrors SQL `resolve_buffet_prices`. */
function slotDistanceMinutes(slot: MenuTimeSlot, t: number): number {
  const start = timeToMinutes(slot.start_time);
  const end = timeToMinutes(slot.end_time);
  if (start <= end) {
    if (t >= start && t < end) return 0;
    return t < start ? start - t : t - end;
  }
  if (t >= start || t < end) return 0;
  return 24 * 60;
}

/**
 * Sole menu time-slot rule: the slot nearest to `at` (Lisbon wall clock, weekday-filtered),
 * tie → sort_order → name — same ladder as buffet pricing. Early opening before a slot and
 * overtime after it both land on the nearer slot; null when no slot runs that weekday.
 */
export function resolveMenuTimeSlotId(
  slots: readonly MenuTimeSlot[],
  at: Date,
): string | null {
  const { weekday, minutes } = restaurantLocalNowParts(at);
  const dow = weekday % 7;
  let best: { slot: MenuTimeSlot; dist: number } | null = null;
  for (const slot of slots) {
    if (!slot.weekdays.includes(dow)) continue;
    const dist = slotDistanceMinutes(slot, minutes);
    if (
      !best ||
      dist < best.dist ||
      (dist === best.dist &&
        (slot.sort_order < best.slot.sort_order ||
          (slot.sort_order === best.slot.sort_order && slot.name < best.slot.name)))
    ) {
      best = { slot, dist };
    }
  }
  return best?.slot.id ?? null;
}

/**
 * The slot a table session orders in: fixed by `opened_at` until close;
 * no session yet (browse only) → `now`.
 */
export function resolveSessionMenuTimeSlotId(
  slots: readonly MenuTimeSlot[],
  sessionOpenedAt: string | null | undefined,
  now: Date,
): string | null {
  const openedAt = sessionOpenedAt ? new Date(sessionOpenedAt) : null;
  const at = openedAt && Number.isFinite(openedAt.getTime()) ? openedAt : now;
  return resolveMenuTimeSlotId(slots, at);
}

/** No slot on the dish = all day; otherwise only in its own slot. */
export function isMenuItemServedInTimeSlot(
  item: Pick<MenuItem, 'time_slot_id'>,
  activeSlotId: string | null,
): boolean {
  return !item.time_slot_id || item.time_slot_id === activeSlotId;
}
