import { notFound, redirect } from 'next/navigation';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { createClient } from '@/lib/supabase/server';
import type { Buffet } from '@/types';

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function DashboardWaiterTablePage({ params }: Props) {
  const access = await loadDashboardAccess();
  if (access.mode !== 'owner') {
    redirect('/dashboard');
  }

  const { tableId: tableIdParam } = await params;
  const tableId = parseTableIdParam(tableIdParam);
  if (!tableId) notFound();

  const { restaurant } = access;
  const supabase = await createClient();

  const { data: buffetRows } = await supabase
    .from('buffets')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('name');

  const { data: menuRows } = await supabase
    .from('menu_items')
    .select('id, item_code')
    .eq('restaurant_id', restaurant.id);

  const itemCodeByMenuId = menuItemCodeLookupFromRows(menuRows ?? []);

  return (
    <WaiterTableDetail
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableId={tableId}
      itemCodeByMenuId={itemCodeByMenuId}
      embeddedInDashboard
    />
  );
}
