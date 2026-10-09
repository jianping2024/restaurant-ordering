/**
 * Guest individual checkout — server side (service role). Spec: docs/guest-individual-checkout.zh.md.
 *
 * Plan writes go through the SQL function `individual_checkout_apply` (session lock + revision
 * check + locked-ticket guard); this module loads the plan, merges/validates it with the pure
 * rules in `individual-checkout.ts`, and retries on a stale revision.
 * Call state lives in `bill_split_ticket_calls` (service-role only: it carries guest_client_id,
 * which must never be returned to other phones).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadActiveBillSplitForSession } from '@/lib/checkout-active-bill-split';
import { loadIndividualTickets, loadTicketCallRows } from '@/lib/individual-checkout-reads';
import { deriveBillView } from '@/lib/customer-bill-sync';
import { loadCustomerSessionOrders } from '@/lib/customer-session-context';
import {
  buildIndividualCallSignalItemsByTicket,
  individualPhoneHoldsOrdering,
  mergeIndividualTickets,
  recomputeIndividualTicketAmounts,
  validateIndividualCall,
  type IndividualCheckoutErrorCode,
} from '@/lib/individual-checkout';
import { checkoutErrorStatus, checkoutFailure } from '@/lib/checkout-error-codes';
import { splitResultTicketKey } from '@/lib/split-party-id';
import { isPartyMemberCountAllowedForCheckout } from '@/lib/table-party-groups';
import { countPartyMembersForTable } from '@/lib/table-party-groups-server';
import type { SplitPerson, SplitResult } from '@/types';

const MAX_STALE_RETRIES = 3;

export type IndividualApplyResult =
  | {
      ok: true;
      bill_split_id: string;
      session_id: string;
      result: SplitResult[];
      total_amount: number;
    }
  | {
      ok: false;
      status: number;
      error: IndividualCheckoutErrorCode | string;
      lineKeys?: string[];
      names?: string[];
      message?: string;
    };

type ActiveIndividualSession = {
  sessionId: string;
  tableName: string;
};

async function loadActiveIndividualSession(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<
  | { ok: true; session: ActiveIndividualSession }
  | { ok: false; status: number; error: string }
> {
  const { data: tableRow } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!tableRow) return checkoutFailure('table_not_available');

  const { data: session, error } = await admin
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return checkoutFailure('session_lookup_failed');
  if (!session?.id) return checkoutFailure('no_active_session');
  return {
    ok: true,
    session: {
      sessionId: session.id as string,
      tableName: tableRow.display_name as string,
    },
  };
}

/**
 * Ordering gate: a phone with a called, unpaid ticket in this session cannot add dishes.
 * Waiter flow never calls this. Fails open on read errors (the plan write guards stay strict).
 */
export async function guestPhoneHoldsOrdering(
  admin: SupabaseClient,
  params: { restaurantId: string; sessionId: string; clientId: string },
): Promise<boolean> {
  try {
    const split = await loadActiveBillSplitForSession({
      admin,
      restaurantId: params.restaurantId,
      sessionId: params.sessionId,
    });
    if (!split) return false;
    const tickets = await loadIndividualTickets(admin, {
      billSplitId: split.id,
      clientId: params.clientId,
    });
    return individualPhoneHoldsOrdering(
      tickets,
      Array.isArray(split.result) ? (split.result as SplitResult[]) : [],
    );
  } catch {
    return false;
  }
}

function applyFailure(code: string, message?: string): IndividualApplyResult {
  return { ok: false, status: checkoutErrorStatus(code), error: code, message };
}

