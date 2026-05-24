import { createClient } from '@/lib/supabase/server';
import { PrintStationsManager } from '@/components/dashboard/PrintStationsManager';

export default async function SettingsPrintStationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user!.id)
    .single();

  const restaurantId = restaurant!.id;

  const [{ data: printStations }, { data: menuCategories }, { data: menuItems }] = await Promise.all([
    supabase
      .from('print_stations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('menu_categories').select('id, print_station_id').eq('restaurant_id', restaurantId),
    supabase.from('menu_items').select('id, print_station_id').eq('restaurant_id', restaurantId),
  ]);

  return (
    <PrintStationsManager
      embedded
      restaurantId={restaurantId}
      initialStations={printStations ?? []}
      initialCategories={menuCategories ?? []}
      initialItems={menuItems ?? []}
    />
  );
}
