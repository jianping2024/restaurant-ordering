import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RestaurantMaintenancePage } from '@/components/customer/RestaurantMaintenancePage';
import { loadCustomerRestaurantGate } from '@/lib/customer-restaurant-gate';
import {
  loadCustomerSessionContext,
  resolveCustomerTableContext,
} from '@/lib/customer-session-context';
import { loadCustomerMenuCatalogForDisplay } from '@/lib/customer-menu-catalog';
import { MenuPage } from '@/components/menu/MenuPage';
import { resolveStaffAssistedFlow } from '@/lib/staff-routes';
import { resolveCheckoutRequestCaller } from '@/lib/checkout-request-auth';
import { clampOrderCooldownSeconds } from '@/lib/order-submit-cooldown-client';
import { guestTableManifestHref } from '@/lib/pwa/guest-table-pwa-manifest';
import { formatGuestTableWindowTitle } from '@/lib/pwa/site-manifest';
import { loadTableInTakeawayGroup } from '@/lib/instore-takeaway-server';

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

  const [sessionContext, initialMenuCatalog] = await Promise.all([
    loadCustomerSessionContext({
      admin,
      restaurantId: restaurant.id,
      tableIdParam,
    }),
    loadCustomerMenuCatalogForDisplay(restaurant.id),
  ]);
  if (!sessionContext) notFound();

  const tableInTakeawayGroup = await loadTableInTakeawayGroup(
    admin,
    restaurant.id,
    sessionContext.table_id,
  );

  const staffAssisted = resolveStaffAssistedFlow(
    from,
    returnPath,
    slug,
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
      tableInTakeawayGroup={tableInTakeawayGroup}
      orderCooldownSeconds={clampOrderCooldownSeconds(restaurant.order_cooldown_seconds)}
      initialSessionContext={sessionContext}
      initialMenuCatalog={initialMenuCatalog}
      staffAssisted={staffAssisted}
    />
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const { table_id: tableIdParam } = await searchParams;
  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name')
    .eq('slug', slug)
    .single();

  if (!restaurant) return { title: '' };

  let manifestHref: string | null = null;
  let tableLabel: string | null = null;
  try {
    const admin = createAdminClient();
    const table = await resolveCustomerTableContext({
      admin,
      restaurantId: restaurant.id as string,
      tableIdParam,
    });
    if (table) {
      tableLabel = table.displayName;
      manifestHref = guestTableManifestHref(slug, table.tableId);
    }
  } catch {
    // No service role → keep default staff site manifest.
  }

  const title = formatGuestTableWindowTitle({
    restaurantName: String(restaurant.name ?? ''),
    tableDisplayName: tableLabel,
  });

  if (!manifestHref || !tableLabel) {
    return { title };
  }

  return {
    title,
    manifest: manifestHref,
    appleWebApp: {
      capable: true,
      title: tableLabel,
      statusBarStyle: 'black-translucent',
    },
  };
}
