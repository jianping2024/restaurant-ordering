import type { MenuCategory, MenuItem, PrintStation } from '@/types';
import { getDashboardOperationalContext } from '@/lib/dashboard-access-cached';
import { can } from '@/lib/permissions/can';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export type DashboardMenu =
  | {
      restaurantId: string;
      menuItems: MenuItem[];
      menuCategories: MenuCategory[];
      printStations: PrintStation[];
      canManagePrintStations: boolean;
    }
  | { error: string; status: number };

export async function loadDashboardMenu(): Promise<DashboardMenu> {
  const ctx = await getDashboardOperationalContext('dashboard.menu.view');
  if ('error' in ctx) {
    return { error: ctx.error, status: ctx.status };
  }

  const principal = await loadPrincipalWithCapabilities();
  const canManagePrintStations = can(
    principal?.capabilities ?? new Set(),
    'dashboard.menu.print_stations.manage',
  );

  const [{ data: menuItems, error: itemsError }, { data: menuCategories, error: categoriesError }, { data: printStations, error: stationsError }] =
    await Promise.all([
      ctx.admin
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', ctx.restaurantId)
        .order('category_id')
        .order('sort_order'),
      ctx.admin
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('active', true)
        .order('sort_order'),
      ctx.admin
        .from('print_stations')
        .select('*')
        .eq('restaurant_id', ctx.restaurantId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

  if (itemsError) {
    return { error: 'menu_items_query_failed', status: 500 };
  }
  if (categoriesError) {
    return { error: 'menu_categories_query_failed', status: 500 };
  }
  if (stationsError) {
    return { error: 'print_stations_query_failed', status: 500 };
  }

  return {
    restaurantId: ctx.restaurantId,
    menuItems: (menuItems || []) as MenuItem[],
    menuCategories: (menuCategories || []) as MenuCategory[],
    printStations: (printStations ?? []) as PrintStation[],
    canManagePrintStations,
  };
}
