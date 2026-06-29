import type { SupabaseClient } from '@supabase/supabase-js';
import type { SplitResult } from '@/types';
import type { AuditActor } from '@/lib/audit/types';
import { recordDiscountAppliedAuditIfNeeded } from '@/lib/checkout-discount/record-discount-audit';
import { assertDiscountReadyForPayment } from '@/lib/checkout-discount/discount-payment-gate';
import { enqueueReceiptPrint } from '@/lib/order-receipt-enqueue';
import { receiptPayerNameForPrint } from '@/lib/receipt-payer-label';

export {
  applyDiscountToRows,
  checkoutPayableAmount,
  clampCheckoutDiscountRate,
  discountedSplitRows,
  normalizeSplitRows,
  sumSplitRowAmounts,
} from '@/lib/checkout-split-math';

export type ConfirmPaymentResult =
  | {
      ok: true;
      all_paid: boolean;
      result: SplitResult[];
      final_amount: number;
    }
  | {
      ok: false;
      status: number;
      code:
        | string
        | 'reason_required'
        | 'invalid_reason'
        | 'reason_detail_required'
        | 'bill_split_not_found';
      message?: string;
    };

type ConfirmBillSplitPaymentRpc = {
  ok: boolean;
  code?: string;
  message?: string;
  all_paid?: boolean;
  result?: SplitResult[];
  final_amount?: number;
  session_id?: string | null;
  table_id?: string;
  display_name?: string;
  order_ids?: unknown;
  row_name?: string;
  row_amount?: number;
  newly_paid?: boolean;
  should_print_split?: boolean;
  should_print_final?: boolean;
  should_close_session?: boolean;
};

const RPC_ERROR_STATUS: Record<string, number> = {
  bill_split_not_found: 404,
  bill_split_cancelled: 409,
  empty_split: 400,
  invalid_person_index: 400,
  already_paid: 409,
  bill_update_failed: 500,
  session_close_failed: 500,
};

/** HTTP status for confirm-payment RPC error codes (unit-tested). */
export function httpStatusForConfirmPaymentRpcCode(code: string): number {
  return RPC_ERROR_STATUS[code] ?? 500;
}

function parseRpcOrderIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
  return ids.length > 0 ? ids : undefined;
}

export async function confirmBillSplitPayment(params: {
  admin: SupabaseClient;
  restaurantId: string;
  printLocale: string | null;
  billSplitId: string;
  personIndex: number;
  discountRate?: number;
  discountReason?: string | null;
  discountReasonDetail?: string | null;
  actor?: AuditActor;
  receiptPrinterId?: string;
}): Promise<ConfirmPaymentResult> {
  const {
    admin,
    restaurantId,
    printLocale,
    billSplitId,
    personIndex,
    discountRate = 0,
    discountReason,
    discountReasonDetail,
    actor,
    receiptPrinterId,
  } = params;

  const normalizedRate = Math.min(100, Math.max(0, discountRate));

  const discountGate = await assertDiscountReadyForPayment({
    admin,
    restaurantId,
    billSplitId,
    discountRate: normalizedRate,
    discountReason,
    discountReasonDetail,
  });
  if (!discountGate.ok) {
    return { ok: false, status: discountGate.status, code: discountGate.code };
  }
  const billSplitSnapshot = discountGate.snapshot;

  const { data: rpcData, error: rpcErr } = await admin.rpc('confirm_bill_split_payment', {
    p_restaurant_id: restaurantId,
    p_bill_split_id: billSplitId,
    p_person_index: personIndex,
    p_discount_rate: normalizedRate,
  });

  if (rpcErr) {
    return {
      ok: false,
      status: 500,
      code: 'bill_update_failed',
      message: rpcErr.message,
    };
  }

  const payload = rpcData as ConfirmBillSplitPaymentRpc | null;
  if (!payload?.ok) {
    const code = payload?.code ?? 'bill_update_failed';
    return {
      ok: false,
      status: httpStatusForConfirmPaymentRpcCode(code),
      code,
      message: payload?.message,
    };
  }

  const result = (payload.result || []) as SplitResult[];
  const allPaid = !!payload.all_paid;
  const finalAmount = Number(payload.final_amount) || 0;
  const sessionId = payload.session_id ?? null;
  const tableId = payload.table_id;
  const tableDisplayName = payload.display_name;
  const printTarget = receiptPrinterId?.trim() || undefined;
  const rowAmount = Number(payload.row_amount) || 0;

  if (
    payload.newly_paid &&
    payload.should_print_split &&
    sessionId &&
    tableId &&
    tableDisplayName
  ) {
    await enqueueReceiptPrint({
      admin,
      restaurantId,
      printLocale,
      sessionId,
      tableId,
      tableDisplayName,
      variant: 'split_payment',
      payerName: receiptPayerNameForPrint(payload.row_name ?? '', personIndex, printLocale),
      personAmount: rowAmount,
      amountPaid: rowAmount,
      paymentMethod: 'Cash',
      billSplitId,
      personIndex,
      receiptPrinterId: printTarget,
    });
  }

  if (
    payload.newly_paid &&
    payload.should_print_final &&
    sessionId &&
    tableId &&
    tableDisplayName
  ) {
    await enqueueReceiptPrint({
      admin,
      restaurantId,
      printLocale,
      sessionId,
      tableId,
      tableDisplayName,
      variant: 'final',
      amountPaid: finalAmount,
      paymentMethod: 'Cash',
      receiptPrinterId: printTarget,
      billSplitId,
      orderIds: parseRpcOrderIds(payload.order_ids),
    });
  }

  if (
    normalizedRate > 0 &&
    actor &&
    billSplitSnapshot &&
    discountReason?.trim()
  ) {
    await recordDiscountAppliedAuditIfNeeded({
      admin,
      restaurantId,
      actor,
      billSplit: billSplitSnapshot,
      discountRate: normalizedRate,
      reason: discountReason,
      reasonDetail: discountReasonDetail,
    });
  }

  return { ok: true, all_paid: allPaid, result, final_amount: finalAmount };
}
