import { KitchenScreensManager } from '@/components/dashboard/KitchenScreensManager';
import { requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import { listKitchenScreens } from '@/lib/kitchen-screens-server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PermissionKey } from '@/lib/permissions/registry';
import type { KitchenScreen, PrintStation } from '@/types';

export default async function KitchenScreensSettingsPage() {
  const permission: PermissionKey = 'floor.kitchen_screens.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission);

  let screens: KitchenScreen[] = [];
  let kitchenStations: PrintStation[] = [];
  try {
    const admin = createAdminClient();
    const [listed, { data: stationRows }] = await Promise.all([
      listKitchenScreens(admin, restaurant.id),
      admin
        .from('print_stations')
        .select(
          'id, restaurant_id, name_pt, name_en, name_zh, sort_order, created_at, kitchen_enabled',
        )
        .eq('restaurant_id', restaurant.id)
        .eq('kitchen_enabled', true)
        .order('sort_order', { ascending: true }),
    ]);
    if (Array.isArray(listed)) {
      screens = listed.map((s) => ({
        id: s.id,
        restaurant_id: s.restaurant_id,
        name: s.name,
        sort_order: s.sort_order,
        created_at: s.created_at,
        updated_at: s.updated_at,
        station_ids: s.station_ids,
      }));
    }
    kitchenStations = (stationRows || []) as PrintStation[];
  } catch {
    screens = [];
    kitchenStations = [];
  }

  return (
    <KitchenScreensManager initialScreens={screens} kitchenStations={kitchenStations} />
  );
}
