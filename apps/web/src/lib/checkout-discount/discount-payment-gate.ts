import type { SupabaseClient } from '@supabase/supabase-js';
import {
  hasDiscountAuditForBillSplit,
  type BillSplitDiscountSnapshot,
} from '@/lib/checkout-discount/record-discount-audit';
import { validateDiscountReason } from '@/lib/checkout-discount/validate-discount-reason';
import { clampCheckoutDiscountRate } from '@/lib/checkout-split-math';

export type DiscountPaymentGateResult =
  | {
      ok: true;
      snapshot: BillSplitDiscountSnapshot | null;
    }
  | {
      ok: false;
      status: number;
      code:
        | 'bill_split_not_found'
        | 'reason_required'
        | 'invalid_reason'
        | 'reason_detail_required';
    };

/** Bill-level discount gate: load split, require reason only before first discount audit. */
export async function assertDiscountReadyForPayment(params: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  discountRate: number;
  discountReason?: string | null;
  discountReasonDetail?: string | null;
}): Promise<DiscountPaymentGateResult> {
  const normalizedRate = clampCheckoutDiscountRate(params.discountRate);
  if (normalizedRate <= 0) {
    return { ok: true, snapshot: null };
  }

  const { data: splitRow, error: splitErr } = await params.admin
    .from('bill_splits')
    .select('id, session_id, table_id, display_name, total_amount')
    .eq('id', params.billSplitId)
    .eq('restaurant_id', params.restaurantId)
    .maybeSingle();

  if (splitErr || !splitRow) {
    return { ok: false, status: 404, code: 'bill_split_not_found' };
  }

  const snapshot: BillSplitDiscountSnapshot = {
    id: splitRow.id as string,
    session_id: (splitRow.session_id as string | null) ?? null,
    table_id: (splitRow.table_id as string | null) ?? null,
    display_name: (splitRow.display_name as string | null) ?? null,
    total_amount: Number(splitRow.total_amount) || 0,
  };

  const alreadyAudited = await hasDiscountAuditForBillSplit(
    params.admin,
    params.restaurantId,
    snapshot.id,
  );
  if (alreadyAudited) {
    return { ok: true, snapshot };
  }

  const reasonValidation = validateDiscountReason(
    normalizedRate,
    params.discountReason,
    params.discountReasonDetail,
  );
  if (!reasonValidation.ok) {
    return { ok: false, status: 400, code: reasonValidation.code };
  }

  return { ok: true, snapshot };
}
