import type { ReceiptVariant } from '@/lib/order-receipt-enqueue';

export type OrderReceiptPrintResult =
  | { ok: true; job_id?: string; skipped?: boolean; deduped?: boolean }
  | { ok: false; error: string };

export type OrderReceiptPrintParams = {
  slug: string;
  tableId: string;
  sessionId?: string | null;
  receiptVariant?: ReceiptVariant;
  jobType?: 'order_receipt' | 'pre_bill';
  amountPaid?: number;
  paymentMethod?: string;
  payerName?: string;
  personAmount?: number;
  billSplitId?: string | null;
  personIndex?: number;
  receiptPrinterId?: string;
  /** Checkout dashboard discount % — used for checkout_bill payable total. */
  discountRate?: number;
};

function resolveReceiptVariant(params: OrderReceiptPrintParams): ReceiptVariant {
  const { receiptVariant, jobType } = params;
  if (receiptVariant) return receiptVariant;
  if (jobType === 'pre_bill') return 'pre_bill';
  return 'final';
}

/** Enqueue a receipt print job via print agent queue. */
export async function requestOrderReceiptPrint(
  params: OrderReceiptPrintParams,
): Promise<OrderReceiptPrintResult> {
  const {
    slug,
    tableId,
    sessionId,
    amountPaid,
    paymentMethod,
    payerName,
    personAmount,
    billSplitId,
    personIndex,
    receiptPrinterId,
    discountRate,
  } = params;

  const variant = resolveReceiptVariant(params);

  try {
    const res = await fetch(`/api/restaurants/${encodeURIComponent(slug)}/order-receipt/print`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: tableId,
        ...(sessionId ? { session_id: sessionId } : {}),
        receipt_variant: variant,
        ...(amountPaid != null ? { amount_paid: amountPaid } : {}),
        ...(paymentMethod ? { payment_method: paymentMethod } : {}),
        ...(payerName ? { payer_name: payerName } : {}),
        ...(personAmount != null ? { person_amount: personAmount } : {}),
        ...(billSplitId ? { bill_split_id: billSplitId } : {}),
        ...(personIndex != null ? { person_index: personIndex } : {}),
        ...(receiptPrinterId?.trim() ? { receipt_printer_id: receiptPrinterId.trim() } : {}),
        ...(discountRate != null && discountRate > 0 ? { discount_rate: discountRate } : {}),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      skipped?: boolean;
      deduped?: boolean;
      job_id?: string;
      error?: string;
    };

    if (!res.ok) {
      return { ok: false, error: data.error || 'print_failed' };
    }

    return {
      ok: true,
      ...(data.skipped ? { skipped: true } : {}),
      ...(data.deduped ? { deduped: true } : {}),
      ...(data.job_id ? { job_id: data.job_id } : {}),
    };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

/** Fire-and-forget wrapper for flows where printing must not block UX. */
export function requestOrderReceiptPrintQuiet(params: OrderReceiptPrintParams): void {
  void requestOrderReceiptPrint(params);
}
