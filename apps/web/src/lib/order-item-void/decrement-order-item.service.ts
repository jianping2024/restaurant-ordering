import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIT_EVENT, recordAudit } from '@/lib/audit';
import type { ItemDeletedAuditContext } from '@/lib/audit/builders/item-deleted';
import { itemLineAmount } from '@/lib/audit/builders/item-deleted';
import type { ItemQtyDecrementedAuditContext } from '@/lib/audit/builders/item-qty-decremented';
import { auditMoney } from '@/lib/audit/money';
import { VOID_ITEM_QTY_ADJUSTMENT_REASON } from '@/lib/audit/reasons';
import type { AuditActor } from '@/lib/audit/types';
import {
  applyOrderItemDecrement,
  type DecrementOrderItemCode,
} from '@/lib/order-item-void/decrement-order-item';
import { persistOrderItemsUpdate } from '@/lib/order-item-void/persist-order-items-update';
import type { Order } from '@/types';

export type DecrementOrderItemInput = {
  admin: SupabaseClient;
  restaurantId: string;
  actor: AuditActor;
  orderId: string;
  existing: {
    items: Order['items'];
    updated_at: string;
    session_id?: string | null;
    table_id?: string | null;
    display_name?: string | null;
    status?: Order['status'];
  };
  itemIndex: number;
};

export type DecrementOrderItemServiceResult =
  | { ok: true; order: Order; outcome: 'decremented' | 'voided' }
  | { ok: false; code: DecrementOrderItemCode | 'conflict' };

function toQtyDecrementedContext(
  order: Pick<Order, 'id' | 'session_id' | 'table_id' | 'display_name'>,
  applied: Extract<ReturnType<typeof applyOrderItemDecrement>, { ok: true }>,
): ItemQtyDecrementedAuditContext {
  return {
    orderId: order.id,
    sessionId: order.session_id ?? null,
    tableId: order.table_id ?? null,
    tableName: order.display_name ?? null,
    itemIndex: applied.itemIndex,
    itemId: applied.before.id,
    itemName: applied.before.name,
    itemStatusBefore: applied.statusBefore,
    qtyBefore: applied.before.qty,
    qtyAfter: applied.after.qty,
    unitAmount: auditMoney(applied.before.price),
  };
}

function toItemDeletedContext(
  order: Pick<Order, 'id' | 'session_id' | 'table_id' | 'display_name'>,
  applied: Extract<ReturnType<typeof applyOrderItemDecrement>, { ok: true }>,
): ItemDeletedAuditContext {
  return {
    orderId: order.id,
    sessionId: order.session_id ?? null,
    tableId: order.table_id ?? null,
    tableName: order.display_name ?? null,
    itemIndex: applied.itemIndex,
    itemId: applied.before.id,
    itemName: applied.before.name,
    itemStatusBefore: applied.statusBefore,
    qty: applied.before.qty,
    lineAmount: itemLineAmount(applied.before),
  };
}

export async function decrementOrderItemWithAudit(
  input: DecrementOrderItemInput,
): Promise<DecrementOrderItemServiceResult> {
  const orderStatus = input.existing.status ?? 'pending';
  const applied = applyOrderItemDecrement(
    input.existing.items,
    input.itemIndex,
    orderStatus,
  );
  if (!applied.ok) {
    return { ok: false, code: applied.code };
  }

  const persist = await persistOrderItemsUpdate(input.admin, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    updatedAt: input.existing.updated_at,
    items: applied.nextItems,
    orderStatusFallback: orderStatus,
  });
  if (!persist.ok) {
    return { ok: false, code: 'conflict' };
  }

  const orderRow = persist.order;
  const auditBase = {
    restaurantId: input.restaurantId,
    actor: input.actor,
    reason: VOID_ITEM_QTY_ADJUSTMENT_REASON,
    reasonDetail: null,
  };

  if (applied.outcome === 'decremented') {
    await recordAudit(input.admin, AUDIT_EVENT.ITEM_QTY_DECREMENTED, {
      ...auditBase,
      context: toQtyDecrementedContext(orderRow, applied),
    });
  } else {
    await recordAudit(input.admin, AUDIT_EVENT.ITEM_DELETED, {
      ...auditBase,
      context: toItemDeletedContext(orderRow, applied),
    });
  }

  return { ok: true, order: orderRow, outcome: applied.outcome };
}
