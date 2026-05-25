import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { Buffet } from '@/types';
import {
  normalizeRestaurantTableNumbers,
  parseTableNumberParamOrNull,
  restaurantHasTableNumber,
} from '@/lib/restaurant-table-numbers';

interface Props {
  params: Promise<{ slug: string; table: string }>;
}

export default async function WaiterTablePage({ params }: Props) {
  const { slug, table } = await params;
  const tableNum = parseTableNumberParamOrNull(table);
  if (!tableNum) notFound();

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug, table_numbers')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const tableNumbers = normalizeRestaurantTableNumbers(restaurant.table_numbers);
  if (!restaurantHasTableNumber(tableNum, tableNumbers)) notFound();

  const { data: buffetRows } = await supabase
    .from('buffets')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('name');

  return (
    <WaiterTableDetail
      restaurant={restaurant}
      tableNumbers={tableNumbers}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableNumber={tableNum}
    />
  );
}
