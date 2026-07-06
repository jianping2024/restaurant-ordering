import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
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
  buffets: BuffetGuestEntry[];
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
  const { restaurantId, userId, tableId, buffets } = input;
  const targetSnapshot = snapshotFromBuffetEntries(buffets);

  const [{ table, sessionRow }, activeBuffets, checkout] = await Promise.all([
    loadTableAndSession(admin, restaurantId, tableId),
    loadActiveBuffets(admin, restaurantId),
    fetchCheckoutRequestedForTable(admin, restaurantId, tableId),
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
  const unchanged = isBuffetSnapshotUnchanged(sessionOrders, targetSnapshot);
  const resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null> = {};

  if (!unchanged) {
    const currentSnapshot = buffetSnapshotFromOrders(sessionOrders);
    const { voidBuffetIds, upsertBuffetIds } = diffBuffetSnapshots(currentSnapshot, targetSnapshot);

    const lines = [];
    for (const buffetId of upsertBuffetIds) {
      const counts = targetSnapshot[buffetId];
      if (!counts) continue;

      const buffet = activeBuffetById.get(buffetId);
      if (!buffet) {
        return pipelineFailure(404, 'buffet_not_found', { code: 'buffet_not_found' });
      }

      const resolved = await resolveBuffetPricesServer(admin, restaurantId, buffetId);
      if (!resolved) {
        return pipelineFailure(500, 'price_resolve_failed');
      }
      resolvedByBuffetId[buffetId] = resolved;

      const line = buildBuffetBaseLine({
        buffet,
        adultCount: counts.adults,
        childCount: counts.children,
        resolved,
      });
      if (!line) {
        return pipelineFailure(400, 'no_price_rule', { code: 'no_price_rule' });
      }
      lines.push(line);
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
