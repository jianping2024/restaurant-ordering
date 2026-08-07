import type { SupabaseClient } from '@supabase/supabase-js';
import { isBuffetBaseItem } from '@/lib/order-items';
import { loadMenuCategoriesForEnqueue } from '@/lib/menu-categories-server';
import { resolveEffectivePrintStationId } from '@/lib/print-station-resolve';
import type { Order, OrderItem } from '@/types';

/** Resolve print_station_id onto order lines (menu → category fallback). Shared by kitchen + guest progress. */
export async function enrichKitchenOrdersWithStations(
  admin: SupabaseClient,
  restaurantId: string,
  orders: Order[],
): Promise<Order[]> {
  const menuIds = new Set<string>();
  for (const order of orders) {
    for (const item of order.items || []) {
      if (isBuffetBaseItem(item)) continue;
      if (item.print_station_id) continue;
      if (item.id) menuIds.add(item.id);
    }
  }

  const menuStationById = new Map<
    string,
    { print_station_id: string | null; category_id: string | null }
  >();
  if (menuIds.size > 0) {
    const { data: menuRows } = await admin
      .from('menu_items')
      .select('id, category_id, print_station_id')
      .eq('restaurant_id', restaurantId)
      .in('id', Array.from(menuIds));
    for (const row of menuRows || []) {
      menuStationById.set(row.id as string, {
        print_station_id: (row.print_station_id as string | null) ?? null,
        category_id: (row.category_id as string | null) ?? null,
      });
    }
  }

  const categories =
    menuStationById.size > 0 ? await loadMenuCategoriesForEnqueue(restaurantId) : [];

  return orders.map((order) => ({
    ...order,
    items: (order.items || []).map((item: OrderItem) => {
      if (isBuffetBaseItem(item)) return item;
      if (item.print_station_id) return item;
      const menu = menuStationById.get(item.id);
      if (!menu) return item;
      const resolved = resolveEffectivePrintStationId(
        menu.print_station_id,
        menu.category_id,
        categories,
      );
      if (!resolved) return item;
      return { ...item, print_station_id: resolved };
    }),
  }));
}
