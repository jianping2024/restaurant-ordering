import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIT_EVENT, recordAudit } from '@/lib/audit';
import {
  computeDiscountAmounts,
  type DiscountAppliedAuditContext,
} from '@/lib/audit/builders/discount-applied';
import type { AuditActor } from '@/lib/audit/types';

export type BillSplitDiscountSnapshot = {
  id: string;
  session_id: string | null;
  table_id: string | null;
  display_name: string | null;
  total_amount: number;
};

export async function hasDiscountAuditForBillSplit(
  admin: SupabaseClient,
  restaurantId: string,
  billSplitId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('operation_logs')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('action_type', AUDIT_EVENT.DISCOUNT_APPLIED)
    .eq('entity_id', billSplitId)
    .limit(1)
    .maybeSingle();
  return !!data?.id;
}

export async function recordDiscountAppliedAuditIfNeeded(params: {
  admin: SupabaseClient;
  restaurantId: string;
  actor: AuditActor;
  billSplit: BillSplitDiscountSnapshot;
  discountRate: number;
  reason: string;
  reasonDetail?: string | null;
}): Promise<void> {
  const rate = Math.min(100, Math.max(0, params.discountRate));
  if (rate <= 0) return;

  const alreadyLogged = await hasDiscountAuditForBillSplit(
    params.admin,
    params.restaurantId,
    params.billSplit.id,
  );
  if (alreadyLogged) return;

  const amounts = computeDiscountAmounts(Number(params.billSplit.total_amount) || 0, rate);
  const context: DiscountAppliedAuditContext = {
    billSplitId: params.billSplit.id,
    sessionId: params.billSplit.session_id,
    tableId: params.billSplit.table_id,
    tableName: params.billSplit.display_name,
    ...amounts,
  };

  await recordAudit(params.admin, AUDIT_EVENT.DISCOUNT_APPLIED, {
    restaurantId: params.restaurantId,
    actor: params.actor,
    context,
    reason: params.reason.trim(),
    reasonDetail: params.reasonDetail?.trim() || null,
  });
}
