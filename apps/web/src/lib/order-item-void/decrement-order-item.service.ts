import type { SupabaseClient } from '@supabase/supabase-js';
import { applyVoidReasonToItems } from '@/lib/order-item-void/apply-void-reason-to-items';
import {
  applyOrderItemDecrement,
  type DecrementOrderItemCode,
} from '@/lib/order-item-void/decrement-order-item';
import {
  menuDecrementAllowedFor,
  type MenuDecrementOperator,
} from '@/lib/order-item-decrement/decrement-policy';
import { persistOrderItemsUpdate } from '@/lib/order-item-void/persist-order-items-update';
import { validateVoidItemReason } from '@/lib/order-item-void/validate-void-reason';
import { VOID_ITEM_QTY_ADJUSTMENT_REASON } from '@/lib/audit/reasons';
import type { AuditActor } from '@/lib/audit/types';
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
  menuDecrementOperator: MenuDecrementOperator;
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
  if (!menuDecrementAllowedFor(input.menuDecrementOperator)) {
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

  const orderRow = persist.order;

  return { ok: true, order: orderRow, outcome: applied.outcome };
}
