import { revalidateTag, unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MenuCategory, MenuItem } from '@/types';

export function customerMenuCatalogTag(restaurantId: string): string {
  return `customer-menu-catalog:${restaurantId}`;
}

/** Invalidate after dashboard menu writes so customer menu sees changes promptly. */
export function invalidateCustomerMenuCatalog(restaurantId: string): void {
  revalidateTag(customerMenuCatalogTag(restaurantId));
}

async function loadCustomerMenuCatalogUncached(
  restaurantId: string,
): Promise<{ menuItems: MenuItem[]; menuCategories: MenuCategory[] }> {
  const admin = createAdminClient();
  const [{ data: menuItems }, { data: menuCategories }] = await Promise.all([
    admin
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category_id')
      .order('sort_order'),
    admin
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('active', true)
      .order('sort_order'),
  ]);

  return {
    menuItems: (menuItems || []) as MenuItem[],
    menuCategories: (menuCategories || []) as MenuCategory[],
  };
}

/**
 * Customer-facing menu catalog (items + active categories).
 * Short TTL + tag invalidation on dashboard menu mutations.
 * Session/table context stays request-dynamic outside this cache.
 */
export function loadCustomerMenuCatalog(restaurantId: string) {
  return unstable_cache(loadCustomerMenuCatalogUncached, ['customer-menu-catalog', restaurantId], {
    revalidate: 60,
    tags: [customerMenuCatalogTag(restaurantId)],
  })(restaurantId);
}
