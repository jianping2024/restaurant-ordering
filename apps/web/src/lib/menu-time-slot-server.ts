import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isMenuItemServedInTimeSlot,
  resolveSessionMenuTimeSlotId,
  type MenuTimeSlot,
} from '@/lib/menu-time-slot';

/** Sole read of a restaurant's slot windows for the menu (catalog + order write gate). */
export async function loadMenuTimeSlots(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<MenuTimeSlot[]> {
  const { data, error } = await admin
    .from('buffet_time_slots')
    .select('id, name, start_time, end_time, weekdays, sort_order')
    .eq('restaurant_id', restaurantId)
    .order('sort_order');
  if (error) throw new Error('buffet_time_slots_query_failed');
  return (data || []) as MenuTimeSlot[];
}

/**
 * Write gate: every dish must be served in the slot of the session it is ordered into.
 * Skips the slot read when no dish is slot-bound.
 */
export async function menuItemsServedInSession(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionOpenedAt: string;
  items: ReadonlyArray<{ time_slot_id?: string | null }>;
}): Promise<boolean> {
  if (!params.items.some((item) => item.time_slot_id)) return true;
  const slots = await loadMenuTimeSlots(params.admin, params.restaurantId);
  const activeSlotId = resolveSessionMenuTimeSlotId(slots, params.sessionOpenedAt, new Date());
  return params.items.every((item) => isMenuItemServedInTimeSlot(item, activeSlotId));
}
