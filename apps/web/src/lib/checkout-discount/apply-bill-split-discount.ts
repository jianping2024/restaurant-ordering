import type { SupabaseClient } from '@supabase/supabase-js';
import type { SplitResult } from '@/types';
import type { AuditActor } from '@/lib/audit/types';
import {
  recordDiscountAppliedAuditIfNeeded,
  type BillSplitDiscountSnapshot,
} from '@/lib/checkout-discount/record-discount-audit';
import { validateDiscountReason } from '@/lib/checkout-discount/validate-discount-reason';
import { clampCheckoutDiscountRate } from '@/lib/checkout-split-math';

export type ApplyBillSplitDiscountResult =
  | {
      ok: true;
      discount_rate: number;
      discount_reason: string | null;
      discount_reason_detail: string | null;
    }
  | {
      ok: false;
      status: number;
      code:
        | 'bill_split_not_found'
        | 'bill_split_cancelled'
        | 'discount_locked_after_payment'
        | 'reason_required'
        | 'invalid_reason'
        | 'reason_detail_required'
        | 'bill_update_failed';
      message?: string;
    };

function splitHasPaidPerson(result: unknown): boolean {
  if (!Array.isArray(result)) return false;
  return result.some((row) => {
    if (!row || typeof row !== 'object') return false;
    return !!(row as SplitResult).paid;
  });
}

async function sessionHasCollectedLedger(
  admin: SupabaseClient,
  restaurantId: string,
  sessionId: string | null,
): Promise<boolean> {
  if (!sessionId) return false;
  const { count, error } = await admin
    .from('session_collected_payments')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId);
  return !error && (count ?? 0) > 0;
}

export async function applyBillSplitDiscount(params: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  discountRate: number;
  discountReason?: string | null;
  discountReasonDetail?: string | null;
  actor?: AuditActor;
}): Promise<ApplyBillSplitDiscountResult> {
  const normalizedRate = clampCheckoutDiscountRate(params.discountRate);

  const { data: splitRow, error: splitErr } = await params.admin
    .from('bill_splits')
    .select(
      'id, session_id, table_id, display_name, total_amount, status, result, discount_reason, discount_reason_detail',
    )
    .eq('id', params.billSplitId)
    .eq('restaurant_id', params.restaurantId)
    .maybeSingle();

  if (splitErr || !splitRow) {
    return { ok: false, status: 404, code: 'bill_split_not_found' };
  }

  if ((splitRow.status as string) === 'cancelled') {
    return { ok: false, status: 409, code: 'bill_split_cancelled' };
  }

  if (splitHasPaidPerson(splitRow.result)) {
    return { ok: false, status: 409, code: 'discount_locked_after_payment' };
  }

  const sessionId = (splitRow.session_id as string | null) ?? null;
  if (await sessionHasCollectedLedger(params.admin, params.restaurantId, sessionId)) {
    return { ok: false, status: 409, code: 'discount_locked_after_payment' };
  }

  const existingReason =
    typeof splitRow.discount_reason === 'string' ? splitRow.discount_reason.trim() : '';
  const existingDetail =
    typeof splitRow.discount_reason_detail === 'string'
      ? splitRow.discount_reason_detail.trim()
      : '';

  const reason =
    (params.discountReason?.trim() || existingReason) || null;
  const reasonDetail =
    (params.discountReasonDetail?.trim() || existingDetail) || null;

  if (normalizedRate > 0) {
    const reasonValidation = validateDiscountReason(normalizedRate, reason, reasonDetail);
    if (!reasonValidation.ok) {
      return { ok: false, status: 400, code: reasonValidation.code };
    }
  }

  const nextReason = normalizedRate > 0 ? reason : null;
  const nextDetail = normalizedRate > 0 ? reasonDetail : null;

  const { error: updateErr } = await params.admin
    .from('bill_splits')
    .update({
      discount_rate: normalizedRate,
      discount_reason: nextReason,
      discount_reason_detail: nextDetail,
    })
    .eq('id', params.billSplitId)
    .eq('restaurant_id', params.restaurantId);

  if (updateErr) {
    return {
      ok: false,
      status: 500,
      code: 'bill_update_failed',
      message: updateErr.message,
    };
  }

  if (normalizedRate > 0 && params.actor && nextReason) {
    const snapshot: BillSplitDiscountSnapshot = {
      id: splitRow.id as string,
      session_id: (splitRow.session_id as string | null) ?? null,
      table_id: (splitRow.table_id as string | null) ?? null,
      display_name: (splitRow.display_name as string | null) ?? null,
      total_amount: Number(splitRow.total_amount) || 0,
    };
    await recordDiscountAppliedAuditIfNeeded({
      admin: params.admin,
      restaurantId: params.restaurantId,
      actor: params.actor,
      billSplit: snapshot,
      discountRate: normalizedRate,
      reason: nextReason,
      reasonDetail: nextDetail,
    });
  }

  return {
    ok: true,
    discount_rate: normalizedRate,
    discount_reason: nextReason,
    discount_reason_detail: nextDetail,
  };
}
