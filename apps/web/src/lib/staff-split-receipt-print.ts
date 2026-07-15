import {
  requestOrderReceiptPrint,
  type OrderReceiptPrintResult,
} from '@/lib/request-order-receipt-print';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { StaffCheckoutBillPrintTarget } from '@/lib/staff-checkout-bill-print';

/** Manual split_payment receipt — same path as dashboard checkout; not gated by bill_receipt_print. */
export async function requestStaffSplitReceiptPrint(params: {
  slug: string;
  billSplit: StaffCheckoutBillPrintTarget;
  payment: SessionCollectedPayment;
}): Promise<OrderReceiptPrintResult> {
  const { slug, billSplit, payment } = params;
  if (payment.person_index == null || payment.person_index < 0) {
    return { ok: false, error: 'invalid_person_index' };
  }
  return requestOrderReceiptPrint({
    slug,
    tableId: billSplit.table_id,
    sessionId: billSplit.session_id ?? undefined,
    billSplitId: billSplit.id,
    receiptVariant: 'split_payment',
    personIndex: payment.person_index,
    payerName: payment.person_name,
    personAmount: payment.amount,
    amountPaid: payment.amount,
    paymentMethod: 'Cash',
    collectedPaymentId: payment.id,
  });
}
