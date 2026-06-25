import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { Buffet } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { staffAuthForPage } from '@/lib/staff-api-auth';
import { loadWaiterTableInitial } from '@/lib/staff-board';

interface Props {
  params: Promise<{ slug: string; tableId: string }>;
}

export default async function WaiterTablePage({ params }: Props) {
  const { slug, tableId: tableIdParam } = await params;
  const tableId = parseTableIdParam(tableIdParam);
  if (!tableId) notFound();

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const auth = await staffAuthForPage(slug, 'waiter');

  const [{ data: buffetRows }, detail] = await Promise.all([
    supabase
      .from('buffets')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('name'),
    auth
      ? loadWaiterTableInitial(auth.restaurant_id, tableId).catch(() => null)
      : Promise.resolve(null),
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
      restaurant={restaurant}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableId={tableId}
      displayName={detail?.table?.display_name ?? ''}
      itemCodeByMenuId={itemCodeByMenuId}
      initialTableDetail={detail ?? undefined}
    />
  );
}
