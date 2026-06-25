import { notFound, redirect } from 'next/navigation';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { loadWaiterTableInitial } from '@/lib/staff-board';
import { createClient } from '@/lib/supabase/server';
import type { Buffet } from '@/types';

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function DashboardWaiterTablePage({ params }: Props) {
  const access = await loadDashboardAccess();
  if (access.mode !== 'frontdesk') {
    redirect('/dashboard');
  }

  const { tableId: tableIdParam } = await params;
  const tableId = parseTableIdParam(tableIdParam);
  if (!tableId) notFound();

  const { restaurant } = access;
  const supabase = await createClient();

  const [{ data: buffetRows }, detail] = await Promise.all([
    supabase
      .from('buffets')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('name'),
    loadWaiterTableInitial(restaurant.id, tableId).catch(() => null),
  ]);

  const menuItemIds = distinctMenuItemIdsFromOrders(detail?.orders ?? []);
  let itemCodeByMenuId: Record<string, string> = {};
  if (menuItemIds.length > 0) {
    const { data: menuRows } = await supabase
      .from('menu_items')
      .select('id, item_code')
      .eq('restaurant_id', restaurant.id)
      .in('id', menuItemIds);
    itemCodeByMenuId = menuItemCodeLookupFromRows(menuRows ?? []);
  }

  return (
    <WaiterTableDetail
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableId={tableId}
      displayName={detail?.table?.display_name ?? ''}
      itemCodeByMenuId={itemCodeByMenuId}
      embeddedInDashboard
      initialTableDetail={detail ?? undefined}
    />
  );
}
