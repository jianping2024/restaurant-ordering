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

  const { data: printStations } = await supabase
    .from('print_stations')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (
    <PrintStationsManager
      embedded
      restaurantId={restaurant!.id}
      initialStations={printStations ?? []}
    />
  );
}
