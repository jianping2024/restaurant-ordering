import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { RestaurantMaintenancePage } from '@/components/customer/RestaurantMaintenancePage';
import { BillPage } from '@/components/menu/BillPage';
import {
  loadCustomerExistingSplit,
  loadCustomerRestaurantGate,
  loadCustomerSessionOrders,
  resolveCustomerTableContext,
} from '@/lib/customer-session-context';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { resolveWaiterMenuReturnHref } from '@/lib/staff-routes';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table_id?: string; from?: string; return?: string }>;
}

export default async function BillRoute({ params, searchParams }: Props) {
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

  const tableContext = await resolveCustomerTableContext({
    admin,
    restaurantId: restaurant.id,
    tableIdParam,
  });
  if (!tableContext) notFound();

  const waiterReturnHref = resolveWaiterMenuReturnHref(from, returnPath, slug);

  if (!tableContext.activeSession) {
    if (waiterReturnHref) {
      redirect(waiterReturnHref);
    }
    redirect(`/${slug}/menu?table_id=${encodeURIComponent(tableContext.tableId)}`);
  }

  const [orders, existingSplit] = await Promise.all([
    loadCustomerSessionOrders({
      admin,
      restaurantId: restaurant.id,
      sessionId: tableContext.activeSession.id,
      ascending: true,
    }),
    loadCustomerExistingSplit({ admin, sessionId: tableContext.activeSession.id }),
  ]);

  const menuItemIds = distinctMenuItemIdsFromOrders(orders);
  let itemCodeByMenuId: Record<string, string> = {};
  if (menuItemIds.length > 0) {
    const { data: menuRows } = await admin
      .from('menu_items')
      .select('id, item_code')
      .eq('restaurant_id', restaurant.id)
      .in('id', menuItemIds);
    itemCodeByMenuId = menuItemCodeLookupFromRows(menuRows ?? []);
  }

  let initialFeedbackSubmitted = false;
  let initialFeedbackSkipped = false;
  let hasCollectedPayments = false;
  if (tableContext.activeSession.id) {
    const sessionId = tableContext.activeSession.id;
    const [{ data: feedbackSession }, collectedCountResult] = await Promise.all([
      admin
        .from('feedback_sessions')
        .select('completed_at, skipped_at')
        .eq('session_id', sessionId)
        .maybeSingle(),
      admin
        .from('session_collected_payments')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id)
        .eq('session_id', sessionId),
    ]);
    initialFeedbackSubmitted = !!feedbackSession?.completed_at;
    initialFeedbackSkipped = !!feedbackSession?.skipped_at;
    hasCollectedPayments = (collectedCountResult.count ?? 0) > 0;
  }

  return (
    <BillPage
      restaurant={restaurant}
      tableId={tableContext.tableId}
      displayName={tableContext.displayName}
      orders={orders}
      sessionId={tableContext.activeSession.id}
      sessionStatus={tableContext.activeSession.status}
      existingSplit={existingSplit}
      hasCollectedPayments={hasCollectedPayments}
      returnPath={waiterReturnHref}
      initialFeedbackSubmitted={initialFeedbackSubmitted}
      initialFeedbackSkipped={initialFeedbackSkipped}
      itemCodeByMenuId={itemCodeByMenuId}
    />
  );
}
