import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { Buffet } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { menuItemCodeLookupFromRows } from '@/lib/menu-item-code';

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
      restaurant={restaurant}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableId={tableId}
      itemCodeByMenuId={itemCodeByMenuId}
    />
  );
}
