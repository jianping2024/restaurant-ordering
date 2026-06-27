import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIT_EVENT, recordAudit } from '@/lib/audit';
import type { ItemDeletedAuditContext } from '@/lib/audit/builders/item-deleted';
import { itemLineAmount } from '@/lib/audit/builders/item-deleted';
import type { ItemQtyDecrementedAuditContext } from '@/lib/audit/builders/item-qty-decremented';
import { auditMoney } from '@/lib/audit/money';
import { VOID_ITEM_QTY_ADJUSTMENT_REASON } from '@/lib/audit/reasons';
import type { AuditActor } from '@/lib/audit/types';
import { applyVoidReasonToItems } from '@/lib/order-item-void/apply-void-reason-to-items';
import {
  applyOrderItemDecrement,
  type DecrementOrderItemCode,
} from '@/lib/order-item-void/decrement-order-item';
import { persistOrderItemsUpdate } from '@/lib/order-item-void/persist-order-items-update';
import { validateVoidItemReason } from '@/lib/order-item-void/validate-void-reason';
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
  /** Required when decrement removes the last unit (void). */
  voidReason?: string | null;
  voidReasonDetail?: string | null;
};

export type DecrementOrderItemServiceResult =
  | { ok: true; order: Order; outcome: 'decremented' | 'voided' }
  | {
      ok: false;
      code:
        | DecrementOrderItemCode
        | 'conflict'
        | 'reason_required'
        | 'invalid_reason'
        | 'reason_detail_required';
    };

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

  let itemsToSave = applied.nextItems;
  let voidAuditReason: string | null = null;
  let voidAuditDetail: string | null = null;

  if (applied.outcome === 'voided') {
    const newlyVoided = [
      {
        itemIndex: applied.itemIndex,
        before: applied.before,
        after: applied.after,
        statusBefore: applied.statusBefore,
      },
    ];
    const reasonValidation = validateVoidItemReason(
      newlyVoided,
      input.voidReason,
      input.voidReasonDetail,
    );
    if (!reasonValidation.ok) {
      return { ok: false, code: reasonValidation.code };
    }
    voidAuditReason = input.voidReason?.trim() ?? '';
    voidAuditDetail = input.voidReasonDetail?.trim() || null;
    itemsToSave = applyVoidReasonToItems(
      applied.nextItems,
      [applied.itemIndex],
      voidAuditReason,
    );
  }

  const persist = await persistOrderItemsUpdate(input.admin, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    updatedAt: input.existing.updated_at,
    items: itemsToSave,
    orderStatusFallback: orderStatus,
  });
  if (!persist.ok) {
    return { ok: false, code: 'conflict' };
  }

  const orderRow = persist.order;

  if (applied.outcome === 'decremented') {
    await recordAudit(input.admin, AUDIT_EVENT.ITEM_QTY_DECREMENTED, {
      restaurantId: input.restaurantId,
      actor: input.actor,
      reason: VOID_ITEM_QTY_ADJUSTMENT_REASON,
      reasonDetail: null,
      context: toQtyDecrementedContext(orderRow, applied),
    });
  } else {
    await recordAudit(input.admin, AUDIT_EVENT.ITEM_DELETED, {
      restaurantId: input.restaurantId,
      actor: input.actor,
      reason: voidAuditReason!,
      reasonDetail: voidAuditDetail,
      context: toItemDeletedContext(orderRow, applied),
    });
  }

  return { ok: true, order: orderRow, outcome: applied.outcome };
}
