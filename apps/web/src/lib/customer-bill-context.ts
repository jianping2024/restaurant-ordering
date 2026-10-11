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
import { loadIndividualTickets } from '@/lib/individual-checkout-reads';
import { countPartyMembersForTable } from '@/lib/table-party-groups-server';
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient;

/** The phone's last live session, only when it is this table's closed session. */
async function resolveClosedSessionId(params: {
  admin: AdminClient;
  restaurantId: string;
  tableId: string;
  sessionId?: string | null;
}): Promise<string | null> {
  const sessionId = params.sessionId?.trim();
  if (!sessionId) return null;
  const { data } = await params.admin
    .from('table_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('restaurant_id', params.restaurantId)
    .eq('table_id', params.tableId)
    .eq('status', 'closed')
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function loadCustomerBillContext(params: {
  admin: AdminClient;
  restaurantId: string;
  tableIdParam?: string | null;
  tableContext?: CustomerResolvedTableContext | null;
  /** Default full — bill SSR/API boot keeps split and ledger. */
  scope?: CustomerBillScope;
  /** Asking phone (individual-checkout sessions): marks which called tickets are `mine`. */
  guestClientId?: string | null;
  /**
   * Session this phone last saw live. Only read when the table has no live session and that
   * session is this table's closed one: returns its final split / ledger / tickets (no orders).
   */
  closedSessionId?: string | null;
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
    const closedSessionId = await resolveClosedSessionId({
      admin: params.admin,
      restaurantId: params.restaurantId,
      tableId: tableContext.tableId,
      sessionId: params.closedSessionId,
    });
    const closedSplit = closedSessionId
      ? await loadCustomerExistingSplit({
          admin: params.admin,
          sessionId: closedSessionId,
          includePaid: true,
        })
      : null;
    const [closedPayments, closedTickets] = closedSessionId
      ? await Promise.all([
          params.admin
            .from('session_collected_payments')
            .select(SESSION_COLLECTED_PAYMENT_SELECT)
            .eq('restaurant_id', params.restaurantId)
            .eq('session_id', closedSessionId)
            .then(({ data }) => parseSessionCollectedPayments(data)),
          loadIndividualTickets(params.admin, {
            billSplitId: closedSplit?.id,
            clientId: params.guestClientId,
          }),
        ])
      : [[], []];
    return {
      table_id: tableContext.tableId,
      display_name: tableContext.displayName,
      active_session: null,
      orders: [],
      existing_split: closedSplit,
      collected_payments: closedPayments,
      party_member_count: 0,
      individual_tickets: closedTickets,
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

  const individualTickets = await loadIndividualTickets(params.admin, {
    billSplitId: existingSplit?.id,
    clientId: params.guestClientId,
  });

  return {
    table_id: tableContext.tableId,
    display_name: tableContext.displayName,
    active_session: tableContext.activeSession,
    orders,
    existing_split: existingSplit,
    collected_payments: collectedPayments,
    party_member_count: partyMemberCount,
    individual_tickets: individualTickets,
  };
}
