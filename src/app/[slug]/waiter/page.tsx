import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WaiterPage({ params }: Props) {
  const { slug } = await params;
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

  return <WaiterDisplay restaurant={restaurant} tables={tables} />;
}
