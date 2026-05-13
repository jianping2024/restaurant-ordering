import { createClient } from '@/lib/supabase/server';
import { BuffetSettingsManager } from '@/components/dashboard/BuffetSettingsManager';

export default async function SettingsBuffetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user!.id)
    .single();

  if (!restaurant) return null;

  return <BuffetSettingsManager embedded restaurantId={restaurant.id} />;
}
