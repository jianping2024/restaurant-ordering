import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { BillSplit } from '@/types';
import { CheckoutRequestsPageClient } from '@/components/dashboard/CheckoutRequestsPageClient';
import { loadDashboardAccess } from '@/lib/dashboard-access';

export default async function CheckoutRequestsPage() {
  const access = await loadDashboardAccess();
  if (access.mode === 'unauthenticated') redirect('/auth/login');
  if (access.mode === 'onboarding' || access.mode === 'access_error') redirect('/dashboard');

  const restaurant = access.restaurant;
  const supabase = await createClient();

  const { data: checkoutRequests } = await supabase
    .from('bill_splits')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'requested')
    .not('session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <CheckoutRequestsPageClient
      restaurantSlug={restaurant.slug}
      checkoutRequests={(checkoutRequests || []) as BillSplit[]}
    />
  );
}
