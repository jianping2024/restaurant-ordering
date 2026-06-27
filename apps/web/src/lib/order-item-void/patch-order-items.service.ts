import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIT_EVENT, recordAudit } from '@/lib/audit';
import type { ItemDeletedAuditContext } from '@/lib/audit/builders/item-deleted';
import { itemLineAmount } from '@/lib/audit/builders/item-deleted';
import type { AuditActor } from '@/lib/audit/types';
import { detectNewlyVoidedItems } from '@/lib/order-item-void/detect-newly-voided';
import { applyVoidReasonToItems } from '@/lib/order-item-void/apply-void-reason-to-items';
import { persistOrderItemsUpdate } from '@/lib/order-item-void/persist-order-items-update';
import { validateVoidItemReason } from '@/lib/order-item-void/validate-void-reason';
import type { Order, OrderItem } from '@/types';

export type PatchOrderItemsInput = {
  admin: SupabaseClient;
  restaurantId: string;
  actor: AuditActor;
  orderId: string;
  existing: {
    items: OrderItem[];
    updated_at: string;
    session_id?: string | null;
    table_id?: string | null;
    display_name?: string | null;
    status?: Order['status'];
  };
  nextItems: OrderItem[];
  voidReason?: string | null;
  voidReasonDetail?: string | null;
};

export type PatchOrderItemsResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      code:
        | 'conflict'
        | 'reason_required'
        | 'invalid_reason'
        | 'reason_detail_required'
        | 'update_failed';
    };

function toAuditContext(
  order: Pick<Order, 'id' | 'session_id' | 'table_id' | 'display_name'>,
  row: ReturnType<typeof detectNewlyVoidedItems>[number],
): ItemDeletedAuditContext {
  return {
    orderId: order.id,
    sessionId: order.session_id ?? null,
    tableId: order.table_id ?? null,
    tableName: order.display_name ?? null,
    itemIndex: row.itemIndex,
    itemId: row.before.id,
    itemName: row.before.name,
    itemStatusBefore: row.statusBefore,
    qty: row.before.qty,
    lineAmount: itemLineAmount(row.before),
  };
}

export async function patchOrderItemsWithVoidAudit(
  input: PatchOrderItemsInput,
): Promise<PatchOrderItemsResult> {
  const newlyVoided = detectNewlyVoidedItems(
    input.existing.items,
    input.nextItems,
    input.existing.status ?? 'pending',
  );

  const reasonValidation = validateVoidItemReason(
    newlyVoided,
    input.voidReason,
    input.voidReasonDetail,
  );
  if (!reasonValidation.ok) {
    return { ok: false, code: reasonValidation.code };
  }

  const trimmedReason = input.voidReason?.trim() ?? '';
  const trimmedDetail = input.voidReasonDetail?.trim() || null;
  const itemsToSave = applyVoidReasonToItems(
    input.nextItems,
    newlyVoided.map((row) => row.itemIndex),
    trimmedReason,
  );

  const persist = await persistOrderItemsUpdate(input.admin, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    updatedAt: input.existing.updated_at,
    items: itemsToSave,
    orderStatusFallback: input.existing.status ?? 'pending',
  });

  if (!persist.ok) {
    return { ok: false, code: 'conflict' };
  }

  const updated = persist.order;

  if (newlyVoided.length > 0 && trimmedReason) {
    const orderRow = updated;
    for (const row of newlyVoided) {
      await recordAudit(input.admin, AUDIT_EVENT.ITEM_DELETED, {
        restaurantId: input.restaurantId,
        actor: input.actor,
        context: toAuditContext(orderRow, row),
        reason: trimmedReason,
        reasonDetail: trimmedDetail,
      });
    }
  }

  return { ok: true, order: updated };
}
