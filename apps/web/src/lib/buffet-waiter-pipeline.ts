import { loadCalledTicketKeys } from '@/lib/individual-checkout-reads';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBuffetServiceMode, type BuffetServiceMode } from '@mesa/shared';
import type { BillSplit, Order, OrderItem } from '@/types';
import {
  aggregateBuffetHeadcountForOrders,
  buildBuffetBaseLine,
  currentTableBuffetLine,
  effectiveTableBuffet,
  isTableBuffetUnchanged,
  normalizeBuffetGuestCounts,
  type ResolvedBuffetPriceRow,
  type TableBuffetSelection,
} from '@/lib/buffet-order';
import {
  mergeBuffetPricesPreferLocked,
  resolvedBuffetPriceFromLockedLine,
} from '@/lib/buffet-locked-prices';
import {
  applyBuffetOpenToSession,
  applyBuffetOpenWritePlanToOrders,
  mapToBuffetSessionOrders,
} from '@/lib/buffet-open-table';
import {
  BUFFET_HEADCOUNT_BELOW_PAID_FLOOR,
  findBuffetHeadcountBelowPaidFloor,
  lockedBuffetHeadcountByBuffetId,
} from '@/lib/buffet-paid-headcount-floor';
import {
  parseSessionCollectedPayments,
  SESSION_COLLECTED_PAYMENT_SELECT,
} from '@/lib/checkout-session-payments';
import { resolveBuffetPricesServer } from '@/lib/resolve-buffet-prices-server';
import { loadOpenableBuffetIds } from '@/lib/buffet-openable-server';
import { BUFFET_SWITCH_LOCKED, hasEnteredCheckout } from '@/lib/buffet-checkout-entry';
import { loadCheckoutEntrySignals } from '@/lib/buffet-checkout-entry-server';
import { switchTableBuffet } from '@/lib/buffet-switch-reprice';
import { openTableSessionIfAbsent } from '@/lib/table-session-open';
import {
  buildActiveWaiterTablePageModel,
  fetchCheckoutRequestedForTable,
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
import {
  BUFFET_NOT_ALLOWED_ON_TAKEAWAY_SESSION,
  BUFFET_NOT_AVAILABLE_NOW,
  BUFFET_OPEN_ALREADY_OPEN,
  type BuffetWaiterOpenIntent,
} from '@/lib/buffet-waiter-open-intent';
import { normalizeOrderingChannel } from '@/lib/instore-takeaway';
import { resolveOrderingChannelForTable } from '@/lib/instore-takeaway-server';

async function loadSessionSplitContinuation(
  admin: SupabaseClient,
  restaurantId: string,
  sessionId: string,
): Promise<{
  split: BillSplit | null;
  collectedPayments: ReturnType<typeof parseSessionCollectedPayments>;
}> {
  const [{ data: splitRow }, { count: collectedCount }] = await Promise.all([
    admin
      .from('bill_splits')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId)
      .in('status', ['pending', 'confirmed', 'requested'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('session_collected_payments')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId),
  ]);

  let collectedPayments = parseSessionCollectedPayments(null);
  if ((collectedCount ?? 0) > 0) {
    const { data: collectedRows } = await admin
      .from('session_collected_payments')
      .select(SESSION_COLLECTED_PAYMENT_SELECT)
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId);
    collectedPayments = parseSessionCollectedPayments(collectedRows);
  }

  return {
    split: (splitRow as BillSplit | null) ?? null,
    collectedPayments,
  };
}

