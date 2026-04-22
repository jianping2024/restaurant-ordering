import { createClient } from '@/lib/supabase/server';
import { TablesManager } from '@/components/dashboard/TablesManager';

export default async function TablesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, slug, name')
    .eq('owner_id', user!.id)
    .single();

  return <TablesManager restaurant={restaurant!} />;
}
