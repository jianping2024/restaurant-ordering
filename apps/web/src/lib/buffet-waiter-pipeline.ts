import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import {
  buildBuffetBaseLine,
  isBuffetGuestCountsUnchanged,
  normalizeBuffetGuestCounts,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
import {
  applyBuffetOpenToSession,
  applyBuffetOpenWritePlanToOrders,
  mapToBuffetSessionOrders,
} from '@/lib/buffet-open-table';
import { resolveBuffetPricesServer } from '@/lib/resolve-buffet-prices-server';
import { openTableSessionIfAbsent } from '@/lib/table-session-open';
import {
  buildActiveWaiterTablePageModel,
  fetchCheckoutRequestedForTable,
  isCheckoutPending,
  loadActiveBuffets,
  loadTableAndSession,
  loadTableOrdersForSession,
  resolveOpenTableBuffetPrices,
} from '@/lib/waiter-table-detail-load';
import {
  sessionMetaFromEnsuredSession,
  tableSessionRefFromRow,
} from '@/lib/waiter-table-session-meta';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

export type BuffetWaiterPipelineInput = {
  restaurantId: string;
  userId: string;
  tableId: string;
  buffetId: string;
  adultCount: number;
  childCount: number;
};

export type BuffetWaiterPipelineSuccess = {
  ok: true;
  model: WaiterTablePageModel;
  unchanged?: true;
};

export type BuffetWaiterPipelineFailure = {
  ok: false;
  status: number;
  error: string;
  code?: string;
  message?: string;
};

export type BuffetWaiterPipelineResult = BuffetWaiterPipelineSuccess | BuffetWaiterPipelineFailure;

function pipelineFailure(
  status: number,
  error: string,
  extra?: { code?: string; message?: string },
): BuffetWaiterPipelineFailure {
  return { ok: false, status, error, ...extra };
}

/**
 * Single server pipeline for 确认开台 and 保存人数 — one read/write/assemble path.
 * See docs/buffet-open-table.zh.md.
 */
export async function runBuffetWaiterOpenPipeline(
  admin: SupabaseClient,
  input: BuffetWaiterPipelineInput,
): Promise<BuffetWaiterPipelineResult> {
  const { restaurantId, userId, tableId, buffetId } = input;
  const { adults: adultCount, children: childCount } = normalizeBuffetGuestCounts(
    input.adultCount,
    input.childCount,
  );

  const [
    { table, sessionRow },
    buffets,
    checkout,
    { data: buffet, error: buffetErr },
  ] = await Promise.all([
    loadTableAndSession(admin, restaurantId, tableId),
    loadActiveBuffets(admin, restaurantId),
    fetchCheckoutRequestedForTable(admin, restaurantId, tableId),
    admin
      .from('buffets')
      .select('id, name')
      .eq('id', buffetId)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (!table) {
    return pipelineFailure(400, 'table_not_available');
  }

  if (buffetErr || !buffet) {
    return pipelineFailure(404, 'buffet_not_found');
  }

  const displayName = table.display_name;
  const existingSession = sessionRow ? tableSessionRefFromRow(sessionRow) : null;

  const ensured = await openTableSessionIfAbsent(
    admin,
    {
      restaurant_id: restaurantId,
      table_id: tableId,
      opened_by_user_id: userId,
    },
    existingSession,
  );
  if (!ensured.session) {
    return pipelineFailure(500, 'session_create_failed', { message: ensured.error ?? undefined });
  }

  if (ensured.session.status === 'billing') {
    return pipelineFailure(409, 'session_billing', { code: 'session_billing' });
  }

  const sessionId = ensured.session.id;
  const sessionMeta = sessionMetaFromEnsuredSession(sessionRow, ensured.session);

  let orders: Order[];
  try {
    orders = await loadTableOrdersForSession(admin, restaurantId, sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'orders_lookup_failed';
    return pipelineFailure(500, 'orders_lookup_failed', { message });
  }

  const sessionOrders = mapToBuffetSessionOrders(orders);
  const unchanged = isBuffetGuestCountsUnchanged(sessionOrders, buffetId, adultCount, childCount);
  const resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null> = {};

  if (!unchanged) {
    const resolved = await resolveBuffetPricesServer(admin, restaurantId, buffetId);
    if (!resolved) {
      return pipelineFailure(500, 'price_resolve_failed');
    }
    resolvedByBuffetId[buffetId] = resolved;

    const line = buildBuffetBaseLine({
      buffet,
      adultCount,
      childCount,
      resolved,
    });
    if (!line) {
      return pipelineFailure(400, 'no_price_rule', { code: 'no_price_rule' });
    }

    const applied = await applyBuffetOpenToSession(admin, {
      restaurantId,
      sessionId,
      tableId,
      displayName,
      line,
      sessionOrders,
    });

    if (!applied.ok) {
      if (applied.code === 'conflict') {
        return pipelineFailure(409, 'conflict', { code: 'conflict' });
      }
      return pipelineFailure(500, applied.code, { code: applied.code, message: applied.message });
    }

    orders = applyBuffetOpenWritePlanToOrders(orders, applied.plan, {
      insertedOrderId: applied.insertedOrderId,
    });
  }

  const checkoutPending = isCheckoutPending(sessionMeta, checkout.requested);
  const buffetPricesByBuffetId = await resolveOpenTableBuffetPrices(
    admin,
    restaurantId,
    buffets,
    checkoutPending,
    resolvedByBuffetId,
  );

  const model = buildActiveWaiterTablePageModel({
    table,
    buffets,
    sessionMeta,
    orders,
    checkoutRequested: checkout.requested,
    checkoutRequestedAt: checkout.at,
    buffetPricesByBuffetId,
  });

  return { ok: true, model, ...(unchanged ? { unchanged: true } : {}) };
}
