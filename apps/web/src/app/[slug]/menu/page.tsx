import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RestaurantMaintenancePage } from '@/components/customer/RestaurantMaintenancePage';
import {
  loadCustomerRestaurantGate,
  loadCustomerSessionContext,
} from '@/lib/customer-session-context';
import { MenuPage } from '@/components/menu/MenuPage';
import { resolveStaffAssistedFlow } from '@/lib/staff-routes';
import { resolveCheckoutRequestCaller } from '@/lib/checkout-request-auth';
import { clampOrderCooldownSeconds } from '@/lib/order-submit-cooldown-client';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table_id?: string; from?: string; return?: string }>;
}

export default async function CustomerMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table_id: tableIdParam, from, return: returnPath } = await searchParams;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    notFound();
  }
  const gate = await loadCustomerRestaurantGate(admin, slug);
  if (gate.kind === 'not_found') notFound();
  if (gate.kind === 'suspended') {
    return <RestaurantMaintenancePage restaurantName={gate.name} reason={gate.reason} />;
  }
  const restaurant = gate.restaurant;

  const sessionContext = await loadCustomerSessionContext({
    admin,
    restaurantId: restaurant.id,
    tableIdParam,
  });
  if (!sessionContext) notFound();

  const staffAssisted = resolveStaffAssistedFlow(
    from,
    returnPath,
    slug,
    sessionContext.table_id,
    {
      canAssistBillCheckout:
        from === 'waiter'
          ? (await resolveCheckoutRequestCaller(slug)).kind === 'authorized_staff'
          : false,
    },
  );

  return (
    <MenuPage
      restaurant={restaurant}
      tableId={sessionContext.table_id}
      displayName={sessionContext.display_name}
      orderCooldownSeconds={clampOrderCooldownSeconds(restaurant.order_cooldown_seconds)}
      initialSessionContext={sessionContext}
      staffAssisted={staffAssisted}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('name')
    .eq('slug', slug)
    .single();

  return {
    title: restaurant ? `${restaurant.name} — 菜单` : '菜单',
  };
}
