import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { Buffet } from '@/types';
import { parseTableIdParam, sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';

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

  const { data: tableRows } = await supabase
    .from('restaurant_tables')
    .select('id, display_name, sort_order')
    .eq('restaurant_id', restaurant.id)
    .is('deleted_at', null);

  const tables = sortRestaurantTables((tableRows || []) as RestaurantTableRow[]);
  const table = tables.find((t) => t.id === tableId);
  if (!table) notFound();

  const { data: buffetRows } = await supabase
    .from('buffets')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('name');

  return (
    <WaiterTableDetail
      restaurant={restaurant}
      tables={tables}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableId={table.id}
      displayName={table.display_name}
    />
  );
}
