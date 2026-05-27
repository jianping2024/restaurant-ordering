import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { Buffet } from '@/types';
import { parseTableIdParam, type RestaurantTableRow } from '@/lib/restaurant-tables';

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

  const { data: tableRow } = await supabase
    .from('restaurant_tables')
    .select('id, display_name, sort_order')
    .eq('restaurant_id', restaurant.id)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!tableRow) notFound();

  const { data: buffetRows } = await supabase
    .from('buffets')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('name');

  return (
    <WaiterTableDetail
      restaurant={restaurant}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableId={tableId}
      displayName={tableRow.display_name}
      tables={[tableRow as RestaurantTableRow]}
    />
  );
}
