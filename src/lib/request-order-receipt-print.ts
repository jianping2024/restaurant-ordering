import type { ReceiptVariant } from '@/lib/order-receipt-enqueue';

/** Fire-and-forget receipt print via print agent queue. */
export async function requestOrderReceiptPrint(params: {
  slug: string;
  tableNumber: number;
  sessionId?: string | null;
  receiptVariant?: ReceiptVariant;
  jobType?: 'order_receipt' | 'pre_bill';
  amountPaid?: number;
  paymentMethod?: string;
  payerName?: string;
  personAmount?: number;
  billSplitId?: string | null;
  personIndex?: number;
}): Promise<void> {
  const {
    slug,
    tableNumber,
    sessionId,
    receiptVariant,
    jobType,
    amountPaid,
    paymentMethod,
    payerName,
    personAmount,
    billSplitId,
    personIndex,
  } = params;

  const variant =
    receiptVariant ?? (jobType === 'pre_bill' ? 'pre_bill' : jobType ? 'final' : 'final');

  try {
    await fetch(`/api/restaurants/${encodeURIComponent(slug)}/order-receipt/print`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_number: tableNumber,
        ...(sessionId ? { session_id: sessionId } : {}),
        receipt_variant: variant,
        ...(amountPaid != null ? { amount_paid: amountPaid } : {}),
        ...(paymentMethod ? { payment_method: paymentMethod } : {}),
        ...(payerName ? { payer_name: payerName } : {}),
        ...(personAmount != null ? { person_amount: personAmount } : {}),
        ...(billSplitId ? { bill_split_id: billSplitId } : {}),
        ...(personIndex != null ? { person_index: personIndex } : {}),
      }),
    });
  } catch {
    // Printing must not block checkout UX.
  }
}
