import 'server-only';

import {
  loadCustomerMenuCatalog,
  type CustomerMenuCatalogRows,
} from '@/lib/customer-menu-catalog';
import { stripMenuItemVideoFields } from '@/lib/menu-dish-video';
import { resolveDishVideoAccess } from '@/lib/menu-dish-video-access';
import { mapCustomerMenuCatalogImageUrls } from '@/lib/menu-image';

/** SSR / API catalog body + the durable version to seed client ensure. */
export type CustomerMenuCatalogForDisplay = CustomerMenuCatalogRows & {
  version: number;
};

/**
 * Sole customer-facing catalog for SSR + GET menu-catalog: cached rows + display media URLs.
 * Dish videos are kept only when Pro `menu_dish_video` is effective (evaluated per request,
 * so expiry applies) and the store switch is on (its PATCH invalidates the cache).
 * `version` is the DB `menu_catalog_version` this payload matches (same key as the cache).
 * Do not call {@link loadCustomerMenuCatalog} + {@link mapCustomerMenuCatalogImageUrls} beside this.
 */
export async function loadCustomerMenuCatalogForDisplay(
  restaurantId: string,
): Promise<CustomerMenuCatalogForDisplay> {
  const { dishVideoGate, catalogVersion, ...catalog } = await loadCustomerMenuCatalog(restaurantId);
  const videosVisible =
    dishVideoGate != null && (await resolveDishVideoAccess(dishVideoGate, null)).guestVisible;
  const rows = mapCustomerMenuCatalogImageUrls(
    videosVisible ? catalog : { ...catalog, menuItems: catalog.menuItems.map(stripMenuItemVideoFields) },
  );
  return { version: catalogVersion, ...rows };
}
