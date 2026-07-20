import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerBillContext } from '@/lib/customer-bill-context';
import {
  loadCustomerRestaurantGate,
  resolveCustomerTableContext,
} from '@/lib/customer-session-context';
import { RestaurantMaintenancePage } from '@/components/customer/RestaurantMaintenancePage';
import { BillPage } from '@/components/menu/BillPage';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { resolveCheckoutRequestCaller } from '@/lib/checkout-request-auth';
import {
  resolveStaffAssistedFlow,
  waiterBoardHref,
} from '@/lib/staff-routes';

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

  const bill = await loadCustomerBillContext({
    admin,
    restaurantId: restaurant.id,
    tableContext,
    scope: 'full',
  });
  if (!bill?.active_session?.id) {
    if (staffAssisted) {
      redirect(staffAssisted.returnHref);
    }
    redirect(`/${slug}/menu?table_id=${encodeURIComponent(tableContext.tableId)}`);
  }

  const menuItemIds = distinctMenuItemIdsFromOrders(bill.orders);
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
  if (bill.active_session.id) {
    const sessionId = bill.active_session.id;
    const { data: feedbackSession } = await admin
      .from('feedback_sessions')
      .select('completed_at, skipped_at')
      .eq('session_id', sessionId)
      .maybeSingle();
    initialFeedbackSubmitted = !!feedbackSession?.completed_at;
    initialFeedbackSkipped = !!feedbackSession?.skipped_at;
  }

  return (
    <BillPage
      restaurant={restaurant}
      tableId={bill.table_id}
      displayName={bill.display_name}
      orders={bill.orders}
      sessionId={bill.active_session.id}
      sessionStatus={bill.active_session.status}
      existingSplit={bill.existing_split}
      initialCollectedPayments={bill.collected_payments}
      staffAssisted={staffAssisted}
      initialFeedbackSubmitted={initialFeedbackSubmitted}
      initialFeedbackSkipped={initialFeedbackSkipped}
      itemCodeByMenuId={itemCodeByMenuId}
      initialPartyMemberCount={bill.party_member_count}
    />
  );
}
