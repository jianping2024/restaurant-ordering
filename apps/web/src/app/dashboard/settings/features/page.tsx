import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FeatureFlagsManager } from '@/components/dashboard/FeatureFlagsManager';
import {
  normalizeRestaurantFeatureFlags,
  resolvePrintAgentCredentialTtlDays,
} from '@/lib/restaurant-features';

export default async function SettingsFeaturesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('feature_flags, print_agent_config')
    .eq('owner_id', user.id)
    .single();

  if (!restaurant) redirect('/dashboard');

  return (
    <FeatureFlagsManager
      embedded
      initialFlags={normalizeRestaurantFeatureFlags(restaurant.feature_flags)}
      initialCredentialTtlDays={resolvePrintAgentCredentialTtlDays(restaurant.print_agent_config)}
    />
  );
}
