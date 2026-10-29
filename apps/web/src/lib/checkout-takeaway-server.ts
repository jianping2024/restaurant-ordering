import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claimAppendIdempotency,
  completeAppendIdempotency,
  releaseAppendIdempotencyClaim,
} from '@/lib/append-idempotency';
import { writeAppendBatch } from '@/lib/append-write-batch';
import type { AuditActor } from '@/lib/audit/types';
import { buildTakeawayChargeItem, type TakeawayLineInput } from '@/lib/checkout-takeaway';
import { normalizeOrderingChannel } from '@/lib/instore-takeaway';
import { decrementOrderItemWithAudit } from '@/lib/order-item-void/decrement-order-item.service';
import { isTakeawayChargeItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { generateAppendBatchId } from '@/lib/resolve-append-cart-items';
import { findActiveTableSession, type TableSessionRef } from '@/lib/table-session-open';
import type { Order } from '@/types';

export type CheckoutTakeawayResult =
  | { ok: true }
  | { ok: false; status: number; error: string; lineKeys?: string[] };

type CheckoutTakeawayTarget = {
  tableId: string;
  displayName: string;
  session: TableSessionRef;
};

/**
 * Checkout bill → its table's live session (open|billing). Take-away lines only go onto
 * the session the bill belongs to; a closed/other session is rejected.
 */
async function loadCheckoutTakeawayTarget(
  admin: SupabaseClient,
  restaurantId: string,
  billSplitId: string,
): Promise<{ ok: true; target: CheckoutTakeawayTarget } | { ok: false; status: number; error: string }> {
  const { data: split, error: splitErr } = await admin
    .from('bill_splits')
    .select('id, table_id, session_id, display_name')
    .eq('id', billSplitId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (splitErr) return { ok: false, status: 500, error: 'bill_split_lookup_failed' };
  if (!split?.table_id || !split.session_id) {
    return { ok: false, status: 404, error: 'bill_split_not_found' };
  }

  let session: TableSessionRef | null;
  try {
    session = await findActiveTableSession(admin, restaurantId, split.table_id as string);
  } catch {
    return { ok: false, status: 500, error: 'session_lookup_failed' };
  }
  if (!session || session.id !== split.session_id) {
    return { ok: false, status: 409, error: 'no_active_session' };
  }

  return {
    ok: true,
    target: {
      tableId: split.table_id as string,
      displayName: (split.display_name as string | null) || (split.table_id as string),
      session,
    },
  };
}

/** Append take-away charge lines (one per `{ amount, qty }`) to the bill's session. Idempotent per request id. */
export async function addCheckoutTakeawayLines(input: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  lines: TakeawayLineInput[];
  clientRequestId: string;
}): Promise<CheckoutTakeawayResult> {
  const { admin, restaurantId, clientRequestId } = input;
  const loaded = await loadCheckoutTakeawayTarget(admin, restaurantId, input.billSplitId);
  if (!loaded.ok) return loaded;
  const { tableId, displayName, session } = loaded.target;
  if (normalizeOrderingChannel(session.ordering_channel) === 'takeaway') {
    return { ok: false, status: 409, error: 'takeaway_charge_not_allowed_on_takeaway_session' };
  }

  const claim = await claimAppendIdempotency({
    admin,
    restaurantId,
    sessionId: session.id,
    clientRequestId,
  });
  if (claim.kind === 'error') return { ok: false, status: claim.status, error: claim.error };
  if (claim.kind === 'in_progress') return { ok: false, status: 409, error: 'append_in_progress' };
  if (claim.kind === 'replay') return { ok: true };

  const batchId = generateAppendBatchId();
  const startMs = Date.now();
  // Bill / receipt / invoice rows sort by added_at — 1 ms apart keeps the cashier's entry order.
  const newItems = input.lines.map((line, index) =>
    buildTakeawayChargeItem({
      lineId: crypto.randomUUID(),
      amount: line.amount,
      qty: line.qty,
      batchId,
      addedAt: new Date(startMs + index).toISOString(),
    }),
  );

  const write = await writeAppendBatch({
    admin,
    restaurantId,
    tableId,
    displayName,
    sessionId: session.id,
    context: { session, sessionOrders: [], openOrder: null },
    newItems,
  });
  if (!write.ok) {
    await releaseAppendIdempotencyClaim({ admin, sessionId: session.id, clientRequestId });
    return { ok: false, status: write.status, error: write.error };
  }

  await completeAppendIdempotency({
    admin,
    sessionId: session.id,
    clientRequestId,
    orderId: write.orderId,
    batchId,
    hadDoneBefore: write.hadDoneBefore,
    isFirstOrder: write.isFirstOrder,
    lineCount: newItems.length,
  });
  return { ok: true };
}

/** Void one take-away line (existing decrement-to-void path: audit + called-ticket guard). */
export async function voidCheckoutTakeawayLine(input: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  lineId: string;
  actor: AuditActor;
}): Promise<CheckoutTakeawayResult> {
  const { admin, restaurantId } = input;
  const loaded = await loadCheckoutTakeawayTarget(admin, restaurantId, input.billSplitId);
  if (!loaded.ok) return loaded;

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, updated_at, session_id, table_id, display_name, items, status')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', loaded.target.session.id);
  if (error) return { ok: false, status: 500, error: 'orders_lookup_failed' };

  for (const order of (orders ?? []) as Order[]) {
    const items = order.items ?? [];
    const itemIndex = items.findIndex(
      (item) =>
        item.id === input.lineId &&
        isTakeawayChargeItem(item) &&
        normalizeOrderItemStatus(item, order.status) !== 'voided',
    );
    if (itemIndex < 0) continue;

    const result = await decrementOrderItemWithAudit({
      admin,
      restaurantId,
      actor: input.actor,
      orderId: order.id,
      existing: {
        items,
        updated_at: order.updated_at as string,
        session_id: order.session_id,
        table_id: order.table_id,
        display_name: order.display_name,
        status: order.status,
      },
      itemIndex,
      menuDecrementAllowed: true,
    });
    if (result.ok) return { ok: true };
    if (result.code === 'claimed_by_ticket') {
      return { ok: false, status: 409, error: 'claimed_by_ticket', lineKeys: result.lineKeys };
    }
    if (result.code === 'conflict') return { ok: false, status: 409, error: 'conflict' };
    return { ok: false, status: 400, error: result.code };
  }

  return { ok: false, status: 404, error: 'takeaway_line_not_found' };
}
