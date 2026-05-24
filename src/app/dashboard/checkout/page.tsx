import { createClient } from '@/lib/supabase/server';
import type { BillSplit } from '@/types';
import { CheckoutRequestsPageClient } from '@/components/dashboard/CheckoutRequestsPageClient';

export default async function CheckoutRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, slug')
    .eq('owner_id', user!.id)
    .single();

  const { data: checkoutRequests } = await supabase
    .from('bill_splits')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .eq('status', 'requested')
    .not('session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <CheckoutRequestsPageClient
      restaurantSlug={restaurant!.slug}
      checkoutRequests={(checkoutRequests || []) as BillSplit[]}
    />
  );
}
