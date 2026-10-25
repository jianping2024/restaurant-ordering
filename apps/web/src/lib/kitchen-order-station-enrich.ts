import type { SupabaseClient } from '@supabase/supabase-js';
import { isMenuCatalogItem } from '@/lib/order-items';
import { loadMenuCategoriesForEnqueue } from '@/lib/menu-categories-server';
import {
  normalizePrintStationIds,
  resolveEffectivePrintStationIds,
} from '@/lib/print-station-resolve';
import type { Order, OrderItem } from '@/types';

/** Resolve print_station_ids onto order lines (menu → category fallback). Shared by kitchen + guest progress. */
export async function enrichKitchenOrdersWithStations(
  admin: SupabaseClient,
  restaurantId: string,
  orders: Order[],
): Promise<Order[]> {
  const menuIds = new Set<string>();
  for (const order of orders) {
    for (const item of order.items || []) {
      if (!isMenuCatalogItem(item)) continue;
      if (normalizePrintStationIds(item.print_station_ids).length > 0) continue;
      if (item.print_station_id) continue;
      if (item.id) menuIds.add(item.id);
    }
  }

  const menuStationById = new Map<
    string,
    { print_station_ids: string[]; category_id: string | null }
  >();
  if (menuIds.size > 0) {
    const { data: menuRows } = await admin
      .from('menu_items')
      .select('id, category_id, print_station_ids')
      .eq('restaurant_id', restaurantId)
      .in('id', Array.from(menuIds));
    for (const row of menuRows || []) {
      menuStationById.set(row.id as string, {
        print_station_ids: normalizePrintStationIds(
          (row as { print_station_ids?: string[] | null }).print_station_ids,
        ),
        category_id: (row.category_id as string | null) ?? null,
      });
    }
  }

  const categories =
    menuStationById.size > 0 ? await loadMenuCategoriesForEnqueue(restaurantId) : [];

  return orders.map((order) => ({
    ...order,
    items: (order.items || []).map((item: OrderItem) => {
      if (!isMenuCatalogItem(item)) return item;
      const already = normalizePrintStationIds(item.print_station_ids);
      if (already.length > 0) return { ...item, print_station_ids: already };
      if (item.print_station_id) {
        return { ...item, print_station_ids: [item.print_station_id] };
      }
      const menu = menuStationById.get(item.id);
      if (!menu) return item;
      const resolved = resolveEffectivePrintStationIds(
        menu.print_station_ids,
        menu.category_id,
        categories,
      );
      if (resolved.length === 0) return item;
      return { ...item, print_station_ids: resolved };
    }),
  }));
}
