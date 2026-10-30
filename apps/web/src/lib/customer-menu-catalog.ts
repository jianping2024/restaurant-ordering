import { revalidateTag, unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DISH_VIDEO_GATE_RESTAURANT_COLUMNS,
  type DishVideoGateRestaurant,
} from '@/lib/menu-dish-video';
import type { MenuCategory, MenuItem } from '@/types';
import {
  buildMenuNotePresetCatalog,
  type MenuNotePresetCatalog,
} from '@/lib/menu-note-presets';
import { listMenuNotePresetDictionary } from '@/lib/menu-note-presets-query';
import type { MenuTimeSlot } from '@/lib/menu-time-slot';
import { loadMenuTimeSlots } from '@/lib/menu-time-slot-server';

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
  // Guest Realtime doorbell (narrow table — do not CDC full restaurants rows).
  const { error: signalError } = await admin.from('menu_catalog_signals').upsert(
    { restaurant_id: restaurantId, version: next, bumped_at: new Date().toISOString() },
    { onConflict: 'restaurant_id' },
  );
  if (signalError) throw new Error(signalError.message);
  return next;
}

/**
 * After dashboard menu writes: bump durable version + guest doorbell row, then invalidate
 * Next data cache. Sole invalidation entry — callers must await.
 */
export async function invalidateCustomerMenuCatalog(restaurantId: string): Promise<void> {
  await bumpCustomerMenuCatalogVersion(restaurantId);
  revalidateTag(customerMenuCatalogTag(restaurantId));
}

export type CustomerMenuCatalogRows = {
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  recommendedItemIds: string[];
  notePresetCatalog: MenuNotePresetCatalog;
  /** Slot windows for `menu_items.time_slot_id` (guest filters per table session). */
  menuTimeSlots: MenuTimeSlot[];
};

/** Cached shape: display rows + the restaurant fields the dish-video gate needs (never sent to guests). */
export type CustomerMenuCatalogCached = CustomerMenuCatalogRows & {
  dishVideoGate: DishVideoGateRestaurant | null;
  /** DB `menu_catalog_version` this payload was loaded under (cache key). */
  catalogVersion: number;
};

async function loadCustomerMenuCatalogUncached(
  restaurantId: string,
  catalogVersion: number,
): Promise<CustomerMenuCatalogCached> {
  const admin = createAdminClient();
  const [
    { data: menuItems },
    { data: menuCategories },
    { data: recommended },
    noteDictionary,
    menuTimeSlots,
    { data: dishVideoGate },
  ] = await Promise.all([
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
    listMenuNotePresetDictionary(admin, restaurantId),
    loadMenuTimeSlots(admin, restaurantId),
    admin.from('restaurants').select(DISH_VIDEO_GATE_RESTAURANT_COLUMNS).eq('id', restaurantId).maybeSingle(),
  ]);

  if ('error' in noteDictionary) {
    throw new Error(noteDictionary.message || noteDictionary.error);
  }

  return {
    menuItems: (menuItems || []) as MenuItem[],
    menuCategories: (menuCategories || []) as MenuCategory[],
    recommendedItemIds: (recommended || []).map((row) => String(row.menu_item_id)),
    notePresetCatalog: buildMenuNotePresetCatalog(
      noteDictionary.groups,
      noteDictionary.presets,
    ),
    menuTimeSlots,
    dishVideoGate: (dishVideoGate as DishVideoGateRestaurant | null) ?? null,
    catalogVersion,
  };
}

/**
 * Customer-facing menu catalog (items + active categories).
 * Cache key includes {@link loadCustomerMenuCatalogVersion} so a bump cannot serve a stale body
 * under a new version; tag invalidation still drops old entries early.
 * Durable client freshness remains `menu_catalog_version` + ensure(knownVersion).
 */
export async function loadCustomerMenuCatalog(
  restaurantId: string,
): Promise<CustomerMenuCatalogCached> {
  const catalogVersion = await loadCustomerMenuCatalogVersion(restaurantId);
  return unstable_cache(
    async () => loadCustomerMenuCatalogUncached(restaurantId, catalogVersion),
    ['customer-menu-catalog', restaurantId, String(catalogVersion)],
    {
      revalidate: 60,
      tags: [customerMenuCatalogTag(restaurantId)],
    },
  )();
}
