import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, Order } from '@/types';
import {
  buffetSnapshotFromOrders,
  buildBuffetBaseLine,
  diffBuffetSnapshots,
  isBuffetSnapshotUnchanged,
  normalizeBuffetGuestEntries,
  snapshotFromBuffetEntries,
  type BuffetGuestEntry,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
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
  resolveActiveSessionOpenedByName,
  sessionMetaFromEnsuredSession,
  tableSessionRefFromRow,
} from '@/lib/waiter-table-session-meta';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import {
  BUFFET_OPEN_ALREADY_OPEN,
  type BuffetWaiterOpenIntent,
} from '@/lib/buffet-waiter-open-intent';

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

export type BuffetWaiterPipelineInput = {
  restaurantId: string;
  userId: string;
  tableId: string;
  buffets: BuffetGuestEntry[];
  intent: BuffetWaiterOpenIntent;
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
  const { restaurantId, userId, tableId, buffets, intent } = input;
  const targetSnapshot = snapshotFromBuffetEntries(buffets);

  const [{ table, sessionRow }, activeBuffets] = await Promise.all([
    loadTableAndSession(admin, restaurantId, tableId),
    loadActiveBuffets(admin, restaurantId),
  ]);

  if (!table) {
    return pipelineFailure(400, 'table_not_available');
  }

  const activeBuffetById = new Map(activeBuffets.map((b) => [b.id, b]));
  for (const entry of buffets) {
    if (!activeBuffetById.has(entry.buffetId)) {
      return pipelineFailure(404, 'buffet_not_found', { code: 'buffet_not_found' });
    }
  }

  const displayName = table.display_name;
  const existingSession = sessionRow ? tableSessionRefFromRow(sessionRow) : null;
  const isColdOpen = existingSession == null;

  if (intent === 'open' && existingSession) {
    return pipelineFailure(409, BUFFET_OPEN_ALREADY_OPEN, { code: BUFFET_OPEN_ALREADY_OPEN });
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

  if (ensured.session.status === 'billing') {
    return pipelineFailure(409, 'session_billing', { code: 'session_billing' });
  }

  const sessionId = ensured.session.id;
  const openedByUserId = sessionRow?.opened_by_user_id ?? userId;

  let orders: Order[];
  let openedByName: string | null;
  try {
    const [name, loadedOrders] = await Promise.all([
      resolveActiveSessionOpenedByName(admin, restaurantId, openedByUserId),
      isColdOpen
        ? Promise.resolve([] as Order[])
        : loadTableOrdersForSession(admin, restaurantId, sessionId),
    ]);
    openedByName = name;
    orders = loadedOrders;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'orders_lookup_failed';
    return pipelineFailure(500, 'orders_lookup_failed', { message });
  }

  const sessionMeta = sessionMetaFromEnsuredSession(sessionRow, ensured.session, openedByName);
  const sessionOrders = mapToBuffetSessionOrders(orders);
  const unchanged = isBuffetSnapshotUnchanged(sessionOrders, targetSnapshot);
  const resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null> = {};

  if (!unchanged) {
    if (!isColdOpen) {
      try {
        const { split, collectedPayments } = await loadSessionSplitContinuation(
          admin,
          restaurantId,
          sessionId,
        );

        const floors = lockedBuffetHeadcountByBuffetId(
          split,
          collectedPayments.length > 0,
          collectedPayments,
        );
        const floorViolation = findBuffetHeadcountBelowPaidFloor(targetSnapshot, floors);
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

    const currentSnapshot = buffetSnapshotFromOrders(sessionOrders);
    const { voidBuffetIds, upsertBuffetIds } = diffBuffetSnapshots(currentSnapshot, targetSnapshot);

    const lineResults = await Promise.all(
      upsertBuffetIds.map(async (buffetId) => {
        const counts = targetSnapshot[buffetId];
        if (!counts) return { ok: true as const, line: null, buffetId, resolved: null };

        const buffet = activeBuffetById.get(buffetId);
        if (!buffet) {
          return {
            ok: false as const,
            status: 404,
            error: 'buffet_not_found',
            code: 'buffet_not_found',
          };
        }

        const resolved = await resolveBuffetPricesServer(admin, restaurantId, buffetId);
        if (!resolved) {
          return { ok: false as const, status: 500, error: 'price_resolve_failed' };
        }

        const line = buildBuffetBaseLine({
          buffet,
          adultCount: counts.adults,
          childCount: counts.children,
          resolved,
        });
        if (!line) {
          return {
            ok: false as const,
            status: 400,
            error: 'no_price_rule',
            code: 'no_price_rule',
          };
        }
        return { ok: true as const, line, buffetId, resolved };
      }),
    );

    const lines = [];
    for (const result of lineResults) {
      if (!result.ok) {
        return pipelineFailure(result.status, result.error, {
          code: 'code' in result ? result.code : undefined,
        });
      }
      if (result.line) {
        lines.push(result.line);
        resolvedByBuffetId[result.buffetId] = result.resolved;
      }
    }

    const applied = await applyBuffetOpenToSession(admin, {
      restaurantId,
      sessionId,
      tableId,
      displayName,
      lines,
      voidBuffetIds,
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
    activeBuffets,
    checkoutPending,
    resolvedByBuffetId,
  );

  const model = buildActiveWaiterTablePageModel({
    table,
    buffets: activeBuffets,
    sessionMeta,
    orders,
    checkoutRequested: checkout.requested,
    checkoutRequestedAt: checkout.at,
    buffetPricesByBuffetId,
  });

  return { ok: true, model, ...(unchanged ? { unchanged: true } : {}) };
}

export function parseBuffetWaiterRequestBody(
  buffetsRaw: unknown,
): { ok: true; buffets: BuffetGuestEntry[] } | { ok: false } {
  if (!Array.isArray(buffetsRaw) || buffetsRaw.length === 0) {
    return { ok: false };
  }

  const parsed: BuffetGuestEntry[] = [];
  for (const row of buffetsRaw) {
    if (!row || typeof row !== 'object') return { ok: false };
    const buffetId = (row as { buffet_id?: unknown }).buffet_id;
    if (typeof buffetId !== 'string' || !buffetId) return { ok: false };
    parsed.push(
      normalizeBuffetGuestEntries([
        {
          buffet_id: buffetId,
          adult_count: Number((row as { adult_count?: unknown }).adult_count) || 0,
          child_count: Number((row as { child_count?: unknown }).child_count) || 0,
        },
      ])[0],
    );
  }

  return { ok: true, buffets: parsed };
}
