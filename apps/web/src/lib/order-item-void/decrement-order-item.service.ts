import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIT_EVENT, scheduleRecordAudit } from '@/lib/audit';
import { itemLineAmount } from '@/lib/audit/builders/item-void-audit-payload';
import type { AuditActor } from '@/lib/audit/types';
import { coerceCartQty } from '@/lib/cart-totals';
import { applyVoidReasonToItems } from '@/lib/order-item-void/apply-void-reason-to-items';
import {
  applyOrderItemDecrement,
  type DecrementOrderItemCode,
} from '@/lib/order-item-void/decrement-order-item';
import { persistOrderItemsUpdate } from '@/lib/order-item-void/persist-order-items-update';
import { validateVoidItemReason } from '@/lib/order-item-void/validate-void-reason';
import { VOID_ITEM_QTY_ADJUSTMENT_REASON } from '@/lib/audit/reasons';
import { orderItemAuditLabel } from '@/lib/audit/order-item-audit-label';
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
  menuDecrementAllowed: boolean;
  /** Optional override when decrement removes the last unit; defaults to qty_adjustment. */
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
        | 'reason_detail_required'
        | 'menu_decrement_not_allowed';
    };

export async function decrementOrderItemWithAudit(
  input: DecrementOrderItemInput,
): Promise<DecrementOrderItemServiceResult> {
  if (!input.menuDecrementAllowed) {
    return { ok: false, code: 'menu_decrement_not_allowed' };
  }

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
  if (applied.outcome === 'voided') {
    const newlyVoided = [
      {
        itemIndex: applied.itemIndex,
        before: applied.before,
        after: applied.after,
        statusBefore: applied.statusBefore,
      },
    ];
    const resolvedVoidReason = input.voidReason?.trim() || VOID_ITEM_QTY_ADJUSTMENT_REASON;
    const resolvedVoidDetail = input.voidReasonDetail?.trim() || null;
    const reasonValidation = validateVoidItemReason(
      newlyVoided,
      resolvedVoidReason,
      resolvedVoidDetail,
    );
    if (!reasonValidation.ok) {
      return { ok: false, code: reasonValidation.code };
    }
    itemsToSave = applyVoidReasonToItems(
      applied.nextItems,
      [applied.itemIndex],
      resolvedVoidReason,
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

  const qtyBefore = coerceCartQty(applied.before.qty);
  const qtyAfter = applied.outcome === 'voided' ? 0 : coerceCartQty(applied.after.qty);
  scheduleRecordAudit(input.admin, AUDIT_EVENT.ITEM_QTY_DECREMENTED, {
    restaurantId: input.restaurantId,
    actor: input.actor,
    context: {
      orderId: input.orderId,
      sessionId: input.existing.session_id ?? null,
      tableId: input.existing.table_id ?? null,
      tableName: input.existing.display_name ?? null,
      itemIndex: applied.itemIndex,
      itemId: applied.before.id,
      itemName: orderItemAuditLabel(applied.before),
      itemStatusBefore: applied.statusBefore,
      qtyBefore,
      qtyAfter,
      unitAmount: itemLineAmount({ ...applied.before, qty: 1 }),
    },
  });

  return { ok: true, order: persist.order, outcome: applied.outcome };
}
