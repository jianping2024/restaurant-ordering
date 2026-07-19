import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseSessionCollectedPayments,
  SESSION_COLLECTED_PAYMENT_SELECT,
} from '@/lib/checkout-session-payments';
import { RestaurantMaintenancePage } from '@/components/customer/RestaurantMaintenancePage';
import { BillPage } from '@/components/menu/BillPage';
import {
  loadCustomerExistingSplit,
  loadCustomerRestaurantGate,
  loadCustomerSessionOrders,
  resolveCustomerTableContext,
} from '@/lib/customer-session-context';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { resolveCheckoutRequestCaller } from '@/lib/checkout-request-auth';
import {
  resolveStaffAssistedFlow,
  waiterBoardHref,
} from '@/lib/staff-routes';
import { countPartyMembersForTable } from '@/lib/table-party-groups-server';

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

  const caller = await resolveCheckoutRequestCaller(slug);
  const staffAssisted = resolveStaffAssistedFlow(
    from,
    returnPath,
    slug,
    tableContext.tableId,
    { canAssistBillCheckout: caller.kind === 'authorized_staff' },
  );

  if (caller.kind === 'forbidden_staff') {
    redirect(staffAssisted?.returnHref ?? waiterBoardHref(slug));
  }

  if (!tableContext.activeSession) {
    if (staffAssisted) {
      redirect(staffAssisted.returnHref);
    }
    redirect(`/${slug}/menu?table_id=${encodeURIComponent(tableContext.tableId)}`);
  }

  const [orders, existingSplit, partyMemberCount] = await Promise.all([
    loadCustomerSessionOrders({
      admin,
      restaurantId: restaurant.id,
      sessionId: tableContext.activeSession.id,
      ascending: true,
    }),
    loadCustomerExistingSplit({ admin, sessionId: tableContext.activeSession.id }),
    countPartyMembersForTable(admin, restaurant.id, tableContext.tableId).catch(() => 0),
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
  let initialCollectedPayments: ReturnType<typeof parseSessionCollectedPayments> = [];
  if (tableContext.activeSession.id) {
    const sessionId = tableContext.activeSession.id;
    const [{ data: feedbackSession }, collectedRowsResult] = await Promise.all([
      admin
        .from('feedback_sessions')
        .select('completed_at, skipped_at')
        .eq('session_id', sessionId)
        .maybeSingle(),
      admin
        .from('session_collected_payments')
        .select(SESSION_COLLECTED_PAYMENT_SELECT)
        .eq('restaurant_id', restaurant.id)
        .eq('session_id', sessionId),
    ]);
    initialCollectedPayments = parseSessionCollectedPayments(collectedRowsResult.data);
    initialFeedbackSubmitted = !!feedbackSession?.completed_at;
    initialFeedbackSkipped = !!feedbackSession?.skipped_at;
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
      initialCollectedPayments={initialCollectedPayments}
      staffAssisted={staffAssisted}
      initialFeedbackSubmitted={initialFeedbackSubmitted}
      initialFeedbackSkipped={initialFeedbackSkipped}
      itemCodeByMenuId={itemCodeByMenuId}
      initialPartyMemberCount={partyMemberCount}
    />
  );
}
