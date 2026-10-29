import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claimAppendIdempotency,
  completeAppendIdempotency,
  releaseAppendIdempotencyClaim,
} from '@/lib/append-idempotency';
import { writeAppendBatch } from '@/lib/append-write-batch';
import type { AuditActor } from '@/lib/audit/types';
import { coerceCartPrice } from '@/lib/cart-totals';
import {
  buildPackagingChargeItem,
  type PackagingLineInput,
} from '@/lib/checkout-packaging';
import { normalizeOrderingChannel, normalizeTakeawayRole } from '@/lib/instore-takeaway';
import { decrementOrderItemWithAudit } from '@/lib/order-item-void/decrement-order-item.service';
import { isPackagingChargeItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { generateAppendBatchId } from '@/lib/resolve-append-cart-items';
import { findActiveTableSession, type TableSessionRef } from '@/lib/table-session-open';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import type { Order } from '@/types';

export type CheckoutPackagingResult =
  | { ok: true }
  | { ok: false; status: number; error: string; lineKeys?: string[] };

type CheckoutPackagingTarget = {
  tableId: string;
  displayName: string;
  session: TableSessionRef;
};

async function loadCheckoutPackagingTarget(
  admin: SupabaseClient,
  restaurantId: string,
  billSplitId: string,
): Promise<
  | { ok: true; target: CheckoutPackagingTarget }
  | { ok: false; status: number; error: string }
> {
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
  if (normalizeOrderingChannel(session.ordering_channel) !== 'takeaway') {
    return { ok: false, status: 409, error: 'packaging_only_on_takeaway_session' };
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

/** Append packaging supply lines to a takeaway session bill. Idempotent per request id. */
export async function addCheckoutPackagingLines(input: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  lines: PackagingLineInput[];
  clientRequestId: string;
}): Promise<CheckoutPackagingResult> {
  const { admin, restaurantId, clientRequestId } = input;
  const loaded = await loadCheckoutPackagingTarget(admin, restaurantId, input.billSplitId);
  if (!loaded.ok) return loaded;
  const { tableId, displayName, session } = loaded.target;

  const menuIds = Array.from(
    new Set(
      input.lines
        .map((l) => parseTableIdParam(l.menuItemId))
        .filter((id): id is string => !!id),
    ),
  );
  if (menuIds.length !== input.lines.length && menuIds.length === 0) {
    return { ok: false, status: 400, error: 'invalid_packaging_lines' };
  }
  for (const line of input.lines) {
    if (!parseTableIdParam(line.menuItemId)) {
      return { ok: false, status: 400, error: 'invalid_packaging_lines' };
    }
  }

  const { data: menus, error: menuErr } = await admin
    .from('menu_items')
    .select('id, name_pt, name_en, name_zh, price, emoji, available, takeaway_role, item_code')
    .eq('restaurant_id', restaurantId)
    .in('id', menuIds);
  if (menuErr) return { ok: false, status: 500, error: 'menu_items_query_failed' };
  const byId = new Map((menus || []).map((m) => [m.id as string, m]));

  for (const line of input.lines) {
    const menu = byId.get(line.menuItemId);
    if (!menu) return { ok: false, status: 400, error: 'menu_item_not_found' };
    if (menu.available === false) {
      return { ok: false, status: 400, error: 'menu_item_unavailable' };
    }
    if (normalizeTakeawayRole(menu.takeaway_role) !== 'packaging') {
      return { ok: false, status: 400, error: 'menu_item_not_packaging' };
    }
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
  const newItems = input.lines.map((line, index) => {
    const menu = byId.get(line.menuItemId)!;
    return buildPackagingChargeItem({
      lineId: crypto.randomUUID(),
      namePt: String(menu.name_pt || ''),
      nameEn: (menu.name_en as string | null) ?? null,
      nameZh: (menu.name_zh as string | null) ?? null,
      unitPrice: coerceCartPrice(menu.price),
      qty: line.qty,
      batchId,
      addedAt: new Date(startMs + index).toISOString(),
      emoji: (menu.emoji as string | null) ?? null,
      itemCode: (menu.item_code as string | null) ?? null,
    });
  });

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

/** Void one packaging supply line (same decrement-to-void path as take-away charge). */
export async function voidCheckoutPackagingLine(input: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  lineId: string;
  actor: AuditActor;
}): Promise<CheckoutPackagingResult> {
  const { admin, restaurantId } = input;
  const loaded = await loadCheckoutPackagingTarget(admin, restaurantId, input.billSplitId);
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
        isPackagingChargeItem(item) &&
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

  return { ok: false, status: 404, error: 'packaging_line_not_found' };
}
