import type { SupabaseClient } from '@supabase/supabase-js';
import type { SplitResult } from '@/types';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
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

export type ConfirmPaymentCollectionRecord = SessionCollectedPayment;

export type ConfirmPaymentResult =
  | {
      ok: true;
      all_paid: boolean;
      result: SplitResult[];
      final_amount: number;
      collection: ConfirmPaymentCollectionRecord | null;
    }
  | {
      ok: false;
      status: number;
      code: string;
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
  collected_payment_id?: string | null;
  confirmed_person_index?: number;
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
  invalid_collected_amount: 400,
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

function parseCollectionRecord(
  payload: ConfirmBillSplitPaymentRpc,
): ConfirmPaymentCollectionRecord | null {
  if (typeof payload.collected_payment_id !== 'string' || !payload.collected_payment_id) {
    return null;
  }
  const personIndex = payload.confirmed_person_index;
  if (typeof personIndex !== 'number' || !Number.isInteger(personIndex) || personIndex < 0) {
    return null;
  }
  return {
    id: payload.collected_payment_id,
    person_index: personIndex,
    person_name: payload.row_name ?? '',
    amount: Number(payload.row_amount) || 0,
    created_at: new Date().toISOString(),
  };
}

type ScheduleConfirmPaymentPrintParams = {
  admin: SupabaseClient;
  restaurantId: string;
  printLocale: string | null;
  billSplitId: string;
  personIndex: number;
  receiptPrinterId?: string;
  payload: ConfirmBillSplitPaymentRpc;
  rowAmount: number;
  finalAmount: number;
  collectedPaymentId: string | null;
};

function scheduleConfirmPaymentReceiptPrint(params: ScheduleConfirmPaymentPrintParams): void {
  const {
    admin,
    restaurantId,
    printLocale,
    billSplitId,
    personIndex,
    receiptPrinterId,
    payload,
    rowAmount,
    finalAmount,
    collectedPaymentId,
  } = params;

  const sessionId = payload.session_id ?? null;
  const tableId = payload.table_id;
  const tableDisplayName = payload.display_name;
  const printTarget = receiptPrinterId?.trim() || undefined;

  if (
    !payload.newly_paid ||
    !sessionId ||
    !tableId ||
    !tableDisplayName
  ) {
    return;
  }

  if (payload.should_print_split) {
    void enqueueReceiptPrint({
      admin,
      restaurantId,
      printLocale,
      sessionId,
      tableId,
      tableDisplayName,
      printSource: 'automatic',
      variant: 'split_payment',
      payerName: receiptPayerNameForPrint(payload.row_name ?? '', personIndex, printLocale),
      personAmount: rowAmount,
      amountPaid: rowAmount,
      paymentMethod: 'Cash',
      billSplitId,
      personIndex,
      receiptPrinterId: printTarget,
      collectedPaymentId,
    }).catch(() => {});
  }

  if (payload.should_print_final) {
    void enqueueReceiptPrint({
      admin,
      restaurantId,
      printLocale,
      sessionId,
      tableId,
      tableDisplayName,
      printSource: 'automatic',
      variant: 'final',
      amountPaid: finalAmount,
      paymentMethod: 'Cash',
      receiptPrinterId: printTarget,
      billSplitId,
      orderIds: parseRpcOrderIds(payload.order_ids),
    }).catch(() => {});
  }
}

export async function confirmBillSplitPayment(params: {
  admin: SupabaseClient;
  restaurantId: string;
  printLocale: string | null;
  billSplitId: string;
  personIndex: number;
  collectedAmount?: number;
  createdByUserId?: string;
  receiptPrinterId?: string;
  billReceiptPrintEnabled?: boolean;
}): Promise<ConfirmPaymentResult> {
  const {
    admin,
    restaurantId,
    printLocale,
    billSplitId,
    personIndex,
    collectedAmount,
    createdByUserId,
    receiptPrinterId,
    billReceiptPrintEnabled = false,
  } = params;

  const { data: rpcData, error: rpcErr } = await admin.rpc('confirm_bill_split_payment', {
    p_restaurant_id: restaurantId,
    p_bill_split_id: billSplitId,
    p_person_index: personIndex,
    p_collected_amount: collectedAmount ?? null,
    p_created_by_user_id: createdByUserId ?? null,
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
  const rowAmount = Number(payload.row_amount) || 0;
  const collectedPaymentId =
    typeof payload.collected_payment_id === 'string' ? payload.collected_payment_id : null;
  const collection = parseCollectionRecord(payload);

  if (billReceiptPrintEnabled) {
    scheduleConfirmPaymentReceiptPrint({
      admin,
      restaurantId,
      printLocale,
      billSplitId,
      personIndex,
      receiptPrinterId,
      payload,
      rowAmount,
      finalAmount,
      collectedPaymentId,
    });
  }

  return {
    ok: true,
    all_paid: allPaid,
    result,
    final_amount: finalAmount,
    collection,
  };
}
