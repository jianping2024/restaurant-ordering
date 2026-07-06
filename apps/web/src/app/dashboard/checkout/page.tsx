import { redirect } from 'next/navigation';
import { CheckoutRequestsPageClient } from '@/components/dashboard/CheckoutRequestsPageClient';
import { parseCheckoutQueueFocus } from '@/lib/checkout-queue-focus';
import { loadDashboardAccess } from '@/lib/dashboard-access';

export default async function CheckoutRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ table_id?: string; request_id?: string }>;
}) {
  const access = await loadDashboardAccess();
  if (access.mode === 'unauthenticated') redirect('/auth/login');
  if (access.mode === 'onboarding' || access.mode === 'access_error') redirect('/dashboard');

  const restaurant = access.restaurant;
  const initialFocus = parseCheckoutQueueFocus(await searchParams) ?? undefined;

  return (
    <CheckoutRequestsPageClient
      restaurantId={restaurant.id}
      restaurantSlug={restaurant.slug}
      accessMode={access.mode}
      canCloseTable={access.mode === 'frontdesk' || access.mode === 'owner'}
      initialFocus={initialFocus}
    />
  );
}
