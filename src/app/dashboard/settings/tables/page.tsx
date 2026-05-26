import { createClient } from '@/lib/supabase/server';
import { TablesManager } from '@/components/dashboard/TablesManager';
import { sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';

export default async function SettingsTablesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, slug, name')
    .eq('owner_id', user!.id)
    .single();

  const { data: tableRows } = await supabase
    .from('restaurant_tables')
    .select('id, display_name, sort_order')
    .eq('restaurant_id', restaurant!.id)
    .is('deleted_at', null)
    .order('sort_order');

  return (
    <TablesManager
      embedded
      restaurant={restaurant!}
      initialTables={sortRestaurantTables((tableRows || []) as RestaurantTableRow[])}
    />
  );
}
