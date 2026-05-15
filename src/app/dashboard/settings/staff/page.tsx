import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StaffAccountsManager } from '@/components/dashboard/StaffAccountsManager';
import type { RestaurantStaffAccount } from '@/types';

export default async function SettingsStaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!restaurant) redirect('/dashboard');

  const { data: staff } = await supabase
    .from('restaurant_staff_accounts')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: true });

  return (
    <StaffAccountsManager embedded initialStaff={(staff ?? []) as RestaurantStaffAccount[]} />
  );
}
