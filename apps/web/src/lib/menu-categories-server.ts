import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { customerMenuCatalogTag } from '@/lib/customer-menu-catalog';
import type { MenuCategoryForStationTicket } from '@/lib/menu-print-label';

type EnqueueCategoryRow = MenuCategoryForStationTicket & { print_station_id: string | null };

async function loadMenuCategoriesForEnqueueUncached(
  restaurantId: string,
): Promise<EnqueueCategoryRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('menu_categories')
    .select('id, parent_id, print_station_id, item_code, name_pt, name_en, name_zh, sort_order')
    .eq('restaurant_id', restaurantId);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as EnqueueCategoryRow[];
}

/** Station-ticket routing categories — tag-invalidated with customer menu catalog. */
export function loadMenuCategoriesForEnqueue(restaurantId: string) {
  return unstable_cache(
    loadMenuCategoriesForEnqueueUncached,
    ['menu-categories-enqueue', restaurantId],
    {
      revalidate: 60,
      tags: [customerMenuCatalogTag(restaurantId)],
    },
  )(restaurantId);
}