/** Guest call: this phone's tickets are merged into the shared plan and locked. */
export async function submitIndividualCall(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    tableId: string;
    clientId: string;
    persons: SplitPerson[];
    result: SplitResult[];
  },
): Promise<IndividualApplyResult> {
  const { restaurantId, tableId, clientId } = params;
  const active = await loadActiveIndividualSession(admin, restaurantId, tableId);
  if (!active.ok) return { ok: false, status: active.status, error: active.error };
  const { sessionId, tableName } = active.session;

  // Guests never stamp frozen amounts; collect confirm is the sole stamp.
  const myPersons: SplitPerson[] = params.persons.map((person) => ({
    ...person,
    ...(person.item_shares
      ? {
          item_shares: person.item_shares.map((share) => {
            const unstamped = { ...share };
            delete unstamped.locked_amount;
            return unstamped;
          }),
        }
      : {}),
  }));

  for (let attempt = 0; attempt < MAX_STALE_RETRIES; attempt += 1) {
    const orders = await loadCustomerSessionOrders({
      admin,
      restaurantId,
      sessionId,
      ascending: true,
    });
    const view = deriveBillView(orders);
    if (view.orderLines.length === 0) {
      return checkoutFailure('empty_session');
    }
    let partyMemberCount: number;
    try {
      partyMemberCount = await countPartyMembersForTable(admin, restaurantId, tableId);
    } catch (err) {
      return {
        ok: false,
        status: 500,
        error: 'party_lookup_failed',
        message: err instanceof Error ? err.message : String(err),
      };
    }
    if (!isPartyMemberCountAllowedForCheckout(partyMemberCount)) {
      return checkoutFailure('party_merge_required');
    }

    const existing = await loadActiveBillSplitForSession({ admin, restaurantId, sessionId });
    if (existing && existing.split_mode !== 'by_item') {
      return applyFailure('split_mode_locked');
    }

    const merged = mergeIndividualTickets({
      existingPersons: existing && Array.isArray(existing.persons) ? existing.persons : [],
      existingResult: existing && Array.isArray(existing.result) ? existing.result : [],
      myPersons,
      myResult: params.result,
    });
    const issue = validateIndividualCall({
      lineSpecs: view.lineSpecs,
      persons: merged.persons,
      result: merged.result,
      myKeys: merged.myKeys,
    });
    if (!issue.ok) {
      return {
        ok: false,
        status: checkoutErrorStatus(issue.code),
        error: issue.code,
        lineKeys: issue.lineKeys,
        names: issue.names,
      };
    }
    const result = recomputeIndividualTicketAmounts({
      orderLines: view.splitOrderLines,
      lineSpecs: view.lineSpecs,
      persons: merged.persons,
      result: merged.result,
      myKeys: merged.myKeys,
    });
    const ticketSignalItems = buildIndividualCallSignalItemsByTicket({
      orderLines: view.splitOrderLines,
      lineSpecs: view.lineSpecs,
      persons: merged.persons,
      ticketKeys: merged.myKeys,
    });

    const { data, error } = await admin.rpc('individual_checkout_apply', {
      p_restaurant_id: restaurantId,
      p_session_id: sessionId,
      p_table_id: tableId,
      p_display_name: tableName,
      p_order_ids: orders.map((order) => order.id),
      p_action: 'call',
      p_actor: 'guest',
      p_client_id: clientId,
      p_party_keys: merged.myKeys,
      p_base_revision: existing ? existing.revision ?? 0 : null,
      p_persons: merged.persons,
      p_result: result,
      p_total_amount: view.total,
      p_ticket_signal_items: ticketSignalItems,
    });
    if (error) return applyFailure('individual_apply_failed', error.message);

    const payload = data as {
      ok?: boolean;
      code?: string;
      message?: string;
      bill_split_id?: string;
      result?: SplitResult[];
      total_amount?: number;
    } | null;
    if (payload?.ok && payload.bill_split_id) {
      return {
        ok: true,
        bill_split_id: payload.bill_split_id,
        session_id: sessionId,
        result: payload.result ?? result,
        total_amount: payload.total_amount ?? view.total,
      };
    }
    const code = payload?.code ?? 'individual_apply_failed';
    if (code === 'stale_plan' && attempt < MAX_STALE_RETRIES - 1) continue;
    return applyFailure(code, payload?.message);
  }
  return applyFailure('stale_plan');
}

/** Unlock tickets (guest: own tickets only; staff: any uncollected ticket). */
export async function unlockIndividualTickets(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    tableId: string;
    actor: 'guest' | 'staff';
    clientId?: string | null;
    /** Omit for a guest: unlocks every ticket this phone called. */
    ticketKeys?: string[];
  },
): Promise<IndividualApplyResult> {
  const { restaurantId, tableId, actor } = params;
  const active = await loadActiveIndividualSession(admin, restaurantId, tableId);
  if (!active.ok) return { ok: false, status: active.status, error: active.error };
  const { sessionId, tableName } = active.session;

  for (let attempt = 0; attempt < MAX_STALE_RETRIES; attempt += 1) {
    const existing = await loadActiveBillSplitForSession({ admin, restaurantId, sessionId });
    if (!existing) return applyFailure('ticket_not_found');
    const calls = await loadTicketCallRows(admin, existing.id);

    const paidKeys = new Set<string>();
    for (const row of existing.result ?? []) {
      if (row.paid) {
        const key = splitResultTicketKey(row);
        if (key) paidKeys.add(key);
      }
    }
    const requested = params.ticketKeys?.length
      ? params.ticketKeys
      : calls
          .filter(
            (row) =>
              row.state === 'called' &&
              !paidKeys.has(row.ticket_key) &&
              (actor === 'staff' || row.client_id === (params.clientId ?? null)),
          )
          .map((row) => row.ticket_key);
    const keys = Array.from(new Set(requested.filter(Boolean)));
    if (keys.length === 0) return applyFailure('ticket_not_found');

    const orders = await loadCustomerSessionOrders({
      admin,
      restaurantId,
      sessionId,
      ascending: true,
    });
    const { data, error } = await admin.rpc('individual_checkout_apply', {
      p_restaurant_id: restaurantId,
      p_session_id: sessionId,
      p_table_id: tableId,
      p_display_name: tableName,
      p_order_ids: orders.map((order) => order.id),
      p_action: 'unlock',
      p_actor: actor,
      p_client_id: params.clientId ?? null,
      p_party_keys: keys,
      p_base_revision: existing.revision ?? 0,
      p_persons: existing.persons ?? [],
      p_result: existing.result ?? [],
      p_total_amount: existing.total_amount,
    });
    if (error) return applyFailure('individual_apply_failed', error.message);

    const payload = data as {
      ok?: boolean;
      code?: string;
      message?: string;
      bill_split_id?: string;
      result?: SplitResult[];
      total_amount?: number;
    } | null;
    if (payload?.ok && payload.bill_split_id) {
      return {
        ok: true,
        bill_split_id: payload.bill_split_id,
        session_id: sessionId,
        result: payload.result ?? existing.result,
        total_amount: payload.total_amount ?? existing.total_amount,
      };
    }
    const code = payload?.code ?? 'individual_apply_failed';
    if (code === 'stale_plan' && attempt < MAX_STALE_RETRIES - 1) continue;
    return applyFailure(code, payload?.message);
  }
  return applyFailure('stale_plan');
}
