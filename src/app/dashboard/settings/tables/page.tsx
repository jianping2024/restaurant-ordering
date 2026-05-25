import { createClient } from '@/lib/supabase/server';
import { TablesManager } from '@/components/dashboard/TablesManager';

export default async function SettingsTablesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, slug, name, table_numbers')
    .eq('owner_id', user!.id)
    .single();

  return (
    <TablesManager
      embedded
      restaurant={restaurant!}
      initialTableNumbers={restaurant!.table_numbers}
    />
  );
}