async function loadRestaurantBuffetServiceMode(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<BuffetServiceMode> {
  const { data } = await admin
    .from('restaurants')
    .select('buffet_service_mode')
    .eq('id', restaurantId)
    .maybeSingle();
  return normalizeBuffetServiceMode(data?.buffet_service_mode);
}

export type BuffetWaiterPipelineInput = {
  restaurantId: string;
  userId: string;
  tableId: string;
  /** The table's one buffet; 0 + 0 guests clears the buffet line. */
  buffet: TableBuffetSelection;
  intent: BuffetWaiterOpenIntent;
};

export type BuffetWaiterPipelineSuccess = {
  ok: true;
  model: WaiterTablePageModel;
  unchanged?: true;
  /** Present when this call cold-opened a session (audit / open-table side effects). */
  sessionOpened?: true;
  /** Present when an existing session's buffet headcount changed (not cold open). */
  guestCountChanged?: true;
  sessionId?: string;
  tableName?: string;
  adultCount?: number;
  childCount?: number;
  previousAdultCount?: number;
  previousChildCount?: number;
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
 * Single server pipeline for 确认开台 and occupied guest-count autosave — one read/write/assemble path.
 * See docs/buffet-open-table.zh.md.
 */
export async function runBuffetWaiterOpenPipeline(
  admin: SupabaseClient,
  input: BuffetWaiterPipelineInput,
): Promise<BuffetWaiterPipelineResult> {
  const { restaurantId, userId, tableId, buffet: requested, intent } = input;
  const target = effectiveTableBuffet(requested);

  const [{ table, sessionRow }, activeBuffets] = await Promise.all([
    loadTableAndSession(admin, restaurantId, tableId),
    loadActiveBuffets(admin, restaurantId),
  ]);

  if (!table) {
    return pipelineFailure(400, 'table_not_available');
  }

  const activeBuffetById = new Map(activeBuffets.map((b) => [b.id, b]));
  if (!activeBuffetById.has(requested.buffetId)) {
    return pipelineFailure(404, 'buffet_not_found', { code: 'buffet_not_found' });
  }

  const displayName = table.display_name;
  const existingSession = sessionRow ? tableSessionRefFromRow(sessionRow) : null;
  const isColdOpen = existingSession == null;

  if (intent === 'open' && existingSession) {
    return pipelineFailure(409, BUFFET_OPEN_ALREADY_OPEN, { code: BUFFET_OPEN_ALREADY_OPEN });
  }

  const orderingChannel = await resolveOrderingChannelForTable(admin, {
    restaurantId,
    tableId,
    sessionChannel: existingSession?.ordering_channel ?? sessionRow?.ordering_channel ?? null,
  });
  if (normalizeOrderingChannel(orderingChannel) === 'takeaway') {
    return pipelineFailure(409, BUFFET_NOT_ALLOWED_ON_TAKEAWAY_SESSION, {
      code: BUFFET_NOT_ALLOWED_ON_TAKEAWAY_SESSION,
    });
  }

  // Choosing a package (cold open / switch) only when it is openable in the current slot.
  const assertOpenable = async (): Promise<BuffetWaiterPipelineFailure | null> => {
    if (!target) return null;
    const openable = await loadOpenableBuffetIds(admin, restaurantId);
    return openable.includes(target.buffetId)
      ? null
      : pipelineFailure(409, BUFFET_NOT_AVAILABLE_NOW, { code: BUFFET_NOT_AVAILABLE_NOW });
  };
  if (isColdOpen) {
    const blocked = await assertOpenable();
    if (blocked) return blocked;
  }

  const checkout = isColdOpen
    ? { requested: false, at: null as string | null }
    : await fetchCheckoutRequestedForTable(admin, restaurantId, tableId);

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

  // Billing locks add-dish / cold open; intent=save may adjust headcount from checkout soft-confirm.
  if (ensured.session.status === 'billing' && intent !== 'save') {
    return pipelineFailure(409, 'session_billing', { code: 'session_billing' });
  }

  const sessionId = ensured.session.id;

  let orders: Order[];
  try {
    orders = isColdOpen
      ? ([] as Order[])
      : await loadTableOrdersForSession(admin, restaurantId, sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'orders_lookup_failed';
    return pipelineFailure(500, 'orders_lookup_failed', { message });
  }

  const sessionMeta = sessionMetaFromEnsuredSession(sessionRow, ensured.session);
  const sessionOrders = mapToBuffetSessionOrders(orders);
  const previousHeadcount = aggregateBuffetHeadcountForOrders(orders) ?? {
    adults: 0,
    children: 0,
  };
  const nextAdultCount = target?.adults ?? 0;
  const nextChildCount = target?.children ?? 0;
  const unchanged = isTableBuffetUnchanged(sessionOrders, target);
  const resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null> = {};

  if (!unchanged) {
    if (!isColdOpen) {
      try {
        const { split, collectedPayments } = await loadSessionSplitContinuation(
          admin,
          restaurantId,
          sessionId,
        );

        const calledKeys = await loadCalledTicketKeys(admin, split?.id);
        const floors = lockedBuffetHeadcountByBuffetId(
          split,
          collectedPayments.length > 0,
          collectedPayments,
          calledKeys,
        );
        const floorViolation = findBuffetHeadcountBelowPaidFloor(target, floors);
        if (floorViolation) {
          return pipelineFailure(409, BUFFET_HEADCOUNT_BELOW_PAID_FLOOR, {
            code: BUFFET_HEADCOUNT_BELOW_PAID_FLOOR,
            message:
              `min adults ${floorViolation.minAdults}, children ${floorViolation.minChildren}`
              + `; proposed adults ${floorViolation.proposedAdults},`
              + ` children ${floorViolation.proposedChildren}`,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'headcount_floor_lookup_failed';
        return pipelineFailure(500, 'headcount_floor_lookup_failed', { message });
      }
    }

    const currentLine = currentTableBuffetLine(sessionOrders);
    const currentBuffetId = currentLine?.buffet_id ?? null;
    // 套餐变了（X→Y、X→无、无→X）: locked after checkout entry; a new package must be openable.
    const buffetChanges = !isColdOpen && currentBuffetId !== (target?.buffetId ?? null);
    if (buffetChanges) {
      try {
        const signals = await loadCheckoutEntrySignals(admin, restaurantId, sessionId);
        if (hasEnteredCheckout(signals)) {
          return pipelineFailure(409, BUFFET_SWITCH_LOCKED, { code: BUFFET_SWITCH_LOCKED });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'checkout_entry_lookup_failed';
        return pipelineFailure(500, 'checkout_entry_lookup_failed', { message });
      }
      const blocked = await assertOpenable();
      if (blocked) return blocked;
    }

    let line: OrderItem | null = null;
    if (target) {
      const buffet = activeBuffetById.get(target.buffetId)!;
      // Open-time unit prices on the same package's active line win; only resolve when no lock yet.
      const locked =
        currentLine?.buffet_id === target.buffetId
          ? resolvedBuffetPriceFromLockedLine(currentLine)
          : null;
      const resolved =
        locked ?? (await resolveBuffetPricesServer(admin, restaurantId, target.buffetId));
      if (!resolved) {
        return pipelineFailure(500, 'price_resolve_failed');
      }
      line = buildBuffetBaseLine({
        buffet,
        adultCount: target.adults,
        childCount: target.children,
        resolved,
      });
      if (!line) {
        return pipelineFailure(400, 'no_price_rule', { code: 'no_price_rule' });
      }
      resolvedByBuffetId[target.buffetId] = resolved;
    }

    if (buffetChanges) {
      // Dish lines follow the new package: re-price + swap headcount line in one locked RPC.
      const serviceMode = await loadRestaurantBuffetServiceMode(admin, restaurantId);
      const switched = await switchTableBuffet(admin, {
        restaurantId,
        sessionId,
        tableId,
        displayName,
        fromBuffetId: currentBuffetId,
        toBuffetId: target?.buffetId ?? null,
        buffetLine: line,
        serviceMode,
        channel: 'dine_in',
        loadOrders: () => loadTableOrdersForSession(admin, restaurantId, sessionId),
      });
      if (!switched.ok) {
        return pipelineFailure(switched.status, switched.code, {
          code: switched.code,
          message: switched.message,
        });
      }
      orders = await loadTableOrdersForSession(admin, restaurantId, sessionId);
    } else {
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
  }

  // Live fill gaps; locked open-time unit prices win (incl. checkout-pending adjust).
  const livePrices = await resolveOpenTableBuffetPrices(
    admin,
    restaurantId,
    activeBuffets,
    false,
    resolvedByBuffetId,
  );
  const buffetPricesByBuffetId = mergeBuffetPricesPreferLocked(livePrices, orders);

  const model = buildActiveWaiterTablePageModel({
    table,
    buffets: activeBuffets,
    sessionMeta,
    orders,
    checkoutRequested: checkout.requested,
    checkoutRequestedAt: checkout.at,
    buffetPricesByBuffetId,
  });

  return {
    ok: true,
    model,
    sessionId,
    tableName: displayName,
    ...(unchanged ? { unchanged: true } : {}),
    ...(isColdOpen
      ? {
          sessionOpened: true as const,
          adultCount: nextAdultCount,
          childCount: nextChildCount,
        }
      : !unchanged
        ? {
            guestCountChanged: true as const,
            adultCount: nextAdultCount,
            childCount: nextChildCount,
            previousAdultCount: previousHeadcount.adults,
            previousChildCount: previousHeadcount.children,
          }
        : {}),
  };
}

/** Body `buffet: { buffet_id, adult_count, child_count }` — one buffet per table. */
export function parseBuffetWaiterRequestBody(
  buffetRaw: unknown,
): { ok: true; buffet: TableBuffetSelection } | { ok: false } {
  if (!buffetRaw || typeof buffetRaw !== 'object' || Array.isArray(buffetRaw)) {
    return { ok: false };
  }
  const row = buffetRaw as { buffet_id?: unknown; adult_count?: unknown; child_count?: unknown };
  if (typeof row.buffet_id !== 'string' || !row.buffet_id) return { ok: false };
  const { adults, children } = normalizeBuffetGuestCounts(
    Number(row.adult_count) || 0,
    Number(row.child_count) || 0,
  );
  return { ok: true, buffet: { buffetId: row.buffet_id, adults, children } };
}
