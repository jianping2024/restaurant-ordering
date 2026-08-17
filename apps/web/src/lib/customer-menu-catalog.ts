import { revalidateTag, unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  mapCustomerMenuCatalogImageUrls,
  type ResolveMenuImageDisplayOptions,
} from '@/lib/menu-image';
import type { MenuCategory, MenuItem } from '@/types';

export function customerMenuCatalogTag(restaurantId: string): string {
  return `customer-menu-catalog:${restaurantId}`;
}

/** Read restaurant menu catalog version (customer freshness token). */
export async function loadCustomerMenuCatalogVersion(restaurantId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('restaurants')
    .select('menu_catalog_version')
    .eq('id', restaurantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.menu_catalog_version ?? 0);
}

async function bumpCustomerMenuCatalogVersion(restaurantId: string): Promise<number> {
  const admin = createAdminClient();
  const current = await loadCustomerMenuCatalogVersion(restaurantId);
  const next = current + 1;
  const { error } = await admin
    .from('restaurants')
    .update({ menu_catalog_version: next })
    .eq('id', restaurantId);
  if (error) throw new Error(error.message);
  return next;
}

/**
 * After dashboard menu writes: bump durable version then invalidate Next data cache.
 * Sole invalidation entry — callers must await.
 */
export async function invalidateCustomerMenuCatalog(restaurantId: string): Promise<void> {
  await bumpCustomerMenuCatalogVersion(restaurantId);
  revalidateTag(customerMenuCatalogTag(restaurantId));
}

export type CustomerMenuCatalogRows = {
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  recommendedItemIds: string[];
};

async function loadCustomerMenuCatalogUncached(
  restaurantId: string,
): Promise<CustomerMenuCatalogRows> {
  const admin = createAdminClient();
  const [{ data: menuItems }, { data: menuCategories }, { data: recommended }] = await Promise.all([
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
    admin
      .from('menu_recommended_items')
      .select('menu_item_id')
      .eq('restaurant_id', restaurantId)
      .order('sort_order'),
  ]);

  return {
    menuItems: (menuItems || []) as MenuItem[],
    menuCategories: (menuCategories || []) as MenuCategory[],
    recommendedItemIds: (recommended || []).map((row) => String(row.menu_item_id)),
  };
}

/**
 * Customer-facing menu catalog (items + active categories).
 * Short TTL + tag invalidation on dashboard menu mutations.
 * Session/table context stays request-dynamic outside this cache.
 * Durable freshness for clients is {@link loadCustomerMenuCatalogVersion}.
 */
export function loadCustomerMenuCatalog(restaurantId: string) {
  return unstable_cache(loadCustomerMenuCatalogUncached, ['customer-menu-catalog', restaurantId], {
    revalidate: 60,
    tags: [customerMenuCatalogTag(restaurantId)],
  })(restaurantId);
}

/**
 * Sole customer-facing catalog for SSR + GET menu-catalog: cached rows + display image URLs.
 * Do not call {@link loadCustomerMenuCatalog} + {@link mapCustomerMenuCatalogImageUrls} beside this.
 */
export async function loadCustomerMenuCatalogForDisplay(
  restaurantId: string,
  imageOpts: ResolveMenuImageDisplayOptions,
): Promise<CustomerMenuCatalogRows> {
  const catalog = await loadCustomerMenuCatalog(restaurantId);
  return mapCustomerMenuCatalogImageUrls(catalog, imageOpts);
}
