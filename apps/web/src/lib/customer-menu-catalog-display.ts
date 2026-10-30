import 'server-only';

import {
  loadCustomerMenuCatalog,
  type CustomerMenuCatalogRows,
} from '@/lib/customer-menu-catalog';
import { stripMenuItemVideoFields } from '@/lib/menu-dish-video';
import { resolveDishVideoAccess } from '@/lib/menu-dish-video-access';
import { mapCustomerMenuCatalogImageUrls } from '@/lib/menu-image';

/**
 * Sole customer-facing catalog for SSR + GET menu-catalog: cached rows + display media URLs.
 * Dish videos are kept only when Pro `menu_dish_video` is effective (evaluated per request,
 * so expiry applies) and the store switch is on (its PATCH invalidates the cache).
 * Do not call {@link loadCustomerMenuCatalog} + {@link mapCustomerMenuCatalogImageUrls} beside this.
 */
export async function loadCustomerMenuCatalogForDisplay(
  restaurantId: string,
): Promise<CustomerMenuCatalogRows> {
  const { dishVideoGate, ...catalog } = await loadCustomerMenuCatalog(restaurantId);
  const videosVisible =
    dishVideoGate != null && (await resolveDishVideoAccess(dishVideoGate, null)).guestVisible;
  return mapCustomerMenuCatalogImageUrls(
    videosVisible ? catalog : { ...catalog, menuItems: catalog.menuItems.map(stripMenuItemVideoFields) },
  );
}
