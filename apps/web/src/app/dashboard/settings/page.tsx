import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/dashboard/SettingsForm';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, address, phone, geo_latitude, geo_longitude, order_radius_meters, country_code, feature_flags')
    .eq('owner_id', user!.id)
    .single();

  return <SettingsForm embedded restaurant={restaurant!} />;
}
