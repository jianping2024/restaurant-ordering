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

  if (!tableContext.activeSession) {
    if (from === 'waiter') {
      redirect(returnPath || `/${slug}/waiter`);
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
  if (tableContext.activeSession.id) {
    const { data: feedbackSession } = await admin
      .from('feedback_sessions')
      .select('completed_at, skipped_at')
      .eq('session_id', tableContext.activeSession.id)
      .maybeSingle();
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
      existingSplit={existingSplit}
      returnPath={from === 'waiter' ? (returnPath || `/${slug}/waiter`) : null}
      initialFeedbackSubmitted={initialFeedbackSubmitted}
      initialFeedbackSkipped={initialFeedbackSkipped}
      itemCodeByMenuId={itemCodeByMenuId}
    />
  );
}
