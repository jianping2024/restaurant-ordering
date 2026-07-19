import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseSessionCollectedPayments,
  SESSION_COLLECTED_PAYMENT_SELECT,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import {
  loadCustomerExistingSplit,
  loadCustomerSessionOrders,
  resolveCustomerTableContext,
} from '@/lib/customer-session-context';
import { countPartyMembersForTable } from '@/lib/table-party-groups-server';
import type { BillSplit, Order, SessionStatus, TableSession } from '@/types';

/** Full bill page / SSR model. */
export type CustomerBillPageModel = {
  table_id: string;
  display_name: string;
  active_session: TableSession | null;
  orders: Order[];
  existing_split: BillSplit | null;
  collected_payments: SessionCollectedPayment[];
  party_member_count: number;
};

/**
 * Reconcile wire shape — no full session row; split/payments included so the bill page
 * can refresh checkout freshness (complete-B).
 */
export type CustomerBillRefresh = {
  orders: Order[];
  party_member_count: number;
  session_status: SessionStatus | null;
  session_id: string | null;
  existing_split: BillSplit | null;
  collected_payments: SessionCollectedPayment[];
};

export function toCustomerBillRefresh(model: CustomerBillPageModel): CustomerBillRefresh {
  return {
    orders: model.orders,
    party_member_count: model.party_member_count,
    session_status: model.active_session?.status ?? null,
    session_id: model.active_session?.id ?? null,
    existing_split: model.existing_split,
    collected_payments: model.collected_payments,
  };
}

export async function loadCustomerBillPageModel(params: {
  admin: SupabaseClient;
  restaurantId: string;
  tableIdParam: string | null;
}): Promise<CustomerBillPageModel | null> {
  const ctx = await resolveCustomerTableContext({
    admin: params.admin,
    restaurantId: params.restaurantId,
    tableIdParam: params.tableIdParam,
  });
  if (!ctx) return null;

  if (!ctx.activeSession?.id) {
    return {
      table_id: ctx.tableId,
      display_name: ctx.displayName,
      active_session: null,
      orders: [],
      existing_split: null,
      collected_payments: [],
      party_member_count: 0,
    };
  }

  const sessionId = ctx.activeSession.id;
  const [orders, existingSplit, collectedRowsResult, partyMemberCount] = await Promise.all([
    loadCustomerSessionOrders({
      admin: params.admin,
      restaurantId: params.restaurantId,
      sessionId,
      ascending: true,
    }),
    loadCustomerExistingSplit({ admin: params.admin, sessionId }),
    params.admin
      .from('session_collected_payments')
      .select(SESSION_COLLECTED_PAYMENT_SELECT)
      .eq('restaurant_id', params.restaurantId)
      .eq('session_id', sessionId),
    countPartyMembersForTable(params.admin, params.restaurantId, ctx.tableId).catch(() => 0),
  ]);

  return {
    table_id: ctx.tableId,
    display_name: ctx.displayName,
    active_session: ctx.activeSession,
    orders,
    existing_split: existingSplit,
    collected_payments: parseSessionCollectedPayments(collectedRowsResult.data),
    party_member_count: partyMemberCount,
  };
}
