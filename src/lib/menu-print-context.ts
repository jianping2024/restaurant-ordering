import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type MenuCategoryForPrint,
  type MenuItemForPrint,
} from '@/lib/menu-print-label';

export type MenuPrintContext = {
  categories: MenuCategoryForPrint[];
  menuById: Map<string, MenuItemForPrint>;
};

export async function fetchMenuPrintContext(
  admin: SupabaseClient,
  restaurantId: string,
  menuItemIds: string[],
): Promise<MenuPrintContext> {
  const uniqueIds = Array.from(new Set(menuItemIds.filter(Boolean)));
  const [{ data: categoryRows, error: cErr }, menuResult] = await Promise.all([
    admin
      .from('menu_categories')
      .select('id, parent_id, item_code')
      .eq('restaurant_id', restaurantId),
    uniqueIds.length > 0
      ? admin
          .from('menu_items')
          .select('id, category_id, item_code')
          .eq('restaurant_id', restaurantId)
          .in('id', uniqueIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (cErr) {
    throw new Error(cErr.message);
  }
  if (menuResult.error) {
    throw new Error(menuResult.error.message);
  }

  const menuById = new Map<string, MenuItemForPrint>();
  for (const row of menuResult.data || []) {
    menuById.set(row.id as string, row as MenuItemForPrint);
  }

  return {
    categories: (categoryRows || []) as MenuCategoryForPrint[],
    menuById,
  };
}
