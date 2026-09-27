import {
  parseSessionCollectedPayments,
  SESSION_COLLECTED_PAYMENT_SELECT,
} from '@/lib/checkout-session-payments';
import {
  loadCustomerExistingSplit,
  loadCustomerSessionOrders,
  resolveCustomerTableContext,
  type CustomerBillContext,
  type CustomerBillScope,
  type CustomerResolvedTableContext,
} from '@/lib/customer-session-context';
import { countPartyMembersForTable } from '@/lib/table-party-groups-server';
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient;

export async function loadCustomerBillContext(params: {
  admin: AdminClient;
  restaurantId: string;
  tableIdParam?: string | null;
  tableContext?: CustomerResolvedTableContext | null;
  /** Default full — bill SSR/API boot keeps split and ledger. */
  scope?: CustomerBillScope;
}): Promise<CustomerBillContext | null> {
  const scope = params.scope ?? 'full';
  const tableContext =
    params.tableContext ??
    (await resolveCustomerTableContext({
      admin: params.admin,
      restaurantId: params.restaurantId,
      tableIdParam: params.tableIdParam,
    }));
  if (!tableContext) return null;

  if (!tableContext.activeSession?.id) {
    return {
      table_id: tableContext.tableId,
      display_name: tableContext.displayName,
      active_session: null,
      orders: [],
      existing_split: null,
      collected_payments: [],
      party_member_count: 0,
    };
  }

  const sessionId = tableContext.activeSession.id;
  // Always full bill truth (orders + split + ledger). `scope=live` is accepted for
  // URL compat but must not drop split/payments — soft menu→bill equals hard refresh.
  void scope;
  const [orders, partyMemberCount, existingSplit, collectedPayments] = await Promise.all([
    loadCustomerSessionOrders({
      admin: params.admin,
      restaurantId: params.restaurantId,
      sessionId,
      ascending: true,
    }),
    countPartyMembersForTable(params.admin, params.restaurantId, tableContext.tableId).catch(() => 0),
    loadCustomerExistingSplit({ admin: params.admin, sessionId }),
    params.admin
      .from('session_collected_payments')
      .select(SESSION_COLLECTED_PAYMENT_SELECT)
      .eq('restaurant_id', params.restaurantId)
      .eq('session_id', sessionId)
      .then(({ data }) => parseSessionCollectedPayments(data)),
  ]);

  return {
    table_id: tableContext.tableId,
    display_name: tableContext.displayName,
    active_session: tableContext.activeSession,
    orders,
    existing_split: existingSplit,
    collected_payments: collectedPayments,
    party_member_count: partyMemberCount,
  };
}
